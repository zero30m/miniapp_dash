const { IMAGE_URLS } = require('../../utils/config');
const i18n = require('../../utils/i18n');

// 定制版：按原顺序保留前 27 道文字题，搭配原有 3 道图片题，共 30 个游戏。
const textQuestions = [
    { title: "321看这边", content: "喊321，你用手上下左右指，别人要立刻转头，同方向的喝。" },
    { title: "抓爱心", content: "双手比爱心，所有人手指伸进来，抓到谁谁喝。" },
    { title: "抓手指/拉圈圈", content: "所有人大拇指勾小拇指拉成圈摇，拉断的人喝。" },
    { title: "交叉手抓人", content: "所有人交叉手，你挑个人快速握住他的手，然后比大拇指，对方打不开喝。" },
    { title: "舌头手指操", content: "所有人伸出舌头，随着庄家的手指左右移动，反应慢或害羞的喝。" },
    { title: "屁股写字", content: "所有人轮流用屁股在空中写出自己的名字，写不出来的喝。" },
    { title: "脱外套挑战", content: "所有人脱一件外套（或最外层衣物），没衣服可脱的喝。" },
    { title: "叠拳头", content: "所有人拳头交换往上叠，你可以在突然竖起大拇指，没反应过来的喝。" },
    { title: "听掌声", content: "你在别人耳边鼓掌，TA听掌声，说几次掌声，错了喝。" },
    { title: "传酒伸拇指", content: "传两杯酒，你随时伸大拇指，没伸的喝。" },
    { title: "捧虚水", content: "所有人双手假装捧虚水，互相传递，任意玩家可选择把水泼像别人，被泼的人喝。" },
    { title: "指部位", content: "依次指右边玩家任意身体部位，让左边玩家亲，不敢的喝。" },
    { title: "转圈坐", content: "所有人搭肩膀绕卡座转圈，你决定什么时候坐下，最后坐的人喝。" },
    { title: "脖子后点手指", content: "双手十指交叉放到脖子后面，点那个手指头动那个，做错喝。" },
    { title: "掌纹指人", content: "选一个人打开TA的手掌，三条掌纹指向的三个喝。" },
    { title: "比弓箭", content: "你比弓箭，旁边人拉弓，射到谁谁喝。" },
    { title: "比枪", content: "你比枪，旁边人开枪，打到谁喝。" },
    { title: "比一劈开", content: "两食指比一，被你劈开的喝。" },
    { title: "比身高", content: "比你高的喝。" },
    { title: "头碰手掌", content: "伸手让人轮流用头碰，碰不到你手掌的喝。" },
    { title: "大喊闭眼", content: "大喊都闭眼，谁睁眼谁喝。" },
    { title: "左右手猜数", content: "右手伸手指左手挡，让人猜是几，猜错喝。" },
    { title: "闪光灯拍照", content: "打开闪光灯拍照，闭眼的喝。" },
    { title: "打手背", content: "依次打手背，被打着的喝。" },
    { title: "手穿腿摸耳", content: "手穿过一条腿摸自己耳朵，摸不到喝。" },
    { title: "衣服伸出手", content: "手从衣服里面由下到上伸出来，做不到喝。" },
    { title: "跳舞传递", content: "跳性感舞蹈往下传，不做的喝。" },
];

// 使用配置文件中的图片URL
const CLOUD_IMAGES = IMAGE_URLS.FINGER_IMAGES;

// 全局缓存 key
const FINGER_IMAGES_CACHE_KEY = 'fingerImages';

/**
 * 创建完整的游戏题库（图片 + 文字混合）
 * 每次调用返回一个新的数组，避免引用问题
 */
function createGamePool() {
    const pool = [];

    // 添加图片项
    CLOUD_IMAGES.forEach((url, index) => {
        pool.push({ type: 'image', index, url });
    });

    // 添加文字游戏项
    textQuestions.forEach((q, index) => {
        pool.push({ type: 'text', id: index, ...q });
    });

    return pool;
}

