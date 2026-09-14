const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../cloudfunctions/roomManager/index.js'), 'utf8');

// Exercise the real transaction handlers with an in-memory database and controlled server clock.
function fixture(overrides = {}) {
    let now = 10000;
    const state = {
        phase: 'link', version: 1, stateRevision: 1, roundToken: 'round',
        playerOrder: ['a', 'b'], currentTurnIndex: 0, currentPlayerOpenId: 'a', activePlayerOpenId: 'a',
        players: ['a', 'b'].map((openId, i) => ({ openId, seat: i + 1, drinkCount: 0, toiletCards: 0, cameraCards: 1 })),
        remainingCards: 10, effect: { type: 'link', sourceOpenId: 'a' }, deadlineAt: 15000,
        linkBoard: ['A', 'A', 'B', 'B'].map((code, id) => ({ id, code, removed: false })),
        cpPairs: [], ...overrides
    };
    const room = { roomId: 'room', gameType: 'queen', members: [{ openId: 'a' }, { openId: 'b' }], gameState: state };
    const secret = { roundToken: 'round', deck: [{ rank: '6', id: 'six' }, { rank: '6', id: 'six2' }], drawIndex: 0 };
    const db = { runTransaction: async fn => fn({ collection: name => ({ doc: () => ({
        get: async () => ({ data: structuredClone(name === 'GameRoom' ? room : secret) }),
        update: async ({ data }) => Object.assign(name === 'GameRoom' ? room : secret, data)
    }) }) }) };
    const context = vm.createContext({
        require: name => name === 'wx-server-sdk' ? {} : require(name), exports: {},
        console: { log() {}, warn() {}, error() {} },
        Date: class extends Date { static now() { return now; } }, __db: db
    });
    vm.runInContext(source + '\n db = __db; _ = { set: value => value }; resolveRoomDocumentId = async () => "doc"; globalThis.api = { handleQueenAction, handleQueenTimeout };', context);
    return {
        room, advance: ms => { now += ms; },
        action: (type, payload = {}, who = 'a', version = room.gameState.version) => context.api.handleQueenAction(who, 'room', type, payload, version, 'doc'),
        timeout: (version = room.gameState.version, deadline = room.gameState.deadlineAt) => context.api.handleQueenTimeout('b', 'room', version, 'link', deadline, 'doc')
    };
}

test('drawing a six starts a five-second deadline', async () => {
    const f = fixture({ phase: 'normal', deadlineAt: 0 });
    const r = await f.action('draw');
    assert.equal(r.success, true);
    assert.equal(r.state.phase, 'link');
    assert.equal(r.state.deadlineAt, 15000);
});

test('valid pair before expiry gives the next player five fresh seconds', async () => {
    const f = fixture(); f.advance(4999);
    const r = await f.action('linkPick', { firstCellId: 0, secondCellId: 1 });
    assert.equal(r.state.activePlayerOpenId, 'b');
    assert.equal(r.state.deadlineAt, 19999);
    const oldTimeout = await f.timeout(1, 15000);
    assert.equal(oldTimeout.stale, true);
    assert.equal(f.room.gameState.players[0].drinkCount, 0);
});

test('timeout is rejected early and settles exactly once at the deadline', async () => {
    const f = fixture(); f.advance(4999);
    assert.equal((await f.timeout()).tooEarly, true);
    f.advance(1);
    const r = await f.timeout();
    assert.equal(r.state.resultEvent.effect.type, 'linkLose');
    assert.equal(r.state.players[0].drinkCount, 1);
    assert.equal(r.state.deadlineAt, 0);
    assert.equal((await f.timeout(1, 15000)).stale, true);
    assert.equal(f.room.gameState.players[0].drinkCount, 1);
});

for (const action of ['linkPick', 'cameraTrigger']) test(`late ${action} cannot bypass timeout`, async () => {
    const f = fixture(); f.advance(5000);
    const r = await f.action(action, { firstCellId: 0, secondCellId: 1 });
    assert.equal(r.state.resultEvent.effect.type, 'linkLose');
    assert.equal(r.state.players[0].drinkCount, 1);
    assert.equal(r.state.players[0].cameraCards, 1);
});

