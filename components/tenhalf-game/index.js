const i18n = require('../../utils/i18n');
const realtimePlayerProfile = require('../../utils/realtime_player_profile.js');

const DEAL_HOLD_MS = 2000;
const DEAL_MOVE_MS = 440;
const HEARTBEAT_INTERVAL_MS = 12000;
const HEARTBEAT_TIMEOUT_MS = 6500;
const HEARTBEAT_RETRY_MS = 2500;
const STALE_MEMBER_MS = 180000;
const STALE_CONFIRM_MS = 24000;
const ROOM_CLOSE_VERIFY_DELAY_MS = 450;
const ROOM_CLOSE_VERIFY_GAP_MS = 650;
const ROOM_CLOSE_VERIFY_COUNT = 2;
const WATCH_RECONNECT_BASE_MS = 500;
const WATCH_RECONNECT_MAX_MS = 5000;
const WATCH_RECONNECT_JITTER_MS = 220;
const DEADLINE_RETRY_MS = 800;
const DICE_RESULT_AUTO_MS = 3600;
const DICE_RESULT_GAP_MS = 180;
const DICE_ROLL_DURATION_MS = 2000;
const DICE_FACE_INTERVAL_MS = 75;
const AUCTION_CHOICE_MS = 10000;
const COORDINATOR_FALLBACK_STEP_MS = 420;
const AUCTION_ACTION_ATTEMPT_TIMEOUT_MS = 1200;
const AUCTION_ACTION_RETRY_GAP_MS = 160;
const AUCTION_ACTION_MAX_ATTEMPTS = 6;

