const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');

// Run the real page handlers with a controlled clock. Room calls and audio creation
// fail immediately; asset loading and the existing usage counters remain available.
function fixture(pageName) {
    let page;
    let now = 10000;
    let nextId = 0;
    const timers = new Map();
    const stats = [];
    const vibrates = [];
    const app = { globalData: { openId: 'existing-user' }, addGameStat: type => stats.push(type) };
    const forbidden = () => { throw new Error('Unexpected room network/audio operation'); };
    const wx = {
        cloud: { callFunction: forbidden, database: forbidden, downloadFile() {} },
        createWebAudioContext: forbidden, createInnerAudioContext: forbidden,
        nextTick: fn => fn(), vibrateShort: value => vibrates.push(value),
        getMenuButtonBoundingClientRect: () => ({ top: 44, bottom: 76, right: 355, width: 87 }),
        getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812, pixelRatio: 2 }),
        getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 812, pixelRatio: 2 }),
        setNavigationBarTitle() {}, getStorageSync() { return ''; }, setStorageSync() {},
        startAccelerometer: ({ success }) => success && success(), onAccelerometerChange() {},
        stopAccelerometer: ({ success }) => success && success(), offAccelerometerChange() {},
        showToast() {}, navigateBack() {}, switchTab() {}
    };
    const schedule = (fn, ms, repeat) => {
        const id = ++nextId;
        timers.set(id, { fn, at: now + ms, repeat: repeat ? ms : 0 });
        return id;
    };
    const filename = path.join(root, 'pages', pageName, 'index.js');
    const actualRequire = createRequire(filename);
    const i18n = actualRequire('../../utils/i18n');
    const context = vm.createContext({
        Page: value => { page = value; }, wx, getApp: () => app, getCurrentPages: () => [page],
        require: name => name === '../../utils/i18n'
            ? { ...i18n, getAppLocale: () => 'zh-Hans', setNavigationBarTitle() {} }
            : name === '../../utils/tool_image_cache'
                ? { getCachedToolImage: url => url, loadToolImage: async url => url }
                : actualRequire(name),
        console: { log() {}, warn() {}, error() {} },
        Date: class extends Date { static now() { return now; } },
        setTimeout: (fn, ms) => schedule(fn, ms, false),
        setInterval: (fn, ms) => schedule(fn, ms, true),
        clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id)
    });
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    page.data = structuredClone(page.data);
    page.setData = (patch, done) => {
        for (const [key, value] of Object.entries(patch)) {
            const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
            let target = page.data;
            parts.slice(0, -1).forEach(part => { target = target[part]; });
            target[parts.at(-1)] = value;
        }
        if (done) done();
    };
    page.createSelectorQuery = () => {
        const query = { select: () => query, boundingClientRect: () => query, exec: fn => fn && fn([]) };
        return query;
    };
    function advance(ms) {
        const end = now + ms;
        let budget = 10000;
        while (budget-- > 0) {
            const entry = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!entry) { now = end; return; }
            const [id, timer] = entry;
            now = timer.at;
            if (timer.repeat) timer.at += timer.repeat;
            else timers.delete(id);
            timer.fn();
        }
        throw new Error('Timer loop did not settle');
    }
    return { page, advance, stats, vibrates };
}

for (const name of ['tool-oldman', 'tool-drunk']) {
    test(`${name}: legacy invitations, sharing and resume never join or create rooms`, () => {
        const f = fixture(name);
        f.page.onLoad({ hostId: 'legacy-room', roomId: 'legacy-room' });
        f.page.onShow();
        assert.equal(f.page.onShareAppMessage().path, `/pages/${name}/index`);
        f.page.onHide();
        f.advance(35000);
        f.page.onShow();
        f.page.onUnload();
        assert.equal(f.stats.length, 1);
    });
}

test('oldman: misses, final target, result and next round still work', () => {
    const f = fixture('tool-oldman'), p = f.page;
    p.onLoad({});
    assert.equal(p.data.oldmen.length, 16);
    const target = p.data.targetIndex;
    for (let index = 0; index < 16; index++) {
        if (index !== target) p.onTapOldman({ currentTarget: { dataset: { index } } });
    }
    assert.equal(p.data.remainingCount, 1);
    f.advance(1000);
    assert.equal(p.data.showResult, true);
    p.onCloseResult(); f.advance(1500);
    assert.equal(p.data.gameState, 'playing');
    assert.equal(p.data.remainingCount, 16);
    assert.equal(p.data.round, 1);
    assert.ok(f.vibrates.length > 0);
});

test('drunk: solo scoring, retry and interrupted test retain their behavior', () => {
    const f = fixture('tool-drunk'), p = f.page;
    p.onLoad({}); p.onStartTest();
    p._accelerometerData = [0, 0, 0, 0]; f.advance(3100);
    assert.equal(p.data.gameState, 'RESULT');
    assert.equal(p.data.resultType, 'sober');
    p.onPageTap(); p.onStartTest();
    p._accelerometerData = [30, 30, 30, 30]; f.advance(3100);
    assert.equal(p.data.resultType, 'drunk');
    assert.ok(p.data.finalShakePercent >= 66);
    p.onPageTap(); p.onStartTest(); p.onHide(); p.onShow();
    assert.equal(p.data.gameState, 'IDLE');
});

test('dice: silent roll retains covered score and valid dice for each count', () => {
    for (let count = 1; count <= 6; count++) {
        const f = fixture('tool-dice'), p = f.page;
        p.onDiceCountChange({ currentTarget: { dataset: { count } } });
        p.rollDice(); f.advance(700);
        assert.equal(p.data.isRolling, false);
        assert.equal(p.data.diceValues.length, count);
        assert.ok(p.data.diceValues.every(v => v >= 1 && v <= 6));
        assert.equal(p.data.totalScore, p.data.diceValues.reduce((a, b) => a + b, 0));
        assert.equal(p.data.displayScore, '?');
        assert.equal(p.data.showCover, true);
    }
});

