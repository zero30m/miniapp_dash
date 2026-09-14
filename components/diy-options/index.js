var i18n = require('../../utils/i18n');

Component({
    properties: {
        // 初始参数值（由页面传入）
        players: { type: Number, value: 4 },
        alcohol: { type: Number, value: 50 },
        stimulation: { type: Number, value: 50 },
        depth: { type: Number, value: 50 },
        ambiguity: { type: Number, value: 50 }  // 暧昧程度
    },

    data: {
        expanded: false,
        locale: 'zh-Hans',
        copy: i18n.getPageCopy('diy')
    },

    lifetimes: {
        attached: function () {
            this._syncI18n();
        }
    },

    pageLifetimes: {
        show: function () {
            this._syncI18n();
        }
    },

    methods: {
        _syncI18n: function () {
            var locale = i18n.getAppLocale();
            this.setData({
                locale: locale,
                copy: i18n.getPageCopy('diy', locale)
            });
        },

        /**
         * 切换展开/折叠
         */
        onToggle: function () {
            this.setData({ expanded: !this.data.expanded });
        },

        /**
         * 点击遮罩关闭
         */
        onOverlayTap: function () {
            this.setData({ expanded: false });
        },

        /**
         * 阻止面板内部点击事件冒泡到遮罩
         */
        onPanelTap: function () {
            // do nothing - prevent bubble
        },

        /**
         * 通知父页面参数变化
         */
        _emitChange: function (key, value) {
            this.triggerEvent('paramsChange', {
                key: key,
                value: value,
                params: {
                    players: this.properties.players,
                    alcohol: this.properties.alcohol,
                    stimulation: this.properties.stimulation,
                    depth: this.properties.depth,
                    ambiguity: this.properties.ambiguity,
                    [key]: value
                }
            });
        },

        // ============ 各滑块变化事件 ============

        onPlayersChange: function (e) {
            this._emitChange('players', e.detail.value);
        },

        onAlcoholChange: function (e) {
            this._emitChange('alcohol', e.detail.value);
        },

        onStimulationChange: function (e) {
            this._emitChange('stimulation', e.detail.value);
        },

        onDepthChange: function (e) {
            this._emitChange('depth', e.detail.value);
        },

        onAmbiguityChange: function (e) {
            this._emitChange('ambiguity', e.detail.value);
        }
    }
});
