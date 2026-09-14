const i18n = require('../../utils/i18n');
const pokerDeck = require('../../utils/poker_deck.js');

const MOVE_DURATION = 440;
const FLOWER_STAGE_WIDTH_RPX = 744;
const FLOWER_STAGE_HEIGHT_RPX = 684;
const FLOWER_VISUAL_WIDTH_RPX = 724;
const PETAL_COUNTS = [2, 4, 6];
const PETAL_LAYOUTS = {
    2: [
        { left: 58, top: 223, side: 'left', vertical: 'top', rotation: -30, offsetY: 0 },
        { left: 516, top: 223, side: 'right', vertical: 'top', rotation: 30, offsetY: 0 }
    ],
    4: [
        { left: 58, top: 18, side: 'left', vertical: 'top', rotation: -14, offsetY: 58 },
        { left: 516, top: 18, side: 'right', vertical: 'top', rotation: 14, offsetY: 58 },
        { left: 516, top: 428, side: 'right', vertical: 'bottom', rotation: 14, offsetY: -58 },
        { left: 58, top: 428, side: 'left', vertical: 'bottom', rotation: -14, offsetY: -58 }
    ],
    6: [
        { left: 44, top: 4, side: 'left', vertical: 'top', rotation: -28, offsetY: 28 },
        { left: 564, top: 4, side: 'right', vertical: 'top', rotation: 28, offsetY: 28 },
        { left: 44, top: 247, side: 'left', vertical: 'middle', rotation: -28, offsetY: 0 },
        { left: 564, top: 247, side: 'right', vertical: 'middle', rotation: 28, offsetY: 0 },
        { left: 44, top: 490, side: 'left', vertical: 'bottom', rotation: -28, offsetY: -28 },
        { left: 564, top: 490, side: 'right', vertical: 'bottom', rotation: 28, offsetY: -28 }
    ]
};
const FANTASY_STRAIGHTS = [
    ['A', '2', '3'],
    ['2', '3', '4'],
    ['3', '4', '5'],
    ['4', '5', '6'],
    ['5', '6', '7'],
    ['6', '7', '8'],
    ['7', '8', '9'],
    ['8', '9', '10'],
    ['9', '10', 'J'],
    ['10', 'J', 'Q'],
    ['J', 'Q', 'K'],
    ['Q', 'K', 'A']
];

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('poker'),
        gameNames: {},
        gameInfo: {},
        gameList: ['flower'],
        activeGame: 'flower',
        headerPaddingTop: 100,
        isExpanded: true,
        isClosing: false,
        isSwitching: false,
        viewMode: 'simple',

        flowerStageScale: 1,
        flowerStageOffsetY: 0,
        flowerStageWidthPx: FLOWER_STAGE_WIDTH_RPX / 2,
        flowerStageHeightPx: FLOWER_STAGE_HEIGHT_RPX / 2,
        petalCount: 4,
        flowerStarted: false,
        petals: [],
        coreCard: null,
        coreCount: 0,
        deckRemaining: 0,
        combo: 0,
        turnSips: 0,
        turnSettled: false,
        showTurnTotal: false,
        promptText: '',
        deckFinished: false,

        showDrawOverlay: false,
        drawPhase: 'idle',
        drawnCard: null,
        resultSips: 0,
        resultMode: 'idle',
        resultText: '',
        resultBreakdown: '',
        resultFooter: '',
        resultFinalCount: 0,
        moveX: 0,
        moveY: 0,
        moveScale: 1,
        moveRotate: 0
    },

    _deck: null,
    _petalPiles: null,
    _corePile: null,
    _pendingPlacement: null,
    _overlayStartY: 0,
    _overlayCurrentY: 0,
    _touchMoved: false,
    _lastVibrateTime: 0,
    _switchingTimer: null,
    _moveTimer: null,
    _flowerLayoutTimer: null,
    _vibrationTimers: null,

    onLoad() {
        this._syncI18n();
        this._calculateLayout();
        this._startFlowerGame();
    },

    onShow() {
        this._syncI18n();
        this._calculateLayout();
        if (this.data.activeGame === 'flower') {
            this._scheduleFlowerLayout(32);
        }
        i18n.setNavigationBarTitle('poker.navTitle', this.data.locale);

        wx.nextTick(() => {
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (!tabBar) return;

            const app = getApp();
            const tabCount = Math.max(1, (tabBar.data.list || []).length || 4);
            tabBar.setData({
                selected: 3,
                indicatorLeftPercent: 3 * (100 / tabCount),
                hidden: false,
                blurred: false
            });

            if (app.globalData.isAdmin) {
                tabBar.updateAdminStatus(true);
            }
        });
    },

    onHide() {
        this._clearTimers();
        const resetState = { isSwitching: false };
        if (this.data.drawPhase === 'moving' && this._pendingPlacement) {
            resetState.drawPhase = 'revealed';
            resetState.moveX = 0;
            resetState.moveY = 0;
            resetState.moveScale = 1;
            resetState.moveRotate = 0;
        }
        this.setData(resetState);
    },

    onReady() {
        if (this.data.activeGame === 'flower') {
            this._scheduleFlowerLayout(16);
        }
    },

    onResize() {
        this._calculateLayout();
        if (this.data.activeGame === 'flower') {
            this._scheduleFlowerLayout(16);
        }
    },

    onUnload() {
        this._clearTimers();
    },

    _clearTimers() {
        if (this._switchingTimer) {
            clearTimeout(this._switchingTimer);
            this._switchingTimer = null;
        }
        if (this._moveTimer) {
            clearTimeout(this._moveTimer);
            this._moveTimer = null;
        }
        if (this._flowerLayoutTimer) {
            clearTimeout(this._flowerLayoutTimer);
            this._flowerLayoutTimer = null;
        }
        (this._vibrationTimers || []).forEach(function (timer) {
            clearTimeout(timer);
        });
        this._vibrationTimers = [];
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        const uiCopy = i18n.getPageCopy('poker', locale);
        const keepCurrentPrompt = !!this.data.promptText && this.data.locale === locale;
        this.setData({
            locale: locale,
            uiCopy: uiCopy,
            gameNames: uiCopy.gameNames || {},
            gameInfo: uiCopy.gameInfo || {},
            promptText: this._pendingPlacement
                ? this.data.promptText
                : (keepCurrentPrompt ? this.data.promptText : (uiCopy.choosePetal || ''))
        });
    },

    _calculateLayout() {
        try {
            const menuBtn = wx.getMenuButtonBoundingClientRect();
            const windowInfo = wx.getWindowInfo();
            let top;

            if (menuBtn && menuBtn.bottom > 0) {
                top = menuBtn.bottom + 12;
            } else {
                top = ((windowInfo.safeArea && windowInfo.safeArea.top) || 44) + 50;
            }

            this.setData({ headerPaddingTop: top });
        } catch (e) {
            this.setData({ headerPaddingTop: 100 });
        }
    },

    _scheduleFlowerLayout(delay) {
        if (this._flowerLayoutTimer) {
            clearTimeout(this._flowerLayoutTimer);
        }
        this._flowerLayoutTimer = setTimeout(() => {
            this._flowerLayoutTimer = null;
            this._updateFlowerLayout();
        }, typeof delay === 'number' ? delay : 16);
    },

    _updateFlowerLayout() {
        if (this.data.activeGame !== 'flower') return;

        let windowInfo;
        try {
            windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        } catch (e) {
            return;
        }

        const rpxRatio = (windowInfo.windowWidth || 375) / 750;
        const baseWidthPx = FLOWER_STAGE_WIDTH_RPX * rpxRatio;
        const baseHeightPx = FLOWER_STAGE_HEIGHT_RPX * rpxRatio;
        const visualWidthPx = FLOWER_VISUAL_WIDTH_RPX * rpxRatio;
        const minVerticalGap = 12 * rpxRatio;
        const minStageScale = this.data.petalCount === 6 ? 0.7 : 0.78;

        this.createSelectorQuery()
            .select('.flower-board-shell')
            .boundingClientRect((rect) => {
                if (!rect || !rect.width || !rect.height) return;

                const widthScale = rect.width / visualWidthPx;
                const heightScale = Math.max(
                    rect.height - minVerticalGap * 2,
                    baseHeightPx * minStageScale
                ) / baseHeightPx;
                const stageScale = Math.max(
                    minStageScale,
                    Math.min(1.1, Math.min(widthScale, heightScale))
                );
                const visualHeight = baseHeightPx * stageScale;
                const stageOffsetY = Math.max(0, (rect.height - visualHeight) / 2);

                this.setData({
                    flowerStageScale: Number(stageScale.toFixed(4)),
                    flowerStageOffsetY: Math.round(stageOffsetY),
                    flowerStageWidthPx: Math.round(baseWidthPx),
                    flowerStageHeightPx: Math.round(baseHeightPx)
                });
            })
            .exec();
    },

    preventBubble() {},

    toggleViewMode() {
        const newMode = this.data.viewMode === 'simple' ? 'detail' : 'simple';
        this._vibrate('light');
        this.setData({ viewMode: newMode });
    },

    _vibrate(type) {
        const now = Date.now();
        if (now - this._lastVibrateTime < 80) return;
        this._lastVibrateTime = now;
        try {
            wx.vibrateShort({ type: type || 'light' });
        } catch (e) {}
    },

    onOverlayTouch(e) {
        if (e.touches && e.touches[0]) {
            this._overlayStartY = e.touches[0].clientY;
            this._overlayCurrentY = this._overlayStartY;
            this._touchMoved = false;
        }
    },

    onOverlaySwipe(e) {
        if (e.touches && e.touches[0]) {
            this._overlayCurrentY = e.touches[0].clientY;
            this._touchMoved = true;
        }
    },

    onOverlayTouchEnd() {
        if (this._justOpened) {
            this._overlayStartY = 0;
            this._overlayCurrentY = 0;
            this._touchMoved = false;
            return;
        }

        const dy = this._overlayCurrentY - this._overlayStartY;
        if (this.data.viewMode === 'simple' && this._touchMoved && dy < -40) {
            this.closeSelector();
        }

        this._overlayStartY = 0;
        this._overlayCurrentY = 0;
        this._touchMoved = false;
    },

    onOverlayTap() {
        if (!this._justOpened && this.data.viewMode === 'simple') {
            this.closeSelector();
        }
    },

    closeSelector() {
        if (!this.data.isExpanded || this.data.isClosing) return;
        this._vibrate('light');
        this.setData({
            isExpanded: false,
            isClosing: false
        }, () => {
            if (this.data.activeGame === 'flower') {
                wx.nextTick(() => {
                    this._scheduleFlowerLayout(32);
                });
            }
        });
    },

    expandSelector() {
        this._vibrate('heavy');
        this.setData({ isExpanded: true });
    },

    selectGame(e) {
        const game = e.currentTarget.dataset.game;
        if (!this.data.gameList.includes(game)) return;

        const isChanged = game !== this.data.activeGame;
        this._vibrate(isChanged ? 'medium' : 'light');

        this.setData({
            activeGame: game,
            isExpanded: false,
            isClosing: false,
            isSwitching: isChanged
        }, () => {
            if (game === 'flower') {
                wx.nextTick(() => {
                    this._scheduleFlowerLayout(32);
                });
            }
        });

        if (isChanged && game === 'flower') {
            this._startFlowerGame();
        }
        if (this._switchingTimer) clearTimeout(this._switchingTimer);
        this._switchingTimer = setTimeout(() => {
            this.setData({ isSwitching: false });
            this._switchingTimer = null;
        }, 500);
    },

    onPullStart() {
        this._vibrate('light');
    },

    onPullEnd() {
        this._vibrate('heavy');
        this._justOpened = true;
        this.setData({ isExpanded: true });
        setTimeout(() => {
            this._justOpened = false;
        }, 500);
    },

    _startFlowerGame(requestedPetalCount) {
        this._clearTimers();
        const petalCount = PETAL_COUNTS.includes(Number(requestedPetalCount))
            ? Number(requestedPetalCount)
            : (PETAL_COUNTS.includes(this.data.petalCount) ? this.data.petalCount : 4);
        this._deck = pokerDeck.shuffleDeck(pokerDeck.createDoubleDeck());
        this._petalPiles = Array.from({ length: petalCount }, function () { return []; });
        this._corePile = [];
        this._pendingPlacement = null;

        for (let i = 0; i < petalCount; i++) {
            this._petalPiles[i].push(this._deck.pop());
        }

        this.setData({
            petalCount: petalCount,
            flowerStarted: false,
            petals: this._buildPetalView(),
            coreCard: null,
            coreCount: 0,
            deckRemaining: this._deck.length,
            combo: 0,
            turnSips: 0,
            turnSettled: false,
            showTurnTotal: false,
            promptText: this.data.uiCopy.choosePetal,
            deckFinished: false,
            showDrawOverlay: false,
            drawPhase: 'idle',
            drawnCard: null,
            resultSips: 0,
            resultMode: 'idle',
            resultText: '',
            resultBreakdown: '',
            resultFooter: '',
            resultFinalCount: 0,
            moveX: 0,
            moveY: 0,
            moveScale: 1,
            moveRotate: 0
        }, () => {
            this._scheduleFlowerLayout(16);
        });
    },

    onPetalCountChange(e) {
        if (this.data.flowerStarted || this.data.showDrawOverlay || this._pendingPlacement) return;
        const delta = Number(e.currentTarget.dataset.delta);
        const currentIndex = PETAL_COUNTS.indexOf(this.data.petalCount);
        const nextIndex = Math.max(0, Math.min(PETAL_COUNTS.length - 1, currentIndex + delta));
        const nextCount = PETAL_COUNTS[nextIndex];
        if (!delta || currentIndex < 0 || nextCount === this.data.petalCount) return;
        this._vibrate('light');
        this._startFlowerGame(nextCount);
    },

    _buildPetalView() {
        const piles = this._petalPiles || [];
        const layout = PETAL_LAYOUTS[piles.length] || PETAL_LAYOUTS[4];
        return piles.map(function (pile, index) {
            const itemLayout = layout[index];
            const isLeft = itemLayout.side === 'left';
            const isBottom = itemLayout.vertical === 'bottom';
            const isTwoPetalLayout = piles.length === 2;
            const isSixPetalLayout = piles.length === 6;
            const useInnerPeek = isTwoPetalLayout || (isSixPetalLayout ? !isBottom : isBottom);
            const underCard = pile.length > 1 ? pile[pile.length - 2] : null;
            const peekSide = useInnerPeek
                ? (isLeft ? 'right' : 'left')
                : (isLeft ? 'left' : 'right');
            return {
                index: index,
                top: pile[pile.length - 1],
                under: underCard,
                count: pile.length,
                left: itemLayout.left,
                topPosition: itemLayout.top,
                rotation: itemLayout.rotation,
                topOffsetX: 0,
                topOffsetY: itemLayout.offsetY,
                side: itemLayout.side,
                vertical: isBottom ? 'bottom' : 'top',
                peekSide: peekSide,
                peekRank: underCard && !underCard.isJoker
                    ? underCard.rank
                    : '',
                peekSuit: underCard && !underCard.isJoker
                    ? underCard.suit
                    : ''
            };
        });
    },

    _canMakeFantasyStraight(firstRank, secondRank) {
        if (!firstRank || !secondRank || firstRank === secondRank) return false;
        return FANTASY_STRAIGHTS.some(function (sequence) {
            return sequence.indexOf(firstRank) !== -1 &&
                sequence.indexOf(secondRank) !== -1;
        });
    },

    _evaluateFantasyHand(first, second) {
        if (!first || !second) return { sips: 0, type: '' };
        if (first.isJoker || second.isJoker) return { sips: 4, type: 'joker' };
        if (first.rank === second.rank) return { sips: 4, type: 'trips' };

        const canMakeStraight = this._canMakeFantasyStraight(first.rank, second.rank);
        const sameSuit = first.suitKey === second.suitKey;

        if (sameSuit && canMakeStraight) return { sips: 3, type: 'straightFlush' };
        if (sameSuit) return { sips: 2, type: 'flush' };
        if (canMakeStraight) return { sips: 1, type: 'straight' };
        return { sips: 0, type: '' };
    },

    _scoreFantasyHand(first, second) {
        return this._evaluateFantasyHand(first, second).sips;
    },

    onPetalTap(e) {
        if (this.data.activeGame !== 'flower' ||
            this.data.isExpanded ||
            this.data.showDrawOverlay ||
            this.data.deckFinished) {
            return;
        }

        const petalIndex = Number(e.currentTarget.dataset.index);
        const pile = this._petalPiles && this._petalPiles[petalIndex];
        if (!pile || !pile.length || !this._deck || !this._deck.length) {
            this.setData({
                deckFinished: true,
                promptText: this.data.uiCopy.deckEmpty
            });
            return;
        }

        const baseCombo = this.data.turnSettled ? 0 : this.data.combo;
        const baseTurnSips = this.data.turnSettled ? 0 : this.data.turnSips;
        const drawnCard = this._deck.pop();
        const petalTop = pile[pile.length - 1];
        const fantasyHand = this._evaluateFantasyHand(drawnCard, petalTop);
        const handSips = fantasyHand.sips;
        const isMatched = handSips > 0;
        const nextCombo = isMatched ? baseCombo + 1 : 0;
        const nextTurnSips = isMatched ? baseTurnSips + handSips : baseTurnSips;
        const shouldBloomNow = isMatched && nextCombo >= 3 && this._deck.length > 0;
        const uiCopy = this.data.uiCopy;

        this._pendingPlacement = {
            kind: 'petal',
            card: drawnCard,
            petalIndex: petalIndex,
            totalSips: handSips,
            nextCombo: nextCombo,
            nextTurnSips: nextTurnSips,
            triggersBloom: shouldBloomNow,
            destination: 'petal',
            rotation: (this.data.petals[petalIndex] && this.data.petals[petalIndex].rotation) || 0
        };

        this.setData({
            flowerStarted: true,
            deckRemaining: this._deck.length,
            showDrawOverlay: true,
            drawPhase: 'revealed',
            drawnCard: drawnCard,
            resultSips: handSips,
            resultMode: isMatched ? 'hit' : 'miss',
            resultText: isMatched
                ? i18n.formatString(uiCopy.drinkResult, { count: handSips })
                : uiCopy.passTitle,
            resultBreakdown: isMatched
                ? i18n.formatString(uiCopy.fantasyMatched, {
                    hand: (uiCopy.fantasyHandNames || {})[fantasyHand.type] || '',
                    count: handSips
                })
                : '',
            resultFooter: isMatched
                ? i18n.formatString(uiCopy.turnTotal, { count: nextTurnSips })
                : uiCopy.nextPlayerResult,
            resultFinalCount: 0,
            moveX: 0,
            moveY: 0,
            moveScale: 1,
            moveRotate: 0
        });

        if (handSips > 0) {
            this._vibrateSips(handSips);
        }
    },

    onDrawOverlayTap() {
        if (this.data.drawPhase !== 'revealed' || !this._pendingPlacement) return;

        const pending = this._pendingPlacement;
        const targetSelector = pending.destination === 'core'
            ? '.core-target'
            : '.petal-top-target-' + pending.petalIndex;
        const sizeSelector = pending.destination === 'core'
            ? '.core-target'
            : '.petal-target-' + pending.petalIndex;
        const query = this.createSelectorQuery();

        query.select('.draw-card-host').boundingClientRect();
        query.select(targetSelector).boundingClientRect();
        query.select(sizeSelector).boundingClientRect();
        query.exec((rects) => {
            const source = rects && rects[0];
            const target = rects && rects[1];
            const targetSize = rects && rects[2];

            if (!source || !target || !targetSize) {
                this._finishPendingPlacement();
                return;
            }

            const sourceCenterX = source.left + source.width / 2;
            const sourceCenterY = source.top + source.height / 2;
            const targetCenterX = target.left + target.width / 2;
            const targetCenterY = target.top + target.height / 2;
            const scale = Math.min(
                targetSize.width / source.width,
                targetSize.height / source.height
            );
            const rotation = pending.destination === 'petal'
                ? (Number(pending.rotation) || 0)
                : 0;

            this.setData({
                drawPhase: 'moving',
                moveX: targetCenterX - sourceCenterX,
                moveY: targetCenterY - sourceCenterY,
                moveScale: scale,
                moveRotate: rotation
            });

            this._moveTimer = setTimeout(() => {
                this._moveTimer = null;
                this._finishPendingPlacement();
            }, MOVE_DURATION);
        });
    },

    _finishPendingPlacement() {
        const pending = this._pendingPlacement;
        if (!pending) return;

        this._pendingPlacement = null;

        if (pending.kind === 'bloom') {
            this._finishBloomPlacement(pending);
            return;
        }

        this._petalPiles[pending.petalIndex].push(pending.card);
        const isMatched = pending.totalSips > 0;
        const deckFinished = !this._deck.length;

        const viewPatch = {
            petals: this._buildPetalView(),
            combo: isMatched && !deckFinished ? pending.nextCombo : 0,
            turnSips: pending.nextTurnSips,
            turnSettled: !isMatched || deckFinished,
            showTurnTotal: true,
            promptText: deckFinished
                ? this.data.uiCopy.deckEmpty
                : (isMatched ? this.data.uiCopy.keepGoing : this.data.uiCopy.nextPlayer),
            deckFinished: deckFinished
        };

        if (pending.triggersBloom && !deckFinished) {
            viewPatch.combo = pending.nextCombo;
            viewPatch.turnSettled = false;
            viewPatch.promptText = this.data.uiCopy.bloomDealing;
            this._settleDrawOverlay(viewPatch, () => {
                this._prepareBloomDraw(pending.nextTurnSips);
            });
            return;
        }

        this._settleDrawOverlay(viewPatch);
    },

    _prepareBloomDraw(baseTurnSips) {
        if (!this._deck || !this._deck.length) return;

        const bloomCard = this._deck.pop();
        const petalScores = this._petalPiles.map((pile) => {
            return this._scoreFantasyHand(
                bloomCard,
                pile[pile.length - 1]
            );
        });
        const bloomSips = petalScores.reduce(function (sum, score) {
            return sum + score;
        }, 0);
        const finalTurnSips = baseTurnSips + bloomSips;

        this._pendingPlacement = {
            kind: 'bloom',
            card: bloomCard,
            totalSips: bloomSips,
            nextTurnSips: finalTurnSips,
            destination: 'core'
        };

        this.setData({
            deckRemaining: this._deck.length,
            showDrawOverlay: true,
            drawPhase: 'revealed',
            drawnCard: bloomCard,
            resultSips: bloomSips,
            resultMode: 'bloom',
            resultText: bloomSips > 0
                ? this.data.uiCopy.bloomTitle
                : this.data.uiCopy.passTitle,
            resultBreakdown: bloomSips > 0
                ? i18n.formatString(this.data.uiCopy.bloomResult, { count: bloomSips })
                : '\u00A0',
            resultFooter: '',
            resultFinalCount: finalTurnSips,
            moveX: 0,
            moveY: 0,
            moveScale: 1,
            moveRotate: 0
        });

        if (bloomSips > 0) {
            this._vibrateSips(bloomSips);
        }
    },

    _finishBloomPlacement(pending) {
        this._corePile.push(pending.card);
        const deckFinished = !this._deck.length;

        this._settleDrawOverlay({
            coreCard: pending.card,
            coreCount: this._corePile.length,
            combo: 0,
            turnSips: pending.nextTurnSips,
            turnSettled: true,
            showTurnTotal: true,
            promptText: deckFinished
                ? this.data.uiCopy.deckEmpty
                : this.data.uiCopy.nextPlayerAfterBloom,
            deckFinished: deckFinished
        });
    },

    _settleDrawOverlay(viewPatch, afterHidden) {
        this.setData(viewPatch, () => {
            wx.nextTick(() => {
                if (typeof afterHidden === 'function') {
                    this.setData({
                        drawPhase: 'resetting',
                        resultMode: 'idle',
                        moveX: 0,
                        moveY: 0,
                        moveScale: 1,
                        moveRotate: 0
                    }, () => {
                        wx.nextTick(afterHidden);
                    });
                    return;
                }

                this.setData({
                    showDrawOverlay: false,
                    drawPhase: 'idle',
                    drawnCard: null,
                    resultMode: 'idle',
                    resultFinalCount: 0,
                    moveX: 0,
                    moveY: 0,
                    moveScale: 1,
                    moveRotate: 0
                });
            });
        });
    },

    _vibrateSips(count) {
        (this._vibrationTimers || []).forEach(function (timer) {
            clearTimeout(timer);
        });
        this._vibrationTimers = [];

        for (let i = 0; i < count; i++) {
            const timer = setTimeout(function () {
                try {
                    wx.vibrateShort({ type: 'light' });
                } catch (e) {}
            }, i * 150);
            this._vibrationTimers.push(timer);
        }
    },

    restartFlower() {
        this._vibrate('medium');
        this._startFlowerGame();
    },

    onShareAppMessage() {
        const gameName = this.data.gameNames[this.data.activeGame] || this.data.uiCopy.navTitle;
        return {
            title: gameName + ' | ' + this.data.uiCopy.shareTitle,
            path: '/pages/profile/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        const gameName = this.data.gameNames[this.data.activeGame] || this.data.uiCopy.navTitle;
        return {
            title: gameName + ' | ' + this.data.uiCopy.timelineTitle,
            imageUrl: '/logo.png'
        };
    }
});
