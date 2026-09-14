const { CLOUD_ENV, APP_VERSION } = require('./utils/config');
const i18n = require('./utils/i18n');
// 导入实时日志工具
const log = require('./utils/log');

// 系统配置缓存键
const SYSTEM_CONFIG_STORAGE_KEY = 'system_config';
const SYSTEM_CONFIG_TIME_KEY = 'system_config_time';
const SYSTEM_CONFIG_TTL = 5 * 60 * 1000; // 配置缓存5分钟

// 用户登录缓存键
const USER_LOGIN_STORAGE_KEY = 'user_login_cache';
const USER_LOGIN_TIME_KEY = 'user_login_time';
// 【优化】缩短缓存时间从24小时到4小时，确保更频繁地与服务端同步会员状态
const USER_LOGIN_TTL = 4 * 60 * 60 * 1000; // 登录缓存4小时

App({
    onLaunch() {
        this._initLocaleData();

        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力');
        } else {
            wx.cloud.init({
                env: CLOUD_ENV,
                traceUser: true,
            });

            // 【优化】使用聚合云函数一次获取所有启动数据
            // 如果失败则降级到原来的分散调用
            this._loadAppLaunchData();
        }
        console.log('App Launch')
    },

    _initLocaleData() {
        const localeMeta = i18n.resolveLocaleMeta();
        this.globalData.language = localeMeta.language;
        this.globalData.locale = localeMeta.locale;
        this.globalData.fontScale = localeMeta.fontScale;
        console.log('[App] Locale initialized:', localeMeta);
    },

    /**
     * 【新增】等待启动数据加载完成
     * 页面可以调用此方法等待 openId 等数据准备好
     * @param {number} timeout - 超时时间（毫秒），默认 5000
     * @returns {Promise<boolean>} 是否成功加载
     */
    waitForLaunchData(timeout = 5000) {
        return new Promise((resolve) => {
            // 如果已经加载完成，直接返回
            if (this.globalData.launchDataReady) {
                resolve(true);
                return;
            }

            const startTime = Date.now();
            const check = () => {
                if (this.globalData.launchDataReady) {
                    resolve(true);
                    return;
                }
                if (Date.now() - startTime >= timeout) {
                    console.warn('[App] waitForLaunchData 超时');
                    resolve(false);
                    return;
                }
                setTimeout(check, 50);
            };
            check();
        });
    },

    /**
     * 【优化】聚合加载启动数据
     * 使用新的 getAppLaunchData 云函数一次性获取所有数据
     * 失败时自动降级到原有的分散调用方式
     */
    async _loadAppLaunchData() {
        console.log('[App] ========== 尝试使用聚合云函数 ==========');

        try {
            const res = await wx.cloud.callFunction({
                name: 'getAppLaunchData',
                data: { version: APP_VERSION }
            });

            const result = res?.result;
            if (result?.success) {
                console.log('[App] ✅ 聚合云函数调用成功');
                this._applyLaunchData(result);
                return;
            } else {
                console.warn('[App] ⚠️ 聚合云函数返回失败，降级到分散调用');
            }
        } catch (e) {
            console.warn('[App] ⚠️ 聚合云函数调用失败，降级到分散调用:', e.message || e);
        }

        // 降级到原有的分散调用方式
        this._loadAppLaunchDataFallback();
    },

    /**
     * 【优化】应用聚合云函数返回的启动数据
     * @param {Object} data - getAppLaunchData 返回的数据
     */
    _applyLaunchData(data) {
        console.log('[App] 正在应用聚合数据...');

        // 1. 应用 OpenID
        if (data.openid) {
            this.globalData.openId = data.openid;
            console.log('[App] ✓ OpenID 已设置');
        }

        // 管理员身份由启动聚合云函数直接返回，不依赖用户是否已注册
        this.globalData.isAdmin = data.admin || false;

        // 2. 应用用户登录状态
        if (data.isRegistered) {
            const isExpired = data.isExpired;
            if (!isExpired) {
                this.globalData.isLoggedIn = true;
                this.globalData.userInfo = data.userInfo || null;
                this.globalData.memberExpiry = data.memberExpiry;
                this.globalData.membershipExpired = false;

                // 保存到本地缓存
                this.saveLoginCache({
                    userInfo: data.userInfo || null,
                    isAdmin: data.admin || false,
                    memberExpiry: data.memberExpiry
                });
                console.log('[App] ✓ 用户已登录，会员有效');
            } else {
                this.globalData.isLoggedIn = false;
                this.globalData.membershipExpired = true;
                this._clearLoginCache();
                console.log('[App] ✓ 用户已注册但会员已过期');
            }
        } else {
            console.log('[App] ✓ 用户未注册');
        }

        // 3. 应用系统配置
        if (data.systemConfig) {
            this._applySystemConfig(data.systemConfig);
            this._saveConfigCache(data.systemConfig);
            console.log('[App] ✓ 系统配置已应用');
        }

        // 4. 应用版本更新通知
        if (data.appVersion) {
            const lastSeenVersion = wx.getStorageSync('lastSeenVersion');
            if (lastSeenVersion !== APP_VERSION) {
                this.globalData.pendingUpdateNotification = data.appVersion;
                console.log('[App] ✓ 版本更新通知已设置');
            }
        }

        // 5. 应用沉寂朋友用户资料状态
        if (data.viralProfile) {
            this.globalData.viralProfile = data.viralProfile;
            console.log('[App] ✓ 沉寂朋友资料状态:', data.viralProfile.hasProfile ? '已完善' : '未完善');
        }

        // 标记启动数据已加载完成
        this.globalData.launchDataReady = true;
        console.log('[App] ========== 聚合数据应用完成 ==========');
    },

    /**
     * 【降级】使用原有的分散调用方式加载启动数据
     * 当聚合云函数不可用时使用
     */
    _loadAppLaunchDataFallback() {
        console.log('[App] ========== 使用分散调用（降级模式） ==========');

        // 从后端获取系统配置
        this._loadSystemConfig();

        // 检查本地缓存的登录状态和会员有效期
        this._checkLocalLoginCache();

        // 预获取 OpenID 供联机游戏使用
        this._preloadOpenId();

        // 检查是否需要显示更新通知
        this._checkUpdateNotification();

        // 降级模式下，延迟标记数据加载完成（等待 openId 获取）
        setTimeout(() => {
            this.globalData.launchDataReady = true;
            console.log('[App] ========== 降级模式数据加载完成 ==========');
        }, 1000);
    },

    /**
     * 【全局错误捕获】捕获所有 JS 运行时错误
     */
    onError(error) {
        log.error('[全局错误]', error);
        log.addFilterMsg('global-error');
    },

    /**
     * 【全局错误捕获】捕获未处理的 Promise 拒绝
     */
    onUnhandledRejection(res) {
        log.error('[Promise拒绝]', String(res.reason));
        log.addFilterMsg('promise-rejection');
    },

    /**
     * 【新增】检查本地缓存的登录状态
     * 如果缓存存在且会员未过期，直接使用缓存
     * 如果会员已过期，清除缓存并标记需要续费
     */
    _checkLocalLoginCache() {
        try {
            const cachedTime = wx.getStorageSync(USER_LOGIN_TIME_KEY);
            if (!cachedTime || (Date.now() - cachedTime) > USER_LOGIN_TTL) {
                console.log('[App] Login cache expired or not found');
                return;
            }

            const cached = wx.getStorageSync(USER_LOGIN_STORAGE_KEY);
            if (!cached) return;

            console.log('[App] Found login cache, checking membership...');

            // 检查会员有效期
            const memberExpiry = cached.memberExpiry;
            const now = Date.now();

            if (!memberExpiry) {
                // 无有效期信息，清除缓存让用户重新登录
                console.log('[App] No memberExpiry in cache, clearing');
                this._clearLoginCache();
                return;
            }

            // 【优化】检查是否过期（客户端严格检查）
            if (now > memberExpiry) {
                // 会员已过期，清除缓存，标记需要续费
                console.log('[App] Membership expired, clearing cache');
                this._clearLoginCache();
                this.globalData.isLoggedIn = false;
                this.globalData.membershipExpired = true;
                return;
            }

            // 【优化】检查是否即将过期（剩余不足2小时），如果是则立即验证
            const isExpiringSoon = (memberExpiry - now) < 2 * 60 * 60 * 1000;

            // 会员未过期，使用缓存的登录状态
            console.log('[App] Membership valid, using cached login');
            this.globalData.isLoggedIn = true;
            this.globalData.userInfo = cached.userInfo || null;
            this.globalData.isAdmin = cached.isAdmin || false;
            this.globalData.memberExpiry = memberExpiry;

            // 【安全增强】后台静默验证服务端会员状态
            // 如果即将过期，立即验证；否则延迟验证
            this._verifyMembershipWithServer(isExpiringSoon ? 0 : 2000);

        } catch (e) {
            console.warn('[App] Check login cache failed:', e);
        }
    },

    /**
     * 【优化】后台验证会员状态
     * @param {number} delay - 延迟执行时间（毫秒），0表示立即执行
     */
    _verifyMembershipWithServer(delay = 2000) {
        const doVerify = () => {
            wx.cloud.callFunction({
                name: 'login',
                success: res => {
                    const result = res?.result;
                    if (result?.success && result?.isRegistered) {
                        if (result.isExpired) {
                            // 服务端判定已过期，清除本地缓存
                            console.log('[App] Server verified: membership expired');
                            this._clearLoginCache();
                            this.globalData.isLoggedIn = false;
                            this.globalData.membershipExpired = true;
                        } else {
                            // 会员有效，更新本地缓存
                            this.globalData.isLoggedIn = true;
                            this.globalData.membershipExpired = false;
                            if (result.memberExpiry) {
                                this.globalData.memberExpiry = result.memberExpiry;
                                this.saveLoginCache({
                                    userInfo: result.userInfo || null,
                                    isAdmin: result.admin || false,
                                    memberExpiry: result.memberExpiry
                                });
                            }
                        }
                    }
                },
                fail: () => {
                    console.warn('[App] Server membership verification failed (silent)');
                }
            });
        };

        if (delay > 0) {
            setTimeout(doVerify, delay);
        } else {
            doVerify();
        }
    },

    /**
     * 【新增】保存登录信息到本地缓存
     * 供 auth-modal 登录成功后调用
     */
    saveLoginCache(data) {
        try {
            const cacheData = {
                userInfo: data.userInfo || null,
                isAdmin: data.isAdmin || false,
                memberExpiry: data.memberExpiry || null
            };
            wx.setStorageSync(USER_LOGIN_STORAGE_KEY, cacheData);
            wx.setStorageSync(USER_LOGIN_TIME_KEY, Date.now());
            console.log('[App] Login cache saved, memberExpiry:', data.memberExpiry);
        } catch (e) {
            console.warn('[App] Save login cache failed:', e);
        }
    },

    /**
     * 【新增】预获取 OpenID 供联机游戏使用
     * 存储到 globalData.openId，游戏页面可直接使用
     */
    _preloadOpenId() {
        wx.cloud.callFunction({
            name: 'login',
            success: res => {
                if (res.result && res.result.openid) {
                    this.globalData.openId = res.result.openid;
                    if (res.result.admin) {
                        this.globalData.isAdmin = true;
                    }
                    console.log('[App] OpenID preloaded');
                }
            },
            fail: err => {
                console.warn('[App] Preload OpenID failed:', err);
            }
        });
    },

    /**
     * 【新增】清除登录缓存
     */
    _clearLoginCache() {
        try {
            wx.removeStorageSync(USER_LOGIN_STORAGE_KEY);
            wx.removeStorageSync(USER_LOGIN_TIME_KEY);
        } catch (e) {
            console.warn('[App] Clear login cache failed:', e);
        }
    },

    /**
     * 【新增】清除登录状态（供登出使用）
     */
    logout() {
        this.globalData.isLoggedIn = false;
        this.globalData.userInfo = null;
        this.globalData.isAdmin = false;
        this.globalData.memberExpiry = null;
        this._clearLoginCache();
    },

    /**
     * 从后端加载系统配置
     * 支持本地缓存，避免每次启动都请求云函数
     */
    _loadSystemConfig() {
        // 1. 优先读取本地缓存
        try {
            const cachedTime = wx.getStorageSync(SYSTEM_CONFIG_TIME_KEY);
            if (cachedTime && (Date.now() - cachedTime) < SYSTEM_CONFIG_TTL) {
                const cached = wx.getStorageSync(SYSTEM_CONFIG_STORAGE_KEY);
                if (cached && typeof cached.requireLogin !== 'undefined') {
                    console.log('[App] Using cached system config:', cached);
                    this._applySystemConfig(cached);
                    // 后台静默刷新
                    this._fetchSystemConfigSilent();
                    return;
                }
            }
        } catch (e) {
            console.warn('[App] Read config cache failed:', e);
        }

        // 2. 无缓存，从云端获取
        this._fetchSystemConfig();
    },

    /**
     * 从云函数获取系统配置
     */
    _fetchSystemConfig() {
        wx.cloud.callFunction({
            name: 'getSystemConfig',
            success: res => {
                const result = res?.result;
                if (result?.success && result.data) {
                    console.log('[App] System config loaded:', result.data);
                    this._applySystemConfig(result.data);
                    this._saveConfigCache(result.data);
                }
            },
            fail: err => {
                console.warn('[App] Failed to load system config:', err);
                // 失败时使用默认值（已在 globalData 中设置）
            }
        });
    },

    /**
     * 静默刷新配置（不影响UI）
     */
    _fetchSystemConfigSilent() {
        setTimeout(() => {
            wx.cloud.callFunction({
                name: 'getSystemConfig',
                success: res => {
                    const result = res?.result;
                    if (result?.success && result.data) {
                        this._saveConfigCache(result.data);
                        // 注意：静默刷新不更新当前会话的配置，下次启动生效
                        console.log('[App] System config silently refreshed');
                    }
                },
                fail: () => { }
            });
        }, 3000);
    },

    /**
     * 应用系统配置到 globalData
     */
    _applySystemConfig(config) {
        if (typeof config.requireLogin !== 'undefined') {
            this.globalData.requireLogin = config.requireLogin;
            console.log('[App] requireLogin set to:', config.requireLogin);
        }

        // 标记配置已加载完成
        this.globalData.configLoaded = true;

        // 【修复】配置加载完成后，刷新管理员Tab状态
        // 这解决了页面在配置加载前调用updateAdminStatus导致Tab不显示的问题
        this._refreshAdminTabIfNeeded();

        // 通知所有监听者配置已更新
        if (this._configCallbacks) {
            this._configCallbacks.forEach(cb => cb(config));
        }
    },

    /**
     * 【新增】刷新管理员Tab状态
     * 获取当前页面的TabBar并更新管理员状态
     */
    _refreshAdminTabIfNeeded() {
        if (!this.globalData.isAdmin || !this.globalData.requireLogin) {
            return; // 不是管理员或未开启强制登录，无需刷新
        }

        try {
            const pages = getCurrentPages();
            if (pages.length > 0) {
                const currentPage = pages[pages.length - 1];
                if (typeof currentPage.getTabBar === 'function') {
                    const tabBar = currentPage.getTabBar();
                    if (tabBar && typeof tabBar.updateAdminStatus === 'function') {
                        console.log('[App] Refreshing admin tab after config loaded');
                        tabBar.updateAdminStatus(true);
                    }
                }
            }
        } catch (e) {
            console.warn('[App] Failed to refresh admin tab:', e);
        }
    },

    /**
     * 保存配置到本地缓存
     */
    _saveConfigCache(config) {
        try {
            wx.setStorageSync(SYSTEM_CONFIG_STORAGE_KEY, config);
            wx.setStorageSync(SYSTEM_CONFIG_TIME_KEY, Date.now());
        } catch (e) {
            console.warn('[App] Save config cache failed:', e);
        }
    },

    /**
     * 注册配置更新回调（供页面使用）
     */
    onConfigUpdate(callback) {
        if (!this._configCallbacks) {
            this._configCallbacks = [];
        }
        this._configCallbacks.push(callback);
    },

    /**
     * 【新增】检查是否需要显示更新通知
     * 对比当前版本与本地已读版本，如果不同则从云端获取更新日志
     */
    _checkUpdateNotification() {
        const lastSeenVersion = wx.getStorageSync('lastSeenVersion');

        // 如果用户已经看过当前版本的更新通知，跳过
        if (lastSeenVersion === APP_VERSION) {
            console.log('[App] User already seen version:', APP_VERSION);
            return;
        }

        console.log('[App] Checking update notification for version:', APP_VERSION);

        // 调用云函数获取版本更新日志
        wx.cloud.callFunction({
            name: 'getAppVersion',
            data: { version: APP_VERSION },
            success: res => {
                const result = res?.result;
                if (result?.success && result.data) {
                    console.log('[App] Found update notification:', result.data.title);
                    // 存储到 globalData，等待首页显示
                    this.globalData.pendingUpdateNotification = result.data;
                } else {
                    console.log('[App] No update notification for this version');
                }
            },
            fail: err => {
                console.warn('[App] Get update notification failed:', err);
            }
        });
    },

    /**
     * 【新增】标记版本更新通知已读
     */
    markVersionSeen() {
        wx.setStorageSync('lastSeenVersion', APP_VERSION);
        this.globalData.pendingUpdateNotification = null;
        console.log('[App] Version marked as seen:', APP_VERSION);
    },

    onHide() {
        // 记录进入后台的时间
        this.globalData.lastHideTime = Date.now();

        // 清除 TabBar 恢复定时器（防止后台时执行无意义操作）
        this._clearTabBarRecoveryTimers();

        // 【优化】批量上报游戏统计
        this._flushGameStats();
    },

    onShow() {
        this._initLocaleData();

        const now = Date.now();
        this.globalData.lastAppShowTime = now;
        this.globalData.isResuming = true;

        // 检测后台时长，超过阈值则跳转首页
        const BACKGROUND_TIMEOUT = 5 * 60 * 1000; // 5分钟
        const lastHideTime = this.globalData.lastHideTime;

        if (lastHideTime && (now - lastHideTime) > BACKGROUND_TIMEOUT) {
            const backgroundDuration = Math.round((now - lastHideTime) / 1000);
            console.log(`[App] Background duration: ${backgroundDuration}s, redirecting to home`);

            // 检查当前是否已经在首页
            const pages = getCurrentPages();
            const currentRoute = pages.length > 0 ? pages[pages.length - 1]?.route : '';

            if (currentRoute !== 'pages/home/index') {
                this.globalData.isResuming = false;
                wx.reLaunch({
                    url: '/pages/home/index',
                    success: () => {
                        console.log('[App] Redirected to home after long background');
                    }
                });
                return;
            }
        }

        // 清除后台时间记录
        this.globalData.lastHideTime = null;

        // 【优化】先清除旧的定时器，防止堆积
        this._clearTabBarRecoveryTimers();

        // 使用统一的 TabBar 恢复机制
        this._tabBarRecoveryTimers = [];

        const recoverTabBar = (delay, attempt) => {
            const timer = setTimeout(() => {
                try {
                    const pages = getCurrentPages();
                    if (!pages || pages.length === 0) return;

                    const currentPage = pages[pages.length - 1];
                    const tabBar = typeof currentPage.getTabBar === 'function' && currentPage.getTabBar();

                    if (tabBar && typeof tabBar._ensureCorrectState === 'function') {
                        tabBar._ensureCorrectState();
                    }

                    if (attempt === 1) {
                        this.globalData.isResuming = false;
                    }
                } catch (e) {
                    console.warn('[App] TabBar recovery error:', e);
                }
            }, delay);
            this._tabBarRecoveryTimers.push(timer);
        };

        // 多次尝试：50ms, 150ms, 300ms
        recoverTabBar(50, 1);
        recoverTabBar(150, 2);
        recoverTabBar(300, 3);
    },

    /**
     * 清除 TabBar 恢复定时器
     */
    _clearTabBarRecoveryTimers() {
        if (this._tabBarRecoveryTimers && this._tabBarRecoveryTimers.length > 0) {
            this._tabBarRecoveryTimers.forEach(timer => clearTimeout(timer));
            this._tabBarRecoveryTimers = [];
        }
    },

    // ==================== 游戏统计批量上报 ====================

    /**
     * 【优化】添加游戏统计到待上报队列
     * 各游戏页面调用此方法代替直接调用云函数
     * @param {string} gameType - 游戏类型
     */
    addGameStat(gameType) {
        if (!gameType) return;

        // 会话内去重
        const sessionKey = `_reported_${gameType}`;
        if (this.globalData[sessionKey]) {
            console.log('[GameStats] 跳过: 本次会话已记录', gameType);
            return;
        }
        this.globalData[sessionKey] = true;

        // 添加到待上报队列
        if (!this._pendingGameStats) {
            this._pendingGameStats = [];
        }
        this._pendingGameStats.push(gameType);
        console.log('[GameStats] 已加入队列:', gameType, '当前队列长度:', this._pendingGameStats.length);

        // 如果累积超过5个，立即上报
        if (this._pendingGameStats.length >= 5) {
            this._flushGameStats();
        }
    },

    /**
     * 【优化】批量上报游戏统计
     * 在 App 进入后台时调用
     */
    _flushGameStats() {
        if (!this._pendingGameStats || this._pendingGameStats.length === 0) {
            return;
        }

        const gameTypes = [...this._pendingGameStats];
        this._pendingGameStats = []; // 清空队列

        console.log('[GameStats] 批量上报:', gameTypes);

        wx.cloud.callFunction({
            name: 'gameStats',
            data: { action: 'batchRecord', gameTypes }
        }).then(res => {
            console.log('[GameStats] ✅ 批量上报成功:', res.result);
        }).catch(err => {
            console.error('[GameStats] ❌ 批量上报失败:', err);
            // 失败时将数据放回队列，下次重试
            if (!this._pendingGameStats) {
                this._pendingGameStats = [];
            }
            this._pendingGameStats.push(...gameTypes);
        });
    },

    globalData: {
        lastAppShowTime: 0,  // App 切前台的时间戳
        lastHideTime: null,  // App 进入后台的时间戳（用于检测后台时长）
        isResuming: false,   // 是否正在从后台恢复
        launchDataReady: false, // 【新增】启动数据是否已加载完成
        language: 'zh_CN',
        locale: 'zh-Hans',
        fontScale: 1,
        userInfo: null,
        isLoggedIn: false,
        isAdmin: false, // 是否为管理员（用于动态显示后台Tab）
        memberExpiry: null, // 会员有效期时间戳
        membershipExpired: false, // 标记会员是否已过期（需要续费）
        openId: null, // 【新增】预加载的 OpenID，供联机游戏使用

        // ============================================
        // 🔐 强制登录开关（默认值，会被后端配置覆盖）
        // 实际值从云函数 getSystemConfig 获取
        // 可在云开发后台的 SystemConfig 表中修改
        // 【重要】默认值为 false，避免配置未加载时错误弹窗
        // ============================================
        requireLogin: false,
        configLoaded: false,  // 配置是否已从云端加载

        // 全局资源缓存
        cachedAssets: {
            welcomeImage: null  // 欢迎图片的本地路径
        },

        // 【新增】待显示的更新通知
        pendingUpdateNotification: null,

        // 【新增】时空裂缝用户资料状态（预加载）
        viralProfile: null  // { hasProfile: boolean, avatarUrl: string, nickname: string }
    }
})
