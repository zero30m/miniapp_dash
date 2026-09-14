const { callCloudFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

const REDEEM_WECHAT = 'tututu970414';
const LOTTERY_SUBSCRIBE_TEMPLATE_ID = 'XFkqYn8Cw06bRDbo46cABhWhK-0IZyo9rFKvBaTo8gw';

function logDrawDebug(debugLastDraw, context) {
    if (!debugLastDraw) {
        console.log(`[LotteryDrawDebug] ${context}: 暂无已开奖抽奖活动`);
        return;
    }
    console.log(`[LotteryDrawDebug] ${context}: 最近一次已开奖抽奖`, {
        lotteryId: debugLastDraw.lotteryId,
        drawSource: debugLastDraw.drawSource,
        drawSourceText: debugLastDraw.drawSourceText,
        openAtText: debugLastDraw.openAtText,
        drawnAtText: debugLastDraw.drawnAtText,
        participantCount: debugLastDraw.participantCount,
        winnerCount: debugLastDraw.winnerCount
    });
}

function getLotteryCopy(locale) {
    return i18n.getPageCopy('lottery', locale || i18n.getAppLocale()) || {};
}

function getStatusLabel(status, uiCopy, fallback) {
    const statusCopy = uiCopy.status || {};
    return statusCopy[status] || fallback || statusCopy.unknown || '未知';
}

function localizeDetail(detail, uiCopy, isAdmin) {
    if (!detail) return detail;
    if (isAdmin) {
        return {
            ...detail,
            statusLabel: detail.statusText
        };
    }

    const detailCopy = uiCopy.detail || {};
    return {
        ...detail,
        statusLabel: getStatusLabel(detail.status, uiCopy, detail.statusText),
        winnerTitleText: i18n.formatString(detailCopy.winnerTitle || '你抽中了 ¥{amount}', {
            amount: detail.prizeAmountText || ''
        })
    };
}

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: getLotteryCopy('zh-Hans'),
        isAdmin: false,
        lotteryId: '',
        detail: null,
        loading: true,
        joining: false
    },

    async onLoad(options) {
        const app = getApp();
        if (app.waitForLaunchData) {
            await app.waitForLaunchData(5000);
        }
        this.setData({ isAdmin: !!app.globalData.isAdmin });
        this._syncI18n();
        const lotteryId = options.id || options.lotteryId || '';
        this.setData({ lotteryId });
        this.loadDetail();
    },

    onShow() {
        this._syncI18n();
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        const uiCopy = getLotteryCopy(locale);
        const updates = {
            locale,
            uiCopy
        };
        if (!this.data.isAdmin && this.data.detail) {
            updates.detail = localizeDetail(this.data.detail, uiCopy, false);
        }
        this.setData(updates);
        if (!this.data.isAdmin) {
            i18n.setNavigationBarTitle('lottery.detailNavTitle', locale);
        }
    },

    onPullDownRefresh() {
        this.loadDetail().finally(() => wx.stopPullDownRefresh());
    },

    goBack() {
        const pages = getCurrentPages();
        if (pages.length > 1) {
            wx.navigateBack();
        } else {
            wx.switchTab({ url: '/pages/home/index' });
        }
    },

    async loadDetail() {
        if (!this.data.lotteryId) {
            this.setData({ loading: false, detail: null });
            return;
        }

        this.setData({ loading: true });
        try {
            const res = await callCloudFunction('lotteryManager', {
                action: 'getDetail',
                lotteryId: this.data.lotteryId
            });
            const result = res?.result;
            if (result?.success) {
                logDrawDebug(result.data?.debugLastDraw, '抽奖详情');
                this.setData({ detail: localizeDetail(result.data, this.data.uiCopy, this.data.isAdmin) });
            } else {
                this.setData({ detail: null });
                wx.showToast({ title: this.data.isAdmin ? (result?.error || '加载失败') : (this.data.uiCopy.toast?.loadFailed || '加载失败'), icon: 'none' });
            }
        } catch (err) {
            console.error('[LotteryDetail] load failed:', err);
            wx.showToast({ title: this.data.isAdmin ? '网络错误，请稍后重试' : (this.data.uiCopy.toast?.networkError || '网络错误，请稍后重试'), icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    async joinLottery() {
        if (this.data.joining || !this.data.lotteryId) return;
        this.setData({ joining: true });

        try {
            const subscribeResult = await this.requestLotterySubscribe();
            this.saveLotterySubscribeConsent(subscribeResult);

            const res = await callCloudFunction('lotteryManager', {
                action: 'join',
                lotteryId: this.data.lotteryId
            });
            const result = res?.result;
            if (result?.success) {
                logDrawDebug(result.data?.debugLastDraw, '参与抽奖');
                this.setData({ detail: localizeDetail(result.data, this.data.uiCopy, this.data.isAdmin) });
                wx.showToast({
                    title: this.data.isAdmin
                        ? (result.alreadyJoined ? '已参与' : '参与成功')
                        : (result.alreadyJoined ? (this.data.uiCopy.toast?.alreadyJoined || '已参与') : (this.data.uiCopy.toast?.joinSuccess || '参与成功')),
                    icon: 'success'
                });
            } else {
                if (result?.data) {
                    logDrawDebug(result.data?.debugLastDraw, '参与抽奖');
                    this.setData({ detail: localizeDetail(result.data, this.data.uiCopy, this.data.isAdmin) });
                }
                wx.showToast({ title: this.data.isAdmin ? (result?.error || '参与失败') : (this.data.uiCopy.toast?.joinFailed || '参与失败'), icon: 'none' });
            }
        } catch (err) {
            console.error('[LotteryDetail] join failed:', err);
            wx.showToast({ title: this.data.isAdmin ? '网络错误，请稍后重试' : (this.data.uiCopy.toast?.networkError || '网络错误，请稍后重试'), icon: 'none' });
        } finally {
            this.setData({ joining: false });
        }
    },

    async requestLotterySubscribe() {
        const requestedAt = Date.now();
        if (!wx.requestSubscribeMessage) {
            return {
                status: 'unsupported',
                requestErrMsg: 'wx.requestSubscribeMessage unavailable',
                requestedAt
            };
        }

        try {
            const res = await wx.requestSubscribeMessage({
                tmplIds: [LOTTERY_SUBSCRIBE_TEMPLATE_ID]
            });
            return {
                status: res?.[LOTTERY_SUBSCRIBE_TEMPLATE_ID] || 'unknown',
                requestErrMsg: res?.errMsg || '',
                requestedAt
            };
        } catch (err) {
            return {
                status: 'fail',
                requestErrMsg: err?.errMsg || err?.message || String(err),
                requestedAt
            };
        }
    },

    async saveLotterySubscribeConsent(subscribeResult = {}) {
        if (!this.data.lotteryId) return;
        try {
            await callCloudFunction('lotterySubscribeManager', {
                action: 'saveConsent',
                lotteryId: this.data.lotteryId,
                templateId: LOTTERY_SUBSCRIBE_TEMPLATE_ID,
                status: subscribeResult.status || 'unknown',
                requestErrMsg: subscribeResult.requestErrMsg || '',
                requestedAt: subscribeResult.requestedAt || Date.now()
            }, {
                maxRetries: 0,
                timeout: 8000,
                silent: true
            });
        } catch (err) {
            console.warn('[LotteryDetail] save subscribe consent failed:', err?.message || err);
        }
    },

    copyRedeemWechat() {
        wx.setClipboardData({
            data: REDEEM_WECHAT,
            success: () => wx.showToast({ title: this.data.isAdmin ? '微信号已复制' : (this.data.uiCopy.toast?.copiedWechat || '微信号已复制'), icon: 'success' })
        });
    },

    onShareAppMessage() {
        return {
            title: this.data.isAdmin ? '点我参与抽奖！' : (this.data.uiCopy.shareTitle || '点我参与抽奖！'),
            path: `/pages/lottery/detail?id=${this.data.lotteryId}`,
            imageUrl: '/logo.png'
        };
    }
});
