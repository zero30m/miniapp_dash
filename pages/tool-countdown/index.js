/**
 * 倒计时喝酒游戏 - 多类型版
 * 倒计时结束后随机选择一种游戏类型，玩家按指令操作
 * 支持6种类型: press / doubleTap / release / longPress / tripleTap / liftFinger
 */
const i18n = require('../../utils/i18n');

const COLORS = [
    '#FF0055', // Neon Red (Primary)
    '#39FF14', // Neon Green
    '#00FFFF', // Cyan
    '#FF9900', // Neon Orange
    '#CC00FF'  // Neon Purple
];

// ==================== 游戏类型注册表 ====================
const GAME_MODES = [
    {
        id: 'press',
        touchDuration: 3, // 触摸阶段等待秒数
    },
    {
        id: 'doubleTap',
        touchDuration: 3,
    },
    {
        id: 'release',
        touchDuration: 3,
    },
    {
        id: 'longPress',
        touchDuration: 5,
    },
    {
        id: 'tripleTap',
        touchDuration: 4,
    },
    {
        id: 'liftFinger',
        touchDuration: 0, // 特殊流程：随机等待后触发
    },
];

function getGameModes(uiCopy) {
    const modeCopy = uiCopy && uiCopy.modes || {};
    return GAME_MODES.map(function (mode) {
        return Object.assign({}, mode, modeCopy[mode.id] || {});
    });
}

