const i18n = require('../../utils/i18n');

Page({
    data: {
        locale: 'zh-Hans'
    },

    onLoad() {
        this._syncI18n();
    },

    onShow() {
        this._syncI18n();

        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({
                hidden: true,
                blurred: false
            });
        }
    },

    onHide() {
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({
                hidden: false,
                blurred: false
            });
        }
    },

    onShareAppMessage() {
        return {
            title: `${i18n.getGameNames(this.data.locale).drinking} | ${i18n.t('games.shareSuffix', this.data.locale)}`,
            path: '/pages/drinking-game/index'
        };
    },

    onShareTimeline() {
        return {
            title: `${i18n.getGameNames(this.data.locale).drinking} | ${i18n.t('games.shareSuffix', this.data.locale)}`
        };
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({ locale: locale });
        i18n.setNavigationBarTitle('games.gameNames.drinking', locale);
    }
});