Component({
    properties: {
        copy: {
            type: Object,
            value: {},
            observer() {
                if (this._latestGameState) {
                    this._applyGameState(this._latestGameState);
                }
            }
        },
        locale: {
            type: String,
            value: 'zh-Hans'
        },
        shareHostId: {
            type: String,
            value: '',
            observer(value) {
                this._pendingShareHostId = value || '';
                this._tryJoinSharedRoom();
            }
        },
        sharedEntryPending: {
            type: Boolean,
            value: false,
            observer(value) {
                if (!value) wx.nextTick(() => this._prepareRoomEntry());
            }
        }
    },

    data: {
        navTop: 60,
        menuRight: 95,
        menuDotRight: 117,

        myOpenId: '',
        roomId: '',
        roomDocId: '',
        roomMembers: [],
        onlineCount: 1,
        isOnlineMode: false,
        isHost: false,
        connectionStatus: 'disconnected',
        isStarting: false,
        isActing: false,

        gamePhase: 'waiting',
        gameStateVersion: 0,
        roundToken: '',
        playerViews: [],
        playerChipWidthPx: 140,
        playerAvatarSizePx: 24,
        playerRowWidthPx: 375,
        playerSidePaddingPx: 12,
        settlementPanelWidthPx: 351,
        isPlayer: false,
        isSpectator: false,
        canAct: false,
        myNeedsDice: false,
        myRollCount: 0,
        latestDice: [],
        displayDice: [1, 1],
        rollSummaryText: '',
        showDiceResult: false,
        diceResultPlayerName: '',
        diceResultText: '',

        auctionProgress: '0 / 0',
        currentCard: null,
        currentPrice: 0,
        currentBidType: '',
        currentPriceLabel: '',
        turnLabel: '',
        choiceRound: 0,
        hasSubmittedChoice: false,
        isAuctionEligible: false,
        isAuctionLeader: false,
        isAuctionTie: false,
        countdownSeconds: 0,
        outcomeText: '',
        auctionStageTopPx: 65,
        auctionStageBottomPx: 95,
        tenHalfCount: 0,
        multiplier: 1,

        privateHand: null,
        myPublicCards: [],
        showSecretDock: false,
        showDealOverlay: false,
        dealMoving: false,
        dealMoveX: 0,
        dealMoveY: 0,
        dealMoveScale: 1,
        secretBottomPx: 90
    },

    lifetimes: {
        attached() {
            this._isAttached = true;
            this._isPageVisible = true;
            this._connectionId = 'tenhalf_conn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
            this._calculateNavLayout();
            this._fetchMyOpenId();
            wx.nextTick(() => this._calculateSecretCardBottom());
        },

        detached() {
            this._isPageVisible = false;
            this._isAttached = false;
            this._cleanupAllTimers();
            this._leaveRoom();
        }
    },

    pageLifetimes: {
        show() {
            if (!this._isAttached) return;
            this._isPageVisible = true;
            this._deadlineRequestedKey = '';
            this._calculateSecretCardBottom();
            if (this.data.isOnlineMode && this.data.roomId) {
                this._startRoomWatch(this.data.roomId);
                this._startHeartbeat();
                if (this._latestGameState) this._scheduleDeadline(this._latestGameState);
            } else {
                this._prepareRoomEntry();
            }
        },

        hide() {
            this._isPageVisible = false;
            this._cancelRoomClosureVerification();
            this._pauseRoomConnections();
            this._clearDeadlineTimer();
        },

        resize() {
            this._calculateNavLayout();
            this._calculateSecretCardBottom();
            this._updatePlayerStripLayout(this.data.playerViews.length);
        }
    },

    methods: {
        _debug(message, details) {
            console.info('[十点半调试] ' + message, {
                '是否已连接房间': !!this.data.roomId,
                ...(details || {})
            });
        },

        _stateRevision(state) {
            if (!state) return 0;
            const revision = Number(state.stateRevision);
            return Number.isFinite(revision) ? revision : Number(state.version || 0);
        },

        _auctionRoundKey(state) {
            if (!state || state.phase !== 'auction') return '';
            return [
                state.roundToken || '',
                Number(state.auctionIndex),
                Math.max(1, Number(state.choiceRound) || 1)
            ].join(':');
        },

        _deadlineKey(state) {
            if (!state || !state.deadlineAt) return '';
            if (state.phase === 'auction') {
                return 'auction:' + this._auctionRoundKey(state) + ':' + Number(state.deadlineAt);
            }
            return [state.phase || '', Number(state.version || 0), Number(state.deadlineAt)].join(':');
        },

        _serverNow() {
            return Date.now() + (this._serverClockReady ? (this._serverClockOffsetMs || 0) : 0);
        },

        _updateServerClock(serverTime, requestStartedAt) {
            const receivedAt = Date.now();
            const serverTimestamp = Number(serverTime);
            if (!Number.isFinite(serverTimestamp) || serverTimestamp <= 0) return;
            const startedAt = Number(requestStartedAt);
            const midpoint = Number.isFinite(startedAt) && startedAt > 0
                ? startedAt + (receivedAt - startedAt) / 2
                : receivedAt;
            const sampleOffset = serverTimestamp - midpoint;
            this._serverClockOffsetMs = this._serverClockReady
                ? this._serverClockOffsetMs * 0.75 + sampleOffset * 0.25
                : sampleOffset;
            this._serverClockReady = true;
        },

        _deadlineRemainingMs(state) {
            if (!state || !state.deadlineAt) return 0;
            const deadlineAt = Number(state.deadlineAt);
            if (state.phase !== 'auction') {
                return Math.max(0, deadlineAt - this._serverNow());
            }

            const roundKey = this._deadlineKey(state);
            const rawRemaining = deadlineAt - this._serverNow();
            if (rawRemaining >= 0 && rawRemaining <= AUCTION_CHOICE_MS) return rawRemaining;
            if (this._serverClockReady && rawRemaining < 0) return 0;

            // 首次校时完成前用本地单调的10秒兜底，避免设备时钟偏差显示异常或直接归零。
            if (this._localDeadlineRoundKey !== roundKey) {
                this._localDeadlineRoundKey = roundKey;
                this._localDeadlineAt = Date.now() + AUCTION_CHOICE_MS;
            }
            return Math.max(0, this._localDeadlineAt - Date.now());
        },

        _text(key, fallback) {
            return (this.data.copy && this.data.copy[key]) || fallback || '';
        },

        _format(key, fallback, values) {
            return i18n.formatString(this._text(key, fallback), values || {});
        },

        _calculateNavLayout() {
            try {
                const menuBtn = wx.getMenuButtonBoundingClientRect();
                const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
                if (menuBtn && menuBtn.top > 0) {
                    const menuRight = windowInfo.windowWidth - menuBtn.right;
                    this.setData({
                        navTop: menuBtn.top,
                        menuRight: menuRight,
                        menuDotRight: menuRight + menuBtn.width * 0.72
                    });
                }
            } catch (e) {}
        },

        _calculateSecretCardBottom() {
            if (!this._isAttached) return;
            let windowInfo;
            try {
                windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
            } catch (error) {
                return;
            }

            const windowWidth = windowInfo.windowWidth || 375;
            const windowHeight = windowInfo.windowHeight || 667;
            const rpx = windowWidth / 750;
            const safeBottom = windowInfo.safeArea
                ? Math.max(0, windowHeight - windowInfo.safeArea.bottom)
                : 0;
            const tabTop = windowHeight - safeBottom - 150 * rpx;
            const gap = 24 * rpx;

            this.createSelectorQuery()
                .select('.tenhalf-root')
                .boundingClientRect((rect) => {
                    if (!this._isAttached || !rect || !rect.height) return;
                    const requiredBottom = Math.max(gap, rect.bottom - tabTop + gap);
                    this.setData({
                        secretBottomPx: Math.round(requiredBottom)
                    });
                })
                .exec();
        },

        _getPlayerStripLayout(playerCount) {
            let windowInfo;
            try {
                windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
            } catch (error) {
                windowInfo = {};
            }
            const windowWidth = windowInfo.windowWidth || 375;
            const windowHeight = windowInfo.windowHeight || 667;
            const rpx = windowWidth / 750;
            const count = Math.max(1, Number(playerCount) || 1);
            const visibleCount = Math.min(3, count);
            const sidePadding = 24 * rpx;
            const gap = 24 * rpx;
            let chipWidth = (windowWidth - sidePadding * 2 - gap * (visibleCount - 1)) / visibleCount;
            if (visibleCount === 1) chipWidth = Math.min(chipWidth, 280 * rpx);
            chipWidth = Math.max(96 * rpx, chipWidth);
            const auctionOffset = Math.max(14, Math.min(26, windowHeight * 0.03));
            const auctionTop = (windowHeight <= 700 ? 142 : 170) * rpx - auctionOffset;
            const auctionBottom = 150 * rpx + auctionOffset;
            const avatarSize = visibleCount === 1 ? 30 : (visibleCount === 2 ? 26 : 22);
            return {
                playerChipWidthPx: Number(chipWidth.toFixed(2)),
                playerAvatarSizePx: avatarSize,
                playerSidePaddingPx: Number(sidePadding.toFixed(2)),
                auctionStageTopPx: Number(auctionTop.toFixed(2)),
                auctionStageBottomPx: Number(auctionBottom.toFixed(2)),
                playerRowWidthPx: Math.max(
                    windowWidth,
                    Math.ceil(sidePadding * 2 + chipWidth * count + gap * (count - 1))
                ),
                settlementPanelWidthPx: Number((windowWidth - sidePadding * 2).toFixed(2))
            };
        },

        _updatePlayerStripLayout(playerCount) {
            if (!this._isAttached) return;
            this.setData(this._getPlayerStripLayout(playerCount));
        },

        async _fetchMyOpenId() {
            const app = getApp();
            let openId = app.globalData.openId || '';
            if (!openId) {
                try {
                    const response = await wx.cloud.callFunction({ name: 'login' });
                    openId = response.result && response.result.openid;
                    if (openId) app.globalData.openId = openId;
                } catch (error) {
                    console.warn('[TenHalf] Failed to get OpenID:', error);
                }
            }

            if (!this._isAttached || !openId) return;
            const ownProfile = realtimePlayerProfile.getStoredProfile();
            this.setData({
                myOpenId: openId,
                roomMembers: this.data.roomMembers.length
                    ? this.data.roomMembers
                    : [{
                        openId: openId,
                        isHost: true,
                        avatarUrl: ownProfile.avatarUrl,
                        nickname: ownProfile.nickname
                    }],
                onlineCount: Math.max(1, this.data.roomMembers.length)
            });
            this._prepareRoomEntry();
        },

        _prepareRoomEntry() {
            if (!this._isAttached || !this.data.myOpenId || this.data.isOnlineMode) return;
            const sharedHostId = this._pendingShareHostId || this.data.shareHostId;
            if (sharedHostId) {
                this._tryJoinSharedRoom();
                return;
            }
            if (!this.data.sharedEntryPending) {
                this._roomShareHostId = this.data.myOpenId;
                this._createRoomAfterShare(this.data.myOpenId, true);
            }
        },

        _tryJoinSharedRoom() {
            const hostId = this._pendingShareHostId || this.data.shareHostId;
            if (!this._isAttached || !hostId || !this.data.myOpenId || this._joiningSharedRoom) return;
            if (this.data.isOnlineMode && this._roomShareHostId === hostId) return;
            this._roomShareHostId = hostId;
            this._joinRoomByHostId(hostId);
        },

        buildShareMessage() {
            const app = getApp();
            const hostId = this._roomShareHostId || this.data.myOpenId || app.globalData.openId;
            if (!hostId) {
                wx.showToast({ title: this._text('preparing', '正在准备，请稍后'), icon: 'none' });
                return {
                    title: this._text('shareTitle', '十点半｜来拍还是来杀？'),
                    path: '/pages/profile/index?game=tenhalf',
                    imageUrl: '/logo.png'
                };
            }

            if (!this.data.isOnlineMode) {
                if (!this.data.myOpenId) {
                    this.setData({
                        myOpenId: hostId,
                        roomMembers: [{ openId: hostId, isHost: true }],
                        onlineCount: 1
                    }, () => this._createRoomAfterShare(hostId));
                } else {
                    this._createRoomAfterShare(hostId);
                }
            }
            return {
                title: this._text('shareTitle', '十点半｜来拍还是来杀？'),
                path: '/pages/profile/index?game=tenhalf&hostId=' + encodeURIComponent(hostId),
                imageUrl: '/logo.png'
            };
        },

        buildTimelineMessage() {
            return {
                title: this._text('timelineTitle', '十点半｜多摸一张，天堂或爆'),
                imageUrl: '/logo.png'
            };
        },

        async _createRoomAfterShare(explicitHostId, silent) {
            const hostId = explicitHostId || this.data.myOpenId;
            if (!hostId || this._isCreatingRoom || this.data.isOnlineMode) return;
            this._roomShareHostId = hostId;
            this._isCreatingRoom = true;

            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'createByHost',
                        hostId: hostId,
                        gameType: 'tenhalf',
                        connectionId: this._connectionId
                    }
                });
                const result = response.result || {};
                if (!result.success || !result.room) {
                    throw new Error(result.error || '创建房间失败');
                }
                if (!this._isAttached) return;

                this._applyRoom(result.room, true, result.roomDocId);
                if (!silent) {
                    wx.showToast({ title: this._text('roomCreated', '房间已创建'), icon: 'success' });
                }
            } catch (error) {
                console.error('[TenHalf] Create room failed:', error);
                if (this._isAttached) {
                    wx.showToast({ title: this._text('createFailed', '创建房间失败'), icon: 'none' });
                }
            } finally {
                this._isCreatingRoom = false;
            }
        },

        async _joinRoomByHostId(hostId) {
            if (this._joiningSharedRoom) return;
            this._roomShareHostId = hostId;
            this._joiningSharedRoom = true;

            if (hostId === this.data.myOpenId) {
                this._joiningSharedRoom = false;
                await this._createRoomAfterShare();
                return;
            }

            wx.showLoading({ title: this._text('joiningRoom', '加入房间中…') });
            let joined = false;
            let lastError = '';
            try {
                for (let attempt = 0; attempt < 4 && !joined; attempt++) {
                    const response = await wx.cloud.callFunction({
                        name: 'roomManager',
                        data: {
                            action: 'joinByHost',
                            hostId: hostId,
                            gameType: 'tenhalf',
                            connectionId: this._connectionId
                        }
                    });
                    const result = response.result || {};
                    if (result.success && result.room) {
                        if (!this._isAttached) {
                            joined = true;
                            break;
                        }
                        this._applyRoom(result.room, result.isHost, result.roomDocId);
                        joined = true;
                        break;
                    }
                    lastError = result.error || '';
                    if (!result.roomNotFound || attempt === 3) break;
                    await new Promise((resolve) => setTimeout(resolve, 600));
                }
            } catch (error) {
                lastError = error.message || '';
                console.error('[TenHalf] Join room failed:', error);
            } finally {
                wx.hideLoading();
                this._joiningSharedRoom = false;
            }

            if (!this._isAttached) return;
            if (joined) {
                wx.showToast({ title: this._text('joinedRoom', '已加入房间'), icon: 'success' });
            } else {
                wx.showToast({ title: lastError || this._text('joinFailed', '加入房间失败'), icon: 'none' });
            }
        },

        _applyRoom(room, isHost, roomDocId) {
            if (!room) return;
            const roomChanged = !!this.data.roomId && this.data.roomId !== room.roomId;
            if (roomChanged) {
                this._presenceDocId = '';
                this._presenceMap = {};
                this._presenceConnections = {};
                this._presenceReady = false;
            }
            const members = room.members || [];
            const myMember = members.find((member) => member.openId === this.data.myOpenId);
            this.setData({
                roomId: room.roomId,
                roomDocId: roomDocId || room._id || this.data.roomDocId,
                roomMembers: members,
                onlineCount: Math.max(1, members.length),
                isOnlineMode: true,
                isHost: myMember ? myMember.isHost === true : isHost === true,
                connectionStatus: 'connecting'
            });
            this._applyGameState(room.gameState || {});
            this._startRoomWatch(room.roomId);
            this._startHeartbeat();
        },

        _cancelRoomClosureVerification() {
            this._roomClosureVerifyToken = '';
            if (this._roomClosureVerifyTimer) {
                clearTimeout(this._roomClosureVerifyTimer);
                this._roomClosureVerifyTimer = null;
            }
        },

        _requestRoomClosureVerification(roomId, reason) {
            if (!roomId || !this._isAttached || !this._isPageVisible || this.data.roomId !== roomId) return;
            if (this._roomClosureVerifyToken) return;
            const token = roomId + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 7);
            this._roomClosureVerifyToken = token;
            let missingCount = 0;

            const verify = async () => {
                this._roomClosureVerifyTimer = null;
                if (!this._isAttached || !this._isPageVisible || this.data.roomId !== roomId ||
                    this._roomClosureVerifyToken !== token) return;
                try {
                    const result = await wx.cloud.database().collection('GameRoom')
                        .where({ roomId: roomId })
                        .limit(1)
                        .get();
                    if (this._roomClosureVerifyToken !== token) return;
                    const room = result && result.data && result.data[0];
                    const stillJoined = room && (room.members || []).some(
                        (member) => member.openId === this.data.myOpenId
                    );
                    if (stillJoined) {
                        this._cancelRoomClosureVerification();
                        this._onRoomUpdate(room);
                        return;
                    }
                    missingCount += 1;
                } catch (error) {
                    // 网络错误不是房间关闭的证据，只恢复唯一的实时监听。
                    this._cancelRoomClosureVerification();
                    this.setData({ connectionStatus: 'reconnecting' });
                    this._scheduleRoomWatchReconnect(roomId);
                    return;
                }

                if (missingCount >= ROOM_CLOSE_VERIFY_COUNT) {
                    this._cancelRoomClosureVerification();
                    this._debug('连续确认房间已关闭或本人已离开', { '触发原因': reason || '' });
                    this._onRoomClosed();
                    return;
                }
                this._roomClosureVerifyTimer = setTimeout(verify, ROOM_CLOSE_VERIFY_GAP_MS);
            };

            this.setData({ connectionStatus: 'reconnecting' });
            this._roomClosureVerifyTimer = setTimeout(verify, ROOM_CLOSE_VERIFY_DELAY_MS);
        },

        _scheduleRoomWatchReconnect(roomId) {
            if (!roomId || this._watchReconnectTimer || !this._isAttached || !this._isPageVisible) return;
            const attempt = Math.min(6, (this._watchReconnectAttempt || 0) + 1);
            this._watchReconnectAttempt = attempt;
            const backoff = Math.min(
                WATCH_RECONNECT_MAX_MS,
                WATCH_RECONNECT_BASE_MS * Math.pow(2, attempt - 1)
            );
            const delay = backoff + Math.floor(Math.random() * WATCH_RECONNECT_JITTER_MS);
            this._watchReconnectTimer = setTimeout(() => {
                this._watchReconnectTimer = null;
                if (!this._isAttached || !this._isPageVisible || this.data.roomId !== roomId) return;
                if (this._roomWatcher) {
                    try { this._roomWatcher.close(); } catch (e) {}
                    this._roomWatcher = null;
                }
                this._startRoomWatch(roomId);
            }, delay);
        },

        async _startRoomWatch(roomId) {
            if (!roomId || this._startingWatcher) return;
            this._startingWatcher = true;
            const watchGeneration = (this._roomWatchGeneration || 0) + 1;
            this._roomWatchGeneration = watchGeneration;
            try {
                if (this._roomWatcher) {
                    try { this._roomWatcher.close(); } catch (e) {}
                    this._roomWatcher = null;
                }
                if (!this.data.isOnlineMode || this.data.roomId !== roomId) return;

                const db = wx.cloud.database();
                let receivedDocument = false;
                this._roomWatcher = db.collection('GameRoom').where({ roomId: roomId }).watch({
                    onChange: (snapshot) => {
                        if (!this._isAttached || this.data.roomId !== roomId ||
                            this._roomWatchGeneration !== watchGeneration) return;
                        const document = snapshot.docs && snapshot.docs[0];
                        if (!document) {
                            if (receivedDocument) this._requestRoomClosureVerification(roomId, '实时监听返回空快照');
                            else {
                                this.setData({ connectionStatus: 'reconnecting' });
                                this._recoverRoomSnapshot(roomId);
                                this._scheduleRoomWatchReconnect(roomId);
                            }
                            return;
                        }
                        receivedDocument = true;
                        this._watchReconnectAttempt = 0;
                        this._cancelRoomClosureVerification();
                        if (this._watchReconnectTimer) {
                            clearTimeout(this._watchReconnectTimer);
                            this._watchReconnectTimer = null;
                        }
                        this.setData({ connectionStatus: 'connected' });
                        this._onRoomUpdate(document);
                    },
                    onError: () => {
                        if (this.data.roomId === roomId &&
                            this._roomWatchGeneration === watchGeneration) {
                            this.setData({ connectionStatus: 'reconnecting' });
                            this._recoverRoomSnapshot(roomId);
                            this._scheduleRoomWatchReconnect(roomId);
                        }
                    }
                });
            } catch (error) {
                console.warn('[十点半调试] 实时监听建立失败，准备重连', error);
                this.setData({ connectionStatus: 'reconnecting' });
                this._recoverRoomSnapshot(roomId);
                this._scheduleRoomWatchReconnect(roomId);
            } finally {
                this._startingWatcher = false;
            }
        },

        async _recoverRoomSnapshot(roomId) {
            const recoveryGeneration = this._roomWatchGeneration || 0;
            if (this._roomRecoveryInFlight || this._roomRecoveryGeneration === recoveryGeneration ||
                !roomId || !this._isAttached ||
                !this._isPageVisible || !this.data.isOnlineMode || this.data.roomId !== roomId) {
                return;
            }
            this._roomRecoveryGeneration = recoveryGeneration;
            this._roomRecoveryInFlight = true;
            try {
                const collection = wx.cloud.database().collection('GameRoom');
                const result = await collection.where({ roomId: roomId }).limit(1).get();
                const room = result && result.data && result.data[0];
                if (!this._isAttached || !this._isPageVisible ||
                    !this.data.isOnlineMode || this.data.roomId !== roomId) return;
                if (room) {
                    this._onRoomUpdate(room);
                } else {
                    this._requestRoomClosureVerification(roomId, '断线补读未找到房间');
                }
            } catch (error) {
                this._debug('断线时的一次性房间补读失败', { '错误': error.message || String(error) });
            } finally {
                this._roomRecoveryInFlight = false;
            }
        },

        _onRoomUpdate(room) {
            if (!room || room.gameType !== 'tenhalf') return;
            if (this._latestGameState &&
                this._stateRevision(room.gameState || {}) < this._stateRevision(this._latestGameState)) {
                this._debug('忽略断线恢复期间晚到的旧房间快照', {
                    '旧消息修订号': this._stateRevision(room.gameState || {}),
                    '当前修订号': this._stateRevision(this._latestGameState)
                });
                return;
            }
            const members = room.members || [];
            const myMember = members.find((member) => member.openId === this.data.myOpenId);
            if (this.data.myOpenId && !myMember) {
                this._requestRoomClosureVerification(room.roomId || this.data.roomId, '成员快照暂时缺少本人');
                return;
            }
            this._cancelRoomClosureVerification();
            this.setData({
                roomDocId: room._id || this.data.roomDocId,
                roomMembers: members,
                onlineCount: Math.max(1, members.length),
                isHost: !!(myMember && myMember.isHost),
                connectionStatus: 'connected'
            });
            this._applyGameState(room.gameState || {});
            this._checkStaleMembers(this._presenceMap || {}, members);
        },

        _checkStaleMembers(activeMap, members) {
            if (!this._presenceReady) return;
            const now = Date.now();
            if (this._lastStaleCheck && now - this._lastStaleCheck < 5000) return;
            this._lastStaleCheck = now;
            const liveOpenIds = new Set((members || []).map((member) => member.openId));
            this._staleCandidates = this._staleCandidates || {};
            Object.keys(this._staleCandidates).forEach((openId) => {
                if (!liveOpenIds.has(openId)) delete this._staleCandidates[openId];
            });
            members.forEach((member) => {
                if (member.openId === this.data.myOpenId) return;
                const presenceMatchesCurrentConnection = !member.connectionId ||
                    (this._presenceConnections || {})[member.openId] === member.connectionId;
                const activeAt = Math.max(
                    presenceMatchesCurrentConnection ? (activeMap[member.openId] || 0) : 0,
                    Number(member.joinTime) || 0
                );
                if (!activeAt || now - activeAt <= STALE_MEMBER_MS) {
                    delete this._staleCandidates[member.openId];
                    return;
                }
                const candidate = this._staleCandidates[member.openId];
                if (!candidate || candidate.activeAt !== activeAt) {
                    this._staleCandidates[member.openId] = { activeAt: activeAt, detectedAt: now };
                    return;
                }
                if (candidate.kicking || now - candidate.detectedAt < STALE_CONFIRM_MS) return;
                candidate.kicking = true;
                wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'kickStale',
                        roomId: this.data.roomId,
                        targetOpenId: member.openId
                    }
                }).catch(() => {}).finally(() => {
                    delete this._staleCandidates[member.openId];
                });
            });
        },

        _startHeartbeat() {
            if (this._heartbeatTimer) return;
            this._sendHeartbeat();
            this._heartbeatTimer = setInterval(() => this._sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
        },

        _presenceTimestamp(value) {
            if (value instanceof Date) return value.getTime();
            const timestamp = Number(value);
            return Number.isFinite(timestamp) ? timestamp : 0;
        },

        async _findMyPresenceDocument(collection, roomId, openId) {
            const result = await collection.where({ roomId: roomId, _openid: openId }).limit(1).get();
            return result && result.data && result.data[0] || null;
        },

        async _writeMyPresence(roomId, openId) {
            const db = wx.cloud.database();
            const collection = db.collection('TenHalfPresence');
            const data = {
                roomId: roomId,
                connectionId: this._connectionId,
                activeAt: db.serverDate(),
                updatedAt: db.serverDate()
            };

            if (this._presenceDocId) {
                try {
                    await collection.doc(this._presenceDocId).update({ data: data });
                    return;
                } catch (error) {
                    this._presenceDocId = '';
                }
            }

            const existing = await this._findMyPresenceDocument(collection, roomId, openId);
            if (existing && existing._id) {
                this._presenceDocId = existing._id;
                await collection.doc(existing._id).update({ data: data });
                return;
            }

            try {
                const result = await collection.add({ data: data });
                this._presenceDocId = result && result._id || '';
            } catch (error) {
                // 唯一索引可能已由另一次请求创建文档，重新查找后更新即可。
                const retryDocument = await this._findMyPresenceDocument(collection, roomId, openId);
                if (!retryDocument || !retryDocument._id) throw error;
                this._presenceDocId = retryDocument._id;
                await collection.doc(retryDocument._id).update({ data: data });
            }
        },

        async _refreshPresenceSnapshot(roomId) {
            const result = await wx.cloud.database()
                .collection('TenHalfPresence')
                .where({ roomId: roomId })
                .limit(20)
                .get();
            if (!this._isAttached || this.data.roomId !== roomId) return;
            const activeMap = {};
            const connectionMap = {};
            (result.data || []).forEach((item) => {
                if (!item || !item._openid) return;
                activeMap[item._openid] = this._presenceTimestamp(item.activeAt || item.updatedAt);
                connectionMap[item._openid] = item.connectionId || '';
            });
            this._presenceMap = activeMap;
            this._presenceConnections = connectionMap;
            this._presenceReady = true;
            this._checkStaleMembers(activeMap, this.data.roomMembers || []);
        },

        _withNetworkTimeout(promise, timeoutMs, message) {
            return new Promise((resolve, reject) => {
                let settled = false;
                const timer = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    reject(new Error(message || '网络请求超时'));
                }, timeoutMs);
                promise.then((value) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(value);
                }).catch((error) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                });
            });
        },

        _scheduleHeartbeatRetry(roomId) {
            if (this._heartbeatRetryTimer || !this._isAttached || !this._isPageVisible) return;
            this._heartbeatRetryTimer = setTimeout(() => {
                this._heartbeatRetryTimer = null;
                if (this.data.roomId === roomId) this._sendHeartbeat();
            }, HEARTBEAT_RETRY_MS);
        },

        async _sendHeartbeat() {
            if (!this.data.roomId || !this.data.myOpenId || !this.data.isOnlineMode || this._heartbeatInFlight) return;
            this._heartbeatInFlight = true;
            const roomId = this.data.roomId;
            const openId = this.data.myOpenId;
            try {
                if (this._heartbeatRetryTimer) {
                    clearTimeout(this._heartbeatRetryTimer);
                    this._heartbeatRetryTimer = null;
                }
                await this._withNetworkTimeout((async () => {
                    await this._writeMyPresence(roomId, openId);
                    await this._refreshPresenceSnapshot(roomId);
                })(), HEARTBEAT_TIMEOUT_MS, '在线心跳超时');
            } catch (error) {
                console.warn('[十点半调试] 在线心跳直写失败', error);
                // Presence 与游戏状态监听相互独立；心跳失败不再重建正常工作的房间监听。
                this._scheduleHeartbeatRetry(roomId);
            } finally {
                this._heartbeatInFlight = false;
            }
        },

        _pauseRoomConnections() {
            this._cancelRoomClosureVerification();
            this._roomWatchGeneration = (this._roomWatchGeneration || 0) + 1;
            this._watchReconnectAttempt = 0;
            if (this._roomWatcher) {
                try { this._roomWatcher.close(); } catch (e) {}
                this._roomWatcher = null;
            }
            if (this._heartbeatTimer) {
                clearInterval(this._heartbeatTimer);
                this._heartbeatTimer = null;
            }
            if (this._heartbeatRetryTimer) {
                clearTimeout(this._heartbeatRetryTimer);
                this._heartbeatRetryTimer = null;
            }
            if (this._watchReconnectTimer) {
                clearTimeout(this._watchReconnectTimer);
                this._watchReconnectTimer = null;
            }
        },

        _applyGameState(rawState, suppliedPrivateHand) {
            if (!this._isAttached) return;
            const state = rawState && rawState.gameKind === 'tenhalf'
                ? rawState
                : { gameKind: 'tenhalf', phase: 'waiting', version: 0, players: [], playerOrder: [] };
            if (!this.data.isOnlineMode && state.phase && state.phase !== 'waiting') return;
            const previousState = this._latestGameState;
            const incomingRevision = this._stateRevision(state);
            const previousRevision = this._stateRevision(previousState);
            if (previousState && incomingRevision < previousRevision) {
                this._debug('忽略晚到的旧版本房间状态', {
                    '旧消息修订号': incomingRevision,
                    '当前修订号': previousRevision
                });
                return;
            }
            if (previousState && incomingRevision === previousRevision &&
                this._auctionRoundKey(state) &&
                this._auctionRoundKey(state) === this._auctionRoundKey(previousState) &&
                (state.roundChoices || []).length < (previousState.roundChoices || []).length) {
                this._debug('忽略同轮次中缺少已提交选择的旧快照', {
                    '修订号': incomingRevision,
                    '公牌序号': state.auctionIndex,
                    '选择轮次': state.choiceRound
                });
                return;
            }
            this._latestGameState = state;

            const phase = state.phase || 'waiting';
            const debugAuctionIndex = state.auctionIndex === undefined || state.auctionIndex === null
                ? -1
                : Number(state.auctionIndex);
            const debugStateSignature = [
                phase,
                incomingRevision,
                debugAuctionIndex,
                Number(state.choiceRound || 0),
                Number(state.deadlineAt || 0)
            ].join(':');
            if (this._debugStateSignature !== debugStateSignature) {
                this._debugStateSignature = debugStateSignature;
                this._debug('收到新的房间阶段', {
                    '阶段': phase,
                    '版本': state.version || 0,
                    '同步修订号': incomingRevision,
                    '公牌序号': state.auctionIndex,
                    '选择轮次': state.choiceRound,
                    '房间玩家数': (state.playerOrder || []).length,
                    '校准后剩余毫秒': state.deadlineAt ? this._deadlineRemainingMs(state) : null
                });
            }
            const order = state.playerOrder || [];
            const newRound = !!state.roundToken && state.roundToken !== this._roundToken;
            if (newRound) {
                this._roundToken = state.roundToken;
                this._privateHandToken = '';
                this._animatedRoundToken = '';
                this._localDiceRolls = [];
                this._localDiceBestRoll = null;
                this._localDiceTotalDrinks = null;
                this._diceCompletionInFlight = false;
                this._clearDealTimers();
                this._clearDiceResultTimers();
                this._clearDiceCompletionRetry();
                this._diceResultRoundToken = state.roundToken;
                this._diceResultVisible = false;
                if (this.data.showDiceResult) this.setData({ showDiceResult: false });
            }
            const localDiceRolls = this._localDiceRolls || [];
            const localBestRoll = localDiceRolls.length
                ? localDiceRolls.reduce((best, roll) => Math.min(best, roll.sum), Infinity)
                : null;
            const isPlayer = order.includes(this.data.myOpenId);
            const isSpectator = phase !== 'waiting' && !isPlayer;
            const activeOpenId = state.activePlayerOpenId || '';
            const choiceRound = Math.max(1, Number(state.choiceRound) || 1);
            const auctionRoundKey = this._auctionRoundKey(state);
            if (this._localAuctionSubmissionKey && this._localAuctionSubmissionKey !== auctionRoundKey) {
                this._localAuctionSubmissionKey = '';
            }
            const passedOpenIds = Array.isArray(state.passedOpenIds) ? state.passedOpenIds : [];
            const hasServerSubmittedChoice = passedOpenIds.includes(this.data.myOpenId);
            const hasSubmittedChoice = hasServerSubmittedChoice ||
                (!!auctionRoundKey && this._localAuctionSubmissionKey === auctionRoundKey);
            const auctionActiveOpenIds = (
                Array.isArray(state.auctionActiveOpenIds) && state.auctionActiveOpenIds.length
                    ? state.auctionActiveOpenIds
                    : order.filter((openId) => !passedOpenIds.includes(openId))
            );
            const isAuctionLeader = phase === 'auction' && state.leaderOpenId === this.data.myOpenId;
            const isAuctionEligible = phase === 'auction' && !isAuctionLeader &&
                auctionActiveOpenIds.includes(this.data.myOpenId);
            const isAuctionTie = false;
            const auctionActionKey = auctionRoundKey;
            const releaseAuctionAction = !!this._auctionActionRequestKey && (
                phase !== 'auction' || this._auctionActionRequestKey !== auctionActionKey || hasServerSubmittedChoice
            );
            if (releaseAuctionAction) this._auctionActionRequestKey = '';
            const players = state.players || [];
            const playerViews = players.map((player) => {
                const isMe = player.openId === this.data.myOpenId;
                const fallbackName = this._format('playerName', '玩家{seat}', { seat: player.seat });
                const memberProfile = realtimePlayerProfile.getMemberProfile(
                    this.data.roomMembers,
                    player.openId,
                    fallbackName
                );
                let resultState = '';
                if (phase === 'dice' || phase === 'finished') {
                    if (player.busted) resultState = this._text('busted', '爆牌');
                    else if (player.isLoser) resultState = this._text('loser', '输家');
                    else if (player.points === 10.5) resultState = this._text('perfectTenHalf', '十点半');
                    else resultState = this._text('safe', '过关');
                }
                return {
                    ...player,
                    name: memberProfile.nickname,
                    avatarUrl: memberProfile.avatarUrl,
                    isMe: isMe,
                    isActive: player.openId === activeOpenId,
                    publicCards: player.publicCards || [],
                    rolls: isMe ? localDiceRolls : [],
                    bestRoll: isMe ? localBestRoll : null,
                    totalDrinks: isMe && this._localDiceTotalDrinks !== null && this._localDiceTotalDrinks !== undefined
                        ? this._localDiceTotalDrinks
                        : (player.isLoser ? null : (player.debt || 0)),
                    resultState: resultState
                };
            });
            const myPlayer = playerViews.find((player) => player.isMe) || null;
            const price = state.currentPrice || 0;
            const bidType = state.currentBidType || '';
            const leader = playerViews.find((player) => player.openId === state.leaderOpenId) || null;
            const currentPriceLabel = phase === 'auction'
                ? (leader && price > 0
                    ? this._format('currentLeader', '当前领先：{action}{count}口（{player}）', {
                        action: bidType === 'kill' ? this._text('kill', '杀') : this._text('bid', '拍'),
                        count: price,
                        player: leader.name
                    })
                    : this._text('noLeader', '当前领先：暂无'))
                : (price > 0
                    ? this._format('currentPrice', '当前价格：{action}{count}口', {
                    action: bidType === 'kill' ? this._text('kill', '杀') : this._text('bid', '拍'),
                    count: price
                })
                    : this._text('priceZero', '当前价格：0口'));
            const turnLabel = phase === 'auction' ? this._text('bidCountdown', '领价倒计时') : '';
            const outcomeText = this._buildOutcomeText(state.auctionOutcome, playerViews);
            const myRolls = myPlayer ? localDiceRolls : [];
            const latestRoll = myRolls.length ? myRolls[myRolls.length - 1] : null;
            const diceCount = Math.max(2, Math.min(6, order.length || 2));
            const displayDice = this.data.isActing
                ? this.data.displayDice
                : (latestRoll && latestRoll.dice && latestRoll.dice.length
                    ? latestRoll.dice
                    : Array(diceCount).fill(1));
            const rollSummaryText = myRolls.length
                ? this._format('rollSummary', '({current}/{total}) 最低点数：{count}', {
                    current: myRolls.length,
                    total: 3,
                    count: localBestRoll
                })
                : this._format('rollProgress', '({current}/{total})', { current: 0, total: 3 });
            const playerStripLayout = this._getPlayerStripLayout(playerViews.length);

            this.setData({
                gamePhase: phase,
                gameStateVersion: state.version || 0,
                roundToken: state.roundToken || '',
                playerViews: playerViews,
                myPublicCards: myPlayer ? myPlayer.publicCards : [],
                ...playerStripLayout,
                isPlayer: isPlayer,
                isSpectator: isSpectator,
                canAct: phase === 'auction' && isPlayer && !isAuctionLeader &&
                    isAuctionEligible && !hasSubmittedChoice,
                currentCard: state.currentCard || null,
                currentPrice: price,
                currentBidType: bidType,
                currentPriceLabel: currentPriceLabel,
                turnLabel: turnLabel,
                choiceRound: choiceRound,
                hasSubmittedChoice: hasSubmittedChoice,
                isAuctionEligible: isAuctionEligible,
                isAuctionLeader: isAuctionLeader,
                isAuctionTie: isAuctionTie,
                ...(releaseAuctionAction ? { isActing: false } : {}),
                outcomeText: outcomeText,
                auctionProgress: state.auctionTotal
                    ? Math.max(0, (state.auctionIndex || 0) + 1) + ' / ' + state.auctionTotal
                    : '0 / 0',
                tenHalfCount: state.tenHalfCount || 0,
                multiplier: state.multiplier || 1,
                myNeedsDice: phase === 'dice' && !!(
                    myPlayer && myPlayer.isLoser && !myPlayer.rollFinalized && myRolls.length < 3
                ),
                myRollCount: myRolls.length,
                latestDice: latestRoll ? latestRoll.dice || [] : [],
                displayDice: displayDice,
                rollSummaryText: rollSummaryText
            });

            this._queueDiceResults(state);

            if (!isPlayer) {
                this.setData({
                    privateHand: null,
                    showSecretDock: false,
                    showDealOverlay: false
                });
            } else if (newRound || !this.data.privateHand) {
                if (suppliedPrivateHand) {
                    this._acceptPrivateHand(suppliedPrivateHand, phase === 'dealing');
                } else {
                    this._loadPrivateHand(state.roundToken, phase === 'dealing');
                }
            } else if (this.data.privateHand) {
                this.setData({
                    showSecretDock: ['dealing', 'auction', 'auctionResult'].includes(phase)
                });
            }

            this._scheduleDeadline(state);
        },

        _buildOutcomeText(outcome, players) {
            if (!outcome) return '';
            const player = (players || []).find((item) => item.openId === outcome.playerOpenId);
            const playerName = player ? player.name : this._format('playerName', '玩家{seat}', { seat: outcome.seat || '' });
            if (outcome.type === 'won') {
                return this._format('wonOutcome', '{player}拍下，欠{count}口', {
                    player: playerName,
                    count: outcome.price
                });
            }
            if (outcome.type === 'killed') {
                return this._format('killedOutcome', '{player}杀掉，欠{count}口', {
                    player: playerName,
                    count: outcome.price
                });
            }
            return this._text('discardedOutcome', '全员过，这张作废');
        },

        async _loadPrivateHand(roundToken, animate) {
            if (!roundToken || this._loadingHandToken === roundToken || this._privateHandToken === roundToken) return;
            this._loadingHandToken = roundToken;
            this._debug('开始向云函数领取当前玩家的私密底牌', {
                '是否需要发牌动画': !!animate,
                '当前阶段': this.data.gamePhase,
                '当前版本': this.data.gameStateVersion
            });
            const requestStartedAt = Date.now();
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'tenHalfGetHand',
                        roomId: this.data.roomId,
                        roundToken: roundToken
                    }
                });
                const result = response.result || {};
                this._updateServerClock(result.serverTime, requestStartedAt);
                if (this._latestGameState) this._scheduleDeadline(this._latestGameState);
                if (result.success && result.card && this._roundToken === roundToken) {
                    this._debug('私密底牌领取成功，准备展示发牌动画', {
                        '是否需要发牌动画': !!animate
                    });
                    this._acceptPrivateHand(result.card, animate);
                } else {
                    this._debug('私密底牌未能领取', {
                        '云函数是否成功': !!result.success,
                        '是否返回底牌': !!result.card,
                        '是否仍为当前局': this._roundToken === roundToken,
                        '错误': result.error || ''
                    });
                }
            } catch (error) {
                console.warn('[十点半调试] 领取私密底牌请求异常', error);
            } finally {
                if (this._loadingHandToken === roundToken) this._loadingHandToken = '';
            }
        },

        _acceptPrivateHand(card, animate) {
            if (!card) return;
            this._privateHandToken = this._roundToken;
            const shouldAnimate = animate && this._animatedRoundToken !== this._roundToken;
            this.setData({
                privateHand: card,
                showSecretDock: !shouldAnimate,
                showDealOverlay: shouldAnimate,
                dealMoving: false,
                dealMoveX: 0,
                dealMoveY: 0,
                dealMoveScale: 1
            });
            if (shouldAnimate) {
                this._animatedRoundToken = this._roundToken;
                this._startDealAnimation();
            }
        },

        _startDealAnimation() {
            this._clearDealTimers();
            this._dealHoldTimer = setTimeout(() => {
                this._dealHoldTimer = null;
                const query = this.createSelectorQuery();
                query.select('.deal-card-host').boundingClientRect();
                query.select('.secret-card-target').boundingClientRect();
                query.exec((rects) => {
                    const source = rects && rects[0];
                    const target = rects && rects[1];
                    if (!source || !target) {
                        this.setData({ showDealOverlay: false, showSecretDock: true });
                        return;
                    }
                    const sourceX = source.left + source.width / 2;
                    const sourceY = source.top + source.height / 2;
                    const targetX = target.left + target.width / 2;
                    const targetY = target.top + target.height / 2;
                    const scale = Math.min(target.width / source.width, target.height / source.height);
                    this.setData({
                        dealMoving: true,
                        dealMoveX: targetX - sourceX,
                        dealMoveY: targetY - sourceY,
                        dealMoveScale: scale
                    });
                    this._dealMoveTimer = setTimeout(() => {
                        this._dealMoveTimer = null;
                        this.setData({
                            showDealOverlay: false,
                            showSecretDock: true,
                            dealMoving: false,
                            dealMoveX: 0,
                            dealMoveY: 0,
                            dealMoveScale: 1
                        });
                    }, DEAL_MOVE_MS);
                });
            }, DEAL_HOLD_MS);
        },

        _coordinatorFallbackDelay(state) {
            if (!state) return -1;
            const order = Array.isArray(state.playerOrder) ? state.playerOrder : [];
            const index = order.indexOf(this.data.myOpenId);
            return index < 0 ? -1 : index * COORDINATOR_FALLBACK_STEP_MS;
        },

        _requestDeadlineAsCoordinator(state, key) {
            if (!state || !key || this._deadlineCoordinationKey === key || this._deadlineRequestedKey === key) return;
            const delay = this._coordinatorFallbackDelay(state);
            if (delay < 0) return;
            this._deadlineCoordinationKey = key;
            const request = () => {
                this._deadlineFallbackTimer = null;
                this._deadlineCoordinationKey = '';
                if (!this._isAttached || !this.data.roomId) return;
                const latest = this._latestGameState;
                if (!latest || this._deadlineKey(latest) !== key || this._deadlineRemainingMs(latest) > 0) return;
                if (this._deadlineRequestedKey === key) return;
                this._deadlineRequestedKey = key;
                this._debug('轮到当前客户端负责截止推进', {
                    '阶段': latest.phase,
                    '协调等待毫秒': delay,
                    '玩家席位': Math.round(delay / COORDINATOR_FALLBACK_STEP_MS) + 1
                });
                if (latest.phase === 'auction') this._requestTimeout(latest);
                else this._requestAdvance(latest.version);
            };
            if (delay <= 0) request();
            else this._deadlineFallbackTimer = setTimeout(request, delay);
        },

        _scheduleDeadline(state) {
            this._clearDeadlineTimer();
            if (!state || !state.deadlineAt || !['dealing', 'auction', 'auctionResult'].includes(state.phase)) {
                this.setData({ countdownSeconds: 0 });
                return;
            }
            const key = this._deadlineKey(state);
            const debugDeadlineSignature = key + ':' + this._stateRevision(state);
            if (this._debugDeadlineSignature !== debugDeadlineSignature) {
                this._debugDeadlineSignature = debugDeadlineSignature;
                this._debug('已为当前阶段安排自动推进', {
                    '阶段': state.phase,
                    '版本': state.version,
                    '同步修订号': this._stateRevision(state),
                    '选择轮次': state.choiceRound,
                    '剩余毫秒': this._deadlineRemainingMs(state),
                    '服务器时钟偏移毫秒': this._serverClockReady ? Math.round(this._serverClockOffsetMs || 0) : '待校准'
                });
            }
            const update = () => {
                const remaining = this._deadlineRemainingMs(state);
                this.setData({ countdownSeconds: Math.ceil(remaining / 1000) });
                if (remaining > 0) return;
                this._clearDeadlineTimer();
                this._debug('当前阶段倒计时结束，开始请求云端推进', {
                    '阶段': state.phase,
                    '版本': state.version,
                    '超时毫秒': Date.now() - state.deadlineAt
                });
                this._requestDeadlineAsCoordinator(state, key);
            };
            update();
            if (this._deadlineRemainingMs(state) > 0) {
                this._deadlineTimer = setInterval(update, 200);
            }
        },

        _queueDeadlineRetry(state, delay) {
            const target = state || this._latestGameState;
            if (!target || !target.deadlineAt || !['dealing', 'auction', 'auctionResult'].includes(target.phase)) {
                return;
            }
            if (this._deadlineRetryTimer) clearTimeout(this._deadlineRetryTimer);
            const expectedPhase = target.phase;
            const expectedVersion = Number(target.version || 0);
            const expectedDeadlineKey = this._deadlineKey(target);
            this._debug('自动推进将重试', {
                '阶段': expectedPhase,
                '版本': expectedVersion,
                '重试延迟毫秒': delay || DEADLINE_RETRY_MS
            });
            this._deadlineRetryTimer = setTimeout(() => {
                this._deadlineRetryTimer = null;
                if (!this._isAttached || !this.data.roomId) return;
                const latest = this._latestGameState;
                if (!latest || latest.phase !== expectedPhase ||
                    Number(latest.version || 0) !== expectedVersion ||
                    this._deadlineKey(latest) !== expectedDeadlineKey) {
                    return;
                }
                this._deadlineRequestedKey = '';
                this._scheduleDeadline(latest);
            }, delay || DEADLINE_RETRY_MS);
        },

        async _requestAdvance(version) {
            if (!this.data.roomId) return;
            const requestedPhase = this._latestGameState && this._latestGameState.phase;
            const requestStartedAt = Date.now();
            this._debug('正在调用云函数推进发牌/结果阶段', {
                '请求阶段': requestedPhase,
                '请求版本': version
            });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'tenHalfAdvance',
                        roomId: this.data.roomId,
                        expectedVersion: version
                    }
                });
                const result = response.result || {};
                this._updateServerClock(result.serverTime, requestStartedAt);
                this._debug('云函数已返回阶段推进结果', {
                    '是否成功': !!result.success,
                    '是否过早': !!result.tooEarly,
                    '是否版本过期': !!result.stale,
                    '返回阶段': result.state && result.state.phase,
                    '返回版本': result.state && result.state.version,
                    '错误': result.error || ''
                });
                if (result.state) this._applyGameState(result.state);
                if (result.tooEarly) {
                    this._deadlineRequestedKey = '';
                    this._queueDeadlineRetry(result.state, 250);
                } else if (!result.success) {
                    console.warn('[十点半调试] 阶段推进失败', result.error || '未知错误');
                    this._deadlineRequestedKey = '';
                    this._queueDeadlineRetry(this._latestGameState);
                } else {
                    const latest = this._latestGameState;
                    if (latest && Number(latest.version || 0) === Number(version) &&
                        this._deadlineRemainingMs(latest) <= 0) {
                        this._deadlineRequestedKey = '';
                        this._queueDeadlineRetry(latest);
                    }
                }
            } catch (error) {
                console.warn('[十点半调试] 阶段推进请求异常', error);
                this._deadlineRequestedKey = '';
                this._queueDeadlineRetry(this._latestGameState);
            }
        },

        async _requestTimeout(requestedState) {
            if (!this.data.roomId || !requestedState) return;
            const requestStartedAt = Date.now();
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'tenHalfTimeout',
                        roomId: this.data.roomId,
                        roomDocId: this.data.roomDocId,
                        expectedVersion: requestedState.version,
                        expectedRoundToken: requestedState.roundToken,
                        expectedAuctionIndex: requestedState.auctionIndex,
                        expectedChoiceRound: requestedState.choiceRound,
                        expectedDeadlineAt: requestedState.deadlineAt
                    }
                });
                const result = response.result || {};
                this._updateServerClock(result.serverTime, requestStartedAt);
                if (result.state) this._applyGameState(result.state);
                if (result.tooEarly) {
                    this._deadlineRequestedKey = '';
                    this._queueDeadlineRetry(result.state, 250);
                } else if (!result.success) {
                    console.warn('[十点半调试] 竞拍超时推进失败', result.error || '未知错误');
                    this._deadlineRequestedKey = '';
                    this._queueDeadlineRetry(this._latestGameState);
                } else {
                    const latest = this._latestGameState;
                    if (latest && this._deadlineKey(latest) === this._deadlineKey(requestedState) &&
                        this._deadlineRemainingMs(latest) <= 0) {
                        this._deadlineRequestedKey = '';
                        this._queueDeadlineRetry(latest);
                    }
                }
            } catch (error) {
                console.warn('[十点半调试] 竞拍超时推进请求异常', error);
                this._deadlineRequestedKey = '';
                this._queueDeadlineRetry(this._latestGameState);
            }
        },

        async startGame() {
            if (this.data.isStarting) return;
            if (!this.data.isOnlineMode || !this.data.roomId) {
                wx.showToast({ title: this._text('shareFirstToast', '先点右上角分享叫人'), icon: 'none' });
                return;
            }
            if (this.data.roomMembers.length < 2) {
                wx.showToast({ title: this._text('needMorePlayers', '至少需要2位玩家'), icon: 'none' });
                return;
            }

            this.setData({ isStarting: true });
            this._debug('点击 START，开始向云端创建十点半牌局', {
                '当前在线人数': this.data.roomMembers.length
            });
            const requestStartedAt = Date.now();
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: 'tenHalfStart', roomId: this.data.roomId }
                });
                const result = response.result || {};
                this._updateServerClock(result.serverTime, requestStartedAt);
                this._debug('START 云函数已返回', {
                    '是否成功': !!result.success,
                    '是否已有进行中牌局': !!result.alreadyStarted,
                    '返回阶段': result.state && result.state.phase,
                    '返回版本': result.state && result.state.version,
                    '是否收到本人底牌': !!result.privateHand,
                    '错误': result.error || ''
                });
                if (!result.success) {
                    wx.showToast({ title: result.error || this._text('startFailed', '开始失败'), icon: 'none' });
                    return;
                }
                if (result.state) this._applyGameState(result.state, result.privateHand);
                try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
            } catch (error) {
                console.warn('[十点半调试] START 请求异常', error);
                wx.showToast({ title: this._text('startFailed', '开始失败'), icon: 'none' });
            } finally {
                this.setData({ isStarting: false });
            }
        },

        _callAuctionActionAttempt(payload, timeoutMs) {
            return new Promise((resolve, reject) => {
                let settled = false;
                const timer = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    reject(new Error('竞拍选择请求超时'));
                }, timeoutMs);
                wx.cloud.callFunction({
                    name: 'roomManager',
                    data: payload
                }).then((response) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(response);
                }).catch((error) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                });
            });
        },

        _waitAuctionRetry(delay) {
            return new Promise((resolve) => setTimeout(resolve, delay));
        },

        async _submitAuctionActionWithRetry(payload, requestedState, requestKey) {
            let lastError = null;
            let attempt = 0;
            while (this._isAttached && this.data.roomId &&
                this._auctionRoundKey(this._latestGameState) === requestKey &&
                attempt < AUCTION_ACTION_MAX_ATTEMPTS) {
                const remaining = this._deadlineRemainingMs(requestedState);
                if (remaining <= 80) break;
                attempt += 1;
                const timeoutMs = Math.max(180, Math.min(
                    AUCTION_ACTION_ATTEMPT_TIMEOUT_MS,
                    remaining - 60
                ));
                const requestStartedAt = Date.now();
                try {
                    const response = await this._callAuctionActionAttempt(payload, timeoutMs);
                    const result = response.result || {};
                    this._updateServerClock(result.serverTime, requestStartedAt);
                    this._debug('竞拍选择请求已返回', {
                        '选择': payload.choice,
                        '公牌序号': payload.expectedAuctionIndex,
                        '选择轮次': payload.expectedChoiceRound,
                        '请求次数': attempt,
                        '是否成功': !!result.success,
                        '是否过期': !!result.expired,
                        '是否旧轮次': !!result.stale,
                        '是否已经提交': !!result.alreadySubmitted,
                        '返回修订号': this._stateRevision(result.state)
                    });
                    if (result.state) this._applyGameState(result.state);
                    return result;
                } catch (error) {
                    lastError = error;
                    const latestState = this._latestGameState;
                    const latestKey = this._auctionRoundKey(latestState);
                    const confirmedByWatch = payload.choice === 'pass'
                        ? !!(latestState && (latestState.passedOpenIds || []).includes(this.data.myOpenId))
                        : !!(latestState && latestState.leaderOpenId === this.data.myOpenId &&
                            latestState.currentBidType === payload.choice &&
                            Number(latestState.currentPrice || 0) === Number(payload.expectedCurrentPrice || 0) + 1);
                    if (confirmedByWatch) {
                        this._debug('竞拍选择响应虽未返回，但已由房间监听确认', {
                            '选择': payload.choice,
                            '最新价格': latestState.currentPrice,
                            '最新领价者': latestState.leaderOpenId
                        });
                        return { success: true, confirmedByWatch: true, state: latestState };
                    }
                    if (latestKey !== requestKey) {
                        // 另一位玩家已先完成同价请求；以监听到的权威状态为准，
                        // 不把网络竞速失败误报成“操作失败”。
                        return { success: true, stale: true, state: latestState };
                    }
                    const retryRemaining = this._deadlineRemainingMs(requestedState);
                    if (retryRemaining <= AUCTION_ACTION_RETRY_GAP_MS + 80) break;
                    this._debug('竞拍选择未确认，截止前自动重试', {
                        '选择': payload.choice,
                        '请求次数': attempt,
                        '剩余毫秒': Math.round(retryRemaining)
                    });
                    await this._waitAuctionRetry(AUCTION_ACTION_RETRY_GAP_MS);
                }
            }
            throw lastError || new Error('竞拍选择未在截止前确认');
        },

        async onAuctionAction(event) {
            const choice = event.currentTarget.dataset.choice;
            if (this.data.isActing || !this.data.canAct || !choice) return;
            const requestedState = this._latestGameState;
            const requestedAuctionIndex = requestedState && requestedState.auctionIndex;
            const requestedChoiceRound = requestedState && requestedState.choiceRound;
            const requestKey = this._auctionRoundKey(requestedState);
            if (!requestKey) return;
            this._auctionActionRequestKey = requestKey;
            this._localAuctionSubmissionKey = requestKey;
            this.setData({
                isActing: true,
                hasSubmittedChoice: true,
                canAct: false
            });
            try {
                const result = await this._submitAuctionActionWithRetry({
                    action: 'tenHalfAction',
                    roomId: this.data.roomId,
                    roomDocId: this.data.roomDocId,
                    choice: choice,
                    expectedRoundToken: requestedState.roundToken,
                    expectedAuctionIndex: requestedAuctionIndex,
                    expectedChoiceRound: requestedChoiceRound,
                    expectedCurrentPrice: Number(requestedState.currentPrice || 0)
                }, requestedState, requestKey);
                if (!result.success && result.error) {
                    if (this._localAuctionSubmissionKey === requestKey) {
                        this._localAuctionSubmissionKey = '';
                        if (this._latestGameState) this._applyGameState(this._latestGameState);
                    }
                    wx.showToast({ title: result.error, icon: 'none' });
                }
                if (choice !== 'pass' && result.success && !result.expired && !result.stale) {
                    try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
                }
            } catch (error) {
                // 多次重试仍无法在本轮截止前确认时保持本地锁，避免同轮重复操作。
                wx.showToast({ title: this._text('actionFailed', '操作慢了一拍'), icon: 'none' });
            } finally {
                if (this._auctionActionRequestKey === requestKey) {
                    this._auctionActionRequestKey = '';
                    this.setData({ isActing: false });
                }
            }
        },

        rollDice() {
            this._submitRoll();
        },

        _queueDiceResults(state) {
            if (!state || state.phase !== 'finished') return;
            if (this._finishRoundWaitTimer) return;
            const coordinatorDelay = this._coordinatorFallbackDelay(state);
            if (coordinatorDelay < 0) return;
            this._finishRoundWaitTimer = setTimeout(() => {
                this._finishRoundWaitTimer = null;
                this._requestReturnToWaiting();
            }, DICE_RESULT_AUTO_MS + DICE_RESULT_GAP_MS + coordinatorDelay);
        },

        _showLocalDiceResult(playerName, drinks) {
            if (this._diceResultAutoTimer) clearTimeout(this._diceResultAutoTimer);
            this._diceResultVisible = true;
            this.setData({
                showDiceResult: true,
                diceResultPlayerName: playerName,
                diceResultText: this._format('drinkResult', '喝{count}口', { count: drinks })
            });
            this._diceResultAutoTimer = setTimeout(() => {
                this._diceResultAutoTimer = null;
                this.onDiceResultContinue();
            }, DICE_RESULT_AUTO_MS);
        },

        onDiceResultContinue() {
            if (!this._diceResultVisible) return;
            if (this._diceResultAutoTimer) {
                clearTimeout(this._diceResultAutoTimer);
                this._diceResultAutoTimer = null;
            }
            this._diceResultVisible = false;
            this.setData({ showDiceResult: false });
            this._queueDiceResults(this._latestGameState);
        },

        async _requestReturnToWaiting() {
            const state = this._latestGameState;
            if (!state || state.phase !== 'finished' || this._finishRoundInFlight || !this.data.roomId) return;
            this._finishRoundInFlight = true;
            const requestedRoomId = this.data.roomId;
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'tenHalfFinishRound',
                        roomId: requestedRoomId,
                        expectedVersion: state.version
                    }
                });
                if (!this._isAttached || this.data.roomId !== requestedRoomId) return;
                const result = response.result || {};
                if (result.state) this._applyGameState(result.state);
                if ((!result.success || result.stale) &&
                    this._latestGameState && this._latestGameState.phase === 'finished') {
                    this._finishRoundRetryTimer = setTimeout(() => {
                        this._finishRoundRetryTimer = null;
                        this._requestReturnToWaiting();
                    }, 1000);
                }
            } catch (error) {
                if (this._isAttached && this.data.roomId === requestedRoomId) {
                    this._finishRoundRetryTimer = setTimeout(() => {
                        this._finishRoundRetryTimer = null;
                        this._requestReturnToWaiting();
                    }, 1000);
                }
            } finally {
                this._finishRoundInFlight = false;
            }
        },

        _createRandomDiceFaces() {
            const diceCount = Math.max(2, Math.min(6, this.data.displayDice.length || this.data.playerViews.length || 2));
            return Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6));
        },

        _randomizeDiceFaces() {
            this.setData({ displayDice: this._createRandomDiceFaces() });
        },

        _startDiceAnimation() {
            this._stopDiceAnimation();
            this._randomizeDiceFaces();
            this._diceFaceTimer = setInterval(() => {
                if (!this._isAttached || !this.data.isActing) return;
                this._randomizeDiceFaces();
            }, DICE_FACE_INTERVAL_MS);
        },

        _waitForDiceAnimation(duration) {
            if (duration <= 0) return Promise.resolve();
            return new Promise((resolve) => {
                this._diceAnimationResolve = resolve;
                this._diceAnimationTimer = setTimeout(() => {
                    this._diceAnimationTimer = null;
                    this._diceAnimationResolve = null;
                    resolve();
                }, duration);
            });
        },

        _stopDiceAnimation() {
            if (this._diceFaceTimer) {
                clearInterval(this._diceFaceTimer);
                this._diceFaceTimer = null;
            }
            if (this._diceAnimationTimer) {
                clearTimeout(this._diceAnimationTimer);
                this._diceAnimationTimer = null;
            }
            if (this._diceAnimationResolve) {
                const resolve = this._diceAnimationResolve;
                this._diceAnimationResolve = null;
                resolve();
            }
        },

        async _submitRoll() {
            if (this.data.isActing || !this.data.myNeedsDice || (this._localDiceRolls || []).length >= 3) return;
            this.setData({ isActing: true });
            this._startDiceAnimation();
            try {
                await this._waitForDiceAnimation(DICE_ROLL_DURATION_MS);
                if (!this._isAttached || this.data.gamePhase !== 'dice') return;
                this._stopDiceAnimation();

                const dice = (this.data.displayDice || []).slice();
                const roll = {
                    dice: dice,
                    sum: dice.reduce((sum, value) => sum + value, 0),
                    at: Date.now()
                };
                const rolls = (this._localDiceRolls || []).concat([roll]);
                const bestRoll = rolls.reduce((best, item) => Math.min(best, item.sum), Infinity);
                const myPlayer = (this.data.playerViews || []).find((player) => player.isMe);
                const isComplete = rolls.length >= 3;
                const totalDrinks = isComplete
                    ? (myPlayer && myPlayer.debt || 0) + bestRoll * (this.data.multiplier || 1)
                    : null;

                this._localDiceRolls = rolls;
                this._localDiceBestRoll = bestRoll;
                if (isComplete) this._localDiceTotalDrinks = totalDrinks;

                this.setData({
                    myRollCount: rolls.length,
                    latestDice: dice,
                    displayDice: dice,
                    myNeedsDice: !isComplete,
                    rollSummaryText: this._format('rollSummary', '({current}/{total}) 最低点数：{count}', {
                        current: rolls.length,
                        total: 3,
                        count: bestRoll
                    }),
                    playerViews: (this.data.playerViews || []).map((player) => player.isMe
                        ? {
                            ...player,
                            rolls: rolls,
                            bestRoll: bestRoll,
                            totalDrinks: isComplete ? totalDrinks : null
                        }
                        : player)
                });

                try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}

                if (isComplete) {
                    this._showLocalDiceResult(
                        myPlayer ? myPlayer.name : '',
                        totalDrinks
                    );
                    this._notifyDiceComplete();
                }
            } catch (error) {
                wx.showToast({ title: this._text('actionFailed', '摇骰子失败'), icon: 'none' });
            } finally {
                this._stopDiceAnimation();
                if (this._isAttached) this.setData({ isActing: false });
            }
        },

        async _notifyDiceComplete() {
            if (this._diceCompletionInFlight || !this._isAttached || !this.data.roomId ||
                (this._localDiceRolls || []).length < 3) {
                return;
            }
            this._diceCompletionInFlight = true;
            const requestedRoomId = this.data.roomId;
            const requestedRoundToken = this._roundToken;
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'tenHalfRoll',
                        roomId: requestedRoomId
                    }
                });
                if (!this._isAttached || this.data.roomId !== requestedRoomId ||
                    this._roundToken !== requestedRoundToken) {
                    return;
                }
                const result = response.result || {};
                if (!result.success) throw new Error(result.error || '完成状态同步失败');
                if (result.state) this._applyGameState(result.state);
                this._clearDiceCompletionRetry();
            } catch (error) {
                if (this._isAttached && this.data.roomId === requestedRoomId &&
                    this._roundToken === requestedRoundToken) {
                    this._clearDiceCompletionRetry();
                    this._diceCompletionRetryTimer = setTimeout(() => {
                        this._diceCompletionRetryTimer = null;
                        this._notifyDiceComplete();
                    }, 1000);
                }
            } finally {
                this._diceCompletionInFlight = false;
            }
        },

        _onRoomClosed() {
            this._roomShareHostId = '';
            this._pauseRoomConnections();
            this._clearDeadlineTimer();
            this._stopDiceAnimation();
            this._deadlineRequestedKey = '';
            this._latestGameState = null;
            this._roundToken = '';
            this._auctionActionRequestKey = '';
            this._localAuctionSubmissionKey = '';
            this._staleCandidates = {};
            this._lastStaleCheck = 0;
            this._presenceDocId = '';
            this._presenceMap = {};
            this._presenceConnections = {};
            this._presenceReady = false;
            this._clearDiceResultTimers();
            this._clearDiceCompletionRetry();
            this._localDiceRolls = [];
            this._localDiceBestRoll = null;
            this._localDiceTotalDrinks = null;
            this._diceCompletionInFlight = false;
            this._diceResultRoundToken = '';
            this._diceResultVisible = false;
            const localMembers = this.data.myOpenId
                ? [{ openId: this.data.myOpenId, isHost: true }]
                : [];
            this.setData({
                roomId: '',
                roomDocId: '',
                roomMembers: localMembers,
                onlineCount: 1,
                isOnlineMode: false,
                isHost: false,
                connectionStatus: 'disconnected',
                isActing: false,
                gamePhase: 'waiting',
                playerViews: [],
                isPlayer: false,
                isSpectator: false,
                privateHand: null,
                myPublicCards: [],
                showSecretDock: false,
                showDealOverlay: false,
                showDiceResult: false
            });
        },

        _leaveRoom() {
            const roomId = this.data.roomId;
            const isHost = this.data.isHost;
            const isOnlineMode = this.data.isOnlineMode;
            const app = getApp();
            const reenter = app.globalData._reenteringTenHalfRoom;
            const shouldSkip = reenter && roomId &&
                (reenter.roomId === roomId || reenter.roomId === this._roomShareHostId) &&
                Date.now() - reenter.timestamp < 10000;
            if (shouldSkip) app.globalData._reenteringTenHalfRoom = null;

            this._pauseRoomConnections();
            if (isOnlineMode && roomId && !shouldSkip) {
                wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: isHost ? 'close' : 'leave',
                        roomId: roomId,
                        connectionId: this._connectionId
                    }
                }).catch(() => {});
            }
        },

        _clearDeadlineTimer() {
            if (this._deadlineTimer) {
                clearInterval(this._deadlineTimer);
                this._deadlineTimer = null;
            }
            if (this._deadlineRetryTimer) {
                clearTimeout(this._deadlineRetryTimer);
                this._deadlineRetryTimer = null;
            }
            if (this._deadlineFallbackTimer) {
                clearTimeout(this._deadlineFallbackTimer);
                this._deadlineFallbackTimer = null;
            }
            this._deadlineCoordinationKey = '';
        },

        _clearDealTimers() {
            if (this._dealHoldTimer) {
                clearTimeout(this._dealHoldTimer);
                this._dealHoldTimer = null;
            }
            if (this._dealMoveTimer) {
                clearTimeout(this._dealMoveTimer);
                this._dealMoveTimer = null;
            }
        },

        _clearDiceResultTimers() {
            if (this._diceResultAutoTimer) {
                clearTimeout(this._diceResultAutoTimer);
                this._diceResultAutoTimer = null;
            }
            if (this._diceResultGapTimer) {
                clearTimeout(this._diceResultGapTimer);
                this._diceResultGapTimer = null;
            }
            if (this._finishRoundRetryTimer) {
                clearTimeout(this._finishRoundRetryTimer);
                this._finishRoundRetryTimer = null;
            }
            if (this._finishRoundWaitTimer) {
                clearTimeout(this._finishRoundWaitTimer);
                this._finishRoundWaitTimer = null;
            }
        },

        _clearDiceCompletionRetry() {
            if (this._diceCompletionRetryTimer) {
                clearTimeout(this._diceCompletionRetryTimer);
                this._diceCompletionRetryTimer = null;
            }
        },

        _cleanupAllTimers() {
            this._clearDeadlineTimer();
            this._clearDealTimers();
            this._clearDiceResultTimers();
            this._clearDiceCompletionRetry();
            this._stopDiceAnimation();
            this._pauseRoomConnections();
        }
    }
});
