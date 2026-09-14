const i18n = require('../utils/i18n');

// 需要隐藏 TabBar 的页面路由（工具页面等）
const HIDDEN_TAB_ROUTES = [
    'pages/finger/index',           // 抓手指（横屏）
    'pages/tool-oldman/index',      // 点老头
    'pages/tool-fingerpress/index', // 按手指
    'pages/tool-dice/index',        // 摇骰子
    'pages/tool-countdown/index',   // 倒计时
    'pages/tool-danmu/index',       // 弹幕
    'pages/tool-flappy/index',      // 像素鸟
    'pages/tool-bottle/index',      // 转酒瓶
    'pages/tool-danmu-play/index',  // 弹幕播放
    'pages/tool-drunk/index',       // 喝酒工具
    'pages/drinking-game/index',    // 喝酒游戏
    'pages/webview/index'           // 网页
];

// TabBar 页面路由及其对应的 selected 索引
const TAB_ROUTES = {
    'pages/home/index': 0,
    'pages/finger/index': 1,
    'pages/games/index': 2,
    'pages/profile/index': 3,
    'pages/admin/index': 4
};

const NORMAL_TAB_CONFIG = [{
    pagePath: '/pages/home/index',
    iconPath: '/icon/homenew.svg',
    selectedIconPath: '/icon/homenew.svg',
    textKey: 'home'
}, {
    pagePath: '/pages/finger/index',
    iconPath: '/icon/finger.svg',
    selectedIconPath: '/icon/finger.svg',
    textKey: 'finger'
}, {
    pagePath: '/pages/games/index',
    iconPath: '/icon/game1.svg',
    selectedIconPath: '/icon/game1.svg',
    textKey: 'games'
}, {
    pagePath: '/pages/profile/index',
    iconPath: '/icon/个性化.svg',
    selectedIconPath: '/icon/个性化.svg',
    textKey: 'diy'
}];

const ADMIN_TAB_CONFIG = NORMAL_TAB_CONFIG.concat([{
    pagePath: '/pages/admin/index',
    iconPath: '/icon/admin.svg',
    selectedIconPath: '/icon/admin.svg',
    textKey: 'admin'
}]);

function buildTabList(isAdmin, locale) {
    const copy = i18n.getPageCopy('tabBar', locale);
    const config = isAdmin ? ADMIN_TAB_CONFIG : NORMAL_TAB_CONFIG;
    return config.map(item => Object.assign({}, item, {
        text: copy[item.textKey] || item.textKey
    }));
}

function getIndicatorWidthPercent(listLength) {
    if (!listLength) return 0;
    return 100 / listLength;
}