test('bottle: silent spin finishes in three seconds and supports the next round', () => {
    const f = fixture('tool-bottle'), p = f.page;
    p.onLoad(); p.onBottleTap();
    assert.equal(p.data.isSpinning, true);
    f.advance(3000);
    assert.equal(p.data.showResult, true);
    assert.equal(p.data.bottleRotation % 360, p.data.resultRotation);
    p.onNextRound(); assert.equal(p.data.showResult, false);
});

test('fingerpress: silent selection and elimination produce one result', () => {
    const f = fixture('tool-fingerpress'), p = f.page;
    p.onLoad();
    p.updateFingers([{ identifier: 1, clientX: 80, clientY: 100 }, { identifier: 2, clientX: 240, clientY: 100 }]);
    p.onStartZoneTap(); f.advance(10000);
    assert.equal(p.data.gameState, 'RESULT');
    assert.equal(p.data.fingers.length, 1);
});

test('countdown: countdown completes without audio and enters the chosen mode', () => {
    const f = fixture('tool-countdown'), p = f.page;
    p.onLoad(); p.onStartGame(); f.advance(5000);
    assert.equal(p.data.gameState, 'WAITING');
    f.advance(1500);
    assert.equal(p.data.gameState, 'TOUCH_PHASE');
    p.onUnload();
});

test('flappy: tapping still changes bird velocity without sound', () => {
    const f = fixture('tool-flappy'), p = f.page;
    p.data.gameState = 'playing'; p._running = true;
    p._bird = { velocity: 30 }; p._flapVelocity = -400;
    p.onCanvasTouch();
    assert.equal(p._bird.velocity, -400);
});

test('poker: all legacy online links and selections stay on flower', () => {
    for (const game of ['tenhalf', 'queen', 'ninegrid', 'coward']) {
        const f = fixture('profile'), p = f.page;
        p.onLoad({ game, hostId: 'legacy-host' });
        assert.deepEqual(Array.from(p.data.gameList), ['flower']);
        assert.equal(p.data.activeGame, 'flower');
        p.selectGame({ currentTarget: { dataset: { game } } });
        assert.equal(p.data.activeGame, 'flower');
        assert.equal(p.onShareAppMessage().path, '/pages/profile/index');
    }
});

test('flower: all petal counts can draw through the deck and restart', () => {
    for (const count of [2, 4, 6]) {
        const f = fixture('profile'), p = f.page;
        p.onLoad(); p._startFlowerGame(count); p.closeSelector();
        assert.equal(p.data.petals.length, count);
        assert.equal(p.data.deckRemaining, 108 - count);
        let turns = 0;
        while (!p.data.deckFinished && turns++ < 240) {
            if (p.data.showDrawOverlay) p.onDrawOverlayTap();
            else p.onPetalTap({ currentTarget: { dataset: { index: turns % count } } });
            f.advance(1000);
        }
        assert.equal(p.data.deckFinished, true);
        p.restartFlower();
        assert.equal(p.data.deckFinished, false);
        assert.equal(p.data.deckRemaining, 108 - count);
    }
});

test('customized templates have balanced elements and no room UI or handlers', () => {
    for (const name of ['tool-oldman', 'tool-drunk', 'profile']) {
        const template = fs.readFileSync(path.join(root, 'pages', name, 'index.wxml'), 'utf8');
        const source = fs.readFileSync(path.join(root, 'pages', name, 'index.js'), 'utf8');
        const stack = [];
        const tags = template.replace(/<!--[\s\S]*?-->/g, '').match(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g) || [];
        for (const tag of tags) {
            const match = tag.match(/^<(\/?)([\w:-]+)/);
            if (!match || /\/\s*>$/.test(tag)) continue;
            if (match[1]) assert.equal(stack.pop(), match[2], `${name}: ${tag}`);
            else stack.push(match[2]);
        }
        assert.equal(stack.length, 0, `${name}: unclosed tags`);
        assert.ok(!/roomManager|GameRoom|hostId|isOnlineMode|share-hint|share-arrow/.test(template + source));
        for (const match of template.matchAll(/(?:bind|catch)(?::?[\w]+)="([a-zA-Z_]\w*)"/g)) {
            assert.ok(new RegExp('\\b' + match[1] + '\\(').test(source), `${name}: ${match[1]}`);
        }
    }
    for (const name of ['dice', 'bottle', 'fingerpress', 'countdown', 'oldman', 'drunk', 'flappy']) {
        const source = fs.readFileSync(path.join(root, 'pages', 'tool-' + name, 'index.js'), 'utf8');
        assert.ok(!/createWebAudioContext|createInnerAudioContext|createAudioContext|playBackgroundAudio/.test(source));
    }
});

test('finger: exactly 30 original games, without repeats until the next round', () => {
    const { page } = fixture('finger');
    page._initGamePool();
    assert.equal(page.remainingPool.length, 30);
    const key = item => item.type === 'text' ? `text:${item.id}` : `image:${item.index}`;
    const expected = [...Array.from({ length: 27 }, (_, i) => `text:${i}`),
        ...Array.from({ length: 3 }, (_, i) => `image:${i}`)].sort();
    for (let round = 0; round < 3; round++) {
        const drawn = Array.from({ length: 30 }, () => page._getRandomItem());
        assert.deepEqual(drawn.map(key).sort(), expected);
        assert.equal(page.remainingPool.length, 0);
    }
});
