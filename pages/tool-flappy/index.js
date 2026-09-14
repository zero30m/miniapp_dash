const i18n = require('../../utils/i18n');
const toolImageCache = require('../../utils/tool_image_cache');

const ASSET_PATHS = {
    background: '/assets/flappy/background.jpg',
    bird: '/image-pack-tools/bird-bfb6f350.png',
    pipe: '/assets/flappy/pipe.png'
};

const BEST_SCORE_STORAGE_KEY = 'flappy_best_score_points';
const GROUND_START_RATIO = 1441 / 1672;
const MILLISECONDS_PER_POINT = 10;
const MAX_SCORE = 10000;

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function calculateScore(elapsedMilliseconds) {
    const safeElapsed = Math.max(0, elapsedMilliseconds || 0);
    return Math.min(MAX_SCORE, Math.floor(safeElapsed / MILLISECONDS_PER_POINT));
}

function getWindowInfoSafe() {
    try {
        if (wx.getWindowInfo) return wx.getWindowInfo();
        return wx.getSystemInfoSync();
    } catch (e) {
        return { windowWidth: 375, windowHeight: 812, pixelRatio: 2 };
    }
}

function getDevicePerformanceInfoSafe() {
    let deviceInfo = {};

    try {
        if (wx.getDeviceInfo) {
            deviceInfo = wx.getDeviceInfo() || {};
        }
    } catch (e) {
        deviceInfo = {};
    }

    if (Number.isFinite(deviceInfo.benchmarkLevel) && Number.isFinite(deviceInfo.memorySize)) {
        return deviceInfo;
    }

    try {
        const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
        if (!Number.isFinite(deviceInfo.benchmarkLevel)) {
            deviceInfo.benchmarkLevel = systemInfo.benchmarkLevel;
        }
        if (!Number.isFinite(deviceInfo.memorySize)) {
            deviceInfo.memorySize = systemInfo.memorySize;
        }
        return deviceInfo;
    } catch (e) {
        return deviceInfo;
    }
}

function getAdaptiveCanvasDpr(windowInfo) {
    const deviceInfo = getDevicePerformanceInfoSafe();
    const benchmarkLevel = Number(deviceInfo.benchmarkLevel);
    const memorySize = Number(deviceInfo.memorySize);
    let dprCap = 2;

    if (benchmarkLevel > 0) {
        if (benchmarkLevel <= 10) {
            dprCap = 1;
        } else if (benchmarkLevel <= 20) {
            dprCap = 1.5;
        }
    } else if (memorySize > 0) {
        if (memorySize <= 2048) {
            dprCap = 1;
        } else if (memorySize <= 4096) {
            dprCap = 1.5;
        }
    }

    return clamp(windowInfo.pixelRatio || 2, 1, dprCap);
}

