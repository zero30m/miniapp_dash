const { CARDS, CARD_MAP } = require('../../utils/cards.js');
const { CARDS_KISS, CARD_MAP_KISS, shuffleArray } = require('../../utils/cards2.js');
const { CARDS_CHESS, CARD_MAP_CHESS } = require('../../utils/cards3.js');
const { CARDS_DARE, CARD_MAP_DARE } = require('../../utils/cards4.js');
const { CARDS_WE, CARD_MAP_WE } = require('../../utils/cards_we.js');
const { CARDS_ZHEXUEJIA, CARD_MAP_ZHEXUEJIA } = require('../../utils/cards_zhexuejia.js');
const { CARDS_TAIQIU, CARD_MAP_TAIQIU } = require('../../utils/cards_taiqiu.js');
const { CARDS_COUPLE_DARE, CARD_MAP_COUPLE_DARE } = require('../../utils/cards_couple_dare.js');
const { CARDS_COUPLE_TALK, CARD_MAP_COUPLE_TALK } = require('../../utils/cards_couple_talk.js');
const { CARDS_COFFEE, CARD_MAP_COFFEE } = require('../../utils/cards_coffee.js');
const { UI_CONFIG } = require('../../utils/config.js');
const i18n = require('../../utils/i18n');

// truth 卡在 DIY 中映射到 we 主题翻译表时使用偏移量，避免与 we 原始卡 ID 冲突
const TRUTH_ID_OFFSET = 1000;
// 导入实时日志工具
const log = require('../../utils/log');

// 读取洗牌功能开关
const SHUFFLE_ENABLED = !!(UI_CONFIG && UI_CONFIG.FEATURES && UI_CONFIG.FEATURES.SWIPE_DOWN_SHUFFLE);

// 【内存优化】限制历史记录最大长度，防止内存无限增长
const MAX_HISTORY_SIZE = 50;

