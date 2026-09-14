/**
 * 夜店弹幕 - 横屏播放页面
 * 从输入页面跳转过来，接收弹幕文案参数
 */
const i18n = require('../../utils/i18n');

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('danmu', 'zh-Hans'),
        danmuText: '',
        animationDuration: 8
    },

    onLoad(options) {
        this._syncI18n();
        // 获取传递的弹幕文案
        const text = decodeURIComponent(options.text || '');
        const color = decodeURIComponent(options.color || '#FFFFFF');

        if (!text) {
            wx.navigateBack({ delta: 1 });
            return;
        }

        // 根据文字长度调整动画时长
        const len = text.length;
        let duration = 6;
        if (len > 10) duration = 8;
        if (len > 20) duration = 12;
        if (len > 30) duration = 15;

        // 生成动态样式
        // 使用 hex alpha (cc=80%, 88=53%, 44=27%) 近似模拟 glow
        // 注意：微信小程序部分颜色格式可能需要转换，但 hex 一般支持
        const textStyle = `color: ${color}; text-shadow: 0 0 30rpx ${color}, 0 0 60rpx ${color};`;

        this.setData({
            danmuText: text,
            animationDuration: duration,
            textStyle: textStyle
        });

        wx.vibrateShort({ type: 'medium' });
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

    // 点击退出
    onStopPlay() {
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

    // 分享
    onShareAppMessage() {
        return {
            title: (this.data.uiCopy.playSharePrefix || '夜店弹幕 - ') + this.data.danmuText,
            path: '/pages/tool-danmu/index'
        };
    }
});