Page({
    data: {
        locale: 'zh-Hans',
        uiCopy: i18n.getPageCopy('flappy', 'zh-Hans'),
        screen: 'rules',
        gameState: 'idle',
        navTop: 44,
        rulesTop: 116,
        hudTop: 116,
        score: 0,
        finalScore: 0,
        bestScore: 0,
        showTapHint: false,
        birdImagePath: toolImageCache.getCachedToolImage(ASSET_PATHS.bird),
        assetError: false
    },

    onLoad() {
        this._destroyed = false;
        this._pageVisible = false;
        this._loadGeneration = 0;
        this._syncI18n();
        this._calculateNavLayout();
        this.setData({ bestScore: this._readBestScore() });
        this._reportGamePlay();
    },

    onShow() {
        this._pageVisible = true;
        this._syncI18n();
        this._setTabBarHidden(true);

        if (this._pendingRoundStart && this._canvas && this._assets) {
            this._pendingRoundStart = false;
            this._beginRound();
            return;
        }

        if (this.data.gameState === 'playing' && this._pausedAt && this._canvas && this._assets) {
            const now = Date.now();
            this._roundStartedAt += now - this._pausedAt;
            this._pausedAt = 0;
            this._lastFrameAt = 0;
            this._running = true;
            this._drawFrame();
            this._scheduleFrame();
        }
    },

    onHide() {
        this._pageVisible = false;

        if (this.data.gameState === 'playing' && this._running) {
            this._pausedAt = Date.now();
            this._stopLoop();
        }
        this._setTabBarHidden(false);
    },

    onUnload() {
        this._destroyed = true;
        this._loadGeneration += 1;
        this._pendingRoundStart = false;
        this._stopLoop();

        this._canvas = null;
        this._ctx = null;
        this._assets = null;
        this._setTabBarHidden(false);
    },

    goBack() {
        this._loadGeneration += 1;
        this._pendingRoundStart = false;
        this._stopLoop();

        const pages = getCurrentPages();
        if (pages && pages.length > 1) {
            wx.navigateBack({ delta: 1 });
        } else {
            wx.switchTab({ url: '/pages/home/index' });
        }
    },

    onStartGame() {

        this._mountGameCanvas();
    },

    onRetryAssetLoad() {

        this._mountGameCanvas();
    },

    onRetryGame() {
        // 结束时 Canvas 会被移除，以保证普通结果弹窗处于最上层。
        // 重玩时重新挂载 Canvas，避免复用已脱离页面的节点。

        this._mountGameCanvas();
    },

    onCanvasTouch() {
        if (this.data.gameState !== 'playing' || !this._running || !this._bird) return;

        this._bird.velocity = this._flapVelocity;

        if (this.data.showTapHint) {
            this.setData({ showTapHint: false });
        }
    },

    _mountGameCanvas() {
        this._stopLoop();

        this._pausedAt = 0;
        this._pendingRoundStart = false;
        this._canvas = null;
        this._ctx = null;
        this._assets = null;

        const generation = ++this._loadGeneration;
        this.setData({
            screen: 'game',
            gameState: 'loading',
            score: 0,
            finalScore: 0,
            showTapHint: false,
            birdImagePath: toolImageCache.getCachedToolImage(ASSET_PATHS.bird),
            assetError: false
        }, () => {
            const prepare = () => this._prepareCanvas(generation);
            if (typeof wx.nextTick === 'function') {
                wx.nextTick(prepare);
            } else {
                setTimeout(prepare, 0);
            }
        });
    },

    _prepareCanvas(generation) {
        const query = this.createSelectorQuery();
        query.select('#flappyCanvas')
            .fields({ node: true, size: true })
            .exec((result) => {
                if (generation !== this._loadGeneration || this._destroyed) return;

                const canvasInfo = result && result[0];
                if (!canvasInfo || !canvasInfo.node) {
                    this._handleAssetError(generation, new Error('Canvas node is unavailable'));
                    return;
                }

                const windowInfo = getWindowInfoSafe();
                const canvas = canvasInfo.node;
                const width = Math.max(1, Math.round(canvasInfo.width || windowInfo.windowWidth || 375));
                const height = Math.max(1, Math.round(canvasInfo.height || windowInfo.windowHeight || 812));
                const dpr = getAdaptiveCanvasDpr(windowInfo);
                const ctx = canvas.getContext('2d');

                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
                ctx.scale(dpr, dpr);
                ctx.imageSmoothingEnabled = true;

                this._canvas = canvas;
                this._ctx = ctx;
                this._viewport = { width, height, dpr };

                Promise.all([
                    this._loadCanvasImage(canvas, ASSET_PATHS.background),
                    this._loadCanvasImage(canvas, ASSET_PATHS.bird),
                    this._loadCanvasImage(canvas, ASSET_PATHS.pipe)
                ]).then(([background, bird, pipe]) => {
                    if (generation !== this._loadGeneration || this._destroyed) return;

                    this._assets = { background, bird, pipe };
                    if (this._pageVisible) {
                        this._beginRound();
                    } else {
                        this._pendingRoundStart = true;
                    }
                }).catch((error) => {
                    this._handleAssetError(generation, error);
                });
            });
    },

    _loadCanvasImage(canvas, source) {
        const generation = this._loadGeneration;
        return new Promise((resolve, reject) => {
            const image = canvas.createImage();
            image.onload = () => resolve(image);
            image.onerror = () => {
                if (!this._destroyed && generation === this._loadGeneration) {
                    toolImageCache.invalidateToolImage(source, image.src);
                }
                reject(new Error(`Failed to load ${source}`));
            };
            // 复用首页的本地文件；热身图片和当前 Canvas 使用完全相同的路径。
            if (source === ASSET_PATHS.bird) {
                toolImageCache.loadToolImage(source).then((path) => {
                    if (!this._destroyed && generation === this._loadGeneration) {
                        this.setData({ birdImagePath: path });
                    }
                    image.src = path;
                }).catch(reject);
            } else {
                image.src = source;
            }
        });
    },

    _handleAssetError(generation, error) {
        if (generation !== this._loadGeneration || this._destroyed) return;
        console.warn('[Flappy] Failed to initialize game assets:', error);
        this.setData({ assetError: true });
    },

    _beginRound() {
        if (!this._canvas || !this._ctx || !this._assets || !this._viewport) return;

        this._stopLoop();
        const { width, height } = this._viewport;
        this._backgroundLayout = this._getBackgroundLayout();
        this._groundY = clamp(this._backgroundLayout.groundY, height * 0.72, height);

        const birdWidth = clamp(width * 0.165, 56, 72);
        const birdHeight = birdWidth * (this._assets.bird.height / this._assets.bird.width);
        this._bird = {
            x: width * 0.23,
            y: Math.min(height * 0.43, this._groundY - birdHeight - 90),
            width: birdWidth,
            height: birdHeight,
            velocity: 0
        };

        this._pipeWidth = clamp(width * 0.19, 64, 82);
        this._pipeGap = clamp(height * 0.22, 145, 190);
        this._gravity = clamp(height * 1.85, 1250, 1650);
        this._flapVelocity = -clamp(height * 0.56, 380, 480);
        this._bird.velocity = this._flapVelocity * 0.78;
        this._pipes = [];
        this._spawnCountdown = 1.05;
        this._score = 0;
        this._roundStartedAt = Date.now();
        this._lastFrameAt = 0;
        this._pausedAt = 0;
        this._running = true;

        this.setData({
            gameState: 'playing',
            score: 0,
            finalScore: 0,
            showTapHint: true,
            assetError: false
        });

        this._drawFrame();
        this._scheduleFrame();
    },

    _getBackgroundLayout() {
        const image = this._assets.background;
        const { width, height } = this._viewport;
        const scale = Math.max(width / image.width, height / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        return {
            x,
            y,
            width: drawWidth,
            height: drawHeight,
            groundY: y + drawHeight * GROUND_START_RATIO
        };
    },

    _scheduleFrame() {
        if (!this._running || !this._canvas) return;

        if (!this._boundFrame) {
            this._boundFrame = (timestamp) => this._onFrame(timestamp);
        }

        if (typeof this._canvas.requestAnimationFrame === 'function') {
            this._frameKind = 'canvas';
            this._frameHandle = this._canvas.requestAnimationFrame(this._boundFrame);
        } else {
            this._frameKind = 'timer';
            this._frameHandle = setTimeout(() => this._boundFrame(Date.now()), 16);
        }
    },

    _stopLoop() {
        this._running = false;
        if (this._frameHandle == null) return;

        if (this._frameKind === 'canvas' && this._canvas && typeof this._canvas.cancelAnimationFrame === 'function') {
            this._canvas.cancelAnimationFrame(this._frameHandle);
        } else {
            clearTimeout(this._frameHandle);
        }
        this._frameHandle = null;
    },

    _onFrame(timestamp) {
        this._frameHandle = null;
        if (!this._running || this.data.gameState !== 'playing') return;

        const frameAt = typeof timestamp === 'number' ? timestamp : Date.now();
        let deltaSeconds = this._lastFrameAt ? (frameAt - this._lastFrameAt) / 1000 : 0;
        this._lastFrameAt = frameAt;
        deltaSeconds = clamp(deltaSeconds, 0, 0.034);

        this._advanceGame(deltaSeconds);
        if (!this._running || this.data.gameState !== 'playing') return;
        this._drawFrame();

        if (this._running && this.data.gameState === 'playing') {
            this._scheduleFrame();
        }
    },

    _advanceGame(deltaSeconds) {
        const { width } = this._viewport;
        const bird = this._bird;

        bird.velocity = Math.min(bird.velocity + this._gravity * deltaSeconds, 760);
        bird.y += bird.velocity * deltaSeconds;

        const elapsedMilliseconds = Date.now() - this._roundStartedAt;
        const nextScore = calculateScore(elapsedMilliseconds);
        if (nextScore !== this._score) {
            this._score = nextScore;
        }

        const survivalSeconds = elapsedMilliseconds / 1000;
        const speedRatio = 0.34 + Math.min(survivalSeconds, 40) * 0.0025;
        const pipeSpeed = width * speedRatio;
        this._pipes.forEach((pipe) => {
            pipe.x -= pipeSpeed * deltaSeconds;
        });
        this._pipes = this._pipes.filter((pipe) => pipe.x + this._pipeWidth > -8);

        this._spawnCountdown -= deltaSeconds;
        if (this._spawnCountdown <= 0) {
            this._spawnPipe();
            const targetSpacing = Math.max(width * 0.54, this._pipeWidth * 2.7);
            this._spawnCountdown += targetSpacing / pipeSpeed;
        }

        if (this._hasCollision()) {
            this._finishRound();
        }
    },

    _spawnPipe() {
        const { width, height } = this._viewport;
        const halfGap = this._pipeGap / 2;
        const topSafe = Math.max(76, this.data.hudTop + 88);
        const minimumCenter = Math.max(topSafe, halfGap + 46);
        const maximumCenter = Math.max(minimumCenter + 1, this._groundY - halfGap - 58);
        const gapCenter = minimumCenter + Math.random() * (maximumCenter - minimumCenter);

        this._pipes.push({
            x: width + this._pipeWidth + 4,
            gapTop: clamp(gapCenter - halfGap, 42, height),
            gapBottom: clamp(gapCenter + halfGap, 42, this._groundY - 24)
        });
    },

    _hasCollision() {
        const bird = this._bird;
        const hitbox = {
            left: bird.x + bird.width * 0.08,
            right: bird.x + bird.width * 0.92,
            top: bird.y + bird.height * 0.1,
            bottom: bird.y + bird.height * 0.9
        };

        if (hitbox.top <= 0 || hitbox.bottom >= this._groundY) return true;

        return this._pipes.some((pipe) => {
            const overlapsHorizontally = hitbox.right > pipe.x && hitbox.left < pipe.x + this._pipeWidth;
            if (!overlapsHorizontally) return false;
            return hitbox.top < pipe.gapTop || hitbox.bottom > pipe.gapBottom;
        });
    },

    _finishRound() {
        if (this.data.gameState !== 'playing') return;

        this._stopLoop();

        const elapsedScore = calculateScore(Date.now() - this._roundStartedAt);
        const finalScore = Math.max(this._score, elapsedScore);
        const bestScore = Math.max(this.data.bestScore || 0, finalScore);
        const isNewBest = bestScore !== this.data.bestScore;
        this._score = finalScore;

        // 优先切换页面状态：WXML 会立刻移除 Canvas 并挂载普通结果页。
        this.setData({
            gameState: 'gameOver',
            score: finalScore,
            finalScore,
            bestScore,
            showTapHint: false
        });

        if (isNewBest) {
            try {
                wx.setStorageSync(BEST_SCORE_STORAGE_KEY, bestScore);
            } catch (e) {
                console.warn('[Flappy] Failed to save best score:', e);
            }
        }

        try {
            if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
        } catch (e) { }
    },

    _drawFrame() {
        if (!this._ctx || !this._assets || !this._viewport || !this._bird) return;

        const ctx = this._ctx;
        const { width, height } = this._viewport;
        const background = this._backgroundLayout;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(
            this._assets.background,
            background.x,
            background.y,
            background.width,
            background.height
        );

        this._pipes.forEach((pipe) => {
            this._drawPipe(pipe.x, -2, pipe.gapTop + 2, true);
            this._drawPipe(pipe.x, pipe.gapBottom, this._groundY - pipe.gapBottom + 2, false);
        });

        this._drawBird();
        this._drawScoreHud();
    },

    _drawScoreHud() {
        const ctx = this._ctx;
        const label = (this.data.uiCopy && this.data.uiCopy.score) || '得分';
        const scoreText = String(this._score || 0);
        const x = 16;
        const y = this.data.hudTop || 116;
        const height = 70;

        ctx.save();
        ctx.textBaseline = 'top';
        ctx.font = '900 32px "DIN Alternate", "Arial Black", sans-serif';
        const scoreWidth = ctx.measureText(scoreText).width;
        const availableWidth = Math.max(92, this._viewport.width - x * 2);
        const width = Math.min(availableWidth, Math.max(92, scoreWidth + 24));

        this._roundedRectPath(ctx, x + 5, y + 5, width, height, 10);
        ctx.fillStyle = '#000000';
        ctx.fill();

        this._roundedRectPath(ctx, x, y, width, height, 10);
        ctx.fillStyle = '#FFFDE7';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.globalAlpha = 0.6;
        ctx.font = '900 11px "Courier New", Courier, monospace';
        ctx.fillText(label, x + 12, y + 9);

        ctx.globalAlpha = 1;
        ctx.font = '900 32px "DIN Alternate", "Arial Black", sans-serif';
        ctx.fillText(scoreText, x + 12, y + 27);
        ctx.restore();
    },

    _roundedRectPath(ctx, x, y, width, height, radius) {
        const safeRadius = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + safeRadius, y);
        ctx.lineTo(x + width - safeRadius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
        ctx.lineTo(x + width, y + height - safeRadius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
        ctx.lineTo(x + safeRadius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
        ctx.lineTo(x, y + safeRadius);
        ctx.quadraticCurveTo(x, y, x + safeRadius, y);
        ctx.closePath();
    },

    _drawPipe(x, y, height, flipped) {
        if (height <= 1) return;

        const ctx = this._ctx;
        const image = this._assets.pipe;
        const width = this._pipeWidth;
        const sourceCapHeight = Math.round(image.height * 0.137);
        const capHeight = Math.min(height, width * sourceCapHeight / image.width);
        const bodyHeight = Math.max(0, height - capHeight + 1);

        ctx.save();
        if (flipped) {
            ctx.translate(x + width, y + height);
            ctx.rotate(Math.PI);
        } else {
            ctx.translate(x, y);
        }

        if (bodyHeight > 0) {
            ctx.drawImage(
                image,
                0,
                sourceCapHeight,
                image.width,
                image.height - sourceCapHeight,
                0,
                capHeight - 1,
                width,
                bodyHeight
            );
        }
        ctx.drawImage(
            image,
            0,
            0,
            image.width,
            sourceCapHeight,
            0,
            0,
            width,
            capHeight
        );
        ctx.restore();
    },

    _drawBird() {
        const bird = this._bird;
        const angle = clamp(bird.velocity / 700, -0.45, 1.05);
        const ctx = this._ctx;

        ctx.save();
        ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
        ctx.rotate(angle);
        ctx.drawImage(
            this._assets.bird,
            -bird.width / 2,
            -bird.height / 2,
            bird.width,
            bird.height
        );
        ctx.restore();
    },

    _readBestScore() {
        try {
            const stored = Number(wx.getStorageSync(BEST_SCORE_STORAGE_KEY));
            return isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
        } catch (e) {
            return 0;
        }
    },

    _syncI18n() {
        const locale = i18n.getAppLocale();
        this.setData({
            locale,
            uiCopy: i18n.getPageCopy('flappy', locale)
        });
        i18n.setNavigationBarTitle('flappy.navTitle', locale);
    },

    _calculateNavLayout() {
        try {
            const menuButton = wx.getMenuButtonBoundingClientRect();
            const navTop = menuButton && menuButton.top > 0 ? menuButton.top : 44;
            const menuHeight = menuButton && menuButton.height > 0 ? menuButton.height : 32;
            this.setData({
                navTop,
                rulesTop: navTop + menuHeight + 30,
                hudTop: navTop + menuHeight + 36
            });
        } catch (e) {
            this.setData({ navTop: 44, rulesTop: 112, hudTop: 112 });
        }
    },

    _setTabBarHidden(hidden) {
        const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
        if (tabBar) {
            tabBar.setData({ hidden, blurred: false });
        }
    },

    _reportGamePlay() {
        const app = getApp();
        if (app && typeof app.addGameStat === 'function') {
            app.addGameStat('flappy');
        }
    },

    onShareAppMessage() {
        return {
            title: this.data.uiCopy.shareTitle || '像素鸟｜来比比谁更能苟',
            path: '/pages/tool-flappy/index'
        };
    },

    onShareTimeline() {
        return {
            title: this.data.uiCopy.timelineTitle || '像素鸟：会跳的小鸟来咯',
            query: ''
        };
    }
});
