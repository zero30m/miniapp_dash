/**
 * 沉寂朋友落地页 - 访客视角
 * 
 * 功能：
 * - 展示文案和Hi按钮
 * - 点击Hi弹出头像昵称填写
 * - 完成后显示转化引导
 * - 适配单页模式（场景值1154，从朋友圈打开）
 * 
 * 优化：
 * - 如果用户已有资料（缓存/globalData），自动填充到弹窗
 * - 助力后同步更新全局资料状态，避免重复弹窗
 */
const i18n = require('../../utils/i18n');

// 本地缓存 key（与发起人页面共享）
const PROFILE_CACHE_KEY = 'viral_profile_cache';
const CACHE_EXPIRE_TIME = 5 * 60 * 1000;  // 缓存 5 分钟

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('viral', 'zh-Hans'),
        // 是否为真正的单页模式（朋友圈打开，无法登录）
        isSinglePageMode: false,
        // 页面加载状态
        pageLoading: true,
        // 发起人信息
        initiatorId: '',
        initiatorNickname: '',
        initiatorAvatarUrl: '',
        // 互动状态
        hasInteracted: false,
        showProfileModal: false,
        // 用户已有的资料（用于自动填充）
        existingAvatarUrl: '',
        existingNickname: '',
        // 临时保存的头像昵称
        tempAvatarUrl: '',
        tempNickname: ''
    },

    onLoad(options) {
        this._syncI18n();
        console.log('【沉寂朋友】========== 访客页加载 ==========');
        console.log('【沉寂朋友】options:', JSON.stringify(options));

        const launchOptions = wx.getLaunchOptionsSync();
        // 场景值 1154 表示从朋友圈打开（真正的单页模式，无登录态）
        const isSinglePageMode = launchOptions.scene === 1154;

        console.log('【沉寂朋友】场景值:', launchOptions.scene);
        console.log('【沉寂朋友】是否单页模式（朋友圈）:', isSinglePageMode);

        this.setData({
            isSinglePageMode: isSinglePageMode,
            initiatorId: options.initiator || ''
        });

        // 根据模式选择不同的加载方式
        if (options.initiator) {
            if (isSinglePageMode) {
                // 单页模式：使用不需要登录的公开接口
                this.loadInitiatorInfoForSinglePage(options.initiator);
            } else {
                // 正常模式：使用标准接口
                this.loadInitiatorInfo(options.initiator);
            }
        } else {
            this.setData({ pageLoading: false });
        }
    },

    onShow() {
        this._syncI18n();
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({
            locale: locale,
            uiCopy: i18n.getPageCopy('viral', locale)
        });
        i18n.setNavigationBarTitle('viral.navTitle', locale);
    },

    /**
     * 加载发起人信息（正常模式）
     */
    async loadInitiatorInfo(initiatorId) {
        try {
            const result = await wx.cloud.callFunction({
                name: 'viralManager',
                data: {
                    action: 'getStatsPublic',
                    initiatorOpenId: initiatorId
                }
            });

            if (result.result && result.result.success) {
                this.setData({
                    initiatorNickname: result.result.initiatorNickname || '',
                    initiatorAvatarUrl: result.result.initiatorAvatarUrl || '',
                    pageLoading: false
                });
                console.log('【沉寂朋友】发起人信息:', result.result.initiatorNickname);
            } else {
                this.setData({ pageLoading: false });
            }
        } catch (err) {
            console.error('【沉寂朋友】获取发起人信息失败:', err);
            this.setData({ pageLoading: false });
        }
    },

    /**
     * 加载发起人信息（单页模式 - 使用公开接口，开启未登录访问后可用）
     */
    async loadInitiatorInfoForSinglePage(initiatorId) {
        console.log('【沉寂朋友】单页模式：加载发起人信息...');
        
        try {
            // 尝试调用云函数（需要开启未登录访问）
            const result = await wx.cloud.callFunction({
                name: 'viralManager',
                data: {
                    action: 'getStatsPublic',
                    initiatorOpenId: initiatorId
                }
            });

            if (result.result && result.result.success) {
                this.setData({
                    initiatorNickname: result.result.initiatorNickname || '',
                    initiatorAvatarUrl: result.result.initiatorAvatarUrl || '',
                    pageLoading: false
                });
                console.log('【沉寂朋友】单页模式：发起人信息加载成功');
            } else {
                this.setData({ pageLoading: false });
            }
        } catch (err) {
            // 单页模式下云函数调用可能失败（未开启未登录访问）
            console.warn('【沉寂朋友】单页模式：云函数调用失败，显示引导页面');
            console.warn('【沉寂朋友】错误详情:', err.message || err);
            this.setData({ pageLoading: false });
        }
    },

    /**
     * 点击Hi按钮
     * 【优化】如果用户已有完整资料，直接使用，无需重新填写
     */
    onHiTap() {
        if (this.data.hasInteracted) return;
        
        // 单页模式下无法互动，提示用户
        if (this.data.isSinglePageMode) {
            wx.showToast({ 
                title: this.data.uiCopy.landing.toastOpenMiniProgram || '请点击下方「打开小程序」', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        // 【优化】检查是否已有用户资料（缓存或 globalData 或预加载）
        const existingProfile = this._getExistingProfile();
        if (existingProfile && existingProfile.avatarUrl && existingProfile.nickname) {
            console.log('【沉寂朋友】检测到已有完整资料，直接使用');
            
            // 【重要】如果已有云存储头像，直接发送，不再弹窗
            if (existingProfile.avatarUrl.startsWith('cloud://')) {
                console.log('【沉寂朋友】头像已是云存储链接，直接记录互动');
                this.recordInteraction(existingProfile.avatarUrl, existingProfile.nickname);
                return;
            }
            
            // 头像不是云存储链接，需要弹窗让用户确认/上传
            this.setData({
                existingAvatarUrl: existingProfile.avatarUrl,
                existingNickname: existingProfile.nickname
            });
        }
        
        // 显示头像昵称填写弹窗
        this.setData({ showProfileModal: true });
    },
    
    /**
     * 获取用户已有的资料
     * 【优化】优先使用预加载的云端数据（最可靠）
     */
    _getExistingProfile() {
        const app = getApp();
        
        // 优先使用预加载的云端数据（由 getAppLaunchData 从数据库获取）
        if (app.globalData?.viralProfile?.hasProfile) {
            console.log('【沉寂朋友】使用预加载的云端资料');
            return app.globalData.viralProfile;
        }
        
        // 其次从本地缓存获取（可能是刚刚保存的）
        try {
            const cache = wx.getStorageSync(PROFILE_CACHE_KEY);
            if (cache && cache.expireAt > Date.now() && cache.data?.hasProfile) {
                console.log('【沉寂朋友】使用本地缓存资料');
                return cache.data;
            }
        } catch (e) {
            console.warn('【沉寂朋友】读取缓存失败:', e);
        }
        
        return null;
    },
    
    /**
     * 保存用户资料到缓存和 globalData
     */
    _saveProfileToCache(profile) {
        try {
            // 保存到本地缓存
            wx.setStorageSync(PROFILE_CACHE_KEY, {
                data: profile,
                expireAt: Date.now() + CACHE_EXPIRE_TIME
            });
            
            // 同步到 globalData
            const app = getApp();
            app.globalData.viralProfile = profile;
            
            console.log('【沉寂朋友】资料已缓存（访客页面）');
        } catch (e) {
            console.warn('【沉寂朋友】保存缓存失败:', e);
        }
    },

    /**
     * 头像昵称确认
     */
    async onProfileConfirm(e) {
        const { avatarUrl, nickname } = e.detail;
        console.log('【沉寂朋友】用户信息:', nickname);

        // 保存临时数据
        this.setData({
            tempAvatarUrl: avatarUrl,
            tempNickname: nickname,
            showProfileModal: false
        });

        // 记录互动
        await this.recordInteraction(avatarUrl, nickname);
    },

    /**
     * 关闭弹窗
     */
    onProfileClose() {
        this.setData({ showProfileModal: false });
    },

    /**
     * 记录互动到云端（仅在正常模式下调用）
     * 【优化】成功后保存用户资料到缓存，避免下次重复弹窗
     */
    async recordInteraction(avatarUrl, nickname) {
        const { initiatorId } = this.data;

        console.log('【沉寂朋友】记录互动, initiatorId:', initiatorId);

        if (!initiatorId) {
            console.log('【沉寂朋友】✗ 无发起者ID');
            wx.showToast({ title: this.data.uiCopy.landing.toastInvalidLink || '分享链接无效', icon: 'none' });
            return;
        }

        wx.showLoading({ title: this.data.uiCopy.landing.loadingSending || '发送中...', mask: true });

        try {
            const result = await wx.cloud.callFunction({
                name: 'viralManager',
                data: {
                    action: 'record',
                    initiatorOpenId: initiatorId,
                    source: 'friend',  // 正常模式都是来自好友分享
                    visitorAvatarUrl: avatarUrl,
                    visitorNickname: nickname
                }
            });

            wx.hideLoading();
            console.log('【沉寂朋友】记录结果:', JSON.stringify(result.result));

            // 重置弹窗组件状态
            const modal = this.selectComponent('#profileModal');
            if (modal) modal.reset();

            if (result.result && result.result.success) {
                console.log('【沉寂朋友】✓ 成功!');
                
                // 【优化】保存用户资料到缓存，下次进入发起人页面不再弹窗
                this._saveProfileToCache({
                    hasProfile: true,
                    avatarUrl: avatarUrl,
                    nickname: nickname,
                    shareImageFileId: null  // 访客不生成分享图
                });
                
                // 不显示系统提示，直接更新页面
                this.setData({ hasInteracted: true });
            } else if (result.result && result.result.alreadySent) {
                // 已经发送过也显示成功状态
                this.setData({ hasInteracted: true });
            } else {
                wx.showToast({ title: this.data.uiCopy.landing.toastSendFailed || '发送失败', icon: 'none' });
            }
        } catch (err) {
            wx.hideLoading();
            console.error('【沉寂朋友】✗ 异常:', err);
            wx.showToast({ title: this.data.uiCopy.landing.toastNetworkError || '网络错误', icon: 'none' });
        }
    },

    /**
     * 生成我的页面
     */
    onCreateOwn() {
        if (this.data.isSinglePageMode) {
            // 单页模式下无法跳转，提示用户
            wx.showToast({ title: this.data.uiCopy.landing.toastOpenMiniProgramPlain || '请点击下方打开小程序', icon: 'none' });
            return;
        }
        wx.navigateTo({
            url: '/pages/viral/index'
        });
    },

    /**
     * 分享给好友
     */
    onShareAppMessage() {
        const app = getApp();
        const openId = app.globalData?.openId || '';

        return {
            title: this.data.uiCopy.landing.shareFriendTitle || '有人想和你出来玩 👀',
            path: `/pages/viral/landing?initiator=${openId}`,
            imageUrl: '/images/share-viral.png'
        };
    },

    /**
     * 分享到朋友圈
     */
    onShareTimeline() {
        const app = getApp();
        const openId = app.globalData?.openId || '';

        return {
            title: this.data.uiCopy.landing.shareTimelineTitle || '我该喊你出来玩儿吗！？',
            query: `initiator=${openId}`,
            imageUrl: '/images/share-viral.png'
        };
    },

    /**
     * 阻止页面滚动
     */
    preventMove() {
        return false;
    }
});
