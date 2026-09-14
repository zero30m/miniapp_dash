var i18n = require('../../utils/i18n');

Component({
    properties: {
        fabTop: { type: Number, value: 100 },
        players: { type: Number, value: 4 },
        alcohol: { type: Number, value: 50 },
        stimulation: { type: Number, value: 50 },
        depth: { type: Number, value: 50 },
        ambiguity: { type: Number, value: 50 }
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

        onToggle: function () {
            var expanded = !this.data.expanded;
            this.setData({ expanded: expanded });
            this.triggerEvent('panelchange', { expanded: expanded });
        },

        onOverlayTap: function () {
            this.setData({ expanded: false });
            this.triggerEvent('panelchange', { expanded: false });
        },

        onPanelTap: function () {},

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
