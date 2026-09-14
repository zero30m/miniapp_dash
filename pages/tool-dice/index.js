const app = getApp();
const i18n = require('../../utils/i18n');

const SHAKE_FORCE_THRESHOLD = 3.8;
const SHAKE_DELTA_THRESHOLD = 1.25;
const SHAKE_COOLDOWN_MS = 1400;

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('dice', 'zh-Hans'),
        diceCount: 5,
        diceValues: [1, 2, 3, 4, 5], // Initial values
        totalScore: 15, // Initial score
        displayScore: '?', // 显示的分数（盖子关闭时显示问号）
        isRolling: false,
        hintText: i18n.getPageCopy('dice', 'zh-Hans').hint,

        // 毛玻璃盖子状态
        showCover: false,        // 是否显示盖子
        coverAnimating: false,   // 是否正在播放出现动画
        coverRevealing: false,   // 盖子是否正在被揭开
        hasRolledOnce: false,    // 是否已经掷过一次骰子
        coverSwipeProgress: 0,   // 滑动进度 (0-1)
        coverOffsetY: 0,         // 盖子向上偏移的像素值
        coverOpacity: 1,         // 盖子透明度

        // 自适应布局
        layout: {
            coverHeight: 400,    // 盖子高度
            coverWidth: 520,     // 盖子宽度
            swipeThreshold: 150  // 滑动阈值
        },

        // 骰盅尺寸（根据骰子数量动态调整）
        cupSize: {
            width: 400,
            height: 350
        },

        // 导航布局
        navTop: 60  // 返回按钮距顶部距离
    },

    onLoad() {
        this._syncI18n();
        this.isShaking = false;
        this._accelerometerHandler = this.handleAccelerometerChange.bind(this);

        // 滑动相关状态
        this._touchStartY = 0;
        this._touchCurrentY = 0;
        this._isSwiping = false;
        this._lastAccelerometer = null;

        // 计算自适应布局
        this._calculateLayout();

        // 初始化骰盅尺寸（基于当前骰子数量）
        const cupSize = this._calculateCupSize(this.data.diceCount);
        this.setData({ cupSize });

        // 【优化】进入页面时上报（只在登录状态下，每会话一次）
        this._reportGamePlay();
    },

    /**
     * 计算自适应布局参数
     */
    _calculateLayout() {
        try {
            const windowInfo = wx.getWindowInfo();
            const { windowWidth, windowHeight } = windowInfo;
            const rpxRatio = 750 / windowWidth;

            // 获取胶囊按钮位置，使返回按钮对齐
            const menuBtn = wx.getMenuButtonBoundingClientRect();
            const navTop = (menuBtn && menuBtn.top > 0) ? menuBtn.top : 60;

            // 根据骰子数量计算骰子区域大小
            // 骰子尺寸: 130rpx, 间距: 24rpx
            const diceSize = 130;
            const diceGap = 24;

            // 计算骰子区域的宽高（基于最多6个骰子的3x2布局）
            const maxCols = 3;
            const maxRows = 2;
            const diceAreaWidth = maxCols * diceSize + (maxCols - 1) * diceGap + 80; // 80rpx padding
            const diceAreaHeight = maxRows * diceSize + (maxRows - 1) * diceGap + 80;

            // 盖子尺寸略大于骰子区域
            const coverWidth = Math.max(diceAreaWidth, 480);
            const coverHeight = Math.max(diceAreaHeight, 360);

            // 滑动阈值根据屏幕高度调整
            const screenHeightRpx = windowHeight * rpxRatio;
            const swipeThreshold = Math.min(150, screenHeightRpx * 0.12);

            this.setData({
                navTop,
                layout: {
                    coverWidth,
                    coverHeight,
                    swipeThreshold
                }
            });

            // 保存用于滑动计算
            this._swipeThresholdPx = swipeThreshold / rpxRatio;

        } catch (e) {
            console.warn('[Dice] calculateLayout failed:', e);
            this._swipeThresholdPx = 150;
        }
    },

    onShow() {
        this._syncI18n();
        // 【优化】隐藏 TabBar（工具页面不需要显示 TabBar）
        // 直接使用 this.getTabBar()，更简洁可靠
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar && !tabBar.data.hidden) {
            tabBar.setData({ hidden: true });
        }

        // 页面显示时启动加速度计
        this._lastAccelerometer = null;
        wx.startAccelerometer({ interval: 'game' });
        wx.onAccelerometerChange(this._accelerometerHandler);
    },

    onHide() {
        // 页面不可见时立即停止骰子碰撞声

        // 页面隐藏时暂停加速度计，节省资源
        wx.stopAccelerometer();
        wx.offAccelerometerChange(this._accelerometerHandler);
        this._lastAccelerometer = null;

        // 【修复】恢复 TabBar 显示
        // 在 onHide 时直接使用 this.getTabBar()，因为当前页面实例仍然有效
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            // 【修改】登录弹窗已移到真心话大冒险页面，不需要模糊
            tabBar.setData({
                hidden: false,
                blurred: false
            });
        }
    },

    onUnload() {
        wx.stopAccelerometer();
        wx.offAccelerometerChange(this._accelerometerHandler);
        // 清理滚动定时器，避免内存泄漏
        this._clearRollTimer();

    },

    /**
     * 返回上一页
     */
    goBack() {
        wx.navigateBack({ delta: 1 });
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        const uiCopy = i18n.getPageCopy('dice', locale);
        this.setData({
            locale: locale,
            uiCopy: uiCopy,
            hintText: uiCopy.hint || '点击屏幕或摇一摇'
        });
        i18n.setNavigationBarTitle('dice.navTitle', locale);
    },

    /**
     * 清理骰子滚动定时器
     * 统一的定时器清理方法，确保不会产生内存泄漏
     */
    _clearRollTimer() {
        if (this.rollTimer) {
            clearInterval(this.rollTimer);
            this.rollTimer = null;
        }
    },

    onDiceCountChange(e) {
        if (this.data.isRolling) return;

        const count = e.currentTarget.dataset.count;
        if (count === this.data.diceCount) return;

        // Update count and reset values to 1 (or random)
        const newValues = Array(count).fill(1).map(() => Math.floor(Math.random() * 6) + 1);

        // 根据骰子数量计算骰盅尺寸
        const cupSize = this._calculateCupSize(count);

        this.setData({
            diceCount: count,
            diceValues: newValues,
            cupSize: cupSize
        }, () => {
            this.calculateTotalScore();
        });

        wx.vibrateShort({ type: 'light' });
    },

    /**
     * 根据骰子数量计算合适的骰盅尺寸
     */
    _calculateCupSize(count) {
        // 骰子尺寸130rpx, 间距24rpx (match CSS)
        // 增加内边距以适应 chunky border 和内部文字
        const diceGap = 24;
        const widthPadding = 220;
        const heightPadding = 260; // Extra height for hint text

        let width, height;

        if (count <= 2) {
            // 1-2个骰子: 一行排列
            width = count * 130 + (count - 1) * diceGap + widthPadding;
            height = 130 + heightPadding;
        } else if (count <= 4) {
            // 3-4个骰子: 2x2排列
            width = 2 * 130 + diceGap + widthPadding;
            height = 2 * 130 + diceGap + heightPadding;
        } else {
            // 5-6个骰子: 2x3竖向排列（2列3行）
            width = 2 * 130 + diceGap + widthPadding;
            height = 3 * 130 + 2 * diceGap + heightPadding;
        }

        return {
            width: Math.max(width, 440),
            height: Math.max(height, 400)
        };
    },

    handleAccelerometerChange(res) {
        // 如果正在滚动或盖子显示中，不响应摇一摇
        if (this.data.isRolling || this.data.showCover) return;

        const { x, y, z } = res;
        const current = { x, y, z };
        const previous = this._lastAccelerometer;
        this._lastAccelerometer = current;

        if (!previous) return;

        const force = Math.abs(x) + Math.abs(y) + Math.abs(z);
        const delta = Math.abs(x - previous.x) + Math.abs(y - previous.y) + Math.abs(z - previous.z);

        if (force > SHAKE_FORCE_THRESHOLD && delta > SHAKE_DELTA_THRESHOLD && !this.isShaking) {
            this.isShaking = true;
            this.rollDice();

            setTimeout(() => {
                this.isShaking = false;
            }, SHAKE_COOLDOWN_MS);
        }
    },

    rollDice() {
        // 如果正在滚动、盖子正在显示或正在揭开，不能掷骰子
        if (this.data.isRolling || this.data.showCover || this.data.coverRevealing) return;

        // 开始掷骰子时立即显示盖子，同时将分数改为问号
        this.setData({
            isRolling: true,
            showCover: true,
            coverAnimating: true, // 标记正在播放出现动画
            displayScore: '?',
            hasRolledOnce: true,
            coverOffsetY: 0,
            coverOpacity: 1,
            coverSwipeProgress: 0
        });

        // 出现动画结束后取消动画标记
        setTimeout(() => {
            this.setData({ coverAnimating: false });
        }, 350);

        // Haptic Feedback Start
        wx.vibrateShort({ type: 'medium' });

        // Simulate rolling duration
        const duration = 600;
        const interval = 100;
        let elapsed = 0;

        // 清除之前可能残留的定时器
        this._clearRollTimer();

        // Rapidly change numbers during roll for visual effect
        this.rollTimer = setInterval(() => {
            const tempValues = this.data.diceValues.map(() => Math.floor(Math.random() * 6) + 1);
            this.setData({ diceValues: tempValues });

            elapsed += interval;
            if (elapsed >= duration) {
                clearInterval(this.rollTimer);
                this.rollTimer = null;
                this.finishRoll();
            }
        }, interval);
    },

    finishRoll() {

        // Generate final result
        const finalValues = this.data.diceValues.map(() => Math.floor(Math.random() * 6) + 1);

        this.setData({
            isRolling: false,
            diceValues: finalValues
        }, () => {
            // 计算总分但不显示（displayScore 保持为 ?）
            const total = finalValues.reduce((a, b) => a + b, 0);
            this.setData({ totalScore: total });
        });

        // Success Haptic
        wx.vibrateShort({ type: 'heavy' });
    },

    calculateTotalScore() {
        const total = this.data.diceValues.reduce((a, b) => a + b, 0);
        this.setData({ totalScore: total, displayScore: total });
    },

    // ==================== 毛玻璃盖子交互 ====================

    /**
     * 盖子触摸开始
     */
    onCoverTouchStart(e) {
        if (this.data.coverRevealing || this.data.isRolling) return;

        this._touchStartY = e.touches[0].clientY;
        this._isSwiping = true;
    },

    /**
     * 盖子触摸移动 - 实时更新滑动进度和位置
     */
    onCoverTouchMove(e) {
        if (!this._isSwiping || this.data.coverRevealing || this.data.isRolling) return;

        const currentY = e.touches[0].clientY;
        const deltaY = this._touchStartY - currentY;

        // 只处理向上滑动
        if (deltaY > 0) {
            // 使用自适应的滑动阈值（用于判断是否揭开）
            const threshold = this._swipeThresholdPx || 150;
            const progress = Math.min(deltaY / threshold, 1);

            // 直接使用像素值来移动盖子，更流畅
            this.setData({
                coverSwipeProgress: progress,
                coverOffsetY: deltaY  // 实际移动的像素值
            });
        } else {
            this.setData({
                coverSwipeProgress: 0,
                coverOffsetY: 0
            });
        }
    },

    /**
     * 盖子触摸结束 - 判断是否揭开
     */
    onCoverTouchEnd() {
        if (!this._isSwiping || this.data.coverRevealing || this.data.isRolling) return;

        this._isSwiping = false;
        const progress = this.data.coverSwipeProgress;

        if (progress >= 0.5) {
            // 滑动超过 50%，揭开盖子
            this.revealCover();
        } else {
            // 未达到阈值，平滑回弹
            this._animateBack();
        }
    },

    /**
     * 平滑回弹动画
     */
    _animateBack() {
        const startOffset = this.data.coverOffsetY || 0;
        const startProgress = this.data.coverSwipeProgress || 0;
        const duration = 200;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            // 缓动函数
            const easeOut = 1 - Math.pow(1 - t, 3);

            const currentOffset = startOffset * (1 - easeOut);
            const currentProgress = startProgress * (1 - easeOut);

            this.setData({
                coverOffsetY: currentOffset,
                coverSwipeProgress: currentProgress
            });

            if (t < 1) {
                setTimeout(animate, 16);
            }
        };

        animate();
    },

    /**
     * 揭开盖子动画 - 从当前位置飞出屏幕
     */
    revealCover() {
        // 标记正在揭开
        this.setData({ coverRevealing: true });

        // 从当前位置开始飞出
        const startOffset = this.data.coverOffsetY || 0;
        const startProgress = this.data.coverSwipeProgress || 0;

        // 获取屏幕高度，计算飞出目标位置
        const windowInfo = wx.getWindowInfo();
        const targetOffset = windowInfo.windowHeight * 0.8; // 飞出屏幕

        const duration = 280; // 飞出动画时长
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            // 加速缓动函数 - 越来越快
            const easeIn = t * t;

            const currentOffset = startOffset + (targetOffset - startOffset) * easeIn;
            const currentProgress = startProgress + (1 - startProgress) * easeIn;
            // 透明度随飞出逐渐降低
            const opacity = 1 - easeIn * 0.8;

            this.setData({
                coverOffsetY: currentOffset,
                coverSwipeProgress: currentProgress,
                coverOpacity: opacity
            });

            if (t < 1) {
                setTimeout(animate, 16);
            } else {
                // 动画结束，隐藏盖子并显示真实分数
                this.setData({
                    showCover: false,
                    coverRevealing: false,
                    coverSwipeProgress: 0,
                    coverOffsetY: 0,
                    coverOpacity: 1,
                    displayScore: this.data.totalScore
                });

                // 上报已移至 onLoad
            }
        };

        animate();
    },

    /**
     * 【优化】静默上报游戏游玩记录
     * - 使用批量上报机制，在 App 进入后台时统一上报
     */
    _reportGamePlay() {
        const app = getApp();
        app.addGameStat('dice');
    },

    // ==================== 分享功能 ====================

    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '掷骰子 | 抓手指-满分激光枪',
            path: '/pages/tool-dice/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.shareTitle || '掷骰子 | 抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    }
});
