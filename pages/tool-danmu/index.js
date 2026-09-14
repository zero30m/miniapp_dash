/**
 * 夜店弹幕 - 输入页面（竖屏）
 * 用户输入完成后跳转到横屏播放页面
 */
const i18n = require('../../utils/i18n');

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('danmu', 'zh-Hans'),
        danmuText: '',
        navTop: 44,
        colors: ['#FFFFFF', '#FF0055', '#39FF14', '#00FFFF', '#FFAA00'], // 预设霓虹色
        selectedColor: '#FFFFFF'
    },

    onLoad() {
        this._syncI18n();
        this._calculateNavLayout();
        // 上报游戏统计
        this._reportGamePlay();
    },

    onShow() {
        this._syncI18n();
        // 隐藏TabBar
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar && !tabBar.data.hidden) {
            tabBar.setData({ hidden: true });
        }
    },

    onHide() {
        // 恢复TabBar
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({ hidden: false, blurred: false });
        }
    },

    onUnload() {
        // 恢复TabBar
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({ hidden: false, blurred: false });
        }
    },

    // 返回上一页
    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({
            locale: locale,
            uiCopy: i18n.getPageCopy('danmu', locale)
        });
        i18n.setNavigationBarTitle('danmu.navTitle', locale);
    },

    // 计算导航栏位置（参考其他喝酒道具页面）
    _calculateNavLayout() {
        try {
            const menuBtn = wx.getMenuButtonBoundingClientRect();
            const navTop = (menuBtn && menuBtn.top > 0) ? menuBtn.top : 44;
            this.setData({ navTop });
        } catch (e) {
            this.setData({ navTop: 44 });
        }
    },

    // 输入变化
    onInputChange(e) {
        this.setData({ danmuText: e.detail.value });
    },

    // 选择颜色
    onSelectColor(e) {
        const color = e.currentTarget.dataset.color;
        this.setData({ selectedColor: color });
    },

    // 开始播放 - 跳转到横屏页面
    onStartPlay() {
        const text = this.data.danmuText.trim();
        if (!text) {
            wx.showToast({ title: this.data.uiCopy.toastEmpty || '请输入弹幕内容', icon: 'none' });
            return;
        }

        // 跳转到横屏播放页面
        wx.navigateTo({
            url: `/pages/tool-danmu-play/index?text=${encodeURIComponent(text)}&color=${encodeURIComponent(this.data.selectedColor)}`
        });
    },

    // 【优化】游戏统计上报 - 使用批量上报机制
    _reportGamePlay() {
        const app = getApp();
        app.addGameStat('danmu');
    },

    // 分享
    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '夜店弹幕 - 全场最靓的仔',
            path: '/pages/tool-danmu/index'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.timelineTitle || '夜店弹幕',
            query: ''
        };
    }
});
