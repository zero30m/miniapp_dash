const { callCloudFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

const LEGACY_MEMBER_TAG_MAP = {
    '免费用户': 'free',
    '周卡': 'week',
    '月卡': 'month',
    '年卡': 'year',
    '永久卡': 'permanent',
    '超绝永久卡': 'permanent',
    '已过期': 'expired'
};

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('admin', 'zh-Hans'),
        activeTab: 'codes', // 'codes' | 'members'

        // 创建邀请码
        createDays: 7, // 【修改】最小天数改为7天
        creating: false,

        // 邀请码列表
        codes: [],
        codesTotal: 0,
        codesPage: 1,
        codesHasMore: false,
        codesLoading: false,
        codeFilter: 'all', // 'all' | 'used' | 'unused'

        // 会员列表
        members: [],
        membersTotal: 0,
        membersPage: 1,
        membersHasMore: false,
        membersLoading: false,
        memberFilter: 'all', // 'all' | 'free' | 'week' | 'month' | 'year' | 'permanent'
        memberFilterLabel: '',
        memberStats: { free: 0, week: 0, month: 0, year: 0, permanent: 0 },

        // 自定义弹窗状态
        showCodeModal: false,
        newCode: '',
        newCodeDays: 0,
        showDeleteModal: false,
        deleteCodeId: ''
    },

    // 防抖计时器
    _loadCodesTimer: null,
    _loadMembersTimer: null,

    onLoad() {
        this._syncI18n();
        const app = getApp();

        // 【优化】检查是否有预加载的数据
        if (app.globalData._cachedAdminCodes) {
            console.log('[Admin] Using preloaded codes data');
            const data = app.globalData._cachedAdminCodes;
            this.setData({
                codes: data.records || [],
                codesTotal: data.total || 0,
                codesHasMore: data.hasMore || false
            });
            // 清除缓存，下次刷新时重新加载
            app.globalData._cachedAdminCodes = null;
        } else {
            // 无缓存，正常加载
            this.loadCodes(true);
        }
    },


    onShow() {
        this._syncI18n();
        // 更新 TabBar 状态
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            const app = getApp();

            // 【优化】只更新需要变化的状态，避免不必要的重渲染
            const needsUpdate = tabBar.data.selected !== 4 ||
                tabBar.data.hidden !== false ||
                tabBar.data.blurred !== false;

            if (needsUpdate) {
                tabBar.setData({
                    selected: 4, // 后台是第5个Tab
                    hidden: false,
                    blurred: false
                });
            }

            // 确保管理员状态同步
            if (app.globalData.isAdmin) {
                tabBar.updateAdminStatus(true);
            }
        }
    },

    onPullDownRefresh() {
        if (this.data.activeTab === 'codes') {
            this.loadCodes(true).finally(() => wx.stopPullDownRefresh());
        } else {
            this.loadMembers(true).finally(() => wx.stopPullDownRefresh());
        }
    },

    onReachBottom() {
        if (this.data.activeTab === 'codes' && this.data.codesHasMore) {
            this.loadMoreCodes();
        } else if (this.data.activeTab === 'members' && this.data.membersHasMore) {
            this.loadMoreMembers();
        }
    },

    // ==================== Tab 切换 ====================

    _syncI18n() {
        const locale = i18n.getAppLocale();
        const uiCopy = i18n.getPageCopy('admin', locale);
        this.setData({
            locale: locale,
            uiCopy: uiCopy,
            memberFilterLabel: uiCopy.memberFilters && uiCopy.memberFilters[this.data.memberFilter] || '',
            members: this._localizeMembers(this.data.members, uiCopy)
        });
        i18n.setNavigationBarTitle('admin.navTitle', locale);
    },

    _getMemberTagCode(item) {
        return item.tagCode || LEGACY_MEMBER_TAG_MAP[item.tag] || 'free';
    },

    _localizeMembers(records, uiCopy) {
        const copy = uiCopy || this.data.uiCopy || {};
        const memberTags = copy.memberTags || {};
        return (records || []).map((item) => {
            const tagCode = this._getMemberTagCode(item);
            return Object.assign({}, item, {
                localizedTagCode: tagCode,
                localizedTag: memberTags[tagCode] || item.tag || ''
            });
        });
    },

    switchTab(e) {
        const tab = e.currentTarget.dataset.tab;
        if (tab === this.data.activeTab) return;

        this.setData({ activeTab: tab });

        if (tab === 'codes' && this.data.codes.length === 0) {
            this.loadCodes(true);
        } else if (tab === 'members' && this.data.members.length === 0) {
            this.loadMembers(true);
        }
    },

    // ==================== 邀请码管理 ====================

    addDays(e) {
        const days = parseInt(e.currentTarget.dataset.days, 10);
        const newDays = this.data.createDays + days;
        this.setData({ createDays: Math.min(newDays, 9999) });
    },

    resetDays() {
        this.setData({ createDays: 7 }); // 【修改】重置为7天
    },

    async createInviteCode() {
        if (this.data.creating) return;

        this.setData({ creating: true });

        try {
            const res = await callCloudFunction('adminCreateInviteCode', {
                shichangtian: this.data.createDays
            });

            if (res?.result?.success) {
                const newCode = res.result.data;
                // 显示自定义弹窗
                this.setData({
                    showCodeModal: true,
                    newCode: newCode.code,
                    newCodeDays: newCode.shichangtian || this.data.createDays,
                    createDays: 7 // 【修改】重置为7天
                });
            } else {
                wx.showToast({
                    title: this.data.uiCopy.toastCreateFailed || '创建失败',
                    icon: 'none'
                });
            }
        } catch (err) {
            console.error('Create invite code error:', err);
            wx.showToast({ title: this.data.uiCopy.toastNetworkError || '网络错误', icon: 'none' });
        } finally {
            this.setData({ creating: false });
        }
    },

    closeCodeModal() {
        this.setData({ showCodeModal: false });
        // 刷新列表，最新创建的邀请码在最前面
        this.loadCodes(true);
    },

    setCodeFilter(e) {
        const filter = e.currentTarget.dataset.filter;
        if (filter === this.data.codeFilter) return;

        this.setData({ codeFilter: filter, codes: [], codesPage: 1 });

        // 【优化】防抖：避免快速切换时重复加载
        if (this._loadCodesTimer) clearTimeout(this._loadCodesTimer);
        this._loadCodesTimer = setTimeout(() => {
            this.loadCodes(true);
        }, 200);
    },

    async loadCodes(refresh = false, retryCount = 0) {
        if (this.data.codesLoading) return;

        const page = refresh ? 1 : this.data.codesPage;
        this.setData({ codesLoading: true });

        try {
            const res = await callCloudFunction('adminGetInviteCodes', {
                pageNumber: page,
                pageSize: 20,
                filter: this.data.codeFilter
            });

            if (res?.result?.success) {
                const { records, total, hasMore } = res.result.data;
                this.setData({
                    codes: refresh ? records : [...this.data.codes, ...records],
                    codesTotal: total,
                    codesPage: page,
                    codesHasMore: hasMore
                });
            } else {
                console.log('adminGetInviteCodes 错误:', res?.result?.error);

                if (res?.result?.retryable && retryCount < 2) {
                    this.setData({ codesLoading: false });
                    await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
                    return this.loadCodes(refresh, retryCount + 1);
                }

                wx.showToast({
                    title: this.data.uiCopy.toastFetchFailed || '获取失败',
                    icon: 'none'
                });
            }
        } catch (err) {
            console.error('Load codes error:', err);
            if (retryCount < 2) {
                this.setData({ codesLoading: false });
                await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
                return this.loadCodes(refresh, retryCount + 1);
            }
            wx.showToast({ title: this.data.uiCopy.toastNetworkRetry || '网络错误，请稍后重试', icon: 'none' });
        } finally {
            this.setData({ codesLoading: false });
        }
    },

    loadMoreCodes() {
        if (!this.data.codesHasMore || this.data.codesLoading) return;
        this.setData({ codesPage: this.data.codesPage + 1 });
        this.loadCodes(false);
    },

    // 点击删除按钮 - 显示自定义确认弹窗
    deleteCode(e) {
        const codeId = e.currentTarget.dataset.id;
        this.setData({
            showDeleteModal: true,
            deleteCodeId: codeId
        });
    },

    cancelDelete() {
        this.setData({
            showDeleteModal: false,
            deleteCodeId: ''
        });
    },

    async confirmDelete() {
        const codeId = this.data.deleteCodeId;
        this.setData({ showDeleteModal: false });

        if (!codeId) return;

        try {
            const res = await callCloudFunction('adminDeleteInviteCode', {
                codeId: codeId
            });

            if (res?.result?.success) {
                wx.showToast({ title: this.data.uiCopy.toastDeleteSuccess || '删除成功', icon: 'success' });
                // 刷新列表
                this.loadCodes(true);
            } else {
                wx.showToast({
                    title: this.data.uiCopy.toastDeleteFailed || '删除失败',
                    icon: 'none'
                });
            }
        } catch (err) {
            console.error('Delete code error:', err);
            wx.showToast({ title: this.data.uiCopy.toastNetworkError || '网络错误', icon: 'none' });
        } finally {
            this.setData({ deleteCodeId: '' });
        }
    },

    // ==================== 会员管理 ====================

    setMemberFilter(e) {
        const filter = e.currentTarget.dataset.filter;
        if (filter === this.data.memberFilter) return;

        const labels = this.data.uiCopy.memberFilters || {};

        this.setData({
            memberFilter: filter,
            memberFilterLabel: labels[filter] || '',
            members: [],
            membersPage: 1
        });

        // 【优化】防抖：避免快速切换时重复加载
        if (this._loadMembersTimer) clearTimeout(this._loadMembersTimer);
        this._loadMembersTimer = setTimeout(() => {
            this.loadMembers(true);
        }, 200);
    },

    async loadMembers(refresh = false, retryCount = 0) {
        if (this.data.membersLoading) return;

        const page = refresh ? 1 : this.data.membersPage;
        this.setData({ membersLoading: true });

        try {
            const res = await callCloudFunction('adminGetMembers', {
                pageNumber: page,
                pageSize: 20,
                filter: this.data.memberFilter
            });

            if (res?.result?.success) {
                const { records, total, hasMore, stats } = res.result.data;
                this.setData({
                    members: refresh ? this._localizeMembers(records) : [...this.data.members, ...this._localizeMembers(records)],
                    membersTotal: total,
                    membersPage: page,
                    membersHasMore: hasMore,
                    memberStats: stats || { week: 0, month: 0, year: 0, permanent: 0 }
                });
            } else {
                if (res?.result?.retryable && retryCount < 2) {
                    this.setData({ membersLoading: false });
                    await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
                    return this.loadMembers(refresh, retryCount + 1);
                }

                wx.showToast({
                    title: this.data.uiCopy.toastFetchFailed || '获取失败',
                    icon: 'none'
                });
            }
        } catch (err) {
            console.error('Load members error:', err);
            if (retryCount < 2) {
                this.setData({ membersLoading: false });
                await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
                return this.loadMembers(refresh, retryCount + 1);
            }
            wx.showToast({ title: this.data.uiCopy.toastNetworkRetry || '网络错误，请稍后重试', icon: 'none' });
        } finally {
            this.setData({ membersLoading: false });
        }
    },

    loadMoreMembers() {
        if (!this.data.membersHasMore || this.data.membersLoading) return;
        this.setData({ membersPage: this.data.membersPage + 1 });
        this.loadMembers(false);
    }
});
