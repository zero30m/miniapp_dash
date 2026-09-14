/**
 * 点老头游戏
 * 类似"打地鼠"的趣味喝酒小游戏
 * 16个老头中只有1个是真的，点中真老头的人输了喝酒
 * 
 */

const { IMAGE_URLS } = require('../../utils/config');
const i18n = require('../../utils/i18n');
const toolImageCache = require('../../utils/tool_image_cache');

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('oldman', 'zh-Hans'),
        // 游戏状态: 'ready' | 'playing' | 'found'
        gameState: 'ready',
        // 16个老头的数据
        oldmen: [],
        // 正确老头的索引
        targetIndex: -1,
        // 是否显示结果弹窗
        showResult: false,
        // 当前回合数
        round: 0,
        // 剩余老头数量
        remainingCount: 16,
        // 图片资源
        images: {
            normal: toolImageCache.getCachedToolImage(IMAGE_URLS.OLDMAN_NORMAL),
            angry: toolImageCache.getCachedToolImage(IMAGE_URLS.OLDMAN_ANGRY)
        },
        // 提示文案
        hintText: i18n.getPageCopy('oldman', 'zh-Hans').initialHintBang,
        // 动画控制
        resultAnimating: false,
        // 导航布局
        navTop: 60,
        menuRight: 95,      // 胶囊按钮右边距
        menuDotRight: 117,  // 三个点按钮中心距右边距离

    },

    onLoad() {
        this._imagePageUnloaded = false;
        this._syncI18n();
        this._calculateNavLayout();
        this._preloadImages();
        this._initGame();
        this._reportGamePlay();
    },

    onHide() {
        this._clearTimers();
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({ hidden: false, blurred: false });
        }
    },

    onShow() {
        this._syncI18n();
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar && !tabBar.data.hidden) {
            tabBar.setData({ hidden: true });
        }
    },

    onUnload() {
        this._imagePageUnloaded = true;
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
        const uiCopy = i18n.getPageCopy('oldman', locale);
        this.setData({
            locale: locale,
            uiCopy: uiCopy,
            hintText: this.data.round > 0 ? this.data.hintText : (uiCopy.initialHintBang || this.data.hintText)
        });
        i18n.setNavigationBarTitle('oldman.navTitle', locale);
    },

    _getInitialHint(withBang) {
        return withBang ? (this.data.uiCopy.initialHintBang || '找出真正的老头！') : (this.data.uiCopy.initialHint || '找出真正的老头');
    },

    _getMissHint(fakesRemaining) {
        if (fakesRemaining <= 3 && fakesRemaining > 0) {
            return i18n.formatString(this.data.uiCopy.remainingFakes || '还剩 {count} 个假老头...', {
                count: fakesRemaining
            });
        }
        if (fakesRemaining === 0) {
            return this.data.uiCopy.finalHint || '就是他！';
        }
        return this.data.uiCopy.keepLooking || '继续找！';
    },

    /**
     * 计算导航布局，获取胶囊按钮位置
     * 系统胶囊按钮分为左右两部分：左边是关闭按钮，右边是三个点菜单按钮
     */
    _calculateNavLayout() {
        try {
            const menuBtn = wx.getMenuButtonBoundingClientRect();
            const systemInfo = wx.getSystemInfoSync();
            if (menuBtn && menuBtn.top > 0) {
                const menuRight = systemInfo.windowWidth - menuBtn.right;
                // 胶囊结构: [ ... | O ]
                // 宽度通常 87px (iOS) 或 96px (Android)
                // 三个点中心大约在左侧 25% 处
                // 距离右边距的距离 = menuRight + 胶囊宽度 * 0.75
                const arrowPosFromRight = menuRight + (menuBtn.width * 0.72); // 0.72 for visual centering

                this.setData({
                    navTop: menuBtn.top,
                    menuRight: menuRight,
                    menuDotRight: arrowPosFromRight // Used for arrow positioning
                });
            }
        } catch (e) {
            console.warn('[NavLayout] Failed to get menu button rect:', e);
        }
    },

    /**
     * 预加载游戏图片
     */
    _preloadImages() {
        const images = { normal: IMAGE_URLS.OLDMAN_NORMAL, angry: IMAGE_URLS.OLDMAN_ANGRY };
        Object.keys(images).forEach(key => {
            toolImageCache.loadToolImage(images[key]).then(path => {
                if (!this._imagePageUnloaded) this.setData({ [`images.${key}`]: path });
            }).catch(error => console.warn('[OldmanGame] Image preload failed:', error));
        });
    },

    _initGame(newRound) {
        // 生成16个老头
        const oldmen = [];
        for (let i = 0; i < 16; i++) {
            oldmen.push({
                id: i,
                isVisible: true,
                flyDirection: '',
                scale: 1,
                opacity: 1
            });
        }

        // 随机选择一个作为"真老头"
        const targetIndex = Math.floor(Math.random() * 16);

        // 【修复】使用传入的 round 或当前值
        const currentRound = newRound !== undefined ? newRound : this.data.round;

        this.setData({
            oldmen,
            targetIndex,
            gameState: 'playing',
            showResult: false,

            remainingCount: 16,
            hintText: this._getInitialHint(false),
            resultAnimating: false,

            round: currentRound // 确保 round 正确
        });

        wx.vibrateShort({ type: 'light' });
    },

    /**
     * 开始新游戏
     */
    startGame() {
        this._initGameLocal();
    },

    /**
     * 【新增】本地初始化游戏（单机模式或降级使用）
     */
    _initGameLocal() {
        const newRound = this.data.round + 1;
        this.setData({ round: newRound }, () => {
            this._initGame(newRound);
        });
    },

    /**
     * 重置游戏（任意玩家可调用）
     */
    resetGame() {
        if (this.data.resultAnimating) return;
        this.startGame();
    },

    /**
     * 点击老头
     */
    onTapOldman(e) {
        const { index } = e.currentTarget.dataset;
        const { oldmen, targetIndex, gameState } = this.data;

        if (gameState !== 'playing') return;
        if (!oldmen[index].isVisible) return;

        if (index === targetIndex) {
            this._onFoundTarget();
        } else {
            this._onMissTarget(index);
        }
    },

    /**
     * 找到真老头（本玩家输了）
     */
    _onFoundTarget() {
        // 【修复】防止重复触发（多人同时点击真老头）
        if (this.data.gameState === 'found') {
            return;
        }

        wx.vibrateShort({ type: 'heavy' });

        this.setData({
            gameState: 'found',
            showResult: true,
            resultAnimating: true,
            hintText: this.data.uiCopy.foundHint || '🎉 找到了！'
        });

        setTimeout(() => {
            this.setData({ resultAnimating: false });
        }, 600);
    },

    /**
     * 点中假老头，让它飞走
     */
    _onMissTarget(index) {
        const { oldmen, remainingCount } = this.data;

        wx.vibrateShort({ type: 'light' });

        const directions = ['fly-top', 'fly-bottom', 'fly-left', 'fly-right', 'fly-top-left', 'fly-top-right', 'fly-bottom-left', 'fly-bottom-right'];
        const flyDirection = directions[Math.floor(Math.random() * directions.length)];

        const newOldmen = [...oldmen];
        newOldmen[index] = {
            ...newOldmen[index],
            flyDirection,
            isVisible: false
        };

        const newRemainingCount = remainingCount - 1;
        const fakesRemaining = newRemainingCount - 1;

        let hintText = this._getMissHint(fakesRemaining);

        this.setData({
            oldmen: newOldmen,
            remainingCount: newRemainingCount,
            hintText
        });

        // 如果只剩下真老头（单机模式自动触发）
        if (newRemainingCount === 1) {
            setTimeout(() => this._onFoundTarget(), 300);
        }
    },

    /**
     * 关闭结果弹窗，开始新一轮
     * 【修改】任何玩家都可以点击开始新一轮
     * 【修复】添加防重入锁，防止多人同时触发导致 targetIndex 不一致
     */
    onCloseResult() {
        if (this.data.gameState !== 'found') return;

        // 【修复】防重入：防止多人同时点击触发多个新一轮
        if (this._isStartingNewRound) return;
        this._isStartingNewRound = true;

        wx.vibrateShort({ type: 'medium' });

        this.setData({
            showResult: false,

            gameState: 'ready',

        });

        setTimeout(() => {
            this.startGame();
            // 延迟解锁，防止短时间内再次触发
            setTimeout(() => {
                this._isStartingNewRound = false;
            }, 1000);
        }, 300);
    },

    _clearTimers() {
        if (this._hintTimer) {
            clearTimeout(this._hintTimer);
            this._hintTimer = null;
        }
        this._isStartingNewRound = false;
    },

    /**
     * 【优化】静默上报游戏游玩记录 - 使用批量上报机制
     */
    _reportGamePlay() {
        const app = getApp();
        app.addGameStat('oldman');
    },

    // ==================== 分享功能 ====================

    // 抽象嘴臭分享文案库
    _shareTitles: [
        '想和你一起玩，又怕你要吃肯德基疯四',
        '可以别和他玩吗？我戴帽子不好看',
        '你要是输了，今晚请我喝蜜雪冰城',
        '别点，点了你就是我兄弟了',
        '我已经连输8局了，需要你来垫底',
        '听说智商高的人都玩不好这个',
        '你要是赢了算我没说',
        '进来挨骂',
        '帮我点一下，我手指抽筋了',
        '据说这游戏能测出谁是卧底',
        '你敢点吗？反正我不敢',
        '来啊，互相伤害啊',
        '我妈问我为什么跪着玩手机',
        '输了请奶茶，赢了...也请奶茶',
        '千万别点，我怕你上瘾',
        '我已经准备好看你出丑了',
        '点进来看看谁是真正的老头',
        '你的智商余额已不足，是否充值？',
        '别装了，我知道你想点',
        '据说转发这条的人都暴富了（假的）',
        '不是，哥们你还在等什么？',
        '我赌五毛你找不到',
        '你要是能赢我直播倒立洗头',
        '这游戏有毒，但我已经中毒了',
        '来吧，展示你的手速',
        '我已经在这等你半天了',
        '你的好运已到账，请点击查收',
        '据说长得好看的人都点不中',
        '我不是针对你，我是说在座各位...',
        '你猜我为什么要发给你？'
    ],

    // 获取随机分享标题
    _getRandomShareTitle() {
        const shareTitles = this.data.uiCopy.shareTitles && this.data.uiCopy.shareTitles.length ? this.data.uiCopy.shareTitles : this._shareTitles;
        const index = Math.floor(Math.random() * shareTitles.length);
        return shareTitles[index];
    },

    onShareAppMessage() {
        return {
            title: this._getRandomShareTitle(),
            path: '/pages/tool-oldman/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.shareTimelineTitle || '点老头 | 抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    }
});
