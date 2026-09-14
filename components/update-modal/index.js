/**
 * 更新通知弹窗组件
 * 用于在小程序版本更新后向用户展示更新内容
 */
const i18n = require('../../utils/i18n');

Component({
    properties: {
        show: {
            type: Boolean,
            value: false
        },
        versionInfo: {
            type: Object,
            value: {
                version: '',
                title: '',
                content: ''
            }
        }
    },

    data: {
        locale: 'zh-Hans',
        confirmText: i18n.t('common.confirm', 'zh-Hans'),
        contentLines: []
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
        'versionInfo.content': function (content) {
            if (content) {
                this.parseContent(content);
            }
        }
    },

    methods: {
        _syncI18n() {
            const locale = i18n.getAppLocale();
            this.setData({
                locale,
                confirmText: i18n.t('common.confirm', locale)
            });
        },

        /**
         * 解析更新内容（支持简单的Markdown格式）
         * - ### 标题 -> header类型
         * - - 列表项 -> item类型，带●符号
         * - 普通文本 -> item类型
         */
        parseContent(content) {
            if (!content) {
                this.setData({ contentLines: [] });
                return;
            }

            const lines = content.split('\n').filter(line => line.trim());
            const parsed = lines.map(line => {
                const trimmed = line.trim();

                // ### 标题
                if (trimmed.startsWith('###')) {
                    return {
                        type: 'header',
                        text: trimmed.replace(/^###\s*/, ''),
                        bullet: ''
                    };
                }

                // - 列表项
                if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                    return {
                        type: 'item',
                        text: trimmed.replace(/^[-•]\s*/, ''),
                        bullet: '●'
                    };
                }

                // 普通文本
                return {
                    type: 'item',
                    text: trimmed,
                    bullet: ''
                };
            });

            this.setData({ contentLines: parsed });
        },

        /**
         * 用户点击"知道了！"按钮
         */
        onConfirm() {
            wx.vibrateShort({ type: 'light' });
            this.triggerEvent('confirm');
        },

        /**
         * 阻止事件冒泡
         */
        preventBubble() {
            // 阻止点击遮罩层关闭弹窗
        }
    }
});
