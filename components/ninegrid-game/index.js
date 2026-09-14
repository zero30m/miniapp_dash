const i18n = require('../../utils/i18n');
const realtimePlayerProfile = require('../../utils/realtime_player_profile.js');

const HEARTBEAT_MS = 12000;
const STALE_MEMBER_MS = 180000;
const STALE_CONFIRM_MS = 24000;
const WATCH_RECONNECT_BASE_MS = 500;
const WATCH_RECONNECT_MAX_MS = 5000;
const FLIP_MS = 520;
const CARD_SELECT_HOLD_MS = 380;
const CARD_EXPAND_MS = 460;
const CARD_RESULT_HOLD_MS = 680;
const CARD_COLLAPSE_MS = 460;

function createDeck() {
    const suits = [
        { key: 'spade', symbol: '♠', color: 'black' },
        { key: 'heart', symbol: '♥', color: 'red' },
        { key: 'diamond', symbol: '♦', color: 'red' },
        { key: 'club', symbol: '♣', color: 'black' }
    ];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    suits.forEach((suit) => ranks.forEach((rank) => deck.push({
        id: 'ninegrid-' + suit.key + '-' + rank,
        rank: rank,
        suitKey: suit.key,
        suit: suit.symbol,
        color: suit.color,
        isJoker: false
    })));
    return deck;
}

