/**
 * 沉寂朋友发起页 - 用户A视角
 * 
 * 功能：
 * - 首次进入弹窗填写头像昵称（只能填写一次）
 * - 查看助力好友列表
 * - 分享到好友/朋友圈
 * - 【重要】适配单页模式（朋友圈打开时显示访客视角）
 * 
 * 优化：
 * - 本地缓存用户资料，减少云函数调用
 * - 与访客页面共享资料状态，避免重复弹窗
 * - 【新】前端 Canvas 生成分享图，无需等待云函数
 */
const i18n = require('../../utils/i18n');

// 本地缓存 key
const PROFILE_CACHE_KEY = 'viral_profile_cache';
const SUPPORTERS_CACHE_KEY = 'viral_supporters_cache';
const CACHE_EXPIRE_TIME = 5 * 60 * 1000;  // 缓存 5 分钟

// 分享图配置
const SHARE_IMAGE_CONFIG = {
    width: 500,
    height: 400,
    avatar: {
        x: 120,      // 头像圆心 X
        y: 200,      // 头像圆心 Y
        radius: 60,  // 头像半径
        borderRadius: 65,  // 边框半径
        borderWidth: 4     // 边框宽度
    },
    template: '/images/share-template-bg.png'  // 底图路径
};

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('viral', 'zh-Hans'),
        loading: true,
        openId: '',
        // ========== 单页模式（朋友圈打开）==========
        isSinglePageMode: false,
        // 发起人信息（单页模式下显示）
        initiatorId: '',
        initiatorNickname: '',
        initiatorAvatarUrl: '',
        // ========== 发起人视角 ==========
        // 用户资料
        hasProfile: false,
        avatarUrl: '',
        nickname: '',
        showProfileModal: false,
        // 分享图（前端 Canvas 生成）
        shareImagePath: '',  // Canvas 生成的临时文件路径
        // 助力数据
        hiCount: 0,
        hasNew: false,
        supporters: [],
        refreshing: false  // 刷新状态
    },
    
    // 上次刷新时间（防止频繁刷新）
    _lastRefreshTime: 0,
    // Canvas 实例
    _canvas: null,
    _ctx: null,

    onLoad(options) {
        this._syncI18n();
        console.log('【沉寂朋友】========== 发起页加载 ==========');
        console.log('【沉寂朋友】options:', JSON.stringify(options));
        
        // 检测是否为单页模式（朋友圈打开）
        const launchOptions = wx.getLaunchOptionsSync();
        const isSinglePageMode = launchOptions.scene === 1154;
        
        console.log('【沉寂朋友】场景值:', launchOptions.scene);
        console.log('【沉寂朋友】是否单页模式（朋友圈）:', isSinglePageMode);
        
        // 获取 initiator 参数
        const initiatorId = options.initiator || '';
        console.log('【沉寂朋友】initiator 参数:', initiatorId || '【空】');
        
        this.setData({ 
            isSinglePageMode: isSinglePageMode,
            initiatorId: initiatorId
        });
        
        // 初始化 Canvas（非单页模式）
        if (!isSinglePageMode) {
            this._initCanvas();
        }
        
        if (isSinglePageMode) {
            // 单页模式：显示访客视角，加载发起人信息
            console.log('【沉寂朋友】单页模式：加载发起人信息');
            this.loadInitiatorInfoForSinglePage(initiatorId);
        } else if (initiatorId) {
            // 正常模式 + 有 initiator 参数：说明是从"打开小程序"进来的访客
            // 需要跳转到 landing 页面（访客助力页面）
            console.log('【沉寂朋友】检测到 initiator 参数，跳转到访客页面');
            wx.redirectTo({
                url: `/pages/viral/landing?initiator=${initiatorId}`
            });
        } else {
            // 正常模式 + 无 initiator 参数：显示发起人视角
            console.log('【沉寂朋友】正常模式：显示发起人视角');
            this.initPage();
        }
    },

    onShow() {
        this._syncI18n();
        if (this.data.isSinglePageMode) return;

        const now = Date.now();
        if (now - this._lastRefreshTime < 30000) {
            console.log('【沉寂朋友】30秒内已刷新，跳过');
            return;
        }

        if (this.data.openId && this.data.hasProfile) {
            this._lastRefreshTime = now;
            this.loadSupporters();
        }
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
     * 初始化 Canvas
     */
    _initCanvas() {
        const query = this.createSelectorQuery();
        query.select('#shareCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (res[0] && res[0].node) {
                    const canvas = res[0].node;
                    const ctx = canvas.getContext('2d');
                    
                    // 设置 Canvas 尺寸
                    const dpr = wx.getWindowInfo().pixelRatio;
                    canvas.width = SHARE_IMAGE_CONFIG.width * dpr;
                    canvas.height = SHARE_IMAGE_CONFIG.height * dpr;
                    ctx.scale(dpr, dpr);
                    
                    this._canvas = canvas;
                    this._ctx = ctx;
                    console.log('【沉寂朋友】✓ Canvas 初始化成功');
                }
            });
    },

    /**
     * 单页模式：加载发起人信息
     * 注意：需要在云开发控制台开启"未登录用户访问云资源"
     */
    async loadInitiatorInfoForSinglePage(initiatorId) {
        console.log('【沉寂朋友】单页模式：开始加载发起人信息');
        console.log('【沉寂朋友】单页模式：initiatorId =', initiatorId || '【空】');
        
        if (!initiatorId) {
            console.log('【沉寂朋友】单页模式：无 initiator 参数，显示默认内容');
            this.setData({ loading: false });
            return;
        }
        
        try {
            console.log('【沉寂朋友】单页模式：调用 getStatsPublic...');
            
            // 使用公开接口获取发起人信息（开启未登录访问后可用）
            const result = await wx.cloud.callFunction({
                name: 'viralManager',
                data: {
                    action: 'getStatsPublic',
                    initiatorOpenId: initiatorId
                }
            });

            console.log('【沉寂朋友】单页模式：云函数返回:', JSON.stringify(result.result));

            if (result.result && result.result.success) {
                const nickname = result.result.initiatorNickname || '';
                const avatarUrl = result.result.initiatorAvatarUrl || '';
                
                console.log('【沉寂朋友】单页模式：发起人昵称:', nickname || '【空】');
                console.log('【沉寂朋友】单页模式：发起人头像:', avatarUrl ? '有' : '【空】');
                
                this.setData({
                    initiatorNickname: nickname,
                    initiatorAvatarUrl: avatarUrl,
                    loading: false
                });
                console.log('【沉寂朋友】单页模式：✓ 发起人信息加载成功');
            } else {
                console.warn('【沉寂朋友】单页模式：云函数返回失败', result.result?.error);
                this.setData({ loading: false });
            }
        } catch (err) {
            // 单页模式下云函数可能因未开启"未登录访问"而失败
            console.error('【沉寂朋友】单页模式：云函数调用异常');
            console.error('【沉寂朋友】错误信息:', err.message || err);
            console.error('【沉寂朋友】提示：请确保已在云开发控制台开启"未登录用户访问云资源"');
            this.setData({ loading: false });
        }
    },

    /**
     * 初始化页面 - 发起人视角
     * 【优化】优先使用预加载的云端数据（globalData.viralProfile）
     * 这是最可靠的数据源，因为它直接从云端数据库获取
     */
    async initPage() {
        const app = getApp();

        // 等待 App 启动数据加载完成
        if (!app.globalData.launchDataReady) {
            console.log('【沉寂朋友】等待启动数据...');
            const ready = await app.waitForLaunchData(5000);
            if (!ready) {
                console.log('【沉寂朋友】✗ 启动数据加载超时');
                this.setData({ loading: false });
                wx.showToast({ title: this.data.uiCopy.toastLoadTimeout || '加载超时，请重试', icon: 'none' });
                return;
            }
        }

        const openId = app.globalData?.openId || '';
        if (!openId) {
            console.log('【沉寂朋友】✗ 无法获取 openId');
            this.setData({ loading: false });
            wx.showToast({ title: this.data.uiCopy.toastLoadFailed || '加载失败，请重试', icon: 'none' });
            return;
        }

        this.setData({ openId });
        console.log('【沉寂朋友】✓ openId 已获取');

        // 【重要】优先使用预加载的云端数据（最可靠）
        // 预加载数据由 getAppLaunchData 云函数从数据库直接获取
        const preloadedProfile = app.globalData?.viralProfile;
        
        if (preloadedProfile && preloadedProfile.hasProfile) {
            console.log('【沉寂朋友】✓ 使用预加载的云端资料');
            this.setData({
                hasProfile: true,
                avatarUrl: preloadedProfile.avatarUrl || '',
                nickname: preloadedProfile.nickname || ''
            });
            
            // 同步更新本地缓存
            this._saveProfileToCache(preloadedProfile);
            
            // 【新】前端 Canvas 生成分享图
            this._generateShareImageAsync(preloadedProfile.avatarUrl);
            
            this.loadSupporters();
            return;
        }
        
        // 如果预加载没有资料，检查本地缓存（可能是刚刚保存的）
        const cachedProfile = this._getProfileFromCache();
        if (cachedProfile && cachedProfile.hasProfile) {
            console.log('【沉寂朋友】使用本地缓存资料');
            this.setData({
                hasProfile: true,
                avatarUrl: cachedProfile.avatarUrl || '',
                nickname: cachedProfile.nickname || ''
            });
            
            // 【新】前端 Canvas 生成分享图
            this._generateShareImageAsync(cachedProfile.avatarUrl);
            
            this.loadSupporters();
            return;
        }
        
        // 预加载和缓存都没有，从云端实时检查
        // 这是最后的保障，确保不会因为预加载失败而误判
        console.log('【沉寂朋友】预加载和缓存都没有资料，从云端检查');
        this.checkProfile();
    },
    
    /**
     * 从本地缓存获取用户资料
     */
    _getProfileFromCache() {
        try {
            const cache = wx.getStorageSync(PROFILE_CACHE_KEY);
            if (cache && cache.expireAt > Date.now()) {
                return cache.data;
            }
        } catch (e) {
            console.warn('【沉寂朋友】读取缓存失败:', e);
        }
        return null;
    },
    
    /**
     * 保存用户资料到本地缓存和 globalData
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
            
            console.log('【沉寂朋友】资料已缓存');
        } catch (e) {
            console.warn('【沉寂朋友】保存缓存失败:', e);
        }
    },

    /**
     * 快速检查资料状态
     */
    async checkProfile() {
        try {
            const result = await wx.cloud.callFunction({
                name: 'viralManager',
                data: { action: 'getProfile' }
            });

            if (result.result && result.result.success) {
                const profile = {
                    hasProfile: result.result.hasProfile,
                    avatarUrl: result.result.avatarUrl || '',
                    nickname: result.result.nickname || ''
                };
                
                // 【优化】保存到缓存
                this._saveProfileToCache(profile);
                
                if (!profile.hasProfile) {
                    // 没有资料，显示弹窗
                    this.setData({ 
                        showProfileModal: true,
                        loading: false 
                    });
                } else {
                    // 有资料
                    this.setData({
                        hasProfile: true,
                        avatarUrl: profile.avatarUrl,
                        nickname: profile.nickname
                    });
                    
                    // 【新】前端 Canvas 生成分享图
                    this._generateShareImageAsync(profile.avatarUrl);
                    
                    this.loadSupporters();
                }
            } else {
                this.setData({ loading: false });
            }
        } catch (err) {
            console.error('【沉寂朋友】检查资料失败:', err);
            this.setData({ loading: false });
        }
    },

    /**
     * 加载助力列表
     */
    async loadSupporters() {
        try {
            const result = await wx.cloud.callFunction({
                name: 'viralManager',
                data: {
                    action: 'getStats',
                    clearNew: true
                }
            });

            if (result.result && result.result.success) {
                const { hiCount, hasNew, supporters } = result.result;
                this.setData({
                    hiCount: hiCount || 0,
                    hasNew: hasNew || false,
                    supporters: supporters || [],
                    loading: false,
                    refreshing: false
                });
                
                console.log('【沉寂朋友】✓ 助力列表加载成功, hiCount:', hiCount);
            } else {
                this.setData({ loading: false, refreshing: false });
            }
        } catch (err) {
            console.error('【沉寂朋友】✗ 加载助力列表失败:', err);
            this.setData({ loading: false, refreshing: false });
        }
    },
    
    /**
     * 手动刷新助力列表
     */
    async onRefreshSupporters() {
        if (this.data.refreshing) return;
        
        console.log('【沉寂朋友】手动刷新助力列表...');
        this.setData({ refreshing: true });
        
        // 重置防抖时间，允许刷新
        this._lastRefreshTime = 0;
        
        await this.loadSupporters();
        
        wx.showToast({
            title: this.data.uiCopy.toastRefreshed || '已刷新',
            icon: 'success',
            duration: 1500
        });
    },

    /**
     * 【核心】前端 Canvas 生成分享图
     * @param {string} avatarUrl - 头像 URL（云存储 fileID 或临时路径）
     * @returns {Promise<string>} 生成的临时文件路径
     */
    async generateShareImage(avatarUrl) {
        console.log('【沉寂朋友】========== 开始生成分享图 ==========');
        console.log('【沉寂朋友】头像地址:', avatarUrl?.substring(0, 60) + '...');
        
        if (!this._canvas || !this._ctx) {
            console.warn('【沉寂朋友】Canvas 未初始化，尝试重新初始化');
            await this._waitForCanvas();
            if (!this._canvas || !this._ctx) {
                console.error('【沉寂朋友】✗ Canvas 初始化失败');
                return '';
            }
        }
        
        const canvas = this._canvas;
        const ctx = this._ctx;
        const config = SHARE_IMAGE_CONFIG;
        
        try {
            // 1. 获取头像本地路径（使用 getImageInfo 确保路径格式正确）
            let avatarLocalPath = avatarUrl;
            if (avatarUrl.startsWith('cloud://')) {
                console.log('【沉寂朋友】头像是云存储链接，获取临时 URL...');
                const tempRes = await wx.cloud.getTempFileURL({ fileList: [avatarUrl] });
                if (tempRes.fileList && tempRes.fileList[0] && tempRes.fileList[0].tempFileURL) {
                    const tempUrl = tempRes.fileList[0].tempFileURL;
                    console.log('【沉寂朋友】临时 URL:', tempUrl.substring(0, 60) + '...');
                    // 使用 getImageInfo 获取本地路径（比 downloadFile 更可靠）
                    const imgInfo = await wx.getImageInfo({ src: tempUrl });
                    avatarLocalPath = imgInfo.path;
                    console.log('【沉寂朋友】✓ 头像路径获取成功:', avatarLocalPath.substring(0, 40) + '...');
                }
            } else if (avatarUrl.startsWith('http')) {
                // 网络图片
                console.log('【沉寂朋友】头像是网络链接...');
                const imgInfo = await wx.getImageInfo({ src: avatarUrl });
                avatarLocalPath = imgInfo.path;
                console.log('【沉寂朋友】✓ 头像路径获取成功');
            } else if (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('/tmp')) {
                // 本地临时文件，使用 getImageInfo 转换为可用路径
                console.log('【沉寂朋友】头像是本地临时文件...');
                const imgInfo = await wx.getImageInfo({ src: avatarUrl });
                avatarLocalPath = imgInfo.path;
                console.log('【沉寂朋友】✓ 头像路径获取成功');
            }
            
            // 2. 加载底图（本地资源使用相对路径）
            console.log('【沉寂朋友】加载底图...');
            const bgImage = canvas.createImage();
            await new Promise((resolve, reject) => {
                bgImage.onload = resolve;
                bgImage.onerror = (e) => {
                    console.error('【沉寂朋友】底图加载失败:', e);
                    reject(e);
                };
                bgImage.src = config.template;
            });
            console.log('【沉寂朋友】✓ 底图加载成功');
            
            // 3. 加载头像（使用处理后的路径）
            console.log('【沉寂朋友】加载头像，路径:', avatarLocalPath.substring(0, 50) + '...');
            const avatarImage = canvas.createImage();
            await new Promise((resolve, reject) => {
                avatarImage.onload = resolve;
                avatarImage.onerror = (e) => {
                    console.error('【沉寂朋友】头像加载失败:', e);
                    reject(e);
                };
                avatarImage.src = avatarLocalPath;
            });
            console.log('【沉寂朋友】✓ 头像加载成功');
            
            // 4. 清空画布并绘制底图
            ctx.clearRect(0, 0, config.width, config.height);
            ctx.drawImage(bgImage, 0, 0, config.width, config.height);
            
            // 5. 绘制圆形头像
            const { x, y, radius } = config.avatar;
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.clip();
            // 在圆形区域内绘制头像（头像区域：左上角(x-radius, y-radius)，尺寸 radius*2）
            ctx.drawImage(avatarImage, x - radius, y - radius, radius * 2, radius * 2);
            ctx.restore();
            
            console.log('【沉寂朋友】✓ 头像绘制完成');
            
            // 6. 导出为临时文件
            const tempFilePath = await new Promise((resolve, reject) => {
                wx.canvasToTempFilePath({
                    canvas: canvas,
                    x: 0,
                    y: 0,
                    width: config.width,
                    height: config.height,
                    destWidth: config.width * 2,  // 2倍图提高清晰度
                    destHeight: config.height * 2,
                    fileType: 'png',
                    success: (res) => resolve(res.tempFilePath),
                    fail: (e) => {
                        console.error('【沉寂朋友】导出失败:', e);
                        reject(e);
                    }
                });
            });
            
            console.log('【沉寂朋友】✓ 分享图生成成功:', tempFilePath);
            return tempFilePath;
            
        } catch (err) {
            console.error('【沉寂朋友】✗ 生成分享图失败:', err);
            return '';
        }
    },
    
    /**
     * 等待 Canvas 初始化完成
     */
    _waitForCanvas() {
        return new Promise((resolve) => {
            if (this._canvas && this._ctx) {
                resolve();
                return;
            }
            
            // 最多等待 2 秒
            let attempts = 0;
            const maxAttempts = 20;
            const interval = setInterval(() => {
                attempts++;
                if (this._canvas && this._ctx) {
                    clearInterval(interval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    // 尝试重新初始化
                    this._initCanvas();
                    setTimeout(resolve, 200);
                }
            }, 100);
        });
    },
    
    /**
     * 异步生成分享图（不阻塞主流程）
     */
    async _generateShareImageAsync(avatarUrl) {
        if (!avatarUrl) return;
        
        // 等待 Canvas 初始化
        await this._waitForCanvas();
        
        // 生成分享图
        const shareImagePath = await this.generateShareImage(avatarUrl);
        if (shareImagePath) {
            this.setData({ shareImagePath: shareImagePath });
            console.log('【沉寂朋友】✓ 分享图已生成（异步）');
        }
    },

    /**
     * 头像昵称弹窗确认
     * 【优化】
     * 1. 先立即更新界面
     * 2. 前端 Canvas 生成分享图（<1秒）
     * 3. 异步保存到云端
     */
    async onProfileConfirm(e) {
        const { avatarUrl, nickname } = e.detail;
        console.log('【沉寂朋友】保存用户资料:', nickname);
        
        // 【优化】先立即更新界面，提升响应速度
        const modal = this.selectComponent('#profileModal');
        if (modal) modal.reset();
        
        const profile = {
            hasProfile: true,
            avatarUrl: avatarUrl,
            nickname: nickname
        };
        
        // 立即更新界面和缓存
        this.setData({
            hasProfile: true,
            avatarUrl: avatarUrl,
            nickname: nickname,
            showProfileModal: false
        });
        
        // 保存到缓存（立即生效）
        this._saveProfileToCache(profile);
        
        console.log('【沉寂朋友】✓ 界面已更新');
        
        // 【核心】前端 Canvas 生成分享图（快速，<1秒）
        console.log('【沉寂朋友】开始前端生成分享图...');
        const shareImagePath = await this.generateShareImage(avatarUrl);
        if (shareImagePath) {
            this.setData({ shareImagePath: shareImagePath });
            console.log('【沉寂朋友】✓ 分享图已生成，可立即分享');
        }

        // 异步保存到云端（不阻塞用户操作）
        try {
            const result = await wx.cloud.callFunction({
                name: 'viralManager',
                data: {
                    action: 'saveProfile',
                    avatarUrl: avatarUrl,
                    nickname: nickname
                }
            });

            if (result.result && result.result.success) {
                console.log('【沉寂朋友】✓ 云端保存成功');
            } else {
                console.warn('【沉寂朋友】云端保存返回失败:', result.result?.error);
            }
        } catch (err) {
            console.error('【沉寂朋友】云端保存异常:', err);
        }
    },

    /**
     * 关闭弹窗 - 如果没有资料不允许关闭
     */
    onProfileClose() {
        if (!this.data.hasProfile) {
            wx.showToast({ title: this.data.uiCopy.toastNeedProfile || '请先完善个人信息', icon: 'none' });
            return;
        }
        this.setData({ showProfileModal: false });
    },

    /**
     * 分享给好友
     * 好友分享是卡片形式（5:4 比例），使用 Canvas 生成的分享图
     */
    onShareAppMessage() {
        console.log('【沉寂朋友】========== 分享给好友 ==========');
        console.log('【沉寂朋友】shareImagePath:', this.data.shareImagePath || '【空】');
        
        // 使用 Canvas 生成的分享图，否则使用默认底图
        const imageUrl = this.data.shareImagePath || '/images/share-template-bg.png';
        const isDynamic = !!this.data.shareImagePath;
        console.log('【沉寂朋友】使用分享图:', isDynamic ? '动态(Canvas生成)' : '静态(默认底图)');
        
        return {
            title: i18n.formatString(this.data.uiCopy.shareFriendTitle || '{name}想喊你出来玩 👀', {
                name: this.data.nickname || this.data.uiCopy.shareFriendFallbackName || '有人'
            }),
            path: `/pages/viral/landing?initiator=${this.data.openId}`,
            imageUrl: imageUrl
        };
    },

    /**
     * 分享到朋友圈配置
     * 朋友圈分享是横幅形式（1:1 比例），直接使用用户头像更合适
     */
    onShareTimeline() {
        console.log('【沉寂朋友】========== 分享到朋友圈 ==========');
        
        // 朋友圈分享：使用用户头像（1:1 正方形，适合朋友圈横幅展示）
        // 如果没有头像，则使用默认模板图
        const imageUrl = this.data.avatarUrl || '/images/share-viral.png';
        
        console.log('【沉寂朋友】使用图片:', this.data.avatarUrl ? '用户头像' : '默认模板');
        console.log('【沉寂朋友】头像地址:', imageUrl.substring(0, 60) + (imageUrl.length > 60 ? '...' : ''));
        
        return {
            title: this.data.uiCopy.shareTimelineTitle || '我该喊你出来玩吗？',
            query: `initiator=${this.data.openId}`,
            imageUrl: imageUrl
        };
    },

    /**
     * 引导分享到朋友圈
     */
    onGuideShareTimeline() {
        wx.showModal({
            title: this.data.uiCopy.guideModalTitle || '分享到朋友圈',
            content: this.data.uiCopy.guideModalContent || '点击右上角「...」，选择「分享到朋友圈」',
            showCancel: false,
            confirmText: this.data.uiCopy.guideModalConfirm || '知道了'
        });
    },

    /**
     * 阻止页面滚动
     */
    preventMove() {
        return false;
    }
});
