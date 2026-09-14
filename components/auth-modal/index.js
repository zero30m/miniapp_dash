const { CloudFunctionManager, LOGIN_CACHE_TTL, callCloudFunction, MAX_RETRY_COUNT } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Component({
    properties: {
        show: {
            type: Boolean,
            value: true
        },
        welcomeImage: {
            type: String,
            value: ''
        }
    },
    data: {
        locale: 'zh-Hans',
        copy: i18n.getPageCopy('auth', 'zh-Hans'),
        step: 'login', // login, agreement, invite, welcome
        inviteCode: '',
        isNewUser: true,
        isRenewal: false, // 是否为续费模式
        isProcessing: false,
        keyboardVisible: false,
        inputFocused: false,
        keyboardOffset: 0
    },
    lifetimes: {
        attached() {
            this._syncI18n();
            this.loginManager = new CloudFunctionManager('login', {
                cacheTTL: LOGIN_CACHE_TTL
            });
            this.loadingVisible = false;

            const app = getApp();

            // 【修复】只有当强制登录开启时，才显示会员过期提示和跳转续费
            if (app.globalData.requireLogin && app.globalData.membershipExpired) {
                console.log('[AuthModal] Membership expired from cache, showing renewal');
                // 清除标志
                app.globalData.membershipExpired = false;
                // 直接跳转到续费流程
                wx.nextTick(() => {
                    wx.showToast({
                        title: this.data.copy.toastMembershipExpired,
                        icon: 'none',
                        duration: 2000
                    });
                    this.setData({
                        step: 'invite',
                        isRenewal: true
                    });
                });
            } else if (app.globalData.requireLogin) {
                wx.nextTick(() => {
                    console.log('Auth modal attached, starting warmup...');
                    this.loginManager.warmup();
                });
            } else {
                // 【修复】强制登录关闭时，清除可能残留的过期标志
                app.globalData.membershipExpired = false;
            }

            this._keyboardHandler = (res) => {
                this._handleKeyboardHeight(res.height);
            };
            wx.onKeyboardHeightChange(this._keyboardHandler);
        },
        detached() {
            if (this.loginManager) {
                this.loginManager.clear();
            }
            this.safeHideLoading();

            if (this._keyboardHandler) {
                wx.offKeyboardHeightChange(this._keyboardHandler);
            }
        }
    },
    pageLifetimes: {
        show() {
            this._syncI18n();
        }
    },
    methods: {
        _syncI18n() {
            const locale = i18n.getAppLocale();
            this.setData({
                locale,
                copy: i18n.getPageCopy('auth', locale)
            });
        },

        _showLocalizedToast(messageKey, fallback, extra = {}) {
            const title = this.data.copy[messageKey] || fallback || '';
            wx.showToast(Object.assign({ title, icon: 'none' }, extra));
        },

        _resolveServerMessage(result, fallbackKey) {
            const locale = this.data.locale;
            const copy = this.data.copy;
            const message = (result && (result.message || result.error)) || '';
            const code = String(result && result.code || '').toLowerCase();
            const codeMap = {
                invite_invalid: 'toastInviteInvalid',
                invalid_invite_code: 'toastInviteInvalid',
                invite_expired: 'toastInviteExpired',
                invite_used: 'toastInviteUsed',
                membership_expired: 'toastMembershipExpired'
            };

            const mappedKey = codeMap[code];
            if (mappedKey && copy[mappedKey]) {
                return copy[mappedKey];
            }

            if (message) {
                if (/过期|expired/i.test(message)) return copy.toastMembershipExpired;
                if (/邀请码.*(不存在|错误|无效)|invalid invite/i.test(message)) return copy.toastInviteInvalid;
                if (/邀请码.*(使用|用完)|invite.*used/i.test(message)) return copy.toastInviteUsed;
                if (/网络|connect|network/i.test(message)) return copy.toastNetworkFailed;
                if (/超时|timeout/i.test(message)) return copy.toastRetryConnect;
                if (i18n.isChineseLocale(locale)) {
                    return message;
                }
            }

            return copy[fallbackKey] || fallbackKey;
        },

        safeShowLoading(options) {
            try {
                wx.showLoading(options);
                this.loadingVisible = true;
            } catch (err) {
                this.loadingVisible = false;
                console.warn('showLoading failed:', err);
            }
        },

        safeHideLoading() {
            if (!this.loadingVisible) return;
            this.loadingVisible = false;
            try {
                wx.hideLoading();
            } catch (err) {
                console.warn('hideLoading failed:', err);
            }
        },

        // 点击微信登录按钮 -> 直接执行登录
        onLoginClick() {
            this.onLogin();
        },

        // 未注册用户确认协议 -> 直接注册为免费用户（无需邀请码）
        async onAgreeAndContinue() {
            if (this.data.isProcessing) return;

            this.setData({ isProcessing: true });
            this.safeShowLoading({ title: this.data.copy.loadingRegister, mask: true });

            try {
                const res = await callCloudFunction('registerFree', {}, {
                    maxRetries: MAX_RETRY_COUNT
                });

                this.safeHideLoading();
                const result = res?.result;

                if (result?.success) {
                    // 注册成功，保存登录缓存并更新全局状态
                    const app = getApp();
                    app.saveLoginCache({
                        userInfo: null,
                        isAdmin: app.globalData.isAdmin || false,
                        memberExpiry: result.memberExpiry || null
                    });
                    app.globalData.memberExpiry = result.memberExpiry;
                    app.globalData.isLoggedIn = true;
                    app.globalData.membershipExpired = false;

                    // 跳转到欢迎页
                    this.setData({ step: 'welcome' });
                    setTimeout(() => {
                        this.triggerEvent('loginSuccess', {
                            admin: app.globalData.isAdmin,
                            memberExpiry: result.memberExpiry
                        });
                    }, 2000);
                } else {
                    wx.showToast({
                        title: this._resolveServerMessage(result, 'toastRegisterFailed'),
                        icon: 'none'
                    });
                }
            } catch (err) {
                this.safeHideLoading();
                const message = this._resolveServerMessage({ message: err?.message }, 'toastNetworkError');
                wx.showToast({ title: message, icon: 'none' });
                console.error('[AuthModal] registerFree failed:', err);
            } finally {
                this.setData({ isProcessing: false });
            }
        },

        // 未注册用户取消协议 -> 注销登录状态，返回登录页
        onCancelAgreement() {
            // 清除可能的登录状态
            const app = getApp();
            app.globalData.isLoggedIn = false;

            // 清除本地存储的用户信息
            try {
                wx.removeStorageSync('userInfo');
                wx.removeStorageSync('loginTime');
            } catch (e) {
                console.warn('Clear storage failed:', e);
            }

            this._showLocalizedToast('toastCancelled');
            this.setData({ step: 'login' });
        },

        handleLoginResult(result) {
            if (!result) {
                this._showLocalizedToast('toastRetryConnect');
                console.error('Login error: no result');
                this.loginManager.clear();
                return false;
            }

            // 【调试输出】打印登录结果，包含用户信息
            console.log('========== 登录结果调试信息 ==========');
            console.log('登录成功:', result.success);
            console.log('是否已注册:', result.isRegistered);
            console.log('是否过期:', result.isExpired);
            console.log('是否管理员:', result.admin);
            if (result.userInfo) {
                console.log('用户信息:', result.userInfo);
                console.log('OpenID:', result.userInfo.OpenID);
                console.log('UnionID:', result.userInfo.UnionID);
            }
            console.log('=======================================');

            if (!result.success) {
                const errorMsg = result.error || '';
                const displayMsg = errorMsg.includes('retry connect')
                    ? this.data.copy.toastNetworkFailed
                    : this._resolveServerMessage(result, 'toastLoginFailed');
                wx.showToast({ title: displayMsg, icon: 'none' });
                console.error('Login error:', errorMsg);
                this.loginManager.clear();
                return false;
            }

            // 存储管理员状态到 globalData
            const app = getApp();
            if (result.admin === true) {
                app.globalData.isAdmin = true;
                console.log('[AuthModal] User is admin');

                // 【优化】预加载后台管理数据，加快第一次进入后台页面的速度
                this._preloadAdminData();
            }

            if (result.isRegistered) {
                // 已注册用户
                // 【修复】只有当强制登录开启时，才检查会员是否过期并跳转续费
                if (app.globalData.requireLogin && result.isExpired) {
                    // 会员已过期，需要续费
                    console.log('[AuthModal] Membership expired, redirecting to renewal');
                    wx.showToast({
                        title: this.data.copy.toastMembershipExpired,
                        icon: 'none',
                        duration: 2000
                    });
                    // 标记为续费模式
                    this.setData({
                        step: 'invite',
                        isRenewal: true
                    });
                } else {
                    // 【修复】强制登录关闭时，即使会员过期也直接登录成功
                    // 会员有效，或强制登录关闭时，保存登录缓存并触发成功事件
                    app.saveLoginCache({
                        userInfo: result.userInfo || null,
                        isAdmin: result.admin || false,
                        memberExpiry: result.memberExpiry || null
                    });
                    app.globalData.memberExpiry = result.memberExpiry;
                    this.triggerEvent('loginSuccess', {
                        admin: result.admin,
                        memberExpiry: result.memberExpiry
                    });
                }
            } else {
                // 未注册用户，先显示协议确认页面
                this.setData({ step: 'agreement' });
            }
            return true;
        },

        async onLogin() {
            if (this.data.isProcessing) return;

            this.setData({ isProcessing: true });
            this.safeShowLoading({ title: this.data.copy.loadingLogin, mask: true });

            console.log('User clicked login');

            try {
                const result = await this.loginManager.call({}, {
                    force: true,
                    useCache: false,
                    maxRetries: 1,
                    timeout: 12000
                });

                this.safeHideLoading();

                if (!result) {
                    this._showLocalizedToast('toastRetryLogin');
                    this.loginManager.clear();
                    return;
                }

                const success = this.handleLoginResult(result);
                if (success) {
                    this.loginManager.clear();
                }
            } catch (err) {
                this.safeHideLoading();

                let message = this.data.copy.toastNetworkError;
                if (err?.message) {
                    if (err.message.includes('超时') || err.message.includes('timeout')) {
                        message = this.data.copy.toastRetryConnect;
                    } else if (err.message.includes('connect') || err.message.includes('network')) {
                        message = this.data.copy.toastNetworkFailed;
                    }
                }

                wx.showToast({ title: message, icon: 'none', duration: 2000 });
                console.error('Login call failed:', err);
                this.loginManager.clear();
            } finally {
                this.setData({ isProcessing: false });
            }
        },

        onInputInvite(e) {
            const value = e.detail.value.replace(/\D/g, '').slice(0, 6);
            this.setData({ inviteCode: value });
        },

        focusInput() {
            this.setData({ inputFocused: true });
        },

        onInputFocus() {
            this.setData({
                keyboardVisible: true,
                inputFocused: true
            });
        },

        onInputBlur() {
            this.setData({
                keyboardVisible: false,
                inputFocused: false,
                keyboardOffset: 0
            });
        },

        _handleKeyboardHeight(keyboardHeight) {
            if (keyboardHeight === 0) {
                this.setData({
                    keyboardVisible: false,
                    keyboardOffset: 0
                });
                return;
            }

            try {
                const windowInfo = wx.getWindowInfo();
                const screenHeight = windowInfo.windowHeight;

                const cardHeight = 350;
                const safeMargin = 20;
                const cardBottom = (screenHeight + cardHeight) / 2;
                const keyboardTop = screenHeight - keyboardHeight;
                let offset = cardBottom - keyboardTop + safeMargin;
                const maxOffset = (screenHeight - cardHeight) / 2 - 100;
                offset = Math.min(offset, maxOffset);
                offset = Math.max(0, offset);

                this.setData({
                    keyboardVisible: true,
                    keyboardOffset: offset
                });
            } catch (e) {
                this.setData({
                    keyboardVisible: true,
                    keyboardOffset: keyboardHeight * 0.4
                });
            }
        },

        async onVerifyInvite() {
            if (this.data.isProcessing) return;

            const code = this.data.inviteCode;
            if (!code || (code.length !== 4 && code.length !== 6)) {
                this._showLocalizedToast('toastInviteCodeRequired');
                return;
            }

            this.setData({ isProcessing: true });
            this.safeShowLoading({ title: this.data.copy.loadingVerify, mask: true });

            try {
                const res = await callCloudFunction('register', { inviteCode: code }, {
                    maxRetries: MAX_RETRY_COUNT
                });

                this.safeHideLoading();
                const result = res?.result;

                if (result?.success) {
                    // 注册/续费成功后保存登录缓存并更新全局状态
                    const app = getApp();
                    app.saveLoginCache({
                        userInfo: null,
                        isAdmin: app.globalData.isAdmin || false,
                        memberExpiry: result.memberExpiry || null
                    });
                    // 【修复】确保更新所有相关的全局状态
                    app.globalData.memberExpiry = result.memberExpiry;
                    app.globalData.isLoggedIn = true;
                    app.globalData.membershipExpired = false;

                    this.setData({ step: 'welcome' });
                    setTimeout(() => {
                        this.triggerEvent('loginSuccess', {
                            admin: app.globalData.isAdmin,
                            memberExpiry: result.memberExpiry
                        });
                    }, 2000);
                } else {
                    wx.showToast({
                        title: this._resolveServerMessage(result, 'toastVerifyFailed'),
                        icon: 'none'
                    });
                }
            } catch (err) {
                this.safeHideLoading();
                const message = this._resolveServerMessage({ message: err?.message }, 'toastNetworkError');
                wx.showToast({ title: message, icon: 'none' });
                console.error('Register call failed:', err);
            } finally {
                this.setData({ isProcessing: false });
                this.loginManager.warmup();
            }
        },

        onCancel() {
            this._showLocalizedToast('toastLoginRequired');
        },

        /**
         * 【优化】预加载后台管理数据
         * 当识别到用户为管理员时调用，提前加载数据到内存
         */
        _preloadAdminData() {
            const app = getApp();

            // 延迟执行，不影响当前登录流程
            setTimeout(() => {
                console.log('[AuthModal] Preloading admin data...');

                // 预加载邀请码列表
                wx.cloud.callFunction({
                    name: 'adminGetInviteCodes',
                    data: { pageNumber: 1, pageSize: 10, filter: 'all' },
                    success: (res) => {
                        if (res?.result?.success) {
                            // 缓存到 globalData
                            app.globalData._cachedAdminCodes = res.result.data;
                            console.log('[AuthModal] Admin codes preloaded');
                        }
                    },
                    fail: () => { } // 静默失败
                });

                // 预加载会员列表
                wx.cloud.callFunction({
                    name: 'adminGetMembers',
                    data: { pageNumber: 1, pageSize: 20, filter: 'all' },
                    success: (res) => {
                        if (res?.result?.success) {
                            app.globalData._cachedAdminMembers = res.result.data;
                            console.log('[AuthModal] Admin members preloaded');
                        }
                    },
                    fail: () => { }
                });
            }, 500);
        }
    }
});
