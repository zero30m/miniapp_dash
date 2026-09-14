// 统计数据缓存
const GAME_STATS_CACHE_KEY = 'game_stats_cache';
const GAME_STATS_CACHE_TIME_KEY = 'game_stats_cache_time';
const GAME_STATS_TTL = 6 * 60 * 60 * 1000; // 【优化】延长到6小时

// 导入图片配置
const { IMAGE_URLS } = require('../../utils/config');
const i18n = require('../../utils/i18n');
const diyEngine = require('../../utils/diy_engine.js');
// 导入实时日志工具
const log = require('../../utils/log');

Page({
    data: {
        activeGame: 'drinking',
        animationClass: '',
        headerPaddingTop: 100,
        isExpanded: true,  // 默认展开选择器，让用户先选择游戏
        isClosing: false,
        isSwitching: false,  // 【修复】游戏切换中标志，阻止页面WXS下拉追踪
        gameAreaPaddingTop: 0,
        locale: 'zh-Hans',

        // 【新增】视图模式: 'simple' 简约视图 | 'detail' 详情视图
        viewMode: 'simple',
        isViewSwitching: false,
        uiCopy: i18n.getPageCopy('games'),

        gameNames: i18n.getGameNames(),
        gameInfo: i18n.getGameInfo(),

        // DIY 卡牌参数与生成后的独立牌组
        players: 4,
        alcohol: 50,
        stimulation: 50,
        depth: 50,
        ambiguity: 50,
        customCards: [],
        diyFabTop: 100,

        // 游戏列表原始顺序（_computeRecentGames 会重排）
        gameList: ['drinking', 'kiss', 'chess', 'dare', 'we', 'zhexuejia', 'taiqiu', 'couple_dare', 'couple_talk', 'coffee', 'diy', 'more'],

        // 卡牌上线/更新时间戳（手动维护，精确到天）
        cardUpdateTime: {
            drinking: 1767225600000,  // 2026-01-01
            kiss: 1767225600000,  // 2026-01-01
            chess: 1767225600000,  // 2026-01-01
            dare: 1767225600000,  // 2026-01-01
            we: 1767225600000,  // 2026-01-01
            zhexuejia: 1767225600000,  // 2026-01-01
            taiqiu: 1767225600000,  // 2026-01-01
            couple_dare: 1767225600000,  // 2026-01-01
            couple_talk: 1767225600000,  // 2026-01-01
            coffee: 1767225600000   // 2026-01-01
        },

        // 「新」标记映射（由 _computeRecentGames 计算）
        recentGames: {},

        // 游戏统计数据
        gameStats: {},

        // 【新增】登录状态（从首页迁移）
        isLoggedIn: false,
        requireLogin: false,
        configLoaded: false,
        welcomeImage: ''
    },

    // 触摸状态追踪
    _overlayStartY: 0,
    _overlayCurrentY: 0,
    _lastVibrateTime: 0,
    _animationTimer: null,  // 【内存优化】保存动画定时器引用
    _debounceTimer: null,

    onLoad() {
        try {
            this._syncI18n();
            this._generateDiyCards();
            this._computeRecentGames();
            this._calculateLayout();
            this._loadGameStats();
        } catch (e) {
            log.reportLifecycleError('onLoad', 'games', e);
        }
    },

    /**
     * 计算「最近更新」标记并重排 gameList
     * 更新时间在 3 天内的卡牌置顶，多款按时间从新到旧排列，'more' 始终末尾
     */
    _computeRecentGames() {
        var now = Date.now();
        var THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        var updateMap = this.data.cardUpdateTime;
        var recentGames = {};

        for (var key in updateMap) {
            if (now - updateMap[key] < THREE_DAYS) {
                recentGames[key] = true;
            }
        }

        var original = ['drinking', 'kiss', 'chess', 'dare', 'we', 'zhexuejia', 'taiqiu', 'couple_dare', 'couple_talk', 'coffee', 'diy'];
        var recent = [];
        var rest = [];

        original.forEach(function (g) {
            if (recentGames[g]) {
                recent.push(g);
            } else {
                rest.push(g);
            }
        });

        recent.sort(function (a, b) {
            return (updateMap[b] || 0) - (updateMap[a] || 0);
        });

        this.setData({
            gameList: recent.concat(rest).concat(['more']),
            recentGames: recentGames
        });
    },

    /**
     * 加载游戏统计数据（带缓存）
     */
    _loadGameStats() {
        // 检查缓存
        try {
            const cacheTime = wx.getStorageSync(GAME_STATS_CACHE_TIME_KEY);
            if (cacheTime && (Date.now() - cacheTime) < GAME_STATS_TTL) {
                const cached = wx.getStorageSync(GAME_STATS_CACHE_KEY);
                if (cached) {
                    this.setData({ gameStats: cached });
                    return;
                }
            }
        } catch (e) { }

        // 从云函数获取
        wx.cloud.callFunction({
            name: 'gameStats',
            data: { action: 'get' },
            success: res => {
                if (res?.result?.success && res.result.data?.global) {
                    const stats = res.result.data.global;
                    this.setData({ gameStats: stats });

                    // 缓存
                    try {
                        wx.setStorageSync(GAME_STATS_CACHE_KEY, stats);
                        wx.setStorageSync(GAME_STATS_CACHE_TIME_KEY, Date.now());
                    } catch (e) { }
                }
            }
        });

        // 【调试】体验版自动发送测试日志
        log.testOnPageLoad('games');
    },

    _calculateLayout() {
        try {
            const menuBtn = wx.getMenuButtonBoundingClientRect();
            const windowInfo = wx.getWindowInfo();

            let top;
            if (menuBtn && menuBtn.bottom > 0) {
                top = menuBtn.bottom + 12;
            } else {
                top = (windowInfo.safeArea?.top || 44) + 50;
            }

            // 计算卡牌区域的自适应 padding
            // 屏幕高度 - header高度 - tabbar高度(约100px) - 安全区域
            const screenHeight = windowInfo.windowHeight;
            const headerHeight = top + 100; // pill header 区域
            const tabbarHeight = 100 + (windowInfo.safeArea?.bottom ? 34 : 0);
            const availableHeight = screenHeight - headerHeight - tabbarHeight;

            // 卡牌高度约 460px (920rpx)，计算居中所需的 padding
            const cardHeight = 460;
            const paddingTop = Math.max(0, (availableHeight - cardHeight) / 2 - 20);

            this.setData({
                headerPaddingTop: top,
                gameAreaPaddingTop: 0,
                diyFabTop: top
            });
        } catch (e) {
            this.setData({ headerPaddingTop: 100, gameAreaPaddingTop: 0, diyFabTop: 100 });
        }
    },

    onShow() {
        try {
            const app = getApp();
            this._syncI18n();

            // 【内存优化】清理之前的动画定时器
            if (this._animationTimer) {
                clearTimeout(this._animationTimer);
                this._animationTimer = null;
            }

            // 【修复】清理之前的恢复定时器
            if (this._recoveryTimer) {
                clearTimeout(this._recoveryTimer);
                this._recoveryTimer = null;
            }

            // 【修复】使用全局 isResuming 标记检查是否是从后台恢复
            const now = Date.now();

            // 【修复-方案B】使用页面栈深度判断是否是从 reLaunch 进入
            // reLaunch 创建的页面，页面栈深度 = 1，不应被视为"恢复"
            const pages = getCurrentPages();
            const isFromReLaunch = pages.length === 1;

            // 使用 isResuming 标记或时间戳判断（双重保险），但排除 reLaunch 情况
            const isResume = !isFromReLaunch && (app.globalData.isResuming || (now - app.globalData.lastAppShowTime) < 500);

            // 【修复-思路6】调试日志
            console.log('[games] onShow, isResume:', isResume, 'isFromReLaunch:', isFromReLaunch,
                'isExpanded:', this.data.isExpanded, 'activeGame:', this.data.activeGame);

            // 【修复-风险2】无论 isExpanded 状态如何，后台恢复时都执行恢复逻辑
            if (isResume) {
                // 更新登录状态
                this.setData({
                    isLoggedIn: app.globalData.isLoggedIn || false,
                    requireLogin: app.globalData.requireLogin || false,
                    configLoaded: true,
                    welcomeImage: app.globalData.cachedAssets?.welcomeImage || IMAGE_URLS.WELCOME_GIF
                });

                // 使用 wx.nextTick + 延迟强制刷新渲染
                wx.nextTick(() => {
                    this._calculateLayout();

                    // 延迟触发强制刷新
                    this._recoveryTimer = setTimeout(() => {
                        this.setData({
                            _refreshTrigger: Date.now()
                        });
                        this._calculateLayout();

                        // 强制刷新 drinking-game 组件
                        const drinkingGame = this.selectComponent('#drinkingGame');
                        if (drinkingGame) {
                            console.log('[games] Checking drinkingGame, displayCards:', drinkingGame.data.displayCards?.length);
                            if (!drinkingGame.data.displayCards || drinkingGame.data.displayCards.length === 0) {
                                console.log('[games] Force reinitializing drinkingGame');
                                drinkingGame.initGame();
                            }
                        }
                    }, 80);

                    // 【新增-终极方案】500ms 后检测是否恢复失败，如果失败则跳转首页
                    this._fallbackTimer = setTimeout(() => {
                        const drinkingGame = this.selectComponent('#drinkingGame');
                        const hasCards = drinkingGame && drinkingGame.data.displayCards && drinkingGame.data.displayCards.length > 0;

                        // 如果 displayCards 仍然为空且不在展开状态，说明恢复失败
                        if (!hasCards && !this.data.isExpanded) {
                            // 【实时日志】上报恢复失败错误
                            log.reportRecoveryFailure('games', 'displayCards empty after 500ms', {
                                activeGame: this.data.activeGame,
                                isExpanded: this.data.isExpanded
                            });
                            // 【修复-方案A】在 reLaunch 前重置 isResuming，防止新页面被误判为恢复
                            app.globalData.isResuming = false;
                            wx.reLaunch({ url: '/pages/home/index' });
                        }
                    }, 500);
                });
            } else {
                // 正常进入时的逻辑
                this.setData({
                    isLoggedIn: app.globalData.isLoggedIn || false,
                    requireLogin: app.globalData.requireLogin || false,
                    configLoaded: true,
                    welcomeImage: app.globalData.cachedAssets?.welcomeImage || IMAGE_URLS.WELCOME_GIF,
                    animationClass: '',
                    isExpanded: true,
                    isClosing: false
                }, () => {
                    this._animationTimer = setTimeout(() => {
                        this.setData({ animationClass: 'page-entry-animate' });
                    }, 50);
                });
            }

            // 【方案B】TabBar 恢复检查 - 强制确保 TabBar 可见
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar) {
                const shouldUnblur = !app.globalData.requireLogin || app.globalData.isLoggedIn;
                const newBlurred = !shouldUnblur;

                // 【优化】后台恢复时强制刷新 TabBar，避免渲染异常
                if (isResume) {
                    // 【修复】使用 wx.nextTick 确保 TabBar 正确恢复
                    wx.nextTick(() => {
                        tabBar.setData({
                            selected: 2,
                            hidden: false,
                            blurred: newBlurred
                        });
                    });
                } else {
                    // 正常进入时只在需要时更新
                    const needsUpdate = tabBar.data.selected !== 2 ||
                        tabBar.data.hidden !== false ||
                        tabBar.data.blurred !== newBlurred;

                    if (needsUpdate) {
                        tabBar.setData({
                            selected: 2,
                            hidden: false,
                            blurred: newBlurred
                        });
                    }
                }

                // 同步管理员状态
                if (app.globalData.isAdmin) {
                    tabBar.updateAdminStatus(true);
                }
            }
        } catch (e) {
            log.reportLifecycleError('onShow', 'games', e);
        }
    },

    onHide() {
        // 【内存优化】清理动画定时器
        if (this._animationTimer) {
            clearTimeout(this._animationTimer);
            this._animationTimer = null;
        }
        // 【修复】清理恢复定时器
        if (this._recoveryTimer) {
            clearTimeout(this._recoveryTimer);
            this._recoveryTimer = null;
        }
        // 【修复】清理回退定时器
        if (this._fallbackTimer) {
            clearTimeout(this._fallbackTimer);
            this._fallbackTimer = null;
        }
        this.setData({ animationClass: '', isExpanded: false, isClosing: false });
    },

    /**
     * 阻止事件冒泡
     */
    preventBubble() { },

    /**
     * 【优化】切换视图模式（简约 ↔ 详情）- 单按钮切换
     */
    toggleViewMode() {
        const newMode = this.data.viewMode === 'simple' ? 'detail' : 'simple';
        this._vibrate('light');

        // 直接切换，让 CSS transition 处理动画
        this.setData({ viewMode: newMode });
    },

    /**
     * 震动反馈（带防抖）- 优化：减少防抖时间
     */
    _vibrate(type) {
        const now = Date.now();
        if (now - this._lastVibrateTime < 80) return;  // 从 100ms 减少到 80ms
        this._lastVibrateTime = now;
        wx.vibrateShort({ type: type || 'light' });
    },

    /**
     * 覆盖层触摸开始
     */
    onOverlayTouch(e) {
        if (e.touches && e.touches[0]) {
            this._overlayStartY = e.touches[0].clientY;
            this._overlayCurrentY = this._overlayStartY;
            this._touchMoved = false;
        }
    },

    /**
     * 【新增】覆盖层点击处理 - 只在简约视图下允许点击关闭
     */
    onOverlayTap() {
        // 【修复】刚打开时忽略 overlay 点击，防止下拉手势残留事件触发关闭
        if (this._justOpened) return;

        // 详情视图下禁用点击关闭，避免误触
        if (this.data.viewMode === 'simple') {
            this.closeSelector();
        }
    },

    /**
     * 覆盖层滑动
     */
    onOverlaySwipe(e) {
        if (e.touches && e.touches[0]) {
            this._overlayCurrentY = e.touches[0].clientY;
            this._touchMoved = true;
        }
    },

    /**
     * 覆盖层触摸结束（上滑关闭）
     */
    onOverlayTouchEnd(e) {
        // 【修复】刚打开时忽略触摸结束，防止下拉手势残留事件干扰
        if (this._justOpened) {
            this._overlayStartY = 0;
            this._overlayCurrentY = 0;
            this._touchMoved = false;
            return;
        }

        const dy = this._overlayCurrentY - this._overlayStartY;

        // 【优化】只在简约视图下允许上滑关闭，详情视图下禁用以避免误触
        if (this.data.viewMode === 'simple' && this._touchMoved && dy < -40) {
            this.closeSelector();
        }
        // 重置
        this._overlayStartY = 0;
        this._overlayCurrentY = 0;
        this._touchMoved = false;
    },

    /**
     * 展开选择器（由 WXS 调用）
     */
    expandSelector() {
        this._vibrate('heavy');
        this.setData({ isExpanded: true });
    },

    _refreshGameStageLayout(delay) {
        const drinkingGame = this.selectComponent('#drinkingGame');
        if (drinkingGame && typeof drinkingGame.refreshStageLayout === 'function') {
            drinkingGame.refreshStageLayout(delay || 80);
        }
    },

    /**
     * 关闭选择器 - 优化：减少延迟
     */
    closeSelector() {
        if (!this.data.isExpanded || this.data.isClosing) return;

        this._vibrate('light');

        // 【优化】立即关闭，无动画延迟
        this.setData({
            isExpanded: false,
            isClosing: false
        }, () => {
            wx.nextTick(() => {
                this._refreshGameStageLayout(90);
            });
        });

        /* 【原关闭动画逻辑 - 已注释】
        // 立即开始关闭动画，不设置 _isAnimating 以避免阻塞
        this.setData({ isClosing: true });

        // 缩短动画等待时间
        setTimeout(() => {
            this.setData({
                isExpanded: false,
                isClosing: false
            });
        }, 180);  // 从 280ms 减少到 180ms
        */
    },

    /**
     * 选择游戏 - 优化版（减少延迟，提高响应）
     */
    selectGame(e) {
        console.log('[胶囊选择器] selectGame 被触发，目标游戏:', e.currentTarget.dataset.game);
        const game = e.currentTarget.dataset.game;
        if (!game) return;

        // 【修复】移除 isClosing 检查，因为 closeSelector 已改为立即关闭
        // 该状态可能残留导致点击被阻止

        const isChanged = game !== this.data.activeGame;

        this._vibrate(isChanged ? 'medium' : 'light');

        // 【特殊处理】'more' 游戏类型 - 显示提示而不是切换
        if (game === 'more') {
            wx.showToast({
                title: this.data.uiCopy.placeholderDesc,
                icon: 'none',
                duration: 1500
            });
            return;
        }

        if (isChanged) {
            // 【优化】立即切换游戏并关闭选择器
            // 注意：不需要手动调用 drinkingGame.switchGame()
            // 因为组件的 observer 会监听 gameType 变化并自动调用 switchGame
            // 【修复】设置 isSwitching 标志，阻止切换动画期间页面WXS的下拉追踪
            this.setData({
                activeGame: game,
                isExpanded: false,
                isClosing: false,
                isSwitching: true
            }, () => {
                wx.nextTick(() => {
                    this._refreshGameStageLayout(90);
                });
            });

            // 切换动画结束后（~500ms）解除锁定
            if (this._switchingTimer) clearTimeout(this._switchingTimer);
            this._switchingTimer = setTimeout(() => {
                this.setData({ isSwitching: false });
                this._switchingTimer = null;
            }, 500);
        } else {
            this.closeSelector();
        }
    },

    /**
     * DIY 设置变化后，沿用原 DIY 页面的生成逻辑刷新牌组。
     */
    onDiyParamsChange(e) {
        const params = e.detail.params;

        this.setData({
            players: params.players,
            alcohol: params.alcohol,
            stimulation: params.stimulation,
            depth: params.depth,
            ambiguity: params.ambiguity
        });

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(() => {
            this._generateDiyCards();
            this._debounceTimer = null;
        }, 300);
    },

    onDiyPanelChange(e) {
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({
                selected: 2,
                hidden: !!e.detail.expanded
            });
        }
    },

    _generateDiyCards() {
        const cards = diyEngine.generateDeck({
            players: this.data.players,
            alcohol: this.data.alcohol,
            stimulation: this.data.stimulation,
            depth: this.data.depth,
            ambiguity: this.data.ambiguity
        });

        this.setData({ customCards: cards });
    },

    /**
     * 下拉开始震动（由 WXS 调用）
     */
    onPullStart() {
        this._vibrate('light');
    },

    /**
     * 下拉结束震动并展开（由 WXS 调用）
     */
    onPullEnd() {
        this._vibrate('heavy');

        // 【修复】设置保护标志，防止下拉手势残留事件干扰
        this._justOpened = true;

        // 【修复】移除 _scrollDisabled，只设置 isExpanded
        // WXS 的 isExpandedFlag 已经可以解决竞态条件问题
        this.setData({ isExpanded: true });

        // 500ms 后取消事件保护
        setTimeout(() => {
            this._justOpened = false;
        }, 500);
    },

    // ==================== 分享功能 ====================

    onShareAppMessage() {
        const gameName = this.data.gameNames[this.data.activeGame] || this.data.uiCopy.gameNames.drinking;
        return {
            title: `${gameName} | ${this.data.uiCopy.shareSuffix}`,
            path: '/pages/games/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        const gameName = this.data.gameNames[this.data.activeGame] || this.data.uiCopy.gameNames.drinking;
        return {
            title: `${gameName} | ${this.data.uiCopy.shareSuffix}`,
            imageUrl: '/logo.png'
        };
    },

    // 【新增】登录成功回调（从首页迁移）
    onLoginSuccess(e) {
        const app = getApp();
        app.globalData.isLoggedIn = true;
        this.setData({ isLoggedIn: true });

        // 处理管理员状态
        if (e.detail?.admin) {
            app.globalData.isAdmin = true;
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar) {
                tabBar.updateAdminStatus(true);
                tabBar.setData({ blurred: false });
            }
        } else {
            // 非管理员也要取消模糊
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar) {
                tabBar.setData({ blurred: false });
            }
        }
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({
            locale: locale,
            uiCopy: i18n.getPageCopy('games', locale),
            gameNames: i18n.getGameNames(locale),
            gameInfo: i18n.getGameInfo(locale)
        });
    }
})
