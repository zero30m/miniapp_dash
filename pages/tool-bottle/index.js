const i18n = require('../../utils/i18n');
const toolImageCache = require('../../utils/tool_image_cache');

const BOTTLE_IMAGE_URL = '/image-pack-tools/bottle-f0bbb6fa.png';
const SPIN_DURATION = 3000;
const MIN_FULL_TURNS = 4;
const MAX_FULL_TURNS = 6;

function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('bottle', 'zh-Hans'),
        navTop: 44,
        bottleImage: toolImageCache.getCachedToolImage(BOTTLE_IMAGE_URL),
        bottleRotation: 0,
        resultRotation: 0,
        isSpinning: false,
        showResult: false
    },

    onLoad() {
        this._destroyed = false;
        toolImageCache.loadToolImage(BOTTLE_IMAGE_URL).then(path => {
            if (!this._destroyed) this.setData({ bottleImage: path });
        }).catch(error => console.warn('[Bottle] Image preload failed:', error));
        this._syncI18n();
        this._calculateNavLayout();
        this._reportGamePlay();
    },

    onShow() {
        this._syncI18n();
        this._setTabBarHidden(true);
    },

    onHide() {

        this._setTabBarHidden(false);
    },

    onUnload() {
        this._destroyed = true;
        this._clearSpinTimer();

        this._setTabBarHidden(false);
    },

    onBottleTap() {
        if (this.data.isSpinning || this.data.showResult) return;

        const currentRotation = this.data.bottleRotation || 0;
        const currentDirection = normalizeAngle(currentRotation);
        const resultRotation = Math.floor(Math.random() * 360);
        const directionDelta = normalizeAngle(resultRotation - currentDirection);
        const fullTurns = MIN_FULL_TURNS
            + Math.floor(Math.random() * (MAX_FULL_TURNS - MIN_FULL_TURNS + 1));
        const targetRotation = currentRotation + fullTurns * 360 + directionDelta;

        this.setData({ isSpinning: true }, () => {
            const startSpin = () => {
                if (this._destroyed || !this.data.isSpinning) return;

                this.setData({
                    bottleRotation: targetRotation,
                    resultRotation
                }, () => {
                    this._clearSpinTimer();

                    this._spinTimer = setTimeout(() => {
                        this._spinTimer = null;
                        if (this._destroyed || !this.data.isSpinning) return;

                        this.setData({
                            isSpinning: false,
                            showResult: true
                        });

                        try {
                            if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
                        } catch (e) { }
                    }, SPIN_DURATION);
                });
            };

            if (typeof wx.nextTick === 'function') {
                wx.nextTick(startSpin);
            } else {
                setTimeout(startSpin, 16);
            }
        });
    },

    onNextRound() {
        if (!this.data.showResult) return;
        this.setData({ showResult: false });
    },

    goBack() {
        if (this._isGoingBack) return;
        this._isGoingBack = true;
        this._clearSpinTimer();

        const pages = getCurrentPages();
        if (pages && pages.length > 1) {
            wx.navigateBack({
                delta: 1,
                fail: () => wx.switchTab({ url: '/pages/home/index' }),
                complete: () => {
                    this._isGoingBack = false;
                }
            });
        } else {
            wx.switchTab({
                url: '/pages/home/index',
                complete: () => {
                    this._isGoingBack = false;
                }
            });
        }
    },

    _clearSpinTimer() {
        if (this._spinTimer) {
            clearTimeout(this._spinTimer);
            this._spinTimer = null;
        }
    },

    _calculateNavLayout() {
        try {
            const menuButton = wx.getMenuButtonBoundingClientRect();
            const navTop = menuButton && menuButton.top > 0 ? menuButton.top : 44;
            this.setData({ navTop });
        } catch (e) {
            this.setData({ navTop: 44 });
        }
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({
            locale,
            uiCopy: i18n.getPageCopy('bottle', locale)
        });
        i18n.setNavigationBarTitle('bottle.navTitle', locale);
    },

    _setTabBarHidden(hidden) {
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({ hidden, blurred: false });
        }
    },

    _reportGamePlay() {
        const app = getApp();
        if (app && typeof app.addGameStat === 'function') {
            app.addGameStat('bottle');
        }
    },

    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '转酒瓶｜瓶口指谁谁喝',
            path: '/pages/tool-bottle/index'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.timelineTitle || '转酒瓶：瓶口对准的，喝酒！',
            query: ''
        };
    }
});