function rankValue(card) {
    if (!card) return 0;
    if (card.rank === 'A') return 1;
    if (card.rank === 'J') return 11;
    if (card.rank === 'Q') return 12;
    if (card.rank === 'K') return 13;
    return Number(card.rank) || 0;
}

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
        isFlipping: false,
        gamePhase: 'waiting',
        gameVersion: 0,
        isPlayer: false,
        isSpectator: false,
        playerViews: [],
        playerChipWidthPx: 140,
        playerAvatarSizePx: 24,
        playerRowWidthPx: 375,
        playerSidePaddingPx: 12,
        boardWidthPx: 276,
        boardHeightPx: 394,
        stageBottomPx: 90,
        playStageBottomPx: 142,
        grid: [],
        referenceCard: null,
        referenceSlotIndex: -1,
        selectedSlotIndex: -1,
        canSelectCard: false,
        comparisonVisible: false,
        comparisonReady: false,
        comparisonCandidateCard: null,
        comparisonCandidateRevealed: false,
        comparisonPrompt: '',
        comparisonTitleTopPx: 0,
        comparisonReferenceStyle: '',
        comparisonCandidateStyle: '',
        currentPlayerName: '',
        canGuess: false,
        canSkip: false,
        streak: 0,
        statusText: '',
        resultLines: [],
        hasDrinkResult: false
    },

    lifetimes: {
        attached() {
            this._isAttached = true;
            this._isVisible = true;
            this._connectionId = 'ninegrid_conn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
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
            this._clearConnections();
        },
        resize() {
            this._calculateLayout();
            this._updatePlayerLayout(this.data.playerViews.length);
        }
    },

    methods: {
        _text(key, fallback) {
            return this.data.copy && this.data.copy[key] || fallback || '';
        },

        _format(key, fallback, values) {
            return i18n.formatString(this._text(key, fallback), values || {});
        },

        _stateRevision(state) {
            const revision = Number(state && state.stateRevision);
            return Number.isFinite(revision) ? revision : Number(state && state.version || 0);
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
                const safeBottom = windowInfo.safeArea ? Math.max(0, height - windowInfo.safeArea.bottom) : 0;
                const stageBottom = safeBottom + 174 * rpx;
                const rootHeight = Number(rootHeightValue) || height;
                const playStageBottom = stageBottom + 104 * rpx;
                const availableHeight = Math.max(340 * rpx, rootHeight - playStageBottom - 282 * rpx);
                const boardWidth = Math.min(width - 96 * rpx, availableHeight / 1.42, 570 * rpx);
                this.setData({
                    stageBottomPx: Math.round(stageBottom),
                    playStageBottomPx: Math.round(playStageBottom),
                    boardWidthPx: Math.round(boardWidth),
                    boardHeightPx: Math.round(boardWidth * 1.42)
                });
            };
            update();
            wx.nextTick(() => {
                if (!this._isAttached) return;
                this.createSelectorQuery()
                    .select('.ninegrid-root')
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
                } catch (error) {}
            }
            if (!this._isAttached || !openId) return;
            this.setData({ myOpenId: openId });
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
                return { title: this._text('shareTitle', '九宫格｜下一张你敢猜吗'), path: '/pages/profile/index?game=ninegrid', imageUrl: '/logo.png' };
            }
            if (!this.data.isOnlineMode) this._createRoom(hostId);
            return {
                title: this._text('shareTitle', '九宫格｜下一张你敢猜吗'),
                path: '/pages/profile/index?game=ninegrid&hostId=' + encodeURIComponent(hostId),
                imageUrl: '/logo.png'
            };
        },

        buildTimelineMessage() {
            return { title: this._text('timelineTitle', '九张牌，猜错就收下'), imageUrl: '/logo.png' };
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
                    data: { action: 'createByHost', hostId: hostId, gameType: 'ninegrid', connectionId: this._connectionId }
                });
                const result = response.result || {};
                if (!result.success || !result.room) throw new Error(result.error || this._text('createFailed', '创建房间失败'));
                if (!this._isAttached) return;
                this._applyRoom(result.room, true, result.roomDocId);
                if (!silent) {
                    wx.showToast({ title: this._text('roomCreated', '房间已创建'), icon: 'success' });
                }
            } catch (error) {
                if (this._isAttached) {
                    wx.showToast({ title: error.message || this._text('createFailed', '创建房间失败'), icon: 'none' });
                }
            } finally { this._creating = false; }
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
                        data: { action: 'joinByHost', hostId: hostId, gameType: 'ninegrid', connectionId: this._connectionId }
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
            const members = room && room.members || [];
            const me = members.find((member) => member.openId === this.data.myOpenId);
            this.setData({
                roomId: room.roomId,
                roomDocId: docId || room._id || '',
                roomMembers: members,
                onlineCount: Math.max(1, members.length),
                isOnlineMode: true,
                isHost: me ? me.isHost === true : isHost === true,
                connectionStatus: 'connecting'
            });
            this._applyState(room.gameState || {});
            this._startWatch(room.roomId);
            this._startHeartbeat();
        },

        _startWatch(roomId) {
            if (!roomId || this._watchStarting || !this._isVisible) return;
            this._watchStarting = true;
            const generation = (this._watchGeneration || 0) + 1;
            this._watchGeneration = generation;
            if (this._watcher) { try { this._watcher.close(); } catch (error) {} }
            try {
                this._watcher = wx.cloud.database().collection('GameRoom').where({ roomId: roomId }).watch({
                    onChange: (snapshot) => {
                        if (!this._isAttached || generation !== this._watchGeneration || this.data.roomId !== roomId) return;
                        const room = snapshot.docs && snapshot.docs[0];
                        if (!room) return this._recoverRoom(roomId);
                        this._watchAttempt = 0;
                        this._onRoomUpdate(room);
                    },
                    onError: () => {
                        if (this.data.roomId !== roomId || generation !== this._watchGeneration) return;
                        this._recoverRoom(roomId);
                        this._scheduleReconnect(roomId);
                    }
                });
            } catch (error) {
                this._recoverRoom(roomId);
                this._scheduleReconnect(roomId);
            }
            this._watchStarting = false;
        },

        _scheduleReconnect(roomId) {
            if (this._reconnectTimer || !this._isAttached || !this._isVisible) return;
            const attempt = Math.min(6, (this._watchAttempt || 0) + 1);
            this._watchAttempt = attempt;
            const delay = Math.min(WATCH_RECONNECT_MAX_MS, WATCH_RECONNECT_BASE_MS * Math.pow(2, attempt - 1));
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
            } catch (error) { this._scheduleReconnect(roomId); }
            finally { this._recovering = false; }
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
            if (!room || room.gameType !== 'ninegrid') return;
            if (this._latestState && this._stateRevision(room.gameState) < this._stateRevision(this._latestState)) return;
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
                isHost: !!(me && me.isHost),
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

        _applyState(rawState, force) {
            const state = rawState && rawState.gameKind === 'ninegrid'
                ? rawState
                : { gameKind: 'ninegrid', phase: 'waiting', version: 0, players: [], playerOrder: [] };
            if (this._comparisonAnimating) {
                if (!this._latestState || this._stateRevision(state) > this._stateRevision(this._latestState)) {
                    this._pendingState = state;
                }
                return;
            }
            if (this._baseSelectionAnimating) {
                if (!this._latestState || this._stateRevision(state) > this._stateRevision(this._latestState)) {
                    this._pendingState = state;
                }
                return;
            }
            if (!force && this._baseRequestPending && this._latestState &&
                this._stateRevision(state) > this._stateRevision(this._latestState)) {
                this._pendingState = state;
                return;
            }
            if (!force && this._guessRequestPending && this._latestState &&
                this._stateRevision(state) > this._stateRevision(this._latestState)) {
                this._pendingState = state;
                return;
            }
            if (!force && this._optimisticUntil && Date.now() < this._optimisticUntil &&
                this._latestState && this._stateRevision(state) > this._stateRevision(this._latestState)) {
                this._pendingState = state;
                if (!this._optimisticTimer) {
                    this._optimisticTimer = setTimeout(() => {
                        this._optimisticTimer = null;
                        this._optimisticUntil = 0;
                        const pending = this._pendingState;
                        this._pendingState = null;
                        this.setData({ isFlipping: false });
                        if (pending) this._applyState(pending, true);
                    }, Math.max(20, this._optimisticUntil - Date.now()));
                }
                return;
            }
            if (this._latestState && this._stateRevision(state) < this._stateRevision(this._latestState)) return;
            this._clearComparisonTimers();
            this._latestState = state;
            const phase = state.phase || 'waiting';
            const isPlayer = (state.playerOrder || []).includes(this.data.myOpenId);
            const isMyTurn = phase === 'playing' && state.currentPlayerOpenId === this.data.myOpenId;
            const grid = (state.grid || []).map((slot) => ({
                ...slot,
                active: slot.active !== false && slot.collected !== true && !!slot.card,
                revealed: slot.active !== false && slot.collected !== true && !!slot.card,
                cardCount: Math.max(0, Number(slot.cardCount) || (slot.card ? 1 : 0))
            }));
            const playerViews = (state.players || []).map((player) => {
                const fallbackName = this._format('playerName', '玩家{seat}', { seat: player.seat });
                const memberProfile = realtimePlayerProfile.getMemberProfile(
                    this.data.roomMembers,
                    player.openId,
                    fallbackName
                );
                const collectedPiles = Array.isArray(player.collectedPiles) && player.collectedPiles.length
                    ? player.collectedPiles
                    : (player.collectedCards || []).map((card, index) => ({
                        id: 'legacy-' + player.openId + '-' + index,
                        card: card,
                        cardCount: 1
                    }));
                const collectedCardCount = Math.max(
                    Number(player.collectedCardCount || 0),
                    collectedPiles.reduce((sum, pile) => sum + Math.max(0, Number(pile.cardCount) || 0), 0)
                );
                return {
                    ...player,
                    name: memberProfile.nickname,
                    avatarUrl: memberProfile.avatarUrl,
                    isMe: player.openId === this.data.myOpenId,
                    isActive: state.currentPlayerOpenId === player.openId,
                    collectedPiles: collectedPiles,
                    cardCount: collectedCardCount
                };
            });
            const resultLines = playerViews
                .slice()
                .sort((first, second) => Number(second.isMe) - Number(first.isMe))
                .filter((player) => Number(player.drinkCount || 0) > 0)
                .map((player) => this._format('resultLine', '{name} 喝{count}口', {
                    name: player.isMe ? this._text('youName', '你') : player.name,
                    count: player.drinkCount
                }));
            this.setData({
                gamePhase: phase,
                gameVersion: Number(state.version || 0),
                isPlayer: isPlayer,
                isSpectator: phase !== 'waiting' && !isPlayer,
                playerViews: playerViews,
                grid: grid,
                referenceCard: null,
                referenceSlotIndex: -1,
                selectedSlotIndex: -1,
                canSelectCard: isMyTurn && grid.some((slot) => slot.active && slot.card),
                comparisonVisible: false,
                comparisonReady: false,
                comparisonCandidateCard: null,
                comparisonCandidateRevealed: false,
                comparisonPrompt: '',
                comparisonReferenceStyle: '',
                comparisonCandidateStyle: '',
                currentPlayerName: this._playerName(state.currentPlayerOpenId, state),
                canGuess: false,
                canSkip: false,
                streak: Number(state.streak || 0),
                statusText: phase === 'playing'
                    ? (isMyTurn
                        ? this._text('selectCard', '请选择一个格子')
                        : this._format('waitingGuess', '等{name}猜牌', { name: this._playerName(state.currentPlayerOpenId, state) }))
                    : '',
                resultLines: resultLines,
                hasDrinkResult: resultLines.length > 0,
                isFlipping: false
            });
            this._updatePlayerLayout(playerViews.length);
        },

        async startGame() {
            if (this.data.isStarting || !this.data.isOnlineMode) {
                if (!this.data.isOnlineMode) wx.showToast({ title: this._text('shareFirstToast', '先点右上角分享叫人'), icon: 'none' });
                return;
            }
            this.setData({ isStarting: true });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: 'nineGridStart', roomId: this.data.roomId, roomDocId: this.data.roomDocId }
                });
                const result = response.result || {};
                if (!result.success) throw new Error(result.error || this._text('startFailed', '开始失败'));
                if (result.state) this._applyState(result.state);
            } catch (error) {
                wx.showToast({ title: error.message || this._text('startFailed', '开始失败'), icon: 'none' });
            } finally { this.setData({ isStarting: false }); }
        },

        _clearComparisonTimers() {
            ['_selectionTimer', '_expandFrameTimer', '_expandTimer', '_resultTimer', '_collapseTimer', '_baseRevealTimer']
                .forEach((key) => {
                    if (this[key]) clearTimeout(this[key]);
                    this[key] = null;
                });
        },

        _comparisonCardStyle(rect, stageRect) {
            return [
                'left:' + Number(rect.left - stageRect.left).toFixed(2) + 'px',
                'top:' + Number(rect.top - stageRect.top).toFixed(2) + 'px',
                'width:' + Number(rect.width).toFixed(2) + 'px',
                'height:' + Number(rect.height).toFixed(2) + 'px'
            ].join(';') + ';';
        },

        selectGridCard(event) {
            if (!this.data.canSelectCard || this.data.isActing || this.data.comparisonVisible) return;
            const index = Number(event.currentTarget.dataset.index);
            const slot = (this.data.grid || []).find((item) => Number(item.index) === index);
            if (!slot || !slot.active || !slot.card) return;

            this._clearComparisonTimers();
            this.setData({
                selectedSlotIndex: index,
                referenceCard: slot.card,
                referenceSlotIndex: index,
                canSelectCard: false,
                canSkip: false
            });
            this._selectionTimer = setTimeout(() => {
                this._selectionTimer = null;
                this._openCardComparison(index);
            }, CARD_SELECT_HOLD_MS);
        },

        async _selectBaseCard(index) {
            if (this._baseRequestPending || this.data.isActing || this.data.referenceCard) return;
            const requestRevision = this._stateRevision(this._latestState);
            this._baseRequestPending = true;
            this.setData({
                isActing: true,
                isFlipping: true,
                grid: (this.data.grid || []).map((item) => Number(item.index) === Number(index)
                    ? { ...item, pending: true }
                    : item)
            });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'nineGridSelectBase',
                        roomId: this.data.roomId,
                        roomDocId: this.data.roomDocId,
                        slotIndex: index,
                        expectedVersion: this.data.gameVersion
                    }
                });
                const result = response.result || {};
                if (!result.success) throw new Error(result.error || this._text('actionFailed', '手慢了一拍'));
                this._baseRequestPending = false;
                if (result.stale || !result.card || !result.state) {
                    const authoritative = this._pendingState || result.state;
                    this._pendingState = null;
                    if (authoritative) this._applyState(authoritative, true);
                    return;
                }
                this._startBaseReveal(result, index);
            } catch (error) {
                this._baseRequestPending = false;
                const authoritative = this._pendingState;
                this._pendingState = null;
                if (authoritative && this._stateRevision(authoritative) > requestRevision) {
                    this._applyState(authoritative, true);
                } else {
                    this.setData({
                        selectedSlotIndex: -1,
                        canSelectCard: true,
                        isActing: false,
                        isFlipping: false,
                        grid: (this.data.grid || []).map((item) => ({ ...item, pending: false }))
                    });
                    wx.showToast({ title: error.message || this._text('actionFailed', '操作失败'), icon: 'none' });
                }
            }
        },

        _startBaseReveal(result, selectedIndex) {
            if (!this._isAttached || !result || !result.card || !result.state) return;
            this._baseSelectionAnimating = true;
            this._baseResultState = result.state;
            this.setData({
                grid: (this.data.grid || []).map((item) => Number(item.index) === Number(selectedIndex)
                    ? { ...item, pending: false, revealed: true, card: result.card }
                    : { ...item, pending: false }),
                statusText: this._text('baseCardRevealed', '第一张牌翻开了')
            });
            this._baseRevealTimer = setTimeout(() => {
                this._baseRevealTimer = null;
                if (!this._isAttached) return;
                const resultState = this._baseResultState;
                const pendingState = this._pendingState;
                const authoritative = pendingState && (!resultState || this._stateRevision(pendingState) >= this._stateRevision(resultState))
                    ? pendingState
                    : resultState;
                this._baseSelectionAnimating = false;
                this._baseResultState = null;
                this._pendingState = null;
                this.setData({
                    selectedSlotIndex: -1,
                    isActing: false,
                    isFlipping: false
                }, () => {
                    if (authoritative) this._applyState(authoritative, true);
                });
            }, FLIP_MS + 180);
        },

        _openCardComparison(selectedIndex) {
            if (!this._isAttached || Number(this.data.selectedSlotIndex) !== Number(selectedIndex)) return;
            const referenceIndex = Number(this.data.referenceSlotIndex);
            if (referenceIndex < 0 || !this.data.referenceCard) {
                this.setData({
                    selectedSlotIndex: -1,
                    canSelectCard: true,
                    canSkip: false
                });
                return;
            }

            const query = this.createSelectorQuery();
            query.select('.play-stage').boundingClientRect();
            query.select('.slot-index-' + referenceIndex).boundingClientRect();
            query.select('.slot-index-' + selectedIndex).boundingClientRect();
            query.exec((rects) => {
                if (!this._isAttached || Number(this.data.selectedSlotIndex) !== Number(selectedIndex)) return;
                const stageRect = rects && rects[0];
                const referenceRect = rects && rects[1];
                const candidateRect = rects && rects[2];
                if (!stageRect || !referenceRect || !candidateRect || !referenceRect.width || !candidateRect.width) {
                    this.setData({
                        selectedSlotIndex: -1,
                        canSelectCard: true,
                        canSkip: false
                    });
                    return;
                }

                const ratio = referenceRect.height / referenceRect.width;
                const targetWidth = Math.min(stageRect.width * 0.34, referenceRect.width * 1.48);
                const targetHeight = targetWidth * ratio;
                const gap = Math.max(14, Math.min(28, stageRect.width * 0.07));
                const totalWidth = targetWidth * 2 + gap;
                const targetLeft = Math.max(0, (stageRect.width - totalWidth) / 2);
                const targetTop = Math.max(54, Math.min(
                    stageRect.height - targetHeight - 12,
                    (stageRect.height - targetHeight) / 2 + 18
                ));
                const sourceStyles = {
                    reference: this._comparisonCardStyle(referenceRect, stageRect),
                    candidate: this._comparisonCardStyle(candidateRect, stageRect)
                };
                const targetStyles = {
                    reference: [
                        'left:' + targetLeft.toFixed(2) + 'px',
                        'top:' + targetTop.toFixed(2) + 'px',
                        'width:' + targetWidth.toFixed(2) + 'px',
                        'height:' + targetHeight.toFixed(2) + 'px'
                    ].join(';') + ';',
                    candidate: [
                        'left:' + (targetLeft + targetWidth + gap).toFixed(2) + 'px',
                        'top:' + targetTop.toFixed(2) + 'px',
                        'width:' + targetWidth.toFixed(2) + 'px',
                        'height:' + targetHeight.toFixed(2) + 'px'
                    ].join(';') + ';'
                };
                this._comparisonSourceStyles = sourceStyles;
                this._comparisonTargetStyles = targetStyles;

                const cardLabel = String(this.data.referenceCard.suit || '') + String(this.data.referenceCard.rank || '');
                this.setData({
                    comparisonVisible: true,
                    comparisonReady: false,
                    comparisonCandidateCard: null,
                    comparisonCandidateRevealed: false,
                    comparisonPrompt: this._format('comparePrompt', '猜猜是否比 {card} 大/小，或花色', { card: cardLabel }),
                    comparisonTitleTopPx: Math.max(4, targetTop - 48),
                    comparisonReferenceStyle: sourceStyles.reference,
                    comparisonCandidateStyle: sourceStyles.candidate
                }, () => {
                    wx.nextTick(() => {
                        this._expandFrameTimer = setTimeout(() => {
                            this._expandFrameTimer = null;
                            if (!this._isAttached || !this.data.comparisonVisible) return;
                            this.setData({
                                comparisonReferenceStyle: targetStyles.reference,
                                comparisonCandidateStyle: targetStyles.candidate
                            });
                        }, 20);
                    });
                });

                this._expandTimer = setTimeout(() => {
                    this._expandTimer = null;
                    if (!this._isAttached || !this.data.comparisonVisible) return;
                    this.setData({
                        comparisonReady: true,
                        canGuess: true
                    });
                }, CARD_EXPAND_MS + 20);
            });
        },

        _startGuessReveal(result) {
            if (!this._isAttached || !result || !result.card || !result.state) return false;
            this._comparisonAnimating = true;
            this._comparisonResultState = result.state;
            this.setData({
                comparisonCandidateCard: result.card,
                comparisonReady: false,
                canGuess: false,
                canSkip: false,
                statusText: result.correct
                    ? this._text('guessedRight', '猜中了，继续')
                    : this._text('guessedWrong', '猜错了，整堆归你')
            }, () => {
                wx.nextTick(() => {
                    if (this._isAttached && this.data.comparisonVisible) {
                        this.setData({ comparisonCandidateRevealed: true });
                    }
                });
            });

            this._resultTimer = setTimeout(() => {
                this._resultTimer = null;
                if (!this._isAttached || !this.data.comparisonVisible) return;
                const sourceStyles = this._comparisonSourceStyles || {};
                this.setData({
                    comparisonReferenceStyle: sourceStyles.reference || this.data.comparisonReferenceStyle,
                    comparisonCandidateStyle: sourceStyles.candidate || this.data.comparisonCandidateStyle
                });
                this._collapseTimer = setTimeout(() => {
                    this._collapseTimer = null;
                    this._finishGuessAnimation();
                }, CARD_COLLAPSE_MS);
            }, FLIP_MS + CARD_RESULT_HOLD_MS);
            return true;
        },

        _finishGuessAnimation() {
            if (!this._isAttached) return;
            this._comparisonAnimating = false;
            this._optimisticUntil = 0;
            const resultState = this._comparisonResultState;
            const pendingState = this._pendingState;
            const authoritative = pendingState && (!resultState || this._stateRevision(pendingState) >= this._stateRevision(resultState))
                ? pendingState
                : resultState;
            this._comparisonResultState = null;
            this._pendingState = null;
            this._comparisonSourceStyles = null;
            this._comparisonTargetStyles = null;
            this.setData({
                comparisonVisible: false,
                comparisonReady: false,
                comparisonCandidateRevealed: false,
                comparisonCandidateCard: null,
                selectedSlotIndex: -1,
                isFlipping: false,
                isActing: false
            }, () => {
                if (authoritative) this._applyState(authoritative, true);
            });
        },

        async guessCard(e) {
            if (!this.data.canGuess || !this.data.comparisonReady || this.data.isActing || this.data.isFlipping) return;
            const guess = e.currentTarget.dataset.guess;
            const slotIndex = Number(this.data.selectedSlotIndex);
            const slot = (this.data.grid || []).find((item) => Number(item.index) === slotIndex);
            if (!slot || !slot.active || !slot.card) return;
            const requestRevision = this._stateRevision(this._latestState);
            this._guessRequestPending = true;
            let animationStarted = false;
            this.setData({
                isActing: true,
                isFlipping: true,
                canGuess: false,
                canSkip: false
            });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: 'nineGridGuess', roomId: this.data.roomId, roomDocId: this.data.roomDocId,
                        guess: guess, slotIndex: slot.index,
                        expectedVersion: this.data.gameVersion
                    }
                });
                const result = response.result || {};
                if (!result.success) throw new Error(result.error || this._text('actionFailed', '手慢了一拍'));
                this._guessRequestPending = false;
                if (result.stale || !result.card) {
                    this._optimisticUntil = 0;
                    this._pendingState = null;
                    if (result.state) this._applyState(result.state, true);
                    return;
                }
                animationStarted = this._startGuessReveal(result);
                if (!animationStarted && result.state) this._applyState(result.state, true);
            } catch (error) {
                this._guessRequestPending = false;
                this._comparisonAnimating = false;
                this._optimisticUntil = 0;
                if (this._optimisticTimer) clearTimeout(this._optimisticTimer);
                this._optimisticTimer = null;
                let authoritative = this._pendingState;
                this._pendingState = null;
                if (!authoritative || this._stateRevision(authoritative) <= requestRevision) {
                    await new Promise((resolve) => setTimeout(resolve, 240));
                    if (this._latestState && this._stateRevision(this._latestState) > requestRevision) {
                        authoritative = this._latestState;
                    } else if (this.data.roomDocId) {
                        try {
                            const roomResult = await wx.cloud.database().collection('GameRoom').doc(this.data.roomDocId).get();
                            const room = roomResult && roomResult.data;
                            if (room && room.roomId === this.data.roomId) authoritative = room.gameState || null;
                        } catch (readError) {}
                    }
                }
                if (authoritative && this._stateRevision(authoritative) > requestRevision) {
                    this._applyState(authoritative, true);
                } else {
                    this.setData({
                        comparisonReady: true,
                        canGuess: true,
                        isFlipping: false
                    });
                    wx.showToast({ title: error.message || this._text('actionFailed', '操作失败'), icon: 'none' });
                }
            } finally {
                if (!animationStarted && this._isAttached) this.setData({ isActing: false, isFlipping: false });
            }
        },

        async skipTurn() {
            if (!this.data.canSkip || this.data.isActing) return;
            await this._simpleAction('nineGridSkip');
        },

        async nextRound() {
            if (this.data.gamePhase !== 'result' || this.data.isActing || !this.data.isOnlineMode) return;
            await this._simpleAction('nineGridNextRound');
        },

        async _simpleAction(action) {
            this.setData({ isActing: true });
            try {
                const response = await wx.cloud.callFunction({
                    name: 'roomManager',
                    data: {
                        action: action, roomId: this.data.roomId, roomDocId: this.data.roomDocId,
                        expectedVersion: this.data.gameVersion
                    }
                });
                const result = response.result || {};
                if (!result.success) throw new Error(result.error || this._text('actionFailed', '操作失败'));
                if (result.state) this._applyState(result.state);
            } catch (error) {
                wx.showToast({ title: error.message || this._text('actionFailed', '操作失败'), icon: 'none' });
            } finally { this.setData({ isActing: false }); }
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
            } catch (error) {}
            finally { this._presenceWriting = false; }
        },

        async _refreshPresence() {
            const result = await wx.cloud.database().collection('TenHalfPresence').where({ roomId: this.data.roomId }).limit(20).get();
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
            this._comparisonAnimating = false;
            this._comparisonResultState = null;
            this._baseSelectionAnimating = false;
            this._baseResultState = null;
            this._baseRequestPending = false;
            this._pendingState = null;
            this.setData({
                roomId: '', roomDocId: '', roomMembers: [], onlineCount: 1,
                isOnlineMode: false, isHost: false, gamePhase: 'waiting',
                playerViews: [], grid: [], referenceCard: null,
                referenceSlotIndex: -1, selectedSlotIndex: -1, canSelectCard: false,
                comparisonVisible: false, comparisonReady: false,
                comparisonCandidateCard: null, comparisonCandidateRevealed: false
            });
            wx.showToast({ title: this._text('roomClosed', '房间已关闭'), icon: 'none' });
        },

        _clearConnections() {
            this._clearComparisonTimers();
            this._comparisonAnimating = false;
            this._comparisonResultState = null;
            this._comparisonSourceStyles = null;
            this._comparisonTargetStyles = null;
            this._baseSelectionAnimating = false;
            this._baseResultState = null;
            this._baseRequestPending = false;
            this._watchGeneration = Number(this._watchGeneration || 0) + 1;
            if (this._watcher) { try { this._watcher.close(); } catch (error) {} }
            if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
            if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
            if (this._optimisticTimer) clearTimeout(this._optimisticTimer);
            if (this._roomCloseConfirmTimer) clearTimeout(this._roomCloseConfirmTimer);
            this._watcher = null;
            this._heartbeatTimer = null;
            this._reconnectTimer = null;
            this._optimisticTimer = null;
            this._roomCloseConfirmTimer = null;
            this._roomCloseConfirmToken = '';
        },

        _leaveRoom() {
            if (!this.data.roomId || !this.data.isOnlineMode) return;
            const app = getApp();
            const reenter = app.globalData._reenteringNineGridRoom;
            const skip = reenter &&
                (reenter.roomId === this.data.roomId || reenter.roomId === this._roomShareHostId) &&
                Date.now() - reenter.timestamp < 10000;
            if (skip) app.globalData._reenteringNineGridRoom = null;
            if (!skip) {
                wx.cloud.callFunction({
                    name: 'roomManager',
                    data: { action: this.data.isHost ? 'close' : 'leave', roomId: this.data.roomId, connectionId: this._connectionId }
                }).catch(() => {});
            }
        }
    }
});
