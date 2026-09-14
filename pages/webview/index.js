const i18n = require('../../utils/i18n');

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('webview', 'zh-Hans'),
        url: ''
    },
    onLoad(options) {
        this._syncI18n();
        if (options.url) {
            this.setData({
                url: decodeURIComponent(options.url)
            });
        }
    },

    onShow() {
        this._syncI18n();
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({
            locale: locale,
            uiCopy: i18n.getPageCopy('webview', locale)
        });
        i18n.setNavigationBarTitle('webview.navTitle', locale);
    },

    // ==================== 分享功能 ====================

    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '抓手指-满分激光枪',
            path: '/pages/home/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.shareTitle || '抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    }
});
