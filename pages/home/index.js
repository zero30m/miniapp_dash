const { CloudFunctionManager } = require('../../utils/cloud');
const {
    IMAGE_URLS,
    CACHE_CONFIG,
    UI_CONFIG,
    TOOL_CARDS,
    CLOUD_FILE_IDS  // 仅用于字体加载
} = require('../../utils/config');
const i18n = require('../../utils/i18n');
const toolImageCache = require('../../utils/tool_image_cache');
// 导入实时日志工具
const log = require('../../utils/log');

const FAN_TEST_BANNER_URL = '/image-pack-fan/fan-banner-5e4dafba.png';

/**
 * 增强道具卡片数据（添加标题样式类）
 */
function enhanceToolCards(cards = []) {
    return cards.map(card => {
        const titleLength = (card.title || '').length;
        let titleClass = 'tool-card-title';
        if (titleLength >= 5) {
            titleClass += ' long';
        } else if (titleLength >= 3) {
            titleClass += ' medium';
        }
        return { ...card, titleClass };
    });
}

function getLocalizedToolCards(locale) {
    return enhanceToolCards(i18n.getLocalizedToolCards(TOOL_CARDS, locale)).map(card => ({
        ...card,
        // 资源就绪前不把分包路径交给 image，避免组件和预加载各自请求一次。
        mediaUrl: toolImageCache.getCachedToolImage(card.mediaUrl)
    }));
}

function getLocalizedSpecialBanner(locale) {
    const copy = i18n.getPageCopy('home', locale);
    const bannerCopy = copy.specialBanner || {};
    return {
        id: 'fan-test-entry',
        coverImage: toolImageCache.getCachedToolImage(FAN_TEST_BANNER_URL),
        imageMode: 'aspectFill',
        coverClass: 'fan-test-banner-cover',
        bgColor: '#F7DFC4',
        title: '读者测试',
        titleLines: [],
        desc: bannerCopy.desc || '快来测一测',
        btnText: bannerCopy.btnText || '去看看',
        isLoading: false
    };
}

/**
 * 从本地存储读取缓存的文章列表
 */
function getCachedArticles() {
    try {
        const cachedTime = wx.getStorageSync(CACHE_CONFIG.STORAGE_KEYS.ARTICLES_TIME);
        if (cachedTime && (Date.now() - cachedTime) < CACHE_CONFIG.ARTICLE_TTL) {
            const cached = wx.getStorageSync(CACHE_CONFIG.STORAGE_KEYS.ARTICLES);
            if (cached && cached.length > 0) {
                console.log('[Home] Using cached articles');
                return cached;
            }
        }
    } catch (e) {
        console.warn('[Home] Read cache failed:', e);
    }
    return null;
}

/**
 * 保存文章到本地存储
 */
function saveArticlesCache(articles) {
    try {
        wx.setStorageSync(CACHE_CONFIG.STORAGE_KEYS.ARTICLES, articles);
        wx.setStorageSync(CACHE_CONFIG.STORAGE_KEYS.ARTICLES_TIME, Date.now());
    } catch (e) {
        console.warn('[Home] Save cache failed:', e);
    }
}

