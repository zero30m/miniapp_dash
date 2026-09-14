const i18n = require('../../utils/i18n');
const realtimePlayerProfile = require('../../utils/realtime_player_profile.js');

const HEARTBEAT_MS = 12000;
const WATCH_RECONNECT_BASE_MS = 500;
const WATCH_RECONNECT_MAX_MS = 5000;
const STALE_MEMBER_MS = 180000;
const STALE_CONFIRM_MS = 24000;
const QUEEN_LINK_SIDE = 6;

Component({
    properties: {
        copy: {
            type: Object,
            value: {},
            observer() {
                if (this._latestState) this._applyState(this._latestState, true);
            }
        },
        locale: { type: String, value: 'zh-Hans' },
        shareHostId: {
            type: String,
            value: '',
            observer(value) {
                this._pendingHostId = value || '';
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
        gameVersion: 0,
        isPlayer: false,
        isSpectator: false,
        playerViews: [],
        playerChipWidthPx: 140,
        playerAvatarSizePx: 24,
        playerRowWidthPx: 375,
        playerSidePaddingPx: 12,
        stageBottomPx: 75,
        stageOffsetPx: -16,
        overlayBottomPx: 75,
        linkBoardSizePx: 260,
        linkBoardSide: QUEEN_LINK_SIDE,
        linkCellGapPx: 4,
        mineBoardSizePx: 260,
        mineCellGapPx: 4,
        mineCellFontSizePx: 15,
        remainingCards: 0,
        currentCard: null,
        currentPlayerName: '',
        currentPlayerOpenId: '',
        activePlayerName: '',
        activePlayerOpenId: '',
        canDraw: false,
        canResolveEffect: false,
        canMiniAct: false,
        countdownSeconds: 0,
        targetPlayers: [],
        targetLayoutClass: 'target-single',
        selectedTargetIds: [],
        targetMultiple: false,
        cpPairs: [],
        linkBoard: [],
        mineCells: [],
        medusaSubmitted: false,
        cameraPressed: false,
        resultTitle: '',
        resultMain: '',
        resultLines: [],
        resultCard: null,
        showLocalResult: false,
        actionsLocked: false,
        showDrinkPointer: false,
        showBossCard: false,
        showResultCard: false,
        topicText: '',
        myCameraCards: 0,
        canTriggerCamera: false,
        myToiletCards: 0,
        myDrinkCount: 0,
        canChooseToilet: false,
        toiletDrinkCount: 0,
        toiletPromptWarning: '',
        amBoss: false,
        canTriggerBoss: false,
        showBossTargets: false
    },

    lifetimes: {
        attached() {
            this._isAttached = true;
            this._isVisible = true;
            this._connectionId = 'queen_conn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
            this._calculateLayout();
            this._fetchOpenId();
        },
        detached() {
            this._isAttached = false;
            this._isVisible = false;
            this._clearConnections();
            this._leaveRoom();
        }
    },

    pageLifetimes: {
        show() {
            this._isVisible = true;
            this._calculateLayout();
            if (this.data.roomId) {
                this._startWatch(this.data.roomId);
                this._startHeartbeat();
                if (this._latestState) this._applyState(this._latestState, true);
            } else this._prepareRoomEntry();
        },
        hide() {
            this._isVisible = false;
            this._clearConnections(true);
        },
        resize() {
            this._calculateLayout();
            this._updatePlayerLayout(this.data.playerViews.length);
        }
    },

    methods: {
        _debug(message, details) {
            console.info('[大姐牌调试] ' + message, {
                '是否已连接房间': !!this.data.roomId,
                '当前阶段': this.data.gamePhase,
                '当前版本': this.data.gameVersion,
                ...(details || {})
            });
        },

        _text(key, fallback) {
            return this.data.copy && this.data.copy[key] || fallback || '';
        },

        _format(key, fallback, values) {
            return i18n.formatString(this._text(key, fallback), values || {});
        },

        _calculateLayout() {
            let info = {};
            try {
                const menu = wx.getMenuButtonBoundingClientRect();
                info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
                if (menu && menu.top > 0) {
                    const menuRight = info.windowWidth - menu.right;
                    this.setData({
                        navTop: menu.top,
                        menuRight: menuRight,
                        menuDotRight: menuRight + menu.width * 0.72
                    });
                }
            } catch (error) {}

            const updateStageBottom = () => {
                if (!this._isAttached) return;
                let windowInfo = info;
                if (!windowInfo || !windowInfo.windowWidth) {
                    try {
                        windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
                    } catch (error) {
                        return;
                    }
                }
                const windowWidth = windowInfo.windowWidth || 375;
                const windowHeight = windowInfo.windowHeight || 667;
                const rpx = windowWidth / 750;
                const safeBottom = windowInfo.safeArea
                    ? Math.max(0, windowHeight - windowInfo.safeArea.bottom)
                    : 0;
                const tabTop = windowHeight - safeBottom - 150 * rpx;
                const gap = 24 * rpx;
                const overlayBottom = Math.max(gap, windowHeight - tabTop + gap);
                this.setData({ overlayBottomPx: Math.round(overlayBottom) });
                this.createSelectorQuery()
                    .select('.queen-game-root')
                    .boundingClientRect((rect) => {
                        if (!this._isAttached || !rect || !rect.height) return;
                        const requiredBottom = Math.max(gap, rect.bottom - tabTop + gap);
                        const stageTop = (windowHeight <= 700 ? 216 : 240) * rpx;
                        const stageHeight = Math.max(0, rect.height - stageTop - requiredBottom);
                        const shortScreenBoardLimit = windowHeight <= 700
                            ? windowHeight * 0.58
                            : Number.POSITIVE_INFINITY;
                        const mineBoardSize = Math.max(0, Math.min(
                            520 * rpx,
                            windowWidth * 0.78,
                            shortScreenBoardLimit,
                            stageHeight - 170 * rpx
                        ));
                        const mineCellGap = Math.max(2, Math.min(4, mineBoardSize / 75));
                        const mineCellSize = Math.max(0, (mineBoardSize - mineCellGap * 6) / 7);
                        const mineCellFontSize = Math.max(8, Math.min(20, mineCellSize * 0.44));
                        const stageLift = windowHeight <= 700
                            ? 4
                            : Math.max(14, Math.min(22, windowHeight * 0.026));
                        this.setData({
                            stageBottomPx: Math.round(requiredBottom),
                            stageOffsetPx: -Math.round(stageLift),
                            linkBoardSizePx: Math.round(mineBoardSize),
                            linkCellGapPx: Number(mineCellGap.toFixed(2)),
                            mineBoardSizePx: Math.round(mineBoardSize),
                            mineCellGapPx: Number(mineCellGap.toFixed(2)),
                            mineCellFontSizePx: Number(mineCellFontSize.toFixed(2))
                        });
                    })
                    .exec();
            };
            updateStageBottom();
            wx.nextTick(updateStageBottom);
        },

        _getPlayerLayout(countValue) {
            let info = {};
            try { info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (error) {}
            const width = info.windowWidth || 375;
            const rpx = width / 750;
            const count = Math.max(1, Number(countValue) || 1);
            const visible = Math.min(3, count);
            const side = 24 * rpx;
            const gap = 24 * rpx;
            let chip = (width - side * 2 - gap * (visible - 1)) / visible;
            if (visible === 1) chip = Math.min(chip, 280 * rpx);
            const avatarSize = visible === 1 ? 30 : (visible === 2 ? 26 : 22);
            return {
                playerChipWidthPx: Number(Math.max(96 * rpx, chip).toFixed(2)),
                playerAvatarSizePx: avatarSize,
                playerSidePaddingPx: Number(side.toFixed(2)),
                playerRowWidthPx: Math.max(width, Math.ceil(side * 2 + chip * count + gap * (count - 1)))
            };
        },

        _updatePlayerLayout(count) {
            if (this._isAttached) this.setData(this._getPlayerLayout(count));
        },

        async _fetchOpenId() {
            const app = getApp();
            let openId = app.globalData.openId || '';
            if (!openId) {
                try {
                    const response = await wx.cloud.callFunction({ name: 'login' });
                    openId = response.result && response.result.openid || '';
                    if (openId) app.globalData.openId = openId;
                } catch (error) {
                    console.warn('[大姐牌调试] 获取身份失败', error);
                }
            }
            if (!this._isAttached || !openId) return;
            const ownProfile = realtimePlayerProfile.getStoredProfile();
            this.setData({
                myOpenId: openId,
                roomMembers: this.data.roomMembers.length ? this.data.roomMembers : [{
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
            const sharedHostId = this._pendingHostId || this.data.shareHostId;
            if (sharedHostId) {
                this._tryJoinSharedRoom();
                return;
            }
            if (!this.data.sharedEntryPending) {
                this._roomShareHostId = this.data.myOpenId;
                this._createRoom(this.data.myOpenId, true);
            }
        },

        buildShareMessage() {
            const app = getApp();
            const hostId = this._roomShareHostId || this.data.myOpenId || app.globalData.openId;
            if (!hostId) {
                wx.showToast({ title: this._text('preparing', '正在准备，请稍后'), icon: 'none' });
                return { title: this._text('shareTitle', '大姐牌｜满分激光枪已上膛'), path: '/pages/profile/index?game=queen', imageUrl: '/logo.png' };
            }
            if (!this.data.isOnlineMode) this._createRoom(hostId);
            return {
                title: this._text('shareTitle', '大姐牌｜满分激光枪已上膛'),
                path: '/pages/profile/index?game=queen&hostId=' + encodeURIComponent(hostId),
                imageUrl: '/logo.png'
            };
        },

        buildTimelineMessage() {
            return { title: this._text('timelineTitle', '抽到大姐，今晚听她的'), imageUrl: '/logo.png' };
        },

        _tryJoinSharedRoom() {
            const hostId = this._pendingHostId || this.data.shareHostId;
            if (!this._isAttached || !hostId || !this.data.myOpenId || this._joining) return;
            if (this.data.isOnlineMode && this._roomShareHostId === hostId) return;
            this._roomShareHostId = hostId;
            if (hostId === this.data.myOpenId) this._createRoom(hostId);
            else this._joinRoom(hostId);
        },

        async _createRoom(hostIdValue, silent) {
            const hostId = hostIdValue || this.data.myOpenId;
            if (!hostId || this._creating || this.data.isOnlineMode) return;
            this._roomShareHostId = hostId;
            this._creating = true;
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: 'createByHost', hostId: hostId, gameType: 'queen', connectionId: this._connectionId }
                });
                const result = response.result || {};
                if (!result.success || !result.room) throw new Error(result.error || '创建房间失败');
                if (!this._isAttached) return;
                this._applyRoom(result.room, true, result.roomDocId);
                if (!silent) {
                    wx.showToast({ title: this._text('roomCreated', '房间已创建'), icon: 'success' });
                }
            } catch (error) {
                if (this._isAttached) {
                    wx.showToast({ title: error.message || this._text('createFailed', '创建房间失败'), icon: 'none' });
                }
            } finally {
                this._creating = false;
            }
        },

        async _joinRoom(hostId) {
            if (this._joining) return;
            this._roomShareHostId = hostId;
            this._joining = true;
            wx.showLoading({ title: this._text('joiningRoom', '加入房间中…') });
            let joined = false;
            let message = '';
            try {
                for (let attempt = 0; attempt < 4 && !joined; attempt++) {
                    const response = await wx.cloud.callFunction({
                        name: 'roomManager',
                        data: { action: 'joinByHost', hostId: hostId, gameType: 'queen', connectionId: this._connectionId }
                    });
                    const result = response.result || {};
                    if (result.success && result.room) {
                        if (!this._isAttached) {
                            joined = true;
                            break;
                        }
                        this._applyRoom(result.room, result.isHost, result.roomDocId);
                        joined = true;
                    } else {
                        message = result.error || '';
                        if (!result.roomNotFound || attempt === 3) break;
                        await new Promise((resolve) => setTimeout(resolve, 600));
                    }
                }
            } catch (error) { message = error.message || ''; }
            wx.hideLoading();
            this._joining = false;
            if (!this._isAttached) return;
            wx.showToast({ title: joined ? this._text('joinedRoom', '已加入房间') : (message || this._text('joinFailed', '加入房间失败')), icon: joined ? 'success' : 'none' });
        },

        _applyRoom(room, isHost, docId) {
            if (!room) return;
            const members = room.members || [];
            const mine = members.find((member) => member.openId === this.data.myOpenId);
            this.setData({
                roomId: room.roomId,
                roomDocId: docId || room._id || this.data.roomDocId,
                roomMembers: members,
                onlineCount: Math.max(1, members.length),
                isOnlineMode: true,
                isHost: mine ? mine.isHost === true : isHost === true,
                connectionStatus: 'connecting'
            });
            this._applyState(room.gameState || {});
            this._startWatch(room.roomId);
            this._startHeartbeat();
        },

        _stateRevision(state) {
            const revision = Number(state && state.stateRevision);
            return Number.isFinite(revision) ? revision : Number(state && state.version || 0);
        },

        _serverNow() {
            return Date.now() + (this._serverClockOffsetMs || 0);
        },

        _updateServerClock(serverTime, startedAt) {
            const value = Number(serverTime);
            if (!Number.isFinite(value) || value <= 0) return;
            const receivedAt = Date.now();
            const midpoint = startedAt ? startedAt + (receivedAt - startedAt) / 2 : receivedAt;
            const sample = value - midpoint;
            this._serverClockOffsetMs = this._serverClockReady
                ? this._serverClockOffsetMs * 0.75 + sample * 0.25
                : sample;
            this._serverClockReady = true;
        },

        _startWatch(roomId) {
            if (!roomId || this._watchStarting || !this._isVisible) return;
            this._watchStarting = true;
            const generation = (this._watchGeneration || 0) + 1;
            this._watchGeneration = generation;
            if (this._watcher) {
                try { this._watcher.close(); } catch (error) {}
                this._watcher = null;
            }
            try {
                this._watcher = wx.cloud.database().collection('GameRoom').where({ roomId: roomId }).watch({
                    onChange: (snapshot) => {
                        if (!this._isAttached || this._watchGeneration !== generation || this.data.roomId !== roomId) return;
                        const room = snapshot.docs && snapshot.docs[0];
                        if (!room) {
                            this._recoverRoom(roomId);
                            return;
                        }
                        this._watchAttempt = 0;
                        this.setData({ connectionStatus: 'connected' });
                        this._onRoomUpdate(room);
                    },
                    onError: () => {
                        if (this.data.roomId !== roomId || this._watchGeneration !== generation) return;
                        this.setData({ connectionStatus: 'reconnecting' });
                        this._recoverRoom(roomId);
                        this._scheduleReconnect(roomId);
                    }
                });
            } catch (error) {
                this.setData({ connectionStatus: 'reconnecting' });
                this._recoverRoom(roomId);
                this._scheduleReconnect(roomId);
            }
            this._watchStarting = false;
        },

        _scheduleReconnect(roomId) {
            if (this._reconnectTimer || !this._isAttached || !this._isVisible) return;
            const attempt = Math.min(6, (this._watchAttempt || 0) + 1);
            this._watchAttempt = attempt;
            const delay = Math.min(WATCH_RECONNECT_MAX_MS, WATCH_RECONNECT_BASE_MS * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 180);
            this._reconnectTimer = setTimeout(() => {
                this._reconnectTimer = null;
                if (this.data.roomId === roomId) this._startWatch(roomId);
            }, delay);
        },

        async _recoverRoom(roomId) {
            if (this._recovering || !this._isVisible) return;
            this._recovering = true;
            try {
                const result = await wx.cloud.database().collection('GameRoom').where({ roomId: roomId }).limit(1).get();
                const room = result.data && result.data[0];
                if (!room) this._confirmRoomClosed(roomId);
                else this._onRoomUpdate(room);
            } catch (error) {
                this._scheduleReconnect(roomId);
            } finally { this._recovering = false; }
        },

        _confirmRoomClosed(roomId, requireMembership) {
            if (!roomId || this._roomCloseConfirmTimer || !this._isAttached) return;
            const token = roomId + ':' + Date.now();
            this._roomCloseConfirmToken = token;
            let misses = 0;
            const verify = async () => {
                this._roomCloseConfirmTimer = null;
                if (!this._isAttached || this._roomCloseConfirmToken !== token || this.data.roomId !== roomId) return;
                try {
                    const result = await wx.cloud.database().collection('GameRoom').where({ roomId: roomId }).limit(1).get();
                    const room = result.data && result.data[0];
                    const stillJoined = room && (!requireMembership || (room.members || []).some((member) => member.openId === this.data.myOpenId));
                    if (stillJoined) {
                        this._roomCloseConfirmToken = '';
                        this._onRoomUpdate(room);
                        return;
                    }
                    misses += 1;
                    if (misses >= 2) {
                        this._roomCloseConfirmToken = '';
                        this._onRoomClosed();
                        return;
                    }
                    this._roomCloseConfirmTimer = setTimeout(verify, 650);
                } catch (error) {
                    this._roomCloseConfirmToken = '';
                    this._scheduleReconnect(roomId);
                }
            };
            this._roomCloseConfirmTimer = setTimeout(verify, 450);
        },

        _onRoomUpdate(room) {
            if (!room || room.gameType !== 'queen') return;
            if (this._latestState && this._stateRevision(room.gameState) < this._stateRevision(this._latestState)) return;
            const members = room.members || [];
            const mine = members.find((member) => member.openId === this.data.myOpenId);
            if (this.data.myOpenId && !mine) {
                this._confirmRoomClosed(room.roomId || this.data.roomId, true);
                return;
            }
            this._roomCloseConfirmToken = '';
            if (this._roomCloseConfirmTimer) {
                clearTimeout(this._roomCloseConfirmTimer);
                this._roomCloseConfirmTimer = null;
            }
            this.setData({
                roomDocId: room._id || this.data.roomDocId,
                roomMembers: members,
                onlineCount: Math.max(1, members.length),
                isHost: !!(mine && mine.isHost),
                connectionStatus: 'connected'
            });
            this._applyState(room.gameState || {});
        },

        _playerName(openId, state) {
            const player = (state.players || []).find((item) => item.openId === openId);
            const fallbackName = player
                ? this._format('playerName', '玩家{seat}', { seat: player.seat })
                : this._text('unknownPlayer', '玩家');
            return realtimePlayerProfile.getMemberProfile(this.data.roomMembers, openId, fallbackName).nickname;
        },

        _resultCopy(state, effect) {
            const recipients = (effect && effect.recipients || []).filter((item) => Number(item.amount || 0) > 0);
            const myDrinkResult = recipients.find((item) => item.openId === this.data.myOpenId);
            const sourceName = effect && effect.sourceOpenId ? this._playerName(effect.sourceOpenId, state) : '';
            const lines = [];
            let title = this._text('resultTitle', '这张牌生效');
            let main = myDrinkResult
                ? this._format('drinkResultSelf', '你 喝 {count} 口', {
                    count: Math.max(1, Number(myDrinkResult.amount || 0))
                })
                : this._text('safeResult', '这波没人喝');
            if (!effect) return { title: title, main: main, lines: lines, showDrinkPointer: false };
            if (effect.type === 'boss') main = this._format('bossChanged', '{name} 成为新大姐', { name: sourceName });
            if (effect.type === 'cameraCard') main = this._format('cameraStored', '{name} 收下紧急按钮', { name: sourceName });
            if (effect.type === 'toiletCard') main = this._format('toiletStored', '{name} 收下厕所牌', { name: sourceName });
            if (effect.type === 'cpCreated') main = this._format('cpCreated', '{first} 和 {second} 锁成CP', { first: this._playerName(effect.targets[0], state), second: this._playerName(effect.targets[1], state) });
            if (effect.type === 'cpRemoved') main = this._format('cpRemoved', '{first} 和 {second} 解锁', { first: this._playerName(effect.targets[0], state), second: this._playerName(effect.targets[1], state) });
            if (effect.type === 'linkCleared') main = this._text('linkCleared', '全盘消完，这轮都活着');
            if (effect.type === 'toiletBlock') main = this._format('toiletBlocked', '{name} 挡掉一口', { name: sourceName });
            if (effect.type === 'toiletBreak') main = this._format('toiletLeft', '{name} 获准去厕所', { name: sourceName });
            if (effect.type === 'bossTarget') main = this._format('bossOrdered', '{name} 被大姐点名，现场听令', { name: this._playerName(effect.targets[0], state) });
            if (effect.type === 'medusa') {
                title = this._text('medusaReveal', '美杜莎睁眼');
                (effect.choices || []).forEach((choice) => {
                    lines.push(this._format('medusaChoiceLine', '{name} → {target}', {
                        name: this._playerName(choice.openId, state),
                        target: choice.targetOpenId ? this._playerName(choice.targetOpenId, state) : this._text('noChoice', '谁也没选')
                    }));
                });
            }
            return {
                title: title,
                main: main,
                lines: lines,
                showDrinkPointer: !!myDrinkResult
            };
        },

        _applyState(rawState, keepSelection) {
            const state = rawState && rawState.gameKind === 'queen'
                ? rawState
                : { gameKind: 'queen', phase: 'waiting', version: 0, players: [], playerOrder: [] };
            const oldState = this._latestState;
            if (oldState && this._stateRevision(state) < this._stateRevision(oldState)) return;
            this._latestState = state;
            const phase = state.phase || 'waiting';
            const stateSignature = [phase, Number(state.version || 0), Number(state.stateRevision || 0)].join(':');
            if (this._debugStateSignature !== stateSignature) {
                this._debugStateSignature = stateSignature;
                this._debug('收到新的公开游戏状态', {
                    '新阶段': phase,
                    '新版本': state.version || 0,
                    '同步修订号': state.stateRevision || 0,
                    '当前牌点数': state.currentCard && state.currentCard.rank || '无',
                    '当前牌花色': state.currentCard && state.currentCard.suitKey || '无',
                    '剩余牌数': state.remainingCards,
                    '效果类型': state.effect && state.effect.type || '无'
                });
            }
            const players = state.players || [];
            const order = state.playerOrder || [];
            const isPlayer = order.includes(this.data.myOpenId);
            const me = players.find((player) => player.openId === this.data.myOpenId) || {};
            const selectedTargetIds = keepSelection || (oldState && oldState.version === state.version)
                ? this.data.selectedTargetIds
                : [];
            const allowSelfTarget = phase === 'cp';
            const targetPlayers = players.filter((player) => allowSelfTarget || player.openId !== this.data.myOpenId).map((player) => ({
                ...player,
                name: this._playerName(player.openId, state),
                selected: selectedTargetIds.includes(player.openId)
            }));
            const targetLayoutClass = targetPlayers.length <= 1
                ? 'target-single'
                : (targetPlayers.length === 2 ? 'target-double' : 'target-multiple');
            const playerViews = players.map((player) => {
                const fallbackName = this._format('playerName', '玩家{seat}', { seat: player.seat });
                const memberProfile = realtimePlayerProfile.getMemberProfile(
                    this.data.roomMembers,
                    player.openId,
                    fallbackName
                );
                return {
                    ...player,
                    name: memberProfile.nickname,
                    avatarUrl: memberProfile.avatarUrl,
                    isMe: player.openId === this.data.myOpenId,
                    isActive: (phase === 'normal' ? state.currentPlayerOpenId : state.activePlayerOpenId) === player.openId,
                    isBoss: state.bossOpenId === player.openId,
                    cameraCards: player.cameraCards || 0,
                    toiletCards: player.toiletCards || 0,
                    drinkCount: player.drinkCount || 0
                };
            });
            const now = this._serverNow();
            const legacyResultEvent = phase === 'result'
                ? {
                    id: 'legacy_result_' + Number(state.version || 0),
                    effect: state.effect || {},
                    card: state.currentCard || null,
                    visibleUntil: Number(state.deadlineAt || 0)
                }
                : null;
            const resultEvent = state.resultEvent || legacyResultEvent;
            const resultEventId = resultEvent && resultEvent.id || '';
            const resultEffect = resultEvent && resultEvent.effect || {};
            const drinkRecipients = (resultEffect.recipients || []).filter((item) => Number(item.amount || 0) > 0);
            const isDrinkResult = drinkRecipients.length > 0;
            const isMyDrinkResult = drinkRecipients.some((item) => item.openId === this.data.myOpenId);
            const resultVisible = !!resultEvent && (
                phase === 'result' || Number(resultEvent.visibleUntil || 0) > now
            );
            const previousResultEventId = this._lastShownResultId || '';
            const isNewResultEvent = !!resultEventId && resultEventId !== previousResultEventId;
            const keepVisibleResult = !!resultEventId && resultEventId === previousResultEventId && this.data.showLocalResult;
            const showLocalResult = resultVisible && (isNewResultEvent || keepVisibleResult) &&
                (!isDrinkResult || isMyDrinkResult);
            if (isNewResultEvent) this._lastShownResultId = resultEventId;
            const resultCard = resultEvent && resultEvent.card || null;
            const result = this._resultCopy(state, resultEffect);
            const actionsLocked = Number(state.nextActionAt || 0) > now || phase === 'result';
            const keepOptimisticLinkPair = !!this._optimisticLinkPair &&
                phase === 'link' &&
                Number(this._optimisticLinkPair.version) === Number(state.version);
            if (!keepOptimisticLinkPair) this._optimisticLinkPair = null;
            const optimisticLinkIds = keepOptimisticLinkPair ? this._optimisticLinkPair.ids : [];
            const keepLocalLinkSelection = phase === 'link' &&
                state.activePlayerOpenId === this.data.myOpenId &&
                Number(this._linkSelectionVersion) === Number(state.version) &&
                (state.linkBoard || []).some((cell) => cell.id === this._linkSelectedCellId && !cell.removed);
            if (!keepLocalLinkSelection) {
                this._linkSelectedCellId = null;
                this._linkSelectionVersion = null;
            }
            const pendingResult = phase === 'toiletPrompt' && state.effect && state.effect.pendingResult || {};
            const pendingRecipient = (pendingResult.recipients || []).find((item) => item.openId === this.data.myOpenId);
            const canChooseToilet = phase === 'toiletPrompt' &&
                (state.effect.pendingOpenIds || []).includes(this.data.myOpenId) &&
                Number(me.toiletCards || 0) > 0;
            const toiletDrinkCount = pendingRecipient ? Math.max(0, Number(pendingRecipient.amount || 0)) : 0;
            const topics = this.data.copy && this.data.copy.gardenTopics || {};
            const cpPairs = (state.cpPairs || []).map((pair) => ({
                ...pair,
                label: this._playerName(pair.a, state) + ' × ' + this._playerName(pair.b, state)
            }));
            this.setData({
                gamePhase: phase,
                gameVersion: Number(state.version) || 0,
                isPlayer: isPlayer,
                isSpectator: phase !== 'waiting' && !isPlayer,
                playerViews: playerViews,
                remainingCards: state.remainingCards || 0,
                currentCard: state.currentCard || null,
                currentPlayerName: this._playerName(state.currentPlayerOpenId, state),
                currentPlayerOpenId: state.currentPlayerOpenId || '',
                activePlayerName: this._playerName(state.activePlayerOpenId, state),
                activePlayerOpenId: state.activePlayerOpenId || '',
                canDraw: !actionsLocked && phase === 'normal' && state.currentPlayerOpenId === this.data.myOpenId,
                canResolveEffect: !actionsLocked && !!(state.effect && state.effect.sourceOpenId === this.data.myOpenId),
                canMiniAct: !actionsLocked && state.activePlayerOpenId === this.data.myOpenId,
                targetPlayers: targetPlayers,
                targetLayoutClass: targetLayoutClass,
                selectedTargetIds: selectedTargetIds,
                targetMultiple: phase === 'cp' || !!(state.effect && Number(state.effect.maxTargets) > 1),
                cpPairs: cpPairs,
                linkBoardSide: (state.linkBoard || []).length
                    ? Math.max(1, Math.round(Math.sqrt(state.linkBoard.length)))
                    : QUEEN_LINK_SIDE,
                linkBoard: (state.linkBoard || []).map((cell) => ({
                    ...cell,
                    removed: !!cell.removed || optimisticLinkIds.includes(cell.id),
                    selected: keepLocalLinkSelection && cell.id === this._linkSelectedCellId
                })),
                mineCells: state.mineCells || [],
                medusaSubmitted: (state.medusaSubmitted || []).includes(this.data.myOpenId),
                cameraPressed: (state.cameraPressed || []).some((item) => item.openId === this.data.myOpenId),
                resultTitle: result.title,
                resultMain: result.main,
                resultLines: result.lines,
                resultCard: resultCard,
                showLocalResult: showLocalResult,
                actionsLocked: actionsLocked,
                showDrinkPointer: showLocalResult && result.showDrinkPointer,
                showBossCard: showLocalResult && !!(resultCard && resultCard.rank === '2' && resultEffect.type === 'boss'),
                showResultCard: showLocalResult && !!resultCard && resultEffect.advanceTurn !== false,
                topicText: topics[state.effect && state.effect.topic] || state.effect && state.effect.topic || '',
                myCameraCards: me.cameraCards || 0,
                canTriggerCamera: !actionsLocked && Number(me.cameraCards || 0) > 0 && ['normal', 'target', 'cp', 'garden', 'link', 'mine', 'medusa'].includes(phase),
                myToiletCards: me.toiletCards || 0,
                myDrinkCount: me.drinkCount || 0,
                canChooseToilet: canChooseToilet,
                toiletDrinkCount: toiletDrinkCount,
                toiletPromptWarning: this._format('toiletPromptWarning', '否则你需要喝{count}口', { count: toiletDrinkCount }),
                amBoss: state.bossOpenId === this.data.myOpenId,
                canTriggerBoss: !actionsLocked && phase === 'normal' && state.bossOpenId === this.data.myOpenId,
                showBossTargets: !actionsLocked && phase === 'normal' ? this.data.showBossTargets : false
            });
            this._updatePlayerLayout(playerViews.length);
            this._scheduleDeadline(state);
            this._scheduleLocalResult(state, resultEvent);
        },

        _scheduleLocalResult(state, resultEvent) {
            if (this._localResultTimer) clearTimeout(this._localResultTimer);
            this._localResultTimer = null;
            if (!this._isVisible || !state) return;
            const visibleUntil = Number(resultEvent && resultEvent.visibleUntil || 0);
            const unlockAt = Number(state.nextActionAt || 0);
            const futureTimes = [visibleUntil, unlockAt].filter((value) => value > this._serverNow());
            if (!futureTimes.length) return;
            const wakeAt = Math.min.apply(null, futureTimes);
            this._localResultTimer = setTimeout(() => {
                this._localResultTimer = null;
                if (!this._isAttached || !this._latestState) return;
                this._applyState(this._latestState, true);
            }, Math.max(20, wakeAt - this._serverNow() + 40));
        },

        _scheduleDeadline(state) {
            this._clearDeadline();
            if (!state || !state.deadlineAt || !this._isVisible) {
                if (this.data.countdownSeconds) this.setData({ countdownSeconds: 0 });
                return;
            }
            const tick = () => {
                if (!this._isAttached || !this._latestState) return;
                const remaining = Math.max(0, Number(this._latestState.deadlineAt) - this._serverNow());
                this.setData({ countdownSeconds: Math.ceil(remaining / 1000) });
                if (remaining <= 0) {
                    this._clearDeadline();
                    this._requestTimeout(this._latestState);
                }
            };
            this._deadlineTimer = setInterval(tick, 250);
            tick();
        },

        _requestTimeout(state) {
            if (!state || !state.deadlineAt || this._timeoutInFlight || this._timeoutFallback || !this.data.isPlayer) return;
            const key = [state.phase, state.version, state.deadlineAt].join(':');
            if (this._timeoutKey === key) return;
            const order = state.playerOrder || [];
            const coordinator = order.length ? order[Math.abs(Number(state.version) || 0) % order.length] : '';
            const myIndex = Math.max(0, order.indexOf(this.data.myOpenId));
            const delay = coordinator === this.data.myOpenId ? 0 : 900 + myIndex * 260;
            this._timeoutFallback = setTimeout(async () => {
                this._timeoutFallback = null;
                if (!this._latestState || [this._latestState.phase, this._latestState.version, this._latestState.deadlineAt].join(':') !== key) return;
                this._timeoutKey = key;
                this._timeoutInFlight = true;
                try {
                    const startedAt = Date.now();
                    const response = await wx.cloud.callFunction({
                        name: 'roomManager',
                        data: {
                            action: 'queenTimeout', roomId: this.data.roomId, roomDocId: this.data.roomDocId,
                            expectedVersion: state.version, expectedPhase: state.phase,
                            expectedDeadlineAt: state.deadlineAt
                        }
                    });
                    const result = response.result || {};
                    this._updateServerClock(result.serverTime, startedAt);
                    if (!result.success || result.tooEarly) this._timeoutKey = '';
                    if (result.success && result.state) this._applyState(result.state);
                } catch (error) {
                    this._timeoutKey = '';
                } finally {
                    this._timeoutInFlight = false;
                    if (!this._timeoutKey && state.phase === 'link' && this._isAttached && this._isVisible && !this._timeoutFallback) {
                        this._timeoutFallback = setTimeout(() => {
                            this._timeoutFallback = null;
                            const latest = this._latestState;
                            if (latest && [latest.phase, latest.version, latest.deadlineAt].join(':') === key) {
                                this._scheduleDeadline(latest);
                            }
                        }, 1000);
                    }
                }
            }, delay);
        },

        _clearDeadline() {
            if (this._deadlineTimer) clearInterval(this._deadlineTimer);
            if (this._timeoutFallback) clearTimeout(this._timeoutFallback);
            this._deadlineTimer = null;
            this._timeoutFallback = null;
        },

        async _callAction(actionType, payload) {
            if (this.data.isActing || this.data.actionsLocked || !this.data.roomId) {
                this._debug('操作未发送：页面正在处理其他请求或房间尚未建立', {
                    '操作类型': actionType,
                    '按钮已锁定': this.data.isActing,
                    '结果展示锁定': this.data.actionsLocked,
                    '是否存在房间': !!this.data.roomId
                });
                return;
            }
            const debugRequestId = 'q_' + String(actionType).slice(0, 8) + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
            this._debug('准备发送游戏操作', {
                '请求标识': debugRequestId,
                '操作类型': actionType,
                '发送版本': this.data.gameVersion,
                '当前牌点数': this.data.currentCard && this.data.currentCard.rank || '无'
            });
            this.setData({ isActing: true });
            try {
                const startedAt = Date.now();
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'queenAction', roomId: this.data.roomId, roomDocId: this.data.roomDocId,
                        actionType: actionType, payload: payload || {},
                        expectedVersion: this.data.gameVersion,
                        debugRequestId: debugRequestId
                    }
                });
                const result = response.result || {};
                this._updateServerClock(result.serverTime, startedAt);
                this._debug('收到云函数操作结果', {
                    '请求标识': debugRequestId,
                    '操作类型': actionType,
                    '请求耗时毫秒': Date.now() - startedAt,
                    '是否成功': !!result.success,
                    '是否旧请求': !!result.stale,
                    '返回阶段': result.state && result.state.phase || '无',
                    '返回版本': result.state && result.state.version,
                    '错误': result.error || ''
                });
                if (!result.success) {
                    const businessError = new Error(result.error || this._text('actionFailed', '操作失败'));
                    businessError.debugRequestId = debugRequestId;
                    businessError.cloudResult = result;
                    throw businessError;
                }
                if (result.state) this._applyState(result.state);
            } catch (error) {
                console.error('[大姐牌调试] 游戏操作失败', {
                    '请求标识': debugRequestId,
                    '操作类型': actionType,
                    '失败时阶段': this.data.gamePhase,
                    '失败时版本': this.data.gameVersion,
                    '错误': error && (error.errMsg || error.message) || String(error),
                    '错误码': error && (error.errCode || error.code) || '',
                    '云函数返回': error && error.cloudResult || null,
                    '原始错误': error
                });
                wx.showToast({ title: error.message || this._text('actionFailed', '操作失败'), icon: 'none' });
            } finally { this.setData({ isActing: false }); }
        },

        async startGame() {
            if (this.data.isStarting || this.data.actionsLocked) return;
            if (!this.data.isOnlineMode) {
                wx.showToast({ title: this._text('shareFirst', '请先分享创建房间'), icon: 'none' });
                return;
            }
            const debugRequestId = 'q_start_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
            this._debug('用户请求开始大姐牌', {
                '请求标识': debugRequestId,
                '在线人数': this.data.onlineCount
            });
            this.setData({ isStarting: true });
            try {
                const startedAt = Date.now();
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'queenStart', roomId: this.data.roomId, roomDocId: this.data.roomDocId,
                        debugRequestId: debugRequestId
                    }
                });
                const result = response.result || {};
                this._updateServerClock(result.serverTime, startedAt);
                this._debug('收到开始游戏结果', {
                    '请求标识': debugRequestId,
                    '请求耗时毫秒': Date.now() - startedAt,
                    '是否成功': !!result.success,
                    '返回阶段': result.state && result.state.phase || '无',
                    '返回版本': result.state && result.state.version,
                    '错误': result.error || ''
                });
                if (!result.success) throw new Error(result.error || this._text('startFailed', '开始失败'));
                if (result.state) this._applyState(result.state);
            } catch (error) {
                console.error('[大姐牌调试] 开始游戏失败', {
                    '请求标识': debugRequestId,
                    '错误': error && (error.errMsg || error.message) || String(error),
                    '错误码': error && (error.errCode || error.code) || '',
                    '原始错误': error
                });
                wx.showToast({ title: error.message || this._text('startFailed', '开始失败'), icon: 'none' });
            } finally { this.setData({ isStarting: false }); }
        },

        drawCard() {
            this._debug('用户点击抽牌', {
                '是否轮到本人': this.data.canDraw,
                '公开剩余牌数': this.data.remainingCards,
                '当前玩家是否本人': this.data.currentPlayerOpenId === this.data.myOpenId
            });
            this._callAction('draw');
        },

        toggleTarget(e) {
            const openId = e.currentTarget.dataset.openid;
            const selected = this.data.selectedTargetIds.slice();
            const index = selected.indexOf(openId);
            if (index >= 0) selected.splice(index, 1);
            else {
                if (!this.data.targetMultiple) selected.splice(0, selected.length);
                selected.push(openId);
            }
            this.setData({
                selectedTargetIds: selected,
                targetPlayers: this.data.targetPlayers.map((player) => ({ ...player, selected: selected.includes(player.openId) }))
            });
        },

        confirmTargets() { if (this.data.selectedTargetIds.length) this._callAction('resolveTargets', { targetOpenIds: this.data.selectedTargetIds }); },
        createCp() { if (this.data.selectedTargetIds.length === 2) this._callAction('cpCreate', { targetOpenIds: this.data.selectedTargetIds }); },
        removeCp(e) { this._callAction('cpRemove', { pairId: e.currentTarget.dataset.id }); },
        gardenEnd() { this._callAction('gardenEnd'); },
        _linkBoardSide(board) {
            const inferred = Math.round(Math.sqrt((board || []).length));
            return inferred > 0 ? inferred : QUEEN_LINK_SIDE;
        },
        _canLinkCellsLocally(board, firstCellId, secondCellId) {
            const cells = board || [];
            const first = cells.find((item) => item.id === firstCellId && !item.removed);
            const second = cells.find((item) => item.id === secondCellId && !item.removed);
            if (!first || !second || first.id === second.id || first.code !== second.code) return false;

            const side = this._linkBoardSide(cells);
            const firstRow = Math.floor(first.id / side);
            const firstColumn = first.id % side;
            const secondRow = Math.floor(second.id / side);
            const secondColumn = second.id % side;
            const rowDistance = secondRow - firstRow;
            const columnDistance = secondColumn - firstColumn;
            if (rowDistance !== 0 && columnDistance !== 0 && Math.abs(rowDistance) !== Math.abs(columnDistance)) return false;

            const rowStep = Math.sign(rowDistance);
            const columnStep = Math.sign(columnDistance);
            let row = firstRow + rowStep;
            let column = firstColumn + columnStep;
            while (row !== secondRow || column !== secondColumn) {
                const middle = cells.find((item) => item.id === row * side + column);
                if (middle && !middle.removed) return false;
                row += rowStep;
                column += columnStep;
            }
            return true;
        },
        async pickLink(e) {
            if (!this.data.canMiniAct || this.data.isActing || this._linkPairSubmitting) return;
            if (this._latestState && this._latestState.deadlineAt && this._serverNow() >= this._latestState.deadlineAt) {
                this._requestTimeout(this._latestState);
                return;
            }
            const cellId = Number(e.currentTarget.dataset.id);
            const cell = (this.data.linkBoard || []).find((item) => item.id === cellId && !item.removed);
            if (!cell) return;

            if (!Number.isInteger(this._linkSelectedCellId)) {
                this._linkSelectedCellId = cellId;
                this._linkSelectionVersion = this.data.gameVersion;
                this.setData({
                    linkBoard: this.data.linkBoard.map((item) => ({ ...item, selected: item.id === cellId }))
                });
                return;
            }

            if (this._linkSelectedCellId === cellId) {
                this._linkSelectedCellId = null;
                this._linkSelectionVersion = null;
                this.setData({ linkBoard: this.data.linkBoard.map((item) => ({ ...item, selected: false })) });
                return;
            }

            const firstCellId = this._linkSelectedCellId;
            this._linkSelectedCellId = null;
            this._linkSelectionVersion = null;
            this._linkPairSubmitting = true;
            const optimistic = this._canLinkCellsLocally(this.data.linkBoard, firstCellId, cellId);
            if (optimistic) {
                this._optimisticLinkPair = { version: this.data.gameVersion, ids: [firstCellId, cellId] };
            }
            this.setData({
                linkBoard: this.data.linkBoard.map((item) => ({
                    ...item,
                    removed: !!item.removed || optimistic && (item.id === firstCellId || item.id === cellId),
                    selected: false
                }))
            });
            try {
                await this._callAction('linkPick', { firstCellId: firstCellId, secondCellId: cellId });
            } finally {
                this._linkPairSubmitting = false;
                if (this._optimisticLinkPair && Number(this._optimisticLinkPair.version) === Number(this.data.gameVersion)) {
                    this._optimisticLinkPair = null;
                    if (this._latestState) this._applyState(this._latestState, true);
                }
            }
        },
        pickMine(e) { this._callAction('minePick', { cellId: Number(e.currentTarget.dataset.id) }); },
        selectMedusa(e) { this._callAction('medusaSelect', { targetOpenId: e.currentTarget.dataset.openid || '' }); },
        pressCamera() { this._callAction('cameraPress'); },
        triggerCamera() { this._callAction('cameraTrigger'); },
        _toiletDecision(actionType) {
            const effect = this._latestState && this._latestState.effect || {};
            this._callAction(actionType, { promptAt: Number(effect.at || 0) });
        },
        useToiletBlock() { this._toiletDecision('toiletBlock'); },
        useToiletBreak() { this._toiletDecision('toiletBreak'); },
        skipToilet() { this._toiletDecision('toiletSkip'); },
        continueResult() { this.setData({ showLocalResult: false }); },
        toggleBossTargets() { this.setData({ showBossTargets: !this.data.showBossTargets }); },
        bossTarget(e) {
            this.setData({ showBossTargets: false });
            this._callAction('bossTarget', { targetOpenId: e.currentTarget.dataset.openid });
        },

        _startHeartbeat() {
            if (this._heartbeatTimer) return;
            this._writePresence();
            this._heartbeatTimer = setInterval(() => this._writePresence(), HEARTBEAT_MS);
        },

        async _writePresence() {
            if (!this.data.roomId || !this.data.myOpenId || this._presenceWriting) return;
            this._presenceWriting = true;
            const collection = wx.cloud.database().collection('TenHalfPresence');
            const data = {
                roomId: this.data.roomId,
                connectionId: this._connectionId,
                activeAt: wx.cloud.database().serverDate(),
                updatedAt: wx.cloud.database().serverDate()
            };
            try {
                if (!this._presenceDocId) {
                    const found = await collection.where({ roomId: this.data.roomId, _openid: this.data.myOpenId }).limit(1).get();
                    this._presenceDocId = found.data && found.data[0] && found.data[0]._id || '';
                }
                if (this._presenceDocId) await collection.doc(this._presenceDocId).update({ data: data });
                else {
                    const result = await collection.add({ data: data });
                    this._presenceDocId = result._id || '';
                }
                await this._refreshPresence();
            } catch (error) {
                console.warn('[大姐牌调试] 在线状态写入失败', error);
            } finally { this._presenceWriting = false; }
        },

        async _refreshPresence() {
            const result = await wx.cloud.database().collection('TenHalfPresence')
                .where({ roomId: this.data.roomId }).limit(20).get();
            if (!this._isAttached || !this.data.roomId) return;
            const active = {};
            const connections = {};
            (result.data || []).forEach((item) => {
                if (!item || !item._openid) return;
                const value = item.activeAt || item.updatedAt;
                active[item._openid] = value instanceof Date ? value.getTime() : Number(value) || 0;
                connections[item._openid] = item.connectionId || '';
            });
            const now = Date.now();
            this._staleCandidates = this._staleCandidates || {};
            (this.data.roomMembers || []).forEach((member) => {
                if (member.openId === this.data.myOpenId) return;
                const connectionMatches = !member.connectionId || connections[member.openId] === member.connectionId;
                const activeAt = Math.max(connectionMatches ? (active[member.openId] || 0) : 0, Number(member.joinTime) || 0);
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
                    data: { action: 'kickStale', roomId: this.data.roomId, targetOpenId: member.openId }
                }).catch(() => {}).finally(() => { delete this._staleCandidates[member.openId]; });
            });
        },

        _onRoomClosed() {
            this._roomShareHostId = '';
            this._clearConnections();
            this._latestState = null;
            this._lastShownResultId = '';
            this._optimisticLinkPair = null;
            this.setData({
                roomId: '', roomDocId: '', isOnlineMode: false, isHost: false,
                connectionStatus: 'disconnected', gamePhase: 'waiting', playerViews: [],
                onlineCount: 1, currentCard: null, selectedTargetIds: [], showBossTargets: false,
                showLocalResult: false, actionsLocked: false, resultCard: null
            });
            wx.showToast({ title: this._text('roomClosed', '房间已关闭'), icon: 'none' });
        },

        _clearConnections(clearDeadline = true) {
            this._watchGeneration = (this._watchGeneration || 0) + 1;
            if (this._watcher) { try { this._watcher.close(); } catch (error) {} }
            if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
            if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
            if (this._roomCloseConfirmTimer) clearTimeout(this._roomCloseConfirmTimer);
            if (this._localResultTimer) clearTimeout(this._localResultTimer);
            this._watcher = null;
            this._heartbeatTimer = null;
            this._reconnectTimer = null;
            this._roomCloseConfirmTimer = null;
            this._localResultTimer = null;
            this._roomCloseConfirmToken = '';
            if (clearDeadline) this._clearDeadline();
        },

        _leaveRoom() {
            const roomId = this.data.roomId;
            const isHost = this.data.isHost;
            if (!roomId || !this.data.isOnlineMode) return;
            const app = getApp();
            const reenter = app.globalData._reenteringQueenRoom;
            const skip = reenter &&
                (reenter.roomId === roomId || reenter.roomId === this._roomShareHostId) &&
                Date.now() - reenter.timestamp < 10000;
            if (skip) app.globalData._reenteringQueenRoom = null;
            if (!skip) {
                wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: isHost ? 'close' : 'leave', roomId: roomId, connectionId: this._connectionId }
                }).catch(() => {});
            }
        }
    }
});