Component({
    data: {
        selected: 0,
        color: "#888888",
        selectedColor: "#39FF14",
        blurred: false,
        hidden: true, // 默认隐藏，开屏结束后由页面控制显示
        isAdmin: false,
        normalList: buildTabList(false, i18n.getAppLocale()),
        adminList: buildTabList(true, i18n.getAppLocale()),
        list: buildTabList(false, i18n.getAppLocale()),
        indicatorWidthPercent: 25,
        indicatorLeftPercent: 0
    },

    lifetimes: {
        attached() {
            // list 已在 data 中预初始化
            // 清理可能残留的恢复定时器
            this._clearRecoveryTimers();
            this._refreshLocalizedTabs();
        },
        detached() {
            this._clearRecoveryTimers();
        }
    },

    pageLifetimes: {
        show() {
            // 每次页面显示时，确保 TabBar 状态正确
            this._refreshLocalizedTabs();
            this._ensureCorrectState();
        }
    },

    methods: {
        switchTab(e) {
            const data = e.currentTarget.dataset;
            const url = data.path;
            wx.switchTab({ url });
            this.setData({
                selected: data.index,
                indicatorLeftPercent: data.index * getIndicatorWidthPercent(this.data.list.length)
            });
        },

        _refreshLocalizedTabs() {
            const locale = i18n.getAppLocale();
            const app = getApp();
            const showAdminTab = !!(this.data.isAdmin || (app.globalData.isAdmin && app.globalData.requireLogin));
            const normalList = buildTabList(false, locale);
            const adminList = buildTabList(true, locale);
            const list = showAdminTab ? adminList : normalList;
            const indicatorWidthPercent = getIndicatorWidthPercent(list.length);

            this.setData({
                normalList: normalList,
                adminList: adminList,
                list: list,
                indicatorWidthPercent: indicatorWidthPercent,
                indicatorLeftPercent: this.data.selected * indicatorWidthPercent
            });
        },

        /**
         * 更新管理员状态
         */
        updateAdminStatus(isAdmin) {
            const app = getApp();
            const showAdminTab = isAdmin && app.globalData.requireLogin;
            const locale = i18n.getAppLocale();
            const normalList = buildTabList(false, locale);
            const adminList = buildTabList(true, locale);
            const newList = showAdminTab ? adminList : normalList;
            const indicatorWidthPercent = getIndicatorWidthPercent(newList.length);
            this.setData({
                isAdmin: showAdminTab,
                normalList: normalList,
                adminList: adminList,
                list: newList,
                indicatorWidthPercent: indicatorWidthPercent,
                indicatorLeftPercent: this.data.selected * indicatorWidthPercent
            });
        },

        /**
         * 清理恢复定时器
         */
        _clearRecoveryTimers() {
            if (this._recoveryTimer) {
                clearTimeout(this._recoveryTimer);
                this._recoveryTimer = null;
            }
            if (this._retryTimer) {
                clearTimeout(this._retryTimer);
                this._retryTimer = null;
            }
        },

        /**
         * 判断当前页面是否应该隐藏 TabBar
         */
        _shouldBeHidden() {
            try {
                const pages = getCurrentPages();
                const app = getApp();

                // 【修复】后台恢复时，页面栈可能暂时为空或不完整
                // 如果正在恢复过程中，延迟判断，默认不隐藏
                if (!pages || pages.length === 0) {
                    // 检查是否是恢复场景
                    if (app && app.globalData && app.globalData.isResuming) {
                        console.log('[TabBar] _shouldBeHidden: pages empty but isResuming, returning false');
                        return false; // 恢复时默认显示
                    }
                    return true;
                }

                const currentPage = pages[pages.length - 1];
                const route = currentPage?.route || '';

                // 1. 工具页面：隐藏
                if (HIDDEN_TAB_ROUTES.includes(route)) {
                    return true;
                }

                // 2. 首页开屏动画期间：隐藏
                if (route === 'pages/home/index' && currentPage?.data?.showSplash) {
                    return true;
                }

                // 3. TabBar 页面：显示
                if (TAB_ROUTES.hasOwnProperty(route)) {
                    return false;
                }

                // 4. 其他页面（非 TabBar 页面）：隐藏
                return true;
            } catch (e) {
                console.warn('[TabBar] _shouldBeHidden error:', e);
                return true;
            }
        },

        /**
         * 获取当前页面对应的 selected 索引
         */
        _getCurrentSelectedIndex() {
            try {
                const pages = getCurrentPages();
                if (!pages || pages.length === 0) return 0;

                const route = pages[pages.length - 1]?.route || '';
                return TAB_ROUTES[route] ?? this.data.selected;
            } catch (e) {
                return this.data.selected;
            }
        },

        /**
         * 确保 TabBar 状态正确（核心恢复逻辑）
         * 在 pageLifetimes.show 和 app.onShow 中调用
         */
        _ensureCorrectState(retryCount = 0) {
            const maxRetries = 3;
            const shouldHide = this._shouldBeHidden();
            const correctSelected = this._getCurrentSelectedIndex();

            // 检查是否需要更新
            const needsUpdate = this.data.hidden !== shouldHide ||
                this.data.selected !== correctSelected;

            if (needsUpdate) {
                console.log('[TabBar] _ensureCorrectState: updating',
                    'hidden:', this.data.hidden, '->', shouldHide,
                    'selected:', this.data.selected, '->', correctSelected,
                    'retry:', retryCount);

                this.setData({
                    hidden: shouldHide,
                    selected: correctSelected,
                    indicatorLeftPercent: correctSelected * getIndicatorWidthPercent(this.data.list.length)
                });
            }

            // 如果应该显示但仍然隐藏，进行重试
            if (!shouldHide && this.data.hidden && retryCount < maxRetries) {
                this._retryTimer = setTimeout(() => {
                    this._ensureCorrectState(retryCount + 1);
                }, 100 * (retryCount + 1)); // 递增延迟：100ms, 200ms, 300ms
            }
        },

        /**
         * 强制显示 TabBar（供外部调用）
         */
        forceShow() {
            if (this._shouldBeHidden()) {
                console.log('[TabBar] forceShow blocked: should be hidden');
                return;
            }
            this.setData({ hidden: false });
        },

        /**
         * 强制隐藏 TabBar（供外部调用）
         */
        forceHide() {
            this.setData({ hidden: true });
        }
    }
});
