const i18n = require('../../utils/i18n');
const realtimePlayerProfile = require('../../utils/realtime_player_profile.js');
const cowardAvatarCache = require('../../utils/coward_avatar_cache.js');

const HEARTBEAT_MS = 12000;
// 胆小鬼只有一名玩家离线就无法继续“全员拍桌”，单独使用更短的离线窗口。
// 心跳频率保持不变，避免为了提速增加数据库写入次数。
const STALE_MEMBER_MS = 45000;
const STALE_CONFIRM_MS = 15000;
// watch 失败时数据库 SDK 的 WebSocket 仍可能处在关闭/重新登录过渡期。
// 权威状态会立刻用一次普通读取恢复，因此这里稍微留出重建间隔，避免快速
// close -> watch -> loginFail 的循环；这不会增加游戏操作的等待时间。
const WATCH_RECONNECT_BASE_MS = 1200;
const WATCH_RECONNECT_MAX_MS = 8000;

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
        isStarting: false,
        isActing: false,
        gamePhase: 'waiting',
        gameVersion: 0,
        roundToken: '',
        isPlayer: false,
        isSpectator: false,
        playerViews: [],
        playerChipWidthPx: 140,
        playerAvatarSizePx: 24,
        playerRowWidthPx: 375,
        playerSidePaddingPx: 12,
        cardWidthPx: 220,
        cardHeightPx: 308,
        playStageTopPx: 97,
        stageBottomPx: 88,
        playStageBottomPx: 150,
        skillAvatarSizePx: 40,
        myCard: null,
        cardRevealed: false,
        isDealing: false,
        isCardSwapping: false,
        isSwapFlipping: false,
        timelinePhase: 'reveal',
        countdownValue: '',
        stopEnabled: false,
        alcoholValue: 0,
        skillUsed: false,
        skillMenuLevel: 'closed',
        skillSubmitting: false,
        statusText: '',
        resultTitle: '',
        resultMain: '',
        resultAcknowledged: false
    },

    lifetimes: {
        attached() {
            this._isAttached = true;
            this._isVisible = true;
            this._entryGeneration = 0;
            this._connectionId = this._newConnectionId();
            this._resumeFreshRoom = false;
            this._backgroundLeavePromise = null;
            this._database = wx.cloud.database();
            this._pendingHandsByRoundToken = {};
            this._handReadRequests = {};
            this._presenceByOpenId = {};
            this._presenceWriteQueue = Promise.resolve();
            this._presenceCowardSkill = null;
            this._calculateLayout();
            this._fetchOpenId();
        },
        detached() {
            const leaveContext = this._captureLeaveContext();
            this._isAttached = false;
            this._isVisible = false;
            this._entryGeneration = Number(this._entryGeneration || 0) + 1;
            this._clearConnections();
            this._leaveRoom(leaveContext);
        }
    },

    pageLifetimes: {
        show() {
            this._isVisible = true;
            this._calculateLayout();
            const pendingLeave = this._backgroundLeavePromise;
            if (pendingLeave) {
                pendingLeave.then(() => {
                    if (this._backgroundLeavePromise === pendingLeave) this._backgroundLeavePromise = null;
                    if (!this._isAttached || !this._isVisible) return;
                    this._enterFreshRoomAfterBackground();
                });
                return;
            }
            if (this._resumeFreshRoom) return this._enterFreshRoomAfterBackground();
            if (this.data.roomId) {
                this._startWatch(this.data.roomId);
                this._startHeartbeat();
                if (this._latestState) this._applyState(this._latestState, true);
            } else this._prepareRoomEntry();
        },
        hide() {
            const leaveContext = this._captureLeaveContext();
            this._isVisible = false;
            this._entryGeneration = Number(this._entryGeneration || 0) + 1;
            this._clearConnections();
            // 即便 create/join 还在途中、尚未写入 roomId，也要轮换连接代次。
            // 这样迟到的旧请求只能清理自己的连接，不能删除恢复后的新连接。
            this._connectionId = this._newConnectionId();
            if (!leaveContext) return;

            // 小程序进入后台即结束本设备的本次房间连接。先保存旧连接标识，
            // 再清空本地权威状态；恢复时必须等待离房完成，不能抢先重连旧局。
            this._resumeFreshRoom = true;
            this._pendingHostId = '';
            this._roomShareHostId = '';
            const resetPromise = this._resetLocalRoomState();
            const leavePromise = this._leaveRoom(leaveContext);
            this._backgroundLeavePromise = Promise.all([resetPromise, leavePromise]).then(() => undefined);
        },
        resize() {
            this._calculateLayout();
            this._updatePlayerLayout(this.data.playerViews.length);
        }
    },

    methods: {
        _newConnectionId() {
            return 'coward_conn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        },

        _captureLeaveContext() {
            if (!this.data.roomId || !this.data.isOnlineMode) return null;
            return {
                roomId: this.data.roomId,
                isHost: this.data.isHost === true,
                connectionId: this._connectionId,
                shareHostId: this._roomShareHostId || ''
            };
        },

        _enterFreshRoomAfterBackground() {
            if (!this._isAttached || !this._isVisible || !this.data.myOpenId) return;
            this._resumeFreshRoom = false;
            this._pendingHostId = '';
            this._roomShareHostId = this.data.myOpenId;
            // 后台期间旧 watcher 已被关闭。重新进入时刷新数据库引用，避免后续
            // watch 继续挂在旧连接的 CLOSED 状态上。
            this._database = wx.cloud.database();
            this._watchAttempt = 0;
            this._presenceWatchAttempt = 0;
            this._createRoom(this.data.myOpenId, true);
        },

        _text(key, fallback) {
            return this.data.copy && this.data.copy[key] || fallback || '';
        },

        _format(key, fallback, values) {
            return i18n.formatString(this._text(key, fallback), values || {});
        },

        _debugPlayer(openId) {
            const value = String(openId || '');
            return value ? '…' + value.slice(-6) : '未知';
        },

        _debug(message, details) {
            console.log('[胆小鬼调试] ' + message, {
                '房间': this.data.roomId || '未进入',
                '本轮': this.data.roundToken || this._activeRoundToken || '未开始',
                '阶段': this.data.gamePhase || '未知',
                ...(details || {})
            });
        },

        _debugError(message, error, details) {
            const code = error && (error.errCode !== undefined ? error.errCode : error.code);
            const text = error && (error.errMsg || error.message) || String(error || '未知错误');
            const permissionDenied = String(code || '') === '-502003' || /permission denied/i.test(text);
            console.error('[胆小鬼调试] ' + message, {
                '房间': this.data.roomId || '未进入',
                '本轮': this.data.roundToken || this._activeRoundToken || '未开始',
                '阶段': this.data.gamePhase || '未知',
                '错误码': code === undefined ? '无' : code,
                '错误': text,
                '权限排查': permissionDenied
                    ? '若集合为 CowardHand：需允许登录用户仅读取 _openid/ownerOpenId 均等于本人 OpenID 的文档；若集合为 TenHalfPresence：需允许登录用户读取、仅创建者写入。'
                    : '非权限错误',
                ...(details || {}),
                '原始错误': error
            });
        },

        _stateRevision(state) {
            const revision = Number(state && state.stateRevision);
            return Number.isFinite(revision) ? revision : Number(state && state.version || 0);
        },

        _resetRoomScopedAuthority() {
            this._latestState = null;
            this._activeRoundToken = '';
            this._activeCardRevision = -1;
            this._displayedHandKey = '';
            this._pendingHandsByRoundToken = {};
            this._handReadRequests = {};
            this._presenceByOpenId = {};
            this._presenceCowardSkill = null;
            this._readyRequestToken = '';
            this._advanceRequestToken = '';
            this._advanceRetryCount = 0;
            this._lastCowardStartSignalKey = '';
            this._pendingCowardStartSignal = null;
            this._timeoutRequestToken = '';
            this._stopRequestToken = '';
            this._clearTimeline();
            this._clearReadyAdvanceTimer();
        },

        _resetLocalRoomState() {
            this._resetRoomScopedAuthority();
            this._presenceDocId = '';
            if (this._isAttached) {
                this.setData({
                    roomId: '',
                    roomDocId: '',
                    roomMembers: [],
                    onlineCount: 1,
                    isOnlineMode: false,
                    isHost: false,
                    isStarting: false,
                    isActing: false,
                    gamePhase: 'waiting',
                    gameVersion: 0,
                    roundToken: '',
                    isPlayer: false,
                    isSpectator: false,
                    playerViews: [],
                    myCard: null,
                    cardRevealed: false,
                    isDealing: false,
                    isCardSwapping: false,
                    isSwapFlipping: false,
                    timelinePhase: 'reveal',
                    countdownValue: '',
                    stopEnabled: false,
                    alcoholValue: 0,
                    skillUsed: false,
                    skillMenuLevel: 'closed',
                    skillSubmitting: false,
                    statusText: '',
                    resultTitle: '',
                    resultMain: '',
                    resultAcknowledged: false
                });
            }
            return Promise.resolve();
        },

        _calculateLayout() {
            let info = {};
            try {
                const menu = wx.getMenuButtonBoundingClientRect();
                info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
                if (menu && menu.top > 0) {
                    const right = info.windowWidth - menu.right;
                    this.setData({ navTop: menu.top, menuRight: right, menuDotRight: right + menu.width * 0.72 });
                }
            } catch (error) {}
            const update = (rootHeightValue) => {
                if (!this._isAttached) return;
                let windowInfo = info;
                if (!windowInfo.windowWidth) {
                    try { windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (error) { return; }
                }
                const width = windowInfo.windowWidth || 375;
                const height = windowInfo.windowHeight || 667;
                const rpx = width / 750;
                const rootHeight = Number(rootHeightValue) || height;
                const safeBottom = windowInfo.safeArea ? Math.max(0, height - windowInfo.safeArea.bottom) : 0;
                const stageBottom = safeBottom + 174 * rpx;
                const playStageBottom = stageBottom + 24 * rpx;
                const stageTop = (height <= 700 ? 168 : 194) * rpx;
                const statusReserve = 92 * rpx;
                const availableHeight = Math.max(128 * rpx, rootHeight - playStageBottom - stageTop - statusReserve);
                const cardWidth = Math.max(128 * rpx, Math.min(
                    Math.max(128 * rpx, width - 116 * rpx),
                    availableHeight / 1.4,
                    390 * rpx
                ));
                this.setData({
                    playStageTopPx: Math.round(stageTop),
                    stageBottomPx: Math.round(stageBottom),
                    playStageBottomPx: Math.round(playStageBottom),
                    cardWidthPx: Math.round(cardWidth),
                    cardHeightPx: Math.round(cardWidth * 1.4)
                });
            };
            update();
            wx.nextTick(() => {
                if (!this._isAttached) return;
                this.createSelectorQuery()
                    .select('.coward-root')
                    .boundingClientRect((rect) => update(rect && rect.height))
                    .exec();
            });
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
            if (!this._isAttached) return;
            let info = {};
            try { info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (error) {}
            const height = info.windowHeight || 667;
            const playerCount = Math.max(1, Number(count) || 1);
            const dockHeight = Math.max(210, Math.min(340, height * 0.48));
            const countCap = playerCount >= 6 ? 32 : (playerCount === 5 ? 35 : (playerCount === 4 ? 38 : 44));
            const avatarSize = Math.max(30, Math.min(countCap, (dockHeight - Math.max(0, playerCount - 1) * 8) / playerCount));
            this.setData({ ...this._getPlayerLayout(count), skillAvatarSizePx: Number(avatarSize.toFixed(1)) });
        },

        async _fetchOpenId() {
            const app = getApp();
            let openId = app.globalData.openId || '';
            if (!openId) {
                try {
                    const response = await wx.cloud.callFunction({ name: 'login' });
                    openId = response.result && response.result.openid || '';
                    if (openId) app.globalData.openId = openId;
                } catch (error) {}
            }
            if (!this._isAttached || !openId) return;
            this.setData({ myOpenId: openId });
            this._prepareRoomEntry();
        },

        _prepareRoomEntry() {
            if (!this._isAttached || !this._isVisible || !this.data.myOpenId || this.data.isOnlineMode) return;
            if (this._backgroundLeavePromise || this._resumeFreshRoom) return;
            const sharedHostId = this._pendingHostId || this.data.shareHostId;
            if (sharedHostId) return this._tryJoinSharedRoom();
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
                return { title: this._text('shareTitle', '胆小鬼｜先喊停的先干杯'), path: '/pages/profile/index?game=coward', imageUrl: '/logo.png' };
            }
            if (!this.data.isOnlineMode) this._createRoom(hostId);
            return {
                title: this._text('shareTitle', '胆小鬼｜先喊停的先干杯'),
                path: '/pages/profile/index?game=coward&hostId=' + encodeURIComponent(hostId),
                imageUrl: '/logo.png'
            };
        },

        buildTimelineMessage() {
            return { title: this._text('timelineTitle', '胆小鬼｜觉得最小你就按'), imageUrl: '/logo.png' };
        },

        _tryJoinSharedRoom() {
            const hostId = this._pendingHostId || this.data.shareHostId;
            if (!this._isAttached || !this._isVisible || !hostId || !this.data.myOpenId || this._joining) return;
            if (this._backgroundLeavePromise || this._resumeFreshRoom) return;
            if (this.data.isOnlineMode && this._roomShareHostId === hostId) return;
            this._roomShareHostId = hostId;
            if (hostId === this.data.myOpenId) this._createRoom(hostId);
            else this._joinRoom(hostId);
        },

        async _createRoom(hostIdValue, silent) {
            const hostId = hostIdValue || this.data.myOpenId;
            if (!hostId || this._creating || this.data.isOnlineMode) return;
            const entryGeneration = Number(this._entryGeneration || 0);
            const requestConnectionId = this._connectionId;
            this._roomShareHostId = hostId;
            this._creating = true;
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: 'createByHost', hostId: hostId, gameType: 'coward', connectionId: requestConnectionId }
                });
                const result = response.result || {};
                if (!result.success || !result.room) throw new Error(result.error || this._text('createFailed', '创建房间失败'));
                if (!this._isAttached || !this._isVisible || entryGeneration !== Number(this._entryGeneration || 0)) {
                    this._leaveRoom({
                        roomId: result.room.roomId,
                        isHost: true,
                        connectionId: requestConnectionId,
                        shareHostId: hostId
                    }, true);
                    return;
                }
                this._applyRoom(result.room, true, result.roomDocId);
                if (!silent) wx.showToast({ title: this._text('roomCreated', '房间已创建'), icon: 'success' });
            } catch (error) {
                if (this._isAttached) wx.showToast({ title: error.message || this._text('createFailed', '创建房间失败'), icon: 'none' });
            } finally {
                this._creating = false;
                if (this._isAttached && this._isVisible && entryGeneration !== Number(this._entryGeneration || 0)) {
                    wx.nextTick(() => this._prepareRoomEntry());
                }
            }
        },

        async _joinRoom(hostId) {
            if (this._joining) return;
            const entryGeneration = Number(this._entryGeneration || 0);
            const requestConnectionId = this._connectionId;
            this._roomShareHostId = hostId;
            this._joining = true;
            wx.showLoading({ title: this._text('joiningRoom', '加入房间中…') });
            let joined = false;
            let message = '';
            try {
                for (let attempt = 0; attempt < 4 && !joined; attempt++) {
                    const response = await wx.cloud.callFunction({
                        name: 'roomManager',
                        data: { action: 'joinByHost', hostId: hostId, gameType: 'coward', connectionId: requestConnectionId }
                    });
                    const result = response.result || {};
                    if (result.success && result.room) {
                        if (!this._isAttached || !this._isVisible || entryGeneration !== Number(this._entryGeneration || 0)) {
                            this._leaveRoom({
                                roomId: result.room.roomId,
                                isHost: result.isHost === true,
                                connectionId: requestConnectionId,
                                shareHostId: hostId
                            }, true);
                        } else {
                            this._applyRoom(result.room, result.isHost, result.roomDocId);
                        }
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
            if (!this._isVisible || entryGeneration !== Number(this._entryGeneration || 0)) {
                if (this._isVisible) wx.nextTick(() => this._prepareRoomEntry());
                return;
            }
            wx.showToast({ title: joined ? this._text('joinedRoom', '已加入房间') : (message || this._text('joinFailed', '加入房间失败')), icon: joined ? 'success' : 'none' });
        },

        _applyRoom(room, isHost, docId) {
            const members = room && room.members || [];
            const me = members.find((member) => member.openId === this.data.myOpenId);
            const nextDocId = docId || room._id || '';
            const authorityChanged = (this.data.roomId && this.data.roomId !== room.roomId) ||
                (this.data.roomDocId && nextDocId && this.data.roomDocId !== nextDocId);
            if (authorityChanged) {
                this._resetRoomScopedAuthority();
                this._presenceDocId = '';
            }
            this.setData({
                roomId: room.roomId,
                roomDocId: nextDocId,
                roomMembers: members,
                onlineCount: Math.max(1, members.length),
                isOnlineMode: true,
                isHost: me ? me.isHost === true : isHost === true
            });
            const app = getApp();
            const reenter = app.globalData._reenteringCowardRoom;
            if (reenter && (reenter.roomId === room.roomId || reenter.roomId === this._roomShareHostId)) {
                // 共享页已完成接管；之后真正进入后台时不能再被“页面重入”标记误判。
                app.globalData._reenteringCowardRoom = null;
            }
            this._debug('房间数据已就绪', {
                '房间文档': docId || room._id || '未知',
                '成员数': members.length,
                '本人': this._debugPlayer(this.data.myOpenId),
                '是否房主': me ? me.isHost === true : isHost === true
            });
            this._preloadRoomMemberAvatars(members);
            this._applyState(room.gameState || {});
            this._startWatch(room.roomId);
            this._startHeartbeat();
        },

        _startWatch(roomId, restart) {
            if (!roomId || this._watchStarting || !this._isVisible) return;
            if (!restart && this._watcher && this._watchRoomId === roomId) {
                if (this._watchHealthy) this._schedulePresenceWatchStart(roomId);
                return;
            }
            this._watchStarting = true;
            this._watchHealthy = false;
            const generation = Number(this._watchGeneration || 0) + 1;
            this._watchGeneration = generation;
            if (this._watcher) { try { this._watcher.close(); } catch (error) {} }
            this._watcher = null;
            this._watchRoomId = '';
            try {
                const database = this._database || wx.cloud.database();
                this._watcher = database.collection('GameRoom').where({ roomId: roomId }).watch({
                    onChange: (snapshot) => {
                        if (!this._isAttached || generation !== this._watchGeneration || this.data.roomId !== roomId) return;
                        const room = snapshot.docs && snapshot.docs[0];
                        if (!room) return this._confirmRoomClosed(roomId);
                        this._watchAttempt = 0;
                        this._watchHealthy = true;
                        this._onRoomUpdate(room);
                        // 首次快照的回调仍处于 GameRoom watch 的登录收尾阶段，不能在
                        // 同一调用栈里立刻创建第二个 watch，否则会撞上 WACloud 登录 FSM。
                        this._schedulePresenceWatchStart(roomId);
                    },
                    onError: (error) => {
                        if (this.data.roomId !== roomId || generation !== this._watchGeneration) return;
                        this._watchHealthy = false;
                        this._debugError('房间权威状态监听失败', error, {
                            '集合': 'GameRoom',
                            '操作': 'database.watch',
                            '监听代次': generation
                        });
                        this._watcher = null;
                        this._watchRoomId = '';
                        // 两条 watch 共用底层 WebSocket。GameRoom 单路失败时不要主动
                        // close 仍可能健康的 Presence watcher，否则会把共享连接推入
                        // CLOSED，并让紧接着的重连继续报 -402002。
                        this._recoverRoomSnapshot(roomId);
                        this._scheduleReconnect(roomId);
                    }
                });
                this._watchRoomId = roomId;
            } catch (error) {
                this._watchHealthy = false;
                this._debugError('创建房间权威状态监听失败', error, {
                    '集合': 'GameRoom',
                    '操作': 'database.watch',
                    '监听代次': generation
                });
                this._watcher = null;
                this._watchRoomId = '';
                this._recoverRoomSnapshot(roomId);
                this._scheduleReconnect(roomId);
            }
            this._watchStarting = false;
        },

        _scheduleReconnect(roomId) {
            if (this._reconnectTimer || !this._isAttached || !this._isVisible) return;
            const attempt = Math.min(6, Number(this._watchAttempt || 0) + 1);
            this._watchAttempt = attempt;
            const delay = Math.min(WATCH_RECONNECT_MAX_MS, WATCH_RECONNECT_BASE_MS * Math.pow(2, attempt - 1));
            this._reconnectTimer = setTimeout(() => {
                this._reconnectTimer = null;
                if (this.data.roomId === roomId) this._startWatch(roomId, true);
            }, delay);
        },

        _schedulePresenceWatchStart(roomId) {
            if (!roomId || this._presenceWatcher || this._presenceStartTimer ||
                !this._isAttached || !this._isVisible || !this._watchHealthy) return;
            this._presenceStartTimer = setTimeout(() => {
                this._presenceStartTimer = null;
                if (this.data.roomId === roomId && this._watchHealthy) {
                    this._startPresenceWatch(roomId);
                }
            }, 480);
        },

        async _recoverRoomSnapshot(roomId) {
            if (!roomId || this._roomRecoveryInFlight || !this._isAttached || !this._isVisible ||
                this.data.roomId !== roomId) return;
            this._roomRecoveryInFlight = true;
            const generation = Number(this._roomRecoveryGeneration || 0);
            try {
                const database = this._database || wx.cloud.database();
                const result = await database.collection('GameRoom').where({ roomId: roomId }).limit(1).get();
                const room = result.data && result.data[0];
                if (!this._isAttached || !this._isVisible || this.data.roomId !== roomId ||
                    generation !== Number(this._roomRecoveryGeneration || 0)) return;
                if (room) this._onRoomUpdate(room);
                else this._confirmRoomClosed(roomId);
            } catch (error) {
                this._debugError('房间监听断开后的一次性权威快照恢复失败', error, {
                    '集合': 'GameRoom',
                    '操作': 'database.get'
                });
            } finally {
                if (generation === Number(this._roomRecoveryGeneration || 0)) {
                    this._roomRecoveryInFlight = false;
                    const pendingSignal = this._pendingCowardStartSignal;
                    this._pendingCowardStartSignal = null;
                    if (pendingSignal && this._isAttached && this._isVisible) {
                        wx.nextTick(() => this._consumeCowardStartSignal(
                            [pendingSignal], this._latestState || {}
                        ));
                    }
                }
            }
        },

        async _recoverPresenceSnapshot(roomId) {
            if (!roomId || this._presenceRecoveryInFlight || !this._isAttached || !this._isVisible ||
                this.data.roomId !== roomId) return;
            this._presenceRecoveryInFlight = true;
            const generation = Number(this._presenceRecoveryGeneration || 0);
            try {
                const database = this._database || wx.cloud.database();
                const result = await database.collection('TenHalfPresence').where({ roomId: roomId }).limit(20).get();
                if (!this._isAttached || !this._isVisible || this.data.roomId !== roomId ||
                    generation !== Number(this._presenceRecoveryGeneration || 0)) return;
                this._onPresenceDocs(result.data || []);
            } catch (error) {
                this._debugError('Presence监听断开后的一次性快照恢复失败', error, {
                    '集合': 'TenHalfPresence',
                    '操作': 'database.get'
                });
            } finally {
                if (generation === Number(this._presenceRecoveryGeneration || 0)) {
                    this._presenceRecoveryInFlight = false;
                }
            }
        },

        _requestMemberReconcile(reason) {
            const roomId = this.data.roomId;
            if (!roomId || !this._isAttached || !this._isVisible) return;
            const now = Date.now();
            // 只在“Presence/本轮玩家数已经证明 members 缺人”时触发一次直读，
            // 不建立轮询；短时间内的多个 Presence 变更合并成一次读取。
            if (now - Number(this._lastMemberReconcileAt || 0) < 1800) return;
            this._lastMemberReconcileAt = now;
            this._debug('检测到成员快照缺失，直接校准一次房间成员', {
                '原因': reason || '成员数量不一致',
                '当前成员数': (this.data.roomMembers || []).length
            });
            this._recoverRoomSnapshot(roomId);
        },

        _publishCowardStartSignal(state) {
            const current = state || {};
            if (!this.data.roomId || current.phase !== 'playing' || !current.roundToken) return;
            const signal = {
                roundToken: current.roundToken,
                stateRevision: this._stateRevision(current),
                roomDocId: this.data.roomDocId || '',
                connectionId: this._connectionId
            };
            // 不等待这次直写，不阻塞发起者进入牌面。它只负责通知漏掉 GameRoom
            // 变更的设备做一次权威直读，不承载游戏结果，也不新增云函数调用。
            this._updateOwnPresence((database) => ({
                cowardStartSignalRoundToken: signal.roundToken,
                cowardStartSignalRevision: signal.stateRevision,
                cowardStartSignalRoomDocId: signal.roomDocId,
                cowardStartSignalConnectionId: signal.connectionId,
                cowardStartSignalAt: database.serverDate()
            }), '开局同步信号直写').catch((error) => {
                this._debugError('开局同步信号直写失败', error, {
                    '集合': 'TenHalfPresence',
                    '操作': 'database.update/add',
                    '目标轮次': signal.roundToken
                });
            });
        },

        _consumeCowardStartSignal(docs, state) {
            const current = state || this._latestState || {};
            const roomDocId = this.data.roomDocId || '';
            const now = Date.now();
            const signal = (docs || []).filter((item) => {
                if (!item || !item._openid || !item.cowardStartSignalRoundToken) return false;
                if (!item.cowardStartSignalConnectionId ||
                    item.cowardStartSignalConnectionId !== item.connectionId) return false;
                if (roomDocId && item.cowardStartSignalRoomDocId &&
                    item.cowardStartSignalRoomDocId !== roomDocId) return false;
                return now - this._presenceTime(item.cowardStartSignalAt) <= 30000;
            }).sort((first, second) =>
                Number(second.cowardStartSignalRevision || 0) - Number(first.cowardStartSignalRevision || 0) ||
                this._presenceTime(second.cowardStartSignalAt) - this._presenceTime(first.cowardStartSignalAt)
            )[0];
            if (!signal) return;
            const signalRevision = Number(signal.cowardStartSignalRevision || 0);
            const signalToken = signal.cowardStartSignalRoundToken || '';
            const localRevision = this._stateRevision(current);
            const needsSync = current.phase === 'waiting' ||
                signalRevision > localRevision ||
                (current.phase === 'playing' && signalToken !== current.roundToken);
            if (!needsSync) return;
            const signalKey = String(signal.cowardStartSignalRoomDocId || roomDocId) + ':' +
                String(signal.cowardStartSignalConnectionId || '') + ':' + signalToken + ':' + signalRevision;
            if (this._lastCowardStartSignalKey === signalKey) return;
            if (this._roomRecoveryInFlight) {
                // 已有一次权威读取在路上时不并发再读；等它完成后用同一个信号
                // 重新判断，避免事务提交前发出的旧读取吞掉这次开局通知。
                this._pendingCowardStartSignal = signal;
                return;
            }
            this._lastCowardStartSignalKey = signalKey;
            this._debug('收到开局同步信号，校准一次权威阶段', {
                '信号轮次': signalToken,
                '信号版本': signalRevision,
                '本地阶段': current.phase || '未知',
                '本地版本': localRevision
            });
            this._recoverRoomSnapshot(this.data.roomId);
        },

        async _loadOwnHandForRevision(roundToken, expectedRevision) {
            const roomId = this.data.roomId;
            const myOpenId = this.data.myOpenId;
            const revision = Math.max(0, Number(expectedRevision) || 0);
            if (!roomId || !myOpenId || !roundToken || !this._isAttached || !this._isVisible) return;
            const requestKey = roomId + ':' + roundToken + ':' + revision;
            this._handReadRequests = this._handReadRequests || {};
            if (this._handReadRequests[requestKey]) return;
            this._handReadRequests[requestKey] = true;
            this._debug('公开手牌版本变化，直读本人私密手牌', {
                '集合': 'CowardHand',
                '操作': 'database.get',
                '本轮': roundToken,
                '期望版本': revision
            });
            try {
                const result = await wx.cloud.database().collection('CowardHand').where({
                    roomId: roomId,
                    ownerOpenId: myOpenId
                }).limit(1).get();
                const hand = result.data && result.data[0];
                const current = this._latestState || {};
                if (!this._isAttached || !this._isVisible || this.data.roomId !== roomId ||
                    current.phase !== 'playing' || current.roundToken !== roundToken) return;
                if (!hand || hand.roomId !== roomId || hand.ownerOpenId !== myOpenId ||
                    hand.roundToken !== roundToken || !hand.card) {
                    throw new Error('本人私密手牌与当前轮次不一致');
                }
                const actualRevision = Math.max(0, Number(hand.cardRevision) || 0);
                if (actualRevision < revision) throw new Error('本人私密手牌版本落后于公开状态');
                this._debug('本人私密手牌直读完成', {
                    '集合': 'CowardHand',
                    '本轮': roundToken,
                    '期望版本': revision,
                    '实际版本': actualRevision
                });
                this._onCowardHandUpdate(hand);
            } catch (error) {
                this._debugError('本人私密手牌直读失败', error, {
                    '集合': 'CowardHand',
                    '操作': 'database.get',
                    '本轮': roundToken,
                    '期望版本': revision
                });
            } finally {
                delete this._handReadRequests[requestKey];
            }
        },

        _onCowardHandUpdate(hand) {
            if (!hand || hand.roomId !== this.data.roomId || hand.ownerOpenId !== this.data.myOpenId || !hand.roundToken || !hand.card) return;
            const revision = Math.max(0, Number(hand.cardRevision) || 0);
            this._debug('已校验本人私密手牌文档', {
                '集合': 'CowardHand',
                '手牌轮次': hand.roundToken,
                '手牌版本': revision,
                '是否当前轮': hand.roundToken === (this._latestState && this._latestState.roundToken)
            });
            const cached = this._pendingHandsByRoundToken[hand.roundToken];
            if (!cached || revision >= Number(cached.cardRevision || 0)) {
                this._pendingHandsByRoundToken[hand.roundToken] = {
                    roundToken: hand.roundToken,
                    card: hand.card,
                    cardRevision: revision
                };
            }
            this._consumeCowardHand(hand.roundToken);
        },

        _consumeCowardHand(roundToken) {
            const hand = this._pendingHandsByRoundToken[roundToken];
            const state = this._latestState || {};
            if (!hand || !this._isAttached || !this._isVisible || state.phase !== 'playing' ||
                state.roundToken !== roundToken || this._activeRoundToken !== roundToken || !this.data.isPlayer) return;
            const displayKey = roundToken + ':' + Number(hand.cardRevision || 0);
            if (this._displayedHandKey === displayKey) return;
            this._displayedHandKey = displayKey;
            const hasCurrentCard = !!this.data.myCard;
            const isSwap = hasCurrentCard && Number(hand.cardRevision || 0) > Number(this._activeCardRevision || 0);
            this._activeCardRevision = Number(hand.cardRevision || 0);
            if (isSwap) this._showSwappedCard(roundToken, hand.card);
            else this._showOwnCard(roundToken, hand.card, hand.cardRevision);
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
            if (!room || room.gameType !== 'coward') return;
            const incomingDocId = room._id || '';
            const authorityChanged = !!(this.data.roomDocId && incomingDocId && this.data.roomDocId !== incomingDocId);
            if (authorityChanged) this._resetRoomScopedAuthority();
            const members = room.members || [];
            const me = members.find((member) => member.openId === this.data.myOpenId);
            if (this.data.myOpenId && !me) {
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
                isHost: !!(me && me.isHost)
            });
            this._preloadRoomMemberAvatars(members);
            // 成员列表与游戏状态并不是同一条业务版本线。比如好友刚加入时，
            // host 可能已先从 START 响应拿到较新的 gameState；此时仍必须接收
            // watch 里较旧 gameState 所携带的最新 members，否则人数会永久停在1、
            // 新玩家头像也无法进入预加载。只丢弃旧游戏状态，不丢弃成员快照。
            if (!authorityChanged && this._latestState &&
                this._stateRevision(room.gameState) < this._stateRevision(this._latestState)) {
                // 用现有权威游戏状态重建一次玩家视图，让新成员的昵称和头像立即生效。
                this._applyState(this._latestState, true);
                return;
            }
            this._applyState(room.gameState || {});
        },

        _playerName(openId, state) {
            const player = (state.players || []).find((item) => item.openId === openId);
            const fallbackName = player
                ? this._format('playerName', '玩家{seat}', { seat: player.seat })
                : this._text('unknownPlayer', '玩家');
            return realtimePlayerProfile.getMemberProfile(this.data.roomMembers, openId, fallbackName).nickname;
        },

        _preloadPlayerAvatars(playerViews) {
            const roomId = this.data.roomId;
            const sources = Array.from(new Set((playerViews || [])
                .map((player) => player.avatarSourceUrl || '')
                .filter(Boolean)));
            if (!roomId || !sources.length) return;
            cowardAvatarCache.preloadAvatars(sources).then(() => {
                if (!this._isAttached || !this._isVisible || this.data.roomId !== roomId) return;
                let changed = false;
                const nextViews = (this.data.playerViews || []).map((player) => {
                    const nextAvatarUrl = cowardAvatarCache.getCachedAvatarPath(player.avatarSourceUrl || player.avatarUrl);
                    if (!nextAvatarUrl || nextAvatarUrl === player.avatarUrl) return player;
                    changed = true;
                    return { ...player, avatarUrl: nextAvatarUrl };
                });
                if (changed) this.setData({ playerViews: nextViews });
            }).catch(() => {});
        },

        _preloadRoomMemberAvatars(members) {
            const sources = Array.from(new Set((members || [])
                .map((member) => member && member.avatarUrl || '')
                .filter(Boolean)));
            if (!sources.length) return;
            const startedAt = Date.now();
            this._debug('开始批量预加载玩家头像', { '头像数量': sources.length });
            cowardAvatarCache.preloadAvatars(sources).then(() => {
                this._debug('玩家头像预加载完成', {
                    '头像数量': sources.length,
                    '耗时毫秒': Date.now() - startedAt
                });
                if (this._isAttached && this._isVisible && this.data.playerViews.length) {
                    this._preloadPlayerAvatars(this.data.playerViews);
                }
            }).catch((error) => {
                this._debugError('玩家头像预加载失败', error, { '头像数量': sources.length });
            });
        },

        _applyState(rawState, force) {
            const state = rawState && rawState.gameKind === 'coward'
                ? rawState
                : { gameKind: 'coward', phase: 'waiting', version: 0, players: [], playerOrder: [] };
            if (!force && this._latestState && this._stateRevision(state) < this._stateRevision(this._latestState)) return;
            this._latestState = state;
            const phase = state.phase || 'waiting';
            const roundToken = state.roundToken || '';
            const newRound = phase === 'playing' && roundToken && roundToken !== this._activeRoundToken;
            const isPlayer = (state.playerOrder || []).includes(this.data.myOpenId);
            if ((state.playerOrder || []).length > (this.data.roomMembers || []).length) {
                this._requestMemberReconcile('本轮玩家数大于本地成员数');
            }
            const ownPublicPlayer = (state.players || []).find((player) => player.openId === this.data.myOpenId);
            const ownCardRevision = Math.max(0, Number(ownPublicPlayer && ownPublicPlayer.cardRevision) || 0);
            const playerViews = (state.players || []).map((player) => {
                const fallbackName = this._format('playerName', '玩家{seat}', { seat: player.seat });
                const profile = realtimePlayerProfile.getMemberProfile(this.data.roomMembers, player.openId, fallbackName);
                const sourceAvatarUrl = profile.avatarUrl || '';
                return {
                    ...player,
                    name: profile.nickname,
                    avatarSourceUrl: sourceAvatarUrl,
                    avatarUrl: cowardAvatarCache.getCachedAvatarPath(sourceAvatarUrl),
                    isMe: player.openId === this.data.myOpenId
                };
            });
            const loserOpenId = (state.loserOpenIds || [])[0] || '';
            const drinkCount = Math.max(0, Math.min(100, Number(state.resultDrinkCount || 0)));
            const resultAcknowledged = phase === 'result' && (
                this._isCowardReady(this.data.myOpenId, roundToken) ||
                this._readyRequestToken === roundToken
            );
            const resultMain = loserOpenId
                ? (loserOpenId === this.data.myOpenId
                    ? this._format('youDrink', '你 喝 {count}口', { count: drinkCount })
                    : this._format('otherDrink', '{name} 喝 {count}口', { name: this._playerName(loserOpenId, state), count: drinkCount }))
                : '';
            const presenceSkillUsed = !!(this._presenceCowardSkill &&
                this._presenceCowardSkill.roundToken === roundToken &&
                this._presenceCowardSkill.used);
            const skillUsed = (state.skillUsedOpenIds || []).includes(this.data.myOpenId) || presenceSkillUsed;
            const patch = {
                gamePhase: phase,
                gameVersion: Number(state.version || 0),
                roundToken: roundToken,
                isPlayer: isPlayer,
                isSpectator: phase !== 'waiting' && !isPlayer,
                playerViews: playerViews,
                resultTitle: state.resultReason === 'timeout'
                    ? this._text('timeoutResultTitle', '这把没人喊停')
                    : this._text('resultTitle', '这把有人怂了'),
                resultMain: resultMain,
                resultAcknowledged: resultAcknowledged,
                stopEnabled: false,
                isActing: false,
                skillUsed: skillUsed,
                skillMenuLevel: skillUsed || phase !== 'playing' ? 'closed' : this.data.skillMenuLevel,
                alcoholValue: phase === 'playing' ? this._currentAlcohol(state) : drinkCount
            };
            if (phase === 'waiting') {
                this._activeRoundToken = '';
                this._displayedHandKey = '';
                this._clearReadyAdvanceTimer();
                patch.myCard = null;
                patch.cardRevealed = false;
                patch.isCardSwapping = false;
                patch.isSwapFlipping = false;
                patch.timelinePhase = 'reveal';
                patch.countdownValue = '';
                patch.statusText = '';
                patch.skillUsed = false;
                patch.skillMenuLevel = 'closed';
                patch.skillSubmitting = false;
            } else if (newRound) {
                this._activeRoundToken = roundToken;
                this._activeCardRevision = -1;
                this._displayedHandKey = '';
                this._timeoutRequestToken = '';
                this._cardRequestToken = '';
                this._stopRequestToken = '';
                this._readyRequestToken = '';
                this._advanceRequestToken = '';
                this._advanceRetryCount = 0;
                patch.myCard = null;
                patch.cardRevealed = false;
                patch.isDealing = true;
                patch.isCardSwapping = false;
                patch.isSwapFlipping = false;
                patch.timelinePhase = 'reveal';
                patch.countdownValue = '';
                patch.statusText = this._text('dealing', '正在发牌');
                patch.alcoholValue = 0;
                patch.skillUsed = false;
                patch.skillMenuLevel = 'closed';
                patch.skillSubmitting = false;
                this._clearReadyAdvanceTimer();
            }
            this.setData(patch, () => {
                this._updatePlayerLayout(playerViews.length);
                this._preloadPlayerAvatars(playerViews);
                if (phase === 'playing') {
                    if (isPlayer) {
                        const expectedHandKey = roundToken + ':' + ownCardRevision;
                        if (newRound || this._displayedHandKey !== expectedHandKey) {
                            this._loadOwnHandForRevision(roundToken, ownCardRevision);
                        }
                    }
                    this._startTimeline();
                } else {
                    this._clearTimeline();
                    if (phase === 'result') this._evaluateCowardReady(roundToken);
                }
            });
        },

        _calibrateServerTime(serverTime, startedAt, finishedAt) {
            const server = Number(serverTime);
            const finished = Number(finishedAt);
            if (!server || !finished) return;
            // roomManager 的 serverTime 是在事务完成、返回响应前生成的，不能使用整次请求的
            // 中点校时；云函数若执行 8～10 秒，中点算法会凭空把调用者时钟拨快 4～5 秒。
            // 以响应抵达时刻作锚点，只保留网络回程的微小误差，所有玩家的倒计时与酒量基线才一致。
            const nextOffset = server - finished;
            if (!Number.isFinite(nextOffset)) return;
            this._serverOffsetMs = nextOffset;
            this._debug('已按云函数响应尾部校准房间时钟', {
                '请求耗时毫秒': Math.max(0, finished - Number(startedAt || finished)),
                '时钟偏移毫秒': Math.round(nextOffset)
            });
        },

        _serverNow() {
            return Date.now() + Number(this._serverOffsetMs || 0);
        },

        _currentAlcohol(stateValue, nowValue) {
            const state = stateValue || this._latestState || {};
            const startAt = Number(state.stopUnlockAt || 0);
            const deadlineAt = Number(state.stopDeadlineAt || 0);
            if (!startAt) return 0;
            const currentTime = Math.min(Number(nowValue || this._serverNow()), deadlineAt || Number(nowValue || this._serverNow()));
            const base = Math.floor(Math.max(0, currentTime - startAt) / 2000);
            const presences = Object.values(this._presenceByOpenId || {});
            if (this._presenceCowardSkill && this._presenceCowardSkill.roundToken === state.roundToken &&
                !presences.some((item) => item && item._openid === this.data.myOpenId &&
                    item.cowardRoundToken === state.roundToken && item.cowardSkillUsed)) {
                presences.push({
                    _openid: this.data.myOpenId,
                    cowardRoundToken: state.roundToken,
                    cowardSkillUsed: true,
                    cowardSkillType: this._presenceCowardSkill.skillType,
                    cowardAlcoholDelta: this._presenceCowardSkill.delta,
                    cowardSkillUsedAt: this._presenceCowardSkill.usedAt
                });
            }
            const events = presences
                .filter((item) => item && item.cowardRoundToken === state.roundToken && item.cowardSkillUsed &&
                    (item.cowardSkillType === 'alcoholPlus' || item.cowardSkillType === 'alcoholMinus'))
                .map((item) => ({
                    openId: item._openid || '',
                    at: this._presenceTime(item.cowardSkillUsedAt),
                    delta: Number.isFinite(Number(item.cowardAlcoholDelta))
                        ? Number(item.cowardAlcoholDelta)
                        : (item.cowardSkillType === 'alcoholPlus' ? 10 : -10)
                }))
                .sort((first, second) => first.at - second.at || String(first.openId).localeCompare(String(second.openId)));
            let adjustment = 0;
            events.forEach((event) => {
                const eventTime = Math.max(startAt, Math.min(event.at || startAt, deadlineAt || event.at || startAt));
                const eventBase = Math.floor(Math.max(0, eventTime - startAt) / 2000);
                const before = Math.max(0, Math.min(100, eventBase + adjustment));
                const after = Math.max(0, Math.min(100, before + event.delta));
                adjustment = after - eventBase;
            });
            return Math.max(0, Math.min(100, base + adjustment));
        },

        _presenceTime(value) {
            if (value instanceof Date) return value.getTime();
            if (value && typeof value === 'object' && value.$date !== undefined) return Number(value.$date) || 0;
            if (typeof value === 'string') return Date.parse(value) || Number(value) || 0;
            return Number(value) || 0;
        },

        _showOwnCard(roundToken, card, revision) {
            if (!this._isAttached || this._activeRoundToken !== roundToken || !card) return;
            this._cardRequestToken = roundToken;
            if (Number.isFinite(Number(revision))) {
                this._activeCardRevision = Number(revision);
                this._displayedHandKey = roundToken + ':' + Number(revision);
            }
            const shouldReveal = this.data.timelinePhase !== 'reveal';
            this.setData({ myCard: card, isDealing: true, cardRevealed: shouldReveal });
            if (this._dealTimer) clearTimeout(this._dealTimer);
            this._dealTimer = setTimeout(() => {
                this._dealTimer = null;
                if (this._isAttached && this._activeRoundToken === roundToken) this.setData({ isDealing: false });
            }, 720);
        },

        _showSwappedCard(roundToken, card) {
            if (!this._isAttached || this._activeRoundToken !== roundToken || !card) return;
            this._debug('收到换牌结果，开始560ms本地翻牌动画', {
                '手牌轮次': roundToken,
                '手牌版本': Number(this._activeCardRevision || 0)
            });
            if (this._swapMidpointTimer) clearTimeout(this._swapMidpointTimer);
            if (this._swapAnimationTimer) clearTimeout(this._swapAnimationTimer);
            this.setData({ cardRevealed: true, isCardSwapping: true, isSwapFlipping: false }, () => {
                wx.nextTick(() => {
                    if (!this._isAttached || this._activeRoundToken !== roundToken) return;
                    this.setData({ isSwapFlipping: true });
                    this._swapMidpointTimer = setTimeout(() => {
                        this._swapMidpointTimer = null;
                        if (this._isAttached && this._activeRoundToken === roundToken) this.setData({ myCard: card });
                    }, 280);
                    this._swapAnimationTimer = setTimeout(() => {
                        this._swapAnimationTimer = null;
                        if (this._isAttached && this._activeRoundToken === roundToken) {
                            this.setData({ isCardSwapping: false, isSwapFlipping: false, cardRevealed: true });
                            this._debug('换牌动画完成', {
                                '手牌轮次': roundToken,
                                '动画耗时毫秒': 560
                            });
                        }
                    }, 560);
                });
            });
        },

        flipCard() {
            if (this.data.gamePhase !== 'playing') return;
            if (!this.data.myCard) {
                this._debug('点击牌面时手牌监听尚未收到当前轮文档', {
                    '集合': 'CowardHand',
                    '目标轮次': this.data.roundToken
                });
                return;
            }
            if (!this.data.cardRevealed) {
                this.setData({ cardRevealed: true });
                try { wx.vibrateShort({ type: 'light' }); } catch (error) {}
            }
        },

        _startTimeline() {
            this._clearTimeline();
            this._updateTimeline();
            this._timelineTimer = setInterval(() => this._updateTimeline(), 120);
        },

        _clearTimeline() {
            if (this._timelineTimer) clearInterval(this._timelineTimer);
            if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
            this._timelineTimer = null;
            this._timeoutTimer = null;
        },

        _updateTimeline() {
            const state = this._latestState || {};
            if (!this._isAttached || state.phase !== 'playing' || state.roundToken !== this._activeRoundToken) return;
            const now = this._serverNow();
            const countdownStartedAt = Number(state.countdownStartedAt || 0);
            const stopUnlockAt = Number(state.stopUnlockAt || 0);
            const stopDeadlineAt = Number(state.stopDeadlineAt || 0);
            if (now < countdownStartedAt) {
                this.setData({
                    timelinePhase: 'reveal',
                    countdownValue: '',
                    stopEnabled: false,
                    statusText: this.data.cardRevealed ? this._text('rememberCard', '记住你的牌') : this._text('flipHint', '点击翻牌，看清你的底牌')
                });
                return;
            }
            if (now < stopUnlockAt) {
                const value = Math.max(1, Math.ceil((stopUnlockAt - now) / 1000));
                this.setData({
                    timelinePhase: 'countdown',
                    countdownValue: String(value),
                    stopEnabled: false,
                    cardRevealed: !!this.data.myCard,
                    statusText: this._text('getReady', '手先别抖')
                });
                return;
            }
            if (now < stopDeadlineAt) {
                const value = Math.max(1, Math.ceil((stopDeadlineAt - now) / 1000));
                this.setData({
                    timelinePhase: 'stopping',
                    countdownValue: String(value),
                    stopEnabled: this.data.isPlayer && !this.data.isActing && !this.data.skillSubmitting && this._stopRequestToken !== state.roundToken,
                    cardRevealed: !!this.data.myCard,
                    statusText: this._text('stopWindow', '觉得自己最小？按停或使用技能'),
                    alcoholValue: this._currentAlcohol(state, now)
                });
                return;
            }
            this.setData({
                timelinePhase: 'settling',
                countdownValue: '0',
                stopEnabled: false,
                cardRevealed: !!this.data.myCard,
                statusText: this._text('settling', '正在抓最小的那张牌'),
                skillMenuLevel: 'closed',
                alcoholValue: this._currentAlcohol(state, stopDeadlineAt)
            });
            this._scheduleTimeoutSettlement(state);
        },

        _scheduleTimeoutSettlement(state) {
            const token = state && state.roundToken;
            if (!token || this._timeoutRequestToken === token || this._timeoutTimer || !this.data.isPlayer) return;
            const index = Math.max(0, (state.playerOrder || []).indexOf(this.data.myOpenId));
            const delay = index === 0 ? 40 : 720 + index * 320;
            this._timeoutTimer = setTimeout(() => {
                this._timeoutTimer = null;
                if (!this._isAttached || this._latestState.phase !== 'playing' || this._activeRoundToken !== token) return;
                this._timeoutRequestToken = token;
                wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'cowardTimeout',
                        roomId: this.data.roomId,
                        roomDocId: this.data.roomDocId,
                        roundToken: token
                    }
                }).then((response) => {
                    const result = response.result || {};
                    if (result.tooEarly) {
                        this._timeoutRequestToken = '';
                        return;
                    }
                    if (result.state) this._applyState(result.state);
                }).catch(() => { this._timeoutRequestToken = ''; });
            }, delay);
        },

        async startGame() {
            if (this.data.isStarting || !this.data.isOnlineMode) {
                if (!this.data.isOnlineMode) wx.showToast({ title: this._text('shareFirstToast', '先点右上角分享叫人'), icon: 'none' });
                return;
            }
            this._roundCreationRequestPending = true;
            this.setData({ isStarting: true });
            const requestStartedAt = Date.now();
            this._debug('请求开始胆小鬼新一轮', {
                '云函数': 'roomManager',
                '操作': 'cowardStart'
            });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: 'cowardStart', roomId: this.data.roomId, roomDocId: this.data.roomDocId }
                });
                const result = response.result || {};
                this._calibrateServerTime(result.serverTime, requestStartedAt, Date.now());
                if (!result.success) throw new Error(result.error || this._text('startFailed', '开始失败'));
                this._debug('开始新一轮请求成功', {
                    '操作': 'cowardStart',
                    '耗时毫秒': Date.now() - requestStartedAt,
                    '返回阶段': result.state && result.state.phase || '未知',
                    '返回轮次': result.state && result.state.roundToken || '未知'
                });
                if (result.state) this._applyState(result.state);
                if (result.state && result.state.phase === 'playing') {
                    this._publishCowardStartSignal(result.state);
                }
            } catch (error) {
                this._debugError('开始新一轮请求失败', error, {
                    '云函数': 'roomManager',
                    '操作': 'cowardStart',
                    '耗时毫秒': Date.now() - requestStartedAt
                });
                wx.showToast({ title: error.message || this._text('startFailed', '开始失败'), icon: 'none' });
            } finally {
                this._roundCreationRequestPending = false;
                this.setData({ isStarting: false });
            }
        },

        async stopRound() {
            if (!this.data.stopEnabled || this.data.isActing || !this.data.roundToken || this._stopRequestToken === this.data.roundToken) return;
            const roundToken = this.data.roundToken;
            this._stopRequestToken = roundToken;
            this.setData({ isActing: true, stopEnabled: false });
            const requestStartedAt = Date.now();
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'cowardStop',
                        roomId: this.data.roomId,
                        roomDocId: this.data.roomDocId,
                        roundToken: roundToken
                    }
                });
                const result = response.result || {};
                this._calibrateServerTime(result.serverTime, requestStartedAt, Date.now());
                if (!result.success) throw new Error(result.error || this._text('actionFailed', '手慢了一拍'));
                if (result.tooEarly) {
                    this._stopRequestToken = '';
                    this.setData({ isActing: false });
                    this._updateTimeline();
                    return;
                }
                if (result.state) this._applyState(result.state);
            } catch (error) {
                if (this._latestState && this._latestState.phase === 'playing') {
                    this._stopRequestToken = '';
                    this.setData({ isActing: false });
                    this._updateTimeline();
                    wx.showToast({ title: error.message || this._text('actionFailed', '手慢了一拍'), icon: 'none' });
                }
            }
        },

        openSkillMenu() {
            if (this.data.timelinePhase !== 'stopping' || this.data.skillUsed || this.data.skillSubmitting || !this.data.isPlayer) return;
            this.setData({ skillMenuLevel: 'skills' });
        },

        chooseSkill(event) {
            if (this.data.skillUsed || this.data.skillSubmitting) return;
            const skillType = event.currentTarget.dataset.skill;
            if (skillType === 'swap') {
                this.setData({ skillMenuLevel: 'targets' });
                return;
            }
            if (skillType === 'alcoholPlus' || skillType === 'alcoholMinus') this._submitAlcoholSkill(skillType);
        },

        chooseSwapTarget(event) {
            const targetOpenId = event.currentTarget.dataset.openid || '';
            if (targetOpenId) this._submitSkill('swap', targetOpenId);
        },

        async _submitSkill(skillType, targetOpenId) {
            if (this.data.timelinePhase !== 'stopping' || this.data.skillUsed || this.data.skillSubmitting || !this.data.roundToken) return;
            const roundToken = this.data.roundToken;
            this.setData({ skillSubmitting: true, stopEnabled: false });
            const requestStartedAt = Date.now();
            this._debug('提交换牌技能', {
                '云函数': 'roomManager',
                '操作': 'cowardUseSkill',
                '技能': skillType,
                '目标玩家': this._debugPlayer(targetOpenId)
            });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'cowardUseSkill',
                        roomId: this.data.roomId,
                        roomDocId: this.data.roomDocId,
                        roundToken: roundToken,
                        skillType: skillType,
                        targetOpenId: targetOpenId || ''
                    }
                });
                const result = response.result || {};
                this._calibrateServerTime(result.serverTime, requestStartedAt, Date.now());
                if (!result.success) {
                    if (result.state) this._applyState(result.state);
                    throw new Error(result.error || this._text('skillFailed', '技能发动失败'));
                }
                if (result.stale) {
                    this._debug('换牌请求被判定为旧请求', {
                        '操作': 'cowardUseSkill',
                        '耗时毫秒': Date.now() - requestStartedAt
                    });
                    if (result.state) this._applyState(result.state);
                    this.setData({ skillSubmitting: false, skillMenuLevel: 'closed' });
                    return;
                }
                if (result.state) this._applyState(result.state);
                this._debug('换牌技能云端处理成功，等待目标手牌监听更新', {
                    '操作': 'cowardUseSkill',
                    '目标玩家': this._debugPlayer(targetOpenId),
                    '耗时毫秒': Date.now() - requestStartedAt
                });
                this.setData({ skillMenuLevel: 'closed', skillUsed: true });
            } catch (error) {
                this._debugError('换牌技能请求失败', error, {
                    '云函数': 'roomManager',
                    '操作': 'cowardUseSkill',
                    '目标玩家': this._debugPlayer(targetOpenId),
                    '耗时毫秒': Date.now() - requestStartedAt
                });
                if (this._latestState && this._latestState.phase === 'playing' && this._activeRoundToken === roundToken) {
                    this.setData({ skillSubmitting: false, skillMenuLevel: 'closed' });
                    this._updateTimeline();
                    wx.showToast({ title: error.message || this._text('skillFailed', '技能发动失败'), icon: 'none' });
                }
                return;
            }
            this.setData({ skillSubmitting: false });
        },

        async _submitAlcoholSkill(skillType) {
            if (this.data.timelinePhase !== 'stopping' || this.data.skillUsed || this.data.skillSubmitting || !this.data.roundToken) return;
            const roundToken = this.data.roundToken;
            const state = this._latestState || {};
            const now = this._serverNow();
            const startAt = Number(state.stopUnlockAt || 0);
            const deadlineAt = Number(state.stopDeadlineAt || 0);
            if (!startAt || now < startAt || now >= deadlineAt) return;
            const current = this._currentAlcohol(state, now);
            const delta = skillType === 'alcoholPlus' ? 10 : -10;
            const next = Math.max(0, Math.min(100, current + delta));
            this._debug('提交全房间共享酒量技能', {
                '集合': 'TenHalfPresence',
                '当前全局酒量': current,
                '本次增减': delta,
                '本地预期酒量': next
            });
            this.setData({ skillSubmitting: true, stopEnabled: false });
            try {
                await this._writeCowardSkillPresence({
                    roundToken: roundToken,
                    skillType: skillType,
                    delta: delta
                });
                if (!this._isAttached || this._activeRoundToken !== roundToken || (this._latestState || {}).phase !== 'playing') {
                    if (this._isAttached) this.setData({ skillSubmitting: false, skillMenuLevel: 'closed' });
                    return;
                }
                this._presenceCowardSkill = {
                    roundToken: roundToken,
                    used: true,
                    skillType: skillType,
                    delta: delta,
                    usedAt: this._serverNow()
                };
                this._presenceByOpenId[this.data.myOpenId] = {
                    ...(this._presenceByOpenId[this.data.myOpenId] || {}),
                    _openid: this.data.myOpenId,
                    roomId: this.data.roomId,
                    cowardRoundToken: roundToken,
                    cowardSkillUsed: true,
                    cowardSkillType: skillType,
                    cowardAlcoholDelta: delta,
                    cowardSkillUsedAt: new Date(this._presenceCowardSkill.usedAt)
                };
                this.setData({
                    skillSubmitting: false,
                    skillUsed: true,
                    skillMenuLevel: 'closed',
                    alcoholValue: this._currentAlcohol(state),
                    stopEnabled: this._serverNow() < deadlineAt && !this.data.isActing
                });
            } catch (error) {
                this._debugError('酒量技能状态直写失败', error, {
                    '集合': 'TenHalfPresence',
                    '操作': 'database.update/add',
                    '技能': skillType,
                    '目标轮次': roundToken
                });
                if (this._isAttached && this._activeRoundToken === roundToken) {
                    this.setData({ skillSubmitting: false, skillMenuLevel: 'closed' });
                    this._updateTimeline();
                    wx.showToast({ title: error.message || this._text('skillFailed', '技能发动失败'), icon: 'none' });
                }
            }
        },

        async _writeCowardSkillPresence(skill) {
            return this._updateOwnPresence((database) => ({
                cowardRoundToken: skill.roundToken,
                cowardSkillUsed: true,
                cowardSkillType: skill.skillType,
                cowardAlcoholDelta: Number(skill.delta) || 0,
                cowardAlcoholAdjustment: Number(skill.delta) || 0,
                cowardSkillUsedAt: database.serverDate()
            }), '酒量技能状态直写');
        },

        async acknowledgeResult() {
            if (this.data.gamePhase !== 'result' || this.data.resultAcknowledged || this.data.isActing || !this.data.isPlayer) return;
            const roundToken = this.data.roundToken;
            if (!roundToken || this._readyRequestToken === roundToken) return;
            this._readyRequestToken = roundToken;
            this.setData({ isActing: true, resultAcknowledged: true });
            try {
                await this._updateOwnPresence((database) => ({
                    cowardReady: true,
                    cowardReadyRoundToken: roundToken,
                    cowardReadyAt: database.serverDate()
                }), '拍桌状态直写');
                if (!this._isAttached || !this._isVisible || (this._latestState || {}).phase !== 'result' ||
                    (this._latestState || {}).roundToken !== roundToken) return;
                this._presenceByOpenId[this.data.myOpenId] = {
                    ...(this._presenceByOpenId[this.data.myOpenId] || {}),
                    _openid: this.data.myOpenId,
                    roomId: this.data.roomId,
                    cowardReady: true,
                    cowardReadyRoundToken: roundToken,
                    cowardReadyAt: new Date(this._serverNow())
                };
                if (!this._presenceWatchHealthy) {
                    await this._recoverPresenceSnapshot(this.data.roomId);
                }
                this.setData({ isActing: false, resultAcknowledged: true });
                this._evaluateCowardReady(roundToken);
            } catch (error) {
                this._debugError('拍桌状态直写失败', error, {
                    '集合': 'TenHalfPresence',
                    '操作': 'database.update/add',
                    '目标轮次': roundToken
                });
                if (this._latestState && this._latestState.phase === 'result' && this._latestState.roundToken === roundToken) {
                    this._readyRequestToken = '';
                    this.setData({ isActing: false, resultAcknowledged: false });
                    wx.showToast({ title: error.message || this._text('actionFailed', '操作失败'), icon: 'none' });
                }
            }
        },

        _updateOwnPresence(patchBuilder, debugLabel) {
            const roomId = this.data.roomId;
            const myOpenId = this.data.myOpenId;
            const connectionId = this._connectionId;
            if (!roomId || !myOpenId) return Promise.reject(new Error('房间尚未准备好'));
            const run = async () => {
                if (!this._isAttached || this.data.roomId !== roomId) throw new Error('房间已切换');
                const database = this._database || wx.cloud.database();
                const collection = database.collection('TenHalfPresence');
                const extra = typeof patchBuilder === 'function' ? patchBuilder(database) : (patchBuilder || {});
                const data = {
                    roomId: roomId,
                    connectionId: connectionId,
                    activeAt: database.serverDate(),
                    updatedAt: database.serverDate(),
                    ...extra
                };
                if (!this._presenceDocId) {
                    const found = await collection.where({ roomId: roomId, _openid: myOpenId }).limit(1).get();
                    this._presenceDocId = found.data && found.data[0] && found.data[0]._id || '';
                }
                if (this._presenceDocId) {
                    await collection.doc(this._presenceDocId).update({ data: data });
                    if (debugLabel) this._debug(debugLabel + '成功', {
                        '集合': 'TenHalfPresence',
                        '操作': 'database.update',
                        'Presence文档': this._presenceDocId
                    });
                    return;
                }
                try {
                    const result = await collection.add({ data: data });
                    this._presenceDocId = result._id || '';
                    if (debugLabel) this._debug(debugLabel + '成功', {
                        '集合': 'TenHalfPresence',
                        '操作': 'database.add',
                        'Presence文档': this._presenceDocId || '未知'
                    });
                } catch (error) {
                    const found = await collection.where({ roomId: roomId, _openid: myOpenId }).limit(1).get();
                    this._presenceDocId = found.data && found.data[0] && found.data[0]._id || '';
                    if (!this._presenceDocId) throw error;
                    await collection.doc(this._presenceDocId).update({ data: data });
                    if (debugLabel) this._debug(debugLabel + '成功', {
                        '集合': 'TenHalfPresence',
                        '操作': 'database.update-after-conflict',
                        'Presence文档': this._presenceDocId
                    });
                }
            };
            const task = this._presenceWriteQueue.catch(() => {}).then(run);
            this._presenceWriteQueue = task.catch(() => {});
            return task;
        },

        _startHeartbeat() {
            if (this._heartbeatTimer) return;
            this._writePresence();
            this._heartbeatTimer = setInterval(() => this._writePresence(), HEARTBEAT_MS);
        },

        async _writePresence() {
            if (!this.data.roomId || !this.data.myOpenId || this._presenceWriting) return;
            this._presenceWriting = true;
            try {
                await this._updateOwnPresence({});
                // 不新增定时器：仅在实时监听确实失效时，借用已有12秒心跳做
                // 一次直接快照恢复；监听恢复后这些读取会立即停止。
                if (!this._watchHealthy) await this._recoverRoomSnapshot(this.data.roomId);
                if (!this._presenceWatchHealthy) await this._recoverPresenceSnapshot(this.data.roomId);
            } catch (error) {
                const now = Date.now();
                if (!this._lastPresenceErrorAt || now - this._lastPresenceErrorAt >= 30000) {
                    this._lastPresenceErrorAt = now;
                    this._debugError('在线心跳直写失败（30秒内同类错误只打印一次）', error, {
                        '集合': 'TenHalfPresence',
                        '操作': 'database.update/add'
                    });
                }
            }
            finally { this._presenceWriting = false; }
        },

        _startPresenceWatch(roomId, restart) {
            if (!roomId || !this.data.myOpenId || !this._isVisible || !this._watchHealthy ||
                (this._presenceWatchStarting && !restart)) return;
            if (!restart && this._presenceWatcher && this._presenceWatchRoomId === roomId) return;
            this._presenceWatchStarting = true;
            const generation = Number(this._presenceWatchGeneration || 0) + 1;
            this._presenceWatchGeneration = generation;
            if (this._presenceWatcher) { try { this._presenceWatcher.close(); } catch (error) {} }
            this._presenceWatcher = null;
            this._presenceWatchRoomId = '';
            this._debug('准备监听全员Presence', {
                '集合': 'TenHalfPresence',
                '操作': 'database.watch',
                '是否重连': !!restart,
                '监听代次': generation
            });
            try {
                const database = this._database || wx.cloud.database();
                this._presenceWatcher = database.collection('TenHalfPresence').where({ roomId: roomId }).watch({
                    onChange: (snapshot) => {
                        if (!this._isAttached || !this._isVisible || generation !== this._presenceWatchGeneration || this.data.roomId !== roomId) return;
                        this._presenceWatchAttempt = 0;
                        this._presenceWatchHealthy = true;
                        this._debug('全员Presence监听收到更新', {
                            '集合': 'TenHalfPresence',
                            '文档数': snapshot.docs && snapshot.docs.length || 0
                        });
                        this._onPresenceDocs(snapshot.docs || []);
                    },
                    onError: (error) => {
                        if (generation !== this._presenceWatchGeneration || this.data.roomId !== roomId) return;
                        this._presenceWatchHealthy = false;
                        this._debugError('全员Presence监听失败', error, {
                            '集合': 'TenHalfPresence',
                            '操作': 'database.watch',
                            '监听代次': generation
                        });
                        this._presenceWatcher = null;
                        this._presenceWatchRoomId = '';
                        this._recoverPresenceSnapshot(roomId);
                        this._schedulePresenceReconnect(roomId);
                    }
                });
                this._presenceWatchRoomId = roomId;
            } catch (error) {
                this._presenceWatchHealthy = false;
                this._debugError('创建全员Presence监听失败', error, {
                    '集合': 'TenHalfPresence',
                    '操作': 'database.watch'
                });
                this._presenceWatcher = null;
                this._presenceWatchRoomId = '';
                this._recoverPresenceSnapshot(roomId);
                this._schedulePresenceReconnect(roomId);
            }
            this._presenceWatchStarting = false;
        },

        _schedulePresenceReconnect(roomId) {
            // 如果 GameRoom 监听也失效，先等待它重新拿到权威快照；其 onChange 会启动 Presence。
            if (this._presenceReconnectTimer || !this._isAttached || !this._isVisible || !this._watchHealthy) return;
            const attempt = Math.min(6, Number(this._presenceWatchAttempt || 0) + 1);
            this._presenceWatchAttempt = attempt;
            // Presence 与 GameRoom 重连错峰，避免同时触发 CloudBase WebSocket 登录。
            const delay = Math.min(WATCH_RECONNECT_MAX_MS, WATCH_RECONNECT_BASE_MS * Math.pow(2, attempt - 1)) + 360;
            this._presenceReconnectTimer = setTimeout(() => {
                this._presenceReconnectTimer = null;
                if (this.data.roomId === roomId) this._startPresenceWatch(roomId, true);
            }, delay);
        },

        _onPresenceDocs(docs) {
            if (!this._isAttached || !this.data.roomId) return;
            const active = {};
            const connections = {};
            let ownPresence = null;
            const byOpenId = {};
            (docs || []).forEach((item) => {
                if (!item || !item._openid) return;
                byOpenId[item._openid] = item;
                const value = item.activeAt || item.updatedAt;
                active[item._openid] = this._presenceTime(value);
                connections[item._openid] = item.connectionId || '';
                if (item._openid === this.data.myOpenId) ownPresence = item;
            });
            this._presenceByOpenId = byOpenId;
            const state = this._latestState || {};
            this._consumeCowardStartSignal(docs, state);
            const activePresenceCount = Object.keys(active).filter((openId) =>
                Date.now() - Number(active[openId] || 0) <= HEARTBEAT_MS * 2.5
            ).length;
            if (activePresenceCount > (this.data.roomMembers || []).length) {
                this._requestMemberReconcile('在线Presence人数大于本地成员数');
            }
            const readyPlayers = (docs || [])
                .filter((item) => item && item.cowardReady === true && item.cowardReadyRoundToken === state.roundToken)
                .map((item) => this._debugPlayer(item._openid))
                .sort();
            const readySignature = String(state.roundToken || '') + ':' + readyPlayers.join(',');
            if (this._lastReadyDebugSignature !== readySignature) {
                this._lastReadyDebugSignature = readySignature;
                this._debug('当前拍桌同步状态', {
                    '集合': 'TenHalfPresence',
                    '已拍桌人数': readyPlayers.length,
                    '本轮玩家数': (state.playerOrder || []).length,
                    '已拍桌玩家': readyPlayers
                });
            }
            if (ownPresence && ownPresence.cowardRoundToken === state.roundToken && ownPresence.cowardSkillUsed) {
                this._presenceCowardSkill = {
                    roundToken: ownPresence.cowardRoundToken,
                    used: true,
                    skillType: ownPresence.cowardSkillType || '',
                    delta: Number.isFinite(Number(ownPresence.cowardAlcoholDelta))
                        ? Number(ownPresence.cowardAlcoholDelta)
                        : (ownPresence.cowardSkillType === 'alcoholPlus' ? 10 :
                            (ownPresence.cowardSkillType === 'alcoholMinus' ? -10 : 0)),
                    usedAt: this._presenceTime(ownPresence.cowardSkillUsedAt)
                };
            } else if (!this._presenceCowardSkill || this._presenceCowardSkill.roundToken !== state.roundToken) {
                this._presenceCowardSkill = null;
            }
            if (state.phase === 'playing') {
                const publicSkillUsed = (state.skillUsedOpenIds || []).includes(this.data.myOpenId);
                const presenceSkillUsed = !!(this._presenceCowardSkill && this._presenceCowardSkill.roundToken === state.roundToken);
                const presencePatch = { alcoholValue: this._currentAlcohol(state) };
                if (publicSkillUsed || presenceSkillUsed) {
                    presencePatch.skillUsed = true;
                    presencePatch.skillMenuLevel = 'closed';
                }
                this.setData(presencePatch);
            }
            if (state.phase === 'result') {
                const ownReady = this._isCowardReady(this.data.myOpenId, state.roundToken);
                if (ownReady && !this.data.resultAcknowledged) this.setData({ resultAcknowledged: true, isActing: false });
                this._evaluateCowardReady(state.roundToken);
            }
            // 监听链路不健康时，快照可能不是连续、完整的在线证据。此时仍可用它
            // 同步酒量和拍桌，但绝不能据此踢人；云端生命周期离房仍正常生效。
            if (!this._watchHealthy || !this._presenceWatchHealthy) {
                this._staleCandidates = {};
                return;
            }
            const now = Date.now();
            this._staleCandidates = this._staleCandidates || {};
            (this.data.roomMembers || []).forEach((member) => {
                if (member.openId === this.data.myOpenId) return;
                const matches = !member.connectionId || connections[member.openId] === member.connectionId;
                const activeAt = Math.max(matches ? active[member.openId] || 0 : 0, Number(member.joinTime) || 0);
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
                // 只允许成员顺序中第一名仍在线的玩家执行离线移除，避免多人同时调用同一云函数。
                const coordinator = (this.data.roomMembers || []).find((candidateMember) => {
                    if (!candidateMember || candidateMember.openId === member.openId) return false;
                    if (candidateMember.openId === this.data.myOpenId) return true;
                    const candidateMatches = !candidateMember.connectionId ||
                        connections[candidateMember.openId] === candidateMember.connectionId;
                    const candidateActiveAt = Math.max(
                        candidateMatches ? active[candidateMember.openId] || 0 : 0,
                        Number(candidateMember.joinTime) || 0
                    );
                    return candidateActiveAt > 0 && now - candidateActiveAt <= STALE_MEMBER_MS;
                });
                if (!coordinator || coordinator.openId !== this.data.myOpenId) return;
                candidate.kicking = true;
                this._debug('确认玩家持续离线，请求结束当前房间对局', {
                    '离线玩家': this._debugPlayer(member.openId),
                    '最后活跃距今毫秒': now - activeAt,
                    '云函数': 'roomManager',
                    '操作': 'kickStale'
                });
                wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: 'kickStale', roomId: this.data.roomId, targetOpenId: member.openId }
                }).then((response) => {
                    const result = response.result || {};
                    this._debug(result.skipped ? '离线移除被服务端取消' : '离线玩家已移出，当前对局已关闭', {
                        '离线玩家': this._debugPlayer(member.openId),
                        '服务端原因': result.reason || '',
                        '是否成功': result.success !== false
                    });
                }).catch((error) => {
                    this._debugError('离线玩家移除失败', error, {
                        '离线玩家': this._debugPlayer(member.openId),
                        '云函数': 'roomManager',
                        '操作': 'kickStale'
                    });
                }).finally(() => { delete this._staleCandidates[member.openId]; });
            });
        },

        _isCowardReady(openId, roundToken) {
            const presence = this._presenceByOpenId && this._presenceByOpenId[openId];
            return !!(presence && presence.cowardReady === true && presence.cowardReadyRoundToken === roundToken);
        },

        _clearReadyAdvanceTimer() {
            if (this._readyAdvanceTimer) clearTimeout(this._readyAdvanceTimer);
            if (this._postReadyRoomRecoveryTimer) clearTimeout(this._postReadyRoomRecoveryTimer);
            if (this._advanceRetryTimer) clearTimeout(this._advanceRetryTimer);
            this._readyAdvanceTimer = null;
            this._readyAdvanceTimerKey = '';
            this._postReadyRoomRecoveryTimer = null;
            this._advanceRetryTimer = null;
        },

        _scheduleReadyAdvanceRetry(roundToken) {
            if (this._advanceRetryTimer || Number(this._advanceRetryCount || 0) >= 2) return;
            this._advanceRetryCount = Number(this._advanceRetryCount || 0) + 1;
            this._advanceRetryTimer = setTimeout(() => {
                this._advanceRetryTimer = null;
                const state = this._latestState || {};
                if (!this._isAttached || !this._isVisible || state.phase !== 'result' ||
                    state.roundToken !== roundToken) return;
                this._evaluateCowardReady(roundToken);
            }, 900);
        },

        _schedulePostReadyRoomRecovery(roundToken) {
            if (this._postReadyRoomRecoveryTimer || this._watchHealthy) return;
            this._postReadyRoomRecoveryTimer = setTimeout(() => {
                this._postReadyRoomRecoveryTimer = null;
                const state = this._latestState || {};
                if (!this._isAttached || !this._isVisible || this._watchHealthy ||
                    state.phase !== 'result' || state.roundToken !== roundToken) return;
                this._recoverRoomSnapshot(this.data.roomId);
            }, 1800);
        },

        _evaluateCowardReady(roundToken) {
            const state = this._latestState || {};
            const playerOrder = state.playerOrder || [];
            if (!this._isAttached || !this._isVisible || state.phase !== 'result' || state.roundToken !== roundToken ||
                !playerOrder.includes(this.data.myOpenId)) {
                this._clearReadyAdvanceTimer();
                return;
            }
            const allReady = playerOrder.length > 0 && playerOrder.every((openId) => this._isCowardReady(openId, roundToken));
            if (!allReady) {
                this._clearReadyAdvanceTimer();
                return;
            }
            const readyPlayers = playerOrder.map((openId) => ({
                openId: openId,
                readyAt: this._presenceTime(this._presenceByOpenId[openId] &&
                    this._presenceByOpenId[openId].cowardReadyAt)
            })).sort((first, second) =>
                second.readyAt - first.readyAt || String(second.openId).localeCompare(String(first.openId))
            );
            // “最后拍桌者”是所有设备都能由同一批 Presence 数据确定出的唯一协调者。
            // 它刚完成自己的数据库写入，即使第一座位的监听断开，也能立刻推进。
            const coordinatorOpenId = readyPlayers[0] && readyPlayers[0].openId || '';
            const timerKey = roundToken + ':' + coordinatorOpenId;
            if (coordinatorOpenId !== this.data.myOpenId) {
                this._clearReadyAdvanceTimer();
                this._schedulePostReadyRoomRecovery(roundToken);
                return;
            }
            if (this._readyAdvanceTimerKey === timerKey || this._advanceRequestToken === roundToken) return;
            this._debug('全员已拍桌，由唯一协调者推进', {
                '协调玩家': this._debugPlayer(coordinatorOpenId),
                '延迟毫秒': 0
            });
            this._readyAdvanceTimerKey = timerKey;
            this._readyAdvanceTimer = setTimeout(() => {
                this._readyAdvanceTimer = null;
                const latest = this._latestState || {};
                const latestOrder = latest.playerOrder || [];
                const stillAllReady = latestOrder.length > 0 && latestOrder.every((openId) => this._isCowardReady(openId, roundToken));
                if (!this._isAttached || !this._isVisible || latest.phase !== 'result' || latest.roundToken !== roundToken ||
                    coordinatorOpenId !== this.data.myOpenId || !stillAllReady) return;
                this._advanceCowardRound(roundToken);
            }, 0);
        },

        async _advanceCowardRound(roundToken) {
            if (this._advanceRequestToken === roundToken) return;
            const state = this._latestState || {};
            const playerOrder = state.playerOrder || [];
            const allReady = playerOrder.length > 0 && playerOrder.every((openId) => this._isCowardReady(openId, roundToken));
            if (!this._isAttached || !this._isVisible || state.phase !== 'result' || state.roundToken !== roundToken || !allReady) return;
            this._advanceRequestToken = roundToken;
            const requestStartedAt = Date.now();
            this._debug('协调者请求开始下一轮', {
                '云函数': 'roomManager',
                '操作': 'cowardAdvanceRound',
                '协调玩家': this._debugPlayer(this.data.myOpenId)
            });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'cowardAdvanceRound',
                        roomId: this.data.roomId,
                        roomDocId: this.data.roomDocId,
                        roundToken: roundToken
                    }
                });
                const result = response.result || {};
                this._calibrateServerTime(result.serverTime, requestStartedAt, Date.now());
                if (!result.success) throw new Error(result.error || this._text('actionFailed', '操作失败'));
                this._debug(result.waiting ? '云端判定尚未全员拍桌' : '下一轮推进成功', {
                    '操作': 'cowardAdvanceRound',
                    '耗时毫秒': Date.now() - requestStartedAt,
                    '返回轮次': result.state && result.state.roundToken || '未知'
                });
                if (result.waiting) {
                    this._advanceRequestToken = '';
                    this._readyAdvanceTimerKey = '';
                    if (!this._presenceWatchHealthy) this._recoverPresenceSnapshot(this.data.roomId);
                    this._scheduleReadyAdvanceRetry(roundToken);
                    return;
                }
                if (result.state) this._applyState(result.state);
            } catch (error) {
                this._advanceRequestToken = '';
                this._readyAdvanceTimerKey = '';
                this._debugError('唯一协调者的下一轮推进请求失败', error, {
                    '云函数': 'roomManager',
                    '操作': 'cowardAdvanceRound',
                    '耗时毫秒': Date.now() - requestStartedAt
                });
                this._scheduleReadyAdvanceRetry(roundToken);
            }
        },

        _onRoomClosed() {
            this._roomShareHostId = '';
            this._clearConnections();
            this._resetLocalRoomState();
            wx.showToast({ title: this._text('roomClosed', '房间已关闭'), icon: 'none' });
        },

        _clearConnections() {
            this._clearTimeline();
            this._clearReadyAdvanceTimer();
            this._watchGeneration = Number(this._watchGeneration || 0) + 1;
            this._presenceWatchGeneration = Number(this._presenceWatchGeneration || 0) + 1;
            this._roomRecoveryGeneration = Number(this._roomRecoveryGeneration || 0) + 1;
            this._presenceRecoveryGeneration = Number(this._presenceRecoveryGeneration || 0) + 1;
            if (this._watcher) { try { this._watcher.close(); } catch (error) {} }
            if (this._presenceWatcher) { try { this._presenceWatcher.close(); } catch (error) {} }
            if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
            if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
            if (this._presenceReconnectTimer) clearTimeout(this._presenceReconnectTimer);
            if (this._presenceStartTimer) clearTimeout(this._presenceStartTimer);
            if (this._roomCloseConfirmTimer) clearTimeout(this._roomCloseConfirmTimer);
            if (this._dealTimer) clearTimeout(this._dealTimer);
            if (this._swapMidpointTimer) clearTimeout(this._swapMidpointTimer);
            if (this._swapAnimationTimer) clearTimeout(this._swapAnimationTimer);
            this._watcher = null;
            this._presenceWatcher = null;
            this._watchRoomId = '';
            this._presenceWatchRoomId = '';
            this._heartbeatTimer = null;
            this._reconnectTimer = null;
            this._presenceReconnectTimer = null;
            this._presenceStartTimer = null;
            this._roomCloseConfirmTimer = null;
            this._dealTimer = null;
            this._swapMidpointTimer = null;
            this._swapAnimationTimer = null;
            this._presenceWatchHealthy = false;
            this._watchHealthy = false;
            this._presenceWatchStarting = false;
            this._watchStarting = false;
            this._watchAttempt = 0;
            this._presenceWatchAttempt = 0;
            this._roomRecoveryInFlight = false;
            this._presenceRecoveryInFlight = false;
            this._lastMemberReconcileAt = 0;
            this._roomCloseConfirmToken = '';
            this._handReadRequests = {};
        },

        _leaveRoom(context, force) {
            const leaveContext = context || this._captureLeaveContext();
            if (!leaveContext || !leaveContext.roomId) return Promise.resolve();
            const app = getApp();
            const reenter = app.globalData._reenteringCowardRoom;
            const skip = !force && reenter &&
                (reenter.roomId === leaveContext.roomId || reenter.roomId === leaveContext.shareHostId) &&
                Date.now() - reenter.timestamp < 10000;
            if (skip) app.globalData._reenteringCowardRoom = null;
            if (skip) return Promise.resolve();
            return wx.cloud.callFunction({
                name: 'roomManager',
                data: {
                    action: leaveContext.isHost ? 'close' : 'leave',
                    roomId: leaveContext.roomId,
                    connectionId: leaveContext.connectionId
                }
            }).then((response) => {
                const result = response.result || {};
                this._debug('生命周期离房已完成', {
                    '离开房间': leaveContext.roomId,
                    '操作': leaveContext.isHost ? 'close' : 'leave',
                    '云端结果': result.reason || (result.roomDeleted ? '房间已删除' : '成员已移除')
                });
            }).catch((error) => {
                this._debugError('生命周期离房失败', error, {
                    '离开房间': leaveContext.roomId,
                    '操作': leaveContext.isHost ? 'close' : 'leave'
                });
            });
        }
    }
});
