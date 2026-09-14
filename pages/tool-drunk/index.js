/**
 * 喝醉了吗 - 手抖检测小游戏
 * 使用加速度计检测3秒内手机的抖动幅度
 * 
 */
const i18n = require('../../utils/i18n');

// 阈值配置（可调整敏感度）
const CONFIG = {
    TEST_DURATION: 3,        // 测试时长（秒）
    SAMPLE_INTERVAL: 50,     // 采样间隔（毫秒）
    SHAKE_THRESHOLD: 20,     // 抖动阈值（百分比），超过则判定为"醉了"，值越小越敏感
    MAX_SHAKE_DISPLAY: 100,  // 显示的最大抖动值
    // 加速度灵敏度：值越小越敏感
    SENSITIVITY: 0.08        // 降低到0.08，更容易检测到细微抖动
};

// 结果文案配置
const RESULTS = {
    sober: {
        emoji: '😎',
        title: '稳如泰山',
        descs: [
            '手稳得很，再来一杯？',
            '完全没问题，继续干！',
            '老司机稳得一批'
        ]
    },
    tipsy: {
        emoji: '🥴',
        title: '微微有点晃',
        descs: [
            '有点上头了，悠着点～',
            '控制一下节奏吧',
            '差不多得了'
        ]
    },
    drunk: {
        emoji: '🍺',
        title: '快别喝了！',
        descs: [
            '手都抖成这样了，喝水吧',
            '你这手，筛子都比你稳',
            '再喝就要载歌载舞了'
        ]
    }
};

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('drunk', 'zh-Hans'),
        gameState: 'IDLE',  // IDLE, TESTING, RESULT
        testCountdown: 3,
        shakePercent: 0,      // 当前抖动百分比（0-100）
        thresholdPercent: CONFIG.SHAKE_THRESHOLD,  // 阈值位置

        // 结果数据
        resultType: 'sober',  // sober, tipsy, drunk
        resultEmoji: '',
        resultTitle: '',
        resultDesc: '',
        finalShakePercent: 0,

        // 导航布局
        navTop: 60,
        menuRight: 95,
        menuDotRight: 117,

    },

    // 内部状态
    _accelerometerData: [],
    _lastAccel: null,
    _testTimer: null,
    _countdownTimer: null,
    _isListening: false,
    _boundAccelerometerHandler: null,

    onLoad() {
        this._syncI18n();
        // 【Fix】Ensure clean state on load
        this.setData({
            gameState: 'IDLE',

            shakePercent: 0,
            finalShakePercent: 0,
            myShakeValue: 0,

        });

        this._calculateNavLayout();
        this._reportGamePlay();

    },

    onShow() {
        this._syncI18n();
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar && !tabBar.data.hidden) {
            tabBar.setData({ hidden: true });
        }

        // 【修复 BUG1】检测测试中途切出的情况：gameState 是 TESTING 但计时器已停止
        if (this.data.gameState === 'TESTING' && !this._countdownTimer) {
            console.log('[Drunk] Detected interrupted test, resetting to IDLE');
            this._stopAccelerometer();
            this.setData({
                gameState: 'IDLE',
                testCountdown: CONFIG.TEST_DURATION,
                shakePercent: 0
            });
            wx.showToast({ title: this.data.uiCopy.interrupted || '测试已中断，请重新开始', icon: 'none' });
        }

    },

    onHide() {
        this._stopAccelerometer();
        this._clearTimers();
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({ hidden: false, blurred: false });
        }
    },

    onUnload() {
        this._stopAccelerometer();
        this._clearTimers();
    },

    goBack() {
        // 【修复】防止重复点击
        if (this._isGoingBack) return;
        this._isGoingBack = true;

        // 【修复】检查页面栈，如果没有上一页则跳转首页
        const pages = getCurrentPages();
        if (pages.length > 1) {
            wx.navigateBack({
                delta: 1,
                fail: () => {
                    // 如果返回失败，跳转首页
                    wx.switchTab({ url: '/pages/home/index' });
                },
                complete: () => {
                    this._isGoingBack = false;
                }
            });
        } else {
            // 没有上一页（从分享进入），直接跳转首页
            wx.switchTab({
                url: '/pages/home/index',
                complete: () => {
                    this._isGoingBack = false;
                }
            });
        }
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({
            locale: locale,
            uiCopy: i18n.getPageCopy('drunk', locale)
        });
        i18n.setNavigationBarTitle('drunk.navTitle', locale);
    },

    // ==================== 导航布局 ====================

    _calculateNavLayout() {
        try {
            const menuBtn = wx.getMenuButtonBoundingClientRect();
            const systemInfo = wx.getSystemInfoSync();
            if (menuBtn && menuBtn.top > 0) {
                const menuRight = systemInfo.windowWidth - menuBtn.right;
                const dotCenterOffset = menuBtn.width * 0.75;
                const menuDotRight = menuRight + dotCenterOffset;

                this.setData({
                    navTop: menuBtn.top,
                    menuRight: menuRight,
                    menuDotRight: menuDotRight
                });
            }
        } catch (e) {
            console.warn('[NavLayout] Failed to get menu button rect:', e);
        }
    },

    // ==================== 游戏流程 ====================

    onStartTest() {
        if (this.data.gameState !== 'IDLE') return;

        // 【修复】防止重复点击
        if (this._isStartingTest) return;
        this._isStartingTest = true;

        wx.vibrateShort({ type: 'medium' });

        this._accelerometerData = [];
        this._lastAccel = null;

        this.setData({
            gameState: 'TESTING',
            testCountdown: CONFIG.TEST_DURATION,
            shakePercent: 0
        });

        this._startAccelerometer();

        this._countdownTimer = setInterval(() => {
            const newCount = this.data.testCountdown - 1;
            if (newCount <= 0) {
                this._finishTest();
            } else {
                this.setData({ testCountdown: newCount });
            }
        }, 1000);

        // 【修复】延迟解锁
        setTimeout(() => {
            this._isStartingTest = false;
        }, 500);
    },

    _finishTest() {
        this._stopAccelerometer();
        this._clearTimers();
        this._isStartingTest = false;  // 【修复】确保解锁

        const avgShake = this._calculateAverageShake();

        const tipsyThreshold = CONFIG.SHAKE_THRESHOLD * 0.6;
        const drunkThreshold = CONFIG.SHAKE_THRESHOLD;

        let resultType = 'sober';
        if (avgShake >= drunkThreshold) {
            resultType = 'drunk';
        } else if (avgShake >= tipsyThreshold) {
            resultType = 'tipsy';
        }

        const resultPack = this.data.uiCopy.results || RESULTS;
        const result = resultPack[resultType] || RESULTS[resultType];
        const randomDesc = result.descs[Math.floor(Math.random() * result.descs.length)];
        const vibrateType = resultType === 'drunk' ? 'heavy' : (resultType === 'tipsy' ? 'medium' : 'light');
        wx.vibrateShort({ type: vibrateType });

        const mappedPercent = this._mapShakeToMeterPercent(avgShake, tipsyThreshold, drunkThreshold);

        this.setData({
            gameState: 'RESULT',
            myShakeValue: avgShake,
            myShakeValueDisplay: avgShake.toFixed(1),
            resultType: resultType,
            resultEmoji: result.emoji,
            resultTitle: result.title,
            resultDesc: randomDesc,
            finalShakePercent: 0 // Start at 0 for animation
        });

        // Trigger animation
        setTimeout(() => {
            this.setData({ finalShakePercent: mappedPercent });
        }, 100);
    },

    _mapShakeToMeterPercent(shake, tipsyThreshold, drunkThreshold) {
        if (shake <= 0) return 0;

        if (shake < tipsyThreshold) {
            return (shake / tipsyThreshold) * 33;
        } else if (shake < drunkThreshold) {
            const rangeProgress = (shake - tipsyThreshold) / (drunkThreshold - tipsyThreshold);
            return 33 + rangeProgress * 33;
        } else {
            const maxDrunk = 100;
            const rangeProgress = Math.min((shake - drunkThreshold) / (maxDrunk - drunkThreshold), 1);
            return 66 + rangeProgress * 34;
        }
    },

    onPageTap() {
        // 点击结果页重新开始
        if (this.data.gameState === 'RESULT') {
            this.setData({
                gameState: 'IDLE',
                shakePercent: 0,
                finalShakePercent: 0
            });
        }
    },

    // ==================== 加速度计相关 ====================

    _startAccelerometer() {
        if (this._isListening) return;

        if (!this._boundAccelerometerHandler) {
            this._boundAccelerometerHandler = this._onAccelerometerChange.bind(this);
        }

        wx.startAccelerometer({
            interval: 'game',
            success: () => {
                this._isListening = true;
                wx.onAccelerometerChange(this._boundAccelerometerHandler);
            },
            fail: (err) => {
                console.error('[Drunk] Failed to start accelerometer:', err);

                wx.showToast({ title: this.data.uiCopy.sensorFailed || '传感器启动失败', icon: 'none' });
                this.setData({ gameState: 'IDLE' });
            }
        });
    },

    _stopAccelerometer() {
        if (!this._isListening) return;

        if (this._boundAccelerometerHandler) {
            wx.offAccelerometerChange(this._boundAccelerometerHandler);
        }

        wx.stopAccelerometer({
            success: () => { this._isListening = false; },
            fail: () => { this._isListening = false; }
        });
    },

    _onAccelerometerChange(res) {
        if (this.data.gameState !== 'TESTING') return;

        const { x, y, z } = res;

        if (this._lastAccel) {
            const dx = x - this._lastAccel.x;
            const dy = y - this._lastAccel.y;
            const dz = z - this._lastAccel.z;
            const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const shakeValue = delta / CONFIG.SENSITIVITY * 100;
            this._accelerometerData.push(shakeValue);

            const currentPercent = Math.min(shakeValue, CONFIG.MAX_SHAKE_DISPLAY);
            const smoothPercent = this.data.shakePercent * 0.7 + currentPercent * 0.3;

            this.setData({
                shakePercent: Math.round(smoothPercent)
            });

        }

        this._lastAccel = { x, y, z };
    },

    _calculateAverageShake() {
        if (this._accelerometerData.length === 0) return 0;

        const sorted = [...this._accelerometerData].sort((a, b) => a - b);
        const trimCount = Math.floor(sorted.length * 0.1);
        const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

        if (trimmed.length === 0) return 0;

        const sum = trimmed.reduce((acc, val) => acc + val, 0);
        return sum / trimmed.length;
    },

    _clearTimers() {
        if (this._countdownTimer) {
            clearInterval(this._countdownTimer);
            this._countdownTimer = null;
        }
        if (this._testTimer) {
            clearTimeout(this._testTimer);
            this._testTimer = null;
        }
    },

    _reportGamePlay() {
        const app = getApp();
        app.addGameStat('drunk');
    },

    // ==================== 分享功能 ====================

    // 抽象嘴臭分享文案库
    _shareTitles: [
        '来测测谁的手最抖，输了请奶茶',
        '我手稳得很，不信你来比',
        '测测酒量？不如测测手抖',
        '据说手抖的人都是心虚',
        '来啊，比比谁的手更稳',
        '我已经准备好看你手抖了',
        '输了请吃肯德基疯四',
        '测完这个再喝，不然你说了不算',
        '你的手稳不稳，测过才知道',
        '不是，你手抖成这样还喝？',
        '快来测测，看谁最该喝水',
        '我赌你手比我抖',
        '来吧，展示你的稳定性',
        '据说手稳的人都长得好看',
        '你敢测吗？反正我不敢',
        '测完就知道谁该喝酒了',
        '手抖星人请自觉喝酒',
        '你的手是开玩笑的吗',
        '不测不知道，一测吓一跳',
        '来测测谁是抖音创始人'
    ],

    _getRandomShareTitle() {
        const shareTitles = this.data.uiCopy.shareTitles && this.data.uiCopy.shareTitles.length ? this.data.uiCopy.shareTitles : this._shareTitles;
        const index = Math.floor(Math.random() * shareTitles.length);
        return shareTitles[index];
    },

    onShareAppMessage() {
        return {
            title: this._getRandomShareTitle(),
            path: '/pages/tool-drunk/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.shareTimelineTitle || '喝醉了吗 | 抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    }
});
