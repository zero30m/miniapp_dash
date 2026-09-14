/**
 * diy-slider — 有限范围滚动线条滑块
 *
 * - 两层 repeating-linear-gradient 实现滚动视觉
 * - 值到达 max/min 后停止，不再循环
 * - 拖拽时背景偏移量也会在边界停止
 * - 每变化一个 step 触发一次轻震动
 */

var SCROLL_RANGE_PX = 200;

Component({
    properties: {
        label: { type: String, value: '' },
        min: { type: Number, value: 0 },
        max: { type: Number, value: 100 },
        value: { type: Number, value: 50 },
        step: { type: Number, value: 1 },
        iconLeft: { type: String, value: '' },
        iconRight: { type: String, value: '' },
        displayValue: { type: String, value: '' }
    },

    data: {
        bgOffset: 0
    },

    observers: {
        'value, min, max': function (val, min, max) {
            // 触摸进行中时由 onTouchMove 直接驱动 bgOffset，不在此更新
            if (this._isTouching) return;
            var range = max - min;
            if (range <= 0) range = 1;
            var percent = Math.max(0, Math.min(1, (val - min) / range));
            this.setData({ bgOffset: -(percent * SCROLL_RANGE_PX) });
        }
    },

    lifetimes: {
        attached: function () {
            this._cacheTrackRect();
        },
        ready: function () {
            var self = this;
            setTimeout(function () {
                self._cacheTrackRect();
            }, 300);
        }
    },

    pageLifetimes: {
        show: function () {
            this._cacheTrackRect();
        }
    },

    methods: {
        _cacheTrackRect: function () {
            var self = this;
            this.createSelectorQuery()
                .select('.slider-scroll-area')
                .boundingClientRect(function (rect) {
                    if (rect && rect.width > 0) {
                        self._trackWidth = rect.width;
                    }
                })
                .exec();
        },

        /**
         * 将原始值按步进取整后截断到 [min, max] 区间（不循环）
         */
        _clampValue: function (raw) {
            var min = this.properties.min;
            var max = this.properties.max;
            var step = this.properties.step || 1;

            var stepped = Math.round(raw / step) * step;
            // 截断到 [min, max] 范围
            return Math.max(min, Math.min(max, stepped));
        },

        onTouchStart: function (e) {
            if (!e.touches || !e.touches.length) return;
            this._isTouching = true;
            this._startX = e.touches[0].pageX;
            this._startValue = this.properties.value;
            this._startBgOffset = this.data.bgOffset;
            this._lastEmittedValue = this.properties.value;
            this._cacheTrackRect();
        },

        onTouchMove: function (e) {
            if (!e.touches || !e.touches.length) return;
            if (this._startX === undefined) return;

            var dx = e.touches[0].pageX - this._startX;
            var trackWidth = this._trackWidth || 200;
            var range = this.properties.max - this.properties.min;
            if (range <= 0) return;

            // ---- 视觉：偏移量也需要截断在有效范围内 ----
            var scrollFraction = dx / trackWidth;
            var rawBgOffset = this._startBgOffset + scrollFraction * SCROLL_RANGE_PX;
            // bgOffset 范围：0 (0%) 到 -SCROLL_RANGE_PX (100%)
            var bgOffset = Math.max(-SCROLL_RANGE_PX, Math.min(0, rawBgOffset));

            // ---- 值：截断到 [min, max] ----
            var valueDelta = -scrollFraction * range;
            var rawValue = this._startValue + valueDelta;
            var newValue = this._clampValue(rawValue);

            // 更新视觉偏移
            this.setData({ bgOffset: bgOffset });

            // 值发生变化 → 触发事件 + 震动
            if (newValue !== this._lastEmittedValue) {
                this._lastEmittedValue = newValue;
                // 轻震动反馈（每个 step 一次）
                wx.vibrateShort({ type: 'light' });
                this.triggerEvent('change', { value: newValue });
            }
        },

        onTouchEnd: function () {
            this._isTouching = false;
            this._startX = undefined;
            this._startValue = undefined;
            this._lastEmittedValue = undefined;
        }
    }
});