// Banner渐变背景色（用于动态Banner）
const BANNER_GRADIENTS = [
    'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))',
    'linear-gradient(135deg, rgba(102,45,140,0.7) 0%, rgba(237,30,121,0.7) 100%)',
    'linear-gradient(135deg, rgba(0,100,100,0.7) 0%, rgba(0,50,150,0.7) 100%)'
];

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('home', 'zh-Hans'),
        dynamicChineseOnly: false,
        isLoggedIn: false,
        requireLogin: false,  // 默认 false，等待云端配置
        configLoaded: false,  // 配置是否已加载
        fontsLoaded: false,

        // Banner数据（三个轮播）
        banners: [],
        bannerLoading: true,

        // Banner模式开关
        // 1: 常规文章 Banner（3个轮播）
        // 2: 特殊活动入口（单个 Banner，跳转小程序内页）
        // 3: 特殊活动入口（单个 Banner，跳转外部 H5 链接）
        bannerMode: 2,
        specialBanner: getLocalizedSpecialBanner('zh-Hans'),

        // 道具卡片
        toolsCards: getLocalizedToolCards('zh-Hans'),
        recentTools: [], // 【新增】最近玩过的道具
        recentAnimated: false, // 【新增】最近玩过动画是否已播放

        // 卡片图片加载状态 { cardId: { loaded: bool, error: bool, retryCount: number } }
        cardImageStates: {},

        // 自适应布局参数
        layout: {
            cardGap: 32,
            bottomPadding: 180
        },

        // 开屏状态（在 onLoad 中根据条件设置）
        showSplash: true,
        splashFinished: false,

        // 资源URL
        welcomeImage: IMAGE_URLS.WELCOME_GIF,
        logoImage: IMAGE_URLS.LOGO,

        // 【新增】更新通知弹窗状态
        showUpdateModal: false,
        updateInfo: null,

        // 【新增】游戏统计数据
        gameStats: {},

    },

    // ==================== 道具卡片点击 ====================

    onToolCardTap(e) {
        const { path, id } = e.currentTarget.dataset;
        // console.log('[Home] onToolCardTap clicked:', { path, id }); 

        if (!path) return;

        // 【新增】记录最近玩过的道具 (如果有关联ID)
        let toolId = id;
        if (!toolId) {
            // 尝试从 toolsCards 查找
            const target = this.data.toolsCards.find(c => c.path === path);
            if (target) toolId = target.id;
        }

        console.log('[Home] onToolCardTap resolved toolId:', toolId);

        if (toolId) {
            this._addToRecent(toolId);
        }

        wx.navigateTo({ url: path });
    },

    /**
     * 【新增】添加到最近玩过
     */
    _addToRecent(toolId) {
        console.log('[Home] _addToRecent:', toolId);
        try {
            const STORAGE_KEY = 'recent_tools_history';
            let history = wx.getStorageSync(STORAGE_KEY) || [];

            // 移除已存在的（为了置顶）
            history = history.filter(id => id !== toolId);

            // 添加到头部
            history.unshift(toolId);

            // 限制数量 (最多3个)
            if (history.length > 3) {
                history = history.slice(0, 3);
            }

            wx.setStorageSync(STORAGE_KEY, history);
            console.log('[Home] Saved recent history:', history);
        } catch (e) {
            console.warn('[Home] Failed to save recent tools:', e);
        }
    },

    /**
     * 【新增】加载最近玩过的数据
     */
    _loadRecentTools() {
        try {
            const STORAGE_KEY = 'recent_tools_history';
            const history = wx.getStorageSync(STORAGE_KEY) || [];
            console.log('[Home] _loadRecentTools history:', history);

            if (history.length === 0) {
                this.setData({ recentTools: [] });
                return;
            }

            // 根据ID找到对应的卡片配置
            const cardPool = this.data.toolsCards && this.data.toolsCards.length
                ? this.data.toolsCards
                : getLocalizedToolCards(this.data.locale);
            const recentTools = history.map(id => {
                return cardPool.find(card => card.id === id);
            }).filter(item => !!item); // 过滤掉找不到的（可能配置已删除）

            console.log('[Home] _loadRecentTools mapped:', recentTools.map(t => ({ id: t.id, title: t.title, shortTitle: t.shortTitle })));

            // 【优化】只在首次加载时播放动画
            if (!this.data.recentAnimated) {
                this.setData({ recentTools, recentAnimated: true });
            } else {
                this.setData({ recentTools });
            }
        } catch (e) {
            console.warn('[Home] Failed to load recent tools:', e);
        }
    },

    // ==================== 卡片图片加载处理 ====================

    _applyToolCardImage(id, path) {
        if (this._imagePageUnloaded) return;
        const patch = {};
        ['toolsCards', 'recentTools'].forEach(key => {
            this.data[key].forEach((card, index) => {
                if (card.id === id && card.mediaUrl !== path) {
                    patch[`${key}[${index}].mediaUrl`] = path;
                }
            });
        });
        if (Object.keys(patch).length) this.setData(patch);
    },

    _loadToolCardImage(card) {
        return toolImageCache.loadToolImage(card.mediaUrl).then(path => {
            if (this._imagePageUnloaded) return;
            const state = this.data.cardImageStates[card.id];
            if (state && state.error) {
                this.setData({ [`cardImageStates.${card.id}.error`]: false });
            }
            this._applyToolCardImage(card.id, path);
        }).catch(error => {
            if (this._imagePageUnloaded) return;
            console.warn('[Home] Card image preload failed:', card.id, error);
            const index = this.data.toolsCards.findIndex(item => item.id === card.id);
            if (index >= 0) {
                return this.onCardImageError({ currentTarget: { dataset: { id: card.id, index } } });
            }
        });
    },

    _loadToolCardImages() {
        toolImageCache.loadToolImage(FAN_TEST_BANNER_URL).then(path => {
            if (!this._imagePageUnloaded) this.setData({ 'specialBanner.coverImage': path });
        }).catch(error => console.warn('[Home] Banner image failed:', error));
        if (this._toolCardImagesTask) return this._toolCardImagesTask;
        this._toolCardImagesTask = Promise.all(TOOL_CARDS.filter(card => card.mediaUrl).map(card => {
            const state = this.data.cardImageStates[card.id];
            if (state && state.error && !toolImageCache.getCachedToolImage(card.mediaUrl)) {
                return Promise.resolve();
            }
            return this._loadToolCardImage(card);
        })).finally(() => {
            this._toolCardImagesTask = null;
        });
        return this._toolCardImagesTask;
    },

    /**
     * 卡片图片加载成功
     */
    onCardImageLoad(e) {
        const { id } = e.currentTarget.dataset;
        if (!id) return;

        const key = `cardImageStates.${id}`;
        this.setData({
            [key]: { loaded: true, error: false, retryCount: 0 }
        });
        console.log(`[Home] Card image loaded: ${id}`);
    },

    /**
     * 卡片图片加载失败，自动重试
     */
    onCardImageError(e) {
        const { id, index, src } = e.currentTarget.dataset;
        if (id === undefined || index === undefined) return;
        if (this._imagePageUnloaded) return;

        const card = this.data.toolsCards[index];
        if (src && (!card || card.mediaUrl !== src)) return;
        const configuredCard = TOOL_CARDS.find(item => item.id === id);
        const fileID = configuredCard && configuredCard.mediaUrl;

        const currentState = this.data.cardImageStates[id] || { retryCount: 0 };
        const retryCount = currentState.retryCount || 0;
        const MAX_RETRY = 2;

        if (retryCount < MAX_RETRY) {
            if (fileID && (fileID.startsWith('cloud://') || toolImageCache.isBundledImage(fileID))) {
                // 失败重试仍走同一份文件缓存，不切换成另一个带时间戳的远程地址。
                toolImageCache.invalidateToolImage(fileID, card && card.mediaUrl);
                this.setData({
                    [`cardImageStates.${id}`]: { loaded: false, error: false, retryCount: retryCount + 1 }
                });
                this._applyToolCardImage(id, '');
                return this._loadToolCardImage(configuredCard);
            }

            // 重试：添加时间戳参数绕过缓存
            if (card && card.mediaUrl) {
                const separator = card.mediaUrl.includes('?') ? '&' : '?';
                const newUrl = `${card.mediaUrl.split('?')[0]}${separator}_t=${Date.now()}`;

                console.log(`[Home] Retrying card image (${retryCount + 1}/${MAX_RETRY}): ${id}`);

                this.setData({
                    [`toolsCards[${index}].mediaUrl`]: newUrl,
                    [`cardImageStates.${id}`]: { loaded: false, error: false, retryCount: retryCount + 1 }
                });
            }
        } else {
            // 重试次数用尽，标记为错误状态，显示占位符
            console.warn(`[Home] Card image failed after ${MAX_RETRY} retries: ${id}`);
            this.setData({
                [`cardImageStates.${id}`]: { loaded: false, error: true, retryCount }
            });
        }
    },

    /**
     * 计算自适应布局参数
     * 确保 Banner + 道具卡片 + TabBar 恰好填充屏幕
     */
    calculateLayout() {
        try {
            const windowInfo = wx.getWindowInfo();
            const { windowWidth = 375, windowHeight = 812, safeArea } = windowInfo;
            const rpxRatio = 750 / windowWidth;

            // 固定元素高度（rpx）
            const containerPadding = 40; // 顶部padding
            const bannerHeight = 320;
            const bannerMarginBottom = 60; // Banner和标题间距（增大）
            const sectionHeaderHeight = 80; // 标题区域高度
            const sectionMarginBottom = 40; // 标题和卡片间距
            const cardHeight = 200; // 单个卡片高度
            const cardCount = Math.max(1, this.data.toolsCards.length); // 卡片数量

            // TabBar 高度（考虑安全区域）
            const bottomInset = safeArea ? (windowHeight - safeArea.bottom) : 0;
            const tabbarHeight = 50; // TabBar 高度 px
            const tabbarHeightRpx = Math.round((tabbarHeight + bottomInset) * rpxRatio);
            const safeBuffer = 40; // 额外安全间距

            // 可用高度（rpx）
            const totalHeightRpx = Math.round(windowHeight * rpxRatio);
            const usedHeight = containerPadding + bannerHeight + bannerMarginBottom +
                sectionHeaderHeight + sectionMarginBottom +
                (cardHeight * cardCount) + tabbarHeightRpx + safeBuffer;

            // 剩余空间用于卡片间距
            const remainingSpace = totalHeightRpx - usedHeight;
            const gapCount = cardCount - 1; // 卡片之间的间隙数量

            // 计算卡片间距（确保最小间距）
            let cardGap = Math.max(32, Math.round(remainingSpace / (gapCount + 1)));
            cardGap = Math.min(cardGap, 60); // 最大间距限制

            // 底部padding确保不被TabBar遮挡 (大幅增加安全距离)
            const bottomPadding = tabbarHeightRpx + safeBuffer + 300;

            this.setData({
                layout: {
                    cardGap,
                    bottomPadding
                }
            });

            console.log('[Home] Layout calculated:', { cardGap, bottomPadding, windowHeight });
        } catch (e) {
            console.warn('[Home] calculateLayout failed:', e);
        }
    },

    // ==================== 生命周期 ====================

    onLoad() {
        this._imagePageUnloaded = false;
        this._syncI18n();

        // 计算自适应布局
        this.calculateLayout();

        // 创建文章云函数管理器
        this.articleManager = new CloudFunctionManager('getArticles', {
            cacheTTL: CACHE_CONFIG.ARTICLE_TTL
        });

        // 检查登录配置（初始值）
        const app = getApp();
        // 如果配置已加载（可能来自缓存），立即应用
        if (app.globalData.configLoaded) {
            this._applyLoginConfig(app.globalData.requireLogin, true);
        }

        // 【重要】检查是否应该显示开屏动画
        // 规则：每次冷启动显示一次，同一会话内再次进入首页不显示
        if (app.globalData._splashShownThisSession) {
            console.log('[Home] Splash already shown this session');
            this.setData({ showSplash: false, splashFinished: true });
        }

        // 【重要】监听后端配置更新，确保云函数返回后能及时更新状态
        app.onConfigUpdate && app.onConfigUpdate((config) => {
            console.log('[Home] Config updated from backend:', config);
            this._applyLoginConfig(config.requireLogin, true);
        });

        // 初始化Banner（先显示静态Banner，动态Banner加载后替换第一个）
        this._initBanners();

        this.preloadAssets();
        this.loadCustomFonts();
        this._loadGameStats();
    },

    /**
     * 加载游戏统计数据（带缓存，共享games页的缓存）
     */
    _loadGameStats() {
        const CACHE_KEY = 'game_stats_cache';
        const CACHE_TIME_KEY = 'game_stats_cache_time';
        const TTL = 6 * 60 * 60 * 1000; // 【优化】延长到6小时

        // 检查缓存
        try {
            const cacheTime = wx.getStorageSync(CACHE_TIME_KEY);
            if (cacheTime && (Date.now() - cacheTime) < TTL) {
                const cached = wx.getStorageSync(CACHE_KEY);
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
                        wx.setStorageSync(CACHE_KEY, stats);
                        wx.setStorageSync(CACHE_TIME_KEY, Date.now());
                    } catch (e) { }
                }
            }
        });
    },

    /**
     * 应用登录配置
     * @param {boolean} requireLogin - 是否需要强制登录
     * @param {boolean} configLoaded - 配置是否已加载完成
     */
    _applyLoginConfig(requireLogin, configLoaded = false) {
        const app = getApp();
        const updateData = {
            requireLogin,
            configLoaded: configLoaded || app.globalData.configLoaded // 【修复】确保configLoaded始终同步
        };

        if (!requireLogin) {
            // 不需要强制登录，视为已登录
            app.globalData.isLoggedIn = true;
            updateData.isLoggedIn = true;
        } else {
            // 【修复】需要强制登录时，确保 isLoggedIn 与 globalData 同步
            // 如果用户尚未登录，显式设置为 false
            if (!app.globalData.isLoggedIn) {
                updateData.isLoggedIn = false;
            } else {
                updateData.isLoggedIn = app.globalData.isLoggedIn;
            }
        }

        // 【修改】首页不再显示登录弹窗，TabBar 始终不模糊
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({ blurred: false });
        }

        this.setData(updateData);
        console.log('[Home] _applyLoginConfig:', { requireLogin, configLoaded: updateData.configLoaded, isLoggedIn: updateData.isLoggedIn });
    },

    /**
     * 初始化Banner列表
     */
    _initBanners() {
        // 创建3个占位Banner，等待动态数据加载
        const bannerCta = (this.data.uiCopy.specialBanner && this.data.uiCopy.specialBanner.btnText) || '去看看';
        const placeholderBanners = [1, 2, 3].map(id => ({
            id,
            title: '',
            desc: '',
            btnText: bannerCta,
            bg: BANNER_GRADIENTS[id - 1] || BANNER_GRADIENTS[0],
            coverImage: '',
            url: '',
            isLoading: true
        }));

        this.setData({
            banners: placeholderBanners
        });
    },

    onShow() {
        try {
            console.log('[Home] onShow called');
            this._syncI18n();
            // 【新增】刷新最近玩过的道具
            this._loadRecentTools();

            // 更新TabBar状态
            const app = getApp();

            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar) {
                // 【修复】如果我们正在显示开屏，不要在 onShow 里处理 TabBar 状态
                // 避免 onShow 覆盖了 preloadAssets 中的 hidden: true 设置
                if (this.data.showSplash) {
                    if (!tabBar.data.hidden) {
                        tabBar.setData({ hidden: true });
                    }
                } else {
                    // 【修改】首页不再显示登录弹窗，TabBar 不需要模糊
                    const needsUpdate = tabBar.data.selected !== 0 ||
                        tabBar.data.blurred !== false ||
                        tabBar.data.hidden !== false;

                    if (needsUpdate) {
                        tabBar.setData({
                            selected: 0,
                            blurred: false,  // 首页始终不模糊
                            hidden: false
                        });
                    }
                }

                // 同步管理员状态
                if (app.globalData.isAdmin) {
                    tabBar.updateAdminStatus(true);
                }
            }

            // 【优化】只在动画尚未播放完成的情况下才触发入场动画
            // 避免从其他页面返回时整个首页闪烁
            if (this.data.animationClass !== 'page-entry-animate') {
                this.setData({ animationClass: '' }, () => {
                    setTimeout(() => {
                        this.setData({ animationClass: 'page-entry-animate' });
                    }, 50);
                });
            }

            // 每次显示时随机更新Banner1（如果有缓存的文章列表）
            if (this._articlesList && this._articlesList.length > 0) {
                this._updateBanner1WithRandomArticle();
            }
        } catch (e) {
            log.reportLifecycleError('onShow', 'home', e);
        }
    },

    onHide() {
        // 【优化】不再重置动画类，避免返回首页时重新播放入场动画
        // this.setData({ animationClass: '' });
    },

    onUnload() {
        this._imagePageUnloaded = true;
    },

    // ==================== 字体加载（本地字体文件） ====================

    /**
     * 加载自定义字体
     * 字体通过 WXSS 的 @font-face 从本地加载，这里只需要等待字体渲染准备
     */
    loadCustomFonts() {
        const app = getApp();
        const FONT_CACHE_KEY = 'customFonts';

        // 如果已加载过，直接返回
        if (app.globalData.cachedAssets?.[FONT_CACHE_KEY]) {
            this.setData({ fontsLoaded: true });
            return;
        }

        // 字体通过 WXSS @font-face 加载，给一个短暂延迟确保字体渲染准备就绪
        // 本地字体加载通常很快（毫秒级）
        setTimeout(() => {
            console.log('[Home] Local fonts ready via @font-face');
            if (app.globalData.cachedAssets) {
                app.globalData.cachedAssets[FONT_CACHE_KEY] = true;
            }
            this.setData({ fontsLoaded: true });
        }, 100);
    },

    // ==================== 开屏与资源预加载 ====================

    onSkipSplash() {
        this._closeSplash();
    },

    /**
     * 关闭开屏动画（统一处理，避免重复调用）
     */
    _closeSplash() {
        if (this._splashClosed) return;
        this._splashClosed = true;

        // 清理超时定时器
        if (this._splashTimeoutTimer) {
            clearTimeout(this._splashTimeoutTimer);
            this._splashTimeoutTimer = null;
        }

        // 标记本次会话已显示开屏
        try {
            const app = getApp();
            app.globalData._splashShownThisSession = true;
        } catch (e) { }

        // 先更新状态，再显示 TabBar
        this.setData({ showSplash: false, splashFinished: true }, () => {
            // 使用回调确保 showSplash 已更新后再显示 TabBar
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar) {
                // 使用统一的恢复方法
                if (typeof tabBar._ensureCorrectState === 'function') {
                    tabBar._ensureCorrectState();
                } else {
                    tabBar.setData({ hidden: false, blurred: false });
                }
            }
        });

        // 延迟再次确保 TabBar 显示（处理边界情况）
        setTimeout(() => {
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar && tabBar.data.hidden) {
                if (typeof tabBar._ensureCorrectState === 'function') {
                    tabBar._ensureCorrectState();
                } else {
                    tabBar.setData({ hidden: false, blurred: false });
                }
            }
        }, 100);

        // 开屏关闭后，检查是否需要显示更新通知
        setTimeout(() => {
            if (!this.data.requireLogin || this.data.isLoggedIn) {
                this._showUpdateNotificationIfNeeded();
            }
        }, 800);
    },

    preloadAssets() {
        const startTime = Date.now();
        const app = getApp();

        // 【方案3】如果是从 reLaunch 进入（页面栈 = 1 且 isResuming = false），跳过开屏
        const pages = getCurrentPages();
        const isFromReLaunch = pages.length === 1 && !app.globalData.isResuming && app.globalData._splashShownThisSession;

        if (isFromReLaunch) {
            console.log('[Home] Skipping splash (from reLaunch)');
            this.setData({ showSplash: false });
            // 确保 TabBar 可见
            if (typeof this.getTabBar === 'function' && this.getTabBar()) {
                this.getTabBar().setData({ hidden: false });
            }
            this._loadBannerArticle().catch(() => { });
            return;
        }

        // 如果不需要显示开屏，直接跳过预加载等待
        if (!this.data.showSplash) {
            console.log('[Home] Splash already shown this session, skipping');
            // 仍然在后台加载资源，但不阻塞
            this._loadBannerArticle().catch(() => { });
            return;
        }

        this._splashClosed = false;

        // 【重要】超时保护：最多 5 秒后强制关闭开屏（从 8 秒减少）
        const MAX_SPLASH_TIME = 5000;
        this._splashTimeoutTimer = setTimeout(() => {
            console.warn('[Home] Splash timeout, force closing');
            this._closeSplash();
        }, MAX_SPLASH_TIME);

        // 【修复】开屏期间隐藏 TabBar
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            // 设置一个隐藏状态
            this.getTabBar().setData({ hidden: true });
        }

        // 1. 最小开屏时间
        const minTimePromise = new Promise(resolve =>
            setTimeout(resolve, UI_CONFIG.ANIMATION.SPLASH_MIN_TIME)
        );

        // 2. 欢迎图片预加载（带超时保护）
        const welcomePromise = new Promise(resolve => {
            // 安全检查 cachedAssets
            if (app.globalData?.cachedAssets?.welcomeImage) {
                resolve();
                return;
            }

            // 图片加载超时保护
            const imageTimeout = setTimeout(() => {
                console.warn('[Home] Welcome image load timeout');
                resolve();
            }, 5000);

            wx.getImageInfo({
                src: IMAGE_URLS.WELCOME_GIF,
                success: () => {
                    if (app.globalData?.cachedAssets) {
                        app.globalData.cachedAssets.welcomeImage = IMAGE_URLS.WELCOME_GIF;
                    }
                },
                complete: () => {
                    clearTimeout(imageTimeout);
                    resolve();
                },
                fail: () => {
                    clearTimeout(imageTimeout);
                    resolve();
                }
            });
        });

        // 3. 卡片图片预加载（并行预加载所有卡片图片）
        const cardImagesPromise = new Promise(resolve => {
            const cardImageTimeout = setTimeout(() => {
                console.warn('[Home] Card images preload timeout');
                resolve();
            }, 4000);

            this._loadToolCardImages().then(() => {
                clearTimeout(cardImageTimeout);
                console.log('[Home] Card image preload attempts finished');
                resolve();
            });
        });

        // 4. Banner文章加载（带超时保护）
        const bannerPromise = new Promise(resolve => {
            // Banner 加载超时保护
            const bannerTimeout = setTimeout(() => {
                console.warn('[Home] Banner load timeout');
                resolve();
            }, 5000);

            this._loadBannerArticle()
                .then(() => {
                    clearTimeout(bannerTimeout);
                    resolve();
                })
                .catch(err => {
                    console.warn('[Home] Banner load error:', err);
                    clearTimeout(bannerTimeout);
                    resolve();
                });
        });

        Promise.all([minTimePromise, welcomePromise, cardImagesPromise, bannerPromise])
            .then(() => {
                console.log(`[Home] Preload complete in ${Date.now() - startTime}ms`);
                // 【修复】显示 TabBar
                // TabBar 显示移至 _closeSplash 中统一处理
                this._closeSplash();
            })
            .catch(err => {
                console.error('[Home] Preload error:', err);
                this._closeSplash();
            });
    },


    // ==================== Banner文章加载（性能优化版） ====================

    /**
     * 加载Banner文章（带微信后台预加载 + 本地缓存 + 预加载封面图）
     */
    async _loadBannerArticle() {
        if (this.data.dynamicChineseOnly) {
            this.setData({
                bannerLoading: false,
                banners: []
            });
            return;
        }

        // 1. 【优先】尝试读取微信后台预加载的数据（周期性拉取/预加载）
        try {
            const bgFetchData = await this._getBackgroundFetchData();
            if (bgFetchData) {
                console.log('[Home] Using background fetch data');
                const articles = this._transformArticles(bgFetchData);
                this._articlesList = articles;
                saveArticlesCache(articles); // 同步更新本地缓存
                this._preloadArticleImages(articles);
                this._updateBanner1WithRandomArticle();
                this.setData({ bannerLoading: false });
                return;
            }
        } catch (e) {
            console.log('[Home] Background fetch not available:', e.message);
        }

        // 2. 读取本地缓存（毫秒级响应）
        const cached = getCachedArticles();
        if (cached && cached.length > 0) {
            this._articlesList = cached;
            this._updateBanner1WithRandomArticle();
            this.setData({ bannerLoading: false });

            // 后台静默刷新（不阻塞UI）
            this._silentRefreshArticles();
            return;
        }

        // 3. 无缓存，从云端获取
        await this._fetchArticlesFromCloud();
    },

    /**
     * 【新增】读取微信后台预加载数据
     * 支持两种预加载方式：
     * - 周期性拉取 (fetchType: 'periodic')
     * - 数据预拉取 (fetchType: 'pre')
     */
    _getBackgroundFetchData() {
        console.log('[Home][Debug] ========== 开始获取微信后台预加载数据 ==========');

        return new Promise((resolve, reject) => {
            // 优先尝试周期性拉取的数据
            console.log('[Home][Debug] 尝试获取 periodic (周期性拉取) 数据...');

            wx.getBackgroundFetchData({
                fetchType: 'periodic',
                success: (res) => {
                    console.log('[Home][Debug] periodic 请求成功，返回:', {
                        hasData: !!res.fetchedData,
                        dataLength: res.fetchedData?.length || 0,
                        timeStamp: res.timeStamp,
                        path: res.path
                    });

                    if (res.fetchedData) {
                        try {
                            const data = JSON.parse(res.fetchedData);
                            console.log('[Home][Debug] periodic 数据解析成功:', {
                                success: data?.success,
                                dataCount: data?.data?.length || 0
                            });

                            // 检查数据格式：云函数返回的是 { success: true, data: [...] }
                            if (data?.success && data?.data?.length > 0) {
                                console.log('[Home][Debug] ✅ periodic 数据有效，使用此数据');
                                resolve(data.data);
                                return;
                            } else {
                                console.log('[Home][Debug] ⚠️ periodic 数据格式不符合预期');
                            }
                        } catch (e) {
                            console.warn('[Home][Debug] ❌ periodic 数据解析失败:', e.message);
                        }
                    } else {
                        console.log('[Home][Debug] ⚠️ periodic 无数据 (fetchedData 为空)');
                    }
                    // 周期性拉取无数据，尝试预拉取
                    this._tryPreFetchData(resolve, reject);
                },
                fail: (err) => {
                    console.log('[Home][Debug] ❌ periodic 请求失败:', err);
                    // 周期性拉取失败，尝试预拉取
                    this._tryPreFetchData(resolve, reject);
                }
            });
        });
    },

    /**
     * 【新增】尝试读取预拉取数据
     */
    _tryPreFetchData(resolve, reject) {
        console.log('[Home][Debug] 尝试获取 pre (预拉取) 数据...');

        wx.getBackgroundFetchData({
            fetchType: 'pre',
            success: (res) => {
                console.log('[Home][Debug] pre 请求成功，返回:', {
                    hasData: !!res.fetchedData,
                    dataLength: res.fetchedData?.length || 0,
                    timeStamp: res.timeStamp,
                    path: res.path
                });

                if (res.fetchedData) {
                    try {
                        const data = JSON.parse(res.fetchedData);
                        console.log('[Home][Debug] pre 数据解析成功:', {
                            success: data?.success,
                            dataCount: data?.data?.length || 0
                        });

                        if (data?.success && data?.data?.length > 0) {
                            console.log('[Home][Debug] ✅ pre 数据有效，使用此数据');
                            resolve(data.data);
                            return;
                        } else {
                            console.log('[Home][Debug] ⚠️ pre 数据格式不符合预期');
                        }
                    } catch (e) {
                        console.warn('[Home][Debug] ❌ pre 数据解析失败:', e.message);
                    }
                } else {
                    console.log('[Home][Debug] ⚠️ pre 无数据 (fetchedData 为空)');
                }

                console.log('[Home][Debug] ========== 后台预加载数据获取结束 (无有效数据) ==========');
                reject(new Error('No valid background fetch data'));
            },
            fail: (err) => {
                reject(err);
            }
        });
    },

    /**
     * 从云端获取文章（优化：只获取必要字段）
     */
    async _fetchArticlesFromCloud() {
        try {
            const result = await this.articleManager.call({}, { force: false });

            if (result?.success && result.data?.length > 0) {
                const articles = this._transformArticles(result.data);
                this._articlesList = articles;

                // 保存到本地缓存
                saveArticlesCache(articles);

                // 【性能优化】批量预加载图床图片
                // 图床图片比云存储图片加载更快，可以预加载更多
                this._preloadArticleImages(articles);

                this._updateBanner1WithRandomArticle();
                this.setData({ bannerLoading: false });
            } else {
                this.setData({ bannerLoading: false });
            }
        } catch (err) {
            console.error('[Home] Fetch articles failed:', err);
            this.setData({ bannerLoading: false });
        }
    },

    /**
     * 【性能优化】批量预加载文章封面图
     * 图床图片比云存储快很多，可以预加载更多张
     */
    _preloadArticleImages(articles) {
        if (!articles || articles.length === 0) return;

        // 优先预加载图床图片（最多预加载前5张）
        const imagesToPreload = articles
            .filter(a => a.hasImageUrl && a.cover) // 只预加载有图床链接的
            .slice(0, 5)
            .map(a => a.cover);

        // 并行预加载，不阻塞主流程
        imagesToPreload.forEach(url => {
            // 【优化】使用 downloadFile 替代 getImageInfo
            // 某些图床的 Content-Type 不标准导致 getImageInfo 失败，但 downloadFile 可正常缓存
            wx.downloadFile({
                url: url,
                success: (res) => {
                    if (res.statusCode === 200) {
                        console.log('[Home] Preloaded image (download):', url.substring(0, 50) + '...');
                    }
                },
                fail: () => { } // 静默失败
            });
        });
    },

    /**
     * 静默刷新文章（后台更新缓存，不影响UI）
     */
    _silentRefreshArticles() {
        // 延迟执行，避免影响首屏渲染
        setTimeout(() => {
            this.articleManager.call({}, { force: true, silent: true })
                .then(result => {
                    if (result?.success && result.data?.length > 0) {
                        const articles = this._transformArticles(result.data);
                        this._articlesList = articles;
                        saveArticlesCache(articles);
                        console.log('[Home] Silent refresh completed');
                    }
                })
                .catch(() => { });
        }, 3000);
    },

    /**
     * 转换文章数据格式
     * 【优化】优先使用图床链接(imageurl)，其次使用云存储图片(coverImage)
     */
    _transformArticles(records) {
        return records.map((item, index) => {
            let tags = [];
            if (item.tag) {
                const tagList = item.tag.split('\n')
                    .filter(t => t.trim())
                    .sort((a, b) => a.length - b.length);
                tags = tagList.map((t, i) => ({
                    text: t,
                    color: UI_CONFIG.TAG_COLORS[(index + i) % UI_CONFIG.TAG_COLORS.length]
                }));
            }

            // 【优先级】1. 图床链接(imageurl) > 2. 云存储图片(coverImage) > 3. 默认封面
            const imageUrl = (item.imageurl || '').trim();
            const coverImage = (item.coverImage || '').trim();

            let cover;
            if (imageUrl && imageUrl.startsWith('http')) {
                // 优先使用图床链接（加载最快）
                cover = imageUrl;
            } else if (coverImage && !coverImage.startsWith('cloud://')) {
                // 其次使用已转换的云存储临时URL
                cover = coverImage;
            } else {
                // 兜底使用默认封面
                cover = IMAGE_URLS.DEFAULT_COVER;
            }

            const titleText = item.titie1 || item.title || '';
            const titleLines = titleText.split('\n').filter(t => t.trim());

            return {
                id: item._id,
                title: item.title,
                titleLines,
                smallTitle: item.titie1 || '',
                desc: item.summary || '',
                cover,
                url: item.wechatArticleUrl || '',
                tags,
                // 保留原始图床链接用于预加载判断
                hasImageUrl: !!(imageUrl && imageUrl.startsWith('http'))
            };
        });
    },

    /**
     * 用随机文章更新所有Banner
     * 从文章列表中随机选择3篇不重复的文章分配到3个Banner
     */
    _updateAllBannersWithRandomArticles() {
        const articles = this._articlesList;
        if (!articles || articles.length === 0) return;
        const bannerCta = (this.data.uiCopy.specialBanner && this.data.uiCopy.specialBanner.btnText) || '去看看';

        // 随机选择不重复的文章索引
        const selectedIndices = this._getRandomIndices(articles.length, 3);

        // 生成3个Banner
        const newBanners = selectedIndices.map((articleIndex, bannerIndex) => {
            const article = articles[articleIndex];
            return {
                id: bannerIndex + 1,
                title: article.title || '',
                titleLines: article.titleLines || [],
                desc: article.desc || '',
                btnText: bannerCta,
                bg: BANNER_GRADIENTS[bannerIndex] || BANNER_GRADIENTS[0],
                coverImage: article.cover || '',
                url: article.url || '',
                isLoading: false
            };
        });

        this.setData({ banners: newBanners, bannerLoading: false });
    },

    /**
     * 获取不重复的随机索引
     * @param {number} max - 最大索引（不包含）
     * @param {number} count - 需要的数量
     */
    _getRandomIndices(max, count) {
        const indices = [];
        const available = Array.from({ length: max }, (_, i) => i);

        // 如果文章数量不足，允许重复
        const actualCount = Math.min(count, max);

        for (let i = 0; i < actualCount; i++) {
            const randomPos = Math.floor(Math.random() * available.length);
            indices.push(available[randomPos]);
            available.splice(randomPos, 1);
        }

        // 如果文章不足3篇，用第一篇填充
        while (indices.length < count && indices.length > 0) {
            indices.push(indices[0]);
        }

        return indices;
    },

    /**
     * 兼容旧方法名（保持向后兼容）
     */
    _updateBanner1WithRandomArticle() {
        this._updateAllBannersWithRandomArticles();
    },

    /**
     * Banner点击事件（常规Banner）
     */
    onBannerTap(e) {
        const index = e.currentTarget.dataset.index;
        const banner = this.data.banners[index];

        if (banner?.url) {
            wx.navigateTo({
                url: `/pages/webview/index?url=${encodeURIComponent(banner.url)}`
            });
        }
    },

    /**
     * 特殊Banner点击事件
     */
    onSpecialBannerTap() {
        if (this.data.bannerMode === 3) {
            wx.navigateTo({
                url: `/pages/webview/index?url=${encodeURIComponent('https://mfjjq.icu/')}`
            });
        } else {
            wx.navigateTo({
                url: '/pages/fan-test/index'
            });
        }
    },

    /**
     * 抽奖红包入口
     */
    onLotteryEntryTap() {
        wx.navigateTo({
            url: '/pages/lottery/index'
        });
    },

    // ==================== 下拉刷新 ====================

    onPullDownRefresh() {
        if (this.data.dynamicChineseOnly) {
            wx.stopPullDownRefresh();
            return;
        }
        this._fetchArticlesFromCloud()
            .finally(() => wx.stopPullDownRefresh());
    },

    // ==================== 登录回调 ====================

    onLoginSuccess(e) {
        const app = getApp();
        const isAdmin = e?.detail?.admin || app.globalData.isAdmin || false;

        this.setData({ isLoggedIn: true });
        app.globalData.isLoggedIn = true;
        app.globalData.isAdmin = isAdmin;

        setTimeout(() => {
            if (typeof this.getTabBar === 'function' && this.getTabBar()) {
                this.getTabBar().setData({ blurred: false });
                // 如果是管理员，更新TabBar显示后台Tab
                if (isAdmin) {
                    this.getTabBar().updateAdminStatus(true);
                }
            }
        }, 100);

        wx.showToast({ title: this.data.uiCopy.welcomeBack || '欢迎回来', icon: 'success' });

        // 确保Banner显示
        if (this.data.banners[0]?.isLoading) {
            this._loadBannerArticle();
        }

        // 【新增】登录成功后检查是否有更新通知
        this._showUpdateNotificationIfNeeded();
    },

    // ==================== 更新通知相关 ====================

    /**
     * 检查并显示更新通知弹窗
     */
    _showUpdateNotificationIfNeeded() {
        if (this.data.dynamicChineseOnly) {
            return;
        }

        const app = getApp();
        const notification = app.globalData.pendingUpdateNotification;

        if (notification) {
            // 延迟显示，确保页面动画完成
            setTimeout(() => {
                this.setData({
                    showUpdateModal: true,
                    updateInfo: notification
                });
            }, 500);
        }
    },

    /**
     * 用户点击"知道了！"按钮
     */
    onUpdateModalConfirm() {
        const app = getApp();

        // 标记版本已读
        app.markVersionSeen();

        // 隐藏弹窗
        this.setData({
            showUpdateModal: false,
            updateInfo: null
        });
    },

    // ==================== 分享功能 ====================

    /**
     * 用户点击右上角转发
     */
    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '首页 | 抓手指-满分激光枪',
            path: '/pages/home/index',
            imageUrl: '/logo.png'
        };
    },

    /**
     * 用户点击右上角转发到朋友圈
     */
    onShareTimeline() {
        return {
            title: this.data.uiCopy.shareTitle || '首页 | 抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        const uiCopy = i18n.getPageCopy('home', locale);
        const dynamicChineseOnly = i18n.shouldUseDynamicChineseOnly(locale);

        this.setData({
            locale,
            uiCopy,
            dynamicChineseOnly,
            toolsCards: getLocalizedToolCards(locale),
            specialBanner: getLocalizedSpecialBanner(locale),
            bannerMode: dynamicChineseOnly ? 2 : this.data.bannerMode,
            showUpdateModal: dynamicChineseOnly ? false : this.data.showUpdateModal
        }, () => {
            this._loadRecentTools();
            // 包括跳过开屏、返回首页及切换语言，均复用相同的本地图片。
            this._loadToolCardImages();
        });

        i18n.setNavigationBarTitle('home.navTitle', locale);
    }
});