// ==================== 空间匹配常量 ====================
const TAP_MATCH_RADIUS = 60;      // 多次点击空间匹配半径(px)
const TAP_MIN_INTERVAL = 100;     // 最短点击间隔(ms)
const TAP_MAX_INTERVAL = 500;     // 最长点击间隔(ms)
const LONG_PRESS_DURATION = 3000; // 长按目标时长(ms)
const LONG_PRESS_CHECK_INTERVAL = 100; // 长按进度检查间隔(ms)

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('countdown', 'zh-Hans'),
        // 游戏状态: SETUP, COUNTDOWN, WAITING, TOUCH_PHASE, ELIMINATING, RESULT
        gameState: 'SETUP',

        // 倒计时设置
        countdownSeconds: 5,
        currentCount: 0,

        // 手指数据
        fingers: [],

        // 屏幕尺寸
        screenHeight: 0,
        screenWidth: 0,

        // 等待触摸的倒计时
        touchCountdown: 3,

        // 获胜者颜色
        winnerColor: '#FF0055',

        // 导航布局
        navTop: 60,

        // ===== 新增：游戏类型相关 =====
        gameMode: 'press',
        gameModeTitle: i18n.getPageCopy('countdown', 'zh-Hans').modes.press.title,
        gameModeHint: i18n.getPageCopy('countdown', 'zh-Hans').modes.press.hint,
        gameModeSubtitle: '',

        // release/liftFinger 子状态文案
        releasePhaseText: '',

        // liftFinger "松!" 提示
        showLiftNow: false,

        // 抢跑犯规卡片
        showFoulCard: false,
    },

    // ==================== 非响应式数据 ====================
    touchMap: null,
    countdownTimer: null,
    touchPhaseTimer: null,
    eliminationTimer: null,
    longPressTimer: null,
    liftTimer: null,
    startTime: 0,
    loser: null,
    eliminationQueue: [],
    eliminationIndex: 0,

    // doubleTap / tripleTap 专用
    tapRecords: [],

    // liftFinger 专用
    liftTime: 0,        // "松!" 出现的时间戳
    releaseReady: false, // 是否已显示"松!"
    earlyReleasers: [],  // 抢跑的手指ID列表

    // ==================== 策略模式 - 触摸处理器 ====================
    _touchHandlers: null,

    _initTouchHandlers() {
        this._touchHandlers = {
            press: {
                onStart: this._press_onStart,
                onMove: this._press_onMove,
                onEnd: this._press_onEnd,
                onCancel: this._press_onEnd,
                onJudge: this._press_onJudge,
            },
            doubleTap: {
                onStart: this._tap_onStart,
                onMove: null,
                onEnd: null,
                onCancel: null,
                onJudge: this._tap_onJudge,
            },
            tripleTap: {
                onStart: this._tap_onStart,
                onMove: null,
                onEnd: null,
                onCancel: null,
                onJudge: this._tap_onJudge,
            },
            release: {
                onStart: this._release_onStart,
                onMove: this._press_onMove,
                onEnd: this._release_onEnd,
                onCancel: this._release_onEnd, // touchCancel 同样视为松手
                onJudge: this._release_onJudge,
            },
            longPress: {
                onStart: this._longPress_onStart,
                onMove: this._press_onMove,
                onEnd: this._longPress_onEnd,
                onCancel: this._longPress_onEnd,
                onJudge: this._longPress_onJudge,
            },
            liftFinger: {
                onStart: this._liftFinger_onStart,
                onMove: this._press_onMove,
                onEnd: this._liftFinger_onEnd,
                onCancel: this._liftFinger_onEnd, // touchCancel 同样视为松手
                onJudge: this._liftFinger_onJudge,
            },
        };
    },

    // ==================== 生命周期 ====================

    onLoad() {
        this._syncI18n();
        this.touchMap = new Map();
        this.countdownTimer = null;
        this.touchPhaseTimer = null;
        this.eliminationTimer = null;
        this.longPressTimer = null;
        this.liftTimer = null;
        this.startTime = 0;
        this.loser = null;
        this.eliminationQueue = [];
        this.eliminationIndex = 0;
        this.tapRecords = [];
        this.liftTime = 0;
        this.releaseReady = false;
        this.earlyReleasers = [];

        this._initTouchHandlers();
        this._calculateNavLayout();

        const systemInfo = wx.getSystemInfoSync();
        this.setData({
            screenHeight: systemInfo.windowHeight,
            screenWidth: systemInfo.windowWidth
        });

        this._reportGamePlay();
    },

    onUnload() {
        this._clearAllTimers();

    },

    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    _getModeCopy(modeId, uiCopy) {
        const modes = getGameModes(uiCopy || this.data.uiCopy);
        return modes.find(function (item) {
            return item.id === modeId;
        }) || modes[0] || {};
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        const uiCopy = i18n.getPageCopy('countdown', locale);
        const currentMode = this._getModeCopy(this.data.gameMode, uiCopy);
        this.setData({
            locale: locale,
            uiCopy: uiCopy,
            gameModeTitle: currentMode.title || this.data.gameModeTitle,
            gameModeHint: currentMode.hint || this.data.gameModeHint,
            gameModeSubtitle: currentMode.subtitle || ''
        });
        i18n.setNavigationBarTitle('countdown.navTitle', locale);
    },

    _calculateNavLayout() {
        try {
            const menuBtn = wx.getMenuButtonBoundingClientRect();
            if (menuBtn && menuBtn.top > 0) {
                this.setData({ navTop: menuBtn.top });
            }
        } catch (e) {
            console.warn('[NavLayout] Failed to get menu button rect:', e);
        }
    },

    onShow() {
        this._syncI18n();
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar && !tabBar.data.hidden) {
            tabBar.setData({ hidden: true });
        }
    },

    onHide() {
        this._clearAllTimers();
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({ hidden: false, blurred: false });
        }
    },

    _clearAllTimers() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        if (this.touchPhaseTimer) {
            clearInterval(this.touchPhaseTimer);
            this.touchPhaseTimer = null;
        }
        if (this.eliminationTimer) {
            clearTimeout(this.eliminationTimer);
            this.eliminationTimer = null;
        }
        if (this.longPressTimer) {
            clearInterval(this.longPressTimer);
            this.longPressTimer = null;
        }
        if (this.liftTimer) {
            clearTimeout(this.liftTimer);
            this.liftTimer = null;
        }

    },

    onDecrease() {
        if (this.data.gameState !== 'SETUP') return;
        if (this.data.countdownSeconds > 3) {
            this.setData({ countdownSeconds: this.data.countdownSeconds - 1 });
            wx.vibrateShort({ type: 'light' });
        }
    },

    onIncrease() {
        if (this.data.gameState !== 'SETUP') return;
        if (this.data.countdownSeconds < 30) {
            this.setData({ countdownSeconds: this.data.countdownSeconds + 1 });
            wx.vibrateShort({ type: 'light' });
        }
    },

    // ==================== 游戏流程 ====================

    onStartGame() {
        if (this.data.gameState !== 'SETUP') return;
        wx.vibrateShort({ type: 'medium' });
        this._startCountdown();
    },

    _startCountdown() {
        this._clearAllTimers();

        let count = this.data.countdownSeconds;
        this.setData({
            gameState: 'COUNTDOWN',
            currentCount: count
        });

        this.countdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                this.setData({ currentCount: count });

                wx.vibrateShort({ type: 'light' });
            } else {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                this.setData({ currentCount: 0 });
                wx.vibrateShort({ type: 'medium' });
                this._enterWaitingPhase();
            }
        }, 1000);
    },

    /**
     * 进入等待阶段 - 随机选择游戏类型
     */
    _enterWaitingPhase() {
        // 随机选择游戏类型
        const modes = getGameModes(this.data.uiCopy);
        const mode = modes[Math.floor(Math.random() * modes.length)];

        // 重置类型专用数据
        this.tapRecords = [];
        this.liftTime = 0;
        this.releaseReady = false;
        this.earlyReleasers = [];

        this.setData({
            gameState: 'WAITING',
            gameMode: mode.id,
            gameModeTitle: mode.title,
            gameModeHint: mode.hint,
            gameModeSubtitle: mode.subtitle,
            releasePhaseText: '',
            showLiftNow: false,
        });

        // 1.5秒后进入触摸阶段
        this.touchPhaseTimer = setTimeout(() => {
            this._startTouchPhase();
        }, 1500);
    },

    /**
     * 开始触摸阶段 - 根据类型分发
     */
    _startTouchPhase() {
        this.startTime = Date.now();
        const mode = this._getModeCopy(this.data.gameMode);
        const duration = mode ? mode.touchDuration : 3;

        // liftFinger 和 release 类型使用特殊流程（等按住 → 随机等待 → 松!）
        if (this.data.gameMode === 'liftFinger' || this.data.gameMode === 'release') {
            this._startLiftFingerPhase();
            return;
        }

        this.setData({
            gameState: 'TOUCH_PHASE',
            touchCountdown: duration
        });

        // longPress 类型启动进度检查定时器
        if (this.data.gameMode === 'longPress') {
            this._startLongPressProgressTimer();
        }

        // 倒计时
        let countdown = duration;
        this.touchPhaseTimer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                this.setData({ touchCountdown: countdown });

            } else {
                clearInterval(this.touchPhaseTimer);
                this.touchPhaseTimer = null;
                this._startElimination();
            }
        }, 1000);
    },

    /**
     * liftFinger 特殊流程：等所有人按住 → 随机等待 → 显示"松!"
     */
    _startLiftFingerPhase() {
        this.setData({
            gameState: 'TOUCH_PHASE',
            touchCountdown: 0,
            releasePhaseText: this.data.gameModeHint,
            showLiftNow: false,
        });

        // 等待至少2人按住后开始随机等待
        this._checkLiftFingerReady();
    },

    _checkLiftFingerReady() {
        // 每 300ms 检查是否有 >= 2 人按住
        this.touchPhaseTimer = setInterval(() => {
            const activeCount = this.touchMap.size;
            if (activeCount >= 2) {
                clearInterval(this.touchPhaseTimer);
                this.touchPhaseTimer = null;

                this.setData({ releasePhaseText: this.data.gameModeTitle });

                // 随机等待1~4秒后显示"松!"
                const waitTime = 1000 + Math.floor(Math.random() * 3000);
                this.liftTimer = setTimeout(() => {
                    // Bug3: 再次检查是否还有手指在屏幕上
                    if (this.touchMap.size === 0) {
                        this._resetGame();
                        return;
                    }
                    this._triggerLiftNow();
                }, waitTime);
            }
        }, 300);
    },

    _triggerLiftNow() {
        this.liftTime = Date.now();
        this.releaseReady = true;

        this.setData({
            releasePhaseText: '',
            showLiftNow: true,
        });

        wx.vibrateShort({ type: 'heavy' });

        // 3秒后自动判定
        this.liftTimer = setTimeout(() => {
            this._startElimination();
        }, 3000);
    },

    /**
     * longPress 进度定时器
     */
    _startLongPressProgressTimer() {
        this.longPressTimer = setInterval(() => {
            const { fingers, gameState } = this.data;
            if (gameState !== 'TOUCH_PHASE') {
                clearInterval(this.longPressTimer);
                this.longPressTimer = null;
                return;
            }

            const now = Date.now();
            let updated = false;
            const newFingers = fingers.map(f => {
                if (f.isEliminated || f.completed) return f;

                const mapEntry = this.touchMap.get(f.id);
                if (!mapEntry || !mapEntry.holdStartTime) return f;

                const elapsed = now - mapEntry.holdStartTime;
                const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1);
                const progressDeg = Math.round(progress * 360);

                if (progress >= 1 && !f.completed) {
                    // 完成长按 — completedTime 写入 finger 对象
                    updated = true;
                    mapEntry.completedTime = now;
                    return {
                        ...f,
                        completed: true,
                        completedTime: now,
                        progress: 360,
                        tapLabel: '✓',
                    };
                }

                if (progressDeg !== f.progress) {
                    updated = true;
                    return { ...f, progress: progressDeg };
                }
                return f;
            });

            if (updated) {
                this.setData({ fingers: newFingers });
            }
        }, LONG_PRESS_CHECK_INTERVAL);
    },

    // ==================== 淘汰流程 ====================

    /**
     * 开始淘汰 - 根据 gameMode 调用对应的判定函数
     */
    _startElimination() {
        this._clearAllTimers();

        const handler = this._touchHandlers[this.data.gameMode];
        if (handler && handler.onJudge) {
            handler.onJudge.call(this);
        } else {
            this._press_onJudge();
        }
    },

    /**
     * 执行淘汰动画（通用方法，接收 loser 和排序后的其他手指）
     */
    _executeElimination(loser, othersToEliminate) {
        if (!loser) {
            this._resetGame();
            return;
        }

        if (othersToEliminate.length === 0) {
            this._showWinner(loser);
            return;
        }

        this.loser = loser;
        this.eliminationQueue = othersToEliminate;
        this.eliminationIndex = 0;

        this.setData({ gameState: 'ELIMINATING' });
        this._eliminateNext();
    },

    _eliminateNext() {
        if (this.eliminationIndex >= this.eliminationQueue.length) {
            this.eliminationTimer = setTimeout(() => {
                if (this.loser) {
                    this._showWinner(this.loser);
                }
            }, 300);
            return;
        }

        const fingerToEliminate = this.eliminationQueue[this.eliminationIndex];
        this.eliminationIndex++;

        const newFingers = this.data.fingers.map(f => {
            if (f.id === fingerToEliminate.id) {
                return { ...f, isEliminated: true };
            }
            return f;
        });

        this.setData({ fingers: newFingers });
        wx.vibrateShort({ type: 'light' });

        this.eliminationTimer = setTimeout(() => {
            this._eliminateNext();
        }, 400);
    },

    _showWinner(winner) {
        const newFingers = this.data.fingers.map(f => ({
            ...f,
            isWinner: f.id === winner.id
        }));

        this.setData({
            gameState: 'RESULT',
            fingers: newFingers,
            winnerColor: winner.color
        });

        wx.vibrateShort({ type: 'heavy' });
    },

    _resetGame() {
        this._clearAllTimers();
        this.touchMap.clear();
        this.loser = null;
        this.eliminationQueue = [];
        this.eliminationIndex = 0;
        this.tapRecords = [];
        this.liftTime = 0;
        this.releaseReady = false;
        this.earlyReleasers = [];

        this.setData({
            gameState: 'SETUP',
            fingers: [],
            currentCount: 0,
            touchCountdown: 3,
            releasePhaseText: '',
            showLiftNow: false,
            showFoulCard: false,
        });
    },

    /**
     * 显示抢跑犯规卡片并判定抢跑者为输家
     * @param {number|string} foulFingerId - 抢跑的手指ID
     */
    _showFoulCard(foulFingerId) {
        this._clearAllTimers();

        // 找到抢跑者的手指数据
        const foulFinger = this.data.fingers.find(f => f.id === foulFingerId);
        const foulColor = foulFinger ? foulFinger.color : '#FF0055';

        // 标记抢跑者为 winner（输家高亮），其他人淘汰
        const newFingers = this.data.fingers.map(f => ({
            ...f,
            isWinner: f.id === foulFingerId,
            isEliminated: f.id !== foulFingerId,
        }));

        this.setData({
            showFoulCard: true,
            gameState: 'FOUL',
            fingers: newFingers,
            winnerColor: foulColor,
        });
        wx.vibrateShort({ type: 'heavy' });
    },

    /**
     * 关闭犯规卡片并重置游戏
     */
    onDismissFoul() {
        this._resetGame();
    },

    // ==================== 触摸事件分发 ====================

    onTouchStart(e) {
        const { gameState, gameMode } = this.data;

        if (gameState === 'RESULT') {
            this._resetGame();
            return;
        }

        if (gameState === 'WAITING' || gameState === 'TOUCH_PHASE') {
            const handler = this._touchHandlers[gameMode];
            if (handler && handler.onStart) {
                handler.onStart.call(this, e);
            }
        }
    },

    onTouchMove(e) {
        const { gameState, gameMode } = this.data;
        if (gameState === 'WAITING' || gameState === 'TOUCH_PHASE' || gameState === 'ELIMINATING') {
            const handler = this._touchHandlers[gameMode];
            if (handler && handler.onMove) {
                handler.onMove.call(this, e);
            }
        }
    },

    onTouchEnd(e) {
        const { gameState, gameMode } = this.data;
        const handler = this._touchHandlers[gameMode];

        if (gameState === 'TOUCH_PHASE' || gameState === 'ELIMINATING') {
            if (handler && handler.onEnd) {
                handler.onEnd.call(this, e);
                return;
            }
        }

        // 非活跃阶段：清理 touchMap
        const changedTouches = e.changedTouches || [];
        for (const touch of changedTouches) {
            this.touchMap.delete(touch.identifier);
        }
    },

    onTouchCancel(e) {
        const { gameState, gameMode } = this.data;
        const handler = this._touchHandlers[gameMode];

        if (gameState === 'TOUCH_PHASE' || gameState === 'ELIMINATING') {
            if (handler && handler.onCancel) {
                handler.onCancel.call(this, e);
                return;
            }
        }

        // 默认：清理 touchMap
        const changedTouches = e.changedTouches || [];
        for (const touch of changedTouches) {
            this.touchMap.delete(touch.identifier);
        }
    },

    // ============================================================
    //  策略实现：press（原有逻辑）
    // ============================================================

    _press_onStart(e) {
        this._addFingersFromTouches(e);
    },

    _press_onMove(e) {
        this._updateFingerPositions(e);
    },

    _press_onEnd(e) {
        const { gameState, fingers } = this.data;
        const changedTouches = e.changedTouches || [];

        if (gameState !== 'TOUCH_PHASE' && gameState !== 'ELIMINATING') {
            for (const touch of changedTouches) {
                this.touchMap.delete(touch.identifier);
            }
            return;
        }

        for (const touch of changedTouches) {
            this.touchMap.delete(touch.identifier);
        }

        const releasedIds = changedTouches.map(t => t.identifier);
        const newFingers = fingers.map(f => {
            if (releasedIds.includes(f.id) && !f.isEliminated) {
                return { ...f, isEliminated: true };
            }
            return f;
        });

        this.setData({ fingers: newFingers });

        const activeFingers = newFingers.filter(f => !f.isEliminated);
        if (activeFingers.length === 1) {
            this._showWinner(activeFingers[0]);
        } else if (activeFingers.length === 0) {
            this._resetGame();
        }
    },

    _press_onJudge() {
        const { fingers } = this.data;
        const activeFingers = fingers.filter(f => !f.isEliminated);

        if (activeFingers.length === 0) {
            this._resetGame();
            return;
        }
        if (activeFingers.length === 1) {
            this._showWinner(activeFingers[0]);
            return;
        }

        // 最晚按下的人输
        const sorted = [...activeFingers].sort((a, b) => a.touchTime - b.touchTime);
        const loser = sorted[sorted.length - 1];
        const others = sorted.slice(0, -1);
        this._executeElimination(loser, others);
    },

    // ============================================================
    //  策略实现：doubleTap / tripleTap
    // ============================================================

    _tap_onStart(e) {
        const { gameMode } = this.data;
        const targetTaps = gameMode === 'tripleTap' ? 3 : 2;
        const touches = e.changedTouches || [];
        const now = Date.now();

        for (const touch of touches) {
            const x = touch.clientX;
            const y = touch.clientY;

            // Bug5: 检查是否点在已完成的圆环区域内 → 无效点击
            let hitCompleted = false;
            for (const record of this.tapRecords) {
                if (!record.completed) continue;
                const dx = x - record.lastX;
                const dy = y - record.lastY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < TAP_MATCH_RADIUS) {
                    hitCompleted = true;
                    break;
                }
            }
            if (hitCompleted) continue; // 忽略此点击

            // 尝试匹配已有的未完成 tapRecord（贪心最近匹配）
            let bestMatch = null;
            let bestDist = Infinity;

            for (const record of this.tapRecords) {
                if (record.completed) continue;
                const dx = x - record.lastX;
                const dy = y - record.lastY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const interval = now - record.lastTime;

                if (dist < TAP_MATCH_RADIUS &&
                    interval > TAP_MIN_INTERVAL &&
                    interval < TAP_MAX_INTERVAL &&
                    dist < bestDist) {
                    bestDist = dist;
                    bestMatch = record;
                }
            }

            if (bestMatch) {
                // 匹配成功：增加点击计数
                bestMatch.tapCount++;
                bestMatch.lastX = x;
                bestMatch.lastY = y;
                bestMatch.lastTime = now;

                if (bestMatch.tapCount >= targetTaps) {
                    // 完成！创建光圈（仅在完成时才显示）
                    bestMatch.completed = true;
                    bestMatch.completedTime = now;

                    const fingerData = {
                        id: 'tap_' + bestMatch.id,
                        x: x,
                        y: y,
                        color: bestMatch.color,
                        touchTime: bestMatch.startTime,
                        completedTime: now,
                        completed: true,
                        isEliminated: false,
                        isWinner: false,
                        tapLabel: '✓',
                    };

                    const newFingers = [...this.data.fingers, fingerData];
                    this.setData({ fingers: newFingers });
                }

                wx.vibrateShort({ type: 'light' });
            } else {
                // Bug6: 总记录数限制5个（包括已完成的），确保最多5个颜色
                if (this.tapRecords.length >= 5) continue;

                // 获取颜色：排除所有已用颜色
                const usedColors = new Set();
                this.tapRecords.forEach(r => usedColors.add(r.color));
                let nextColor = null;
                for (let ci = 0; ci < COLORS.length; ci++) {
                    if (!usedColors.has(COLORS[ci])) { nextColor = COLORS[ci]; break; }
                }
                // 所有颜色都已用完 → 不接受新玩家
                if (!nextColor) continue;

                const recordId = Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                const record = {
                    id: recordId,
                    startTime: now,
                    lastX: x,
                    lastY: y,
                    lastTime: now,
                    tapCount: 1,
                    color: nextColor,
                    completed: false,
                    completedTime: 0,
                };
                this.tapRecords.push(record);

                wx.vibrateShort({ type: 'light' });
            }
        }
    },

    _tap_onJudge() {
        // 只看已完成的 tapRecords（未完成的不参与判定，也没有光圈）
        const completedRecords = this.tapRecords.filter(r => r.completed);

        if (completedRecords.length === 0) {
            this._resetGame();
            return;
        }

        // 按完成时间排序
        completedRecords.sort((a, b) => a.completedTime - b.completedTime);

        if (completedRecords.length === 1) {
            const onlyFinger = this.data.fingers.find(
                f => f.id === 'tap_' + completedRecords[0].id
            );
            if (onlyFinger) {
                this._showWinner(onlyFinger);
            } else {
                this._resetGame();
            }
            return;
        }

        // 输家是最晚完成的
        const loserRecord = completedRecords[completedRecords.length - 1];
        const loserFinger = this.data.fingers.find(f => f.id === 'tap_' + loserRecord.id);

        if (!loserFinger) {
            this._resetGame();
            return;
        }

        // 其他人按顺序淘汰
        const others = completedRecords.slice(0, -1)
            .map(r => this.data.fingers.find(f => f.id === 'tap_' + r.id))
            .filter(Boolean);

        this._executeElimination(loserFinger, others);
    },

    // ============================================================
    //  策略实现：release（先按住，最快松手赢）
    // ============================================================

    _release_onStart(e) {
        this._addFingersFromTouches(e);

        // 显示已按住人数
        const count = this.touchMap.size;
        if (count >= 2) {
            this.setData({
                releasePhaseText: i18n.formatString(this.data.uiCopy.modeReady || '{count}人已就位', {
                    count: count
                })
            });
        }
    },

    _release_onEnd(e) {
        const { gameState, fingers } = this.data;
        const changedTouches = e.changedTouches || [];
        const now = Date.now();

        // 记录松手的手指ID
        const releasedIds = changedTouches.map(t => t.identifier);

        for (const touch of changedTouches) {
            const finger = this.touchMap.get(touch.identifier);
            if (finger) {
                finger.releaseTime = now;
            }
            this.touchMap.delete(touch.identifier);
        }

        if (gameState !== 'TOUCH_PHASE' && gameState !== 'ELIMINATING') return;

        // 检测抢跑：如果 releaseReady 还未设置（"松!"还没出现），则为抢跑
        if (!this.releaseReady) {
            // 抢跑！判定第一个松手的人为输家
            this._showFoulCard(releasedIds[0]);
            return;
        }

        // "松!"已出现：正常记录 releaseTime
        const newFingers = fingers.map(f => {
            if (releasedIds.includes(f.id)) {
                return {
                    ...f,
                    releaseTime: f.releaseTime || now,
                    completed: true,
                };
            }
            return f;
        });

        this.setData({ fingers: newFingers });
    },

    _release_onJudge() {
        const { fingers } = this.data;

        if (fingers.length === 0) {
            this._resetGame();
            return;
        }

        // 给未松手的人设置一个很大的 releaseTime（他们最慢）
        const now = Date.now();
        const scoredFingers = fingers.map(f => ({
            ...f,
            releaseTime: f.releaseTime || (now + 999999),
        }));

        if (scoredFingers.length === 1) {
            this._showWinner(scoredFingers[0]);
            return;
        }

        // 按 releaseTime 排序：最晚松手的输
        const sorted = [...scoredFingers].sort((a, b) => a.releaseTime - b.releaseTime);
        const loser = sorted[sorted.length - 1];
        const others = sorted.slice(0, -1);
        this._executeElimination(loser, others);
    },

    // ============================================================
    //  策略实现：longPress（按住3秒）
    // ============================================================

    _longPress_onStart(e) {
        const touches = e.changedTouches || [];
        const { fingers } = this.data;
        const maxFingers = 5;

        // Bug2: 检查当前未淘汰的活跃手指数（不算已离开的）
        const activeFingerCount = fingers.filter(f => !f.isEliminated).length;
        if (activeFingerCount >= maxFingers) return;

        const newFingers = [...fingers];
        let currentActive = activeFingerCount;

        for (const touch of touches) {
            if (currentActive >= maxFingers) break;
            if (this.touchMap.has(touch.identifier)) continue;

            // 检查此 touch.identifier 是否已有对应的 finger（防止离开后重新进入时重复创建）
            const existingIdx = newFingers.findIndex(f => f.id === touch.identifier && !f.isEliminated);
            if (existingIdx >= 0) {
                // 已有此手指：恢复 touchMap 追踪，并重置 finger 进度
                const now2 = Date.now();
                this.touchMap.set(touch.identifier, {
                    ...newFingers[existingIdx],
                    holdStartTime: now2,
                    completedTime: 0,
                });
                // 重置 fingers 中的进度
                newFingers[existingIdx] = {
                    ...newFingers[existingIdx],
                    progress: 0,
                    completed: false,
                    completedTime: 0,
                    tapLabel: '',
                };
                continue;
            }

            // Bug2: 颜色分配必须检查所有 fingers（包括已淘汰的）和 touchMap
            var usedColors = new Set();
            this.touchMap.forEach(function (finger) { usedColors.add(finger.color); });
            newFingers.forEach(function (f) { usedColors.add(f.color); });
            var nextColor = null;
            for (var ci = 0; ci < COLORS.length; ci++) {
                if (!usedColors.has(COLORS[ci])) { nextColor = COLORS[ci]; break; }
            }
            if (!nextColor) break; // 所有颜色用完

            const now = Date.now();
            const fingerData = {
                id: touch.identifier,
                x: touch.clientX,
                y: touch.clientY,
                color: nextColor,
                touchTime: now,
                isEliminated: false,
                isWinner: false,
                completed: false,
                progress: 0,
                tapLabel: '',
            };

            const mapEntry = {
                ...fingerData,
                holdStartTime: now,
                completedTime: 0,
            };

            this.touchMap.set(touch.identifier, mapEntry);
            newFingers.push(fingerData);
            currentActive++;
        }

        this.setData({ fingers: newFingers });
    },

    _longPress_onEnd(e) {
        const changedTouches = e.changedTouches || [];

        for (const touch of changedTouches) {
            const mapEntry = this.touchMap.get(touch.identifier);
            if (mapEntry && !mapEntry.completedTime) {
                // 未完成长按就松手：重置 holdStartTime
                // 如果重新按下会生成新的 finger
            }
            this.touchMap.delete(touch.identifier);
        }

        // 标记松开的手指：如果未完成长按则淘汰
        const { fingers, gameState } = this.data;
        if (gameState !== 'TOUCH_PHASE' && gameState !== 'ELIMINATING') return;

        const releasedIds = changedTouches.map(t => t.identifier);
        const newFingers = fingers.map(f => {
            if (releasedIds.includes(f.id) && !f.completed) {
                return { ...f, isEliminated: true, tapLabel: '✕' };
            }
            return f;
        });

        this.setData({ fingers: newFingers });
    },

    _longPress_onJudge() {
        const { fingers } = this.data;

        // 已完成的 + 未完成的
        const completedFingers = fingers.filter(f => f.completed && !f.isEliminated);
        const activeNotCompleted = fingers.filter(f => !f.completed && !f.isEliminated);

        // 未完成的标记淘汰
        if (activeNotCompleted.length > 0) {
            const newFingers = fingers.map(f => {
                if (!f.completed && !f.isEliminated) {
                    return { ...f, isEliminated: true, tapLabel: '✕' };
                }
                return f;
            });
            this.setData({ fingers: newFingers });
        }

        const allActive = completedFingers;

        if (allActive.length === 0) {
            // 没人完成，看原始手指（包括已淘汰的）
            if (fingers.length === 0) {
                this._resetGame();
                return;
            }
            // 从所有手指中选最晚按的
            const sorted = [...fingers].sort((a, b) => a.touchTime - b.touchTime);
            const loser = sorted[sorted.length - 1];
            const others = sorted.slice(0, -1);
            this._executeElimination(loser, others);
            return;
        }

        if (allActive.length === 1) {
            this._showWinner(allActive[0]);
            return;
        }

        // 按 completedTime 排序（completedTime 现在存储在 finger 对象上）
        const scored = [...allActive].sort((a, b) => {
            const aTime = a.completedTime || a.touchTime || 0;
            const bTime = b.completedTime || b.touchTime || 0;
            return aTime - bTime;
        });

        const loser = scored[scored.length - 1];
        const others = scored.slice(0, -1);
        this._executeElimination(loser, others);
    },

    // ============================================================
    //  策略实现：liftFinger（等指令松手）
    // ============================================================

    _liftFinger_onStart(e) {
        this._addFingersFromTouches(e);

        // 更新按住人数提示
        const count = this.touchMap.size;
        if (!this.releaseReady && count >= 2) {
            this.setData({
                releasePhaseText: i18n.formatString(this.data.uiCopy.modeReady || '{count}人已就位', {
                    count: count
                })
            });
        }
    },

    _liftFinger_onEnd(e) {
        const changedTouches = e.changedTouches || [];
        const now = Date.now();

        const releasedIds = changedTouches.map(t => t.identifier);

        for (const touch of changedTouches) {
            const finger = this.touchMap.get(touch.identifier);
            if (finger) {
                finger.releaseTime = now;
            }
            this.touchMap.delete(touch.identifier);
        }

        const { fingers, gameState } = this.data;
        if (gameState !== 'TOUCH_PHASE') return;

        if (!this.releaseReady) {
            // "松!"还没出现就松手 = 抢跑，判定抢跑者为输家
            this._showFoulCard(releasedIds[0]);
            return;
        } else {
            // "松!"已出现：记录松手时间
            const newFingers = fingers.map(f => {
                if (releasedIds.includes(f.id)) {
                    return { ...f, releaseTime: now, completed: true };
                }
                return f;
            });
            this.setData({ fingers: newFingers });
        }
    },

    _liftFinger_onJudge() {
        const { fingers } = this.data;

        if (fingers.length === 0) {
            this._resetGame();
            return;
        }

        // 抢跑的人直接排最后
        const now = Date.now();
        const scoredFingers = fingers.map(f => {
            if (f.isEliminated && this.earlyReleasers.includes(f.id)) {
                // 抢跑：设为最大 releaseTime
                return { ...f, releaseTime: now + 999999 };
            }
            return {
                ...f,
                releaseTime: f.releaseTime || (now + 999998),
            };
        });

        if (scoredFingers.length === 1) {
            this._showWinner(scoredFingers[0]);
            return;
        }

        // 按 releaseTime 排序：最晚松手/抢跑的输
        const sorted = [...scoredFingers].sort((a, b) => a.releaseTime - b.releaseTime);
        const loser = sorted[sorted.length - 1];
        const others = sorted.slice(0, -1);
        this._executeElimination(loser, others);
    },

    // ============================================================
    //  通用工具方法
    // ============================================================

    /**
     * 从触摸事件中添加手指光圈（press / release / liftFinger 共用）
     */
    _addFingersFromTouches(e) {
        const touches = e.changedTouches || [];
        const { fingers } = this.data;
        const maxFingers = 5;

        if (this.touchMap.size >= maxFingers) return;

        const newFingers = [...fingers];

        for (const touch of touches) {
            if (this.touchMap.size >= maxFingers) break;
            if (this.touchMap.has(touch.identifier)) continue;

            var usedColors = new Set();
            this.touchMap.forEach(function (finger) { usedColors.add(finger.color); });
            newFingers.forEach(function (f) { usedColors.add(f.color); });
            var nextColor = null;
            for (var ci = 0; ci < COLORS.length; ci++) {
                if (!usedColors.has(COLORS[ci])) { nextColor = COLORS[ci]; break; }
            }
            if (!nextColor) break; // 所有颜色用完，不再接受新手指

            const fingerData = {
                id: touch.identifier,
                x: touch.clientX,
                y: touch.clientY,
                color: nextColor,
                touchTime: Date.now(),
                isEliminated: false,
                isWinner: false,
            };

            this.touchMap.set(touch.identifier, fingerData);
            newFingers.push(fingerData);
        }

        this.setData({ fingers: newFingers });
    },

    /**
     * 更新手指位置（press / release / longPress / liftFinger 共用）
     */
    _updateFingerPositions(e) {
        const touches = e.touches || [];
        const { fingers } = this.data;

        const updatedFingers = fingers.map(finger => {
            const touch = Array.from(touches).find(t => t.identifier === finger.id);
            if (touch) {
                return { ...finger, x: touch.clientX, y: touch.clientY };
            }
            return finger;
        });

        this.setData({ fingers: updatedFingers });
    },

    // ==================== 游戏统计 ====================

    _reportGamePlay() {
        const app = getApp();
        app.addGameStat('countdown');
    },

    // ==================== 分享功能 ====================

    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '倒计时 | 抓手指-满分激光枪',
            path: '/pages/tool-countdown/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.shareTitle || '倒计时 | 抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    }
});