Component({
    properties: {
        gameType: {
            type: String,
            value: 'drinking'
        },
        active: {
            type: Boolean,
            value: true
        },
        customCards: {
            type: Array,
            value: []
        }
    },

    data: {
        displayCards: [],
        deckLength: 132, // Initial value - dynamically updated from CARDS.length
        swipeTrigger: 0,
        theme: 'drinking',
        locale: 'zh-Hans',
        fontScale: 1,
        uiCopy: i18n.getPageCopy('drinkingGame'),
        // 洗牌功能
        isShuffling: false,
        shuffleAnimPhase: 0,
        enableShuffle: SHUFFLE_ENABLED,
        // 【方案B】切换动画状态
        isSwitching: false,
        switchingClass: '',
        // 【DIY】飞入动画状态
        diyFlying: false,
        stageScale: 1,
        stageOffsetY: 0,
        stageWidthPx: 310,
        stageHeightPx: 560,
        stageBottomReserve: 0
    },

    observers: {
        'gameType': function (newVal) {
            // 【修复】如果正在切换中，忽略新的切换请求
            if (this._isSwitchingGame) {
                console.log('[drinking-game] observer blocked - switching in progress');
                return;
            }
            console.log('[drinking-game] observer triggered:', {
                newVal,
                _isAttached: this._isAttached,
                _lastGameType: this._lastGameType,
                willSwitch: this._isAttached && newVal && newVal !== this._lastGameType
            });
            if (this._isAttached && newVal && newVal !== this._lastGameType) {
                this.switchGame(newVal);
            }
        },
        // 【DIY】customCards observer - FIX-3 三重守卫 + 防抖
        'customCards': function (newCards) {
            if (!this._isAttached) return;
            if (this.properties.gameType !== 'diy') return;
            if (!newCards || !Array.isArray(newCards) || newCards.length === 0) return;

            if (this._diyReloadTimer) {
                clearTimeout(this._diyReloadTimer);
            }
            this._diyReloadTimer = setTimeout(() => {
                this._reloadDiyDeck(newCards);
                this._diyReloadTimer = null;
            }, 50);
        }
    },

    lifetimes: {
        created() {
            this.deck = [];
            this.discardPile = [];
            this.cardCounter = 0;
            this.currentCardMap = CARD_MAP;
            this._isAttached = false;
            this._lastGameType = null;
            this._totalCards = 60;

            // 历史记录机制
            this.gameHistory = [];
            this.historyIndex = -1;
            this.maxHistoryIndex = -1;
            // 【修复】绝对卡牌计数器，不受历史裁剪影响
            this._absoluteCardsDrawn = 0;

            // 【方案A】多游戏状态管理 - 保存每个游戏的进度
            this._gameStates = {};
        },
        attached() {
            try {
                this._isAttached = true;
                this._syncLocale();
                const app = getApp();

                // 【修复-风险3】检查 gameType 是否有效，无效时不初始化（组件可能被 hidden 但仍存在）
                const validGameTypes = ['drinking', 'kiss', 'chess', 'dare', 'we', 'zhexuejia', 'taiqiu', 'couple_dare', 'couple_talk', 'coffee', 'diy'];
                if (!validGameTypes.includes(this.properties.gameType)) {
                    console.log('[drinking-game] Invalid gameType, skipping init:', this.properties.gameType);
                    return;
                }

                // 【修复-思路4】如果是后台恢复，延迟初始化确保数据正确
                if (app.globalData.isResuming) {
                    console.log('[drinking-game] attached during resume, delaying init');
                    setTimeout(() => {
                        // 【优化】预加载所有游戏类型的卡组数据
                        this._preloadDecks();
                        this.initGame();
                    }, 100);
                } else {
                    // 【优化】预加载所有游戏类型的卡组数据
                    this._preloadDecks();
                    if (this._lastGameType !== this.properties.gameType) {
                        if (this.properties.gameType === 'diy') {
                            // DIY 模式：由 customCards observer 统一初始化，避免双重初始化
                            this._lastGameType = 'diy';
                            this.setData({ theme: 'diy' });
                        } else {
                            this.initGame();
                        }
                    }
                }
            } catch (e) {
                log.reportLifecycleError('attached', 'drinking-game', e);
            }
        },
        detached() {
            this._isAttached = false;
            this._lastGameType = null;

            // 【内存清理】清理定时器
            if (this.cleanupTimer) {
                clearTimeout(this.cleanupTimer);
                this.cleanupTimer = null;
            }
            if (this.shuffleTimer) {
                clearTimeout(this.shuffleTimer);
                this.shuffleTimer = null;
            }
            // 【方案B】清理切换动画定时器
            if (this._switchTimer) {
                clearTimeout(this._switchTimer);
                this._switchTimer = null;
            }

            // 【DIY】清理 DIY 防抖定时器
            if (this._diyReloadTimer) {
                clearTimeout(this._diyReloadTimer);
                this._diyReloadTimer = null;
            }
            if (this._diyFlyTimer) {
                clearTimeout(this._diyFlyTimer);
                this._diyFlyTimer = null;
            }
            if (this._stageTimer) {
                clearTimeout(this._stageTimer);
                this._stageTimer = null;
            }
            if (this._resizeHandler && wx.offWindowResize) {
                wx.offWindowResize(this._resizeHandler);
                this._resizeHandler = null;
            }

            // 【内存清理】清理预加载数据
            this._preloadedDecks = null;

            // 【方案A】保存当前状态再清理（用于后台恢复）
            if (this._lastGameType) {
                this._saveCurrentState(this._lastGameType);
            }

            // 【内存清理】清理游戏数据
            this.deck = [];
            this.discardPile = [];
            this.gameHistory = [];
            this.currentCardMap = null;
            this._isSwitchingGame = false;
        }
    },

    ready() {
        this._syncLocale();
        this._scheduleStageLayout();
        if (wx.onWindowResize) {
            this._resizeHandler = () => {
                this._syncLocale();
                this._scheduleStageLayout();
            };
            wx.onWindowResize(this._resizeHandler);
        }
    },

    pageLifetimes: {
        show() {
            const app = getApp();
            this._syncLocale();
            this._scheduleStageLayout();

            // 【修复-风险3】检查 gameType 是否有效
            const validGameTypes = ['drinking', 'kiss', 'chess', 'dare', 'we', 'zhexuejia', 'taiqiu', 'couple_dare', 'couple_talk', 'coffee', 'diy'];
            if (!validGameTypes.includes(this.properties.gameType)) {
                return;
            }

            // 【修复-思路6】调试日志
            console.log('[drinking-game] pageLifetimes.show, isResuming:', app.globalData.isResuming,
                'displayCards:', this.data.displayCards?.length, 'theme:', this.data.theme,
                'gameType:', this.properties.gameType);

            if (app.globalData.isResuming) {
                // 【方案A】优先尝试恢复保存的状态
                if (!this.data.displayCards || this.data.displayCards.length === 0) {
                    const gameType = this.properties.gameType;
                    const restored = this._restoreState(gameType);

                    if (!restored) {
                        // 【实时日志】上报组件重新初始化事件
                        log.warn('[drinking-game] displayCards empty during resume, reinitializing', {
                            gameType: gameType,
                            theme: this.data.theme
                        });
                        this.initGame();
                    } else {
                        console.log('[drinking-game] State restored from cache during resume');
                    }
                }

                // 【修复-思路2原有】触发 WXS 状态重置
                wx.nextTick(() => {
                    this.setData({
                        swipeTrigger: (this.data.swipeTrigger || 0) + 1,
                        switchingClass: '' // 确保没有残留的切换动画类
                    });
                });
            }
        },
        hide() {
            // 【方案A】页面隐藏时保存状态
            if (this._lastGameType) {
                this._saveCurrentState(this._lastGameType);
            }
        }
    },

    methods: {
        _syncLocale() {
            const locale = i18n.getAppLocale();
            const fontScale = i18n.getAppFontScale();
            this.setData({
                locale: locale,
                fontScale: fontScale,
                uiCopy: i18n.getPageCopy('drinkingGame', locale)
            }, () => {
                this._refreshLocalizedDisplayCards();
            });
        },

        _scheduleStageLayout() {
            if (!this._isAttached) return;
            if (this._stageTimer) clearTimeout(this._stageTimer);
            this._stageTimer = setTimeout(() => {
                this._updateStageLayout();
                this._stageTimer = null;
            }, 16);
        },

        refreshStageLayout(delay) {
            if (!this._isAttached) return;
            if (this._stageTimer) clearTimeout(this._stageTimer);
            const wait = typeof delay === 'number' ? delay : 16;
            this._stageTimer = setTimeout(() => {
                this._updateStageLayout();
                this._stageTimer = null;
            }, wait);
        },

        _updateStageLayout() {
            const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
            const rpxRatio = (windowInfo.windowWidth || 375) / 750;
            const baseCardWidthPx = 580 * rpxRatio;
            const baseVisualWidthPx = 600 * rpxRatio;
            const baseCardHeightPx = 920 * rpxRatio;
            const hintHeightPx = 168 * rpxRatio;
            const baseStageHeightPx = baseCardHeightPx + hintHeightPx;
            const fontScale = Math.max(1, Math.min(this.data.fontScale || 1, 1.35));
            const minTopGap = 18 * rpxRatio * fontScale;
            const minBottomGap = 28 * rpxRatio;

            this.createSelectorQuery()
                .in(this)
                .select('.stage-shell')
                .boundingClientRect((rect) => {
                    const availableWidth = rect && rect.width ? rect.width : (windowInfo.windowWidth || baseVisualWidthPx);
                    const availableHeight = rect && rect.height ? rect.height : (windowInfo.windowHeight || baseStageHeightPx);
                    const fitHeight = Math.max(availableHeight - minTopGap - minBottomGap, baseStageHeightPx * 0.82);
                    const heightScale = fitHeight / baseStageHeightPx;
                    const widthScale = availableWidth / baseVisualWidthPx;
                    const stageScale = Math.max(0.82, Math.min(1, Math.min(heightScale, widthScale)));
                    const visualHeight = baseStageHeightPx * stageScale;
                    const stageOffsetY = Math.max(minTopGap, (availableHeight - visualHeight) / 2);
                    const stageBottomReserve = Math.max(minBottomGap, availableHeight - stageOffsetY - visualHeight);

                    this.setData({
                        stageScale: Number(stageScale.toFixed(4)),
                        stageOffsetY: Math.round(stageOffsetY),
                        stageWidthPx: Math.round(baseCardWidthPx),
                        stageHeightPx: Math.round(baseStageHeightPx),
                        stageBottomReserve: Math.round(stageBottomReserve)
                    });
                })
                .exec();
        },

        _getCardKey(card) {
            if (!card) return null;
            if (card.diyId && typeof card.diyId === 'string') {
                const parts = card.diyId.split('_');
                const rawId = parseInt(parts[parts.length - 1], 10);
                if (!Number.isNaN(rawId)) {
                    if (card.diyId.indexOf('truth_') === 0) {
                        return rawId + TRUTH_ID_OFFSET;
                    }
                    return rawId;
                }
            }
            return card.id;
        },

        _getDisplayTheme(card, themeOverride) {
            const activeTheme = themeOverride || this.data.theme;
            if (activeTheme === 'diy' && card && card.sourceTheme) {
                return card.sourceTheme;
            }
            return activeTheme;
        },

        _localizeCardCard(card, themeOverride) {
            const locale = this.data.locale || i18n.getAppLocale();
            const localized = Object.assign({}, card);
            const displayTheme = this._getDisplayTheme(card, themeOverride);
            const cardCopy = i18n.getCardCopy(displayTheme, this._getCardKey(card), locale);

            if (cardCopy && Object.keys(cardCopy).length > 0) {
                Object.assign(localized, cardCopy);
            }

            localized.cardKey = this._getCardKey(card);
            localized.sourceLabel = card && card.sourceTheme ? i18n.getDiySourceLabel(card.sourceTheme, locale) || card.source : card.source;
            localized.typeLabel = this.data.theme === 'diy'
                ? localized.sourceLabel
                : i18n.getBrandLabel(displayTheme, card.color, locale);
            localized.showEnglishDesc = locale === 'zh-Hans' && !!card.englishDesc;

            if (locale === 'en' && card.englishDesc && (!cardCopy || !cardCopy.description)) {
                localized.description = card.englishDesc;
                localized.showEnglishDesc = false;
            }

            if (displayTheme === 'zhexuejia') {
                localized.subtitle = i18n.getBrandLabel('zhexuejia', null, locale) || localized.subtitle;
            }

            return localized;
        },

        _refreshLocalizedDisplayCards() {
            if (!this.currentCardMap || !this.data.displayCards || this.data.displayCards.length === 0) {
                return;
            }

            const displayCards = this.data.displayCards.map((displayCard) => {
                const rawCard = this.currentCardMap[displayCard.cardKey] || displayCard;
                const localized = this._localizeCardCard(rawCard, this.data.theme);
                localized.uniqueId = displayCard.uniqueId;
                localized.className = displayCard.className;
                localized.exiting = displayCard.exiting;
                localized.exitTime = displayCard.exitTime;
                localized.isFlipped = displayCard.isFlipped;
                return localized;
            });

            this.setData({ displayCards: displayCards });
        },

        _makeDisplayCard(card, className, themeOverride) {
            const localized = this._localizeCardCard(card, themeOverride);
            localized.uniqueId = `c_${this.cardCounter++}`;
            localized.className = className;
            localized.isFlipped = false;
            return localized;
        },

        /**
         * 【优化】预加载所有游戏类型的卡组数据
         * 在组件 attached 时执行，避免每次切换都重新计算
         */
        _preloadDecks() {
            this._preloadedDecks = {
                drinking: {
                    cardMap: CARD_MAP,
                    totalCards: CARDS.length,
                    deck: CARDS.map(c => c.id).reverse()
                },
                kiss: {
                    cardMap: CARD_MAP_KISS,
                    totalCards: CARDS_KISS.length,
                    deck: shuffleArray(CARDS_KISS.map(c => c.id))
                },
                chess: {
                    cardMap: CARD_MAP_CHESS,
                    totalCards: CARDS_CHESS.length,
                    deck: shuffleArray(CARDS_CHESS.map(c => c.id))
                },
                dare: {
                    cardMap: CARD_MAP_DARE,
                    totalCards: CARDS_DARE.length,
                    deck: shuffleArray(CARDS_DARE.map(c => c.id))
                },
                we: {
                    cardMap: CARD_MAP_WE,
                    totalCards: CARDS_WE.length,
                    deck: shuffleArray(CARDS_WE.map(c => c.id))
                },
                zhexuejia: {
                    cardMap: CARD_MAP_ZHEXUEJIA,
                    totalCards: CARDS_ZHEXUEJIA.length,
                    deck: shuffleArray(CARDS_ZHEXUEJIA.map(c => c.id))
                },
                taiqiu: {
                    cardMap: CARD_MAP_TAIQIU,
                    totalCards: CARDS_TAIQIU.length,
                    deck: shuffleArray(CARDS_TAIQIU.map(c => c.id))
                },
                couple_dare: {
                    cardMap: CARD_MAP_COUPLE_DARE,
                    totalCards: CARDS_COUPLE_DARE.length,
                    deck: shuffleArray(CARDS_COUPLE_DARE.map(c => c.id))
                },
                couple_talk: {
                    cardMap: CARD_MAP_COUPLE_TALK,
                    totalCards: CARDS_COUPLE_TALK.length,
                    deck: shuffleArray(CARDS_COUPLE_TALK.map(c => c.id))
                },
                coffee: {
                    cardMap: CARD_MAP_COFFEE,
                    totalCards: CARDS_COFFEE.length,
                    deck: shuffleArray(CARDS_COFFEE.map(c => c.id))
                }
            };
        },

        /**
         * 【方案A+B】切换游戏 - 带状态保持和动画
         */
        switchGame(gameType) {
            if (this._lastGameType === gameType) return;

            // 【修复】添加超时保护：如果锁持续超过1秒，强制释放
            if (this._isSwitchingGame) {
                if (this._switchLockTime && Date.now() - this._switchLockTime > 1000) {
                    console.warn('[drinking-game] Force releasing switch lock');
                    this._isSwitchingGame = false;
                } else {
                    return;
                }
            }
            this._isSwitchingGame = true;
            this._switchLockTime = Date.now();  // 记录锁定时间

            // 【修复】先保存旧的游戏类型，用于保存状态
            const oldGameType = this._lastGameType;

            // 【关键修复】立即更新 _lastGameType，防止 observer 重复触发
            this._lastGameType = gameType;

            // 清理定时器
            if (this.cleanupTimer) {
                clearTimeout(this.cleanupTimer);
                this.cleanupTimer = null;
            }
            if (this._switchTimer) {
                clearTimeout(this._switchTimer);
                this._switchTimer = null;
            }

            // 【方案A】保存当前游戏状态（使用旧的游戏类型）
            if (oldGameType) {
                this._saveCurrentState(oldGameType);
            }

            console.log('[drinking-game] switchGame animation start:', gameType);

            // 【方案B】播放滑动淡出动画
            this.setData({ switchingClass: 'switching-out' });

            // 淡出动画结束后（立即执行）
            this._switchTimer = setTimeout(() => {
                // 先清除动画类，避免与数据切换冲突
                this.setData({ switchingClass: '' }, () => {
                    // 尝试恢复保存的状态
                    const restored = this._restoreState(gameType);

                    if (!restored) {
                        // 首次进入，正常初始化
                        this._initGameWithType(gameType);
                    }

                    // 确保 theme 已更新
                    this.setData({ theme: gameType });

                    // 下一帧应用淡入动画
                    wx.nextTick(() => {
                        this.setData({ switchingClass: 'switching-in' });

                        // 淡入动画结束后（200ms）清除动画类
                        this._switchTimer = setTimeout(() => {
                            this.setData({ switchingClass: '' });
                            this._isSwitchingGame = false;
                            console.log('[drinking-game] switchGame animation complete');
                        }, 200);
                    });
                });
            }, 0);
        },

        /**
         * 【方案A】保存当前游戏状态
         */
        _saveCurrentState(gameType) {
            if (!gameType) return;

            // 保存完整状态
            this._gameStates[gameType] = {
                deck: this.deck.slice(),
                discardPile: this.discardPile.slice(),
                displayCards: [...this.data.displayCards],
                historyIndex: this.historyIndex,
                maxHistoryIndex: this.maxHistoryIndex,
                gameHistory: this.gameHistory.slice(),
                deckLength: this.data.deckLength,
                cardCounter: this.cardCounter,
                currentCardMap: this.currentCardMap,
                _totalCards: this._totalCards,
                _absoluteCardsDrawn: this._absoluteCardsDrawn
            };
            console.log('[drinking-game] State saved for:', gameType,
                'historyIndex:', this.historyIndex,
                'cards:', this.data.displayCards?.length);
        },

        /**
         * 【方案A】恢复保存的游戏状态
         * @returns {boolean} 是否成功恢复
         */
        _restoreState(gameType) {
            const savedState = this._gameStates[gameType];

            if (!savedState || !savedState.displayCards || savedState.displayCards.length === 0) {
                return false;
            }

            console.log('[drinking-game] Restoring state for:', gameType,
                'historyIndex:', savedState.historyIndex,
                'cards:', savedState.displayCards?.length);

            // 恢复所有状态
            this.deck = savedState.deck.slice();
            this.discardPile = savedState.discardPile.slice();
            this.historyIndex = savedState.historyIndex;
            this.maxHistoryIndex = savedState.maxHistoryIndex;
            this.gameHistory = savedState.gameHistory.slice();
            this.cardCounter = savedState.cardCounter;
            this.currentCardMap = savedState.currentCardMap;
            this._totalCards = savedState._totalCards;
            this._absoluteCardsDrawn = savedState._absoluteCardsDrawn;
            this._lastGameType = gameType;

            // 恢复显示卡牌：过滤掉正在退出的卡牌，重新生成 uniqueId
            let validIndex = 0;
            const restoredCards = savedState.displayCards
                .filter(card => !card.exiting) // 过滤掉正在退出的卡牌
                .map(card => {
                    const className = this.getClassName(validIndex);
                    const rawCard = this.currentCardMap[card.cardKey] || card;
                    const localized = this._localizeCardCard(rawCard, gameType);
                    validIndex++;
                    return Object.assign({}, localized, {
                        uniqueId: `c_${this.cardCounter++}`,
                        className: className,
                        exiting: false,
                        exitTime: null
                    });
                });

            this.setData({
                displayCards: restoredCards,
                deckLength: savedState.deckLength,
                theme: gameType,
                swipeTrigger: (this.data.swipeTrigger || 0) + 1
            });
            this._scheduleStageLayout();

            return true;
        },

        /**
         * 使用指定类型初始化游戏（内部方法）
         */
        _initGameWithType(gameType) {
            this._lastGameType = gameType;
            this.cardCounter = 0;
            this.discardPile = [];
            this.deck = [];
            this.gameHistory = [];
            this.historyIndex = -1;
            this.maxHistoryIndex = -1;
            this._absoluteCardsDrawn = 0;
            this.initGame();
        },

        initGame() {
            // 【修复】优先使用 _lastGameType（由 switchGame/_initGameWithType 设置），
            // 确保切换游戏时使用正确的游戏类型
            const gameType = this._lastGameType || this.properties.gameType;
            this._lastGameType = gameType;

            // 【优化】使用预加载的卡组数据，避免重复计算
            const preloaded = this._preloadedDecks && this._preloadedDecks[gameType];
            if (preloaded) {
                this.currentCardMap = preloaded.cardMap;
                this._totalCards = preloaded.totalCards;
                // 使用 slice() 复制数组，避免修改原始预加载数据
                this.deck = preloaded.deck.slice();
            } else {
                // 回退方案：如果预加载失败，使用原始逻辑
                if (gameType === 'kiss') {
                    this.currentCardMap = CARD_MAP_KISS;
                    this._totalCards = CARDS_KISS.length;
                    this.deck = shuffleArray(CARDS_KISS.map(c => c.id));
                } else if (gameType === 'chess') {
                    this.currentCardMap = CARD_MAP_CHESS;
                    this._totalCards = CARDS_CHESS.length;
                    this.deck = shuffleArray(CARDS_CHESS.map(c => c.id));
                } else if (gameType === 'dare') {
                    this.currentCardMap = CARD_MAP_DARE;
                    this._totalCards = CARDS_DARE.length;
                    this.deck = shuffleArray(CARDS_DARE.map(c => c.id));
                } else if (gameType === 'we') {
                    this.currentCardMap = CARD_MAP_WE;
                    this._totalCards = CARDS_WE.length;
                    this.deck = shuffleArray(CARDS_WE.map(c => c.id));
                } else if (gameType === 'zhexuejia') {
                    this.currentCardMap = CARD_MAP_ZHEXUEJIA;
                    this._totalCards = CARDS_ZHEXUEJIA.length;
                    this.deck = shuffleArray(CARDS_ZHEXUEJIA.map(c => c.id));
                } else if (gameType === 'taiqiu') {
                    this.currentCardMap = CARD_MAP_TAIQIU;
                    this._totalCards = CARDS_TAIQIU.length;
                    this.deck = shuffleArray(CARDS_TAIQIU.map(c => c.id));
                } else if (gameType === 'couple_dare') {
                    this.currentCardMap = CARD_MAP_COUPLE_DARE;
                    this._totalCards = CARDS_COUPLE_DARE.length;
                    this.deck = shuffleArray(CARDS_COUPLE_DARE.map(c => c.id));
                } else if (gameType === 'couple_talk') {
                    this.currentCardMap = CARD_MAP_COUPLE_TALK;
                    this._totalCards = CARDS_COUPLE_TALK.length;
                    this.deck = shuffleArray(CARDS_COUPLE_TALK.map(c => c.id));
                } else if (gameType === 'coffee') {
                    this.currentCardMap = CARD_MAP_COFFEE;
                    this._totalCards = CARDS_COFFEE.length;
                    this.deck = shuffleArray(CARDS_COFFEE.map(c => c.id));
                } else if (gameType === 'diy') {
                    // 【DIY FIX-2】动态卡牌，不走预加载
                    const customCards = this.properties.customCards;
                    if (customCards && customCards.length > 0) {
                        this.currentCardMap = {};
                        customCards.forEach(card => {
                            this.currentCardMap[card.diyId] = card;
                        });
                        this._totalCards = customCards.length;
                        this.deck = shuffleArray(customCards.map(c => c.diyId));
                    } else {
                        // customCards 尚未传入，等待 observer 触发
                        return;
                    }
                } else {
                    this.currentCardMap = CARD_MAP;
                    this._totalCards = CARDS.length;
                    this.deck = CARDS.map(c => c.id);
                    this.deck.reverse();
                }
            }

            this.discardPile = [];
            this.gameHistory = [];
            this.historyIndex = -1;
            this.maxHistoryIndex = -1;

            // 【修复】抽取前3张卡牌放入历史，避免后续重复
            for (let i = 0; i < 3 && this.deck.length > 0; i++) {
                const card = this._drawCardFromDeck();
                this.gameHistory.push(card);
            }

            this.historyIndex = 0;
            // maxHistoryIndex only represents the furthest card user has "reached", initially 0
            this.maxHistoryIndex = 0;

            // 根据历史记录构建显示卡牌
            const displayCards = this._buildDisplayCards('', gameType);

            this.setData({
                displayCards,
                deckLength: this._totalCards - 1, // 初始显示总牌数-1（已抽了1张）
                theme: gameType,
                swipeTrigger: (this.data.swipeTrigger || 0) + 1 // 重置 WXS 滑动状态
            });
            this._scheduleStageLayout();
        },

        /**
         * 洗牌功能 - 由WXS下滑手势触发
         */
        onShuffle() {
            console.log('[DrinkingGame] onShuffle called, enableShuffle:', this.data.enableShuffle, 'isShuffling:', this.data.isShuffling);

            // 检查开关和状态
            if (!this.data.enableShuffle || this.data.isShuffling) return;

            // 开始洗牌
            this.setData({ isShuffling: true, shuffleAnimPhase: 1 });
            wx.vibrateShort({ type: 'medium' });

            // 阶段1：散开 (0.3s)
            this.shuffleTimer = setTimeout(() => {
                this.setData({ shuffleAnimPhase: 2 });

                // 阶段2：飞舞 (0.8s)
                this.shuffleTimer = setTimeout(() => {
                    this.setData({ shuffleAnimPhase: 3 });

                    // 阶段3：收回 (0.4s)
                    this.shuffleTimer = setTimeout(() => {
                        // 执行真正的洗牌逻辑
                        this.shuffleDeck();

                        // 结束动画
                        this.setData({
                            isShuffling: false,
                            shuffleAnimPhase: 0
                        });
                        wx.vibrateShort({ type: 'heavy' });
                    }, 400);
                }, 800);
            }, 300);
        },

        /**
         * 真正的洗牌逻辑 - 打乱当前牌组
         */
        shuffleDeck() {
            // DIY 模式使用 diyId 作为卡牌标识，其他模式使用 id
            const isDiy = this.properties.gameType === 'diy';
            const getKey = (c) => isDiy ? c.diyId : c.id;
            const gameType = this._lastGameType || this.properties.gameType;

            // 当前显示的3张卡牌key（需要从discardPile中移除以避免重复）
            const displayedKeys = new Set(this.data.displayCards.map(c => getKey(c)));

            // discardPile 中已经包含了显示的卡牌key，需要移除它们避免重复
            const discardWithoutDisplay = this.discardPile.filter(key => !displayedKeys.has(key));

            // 合并所有牌（deck + 过滤后的discardPile + 当前显示的牌）
            const allCards = [
                ...this.deck,
                ...discardWithoutDisplay,
                ...this.data.displayCards.map(c => getKey(c))
            ];

            // Fisher-Yates 洗牌
            for (let i = allCards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
            }

            // 重新分配牌堆
            this.deck = allCards;
            this.discardPile = [];

            // 重置历史记录机制（与initGame保持一致）
            this.gameHistory = [];
            this.historyIndex = -1;
            this.maxHistoryIndex = -1;
            this._absoluteCardsDrawn = 0;

            // 抽取前3张卡牌放入历史
            for (let i = 0; i < 3 && this.deck.length > 0; i++) {
                const card = this._drawCardFromDeck();
                this.gameHistory.push(card);
            }

            // 设置历史索引
            this.historyIndex = 0;
            this.maxHistoryIndex = 0;

            // 根据历史记录构建显示卡牌
            const displayCards = this._buildDisplayCards('', gameType);

            this.setData({
                displayCards,
                deckLength: this._totalCards - 1, // 与initGame一致：总牌数-1
                swipeTrigger: (this.data.swipeTrigger || 0) + 1
            });
        },

        /**
         * 仅从牌堆抽取一张卡牌（不处理回收逻辑）
         */
        _drawCardFromDeck() {
            if (this.deck.length > 0) {
                const cardId = this.deck.pop();
                return this.currentCardMap[cardId];
            }
            return null;
        },

        /**
         * 抽取一张新卡牌（处理回收逻辑）
         */
        _drawNewCard() {
            // 如果牌堆空了，回收弃牌堆
            if (this.deck.length === 0 && this.discardPile.length > 0) {
                if (this.properties.gameType === 'kiss' || this.properties.gameType === 'chess' || this.properties.gameType === 'dare' || this.properties.gameType === 'we' || this.properties.gameType === 'taiqiu' || this.properties.gameType === 'couple_dare' || this.properties.gameType === 'couple_talk' || this.properties.gameType === 'coffee' || this.properties.gameType === 'diy') {
                    this.deck = shuffleArray(this.discardPile.slice());
                } else {
                    this.deck = this.discardPile.slice().reverse();
                }
                this.discardPile = [];

                // 【修复】延迟上报，避免同步副作用导致栈溢出
                wx.nextTick(() => {
                    this._reportGamePlay();
                });
            }

            if (this.deck.length > 0) {
                const cardId = this.deck.pop();
                this.discardPile.push(cardId); // 用过的牌入弃牌堆
                return this.currentCardMap[cardId];
            }
            return null;
        },

        /**
         * 【DIY】重新加载 DIY 卡牌组（供 customCards observer 调用）
         * 带右上角飞入动画
         */
        _reloadDiyDeck(cards) {
            if (!cards || cards.length === 0) return;

            // 重建 cardMap（使用 diyId 作为 key - FIX-4）
            this.currentCardMap = {};
            cards.forEach(card => {
                this.currentCardMap[card.diyId] = card;
            });
            this._totalCards = cards.length;

            // 重置游戏状态
            this.cardCounter = 0;
            this.discardPile = [];
            this.gameHistory = [];
            this.historyIndex = -1;
            this.maxHistoryIndex = -1;
            this._absoluteCardsDrawn = 0;
            this._lastGameType = 'diy';

            // 洗牌并构建新牌堆
            this.deck = shuffleArray(cards.map(c => c.diyId));

            // 抽取前3张
            for (let i = 0; i < 3 && this.deck.length > 0; i++) {
                const card = this._drawCardFromDeck();
                this.gameHistory.push(card);
            }
            this.historyIndex = 0;
            this.maxHistoryIndex = 0;

            const displayCards = this._buildDisplayCards();

            // 触发飞入动画
            this.setData({
                displayCards,
                deckLength: this._totalCards - 1,
                theme: 'diy',
                diyFlying: true
            });
            this._scheduleStageLayout();

            // 动画结束后移除标记
            if (this._diyFlyTimer) clearTimeout(this._diyFlyTimer);
            this._diyFlyTimer = setTimeout(() => {
                this.setData({ diyFlying: false });
                this._diyFlyTimer = null;
            }, 800);
        },

        /**
         * 【优化】静默上报游戏游玩记录
         * - 使用批量上报机制，在 App 进入后台时统一上报
         */
        _reportGamePlay() {
            const gameType = this.properties.gameType;
            if (!gameType || gameType === 'more' || gameType === 'diy') {
                return;
            }

            const app = getApp();
            app.addGameStat(gameType);
        },

        /**
         * 【核心】根据 historyIndex 构建显示卡牌数组
         */
        _buildDisplayCards(enterDirection = '', themeOverride) {
            const displayCards = [];

            // 当前卡牌 (active)
            if (this.historyIndex >= 0 && this.historyIndex < this.gameHistory.length) {
                const card = this.gameHistory[this.historyIndex];
                displayCards.push(this._makeDisplayCard(card, enterDirection === 'left' ? 'enter-left' : 'active', themeOverride));
            }

            // 下一张卡牌 (next1)
            if (this.historyIndex + 1 < this.gameHistory.length) {
                const card = this.gameHistory[this.historyIndex + 1];
                displayCards.push(this._makeDisplayCard(card, 'next1', themeOverride));
            }

            // 再下一张卡牌 (next2)
            if (this.historyIndex + 2 < this.gameHistory.length) {
                const card = this.gameHistory[this.historyIndex + 2];
                displayCards.push(this._makeDisplayCard(card, 'next2', themeOverride));
            }

            return displayCards;
        },

        getClassName(index) {
            if (index === 0) return 'active';
            if (index === 1) return 'next1';
            if (index === 2) return 'next2';
            return 'hidden';
        },

        onSwipe(e) {
            // 【修复】防止递归调用导致栈溢出
            if (this._isProcessingSwipe) return;
            this._isProcessingSwipe = true;

            try {
                const { direction } = e;
                if (direction === 'right') {
                    this.swipeForward();
                } else if (direction === 'left') {
                    this.swipeBack();
                }
            } finally {
                this._isProcessingSwipe = false;
            }
        },

        /**
         * 卡牌点击翻转（哲学家酒牌 — 原始模式 + DIY模式）
         */
        onCardTap() {
            const activeIndex = this.data.displayCards.findIndex(c => c.className === 'active' || c.className === 'enter-left');
            if (activeIndex === -1) return;

            const activeCard = this.data.displayCards[activeIndex];

            // 只有可翻转卡牌支持翻转（仅哲学家酒牌 — 原始模式或DIY模式）
            const isFlippable =
                this.data.theme === 'zhexuejia' ||
                (this.data.theme === 'diy' && activeCard.sourceTheme === 'zhexuejia');
            if (!isFlippable) return;

            const key = `displayCards[${activeIndex}].isFlipped`;
            const currentValue = activeCard.isFlipped;

            this.setData({
                [key]: !currentValue
            });

            wx.vibrateShort({ type: 'medium' });
        },

        /**
         * 右滑 - 前进到下一张卡牌
         */
        swipeForward() {
            // 【修复】防止递归调用导致栈溢出
            if (this._isSwipingForward) return;
            this._isSwipingForward = true;

            try {
                const startTime = Date.now();
                let { displayCards } = this.data;

                // 1. 找到当前活跃的卡牌并标记为退出
                const activeCardIndex = displayCards.findIndex(c => !c.exiting);
                if (activeCardIndex === -1) {
                    return;
                }

                const activeCard = displayCards[activeCardIndex];
                activeCard.exiting = true;
                activeCard.className = 'exit-right';
                activeCard.exitTime = startTime;

                // 2. Advance history index
                this.historyIndex++;

                // 3. Update maxHistoryIndex (furthest point user has reached)
                if (this.historyIndex > this.maxHistoryIndex) {
                    this.maxHistoryIndex = this.historyIndex;
                    // 【修复】只有前进到新卡牌时才增加绝对计数
                    this._absoluteCardsDrawn++;
                }

                // 4. Ensure we have enough cards in history for display (active + next1 + next2)
                while (this.gameHistory.length <= this.historyIndex + 2) {
                    const newCard = this._drawNewCard();
                    if (newCard) {
                        this.gameHistory.push(newCard);
                    } else {
                        break; // Deck is empty
                    }
                }

                // 【内存优化】限制历史记录长度，删除最旧的记录
                if (this.gameHistory.length > MAX_HISTORY_SIZE) {
                    const removeCount = this.gameHistory.length - MAX_HISTORY_SIZE;
                    this.gameHistory.splice(0, removeCount);
                    this.historyIndex -= removeCount;
                    this.maxHistoryIndex -= removeCount;
                }

                // Check if we have a card at current position
                if (this.historyIndex >= this.gameHistory.length) {
                    // Cannot advance, revert
                    this.historyIndex--;
                    if (this.historyIndex >= 0 && this.historyIndex < this.maxHistoryIndex) {
                        // maxHistoryIndex stays the same
                    } else if (this.historyIndex >= 0) {
                        this.maxHistoryIndex = this.historyIndex;
                    }
                    activeCard.exiting = false;
                    activeCard.className = 'active';
                    this.setData({ swipeTrigger: (this.data.swipeTrigger || 0) + 1 });
                    return;
                }

                // 4. 保留退出中的卡牌，添加新的显示卡牌
                const exitingCards = displayCards.filter(c => c.exiting);
                const newDisplayCards = [...exitingCards, ...this._buildDisplayCards()];

                // 5. 限制数量
                const finalCards = newDisplayCards.length > 5
                    ? newDisplayCards.slice(newDisplayCards.length - 5)
                    : newDisplayCards;

                // 6. 计算剩余卡牌数（使用绝对计数器，不受历史裁剪影响）
                const cardsDrawnThisRound = this._absoluteCardsDrawn % this._totalCards;
                const remainingCards = cardsDrawnThisRound === 0
                    ? 0
                    : this._totalCards - cardsDrawnThisRound;

                // 7. 更新 UI
                this.setData({
                    displayCards: finalCards,
                    deckLength: remainingCards,
                    swipeTrigger: (this.data.swipeTrigger || 0) + 1
                });

                // 8. 延迟清理
                this._scheduleCleanup(startTime);
            } finally {
                this._isSwipingForward = false;
            }
        },

        /**
         * 左滑 - 返回上一张卡牌
         */
        swipeBack() {
            // 【修复】防止递归调用导致栈溢出
            if (this._isSwipingBack) return;
            this._isSwipingBack = true;

            try {
                // 检查是否已经是第一张
                if (this.historyIndex <= 0) {
                    wx.showToast({
                        title: this.data.uiCopy.alreadyFirst,
                        icon: 'none',
                        duration: 1500
                    });
                    this.setData({
                        swipeTrigger: (this.data.swipeTrigger || 0) + 1
                    });
                    return;
                }

                const startTime = Date.now();
                let { displayCards } = this.data;

                // 1. 找到当前活跃的卡牌并标记为退出
                const activeCardIndex = displayCards.findIndex(c => !c.exiting);
                if (activeCardIndex === -1) {
                    return;
                }

                const activeCard = displayCards[activeCardIndex];
                activeCard.exiting = true;
                activeCard.className = 'exit-right';
                activeCard.exitTime = startTime;

                // 2. 回退历史索引
                this.historyIndex--;

                // 3. 保留退出中的卡牌，根据新索引构建显示卡牌
                const exitingCards = displayCards.filter(c => c.exiting);
                const newDisplayCards = [...exitingCards, ...this._buildDisplayCards('left')];

                // 4. 限制数量
                const finalCards = newDisplayCards.length > 5
                    ? newDisplayCards.slice(newDisplayCards.length - 5)
                    : newDisplayCards;

                // 5. 剩余卡牌数（使用绝对计数器，与swipeForward保持一致）
                const cardsDrawnThisRound = this._absoluteCardsDrawn % this._totalCards;
                const remainingCards = cardsDrawnThisRound === 0
                    ? 0
                    : this._totalCards - cardsDrawnThisRound;

                // 6. 更新 UI
                this.setData({
                    displayCards: finalCards,
                    deckLength: remainingCards,
                    swipeTrigger: (this.data.swipeTrigger || 0) + 1
                });

                // 7. 延迟将 enter-left 切换为 active
                setTimeout(() => {
                    const { displayCards } = this.data;
                    const updated = displayCards.map(c => {
                        if (c.className === 'enter-left') {
                            return { ...c, className: 'active' };
                        }
                        return c;
                    });
                    this.setData({ displayCards: updated });
                }, 50);

                // 8. 延迟清理
                this._scheduleCleanup(startTime);
            } finally {
                this._isSwipingBack = false;
            }
        },

        /**
         * 延迟清理已退出的卡牌
         */
        _scheduleCleanup(startTime) {
            if (this.cleanupTimer) clearTimeout(this.cleanupTimer);

            this.cleanupTimer = setTimeout(() => {
                const { displayCards } = this.data;
                const now = Date.now();
                const newDisplayCards = displayCards.filter(c => {
                    return !(c.exiting && (now - c.exitTime >= 280));
                });

                if (newDisplayCards.length !== displayCards.length) {
                    this.setData({ displayCards: newDisplayCards });
                }
            }, 300);
        }
    }
});
