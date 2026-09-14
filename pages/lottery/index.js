const { callCloudFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

const LOTTERY_SUBSCRIBE_TEMPLATE_ID = 'XFkqYn8Cw06bRDbo46cABhWhK-0IZyo9rFKvBaTo8gw';

function pad2(value) {
    return String(value).padStart(2, '0');
}

function getDefaultDateTime() {
    const target = new Date(Date.now() + 30 * 60 * 1000 + 8 * 60 * 60 * 1000);
    const year = target.getUTCFullYear();
    const month = pad2(target.getUTCMonth() + 1);
    const day = pad2(target.getUTCDate());
    const hour = pad2(target.getUTCHours());
    const minute = pad2(target.getUTCMinutes());
    return {
        date: `${year}-${month}-${day}`,
        time: `${hour}:${minute}`
    };
}

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

function localizeRecord(record, uiCopy, isAdmin) {
    if (!record) return record;
    if (isAdmin) {
        return {
            ...record,
            statusLabel: record.statusText
        };
    }

    const listCopy = uiCopy.list || {};
    const localized = {
        ...record,
        statusLabel: getStatusLabel(record.status, uiCopy, record.statusText),
        openAtLine: i18n.formatString(listCopy.drawTimeText || '开奖时间：{time}', {
            time: record.openAtText || ''
        }),
        userResultText: '',
        userJoinedText: ''
    };

    if (record.status === 'drawn') {
        if (!record.isParticipant) {
            localized.userResultText = listCopy.notJoinedDrawn || '你没有参与本次抽奖';
        } else if (record.isWinner) {
            localized.userResultText = i18n.formatString(listCopy.winText || '你中奖了：¥{amount}', {
                amount: record.prizeAmountText || ''
            });
        } else {
            localized.userResultText = listCopy.noWin || '这次没有中奖';
        }
    } else if (record.isParticipant) {
        localized.userJoinedText = record.luckyCode
            ? i18n.formatString(listCopy.joinedWithCode || '已参与：{code}', { code: record.luckyCode })
            : (listCopy.joined || '已参与');
    }

    return localized;
}

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: getLotteryCopy('zh-Hans'),
        isAdmin: false,
        activeTab: 'created',
        loading: false,
        creating: false,
        subscribeTesting: false,
        records: [],
        pageNumber: 1,
        hasMore: false,
        amountInput: '',
        prizeCountInput: '1',
        openDate: '',
        openTime: '',
        createdResult: null
    },

    async onLoad() {
        this._syncI18n();
        const defaults = getDefaultDateTime();
        this.setData({
            openDate: defaults.date,
            openTime: defaults.time
        });

        const app = getApp();
        if (app.waitForLaunchData) {
            await app.waitForLaunchData(5000);
        }

        const isAdmin = !!app.globalData.isAdmin;
        this.setData({
            isAdmin,
            activeTab: 'created'
        });
        this.loadDashboard(true);
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
        if (!this.data.isAdmin && this.data.records && this.data.records.length) {
            updates.records = this.data.records.map(item => localizeRecord(item, uiCopy, false));
        }
        this.setData(updates);
        if (!this.data.isAdmin) {
            i18n.setNavigationBarTitle('lottery.navTitle', locale);
        }
    },

    onPullDownRefresh() {
        this.loadDashboard(true).finally(() => wx.stopPullDownRefresh());
    },

    onReachBottom() {
        if (this.data.hasMore && !this.data.loading && (!this.data.isAdmin || this.data.activeTab === 'created')) {
            this.loadDashboard(false);
        }
    },

    goBack() {
        const pages = getCurrentPages();
        if (pages.length > 1) {
            wx.navigateBack();
        } else {
            wx.switchTab({ url: '/pages/home/index' });
        }
    },

    showCreatePanel() {
        this.setData({ activeTab: 'create' });
    },

    hideCreatePanel() {
        this.setData({ activeTab: 'created' });
        this.loadDashboard(true);
    },

    refreshDashboard() {
        this.loadDashboard(true);
    },

    async loadDashboard(refresh = false) {
        if (this.data.loading) return;
        const pageNumber = refresh ? 1 : this.data.pageNumber + 1;
        this.setData({ loading: true });

        try {
            const res = await callCloudFunction('lotteryManager', {
                action: 'dashboard',
                pageNumber,
                pageSize: 20
            });
            const result = res?.result;
            if (result?.success) {
                const data = result.data || {};
                logDrawDebug(data.debugLastDraw, '抽奖列表');
                const incomingRecords = (data.records || []).map(item => localizeRecord(item, this.data.uiCopy, this.data.isAdmin));
                this.setData({
                    records: refresh ? incomingRecords : this.data.records.concat(incomingRecords),
                    pageNumber,
                    hasMore: !!data.hasMore
                });
            } else {
                wx.showToast({ title: this.data.isAdmin ? (result?.error || '获取失败') : (this.data.uiCopy.toast?.loadFailed || '加载失败'), icon: 'none' });
            }
        } catch (err) {
            console.error('[Lottery] loadDashboard failed:', err);
            wx.showToast({ title: this.data.isAdmin ? '网络错误，请稍后重试' : (this.data.uiCopy.toast?.networkError || '网络错误，请稍后重试'), icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    onAmountInput(e) {
        this.setData({ amountInput: e.detail.value });
    },

    onPrizeCountInput(e) {
        this.setData({ prizeCountInput: e.detail.value });
    },

    onDateChange(e) {
        this.setData({ openDate: e.detail.value });
    },

    onTimeChange(e) {
        this.setData({ openTime: e.detail.value });
    },

    getOpenAt() {
        return new Date(`${this.data.openDate}T${this.data.openTime}:00+08:00`).getTime();
    },

    async createLottery() {
        if (this.data.creating) return;

        const openAt = this.getOpenAt();
        this.setData({ creating: true });

        try {
            const res = await callCloudFunction('lotteryManager', {
                action: 'create',
                totalAmountYuan: this.data.amountInput,
                prizeCount: this.data.prizeCountInput,
                openAt
            });
            const result = res?.result;
            if (result?.success) {
                this.setData({
                    createdResult: result.data,
                    amountInput: '',
                    prizeCountInput: '1'
                });
                wx.showToast({ title: '创建成功', icon: 'success' });
                this.loadDashboard(true);
            } else {
                wx.showToast({ title: result?.error || '创建失败', icon: 'none' });
            }
        } catch (err) {
            console.error('[Lottery] create failed:', err);
            wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
        } finally {
            this.setData({ creating: false });
        }
    },

    async testSubscribeMessage() {
        if (this.data.subscribeTesting || !this.data.isAdmin) return;
        this.setData({ subscribeTesting: true });

        let subscribeStatus = 'unsupported';
        let subscribeErrMsg = '';
        try {
            if (wx.requestSubscribeMessage) {
                const subscribeRes = await wx.requestSubscribeMessage({
                    tmplIds: [LOTTERY_SUBSCRIBE_TEMPLATE_ID]
                });
                subscribeStatus = subscribeRes?.[LOTTERY_SUBSCRIBE_TEMPLATE_ID] || 'unknown';
                subscribeErrMsg = subscribeRes?.errMsg || '';
            } else {
                subscribeErrMsg = '当前基础库不支持 wx.requestSubscribeMessage';
            }

            const sendRes = await callCloudFunction('lotterySubscribeManager', {
                action: 'adminTestSend',
                activityName: this.buildTodayActivityName()
            });
            const result = sendRes?.result;
            const sendData = result?.data || {};
            const sendMessage = sendData.errMsg || sendData.errmsg || result?.error || '';
            wx.showModal({
                title: result?.success ? '测试消息已发送' : '测试消息发送失败',
                content: `订阅结果：${subscribeStatus}\n${sendMessage || subscribeErrMsg || '请查看服务通知是否收到消息'}`,
                showCancel: false
            });
        } catch (err) {
            wx.showModal({
                title: '测试失败',
                content: `订阅结果：${subscribeStatus}\n${err?.errMsg || err?.message || String(err)}`,
                showCancel: false
            });
        } finally {
            this.setData({ subscribeTesting: false });
        }
    },

    buildTodayActivityName() {
        const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
        return `${now.getUTCMonth() + 1}月${now.getUTCDate()}日的抽奖`;
    },

    copyText(e) {
        const text = e.currentTarget.dataset.text;
        if (!text) return;
        wx.setClipboardData({
            data: text,
            success: () => wx.showToast({ title: '已复制', icon: 'success' })
        });
    },

    openDetail(e) {
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        wx.navigateTo({ url: `/pages/lottery/detail?id=${id}` });
    }
});