/**
 * Fisher-Yates 洗牌算法
 * 【性能优化】原地洗牌，O(n) 时间复杂度
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('finger', 'zh-Hans'),
        currentQuestion: {
            title: i18n.getPageCopy('finger', 'zh-Hans').readyTitle,
            content: i18n.getPageCopy('finger', 'zh-Hans').readyContent
        },
        animationClass: '',
        cardAnimation: '',
        buttonDisabled: false,
        showImage: false,
        imageUrl: '',
        imageLoading: false,
        imageError: false,
        imagesPreloaded: false  // 图片是否预加载完成
    },

    // 游戏历史记录
    gameHistory: [],
    // 当前在历史中的位置，-1 表示初始状态
    historyIndex: -1,
    // 还未被抽取的游戏池（图片+文字混合）
    remainingPool: [],
    // 缓存的图片URL（预加载后）
    cachedImages: [],
    // 防止重复预加载
    isPreloading: false,

    onLoad() {
        this._syncI18n();
        // 初始化预加载索引集合（避免静态属性被深拷贝）
        this.preloadedIndexes = new Set();

        // 初始化游戏池（洗牌后的完整题库）
        this._initGamePool();

        // 预加载图片
        this.preloadImages();

        // 淡入动画
        setTimeout(() => {
            this.setData({ animationClass: 'fade-in' });
        }, 100);
    },

    onUnload() {
        // 清理状态
        this.gameHistory = [];
        this.remainingPool = [];
        this.preloadedIndexes = new Set();
    },

    /**
     * 初始化游戏池
     * 创建混合题库并洗牌
     */
    _initGamePool() {
        this.remainingPool = shuffleArray(createGamePool());
        this.gameHistory = [];
        this.historyIndex = -1;
        console.log('[Finger] Game pool initialized, total items:', this.remainingPool.length);
    },

    /**
     * 预加载图片
     * 【性能优化】使用全局缓存 + 并行预加载 + 实时更新加载状态
     */
    preloadImages() {
        if (this.isPreloading) return;
        const app = getApp();

        // 检查全局缓存
        if (app.globalData.cachedAssets?.[FINGER_IMAGES_CACHE_KEY]) {
            this.cachedImages = app.globalData.cachedAssets[FINGER_IMAGES_CACHE_KEY];
            // 标记所有图片已预加载
            CLOUD_IMAGES.forEach((_, index) => this.preloadedIndexes.add(index));
            this.setData({ imagesPreloaded: true });
            console.log('[Finger] Using cached images:', this.cachedImages.length);
            return;
        }

        this.isPreloading = true;

        // 并行预加载所有图片，每张图片加载完成后立即标记
        const downloadPromises = CLOUD_IMAGES.map((url, index) => {
            return new Promise((resolve) => {
                wx.getImageInfo({
                    src: url,
                    success: () => {
                        // 标记该图片已预加载
                        this.preloadedIndexes.add(index);
                        console.log(`[Finger] Image ${index + 1} prefetched`);

                        // 【优化】如果当前正在显示这张图片，立即更新加载状态
                        if (this.data.showImage && this.data.imageUrl === url && this.data.imageLoading) {
                            this.setData({ imageLoading: false });
                        }

                        resolve(url);
                    },
                    fail: () => {
                        console.warn(`[Finger] Image ${index + 1} prefetch failed`);
                        resolve(url); // 失败也返回原始URL
                    }
                });
            });
        });

        Promise.all(downloadPromises).then((paths) => {
            this.cachedImages = paths;
            // 存入全局缓存
            if (app.globalData.cachedAssets) {
                app.globalData.cachedAssets[FINGER_IMAGES_CACHE_KEY] = paths;
            }
            this.setData({ imagesPreloaded: true });
            console.log('[Finger] All images preloaded');
        }).finally(() => {
            this.isPreloading = false;
        });
    },

    onShow() {
        this._syncI18n();
        // 【修复-思路10】使用 wx.nextTick 确保 TabBar 可操作
        // 【优化】横屏页面，隐藏 Tabbar
        wx.nextTick(() => {
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar) {
                // 只更新需要变化的状态
                if (tabBar.data.selected !== 1 || tabBar.data.hidden !== true) {
                    tabBar.setData({
                        selected: 1,
                        hidden: true
                    });
                }
            }
        });
    },

    onHide() {
        // 【修复】离开页面时恢复 Tabbar 显示
        // 直接使用 this.getTabBar()，因为当前页面实例仍然有效
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            // 【修改】登录弹窗已移到真心话大冒险页面，不需要模糊
            tabBar.setData({
                hidden: false,
                blurred: false
            });
            // 注意：不设置 selected，让目标页面自己处理其 selected 值
        }
    },

    goBack() {
        wx.switchTab({ url: '/pages/home/index' });
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        const uiCopy = i18n.getPageCopy('finger', locale);
        const currentItem = this.historyIndex != null && this.historyIndex >= 0 && this.gameHistory
            ? this.gameHistory[this.historyIndex]
            : null;
        const questionCopy = currentItem && currentItem.type === 'text'
            ? i18n.getFingerQuestionCopy(currentItem.id, locale)
            : null;
        this.setData({
            locale,
            uiCopy,
            currentQuestion: this.historyIndex == null || this.historyIndex < 0
                ? { title: uiCopy.readyTitle, content: uiCopy.readyContent }
                : questionCopy
                    ? {
                        title: questionCopy.title || currentItem.title,
                        content: questionCopy.content || currentItem.content
                    }
                    : this.data.currentQuestion
        });
        i18n.setNavigationBarTitle('finger.navTitle', locale);
    },

    onImageLoad() {
        this.setData({ imageLoading: false, imageError: false });
    },

    onImageError() {
        console.warn('[Finger] Image load error');
        this.setData({ imageError: true, imageLoading: false });
    },

    /**
     * 获取图片URL（优先使用缓存）
     */
    _getImageUrl(index) {
        if (this.cachedImages.length > index) {
            return this.cachedImages[index];
        }
        return CLOUD_IMAGES[index];
    },

    /**
     * 从游戏池中随机抽取一个项目
     * 【优化】题库用完后自动重置并提示
     */
    _getRandomItem() {
        // 如果游戏池为空，重新填充并洗牌
        if (this.remainingPool.length === 0) {
            this.remainingPool = shuffleArray(createGamePool());
            wx.showToast({
                title: this.data.uiCopy.newRound,
                icon: 'none',
                duration: 1500
            });
            console.log('[Finger] Game pool refilled');
        }

        // 从池尾部弹出一个项目（比 splice 更高效）
        return this.remainingPool.pop();
    },

    /**
     * 计算字体大小 class
     */
    _getFontSizeClass(content) {
        if (!content) return '';
        if (content.length > 40) return 'text-small';
        if (content.length > 24) return 'text-medium';
        return '';
    },

    /**
     * 显示图片
     * 【优化】如果图片已预加载，直接显示不需要 loading
     */
    _showImage(imageIndex, animate = true) {
        const targetUrl = this._getImageUrl(imageIndex);
        // 检查该图片是否已预加载完成
        const isPreloaded = this.preloadedIndexes.has(imageIndex);

        if (animate) {
            this.setData({ cardAnimation: 'card-exit' });

            setTimeout(() => {
                this.setData({
                    showImage: true,
                    imageUrl: targetUrl,
                    cardAnimation: 'card-enter',
                    // 如果已预加载，直接显示；否则显示 loading
                    imageLoading: !isPreloaded,
                    imageError: false
                });
                wx.vibrateShort({ type: 'medium' });
            }, 300);
        } else {
            this.setData({
                showImage: true,
                imageUrl: targetUrl,
                imageLoading: !isPreloaded,
                imageError: false
            });
        }
    },

    /**
     * 显示文字游戏
     */
    _showQuestion(item, animate = true) {
        const questionCopy = i18n.getFingerQuestionCopy(item.id, this.data.locale);
        const question = {
            title: questionCopy.title || item.title,
            content: questionCopy.content || item.content
        };
        const fontSizeClass = this._getFontSizeClass(question.content);

        if (animate) {
            this.setData({ cardAnimation: 'card-exit' });

            setTimeout(() => {
                this.setData({
                    showImage: false,
                    currentQuestion: question,
                    fontSizeClass: fontSizeClass,
                    cardAnimation: 'card-enter'
                });
                wx.vibrateShort({ type: 'medium' });
            }, 300);
        } else {
            this.setData({
                showImage: false,
                currentQuestion: question,
                fontSizeClass: fontSizeClass
            });
        }
    },

    /**
     * 根据游戏项显示内容
     */
    _showItem(item, animate = true) {
        if (item.type === 'image') {
            this._showImage(item.index, animate);
        } else {
            this._showQuestion(item, animate);
        }
    },

    /**
     * NEXT 按钮：前进到下一个游戏
     * 
     * 逻辑：
     * 1. 如果用户回退过，按历史顺序前进
     * 2. 否则，从游戏池随机抽取新项目
     */
    nextQuestion() {
        if (this.data.buttonDisabled) return;
        this.setData({ buttonDisabled: true });

        // 情况1：用户回退过，按历史顺序前进
        if (this.historyIndex < this.gameHistory.length - 1) {
            this.historyIndex++;
            this._showItem(this.gameHistory[this.historyIndex]);

            setTimeout(() => {
                this.setData({ buttonDisabled: false });
            }, 500);
            return;
        }

        // 情况2：从游戏池随机抽取新项目
        const item = this._getRandomItem();
        this.gameHistory.push(item);
        this.historyIndex = this.gameHistory.length - 1;
        this._showItem(item);

        setTimeout(() => {
            this.setData({ buttonDisabled: false });
        }, 400);  // 优化：减少延迟
    },

    /**
     * LAST 按钮：回退到上一个游戏
     */
    lastQuestion() {
        if (this.data.buttonDisabled) return;

        // 检查是否可以回退
        if (this.historyIndex <= 0) {
            wx.showToast({
                title: this.historyIndex < 0 ? this.data.uiCopy.notStarted : this.data.uiCopy.alreadyFirst,
                icon: 'none'
            });
            return;
        }

        this.setData({ buttonDisabled: true });

        // 回退到上一个历史记录
        this.historyIndex--;
        this._showItem(this.gameHistory[this.historyIndex]);

        setTimeout(() => {
            this.setData({ buttonDisabled: false });
        }, 400);  // 优化：减少延迟
    },

    // ==================== 分享功能 ====================

    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '抓手指 | 抓手指-满分激光枪',
            path: '/pages/finger/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.shareTitle || '抓手指 | 抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    }
});