test('timeout retains CP penalties and toilet-card cancellation', async () => {
    const f = fixture({ cpPairs: [{ a: 'a', b: 'b' }] });
    f.room.gameState.players[0].toiletCards = 1;
    f.advance(5000);
    const r = await f.timeout();
    assert.equal(r.state.phase, 'toiletPrompt');
    assert.equal(r.state.players[0].drinkCount, 1);
    assert.equal(r.state.players[1].drinkCount, 1);
    const settled = await f.action('toiletBlock', { promptAt: r.state.effect.at });
    assert.equal(settled.state.players[0].drinkCount, 0);
    assert.equal(settled.state.players[1].drinkCount, 1);
    assert.equal(settled.state.resultEvent.effect.type, 'linkLose');
});

test('camera interruption resumes the remaining time after result display', async () => {
    const f = fixture(); f.advance(2000);
    await f.action('cameraTrigger');
    await f.action('cameraPress', {}, 'a');
    const r = await f.action('cameraPress', {}, 'b');
    assert.equal(r.state.phase, 'link');
    assert.equal(r.state.deadlineAt - r.state.nextActionAt, 3000);
});

test('clearing the board ends without a timeout penalty', async () => {
    const f = fixture({ linkBoard: [{ id: 0, code: 'A' }, { id: 1, code: 'A' }] });
    const r = await f.action('linkPick', { firstCellId: 0, secondCellId: 1 });
    assert.equal(r.state.resultEvent.effect.type, 'linkCleared');
    assert.equal(r.state.players[0].drinkCount, 0);
    assert.equal(r.state.deadlineAt, 0);
});

function clientFixture() {
    let component;
    let now = 10000;
    let nextTimer = 1;
    const timers = new Map();
    const context = vm.createContext({
        require: () => ({}), Component: value => { component = value; },
        setInterval: fn => { const id = nextTimer++; timers.set(id, { fn, interval: true }); return id; },
        setTimeout: fn => { const id = nextTimer++; timers.set(id, { fn, interval: false }); return id; },
        clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id),
        wx: { cloud: { callFunction: async () => { throw new Error('offline'); } } }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../components/queen-game/index.js'), 'utf8'), context);
    const client = {
        ...component.methods, _isAttached: true, _isVisible: true,
        data: { isPlayer: true, myOpenId: 'b', canMiniAct: true },
        _latestState: { phase: 'link', version: 1, deadlineAt: 15000, playerOrder: ['a', 'b'] },
        _serverNow: () => now,
        setData(data) { Object.assign(this.data, data); }
    };
    return {
        client, timers, advance: ms => { now += ms; },
        async run(id) { const timer = timers.get(id); assert.ok(timer); if (!timer.interval) timers.delete(id); await timer.fn(); }
    };
}

test('client counts down, stops at zero, and retries a failed timeout request', async () => {
    const f = clientFixture(), c = f.client;
    c._scheduleDeadline(c._latestState);
    assert.equal(c.data.countdownSeconds, 5);
    f.advance(1000); await f.run(c._deadlineTimer);
    assert.equal(c.data.countdownSeconds, 4);
    f.advance(4000); await f.run(c._deadlineTimer);
    assert.equal(c.data.countdownSeconds, 0);
    assert.equal(c._deadlineTimer, null);
    const pending = c._timeoutFallback;
    c._requestTimeout(c._latestState);
    assert.equal(c._timeoutFallback, pending);
    await f.run(pending);
    assert.ok(c._timeoutFallback);
    await f.run(c._timeoutFallback);
    assert.equal(c._deadlineTimer, null);
    assert.equal(f.timers.size, 1);
    c._clearDeadline();
    assert.equal(f.timers.size, 0);
});

test('client refuses a partial selection after expiry', () => {
    const f = clientFixture(); f.advance(5000);
    f.client.pickLink({ currentTarget: { dataset: { id: 0 } } });
    assert.equal(f.client._linkSelectedCellId, undefined);
    assert.ok(f.client._timeoutFallback);
    f.client._clearDeadline();
});
