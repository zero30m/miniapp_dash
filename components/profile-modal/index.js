/**
 * 头像昵称填写弹窗组件
 * 使用微信官方的 chooseAvatar 和 nickname input 方式
 * 
 * 优化：支持预填充已有资料
 */
const i18n = require('../../utils/i18n');

// 使用微信官方默认头像
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

Component({
    properties: {
        // 是否显示弹窗
        visible: {
            type: Boolean,
            value: false
        },
        // 弹窗标题
        title: {
            type: String,
            value: '完善个人信息'
        },
        // 弹窗描述
        description: {
            type: String,
            value: '设置头像和昵称，让好友认识你'
        },
        // 确认按钮文字
        confirmText: {
            type: String,
            value: '确认'
        },
        // 底部提示文案
        footerHint: {
            type: String,
            value: ''
        },
        // 【新增】预填充的头像 URL
        prefillAvatarUrl: {
            type: String,
            value: ''
        },
        // 【新增】预填充的昵称
        prefillNickname: {
            type: String,
            value: ''
        }
    },

    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('profileModal', 'zh-Hans'),
        avatarUrl: defaultAvatarUrl,
        nickname: '',
        isSubmitting: false,
        // 是否已预填充
        _prefilled: false
    },

    lifetimes: {
        attached() {
            this._syncI18n();
        }
    },

    pageLifetimes: {
        show() {
            this._syncI18n();
        }
    },
    
    observers: {
        // 当 visible 变为 true 且有预填充数据时，自动填充
        'visible, prefillAvatarUrl, prefillNickname': function(visible, prefillAvatarUrl, prefillNickname) {
            if (visible && !this.data._prefilled) {
                if (prefillAvatarUrl || prefillNickname) {
                    console.log('【ProfileModal】自动填充已有资料');
                    this.setData({
                        avatarUrl: prefillAvatarUrl || defaultAvatarUrl,
                        nickname: prefillNickname || '',
                        _prefilled: true
                    });
                }
            }
        }
    },

    methods: {
        _syncI18n() {
            const locale = i18n.getAppLocale();
            this.setData({
                locale: locale,
                uiCopy: i18n.getPageCopy('profileModal', locale)
            });
        },

        // 选择头像
        onChooseAvatar(e) {
            const { avatarUrl } = e.detail;
            console.log('【ProfileModal】头像选择:', avatarUrl);
            this.setData({ avatarUrl });
        },

        // 昵称输入
        onNicknameInput(e) {
            this.setData({ nickname: e.detail.value });
        },

        // 昵称输入完成（通过表单提交获取）
        onNicknameBlur(e) {
            const value = e.detail.value || '';
            this.setData({ nickname: value.trim() });
        },

        // 表单提交（用于获取昵称）
        onFormSubmit(e) {
            const nickname = e.detail.value.nickname || this.data.nickname;
            this.setData({ nickname: nickname.trim() });
            this.doSubmit();
        },

        // 确认提交
        onConfirm() {
            this.doSubmit();
        },

        // 执行提交
        async doSubmit() {
            const { avatarUrl, nickname, isSubmitting } = this.data;

            if (isSubmitting) return;

            // 验证
            if (avatarUrl === defaultAvatarUrl) {
                wx.showToast({ title: this.data.uiCopy.toastChooseAvatar || '请选择头像', icon: 'none' });
                return;
            }

            if (!nickname || nickname.trim().length === 0) {
                wx.showToast({ title: this.data.uiCopy.toastEnterNickname || '请输入昵称', icon: 'none' });
                return;
            }

            this.setData({ isSubmitting: true });

            try {
                let cloudAvatarUrl = avatarUrl;
                
                // 【优化】如果头像已经是云存储链接，不重新上传
                if (avatarUrl.startsWith('cloud://')) {
                    console.log('【ProfileModal】头像已是云存储链接，无需重新上传');
                } else {
                    // 上传头像到云存储
                    const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
                    
                    console.log('【ProfileModal】上传头像到云存储...');
                    const uploadRes = await wx.cloud.uploadFile({
                        cloudPath: cloudPath,
                        filePath: avatarUrl
                    });

                    cloudAvatarUrl = uploadRes.fileID;
                    console.log('【ProfileModal】头像上传成功:', cloudAvatarUrl);
                }

                // 触发提交事件
                this.triggerEvent('confirm', {
                    avatarUrl: cloudAvatarUrl,
                    nickname: nickname.trim()
                });

            } catch (err) {
                console.error('【ProfileModal】提交失败:', err);
                wx.showToast({ title: this.data.uiCopy.toastSubmitFailed || '提交失败，请重试', icon: 'none' });
                this.setData({ isSubmitting: false });
            }
        },

        // 关闭弹窗
        onClose() {
            this.triggerEvent('close');
        },

        // 阻止事件冒泡
        preventBubble() {
            // 空函数，仅用于阻止冒泡
        },

        // 重置状态（供外部调用）
        reset() {
            this.setData({
                avatarUrl: defaultAvatarUrl,
                nickname: '',
                isSubmitting: false,
                _prefilled: false
            });
        },

        // 外部云端保存失败时，仅解除提交锁，保留用户刚刚填写的资料
        finishSubmitting() {
            this.setData({ isSubmitting: false });
        }
    }
});
