const cloud = require('wx-server-sdk');
const crypto = require('crypto');

const TEN_HALF_SECRET_COLLECTION = 'TenHalfSecret';
const TEN_HALF_PRESENCE_COLLECTION = 'TenHalfPresence';
const COWARD_HAND_COLLECTION = 'CowardHand';
const QUEEN_SECRET_COLLECTION = 'QueenSecret';
const TEN_HALF_MAX_MEMBERS = 6;
const QUEEN_MAX_MEMBERS = 6;
const NINE_GRID_MAX_MEMBERS = 6;
const COWARD_MAX_MEMBERS = 6;
const TEN_HALF_STALE_MEMBER_MS = 180000;
// 胆小鬼的下一轮必须等全员拍桌，离线成员需要更快退出当前对局。
// 客户端仍维持 12 秒一次心跳，不因此增加数据库写入频率。
const COWARD_STALE_MEMBER_MS = 45000;
const TEN_HALF_TURN_MS = 10000;
const TEN_HALF_DEAL_MS = 2700;
const TEN_HALF_RESULT_MS = 1400;
const QUEEN_TURN_MS = 5000;
const QUEEN_MEDUSA_MS = 10000;
const QUEEN_RESULT_MS = 2600;
const QUEEN_LINK_SIDE = 6;
const QUEEN_LINK_CODES = 'ABCDEFGHIJKLMNOPQR'.split('');
const QUEEN_MINE_SIDE = 7;
const QUEEN_MINE_CELL_COUNT = QUEEN_MINE_SIDE * QUEEN_MINE_SIDE;
// 延续原 5 / 25 的雷区密度，扩大棋盘后取最接近的 10 / 49。
const QUEEN_MINE_BOMB_COUNT = 10;
const COWARD_REVEAL_WAIT_MS = 5000;
const COWARD_READY_COUNTDOWN_MS = 3000;
const COWARD_STOP_WINDOW_MS = 10000;

function realtimeStaleMemberMs(gameType) {
    return gameType === 'coward' ? COWARD_STALE_MEMBER_MS : TEN_HALF_STALE_MEMBER_MS;
}

// 懒加载初始化
let initialized = false;
let db = null;
let _ = null; // database command

function ensureInit() {
    if (!initialized) {
        cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
        db = cloud.database();
        _ = db.command; // 在初始化后获取 command
        initialized = true;
    }
}

/**
 * 生成6位房间ID
 * 使用大写字母和数字，排除容易混淆的字符 (0, O, I, 1, L)
 */
function generateRoomId() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
}

function bumpTenHalfStateRevision(state) {
    const target = state || {};
    const revision = Number(target.stateRevision);
    const version = Number(target.version);
    target.stateRevision = Math.max(
        Number.isFinite(revision) ? revision : 0,
        Number.isFinite(version) ? version : 0
    ) + 1;
    return target;
}

function createInitialGameState(gameType) {
    if (gameType === 'tenhalf') {
        return {
            gameKind: 'tenhalf',
            phase: 'waiting',
            version: 0,
            stateRevision: 0,
            round: 0,
            memberLastActive: {}
        };
    }
    if (gameType === 'queen') {
        return {
            gameKind: 'queen',
            phase: 'waiting',
            version: 0,
            stateRevision: 0,
            round: 0
        };
    }
    if (gameType === 'ninegrid') {
        return {
            gameKind: 'ninegrid',
            phase: 'waiting',
            version: 0,
            stateRevision: 0,
            round: 0
        };
    }
    if (gameType === 'coward') {
        return {
            gameKind: 'coward',
            phase: 'waiting',
            version: 0,
            stateRevision: 0,
            round: 0
        };
    }
    return {};
}

function resetQueenGameState(currentState) {
    const state = currentState || {};
    return bumpTenHalfStateRevision({
        gameKind: 'queen',
        phase: 'waiting',
        version: (state.version || 0) + 1,
        stateRevision: state.stateRevision,
        round: state.round || 0
    });
}

function resetNineGridGameState(currentState) {
    const state = currentState || {};
    return bumpTenHalfStateRevision({
        gameKind: 'ninegrid',
        phase: 'waiting',
        version: (state.version || 0) + 1,
        stateRevision: state.stateRevision,
        round: state.round || 0
    });
}

function resetCowardGameState(currentState) {
    const state = currentState || {};
    return bumpTenHalfStateRevision({
        gameKind: 'coward',
        phase: 'waiting',
        version: (state.version || 0) + 1,
        stateRevision: state.stateRevision,
        round: state.round || 0
    });
}

function resetTenHalfGameState(currentState, removedOpenId) {
    const state = currentState || {};
    const activeMap = { ...(state.memberLastActive || {}) };
    if (removedOpenId) delete activeMap[removedOpenId];
    return bumpTenHalfStateRevision({
        gameKind: 'tenhalf',
        phase: 'waiting',
        version: (state.version || 0) + 1,
        stateRevision: state.stateRevision,
        round: state.round || 0,
        memberLastActive: activeMap
    });
}

function shouldResetTenHalfAfterExit(room, departedOpenId) {
    const state = room && room.gameState || {};
    return room && room.gameType === 'tenhalf' &&
        state.gameKind === 'tenhalf' && state.phase !== 'waiting' &&
        (state.playerOrder || []).includes(departedOpenId);
}

function shouldResetQueenAfterExit(room, departedOpenId) {
    const state = room && room.gameState || {};
    return room && room.gameType === 'queen' &&
        state.gameKind === 'queen' && state.phase !== 'waiting' &&
        (state.playerOrder || []).includes(departedOpenId);
}

function shouldResetNineGridAfterExit(room, departedOpenId) {
    const state = room && room.gameState || {};
    return room && room.gameType === 'ninegrid' &&
        state.gameKind === 'ninegrid' && state.phase !== 'waiting' &&
        (state.playerOrder || []).includes(departedOpenId);
}

function shouldResetCowardAfterExit(room, departedOpenId) {
    const state = room && room.gameState || {};
    return room && room.gameType === 'coward' &&
        state.gameKind === 'coward' && state.phase !== 'waiting' &&
        (state.playerOrder || []).includes(departedOpenId);
}

function tenHalfSecretId(roomId) {
    return 'tenhalf_' + crypto.createHash('sha256').update(String(roomId)).digest('hex').slice(0, 32);
}

function queenSecretId(roomId) {
    return 'queen_' + crypto.createHash('sha256').update(String(roomId)).digest('hex').slice(0, 32);
}

function cowardSecretId(roomId) {
    return 'coward_' + crypto.createHash('sha256').update(String(roomId)).digest('hex').slice(0, 32);
}

function cowardHandId(roomId, ownerOpenId) {
    return 'coward_hand_' + crypto.createHash('sha256')
        .update(String(roomId) + '|' + String(ownerOpenId))
        .digest('hex')
        .slice(0, 32);
}

async function removeCowardRoundStorageInTransaction(transaction, roomId, playerOrder) {
    await transaction.collection(TEN_HALF_SECRET_COLLECTION).doc(cowardSecretId(roomId)).remove();
    for (const ownerOpenId of playerOrder || []) {
        await transaction.collection(COWARD_HAND_COLLECTION)
            .doc(cowardHandId(roomId, ownerOpenId))
            .remove();
    }
}

async function removeCowardSecret(roomId) {
    if (!roomId) return;
    try {
        await db.collection(TEN_HALF_SECRET_COLLECTION).doc(cowardSecretId(roomId)).remove();
    } catch (error) {
        // 私密文档不存在时也视为清理完成。
    }
    try {
        await db.collection(COWARD_HAND_COLLECTION).where({ roomId: roomId }).remove();
    } catch (error) {
        // 独立手牌文档不存在时也视为清理完成。
    }
}

async function updateQueenSecretState(transaction, roomId, secret, now, fields) {
    // document.get() 返回的数据会携带 _id；_id 是系统主键，绝不能原样 set 回文档。
    // 这里只回写当前操作实际修改过的业务字段，避免无关操作反复读写整份秘密数据。
    const requested = new Set(Array.isArray(fields) ? fields : []);
    if (!requested.size) return;
    const data = { updatedTime: now };
    if (requested.has('deck')) {
        data.deck = _.set(Array.isArray(secret.deck) ? secret.deck : []);
    }
    if (requested.has('drawIndex')) {
        data.drawIndex = Math.max(0, Number(secret.drawIndex) || 0);
    }
    if (requested.has('mineBombs')) {
        data.mineBombs = _.set(Array.isArray(secret.mineBombs) ? secret.mineBombs : []);
    }
    if (requested.has('medusaChoices')) {
        data.medusaChoices = _.set(
            secret.medusaChoices && typeof secret.medusaChoices === 'object'
                ? secret.medusaChoices
                : {}
        );
    }
    await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).update({
        data: data
    });
}

function tenHalfDebugRoom(roomId) {
    if (!roomId) return '未知';
    return crypto.createHash('sha256').update(String(roomId)).digest('hex').slice(0, 8);
}

function tenHalfDebug(message, roomId, details) {
    console.log('[十点半调试] ' + message, {
        '房间摘要': tenHalfDebugRoom(roomId),
        ...(details || {})
    });
}

function queenDebug(message, roomId, requestId, details) {
    console.log('[大姐牌调试] ' + message, {
        '请求标识': requestId || '无',
        '房间摘要': tenHalfDebugRoom(roomId),
        ...(details || {})
    });
}

function cowardDebugPlayer(openId) {
    if (!openId) return '未知';
    return crypto.createHash('sha256').update(String(openId)).digest('hex').slice(0, 8);
}

function cowardDebug(message, roomId, details) {
    console.log('[胆小鬼调试] ' + message, {
        '房间摘要': tenHalfDebugRoom(roomId),
        ...(details || {})
    });
}

async function removeTenHalfSecret(roomId) {
    if (!roomId) return;
    try {
        await db.collection(TEN_HALF_SECRET_COLLECTION).doc(tenHalfSecretId(roomId)).remove();
    } catch (error) {
        // 私密文档不存在时也视为清理完成。
    }
}

async function removeQueenSecret(roomId) {
    if (!roomId) return;
    try {
        await db.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).remove();
    } catch (error) {
        // 私密文档不存在时也视为清理完成。
    }
}

async function removeQueenSecretForRound(roomId, expectedRoundToken) {
    if (!roomId || !expectedRoundToken) return false;
    return await db.runTransaction(async (transaction) => {
        let secretResult;
        try {
            secretResult = await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).get();
        } catch (error) {
            return false;
        }
        const secret = secretResult && secretResult.data;
        if (!secret || secret.roundToken !== expectedRoundToken) return false;
        await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).remove();
        return true;
    });
}

function tenHalfPresenceTimestamp(value) {
    if (value instanceof Date) return value.getTime();
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeTenHalfConnectionId(value) {
    return value ? String(value).slice(0, 96) : '';
}

function withTenHalfConnection(member, gameType, connectionId) {
    const normalized = normalizeTenHalfConnectionId(connectionId);
    return (gameType === 'tenhalf' || gameType === 'queen' || gameType === 'ninegrid' || gameType === 'coward') && normalized
        ? { ...member, connectionId: normalized }
        : member;
}

function normalizeRealtimePlayerProfile(profile) {
    return {
        avatarUrl: profile && typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '',
        nickname: profile && typeof profile.nickname === 'string' ? profile.nickname.trim().slice(0, 40) : ''
    };
}

function withRealtimePlayerProfile(member, profile) {
    const normalized = normalizeRealtimePlayerProfile(profile);
    return {
        ...member,
        avatarUrl: normalized.avatarUrl || member.avatarUrl || '',
        nickname: normalized.nickname || member.nickname || ''
    };
}

async function loadRealtimePlayerProfile(openId) {
    try {
        const result = await db.collection('ViralStats')
            .where({ openId: openId })
            .field({ avatarUrl: true, nickname: true })
            .limit(1)
            .get();
        return normalizeRealtimePlayerProfile(result.data && result.data[0]);
    } catch (error) {
        console.warn('[roomManager] 读取联机玩家头像昵称失败，保留旧资料或使用默认显示:', error);
        return normalizeRealtimePlayerProfile(null);
    }
}

function isRealtimeCardGame(gameType) {
    return gameType === 'tenhalf' || gameType === 'queen' || gameType === 'ninegrid' || gameType === 'coward';
}

function realtimeCardRoomId(hostId, gameType) {
    return String(hostId || '') + '__' + String(gameType || '');
}

function realtimeCardGameMaxMembers(gameType) {
    if (gameType === 'queen') return QUEEN_MAX_MEMBERS;
    if (gameType === 'ninegrid') return NINE_GRID_MAX_MEMBERS;
    if (gameType === 'coward') return COWARD_MAX_MEMBERS;
    return TEN_HALF_MAX_MEMBERS;
}

function resetRealtimeCardGameState(gameType, currentState) {
    if (gameType === 'queen') return resetQueenGameState(currentState);
    if (gameType === 'ninegrid') return resetNineGridGameState(currentState);
    if (gameType === 'coward') return resetCowardGameState(currentState);
    return resetTenHalfGameState(currentState);
}

function tenHalfMemberActiveAt(presence, member) {
    const memberConnectionId = normalizeTenHalfConnectionId(member && member.connectionId);
    const presenceConnectionId = normalizeTenHalfConnectionId(presence && presence.connectionId);
    const presenceBelongsToCurrentConnection = !memberConnectionId || memberConnectionId === presenceConnectionId;
    const presenceActiveAt = presenceBelongsToCurrentConnection
        ? tenHalfPresenceTimestamp(presence && (presence.activeAt || presence.updatedAt))
        : 0;
    return Math.max(presenceActiveAt, Number(member && member.joinTime) || 0);
}

async function findTenHalfPresence(roomId, openId) {
    if (!roomId || !openId) return null;
    const result = await db.collection(TEN_HALF_PRESENCE_COLLECTION)
        .where({ roomId: roomId, _openid: openId })
        .limit(1)
        .get();
    return result.data && result.data[0] || null;
}

async function hasActiveRealtimePresence(room, nowValue) {
    if (!room || !isRealtimeCardGame(room.gameType)) return false;
    const members = room.members || [];
    if (!members.length) return false;
    const result = await db.collection(TEN_HALF_PRESENCE_COLLECTION)
        .where({ roomId: room.roomId })
        .limit(20)
        .get();
    const presenceByOpenId = {};
    (result.data || []).forEach((presence) => {
        if (presence && presence._openid) presenceByOpenId[presence._openid] = presence;
    });
    const now = Number(nowValue) || Date.now();
    const staleMemberMs = realtimeStaleMemberMs(room.gameType);
    return members.some((member) => {
        const activeAt = tenHalfMemberActiveAt(presenceByOpenId[member.openId], member);
        return activeAt > 0 && now - activeAt <= staleMemberMs;
    });
}

async function upsertTenHalfPresence(openId, roomId, connectionId) {
    const collection = db.collection(TEN_HALF_PRESENCE_COLLECTION);
    const existing = await findTenHalfPresence(roomId, openId);
    const data = {
        roomId: roomId,
        connectionId: normalizeTenHalfConnectionId(connectionId),
        activeAt: db.serverDate(),
        updatedAt: db.serverDate()
    };
    if (existing && existing._id) {
        await collection.doc(existing._id).update({ data: data });
        return existing._id;
    }
    const result = await collection.add({
        data: {
            _openid: openId,
            ...data
        }
    });
    return result._id;
}

function createTenHalfDeck() {
    const suits = [
        { key: 'spade', symbol: '♠', color: 'black' },
        { key: 'heart', symbol: '♥', color: 'red' },
        { key: 'diamond', symbol: '♦', color: 'red' },
        { key: 'club', symbol: '♣', color: 'black' }
    ];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    suits.forEach((suit) => {
        ranks.forEach((rank) => {
            deck.push({
                id: 'tenhalf-' + suit.key + '-' + rank,
                deckIndex: 1,
                rank: rank,
                suitKey: suit.key,
                suit: suit.symbol,
                color: suit.color,
                isJoker: false
            });
        });
    });

    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
    }
    return deck;
}

function tenHalfCardPoints(card) {
    if (!card) return 0;
    if (card.rank === 'A') return 1;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 0.5;
    const value = Number(card.rank);
    return Number.isFinite(value) ? value : 0;
}

function tenHalfDisplayPoints(points) {
    return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

/**
 * 游戏房间管理云函数（文档型数据库版本）
 * 
 * @param {Object} event
 * @param {string} event.action - 操作类型
 *   - 'create': 创建房间
 *   - 'join': 加入房间
 *   - 'sync': 同步游戏状态
 *   - 'close': 关闭房间
 *   - 'leave': 离开房间
 *   - 'get': 获取房间信息
 * @param {string} event.roomId - 房间ID (join/sync/close/leave/get时必填)
 * @param {string} event.gameType - 游戏类型 (create时必填)
 * @param {Object} event.gameState - 游戏状态数据 (sync时必填)
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    ensureInit();

    const { action, roomId, gameType, gameState } = event;
    const wxContext = cloud.getWXContext();
    const openId = wxContext.OPENID;

    if (!openId) {
        return { success: false, error: '未获取到用户身份' };
    }

    try {
        switch (action) {
            case 'create':
                return await handleCreate(openId, gameType);
            case 'createByHost':
                return await handleCreateByHost(openId, event.hostId, event.gameType, event.connectionId);
            case 'join':
                return await handleJoin(openId, roomId);
            case 'joinByHost':
                return await handleJoinByHost(openId, event.hostId, event.gameType, event.connectionId);
            case 'sync':
                return await handleSync(openId, roomId, gameState);
            case 'close':
                return await handleClose(openId, roomId, event.connectionId);
            case 'leave':
                return await handleLeave(openId, roomId, event.connectionId);
            case 'get':
                return await handleGet(roomId);
            case 'cleanup':
                return await handleCleanup();
            case 'kickStale':
                return await handleKickStale(openId, roomId, event.targetOpenId);
            case 'startRound':
                return await handleStartRound(openId, roomId);
            case 'startNewRound':
                return await handleStartNewRound(openId, roomId, event.gameType);
            case 'tenHalfStart':
                return await handleTenHalfStart(openId, roomId);
            case 'tenHalfHeartbeat':
                return await handleTenHalfHeartbeat(openId, roomId, event.connectionId);
            case 'tenHalfGetHand':
                return await handleTenHalfGetHand(openId, roomId, event.roundToken);
            case 'tenHalfAdvance':
                return await handleTenHalfAdvance(openId, roomId, event.expectedVersion);
            case 'tenHalfAction':
                return await handleTenHalfAction(
                    openId,
                    roomId,
                    event.roomDocId,
                    event.choice,
                    event.expectedRoundToken,
                    event.expectedAuctionIndex,
                    event.expectedChoiceRound,
                    event.expectedCurrentPrice
                );
            case 'tenHalfTimeout':
                return await handleTenHalfTimeout(
                    openId,
                    roomId,
                    event.roomDocId,
                    event.expectedVersion,
                    event.expectedRoundToken,
                    event.expectedAuctionIndex,
                    event.expectedChoiceRound,
                    event.expectedDeadlineAt
                );
            case 'tenHalfRoll':
                return await handleTenHalfRoll(openId, roomId);
            case 'tenHalfFinishRound':
                return await handleTenHalfFinishRound(openId, roomId, event.expectedVersion);
            case 'queenStart':
                return await handleQueenStart(openId, roomId, event.roomDocId, event.debugRequestId);
            case 'queenAction':
                return await handleQueenAction(
                    openId,
                    roomId,
                    event.actionType,
                    event.payload || {},
                    event.expectedVersion,
                    event.roomDocId,
                    event.debugRequestId
                );
            case 'queenTimeout':
                return await handleQueenTimeout(
                    openId,
                    roomId,
                    event.expectedVersion,
                    event.expectedPhase,
                    event.expectedDeadlineAt,
                    event.roomDocId
                );
            case 'nineGridStart':
                return await handleNineGridStart(openId, roomId, event.roomDocId);
            case 'nineGridSelectBase':
                return await handleNineGridSelectBase(
                    openId,
                    roomId,
                    event.roomDocId,
                    event.slotIndex,
                    event.expectedVersion
                );
            case 'nineGridGuess':
                return await handleNineGridGuess(
                    openId,
                    roomId,
                    event.roomDocId,
                    event.guess,
                    event.slotIndex,
                    event.expectedVersion
                );
            case 'nineGridSkip':
                return await handleNineGridSkip(openId, roomId, event.roomDocId, event.expectedVersion);
            case 'nineGridNextRound':
                return await handleNineGridNextRound(openId, roomId, event.roomDocId, event.expectedVersion);
            case 'cowardStart':
                return await handleCowardStart(openId, roomId, event.roomDocId);
            case 'cowardGetCard':
                return await handleCowardGetCard(openId, roomId, event.roomDocId, event.roundToken);
            case 'cowardUseSkill':
                return await handleCowardUseSkill(
                    openId,
                    roomId,
                    event.roomDocId,
                    event.roundToken,
                    event.skillType,
                    event.targetOpenId
                );
            case 'cowardStop':
                return await handleCowardStop(openId, roomId, event.roomDocId, event.roundToken);
            case 'cowardTimeout':
                return await handleCowardTimeout(openId, roomId, event.roomDocId, event.roundToken);
            case 'cowardReady':
                return await handleCowardReady(openId, roomId, event.roomDocId, event.roundToken);
            case 'cowardAdvanceRound':
                return await handleCowardAdvanceRound(openId, roomId, event.roomDocId, event.roundToken);
            default:
                return { success: false, error: 'Invalid action' };
        }
    } catch (err) {
        if (String(action || '').indexOf('tenHalf') === 0) {
            console.error('[十点半调试] 云函数执行异常', {
                '操作': action,
                '房间摘要': tenHalfDebugRoom(roomId),
                '错误': err && err.message,
                '错误堆栈': err && err.stack
            });
        }
        if (String(action || '').indexOf('queen') === 0) {
            console.error('[大姐牌调试] 云函数执行异常', {
                '操作': action,
                '请求标识': event.debugRequestId || '无',
                '房间摘要': tenHalfDebugRoom(roomId),
                '错误': err && err.message,
                '错误堆栈': err && err.stack
            });
        }
        if (String(action || '').indexOf('coward') === 0) {
            console.error('[胆小鬼调试] 云函数执行异常', {
                '操作': action,
                '房间摘要': tenHalfDebugRoom(roomId),
                '调用玩家摘要': cowardDebugPlayer(openId),
                '本轮': event.roundToken || '未提供',
                '错误码': err && (err.errCode !== undefined ? err.errCode : err.code),
                '错误': err && err.message,
                '错误堆栈': err && err.stack
            });
        }
        console.error('[roomManager] Error:', action, err);
        return { success: false, error: err.message };
    }
};

/**
 * 创建房间
 */
async function handleCreate(openId, gameType) {
    if (!gameType) {
        return { success: false, error: '缺少游戏类型' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');

    // 生成唯一房间ID (重试机制)
    let roomId;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        roomId = generateRoomId();

        // 检查是否已存在
        const { data: existing } = await collection.where({ roomId }).limit(1).get();

        if (existing.length === 0) {
            break;
        }
        attempts++;
    }

    if (attempts >= maxAttempts) {
        return { success: false, error: '房间ID生成失败，请重试' };
    }

    // 创建房间记录
    await collection.add({
        data: {
            roomId: roomId,
            hostOpenId: openId,
            gameType: gameType,
            status: 'waiting', // waiting / playing / ended
            maxMembers: 5,
            members: [{ openId, joinTime: now, isHost: true }],
            gameState: {
                fingers: [],
                gamePhase: 'SETUP',
                countdownSeconds: 5
            },
            createTime: now,
            lastActiveTime: now
        }
    });

    console.log('[roomManager] Room created:', roomId, 'by', openId);

    return {
        success: true,
        roomId: roomId,
        isHost: true
    };
}

/**
 * 通过房主 ID 创建房间（分享后调用）
 * 实时牌类游戏使用“hostId + gameType”作为 roomId，避免同一房主切换游戏时复用旧游戏文档。
 * 其他旧游戏继续使用 hostId 作为 roomId。
 * 
 * 【重要】数据库安全规则需要设置为：
 * - 读取权限：所有用户可读（auth != null）
 * - 写入权限：所有用户可写（auth != null）或者仅云函数可写
 * 否则 Guest 的 watch 会因权限问题收不到数据
 */
async function handleCreateByHost(openId, hostId, gameType, connectionId) {
    if (!hostId) {
        return { success: false, error: '缺少房主ID' };
    }

    // 确保调用者是房主
    if (openId !== hostId) {
        return { success: false, error: '只有房主可以创建房间' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');
    const requestedGameType = gameType || 'oldman';
    const roomId = isRealtimeCardGame(requestedGameType)
        ? realtimeCardRoomId(hostId, requestedGameType)
        : hostId;
    const initialGameState = createInitialGameState(requestedGameType);
    const playerProfile = isRealtimeCardGame(requestedGameType)
        ? await loadRealtimePlayerProfile(openId)
        : null;
    const hostMember = withTenHalfConnection(
        playerProfile
            ? withRealtimePlayerProfile({ openId: hostId, joinTime: now, isHost: true }, playerProfile)
            : { openId: hostId, joinTime: now, isHost: true },
        requestedGameType,
        connectionId
    );
    const ROOM_EXPIRE_TIME = 30 * 60 * 1000; // 30分钟过期

    // 检查房间是否已存在
    const { data: existing } = await collection.where({ roomId }).limit(1).get();

    if (existing.length > 0) {
        const room = existing[0];
        const lastActiveTime = room.lastActiveTime || room.createTime || 0;
        const isExpired = lastActiveTime > 0 && (now - lastActiveTime > ROOM_EXPIRE_TIME);
        const sameRealtimeGame = isRealtimeCardGame(requestedGameType) && room.gameType === requestedGameType;
        const activePresence = isRealtimeCardGame(room.gameType) && isExpired
            ? await hasActiveRealtimePresence(room, now)
            : false;

        // 同一种实时牌类通常保留当前成员与进度；胆小鬼会进一步用 connectionId
        // 区分同连接重试与一次全新的小程序会话。
        if (sameRealtimeGame && room.status !== 'ended' && (!isExpired || activePresence)) {
            if (requestedGameType === 'tenhalf') {
                return await handleJoinTenHalfRoom(openId, room._id, now, connectionId, playerProfile);
            }
            if (requestedGameType === 'queen') {
                return await handleJoinQueenRoom(openId, room._id, now, connectionId, playerProfile);
            }
            if (requestedGameType === 'coward') {
                const requestedConnectionId = normalizeTenHalfConnectionId(connectionId);
                const existingHostMember = (room.members || []).find((member) => member.openId === openId);
                const existingConnectionId = normalizeTenHalfConnectionId(existingHostMember && existingHostMember.connectionId);
                if (requestedConnectionId && requestedConnectionId !== existingConnectionId) {
                    return await handleFreshCowardHostRoom(
                        openId,
                        room._id,
                        roomId,
                        now,
                        requestedConnectionId,
                        playerProfile
                    );
                }
                return await handleJoinCowardRoom(openId, room._id, now, connectionId, playerProfile);
            }
            return await handleJoinNineGridRoom(openId, room._id, now, connectionId, playerProfile);
        }

        // 防御异常数据：正常情况下实时牌类 roomId 已含 gameType，不会命中其他游戏文档。
        const otherMembers = (room.members || []).filter((member) => member.openId !== openId);
        if (room.gameType !== requestedGameType && otherMembers.length && (!isExpired || activePresence)) {
            return { success: false, error: '你还有其他游戏房间正在进行，请先退出原房间' };
        }

        // 【修复】如果旧房间已过期，重置房间而不是返回旧数据
        if (isExpired && !activePresence) {
            console.log('[roomManager] Old room expired, resetting:', roomId);
            const resetGameState = isRealtimeCardGame(requestedGameType) && room.gameType === requestedGameType
                ? resetRealtimeCardGameState(requestedGameType, room.gameState)
                : initialGameState;
            // 重置房间数据
            const resetData = {
                hostOpenId: hostId,
                members: [hostMember],
                gameType: requestedGameType,
                gameState: isRealtimeCardGame(requestedGameType) ? _.set(resetGameState) : resetGameState,
                status: 'waiting',
                lastActiveTime: now
            };
            if (isRealtimeCardGame(requestedGameType)) {
                resetData.maxMembers = realtimeCardGameMaxMembers(requestedGameType);
            }
            await collection.doc(room._id).update({ data: resetData });

            return {
                success: true,
                roomId: roomId,
                roomDocId: room._id,
                room: {
                    _id: room._id,
                    roomId: room.roomId,
                    hostOpenId: hostId,
                    gameType: requestedGameType,
                    status: 'waiting',
                    members: [hostMember],
                    gameState: resetGameState,
                    maxMembers: isRealtimeCardGame(requestedGameType) ? realtimeCardGameMaxMembers(requestedGameType) : (room.maxMembers || 10),
                    lastActiveTime: now
                },
                isHost: true,
                wasExpired: true  // 标记房间曾过期
            };
        }

        // 【修复 幽灵房间核心】房主重新进入房间时，始终重置成员列表
        // 这是防止幽灵房间的关键：房主每次创建/进入，都清空旧成员数据
        console.log('[roomManager] Host re-entering room, resetting members:', roomId);
        const resetGameState = isRealtimeCardGame(requestedGameType) && room.gameType === requestedGameType
            ? resetRealtimeCardGameState(requestedGameType, room.gameState)
            : initialGameState;
        const resetData = {
            hostOpenId: hostId,
            members: [hostMember],
            gameType: requestedGameType,
            gameState: isRealtimeCardGame(requestedGameType) ? _.set(resetGameState) : resetGameState,
            status: 'waiting',
            lastActiveTime: now
        };
        if (isRealtimeCardGame(requestedGameType)) {
            resetData.maxMembers = realtimeCardGameMaxMembers(requestedGameType);
        }
        await collection.doc(room._id).update({ data: resetData });

        return {
            success: true,
            roomId: roomId,
            roomDocId: room._id,
            room: {
                _id: room._id,
                roomId: room.roomId,
                hostOpenId: hostId,
                gameType: requestedGameType,
                status: 'waiting',
                members: [hostMember],
                gameState: resetGameState,
                maxMembers: isRealtimeCardGame(requestedGameType) ? realtimeCardGameMaxMembers(requestedGameType) : (room.maxMembers || 10),
                lastActiveTime: now
            },
            isHost: true,
            existed: true
        };
    }

    // 【修复】不显式设置 _openid，让数据库安全规则决定可见性
    // 这样配合"所有用户可读"的安全规则，Guest 的 watch 才能收到数据
    const addResult = await collection.add({
        data: {
            roomId: roomId,
            hostOpenId: hostId,
            gameType: requestedGameType,
            status: 'waiting',
            maxMembers: isRealtimeCardGame(requestedGameType) ? realtimeCardGameMaxMembers(requestedGameType) : 10,
            members: [hostMember],
            gameState: initialGameState,
            createTime: now,
            lastActiveTime: now
        }
    });

    console.log('[roomManager] Room created by host:', roomId, 'docId:', addResult._id);

    return {
        success: true,
        roomId: roomId,
        roomDocId: addResult._id, // 【修复】返回文档ID供前端使用
        room: {
            _id: addResult._id,
            roomId: roomId,
            hostOpenId: hostId,
            gameType: requestedGameType,
            status: 'waiting',
            members: [hostMember],
            gameState: initialGameState,
            maxMembers: isRealtimeCardGame(requestedGameType) ? realtimeCardGameMaxMembers(requestedGameType) : 10,
            lastActiveTime: now  // 【修复】返回 lastActiveTime
        },
        isHost: true
    };
}

async function handleFreshCowardHostRoom(openId, roomDocId, roomId, now, connectionId, playerProfile) {
    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.roomId !== roomId || room.gameType !== 'coward' || room.status === 'ended') {
            return { success: false, error: '房间不存在或已关闭', roomNotFound: true };
        }
        const normalizedConnectionId = normalizeTenHalfConnectionId(connectionId);
        const currentMember = (room.members || []).find((member) => member.openId === openId);
        const currentConnectionId = normalizeTenHalfConnectionId(currentMember && currentMember.connectionId);

        // 同一连接重复提交 create 只视为幂等重连，不能误清正在进行的游戏。
        if (currentMember && currentConnectionId === normalizedConnectionId) {
            return {
                success: true,
                roomDocId: roomDocId,
                room: {
                    _id: roomDocId,
                    roomId: room.roomId,
                    hostOpenId: room.hostOpenId,
                    gameType: room.gameType,
                    status: room.status,
                    members: room.members || [],
                    gameState: room.gameState || {},
                    maxMembers: COWARD_MAX_MEMBERS,
                    lastActiveTime: room.lastActiveTime || now
                },
                isHost: room.hostOpenId === openId,
                sameConnection: true
            };
        }

        if (room.gameState && room.gameState.roundToken) {
            await removeCowardRoundStorageInTransaction(
                transaction,
                roomId,
                room.gameState.playerOrder || (room.members || []).map((member) => member.openId)
            );
        }
        const hostMember = withTenHalfConnection(
            withRealtimePlayerProfile({ openId: openId, joinTime: now, isHost: true }, playerProfile),
            'coward',
            normalizedConnectionId
        );
        const resetState = resetCowardGameState(room.gameState);
        await transaction.collection('GameRoom').doc(roomDocId).update({
            data: {
                hostOpenId: openId,
                members: _.set([hostMember]),
                gameState: _.set(resetState),
                gameType: 'coward',
                status: 'waiting',
                maxMembers: COWARD_MAX_MEMBERS,
                lastActiveTime: now
            }
        });
        cowardDebug('检测到房主新连接，已原子清理旧局并创建全新 START 房间', roomId, {
            '房主摘要': cowardDebugPlayer(openId),
            '旧成员数': (room.members || []).length,
            '旧阶段': room.gameState && room.gameState.phase || 'waiting'
        });
        return {
            success: true,
            roomDocId: roomDocId,
            room: {
                _id: roomDocId,
                roomId: roomId,
                hostOpenId: openId,
                gameType: 'coward',
                status: 'waiting',
                members: [hostMember],
                gameState: resetState,
                maxMembers: COWARD_MAX_MEMBERS,
                lastActiveTime: now
            },
            isHost: true,
            freshSession: true
        };
    });
}

async function handleJoinTenHalfRoom(openId, roomDocId, now, connectionId, playerProfile) {
    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'tenhalf' || room.status === 'ended') {
            return { success: false, error: '房间不存在或已关闭', roomNotFound: true };
        }

        const members = room.members || [];
        const existingIndex = members.findIndex((member) => member.openId === openId);
        if (existingIndex < 0 && members.length >= TEN_HALF_MAX_MEMBERS) {
            return { success: false, error: '房间已满' };
        }

        const normalizedConnectionId = normalizeTenHalfConnectionId(connectionId);
        const updatedMembers = existingIndex >= 0
            ? members.map((member, index) => index === existingIndex
                ? withTenHalfConnection(
                    withRealtimePlayerProfile({ ...member, joinTime: now }, playerProfile),
                    'tenhalf',
                    normalizedConnectionId
                )
                : member)
            : members.concat([withTenHalfConnection(
                withRealtimePlayerProfile({ openId: openId, joinTime: now, isHost: false }, playerProfile),
                'tenhalf',
                normalizedConnectionId
            )]);
        await transaction.collection('GameRoom').doc(roomDocId).update({
            data: {
                members: _.set(updatedMembers),
                maxMembers: TEN_HALF_MAX_MEMBERS,
                lastActiveTime: now
            }
        });

        return {
            success: true,
            roomDocId: roomDocId,
            room: {
                _id: roomDocId,
                roomId: room.roomId,
                hostOpenId: room.hostOpenId,
                gameType: room.gameType,
                status: room.status,
                members: updatedMembers,
                gameState: room.gameState || {},
                maxMembers: TEN_HALF_MAX_MEMBERS,
                lastActiveTime: now
            },
            isHost: room.hostOpenId === openId
        };
    });
}

async function handleJoinQueenRoom(openId, roomDocId, now, connectionId, playerProfile) {
    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'queen' || room.status === 'ended') {
            return { success: false, error: '房间不存在或已关闭', roomNotFound: true };
        }

        const members = room.members || [];
        const existingIndex = members.findIndex((member) => member.openId === openId);
        if (existingIndex < 0 && members.length >= QUEEN_MAX_MEMBERS) {
            return { success: false, error: '房间已满' };
        }

        const updatedMembers = existingIndex >= 0
            ? members.map((member, index) => index === existingIndex
                ? withTenHalfConnection(
                    withRealtimePlayerProfile({ ...member, joinTime: now }, playerProfile),
                    'queen',
                    connectionId
                )
                : member)
            : members.concat([withTenHalfConnection(
                withRealtimePlayerProfile({ openId: openId, joinTime: now, isHost: false }, playerProfile),
                'queen',
                connectionId
            )]);
        await transaction.collection('GameRoom').doc(roomDocId).update({
            data: {
                members: _.set(updatedMembers),
                maxMembers: QUEEN_MAX_MEMBERS,
                lastActiveTime: now
            }
        });

        return {
            success: true,
            roomDocId: roomDocId,
            room: {
                _id: roomDocId,
                roomId: room.roomId,
                hostOpenId: room.hostOpenId,
                gameType: room.gameType,
                status: room.status,
                members: updatedMembers,
                gameState: room.gameState || {},
                maxMembers: QUEEN_MAX_MEMBERS,
                lastActiveTime: now
            },
            isHost: room.hostOpenId === openId
        };
    });
}

async function handleJoinNineGridRoom(openId, roomDocId, now, connectionId, playerProfile) {
    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'ninegrid' || room.status === 'ended') {
            return { success: false, error: '房间不存在或已关闭', roomNotFound: true };
        }

        const members = room.members || [];
        const existingIndex = members.findIndex((member) => member.openId === openId);
        if (existingIndex < 0 && members.length >= NINE_GRID_MAX_MEMBERS) {
            return { success: false, error: '房间已满' };
        }
        const updatedMembers = existingIndex >= 0
            ? members.map((member, index) => index === existingIndex
                ? withTenHalfConnection(
                    withRealtimePlayerProfile({ ...member, joinTime: now }, playerProfile),
                    'ninegrid',
                    connectionId
                )
                : member)
            : members.concat([withTenHalfConnection(
                withRealtimePlayerProfile({ openId: openId, joinTime: now, isHost: false }, playerProfile),
                'ninegrid',
                connectionId
            )]);
        await transaction.collection('GameRoom').doc(roomDocId).update({
            data: {
                members: _.set(updatedMembers),
                maxMembers: NINE_GRID_MAX_MEMBERS,
                lastActiveTime: now
            }
        });
        return {
            success: true,
            roomDocId: roomDocId,
            room: {
                _id: roomDocId,
                roomId: room.roomId,
                hostOpenId: room.hostOpenId,
                gameType: room.gameType,
                status: room.status,
                members: updatedMembers,
                gameState: room.gameState || {},
                maxMembers: NINE_GRID_MAX_MEMBERS,
                lastActiveTime: now
            },
            isHost: room.hostOpenId === openId
        };
    });
}

async function handleJoinCowardRoom(openId, roomDocId, now, connectionId, playerProfile) {
    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'coward' || room.status === 'ended') {
            return { success: false, error: '房间不存在或已关闭', roomNotFound: true };
        }

        const members = room.members || [];
        const existingIndex = members.findIndex((member) => member.openId === openId);
        if (existingIndex < 0 && members.length >= COWARD_MAX_MEMBERS) {
            return { success: false, error: '房间已满' };
        }
        const updatedMembers = existingIndex >= 0
            ? members.map((member, index) => index === existingIndex
                ? withTenHalfConnection(
                    withRealtimePlayerProfile({ ...member, joinTime: now }, playerProfile),
                    'coward',
                    connectionId
                )
                : member)
            : members.concat([withTenHalfConnection(
                withRealtimePlayerProfile({ openId: openId, joinTime: now, isHost: false }, playerProfile),
                'coward',
                connectionId
            )]);
        await transaction.collection('GameRoom').doc(roomDocId).update({
            data: {
                members: _.set(updatedMembers),
                maxMembers: COWARD_MAX_MEMBERS,
                lastActiveTime: now
            }
        });
        return {
            success: true,
            roomDocId: roomDocId,
            room: {
                _id: roomDocId,
                roomId: room.roomId,
                hostOpenId: room.hostOpenId,
                gameType: room.gameType,
                status: room.status,
                members: updatedMembers,
                gameState: room.gameState || {},
                maxMembers: COWARD_MAX_MEMBERS,
                lastActiveTime: now
            },
            isHost: room.hostOpenId === openId
        };
    });
}

/**
 * 通过房主 OpenID 加入房间
 * 【修复】如果房间不存在或已过期，非房主不应该加入
 */
async function handleJoinByHost(openId, hostId, gameType, connectionId) {
    if (!hostId) {
        return { success: false, error: '缺少房主ID' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');
    const ROOM_EXPIRE_TIME = 30 * 60 * 1000; // 30分钟过期

    // 实时牌类按“房主 + 游戏类型”精确命中各自房间，绝不读取同房主的其他游戏文档。
    const roomId = isRealtimeCardGame(gameType)
        ? realtimeCardRoomId(hostId, gameType)
        : hostId;

    // 查找房间
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        // 【修复】房间不存在，非房主不应创建房间
        console.log('[roomManager] Room not found, guest cannot create:', roomId);
        return {
            success: false,
            error: '房间不存在或已关闭',
            roomNotFound: true
        };
    }

    // 房间已存在
    const room = rooms[0];
    if (gameType && room.gameType && room.gameType !== gameType) {
        return {
            success: false,
            error: '房间游戏类型不匹配',
            roomNotFound: true
        };
    }
    const lastActiveTime = room.lastActiveTime || room.createTime || 0;
    const isExpired = lastActiveTime > 0 && (now - lastActiveTime > ROOM_EXPIRE_TIME);
    const members = room.members || [];
    const STALE_ROOM_TIME = 5 * 60 * 1000;
    const isStale = lastActiveTime > 0 && (now - lastActiveTime > STALE_ROOM_TIME);
    const activePresence = isRealtimeCardGame(room.gameType) && (isExpired || isStale)
        ? await hasActiveRealtimePresence(room, now)
        : false;

    // 【修复】检查房间是否过期（30分钟无活动）
    if (isExpired && !activePresence) {
        console.log('[roomManager] Room expired:', roomId, 'lastActive:', lastActiveTime);
        return {
            success: false,
            error: '房间已过期',
            roomExpired: true
        };
    }

    // 检查房间状态
    if (room.status === 'ended') {
        return { success: false, error: '房间已关闭' };
    }

    // 检查是否已在房间中
    const existingMember = members.find(m => m.openId === openId);

    // 【修复 幽灵房间】检查房主是否在房间成员列表中
    const hostMember = members.find(m => m.isHost === true || m.openId === hostId);
    const isHostPresent = !!hostMember;

    // 【修复】如果房间没有成员或房主不在，视为无效房间
    if (members.length === 0 || !isHostPresent) {
        console.log('[roomManager] Ghost room detected - no members or host missing:', roomId, 'hostPresent:', isHostPresent, 'members:', members.length);
        // 异步清理幽灵房间
        collection.where({ roomId }).remove().catch(e => console.warn('Failed to remove ghost room:', e));
        return {
            success: false,
            error: '房间已解散',
            roomNotFound: true
        };
    }

    // 【修复】更严格的活跃检查：如果最后活跃时间超过5分钟，可能是所有人都离开了
    if (isStale && members.length <= 1 && !activePresence) {
        console.log('[roomManager] Stale room with single member:', roomId, 'lastActive:', now - lastActiveTime, 'ms ago');
        return {
            success: false,
            error: '房间已解散',
            roomNotFound: true
        };
    }

    if (room.gameType === 'tenhalf') {
        const playerProfile = await loadRealtimePlayerProfile(openId);
        return await handleJoinTenHalfRoom(openId, room._id, now, connectionId, playerProfile);
    }
    if (room.gameType === 'queen') {
        const playerProfile = await loadRealtimePlayerProfile(openId);
        return await handleJoinQueenRoom(openId, room._id, now, connectionId, playerProfile);
    }
    if (room.gameType === 'ninegrid') {
        const playerProfile = await loadRealtimePlayerProfile(openId);
        return await handleJoinNineGridRoom(openId, room._id, now, connectionId, playerProfile);
    }
    if (room.gameType === 'coward') {
        const playerProfile = await loadRealtimePlayerProfile(openId);
        return await handleJoinCowardRoom(openId, room._id, now, connectionId, playerProfile);
    }

    if (existingMember) {
        // 【新增 方案1】更新 joinTime，重置 30 秒保护窗口
        // 这样当用户从分享链接重新进入时，leave 操作会被保护机制拦截
        const updatedMembers = members.map(m => {
            if (m.openId === openId) {
                return { ...m, joinTime: now };  // 重置 joinTime
            }
            return m;
        });

        await collection.where({ roomId }).update({
            data: {
                members: updatedMembers,
                lastActiveTime: now
            }
        });

        return {
            success: true,
            roomDocId: room._id,
            room: {
                _id: room._id,
                roomId: room.roomId,
                hostOpenId: room.hostOpenId,
                gameType: room.gameType,
                status: room.status,
                members: updatedMembers,  // 返回更新后的成员
                gameState: room.gameState || {},
                lastActiveTime: now
            },
            isHost: room.hostOpenId === openId
        };
    }

    // 检查人数上限
    if (members.length >= (room.maxMembers || 10)) {
        return { success: false, error: '房间已满' };
    }

    // 添加新成员
    await collection.where({ roomId }).update({
        data: {
            members: _.push({
                openId: openId,
                joinTime: now,
                isHost: false
            }),
            lastActiveTime: now
        }
    });

    // 重新获取房间
    const { data: updatedRooms } = await collection.where({ roomId }).limit(1).get();
    const updatedRoom = updatedRooms[0];

    console.log('[roomManager] User joined room:', roomId, 'members:', updatedRoom.members.length);

    return {
        success: true,
        roomDocId: updatedRoom._id, // 【修复】返回文档ID
        room: {
            _id: updatedRoom._id,
            roomId: updatedRoom.roomId,
            hostOpenId: updatedRoom.hostOpenId,
            gameType: updatedRoom.gameType,
            status: updatedRoom.status,
            members: updatedRoom.members,
            gameState: updatedRoom.gameState || {},
            lastActiveTime: updatedRoom.lastActiveTime || now  // 【修复】返回 lastActiveTime
        },
        isHost: false
    };
}

/**
 * 加入房间
 */
async function handleJoin(openId, roomId) {
    if (!roomId) {
        return { success: false, error: '缺少房间ID' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');

    // 查找房间
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: false, error: '房间不存在' };
    }

    const room = rooms[0];

    // 检查房间状态
    if (room.status === 'ended') {
        return { success: false, error: '房间已关闭' };
    }

    // 检查是否已在房间中
    const members = room.members || [];
    const existingMember = members.find(m => m.openId === openId);

    if (existingMember) {
        // 已在房间中，返回当前状态
        return {
            success: true,
            room: {
                roomId: room.roomId,
                hostOpenId: room.hostOpenId,
                gameType: room.gameType,
                status: room.status,
                members: members,
                gameState: room.gameState || {}
            },
            isHost: room.hostOpenId === openId
        };
    }

    // 检查人数上限
    if (members.length >= (room.maxMembers || 5)) {
        return { success: false, error: '房间已满' };
    }

    // 添加新成员
    await collection.where({ roomId }).update({
        data: {
            members: _.push({
                openId: openId,
                joinTime: now,
                isHost: false
            }),
            lastActiveTime: now
        }
    });

    console.log('[roomManager] User joined room:', roomId, openId);

    // 重新获取房间数据
    const { data: updatedRooms } = await collection.where({ roomId }).limit(1).get();
    const updatedRoom = updatedRooms[0];

    return {
        success: true,
        room: {
            roomId: updatedRoom.roomId,
            hostOpenId: updatedRoom.hostOpenId,
            gameType: updatedRoom.gameType,
            status: updatedRoom.status,
            members: updatedRoom.members || [],
            gameState: updatedRoom.gameState || {}
        },
        isHost: false
    };
}

/**
 * 同步游戏状态
 * 任何房间成员都可以同步自己的状态
 */
async function handleSync(openId, roomId, gameState) {
    if (!roomId || !gameState) {
        return { success: false, error: '缺少必要参数' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');

    // 查找房间
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: false, error: '房间不存在' };
    }

    const room = rooms[0];

    // 验证是房间成员
    const members = room.members || [];
    const isMember = members.some(m => m.openId === openId);

    if (!isMember) {
        return { success: false, error: '不是房间成员' };
    }

    // 【优化】服务端状态合并，解决多人并发问题
    let finalGameState = gameState;
    const currentState = room.gameState || {};

    // 判断是否是新一轮
    const isNewRound =
        gameState.isNewRoundReset === true || // 明确标记的新一轮重置
        (gameState.round && gameState.round !== currentState.round) || // round 变化
        (gameState.gamePhase === 'playing' && gameState.oldmen &&
            gameState.oldmen.every(o => o.isVisible !== false) &&
            gameState.remainingCount === 16); // 所有老头可见且数量为16

    if (!isNewRound && currentState.oldmen && gameState.oldmen) {
        // 【关键】游戏进行中：合并 oldmen 状态，只允许"变为不可见"，不允许"复活"
        const mergedOldmen = gameState.oldmen.map((newOldman, i) => {
            const currentOldman = currentState.oldmen[i];
            if (!currentOldman) return newOldman;

            // 如果当前数据库中该老头已经不可见，保持不可见（防止复活）
            // 如果新状态说不可见，则变为不可见（接受点击）
            const currentVisible = currentOldman.isVisible !== false;
            const newVisible = newOldman.isVisible !== false;
            const finalVisible = currentVisible && newVisible; // AND 逻辑

            return {
                ...newOldman,
                isVisible: finalVisible,
                // 如果已经有飞出方向，保留；否则用新的
                flyDirection: currentOldman.flyDirection || newOldman.flyDirection || ''
            };
        });

        // 【优化】根据合并后的状态重新计算 remainingCount
        const actualRemaining = mergedOldmen.filter(o => o.isVisible !== false).length;

        finalGameState = {
            ...gameState,
            oldmen: mergedOldmen,
            remainingCount: actualRemaining
        };
    }

    // 更新游戏状态
    await collection.where({ roomId }).update({
        data: {
            gameState: finalGameState,
            lastActiveTime: now
        }
    });

    return { success: true };
}

/**
 * 十点半专用离房流程：事务内校验连接代次并原子更新成员，避免延迟请求误删重连玩家。
 */
async function handleTenHalfExit(openId, roomDocId, roomId, connectionId) {
    const requestedConnectionId = normalizeTenHalfConnectionId(connectionId);
    const outcome = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'tenhalf') {
            return { success: true, roomMissing: true };
        }

        const members = room.members || [];
        const member = members.find((item) => item.openId === openId);
        if (!member) return { success: true, skipped: true, reason: 'member_missing' };
        if (member.connectionId && requestedConnectionId !== member.connectionId) {
            return { success: true, skipped: true, reason: 'stale_connection' };
        }

        let nextMembers = members.filter((item) => item.openId !== openId);
        if (nextMembers.length === 0) {
            await transaction.collection('GameRoom').doc(roomDocId).remove();
            return { success: true, roomDeleted: true, removeSecret: true };
        }

        const updateData = {
            members: nextMembers,
            lastActiveTime: Date.now()
        };
        if (room.hostOpenId === openId) {
            nextMembers = nextMembers.map((item, index) => ({ ...item, isHost: index === 0 }));
            updateData.members = nextMembers;
            updateData.hostOpenId = nextMembers[0].openId;
        }

        const resetGame = shouldResetTenHalfAfterExit(room, openId);
        if (resetGame) {
            updateData.gameState = _.set(resetTenHalfGameState(room.gameState, openId));
            updateData.status = 'waiting';
        }
        await transaction.collection('GameRoom').doc(roomDocId).update({ data: updateData });
        return {
            success: true,
            hostTransferred: room.hostOpenId === openId,
            newHost: room.hostOpenId === openId ? nextMembers[0].openId : '',
            resetGame: resetGame,
            removeSecret: resetGame
        };
    });

    if (outcome && outcome.removeSecret) await removeTenHalfSecret(roomId);
    if (outcome && outcome.reason === 'stale_connection') {
        console.log('[十点半调试] 忽略旧连接延迟到达的离房请求', {
            '房间摘要': tenHalfDebugRoom(roomId)
        });
    }
    return outcome;
}

async function handleQueenExit(openId, roomDocId, roomId, connectionId) {
    const requestedConnectionId = normalizeTenHalfConnectionId(connectionId);
    const outcome = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'queen') {
            return { success: true, roomMissing: true };
        }

        const members = room.members || [];
        const member = members.find((item) => item.openId === openId);
        if (!member) return { success: true, skipped: true, reason: 'member_missing' };
        if (member.connectionId && requestedConnectionId !== member.connectionId) {
            return { success: true, skipped: true, reason: 'stale_connection' };
        }

        let nextMembers = members.filter((item) => item.openId !== openId);
        if (nextMembers.length === 0) {
            if (room.gameState && room.gameState.roundToken) {
                await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).remove();
            }
            await transaction.collection('GameRoom').doc(roomDocId).remove();
            return { success: true, roomDeleted: true };
        }

        const updateData = { members: nextMembers, lastActiveTime: Date.now() };
        if (room.hostOpenId === openId) {
            nextMembers = nextMembers.map((item, index) => ({ ...item, isHost: index === 0 }));
            updateData.members = nextMembers;
            updateData.hostOpenId = nextMembers[0].openId;
        }
        const resetGame = shouldResetQueenAfterExit(room, openId);
        if (resetGame) {
            updateData.gameState = _.set(resetQueenGameState(room.gameState));
            updateData.status = 'waiting';
            if (room.gameState && room.gameState.roundToken) {
                await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).remove();
            }
        }
        await transaction.collection('GameRoom').doc(roomDocId).update({ data: updateData });
        return {
            success: true,
            hostTransferred: room.hostOpenId === openId,
            newHost: room.hostOpenId === openId ? nextMembers[0].openId : '',
            resetGame: resetGame
        };
    });
    return outcome;
}

async function handleNineGridExit(openId, roomDocId, roomId, connectionId) {
    const requestedConnectionId = normalizeTenHalfConnectionId(connectionId);
    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'ninegrid') {
            return { success: true, roomMissing: true };
        }
        const members = room.members || [];
        const member = members.find((item) => item.openId === openId);
        if (!member) return { success: true, skipped: true, reason: 'member_missing' };
        if (member.connectionId && requestedConnectionId !== member.connectionId) {
            return { success: true, skipped: true, reason: 'stale_connection' };
        }

        let nextMembers = members.filter((item) => item.openId !== openId);
        if (!nextMembers.length) {
            await transaction.collection('GameRoom').doc(roomDocId).remove();
            return { success: true, roomDeleted: true };
        }
        const updateData = { members: nextMembers, lastActiveTime: Date.now() };
        if (room.hostOpenId === openId) {
            nextMembers = nextMembers.map((item, index) => ({ ...item, isHost: index === 0 }));
            updateData.members = nextMembers;
            updateData.hostOpenId = nextMembers[0].openId;
        }
        const resetGame = shouldResetNineGridAfterExit(room, openId);
        if (resetGame) {
            updateData.gameState = _.set(resetNineGridGameState(room.gameState));
            updateData.status = 'waiting';
        }
        await transaction.collection('GameRoom').doc(roomDocId).update({ data: updateData });
        return {
            success: true,
            hostTransferred: room.hostOpenId === openId,
            newHost: room.hostOpenId === openId ? nextMembers[0].openId : '',
            resetGame: resetGame
        };
    });
}

async function handleCowardExit(openId, roomDocId, roomId, connectionId) {
    const requestedConnectionId = normalizeTenHalfConnectionId(connectionId);
    const outcome = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'coward') {
            return { success: true, roomMissing: true };
        }
        const members = room.members || [];
        const member = members.find((item) => item.openId === openId);
        if (!member) return { success: true, skipped: true, reason: 'member_missing' };
        if (member.connectionId && requestedConnectionId !== member.connectionId) {
            return { success: true, skipped: true, reason: 'stale_connection' };
        }

        let nextMembers = members.filter((item) => item.openId !== openId);
        if (!nextMembers.length) {
            if (room.gameState && room.gameState.roundToken) {
                await removeCowardRoundStorageInTransaction(
                    transaction,
                    roomId,
                    room.gameState.playerOrder || members.map((item) => item.openId)
                );
            }
            await transaction.collection('GameRoom').doc(roomDocId).remove();
            return { success: true, roomDeleted: true };
        }
        const updateData = { members: nextMembers, lastActiveTime: Date.now() };
        if (room.hostOpenId === openId) {
            nextMembers = nextMembers.map((item, index) => ({ ...item, isHost: index === 0 }));
            updateData.members = nextMembers;
            updateData.hostOpenId = nextMembers[0].openId;
        }
        const resetGame = shouldResetCowardAfterExit(room, openId);
        if (resetGame) {
            updateData.gameState = _.set(resetCowardGameState(room.gameState));
            updateData.status = 'waiting';
            if (room.gameState && room.gameState.roundToken) {
                await removeCowardRoundStorageInTransaction(
                    transaction,
                    roomId,
                    room.gameState.playerOrder || members.map((item) => item.openId)
                );
            }
        }
        await transaction.collection('GameRoom').doc(roomDocId).update({ data: updateData });
        return {
            success: true,
            hostTransferred: room.hostOpenId === openId,
            newHost: room.hostOpenId === openId ? nextMembers[0].openId : '',
            resetGame: resetGame
        };
    });
    return outcome;
}

// 胆小鬼的 close 与普通 leave 含义不同：房主退出小程序/页面时必须真正
// 结束该房间。否则确定性的 roomId 会在房主恢复时重新命中旧房间，旧成员
// 和旧进度也会随之复活。连接标识仍在事务内校验，旧页面的迟到 close 不会
// 删除已经由新连接创建的房间。
async function handleCowardClose(openId, roomDocId, roomId, connectionId) {
    const requestedConnectionId = normalizeTenHalfConnectionId(connectionId);
    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDocId).get();
        const room = roomResult.data;
        if (!room || room.gameType !== 'coward') {
            return { success: true, roomMissing: true };
        }
        if (room.hostOpenId !== openId) {
            return { success: true, skipped: true, reason: 'host_changed' };
        }
        const members = room.members || [];
        const member = members.find((item) => item.openId === openId);
        if (!member) return { success: true, skipped: true, reason: 'member_missing' };
        if (member.connectionId && requestedConnectionId !== member.connectionId) {
            return { success: true, skipped: true, reason: 'stale_connection' };
        }
        if (room.gameState && room.gameState.roundToken) {
            await removeCowardRoundStorageInTransaction(
                transaction,
                roomId,
                room.gameState.playerOrder || members.map((item) => item.openId)
            );
        }
        await transaction.collection('GameRoom').doc(roomDocId).remove();
        return { success: true, roomDeleted: true };
    });
}

/**
 * 关闭房间 (仅房主可操作)
 * 【方案2】增加保护：如果有其他活跃成员且房主最近加入，不删除房间
 */
async function handleClose(openId, roomId, connectionId) {
    if (!roomId) {
        return { success: false, error: '缺少房间ID' };
    }

    const collection = db.collection('GameRoom');
    const now = Date.now();

    // 查找房间
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: false, error: '房间不存在' };
    }

    const room = rooms[0];

    // 验证是房主
    if (room.hostOpenId !== openId) {
        return { success: false, error: '只有房主可以关闭房间' };
    }

    const members = room.members || [];
    const hostMember = members.find(m => m.openId === openId);
    if (room.gameType === 'tenhalf') {
        return await handleTenHalfExit(openId, room._id, roomId, connectionId);
    }
    if (room.gameType === 'queen') {
        return await handleQueenExit(openId, room._id, roomId, connectionId);
    }
    if (room.gameType === 'ninegrid') {
        return await handleNineGridExit(openId, room._id, roomId, connectionId);
    }
    if (room.gameType === 'coward') {
        return await handleCowardClose(openId, room._id, roomId, connectionId);
    }

    // 【新增】检查是否有其他成员（不包括房主自己）
    const otherMembers = members.filter(m => m.openId !== openId);

    // 【新增】如果有其他成员，且房间最近有活跃，检查是否是房主意外触发的 close
    const lastActive = room.lastActiveTime || 0;
    const isRecentlyActive = (now - lastActive) < 60 * 1000;  // 1分钟内有活跃

    if (otherMembers.length > 0 && isRecentlyActive) {
        // 检查房主的 joinTime 保护
        if (hostMember && room.gameType !== 'tenhalf') {
            const joinTime = hostMember.joinTime || 0;
            if (now - joinTime < 30000) {  // 30秒保护
                console.log('[roomManager] Host joined recently (' + Math.round((now - joinTime) / 1000) + 's ago), ignoring close');
                return { success: true, skipped: true, reason: 'host_recent_join' };
            }
        }

        // 房主真的要离开，转移房主权限给第一个其他成员
        const newHost = otherMembers[0];
        const updatedMembers = otherMembers.map((m, i) => ({
            ...m,
            isHost: i === 0  // 第一个成员成为新房主
        }));

        const updateData = {
            hostOpenId: newHost.openId,
            members: updatedMembers,
            lastActiveTime: now
        };
        const resetTenHalf = shouldResetTenHalfAfterExit(room, openId);
        if (resetTenHalf) {
            updateData.gameState = _.set(resetTenHalfGameState(room.gameState, openId));
            updateData.status = 'waiting';
        }

        await collection.doc(room._id).update({ data: updateData });
        if (resetTenHalf) await removeTenHalfSecret(roomId);

        console.log('[roomManager] Host left, transferred to:', newHost.openId);
        return { success: true, hostTransferred: true, newHost: newHost.openId };
    }

    // 没有其他成员或房间不活跃，正常删除
    await collection.where({ roomId }).remove();
    await removeTenHalfSecret(roomId);
    await removeQueenSecret(roomId);
    await removeCowardSecret(roomId);

    console.log('[roomManager] Room closed and deleted:', roomId);

    return { success: true };
}

/**
 * 离开房间
 */
async function handleLeave(openId, roomId, connectionId) {
    if (!roomId) {
        return { success: false, error: '缺少房间ID' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');

    // 查找房间
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: true }; // 房间已不存在，视为成功
    }

    const room = rooms[0];

    if (room.gameType === 'tenhalf') {
        return await handleTenHalfExit(openId, room._id, roomId, connectionId);
    }
    if (room.gameType === 'queen') {
        return await handleQueenExit(openId, room._id, roomId, connectionId);
    }
    if (room.gameType === 'ninegrid') {
        return await handleNineGridExit(openId, room._id, roomId, connectionId);
    }
    if (room.gameType === 'coward') {
        return await handleCowardExit(openId, room._id, roomId, connectionId);
    }

    // 如果是房主离开，直接关闭房间
    if (room.hostOpenId === openId) {
        return await handleClose(openId, roomId, connectionId);
    }

    // 【新增】检查用户是否最近加入，防止从分享链接重新进入时的竞态条件
    const allMembers = room.members || [];
    const member = allMembers.find(m => m.openId === openId);

    if (member && room.gameType !== 'tenhalf') {
        const joinTime = member.joinTime || 0;
        const RECENT_JOIN_THRESHOLD = 30 * 1000; // 30秒
        if (now - joinTime < RECENT_JOIN_THRESHOLD) {
            console.log('[roomManager] User joined recently (' + Math.round((now - joinTime) / 1000) + 's ago), ignoring leave:', openId);
            return { success: true, skipped: true, reason: 'recent_join' };
        }
    }

    // 普通成员离开：从成员列表移除
    const members = allMembers.filter(m => m.openId !== openId);

    // 【修复 幽灵房间】如果房间成员为空或只剩房主，删除房间
    if (members.length === 0) {
        console.log('[roomManager] Room empty after leave, deleting:', roomId);
        await collection.where({ roomId }).remove();
        await removeTenHalfSecret(roomId);
        return { success: true, roomDeleted: true };
    }

    // 【修复】如果只剩房主一人，也删除房间（房主已不活跃）
    if (members.length === 1 && members[0].isHost) {
        const lastActive = room.lastActiveTime || 0;
        const STALE_TIME = 5 * 60 * 1000; // 5分钟
        if (now - lastActive > STALE_TIME) {
            console.log('[roomManager] Only stale host left, deleting:', roomId);
            await collection.where({ roomId }).remove();
            await removeTenHalfSecret(roomId);
            return { success: true, roomDeleted: true };
        }
    }

    const updateData = {
        members: members,
        lastActiveTime: now
    };
    const resetTenHalf = shouldResetTenHalfAfterExit(room, openId);
    if (resetTenHalf) {
        updateData.gameState = _.set(resetTenHalfGameState(room.gameState, openId));
        updateData.status = 'waiting';
    }

    await collection.where({ roomId }).update({ data: updateData });
    if (resetTenHalf) await removeTenHalfSecret(roomId);

    console.log('[roomManager] User left room:', roomId, openId);

    return { success: true };
}

/**
 * 获取房间信息
 */
async function handleGet(roomId) {
    if (!roomId) {
        return { success: false, error: '缺少房间ID' };
    }

    const collection = db.collection('GameRoom');
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: false, error: '房间不存在' };
    }

    const room = rooms[0];

    // 【优化】实时牌类以独立 Presence 为准，不能只因公开房间时间戳较旧就误删在线房间。
    const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 分钟
    if (room.lastActiveTime && (Date.now() - room.lastActiveTime) > ROOM_TIMEOUT) {
        const activePresence = isRealtimeCardGame(room.gameType)
            ? await hasActiveRealtimePresence(room, Date.now())
            : false;
        if (!activePresence) {
            console.log('[roomManager] Room expired, cleaning up:', roomId);
            await collection.doc(room._id).remove();
            if (room.gameType === 'tenhalf') await removeTenHalfSecret(roomId);
            if (room.gameType === 'queen') {
                await removeQueenSecretForRound(roomId, room.gameState && room.gameState.roundToken);
            }
            if (room.gameType === 'coward') await removeCowardSecret(roomId);
            return { success: false, error: '房间已过期' };
        }
        await collection.doc(room._id).update({ data: { lastActiveTime: Date.now() } });
    }

    return {
        success: true,
        room: {
            _id: room._id,
            roomId: room.roomId,
            hostOpenId: room.hostOpenId,
            gameType: room.gameType,
            status: room.status,
            members: room.members || [],
            gameState: room.gameState || {},
            maxMembers: isRealtimeCardGame(room.gameType)
                ? realtimeCardGameMaxMembers(room.gameType)
                : (room.maxMembers || 5)
        }
    };
}

/**
 * 【新增】清理过期房间（可由定时触发器调用）
 */
async function handleCleanup() {
    const collection = db.collection('GameRoom');
    const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 分钟
    const expireTime = Date.now() - ROOM_TIMEOUT;

    try {
        const expiredResult = await collection.where({
            lastActiveTime: _.lt(expireTime)
        }).limit(100).get();

        let removed = 0;
        let preservedActiveRooms = 0;
        let secretRemoved = 0;
        let queenSecretRemoved = 0;
        for (const room of expiredResult.data || []) {
            if (isRealtimeCardGame(room.gameType) && await hasActiveRealtimePresence(room, Date.now())) {
                await collection.doc(room._id).update({ data: { lastActiveTime: Date.now() } });
                preservedActiveRooms += 1;
                continue;
            }
            await collection.doc(room._id).remove();
            removed += 1;
            if (room.gameType === 'tenhalf') {
                await removeTenHalfSecret(room.roomId);
                secretRemoved += 1;
            } else if (room.gameType === 'queen') {
                const removedSecret = await removeQueenSecretForRound(
                    room.roomId,
                    room.gameState && room.gameState.roundToken
                );
                if (removedSecret) queenSecretRemoved += 1;
            } else if (room.gameType === 'coward') {
                await removeCowardSecret(room.roomId);
                secretRemoved += 1;
            }
        }

        let presenceRemoved = 0;
        try {
            const presenceResult = await db.collection(TEN_HALF_PRESENCE_COLLECTION).where({
                updatedAt: _.lt(new Date(expireTime))
            }).remove();
            presenceRemoved = presenceResult.stats?.removed || 0;
        } catch (error) {}

        console.log('[roomManager] Cleanup expired rooms:', removed, 'preserved active rooms:', preservedActiveRooms);
        return {
            success: true,
            removed: removed,
            preservedActiveRooms: preservedActiveRooms,
            secretRemoved: secretRemoved,
            queenSecretRemoved: queenSecretRemoved,
            presenceRemoved: presenceRemoved
        };
    } catch (err) {
        console.error('[roomManager] Cleanup failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 【新增】踢出不活跃成员
 * 当任意在线成员检测到其他成员超时未发送心跳时调用
 */
async function handleKickStale(openId, roomId, targetOpenId) {
    if (!roomId || !targetOpenId) {
        return { success: false, error: '缺少必要参数' };
    }

    const collection = db.collection('GameRoom');
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: true }; // 房间已不存在
    }

    const room = rooms[0];
    const members = room.members || [];

    // 验证调用者在房间中
    const callerInRoom = members.some(m => m.openId === openId);
    if (!callerInRoom) {
        return { success: false, error: '无权操作' };
    }

    // 检查目标是否在房间中
    const targetMember = members.find(m => m.openId === targetOpenId);
    if (!targetMember) {
        return { success: true }; // 目标已不在房间
    }

    if (isRealtimeCardGame(room.gameType)) {
        const staleMemberMs = realtimeStaleMemberMs(room.gameType);
        const presence = await findTenHalfPresence(roomId, targetOpenId);
        const activeAt = tenHalfMemberActiveAt(presence, targetMember);
        if (!activeAt || Date.now() - activeAt <= staleMemberMs) {
            return { success: true, skipped: true, reason: 'member_is_active' };
        }

        // 踢人前再读一次房间和心跳，避免“判定离线”到“执行删除”之间玩家已重连。
        const latestRoomResult = await collection.doc(room._id).get();
        const latestRoom = latestRoomResult.data;
        const latestMembers = latestRoom && latestRoom.members || [];
        const latestTarget = latestMembers.find(m => m.openId === targetOpenId);
        const latestCallerInRoom = latestMembers.some(m => m.openId === openId);
        if (!latestRoom || !latestTarget || !latestCallerInRoom) {
            return { success: true, skipped: true, reason: 'membership_changed' };
        }
        const latestPresence = await findTenHalfPresence(roomId, targetOpenId);
        const latestActiveAt = tenHalfMemberActiveAt(latestPresence, latestTarget);
        if (!latestActiveAt || Date.now() - latestActiveAt <= staleMemberMs) {
            return { success: true, skipped: true, reason: 'member_reconnected' };
        }

        // 胆小鬼的公开状态和私密牌必须在同一事务内重置，避免踢人清理误删刚开始的新一轮。
        if (latestRoom.gameType === 'coward') {
            return await handleCowardExit(
                targetOpenId,
                latestRoom._id,
                roomId,
                latestTarget.connectionId || ''
            );
        }

        // 后续删除必须以二次确认的成员快照为准。
        room.members = latestMembers;
    }

    // 从成员列表移除目标
    let newMembers = (room.members || members).filter(m => m.openId !== targetOpenId);
    const queenRoundToken = room.gameType === 'queen' && room.gameState
        ? room.gameState.roundToken || ''
        : '';

    // 如果房间为空，直接删除
    if (newMembers.length === 0) {
        await collection.where({ roomId }).remove();
        await removeTenHalfSecret(roomId);
        await removeQueenSecretForRound(roomId, queenRoundToken);
        await removeCowardSecret(roomId);
        console.log('[roomManager] Room deleted after kicking last stale member:', roomId);
        return { success: true, roomDeleted: true };
    }

    // 更新房间成员和清理 memberLastActive
    const updateData = {
        members: newMembers,
        lastActiveTime: Date.now()
    };
    if (isRealtimeCardGame(room.gameType) && room.hostOpenId === targetOpenId && newMembers.length > 0) {
        newMembers = newMembers.map((member, index) => ({ ...member, isHost: index === 0 }));
        updateData.members = newMembers;
        updateData.hostOpenId = newMembers[0].openId;
    }
    const resetTenHalf = shouldResetTenHalfAfterExit(room, targetOpenId);
    const resetQueen = shouldResetQueenAfterExit(room, targetOpenId);
    const resetNineGrid = shouldResetNineGridAfterExit(room, targetOpenId);
    const resetCoward = shouldResetCowardAfterExit(room, targetOpenId);
    if (resetTenHalf || resetQueen || resetNineGrid || resetCoward) {
        updateData.gameState = _.set(resetQueen
            ? resetQueenGameState(room.gameState)
            : (resetNineGrid
                ? resetNineGridGameState(room.gameState)
                : (resetCoward
                    ? resetCowardGameState(room.gameState)
                    : resetTenHalfGameState(room.gameState, targetOpenId))));
        updateData.status = 'waiting';
    } else if (!isRealtimeCardGame(room.gameType)) {
        // 清理被踢成员的 lastActive 记录
        updateData[`gameState.memberLastActive.${targetOpenId}`] = _.remove();
    }

    if (isRealtimeCardGame(room.gameType)) {
        await collection.doc(room._id).update({ data: updateData });
    } else {
        await collection.where({ roomId }).update({ data: updateData });
    }
    if (resetTenHalf) await removeTenHalfSecret(roomId);
    if (resetQueen) await removeQueenSecretForRound(roomId, queenRoundToken);
    if (resetCoward) await removeCowardSecret(roomId);

    console.log('[roomManager] Kicked stale member:', targetOpenId, 'from room:', roomId);

    return { success: true, kicked: targetOpenId };
}

/**
 * 【新增】原子操作：开始新一轮测试（喝醉了吗游戏）
 * 使用云函数原子生成 roundId，解决多人同时开始导致的 roundId 冲突问题
 */
async function handleStartRound(openId, roomId) {
    if (!roomId) {
        return { success: false, error: '缺少房间ID' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');

    // 查找房间
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: false, error: '房间不存在' };
    }

    const room = rooms[0];

    // 验证是房间成员
    const members = room.members || [];
    const isMember = members.some(m => m.openId === openId);

    if (!isMember) {
        return { success: false, error: '不是房间成员' };
    }

    const currentState = room.gameState || {};

    // 如果已经有有效的 roundId，直接返回（避免多人同时开始时重复创建）
    if (currentState.currentRoundId) {
        console.log('[roomManager] Round already started, reusing:', currentState.currentRoundId);
        return {
            success: true,
            roundId: currentState.currentRoundId,
            isExisting: true
        };
    }

    // 原子生成新的 roundId
    const newRoundId = `${now}_${openId.substring(0, 6)}_${Math.random().toString(36).substring(2, 6)}`;

    // 使用条件更新，只有当 currentRoundId 不存在或为空时才更新
    // 这是原子操作的关键
    try {
        await collection.doc(room._id).update({
            data: {
                'gameState.currentRoundId': newRoundId,
                'gameState.playerResults': {},
                'gameState.isNewRound': false,
                'lastActiveTime': now
            }
        });

        console.log('[roomManager] New round started:', newRoundId);

        return {
            success: true,
            roundId: newRoundId,
            isExisting: false
        };
    } catch (err) {
        // 如果更新失败（并发冲突），重新获取当前 roundId
        const { data: updatedRooms } = await collection.where({ roomId }).limit(1).get();
        if (updatedRooms.length > 0 && updatedRooms[0].gameState?.currentRoundId) {
            return {
                success: true,
                roundId: updatedRooms[0].gameState.currentRoundId,
                isExisting: true
            };
        }
        throw err;
    }
}

/**
 * 【新增】原子操作：开始新一轮游戏（点老头游戏）
 * 使用云函数原子生成 targetIndex 和 round，解决多人同时开始导致的状态不一致问题
 */
async function handleStartNewRound(openId, roomId, gameType) {
    if (!roomId) {
        return { success: false, error: '缺少房间ID' };
    }

    const now = Date.now();
    const collection = db.collection('GameRoom');

    // 查找房间
    const { data: rooms } = await collection.where({ roomId }).limit(1).get();

    if (rooms.length === 0) {
        return { success: false, error: '房间不存在' };
    }

    const room = rooms[0];

    // 验证是房间成员
    const members = room.members || [];
    const isMember = members.some(m => m.openId === openId);

    if (!isMember) {
        return { success: false, error: '不是房间成员' };
    }

    const currentState = room.gameState || {};
    const currentRound = currentState.round || 0;
    const newRound = currentRound + 1;

    // 生成新的 targetIndex（0-15）
    const newTargetIndex = Math.floor(Math.random() * 16);

    // 生成唯一的轮次标识，用于防止重复触发
    const roundToken = `${newRound}_${now}`;

    // 检查是否已经有人在启动新一轮（防止并发）
    // 使用 roundToken 作为锁
    if (currentState.pendingNewRound && (now - currentState.pendingNewRoundTime < 2000)) {
        // 2秒内已有人触发新一轮，返回当前状态
        console.log('[roomManager] New round already pending, skipping');
        return {
            success: true,
            targetIndex: currentState.targetIndex,
            round: currentRound,
            isPending: true
        };
    }

    // 生成16个老头的初始状态
    const oldmen = [];
    for (let i = 0; i < 16; i++) {
        oldmen.push({
            id: i,
            isVisible: true,
            flyDirection: ''
        });
    }

    // 更新游戏状态
    await collection.doc(room._id).update({
        data: {
            gameState: {
                gamePhase: 'playing',
                oldmen: oldmen,
                targetIndex: newTargetIndex,
                remainingCount: 16,
                foundBy: null,
                round: newRound,
                roundToken: roundToken,
                isNewRoundReset: true,
                clickedIndex: -1,
                clickedFlyDirection: '',
                pendingNewRound: false,
                pendingNewRoundTime: 0,
                memberLastActive: currentState.memberLastActive || {}
            },
            lastActiveTime: now
        }
    });

    console.log('[roomManager] New oldman round started:', newRound, 'targetIndex:', newTargetIndex);

    return {
        success: true,
        targetIndex: newTargetIndex,
        round: newRound,
        oldmen: oldmen,
        roundToken: roundToken
    };
}

// ==================== 十点半联机游戏 ====================

async function findRoomDocument(roomId) {
    const { data: rooms } = await db.collection('GameRoom').where({ roomId }).limit(1).get();
    return rooms[0] || null;
}

async function resolveRoomDocumentId(roomId, roomDocId) {
    if (roomDocId) return String(roomDocId);
    const room = await findRoomDocument(roomId);
    return room && room._id || '';
}

function isTenHalfRoundActive(state) {
    return state && state.gameKind === 'tenhalf' &&
        ['dealing', 'auction', 'auctionResult', 'dice'].includes(state.phase);
}

function cloneTenHalfState(state) {
    return JSON.parse(JSON.stringify(state || {}));
}

function openTenHalfAuction(state, secret, auctionIndex, now) {
    const next = cloneTenHalfState(state);
    const order = next.playerOrder || [];
    const card = secret.auctionCards && secret.auctionCards[auctionIndex];

    if (!card || order.length === 0) {
        return settleTenHalfRound(next, secret, now);
    }

    next.phase = 'auction';
    next.auctionIndex = auctionIndex;
    next.currentCard = card;
    next.currentPrice = 0;
    next.currentBidType = '';
    next.leaderOpenId = '';
    next.choiceRound = 1;
    next.bidRevision = 0;
    next.leaderSince = 0;
    next.roundChoices = [];
    next.auctionActiveOpenIds = order.slice();
    next.passedOpenIds = [];
    next.auctionTopOffers = [];
    next.activePlayerOpenId = '';
    next.deadlineAt = now + TEN_HALF_TURN_MS;
    next.auctionOutcome = null;
    next.lastEvent = {
        type: 'reveal',
        auctionIndex: auctionIndex,
        at: now
    };
    next.version = (next.version || 0) + 1;
    return bumpTenHalfStateRevision(next);
}

function settleTenHalfAuction(state, now) {
    const next = cloneTenHalfState(state);
    const players = next.players || [];
    const leaderIndex = players.findIndex((player) => player.openId === next.leaderOpenId);
    let outcome;

    if (leaderIndex < 0 || !next.leaderOpenId) {
        outcome = {
            type: 'discarded',
            card: next.currentCard,
            price: 0,
            at: now
        };
    } else {
        const player = players[leaderIndex];
        player.debt = (player.debt || 0) + (next.currentPrice || 0);

        if (next.currentBidType === 'bid') {
            player.publicCards = (player.publicCards || []).concat([next.currentCard]);
            outcome = {
                type: 'won',
                playerOpenId: player.openId,
                seat: player.seat,
                price: next.currentPrice,
                card: next.currentCard,
                at: now
            };
        } else {
            outcome = {
                type: 'killed',
                playerOpenId: player.openId,
                seat: player.seat,
                price: next.currentPrice,
                card: next.currentCard,
                at: now
            };
        }
    }

    next.players = players;
    next.phase = 'auctionResult';
    next.activePlayerOpenId = '';
    next.roundChoices = [];
    next.auctionActiveOpenIds = [];
    next.auctionTopOffers = [];
    next.deadlineAt = now + TEN_HALF_RESULT_MS;
    next.auctionOutcome = outcome;
    next.lastEvent = outcome;
    next.version = (next.version || 0) + 1;
    return bumpTenHalfStateRevision(next);
}

function resolveTenHalfAuctionDeadline(state, now) {
    // 截止时间只负责成交当前唯一的权威领价；没有任何人出价时公牌作废。
    // 领价由每次拍/杀请求的数据库事务即时写入，不再批量收集“同价轮次”。
    return settleTenHalfAuction(state, now);
}

function settleTenHalfRound(state, secret, now) {
    const next = cloneTenHalfState(state);
    const hands = (secret.hands || []).reduce((map, item) => {
        map[item.openId] = item.card;
        return map;
    }, {});

    let minimumSafePoints = Infinity;
    const calculated = (next.players || []).map((player) => {
        const holeCard = hands[player.openId] || null;
        const cards = [holeCard].concat(player.publicCards || []).filter(Boolean);
        const points = cards.reduce((sum, card) => sum + tenHalfCardPoints(card), 0);
        const busted = points > 10.5;
        if (!busted && points < minimumSafePoints) {
            minimumSafePoints = points;
        }
        return {
            ...player,
            holeCard: holeCard,
            points: points,
            pointsText: tenHalfDisplayPoints(points),
            busted: busted
        };
    });

    const tenHalfCount = calculated.filter((player) => player.points === 10.5).length;
    const multiplier = Math.pow(2, tenHalfCount);
    const players = calculated.map((player) => {
        const isLoser = player.busted || (!player.busted && player.points === minimumSafePoints);
        return {
            ...player,
            isLoser: isLoser,
            rollFinalized: !isLoser
        };
    });

    next.players = players;
    next.phase = 'dice';
    next.activePlayerOpenId = '';
    next.currentCard = null;
    next.deadlineAt = 0;
    next.tenHalfCount = tenHalfCount;
    next.multiplier = multiplier;
    next.auctionOutcome = null;
    next.lastEvent = {
        type: 'settled',
        tenHalfCount: tenHalfCount,
        multiplier: multiplier,
        at: now
    };
    next.version = (next.version || 0) + 1;
    return bumpTenHalfStateRevision(next);
}

async function handleTenHalfHeartbeat(openId, roomId, connectionId) {
    if (!roomId) return { success: false, error: '缺少房间ID' };
    const room = await findRoomDocument(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.gameType !== 'tenhalf') return { success: false, error: '房间不是十点半游戏' };
    if (!(room.members || []).some((member) => member.openId === openId)) {
        return { success: false, error: '不是房间成员' };
    }

    // 仅供旧客户端兼容；新客户端会直接写 TenHalfPresence，不再为心跳调用云函数。
    await upsertTenHalfPresence(openId, roomId, connectionId);
    return { success: true, serverTime: Date.now() };
}

async function handleTenHalfStart(openId, roomId) {
    if (!roomId) return { success: false, error: '缺少房间ID' };
    tenHalfDebug('收到开始游戏请求', roomId);
    const roomDoc = await findRoomDocument(roomId);
    if (!roomDoc) {
        tenHalfDebug('开始失败：房间不存在', roomId);
        return { success: false, error: '房间不存在' };
    }

    const transactionResult = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDoc._id).get();
        const room = roomResult.data;
        const members = room.members || [];

        if (!members.some((member) => member.openId === openId)) {
            return { success: false, error: '不是房间成员' };
        }
        if (room.gameType !== 'tenhalf') {
            return { success: false, error: '房间不是十点半游戏' };
        }
        if (members.length < 2) {
            return { success: false, error: '至少需要2位玩家', needMorePlayers: true };
        }
        if (members.length > TEN_HALF_MAX_MEMBERS) {
            return { success: false, error: '十点半最多支持6位玩家' };
        }

        const currentState = room.gameState || {};
        if (isTenHalfRoundActive(currentState)) {
            tenHalfDebug('开始请求命中已在进行的牌局', roomId, {
                '阶段': currentState.phase,
                '版本': currentState.version
            });
            return { success: true, alreadyStarted: true, state: currentState };
        }

        const now = Date.now();
        const deck = createTenHalfDeck();
        const auctionTotal = 8 + Math.floor(Math.random() * 3);
        const round = (currentState.round || 0) + 1;
        const roundToken = 'tenhalf_' + now + '_' + crypto.randomBytes(5).toString('hex');
        const playerOrder = members.map((member) => member.openId);
        const hands = playerOrder.map((playerOpenId) => ({
            openId: playerOpenId,
            card: deck.pop()
        }));
        const auctionCards = [];
        for (let i = 0; i < auctionTotal; i++) {
            auctionCards.push(deck.pop());
        }

        const players = playerOrder.map((playerOpenId, index) => ({
            openId: playerOpenId,
            seat: index + 1,
            publicCards: [],
            debt: 0,
            cardCount: 1,
            holeCard: null,
            points: null,
            pointsText: '',
            busted: false,
            isLoser: false,
            rollFinalized: false
        }));

        const state = {
            gameKind: 'tenhalf',
            phase: 'dealing',
            version: (currentState.version || 0) + 1,
            stateRevision: currentState.stateRevision,
            round: round,
            roundToken: roundToken,
            playerOrder: playerOrder,
            players: players,
            auctionTotal: auctionTotal,
            auctionIndex: -1,
            currentCard: null,
            currentPrice: 0,
            currentBidType: '',
            leaderOpenId: '',
            activePlayerOpenId: '',
            choiceRound: 0,
            bidRevision: 0,
            leaderSince: 0,
            roundChoices: [],
            auctionActiveOpenIds: [],
            passedOpenIds: [],
            auctionTopOffers: [],
            deadlineAt: now + TEN_HALF_DEAL_MS,
            auctionOutcome: null,
            tenHalfCount: 0,
            multiplier: 1,
            memberLastActive: currentState.memberLastActive || {},
            lastEvent: { type: 'deal', at: now }
        };
        bumpTenHalfStateRevision(state);

        const secret = {
            roomId: roomId,
            roundToken: roundToken,
            hands: hands,
            auctionCards: auctionCards,
            createdTime: now
        };

        tenHalfDebug('已生成私密牌堆，准备写入事务', roomId, {
            '玩家数': playerOrder.length,
            '公牌数': auctionTotal,
            '局数': round,
            '版本': state.version,
            '发牌截止时间': state.deadlineAt
        });

        await transaction.collection(TEN_HALF_SECRET_COLLECTION)
            .doc(tenHalfSecretId(roomId))
            .set({ data: secret });
        await transaction.collection('GameRoom').doc(room._id).update({
            data: {
                gameState: _.set(state),
                status: 'playing',
                lastActiveTime: now
            }
        });

        tenHalfDebug('事务内已写入私密牌堆与发牌状态，等待提交', roomId, {
            '阶段': state.phase,
            '版本': state.version,
            '预计等待毫秒': TEN_HALF_DEAL_MS
        });

        const myHand = hands.find((item) => item.openId === openId);
        return {
            success: true,
            state: state,
            privateHand: myHand ? myHand.card : null
        };
    });
    tenHalfDebug('开始牌局事务已提交', roomId, {
        '是否成功': !!transactionResult.success,
        '返回阶段': transactionResult.state && transactionResult.state.phase,
        '返回版本': transactionResult.state && transactionResult.state.version,
        '错误': transactionResult.error || ''
    });
    return { ...transactionResult, serverTime: Date.now() };
}

async function handleTenHalfGetHand(openId, roomId, roundToken) {
    if (!roomId || !roundToken) return { success: false, error: '缺少必要参数', serverTime: Date.now() };
    tenHalfDebug('收到领取私密底牌请求', roomId);
    const room = await findRoomDocument(roomId);
    if (!room) {
        tenHalfDebug('领取底牌失败：房间不存在', roomId);
        return { success: false, error: '房间不存在', serverTime: Date.now() };
    }
    const state = room.gameState || {};
    const isPlayer = (state.playerOrder || []).includes(openId);
    if (!isPlayer || state.roundToken !== roundToken) {
        tenHalfDebug('领取底牌被拒绝：玩家身份或本局标识不匹配', roomId, {
            '是否本局玩家': isPlayer,
            '阶段': state.phase,
            '版本': state.version
        });
        return { success: false, error: '本局无私密底牌', serverTime: Date.now() };
    }

    const secretResult = await db.collection(TEN_HALF_SECRET_COLLECTION)
        .doc(tenHalfSecretId(roomId))
        .get();
    const secret = secretResult.data || {};
    if (secret.roundToken !== roundToken) {
        tenHalfDebug('领取底牌失败：私密文档的本局标识已过期', roomId, {
            '阶段': state.phase,
            '版本': state.version
        });
        return { success: false, error: '底牌已过期', serverTime: Date.now() };
    }
    const hand = (secret.hands || []).find((item) => item.openId === openId);
    tenHalfDebug(hand ? '当前玩家已成功领取底牌' : '领取底牌失败：私密文档内没有该玩家', roomId, {
        '阶段': state.phase,
        '版本': state.version,
        '私密底牌记录数': (secret.hands || []).length
    });
    return hand
        ? { success: true, card: hand.card, serverTime: Date.now() }
        : { success: false, error: '未找到底牌', serverTime: Date.now() };
}

async function handleTenHalfAdvance(openId, roomId, expectedVersion) {
    if (!roomId) return { success: false, error: '缺少房间ID' };
    tenHalfDebug('收到阶段自动推进请求', roomId, {
        '客户端期望版本': expectedVersion
    });
    const roomDoc = await findRoomDocument(roomId);
    if (!roomDoc) {
        tenHalfDebug('阶段推进失败：房间不存在', roomId);
        return { success: false, error: '房间不存在' };
    }

    const transactionResult = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDoc._id).get();
        const room = roomResult.data;
        const state = room.gameState || {};
        const members = room.members || [];
        tenHalfDebug('已读取待推进的房间状态', roomId, {
            '阶段': state.phase,
            '云端版本': state.version,
            '客户端期望版本': expectedVersion,
            '房间成员数': members.length,
            '距离截止毫秒': Number(state.deadlineAt || 0) - Date.now()
        });
        if (!members.some((member) => member.openId === openId)) {
            tenHalfDebug('阶段推进被拒绝：调用者已不在房间', roomId);
            return { success: false, error: '不是房间成员' };
        }
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) {
            tenHalfDebug('阶段推进忽略：客户端版本已过期', roomId, {
                '云端版本': state.version,
                '客户端期望版本': expectedVersion
            });
            return { success: true, stale: true, state: state };
        }
        if (state.phase !== 'dealing' && state.phase !== 'auctionResult') {
            tenHalfDebug('阶段推进忽略：当前阶段不需要自动推进', roomId, {
                '阶段': state.phase,
                '版本': state.version
            });
            return { success: true, state: state };
        }

        const now = Date.now();
        if (state.deadlineAt && now < state.deadlineAt) {
            tenHalfDebug('阶段推进暂缓：云端倒计时尚未结束', roomId, {
                '剩余毫秒': state.deadlineAt - now,
                '阶段': state.phase,
                '版本': state.version
            });
            return { success: true, tooEarly: true, state: state };
        }

        const secretResult = await transaction.collection(TEN_HALF_SECRET_COLLECTION)
            .doc(tenHalfSecretId(roomId))
            .get();
        const secret = secretResult.data;
        if (!secret || secret.roundToken !== state.roundToken) {
            tenHalfDebug('阶段推进失败：私密牌堆不存在或本局标识不匹配', roomId, {
                '阶段': state.phase,
                '版本': state.version,
                '是否读到私密文档': !!secret
            });
            return { success: false, error: '本局私密牌堆不存在' };
        }

        tenHalfDebug('私密牌堆校验通过，开始生成下一阶段', roomId, {
            '当前阶段': state.phase,
            '当前版本': state.version,
            '公牌总数': (secret.auctionCards || []).length
        });

        let nextState;
        if (state.phase === 'dealing') {
            nextState = openTenHalfAuction(state, secret, 0, now);
        } else {
            const nextIndex = (state.auctionIndex || 0) + 1;
            nextState = nextIndex < state.auctionTotal
                ? openTenHalfAuction(state, secret, nextIndex, now)
                : settleTenHalfRound(state, secret, now);
        }

        await transaction.collection('GameRoom').doc(room._id).update({
            data: {
                gameState: _.set(nextState),
                status: nextState.phase === 'finished' ? 'waiting' : 'playing',
                lastActiveTime: now
            }
        });
        tenHalfDebug('阶段推进成功', roomId, {
            '原阶段': state.phase,
            '新阶段': nextState.phase,
            '原版本': state.version,
            '新版本': nextState.version,
            '公牌进度': nextState.auctionIndex
        });
        return { success: true, state: nextState };
    });
    tenHalfDebug('阶段推进事务已提交', roomId, {
        '是否成功': !!transactionResult.success,
        '是否过早': !!transactionResult.tooEarly,
        '是否版本过期': !!transactionResult.stale,
        '返回阶段': transactionResult.state && transactionResult.state.phase,
        '返回版本': transactionResult.state && transactionResult.state.version,
        '错误': transactionResult.error || ''
    });
    return { ...transactionResult, serverTime: Date.now() };
}

async function handleTenHalfAction(
    openId,
    roomId,
    roomDocId,
    choice,
    expectedRoundToken,
    expectedAuctionIndex,
    expectedChoiceRound,
    expectedCurrentPrice
) {
    if (!['bid', 'kill', 'pass'].includes(choice)) {
        return { success: false, error: '无效操作' };
    }
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };

    const transactionResult = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        if (!room || room.roomId !== roomId) {
            return { success: false, error: '房间不存在' };
        }
        const state = cloneTenHalfState(room.gameState || {});
        if (!(room.members || []).some((member) => member.openId === openId)) {
            return { success: false, error: '不是房间成员' };
        }
        if (state.phase !== 'auction') return { success: true, stale: true, state: state };
        const choiceRound = Math.max(1, Number(state.choiceRound) || 1);
        if ((expectedRoundToken && expectedRoundToken !== state.roundToken) ||
            (expectedAuctionIndex !== undefined && Number(expectedAuctionIndex) !== Number(state.auctionIndex)) ||
            (choice !== 'pass' && expectedChoiceRound !== undefined &&
                Number(expectedChoiceRound) !== choiceRound)) {
            return { success: true, stale: true, state: state };
        }
        if (choice !== 'pass' && expectedCurrentPrice !== undefined &&
            Number(expectedCurrentPrice) !== Number(state.currentPrice || 0)) {
            // 多人从同一价格同时按下时，事务先提交者获得该价格；晚到请求不能
            // 悄悄按新的价格继续加价，必须先看到新的权威领价后再主动出手。
            return { success: true, stale: true, priceChanged: true, state: state };
        }
        if (!(state.playerOrder || []).includes(openId)) {
            return { success: false, error: '旁观者不能参与竞拍', state: state };
        }
        if (state.leaderOpenId && state.leaderOpenId === openId) {
            return {
                success: false,
                inactive: true,
                error: '你正在领价，等待其他玩家选择',
                state: state
            };
        }
        let auctionActiveOpenIds = (
            Array.isArray(state.auctionActiveOpenIds) && state.auctionActiveOpenIds.length
                ? state.auctionActiveOpenIds
                : (state.playerOrder || []).filter((playerOpenId) =>
                    !(state.passedOpenIds || []).includes(playerOpenId)
                )
        ).filter((playerOpenId) => (state.playerOrder || []).includes(playerOpenId));
        if (state.leaderOpenId && (state.playerOrder || []).includes(state.leaderOpenId) &&
            !(state.passedOpenIds || []).includes(state.leaderOpenId) &&
            !auctionActiveOpenIds.includes(state.leaderOpenId)) {
            auctionActiveOpenIds.push(state.leaderOpenId);
        }
        if (!auctionActiveOpenIds.includes(openId)) {
            return {
                success: false,
                inactive: true,
                error: state.leaderOpenId === openId ? '你正在领价，等待其他玩家选择' : '当前不能参与竞拍',
                state: state
            };
        }
        const now = Date.now();
        if (state.deadlineAt && now >= state.deadlineAt) {
            const nextState = resolveTenHalfAuctionDeadline(state, now);
            await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
                data: {
                    gameState: _.set(nextState),
                    lastActiveTime: now
                }
            });
            return { success: true, expired: true, state: nextState };
        }

        if (choice === 'pass') {
            if ((state.passedOpenIds || []).includes(openId)) {
                return { success: true, alreadySubmitted: true, state: state };
            }
            state.passedOpenIds = (state.passedOpenIds || []).concat([openId]);
            auctionActiveOpenIds = auctionActiveOpenIds.filter((playerOpenId) => playerOpenId !== openId);
            state.auctionActiveOpenIds = auctionActiveOpenIds;
            state.roundChoices = [];
            state.auctionTopOffers = state.leaderOpenId ? [{
                openId: state.leaderOpenId,
                choice: state.currentBidType,
                price: Number(state.currentPrice || 0),
                at: Number(state.leaderSince || 0)
            }] : [];
            state.version = (state.version || 0) + 1;
            state.lastEvent = { type: 'pass', playerOpenId: openId, at: now };

            // “过”代表永久退出当前公牌。只剩领价者时立即成交；无人出价且
            // 所有人都过时直接作废。其余情况沿用当前截止时间，不重置十秒。
            const nextState = (state.leaderOpenId &&
                    auctionActiveOpenIds.every((playerOpenId) => playerOpenId === state.leaderOpenId)) ||
                (!state.leaderOpenId && auctionActiveOpenIds.length === 0)
                ? settleTenHalfAuction(state, now)
                : bumpTenHalfStateRevision(state);
            await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
                data: {
                    gameState: _.set(nextState),
                    lastActiveTime: now
                }
            });
            return { success: true, state: nextState };
        }

        const nextPrice = Number(state.currentPrice || 0) + 1;
        state.auctionActiveOpenIds = auctionActiveOpenIds;
        state.currentPrice = nextPrice;
        state.currentBidType = choice;
        state.leaderOpenId = openId;
        state.leaderSince = now;
        state.bidRevision = Number(state.bidRevision || 0) + 1;
        state.choiceRound = choiceRound + 1;
        state.roundChoices = [];
        state.auctionTopOffers = [{
            openId: openId,
            choice: choice,
            price: nextPrice,
            at: now
        }];
        state.deadlineAt = now + TEN_HALF_TURN_MS;
        state.version = (state.version || 0) + 1;
        state.lastEvent = {
            type: 'leadingOffer',
            playerOpenId: openId,
            choice: choice,
            price: nextPrice,
            at: now
        };

        // 若其他玩家都已经“过”，这笔唯一报价可以立即成交；否则这笔新
        // 最高价原子地开启一个全新的十秒反价窗口。
        const hasOtherContender = auctionActiveOpenIds.some((playerOpenId) => playerOpenId !== openId);
        const nextState = hasOtherContender
            ? bumpTenHalfStateRevision(state)
            : settleTenHalfAuction(state, now);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: {
                gameState: _.set(nextState),
                lastActiveTime: now
            }
        });
        return { success: true, state: nextState };
    });
    return { ...transactionResult, serverTime: Date.now() };
}

async function handleTenHalfTimeout(
    openId,
    roomId,
    roomDocId,
    expectedVersion,
    expectedRoundToken,
    expectedAuctionIndex,
    expectedChoiceRound,
    expectedDeadlineAt
) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };

    const transactionResult = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        if (!room || room.roomId !== roomId) {
            return { success: false, error: '房间不存在' };
        }
        const state = room.gameState || {};
        if (!(room.members || []).some((member) => member.openId === openId)) {
            return { success: false, error: '不是房间成员' };
        }
        if (state.phase !== 'auction') return { success: true, stale: true, state: state };
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) {
            return { success: true, stale: true, state: state };
        }
        if ((expectedRoundToken && expectedRoundToken !== state.roundToken) ||
            (expectedAuctionIndex !== undefined && Number(expectedAuctionIndex) !== Number(state.auctionIndex)) ||
            (expectedChoiceRound !== undefined && Number(expectedChoiceRound) !== Number(state.choiceRound)) ||
            (expectedDeadlineAt !== undefined && Number(expectedDeadlineAt) !== Number(state.deadlineAt))) {
            return { success: true, stale: true, state: state };
        }

        const now = Date.now();
        if (!state.deadlineAt || now < state.deadlineAt) {
            return { success: true, tooEarly: true, state: state };
        }
        const nextState = resolveTenHalfAuctionDeadline(state, now);

        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: {
                gameState: _.set(nextState),
                lastActiveTime: now
            }
        });
        return { success: true, state: nextState };
    });
    return { ...transactionResult, serverTime: Date.now() };
}

async function handleTenHalfRoll(openId, roomId) {
    const roomDoc = await findRoomDocument(roomId);
    if (!roomDoc) return { success: false, error: '房间不存在' };

    return await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDoc._id).get();
        const room = roomResult.data;
        const state = cloneTenHalfState(room.gameState || {});
        if (!(room.members || []).some((member) => member.openId === openId)) {
            return { success: false, error: '不是房间成员' };
        }
        if (state.phase !== 'dice') return { success: true, stale: true, state: state };

        const playerIndex = (state.players || []).findIndex((player) => player.openId === openId);
        const player = playerIndex >= 0 ? state.players[playerIndex] : null;
        if (!player || !player.isLoser) {
            return { success: false, error: '你不需要摇骰子' };
        }
        if (player.rollFinalized) {
            return { success: true, state: state, alreadyFinalized: true };
        }

        player.rollFinalized = true;
        // 兼容并清理旧版本曾写入房间状态的本地骰子结果。
        delete player.rolls;
        delete player.bestRoll;
        delete player.dicePenalty;
        delete player.totalDrinks;
        state.players[playerIndex] = player;
        state.version = (state.version || 0) + 1;
        bumpTenHalfStateRevision(state);
        state.lastEvent = {
            type: 'rollFinalized',
            playerOpenId: openId,
            seat: player.seat,
            at: Date.now()
        };

        const losers = state.players.filter((item) => item.isLoser);
        if (losers.length > 0 && losers.every((item) => item.rollFinalized)) {
            state.phase = 'finished';
            state.lastEvent = { type: 'finished', at: Date.now() };
        }

        await transaction.collection('GameRoom').doc(room._id).update({
            data: {
                gameState: _.set(state),
                status: 'playing',
                lastActiveTime: Date.now()
            }
        });
        return { success: true, state: state };
    });
}

async function handleTenHalfFinishRound(openId, roomId, expectedVersion) {
    const roomDoc = await findRoomDocument(roomId);
    if (!roomDoc) return { success: false, error: '房间不存在' };

    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(roomDoc._id).get();
        const room = roomResult.data;
        const state = room.gameState || {};
        if (!(room.members || []).some((member) => member.openId === openId)) {
            return { success: false, error: '不是房间成员' };
        }
        if (room.gameType !== 'tenhalf') {
            return { success: false, error: '房间不是十点半游戏' };
        }
        if (state.phase === 'waiting') {
            return { success: true, state: state, alreadyFinished: true };
        }
        if (state.phase !== 'finished') {
            return { success: false, error: '仍有输家没有完成摇骰子', state: state };
        }
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) {
            return { success: true, stale: true, state: state };
        }

        const losers = (state.players || []).filter((player) => player.isLoser);
        if (!losers.length || !losers.every((player) => player.rollFinalized)) {
            return { success: false, error: '仍有输家没有完成摇骰子', state: state };
        }

        const nextState = resetTenHalfGameState(state);
        await transaction.collection('GameRoom').doc(room._id).update({
            data: {
                gameState: _.set(nextState),
                status: 'waiting',
                lastActiveTime: Date.now()
            }
        });
        return { success: true, completed: true, state: nextState };
    });

    return result;
}

// ==================== 大姐牌联机游戏 ====================

function cloneQueenState(state) {
    return JSON.parse(JSON.stringify(state || {}));
}

function createQueenDeck() {
    const suits = [
        { key: 'spade', symbol: '♠', color: 'black' },
        { key: 'heart', symbol: '♥', color: 'red' },
        { key: 'diamond', symbol: '♦', color: 'red' },
        { key: 'club', symbol: '♣', color: 'black' }
    ];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    suits.forEach((suit) => {
        ranks.forEach((rank) => {
            deck.push({
                id: 'queen-' + suit.key + '-' + rank,
                rank: rank,
                suitKey: suit.key,
                suit: suit.symbol,
                color: suit.color,
                isJoker: false
            });
        });
    });
    for (let index = deck.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const card = deck[index];
        deck[index] = deck[swapIndex];
        deck[swapIndex] = card;
    }
    return deck;
}

function queenSecretDrawIndex(secret) {
    return Math.max(0, Number(secret && secret.drawIndex) || 0);
}

function queenSecretRemainingCards(secret) {
    const deck = secret && Array.isArray(secret.deck) ? secret.deck : [];
    return Math.max(0, deck.length - queenSecretDrawIndex(secret));
}

function queenPlayer(state, openId) {
    return (state.players || []).find((player) => player.openId === openId) || null;
}

function queenIsPlayer(state, openId) {
    return (state.playerOrder || []).includes(openId);
}

function queenAdvanceTurn(state, now) {
    const next = state;
    const order = next.playerOrder || [];
    next.currentCard = null;
    next.effect = null;
    next.activePlayerOpenId = '';
    next.deadlineAt = 0;
    next.linkBoard = [];
    next.linkSelected = null;
    next.mineCells = [];
    next.medusaSubmitted = [];
    next.cameraPressed = [];
    next.nextActionAt = 0;
    if (!order.length || Number(next.remainingCards || 0) <= 0) {
        next.phase = 'finished';
        next.lastEvent = { type: 'finished', at: now };
    } else {
        next.currentTurnIndex = (Number(next.currentTurnIndex) + 1) % order.length;
        next.currentPlayerOpenId = order[next.currentTurnIndex];
        next.phase = 'normal';
        next.lastEvent = { type: 'turn', playerOpenId: next.currentPlayerOpenId, at: now };
    }
    next.version = (next.version || 0) + 1;
    return bumpTenHalfStateRevision(next);
}

function queenCommitResult(state, resultEffect, now) {
    const effect = resultEffect || {};
    const resultCard = state.currentCard ? cloneQueenState(state.currentCard) : null;
    const visibleUntil = Date.now() + QUEEN_RESULT_MS;

    // 结果产生时云端已经推进到下一阶段；结果卡片只作为短时公开事件供客户端本地展示。
    if (effect.advanceTurn === false) {
        const interrupted = effect.interrupted;
        state.phase = interrupted && interrupted.phase || effect.resumePhase || 'normal';
        state.effect = interrupted && interrupted.effect || null;
        state.currentCard = interrupted && interrupted.currentCard || null;
        state.activePlayerOpenId = interrupted && interrupted.activePlayerOpenId || '';
        state.deadlineAt = interrupted && interrupted.remainingMs
            ? visibleUntil + interrupted.remainingMs
            : 0;
        state.version = (state.version || 0) + 1;
        bumpTenHalfStateRevision(state);
    } else {
        queenAdvanceTurn(state, now);
    }

    state.nextActionAt = visibleUntil;
    state.resultEvent = {
        id: 'queen_result_' + String(state.roundToken || state.round || '') + '_' + state.version + '_' + now,
        effect: effect,
        card: resultCard,
        visibleUntil: visibleUntil
    };
    state.lastEvent = { type: 'result', resultType: effect.type, at: now };
    return state;
}

function queenOpenResult(state, effect, now, options) {
    const settings = options || {};
    const resultEffect = {
        ...(effect || {}),
        advanceTurn: settings.advanceTurn !== false,
        resumePhase: settings.resumePhase || '',
        at: now
    };
    const recipients = (resultEffect.recipients || []).filter((item) => Number(item.amount || 0) > 0);
    const toiletPlayerIds = recipients
        .map((item) => item.openId)
        .filter((openId, index, values) => {
            const player = queenPlayer(state, openId);
            return values.indexOf(openId) === index && player && Number(player.toiletCards || 0) > 0;
        });

    if (toiletPlayerIds.length) {
        state.phase = 'toiletPrompt';
        state.effect = {
            type: 'toiletPrompt',
            pendingOpenIds: toiletPlayerIds,
            pendingResult: resultEffect,
            at: now
        };
        state.deadlineAt = 0;
        state.activePlayerOpenId = '';
        state.version = (state.version || 0) + 1;
        state.lastEvent = { type: 'toiletPrompt', playerOpenIds: toiletPlayerIds, at: now };
        return bumpTenHalfStateRevision(state);
    }

    return queenCommitResult(state, resultEffect, now);
}

function queenDrinkTargets(state, targetOpenIds, amount, reason) {
    const baseAmount = Math.max(0, Number(amount) || 0);
    const primary = Array.from(new Set((targetOpenIds || []).filter(Boolean)));
    const amounts = {};
    primary.forEach((openId) => { amounts[openId] = (amounts[openId] || 0) + baseAmount; });
    (state.cpPairs || []).forEach((pair) => {
        if (primary.includes(pair.a) && !primary.includes(pair.b)) {
            amounts[pair.b] = (amounts[pair.b] || 0) + baseAmount;
        }
        if (primary.includes(pair.b) && !primary.includes(pair.a)) {
            amounts[pair.a] = (amounts[pair.a] || 0) + baseAmount;
        }
    });
    const recipients = [];
    state.players = (state.players || []).map((player) => {
        const drinkAmount = amounts[player.openId] || 0;
        if (!drinkAmount) return player;
        recipients.push({
            openId: player.openId,
            seat: player.seat,
            amount: drinkAmount,
            isCpMirror: !primary.includes(player.openId)
        });
        return { ...player, drinkCount: (player.drinkCount || 0) + drinkAmount };
    });
    return { recipients: recipients, amount: baseAmount, reason: reason || '' };
}

function queenSettleLinkTimeout(state, now) {
    const drink = queenDrinkTargets(state, [state.activePlayerOpenId], 1, 'link');
    return queenOpenResult(state, {
        type: 'linkLose',
        sourceOpenId: state.effect && state.effect.sourceOpenId,
        recipients: drink.recipients
    }, now);
}

function queenNeighbour(state, openId, direction) {
    const order = state.playerOrder || [];
    const index = order.indexOf(openId);
    if (index < 0 || !order.length) return '';
    return order[(index + direction + order.length) % order.length];
}

function queenShuffle(values) {
    const list = values.slice();
    for (let index = list.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const value = list[index];
        list[index] = list[swapIndex];
        list[swapIndex] = value;
    }
    return list;
}

function queenCreateLinkBoard() {
    const pairValues = QUEEN_LINK_CODES.reduce((values, code) => values.concat([code, code]), []);
    for (let attempt = 0; attempt < 120; attempt++) {
        const board = queenShuffle(pairValues).map((code, index) => ({ id: index, code: code, removed: false }));
        if (queenLinkPlayableCellIds(board).size >= 4) return board;
    }

    // 极端情况下使用保底布局：首行固定放两组相邻对子，其余牌仍随机排列。
    const codes = queenShuffle(QUEEN_LINK_CODES);
    const values = [codes[0], codes[0], codes[1], codes[1]].concat(
        queenShuffle(codes.slice(2).reduce((items, code) => items.concat([code, code]), []))
    );
    return values.map((code, index) => ({ id: index, code: code, removed: false }));
}

function queenLinkBoardSide(board) {
    const inferred = Math.round(Math.sqrt((board || []).length));
    return inferred > 0 ? inferred : QUEEN_LINK_SIDE;
}

function queenCanLinkCells(board, firstCellId, secondCellId) {
    const cells = board || [];
    const first = cells.find((item) => item.id === firstCellId && !item.removed);
    const second = cells.find((item) => item.id === secondCellId && !item.removed);
    if (!first || !second || first.id === second.id || first.code !== second.code) return false;

    const side = queenLinkBoardSide(cells);
    const firstRow = Math.floor(first.id / side);
    const firstColumn = first.id % side;
    const secondRow = Math.floor(second.id / side);
    const secondColumn = second.id % side;
    const rowDistance = secondRow - firstRow;
    const columnDistance = secondColumn - firstColumn;
    const aligned = rowDistance === 0 || columnDistance === 0 || Math.abs(rowDistance) === Math.abs(columnDistance);
    if (!aligned) return false;

    const rowStep = Math.sign(rowDistance);
    const columnStep = Math.sign(columnDistance);
    let row = firstRow + rowStep;
    let column = firstColumn + columnStep;
    while (row !== secondRow || column !== secondColumn) {
        const middleId = row * side + column;
        const middle = cells.find((item) => item.id === middleId);
        if (middle && !middle.removed) return false;
        row += rowStep;
        column += columnStep;
    }
    return true;
}

function queenLinkPlayableCellIds(board) {
    const activeCells = (board || []).filter((item) => !item.removed);
    const playableIds = new Set();
    for (let firstIndex = 0; firstIndex < activeCells.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < activeCells.length; secondIndex++) {
            const first = activeCells[firstIndex];
            const second = activeCells[secondIndex];
            if (queenCanLinkCells(board, first.id, second.id)) {
                playableIds.add(first.id);
                playableIds.add(second.id);
            }
        }
    }
    return playableIds;
}

function queenCreateMineSecret() {
    const allCellIds = Array.from({ length: QUEEN_MINE_CELL_COUNT }, (_, index) => index);
    const hasOnlyLowHints = (bombs) => {
        const bombSet = new Set(bombs);
        return allCellIds.every((cellId) => bombSet.has(cellId) || queenMineValue(cellId, bombs) <= 2);
    };

    // 雷数仍保持 10 颗，只限制雷群聚集：逐颗放置时确保所有安全格的提示数
    // 不超过 2。这样不会改变踩雷、轮流和胜负规则，只降低“满屏 3”的难度。
    for (let attempt = 0; attempt < 160; attempt++) {
        const bombs = [];
        const candidates = queenShuffle(allCellIds);
        for (let index = 0; index < candidates.length && bombs.length < QUEEN_MINE_BOMB_COUNT; index++) {
            const candidate = candidates[index];
            const nextBombs = bombs.concat([candidate]);
            if (hasOnlyLowHints(nextBombs)) bombs.push(candidate);
        }
        if (bombs.length === QUEEN_MINE_BOMB_COUNT) return bombs;
    }

    // 理论上的极端保底布局，同样保证所有安全格只出现 0、1、2。
    return [23, 41, 22, 25, 46, 1, 2, 4, 19, 42];
}

function queenMineValue(cellId, bombs) {
    const row = Math.floor(cellId / QUEEN_MINE_SIDE);
    const column = cellId % QUEEN_MINE_SIDE;
    let count = 0;
    (bombs || []).forEach((bombId) => {
        const bombRow = Math.floor(bombId / QUEEN_MINE_SIDE);
        const bombColumn = bombId % QUEEN_MINE_SIDE;
        if (Math.abs(bombRow - row) <= 1 && Math.abs(bombColumn - column) <= 1) count += 1;
    });
    return count;
}

function queenSettleMedusa(state, secret, now) {
    const choices = secret.medusaChoices || {};
    const order = state.playerOrder || [];
    const safe = new Set();
    order.forEach((openId) => {
        const target = choices[openId];
        if (target && choices[target] === openId) {
            safe.add(openId);
            safe.add(target);
        }
    });
    const losers = order.filter((openId) => !safe.has(openId));
    const drink = queenDrinkTargets(state, losers, 1, 'medusa');
    return queenOpenResult(state, {
        type: 'medusa',
        choices: order.map((openId) => ({ openId: openId, targetOpenId: choices[openId] || '' })),
        recipients: drink.recipients
    }, now);
}

function queenSettleCamera(state, now) {
    const order = state.playerOrder || [];
    const pressed = state.cameraPressed || [];
    const pressedIds = pressed.map((item) => item.openId);
    const missing = order.filter((openId) => !pressedIds.includes(openId));
    const losers = missing.length
        ? missing
        : (pressed.length ? [pressed[pressed.length - 1].openId] : order.slice());
    const drink = queenDrinkTargets(state, losers, 1, 'camera');
    return queenOpenResult(state, {
        type: 'camera',
        sourceOpenId: state.effect && state.effect.sourceOpenId,
        interrupted: state.effect && state.effect.interrupted || null,
        pressed: pressed,
        recipients: drink.recipients
    }, now, { advanceTurn: false, resumePhase: 'normal' });
}

async function handleQueenStart(openId, roomId, roomDocId, debugRequestId) {
    if (!roomId) return { success: false, error: '缺少房间ID' };
    queenDebug('收到开始游戏请求', roomId, debugRequestId);
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) {
        queenDebug('开始失败：没有找到房间', roomId, debugRequestId);
        return { success: false, error: '房间不存在' };
    }

    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const members = room.members || [];
        queenDebug('开始事务已读取房间', roomId, debugRequestId, {
            '房间成员数': members.length,
            '旧阶段': room.gameState && room.gameState.phase || '无',
            '旧版本': room.gameState && room.gameState.version
        });
        if (room.roomId !== roomId) return { success: false, error: '房间标识不匹配' };
        if (room.gameType !== 'queen') return { success: false, error: '房间不是大姐牌游戏' };
        if (!members.some((member) => member.openId === openId)) return { success: false, error: '不是房间成员' };
        if (members.length < 2) return { success: false, error: '至少需要2位玩家' };
        if (members.length > QUEEN_MAX_MEMBERS) return { success: false, error: '大姐牌最多支持6位玩家' };
        const current = room.gameState || {};
        if (current.phase && !['waiting', 'finished'].includes(current.phase)) {
            return { success: true, alreadyStarted: true, state: current };
        }

        const now = Date.now();
        if (Number(current.nextActionAt || 0) > now) {
            return { success: false, tooEarly: true, error: '结果展示中，请稍后再开局', state: current };
        }
        const order = members.map((member) => member.openId);
        const deck = createQueenDeck();
        const roundToken = 'queen_' + now + '_' + crypto.randomBytes(5).toString('hex');
        const state = bumpTenHalfStateRevision({
            gameKind: 'queen',
            phase: 'normal',
            version: (current.version || 0) + 1,
            stateRevision: current.stateRevision || 0,
            round: (current.round || 0) + 1,
            roundToken: roundToken,
            playerOrder: order,
            players: order.map((playerOpenId, index) => ({
                openId: playerOpenId,
                seat: index + 1,
                drinkCount: 0,
                cameraCards: 0,
                toiletCards: 0
            })),
            currentTurnIndex: 0,
            currentPlayerOpenId: order[0],
            activePlayerOpenId: '',
            remainingCards: deck.length,
            currentCard: null,
            bossOpenId: '',
            cpPairs: [],
            kingCount: 0,
            effect: null,
            deadlineAt: 0,
            nextActionAt: 0,
            resultEvent: null,
            lastEvent: { type: 'started', at: now }
        });
        queenDebug('新牌局状态与52张牌堆已生成', roomId, debugRequestId, {
            '玩家数': order.length,
            '牌堆张数': deck.length,
            '新版本': state.version,
            '同步修订号': state.stateRevision
        });
        await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).set({
            data: {
                roomId: roomId,
                roundToken: roundToken,
                deck: deck,
                drawIndex: 0,
                mineBombs: [],
                medusaChoices: {},
                createdTime: now,
                updatedTime: now
            }
        });
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        queenDebug('事务内已写入私密牌堆和公开状态', roomId, debugRequestId, {
            '公开剩余牌数': state.remainingCards,
            '私密牌堆张数': deck.length
        });
        return { success: true, state: state };
    });
    queenDebug('开始游戏事务已提交', roomId, debugRequestId, {
        '是否成功': !!result.success,
        '返回阶段': result.state && result.state.phase,
        '返回版本': result.state && result.state.version,
        '错误': result.error || ''
    });
    return { ...result, serverTime: Date.now() };
}

async function handleQueenAction(openId, roomId, actionType, payload, expectedVersion, roomDocId, debugRequestId) {
    if (!roomId || !actionType) return { success: false, error: '缺少必要参数' };
    let debugStage = '查找房间';
    queenDebug('收到游戏操作', roomId, debugRequestId, {
        '操作类型': actionType,
        '客户端期望版本': expectedVersion
    });
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) {
        queenDebug('操作失败：没有找到房间', roomId, debugRequestId, { '操作类型': actionType });
        return { success: false, error: '房间不存在' };
    }

    try {
    const result = await db.runTransaction(async (transaction) => {
        debugStage = '读取公开房间状态';
        const now = Date.now();
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room.gameState || {});
        queenDebug('事务已读取房间状态', roomId, debugRequestId, {
            '操作类型': actionType,
            '当前阶段': state.phase || '未知',
            '云端版本': state.version,
            '同步修订号': state.stateRevision,
            '房间成员数': (room.members || []).length,
            '本局玩家数': (state.playerOrder || []).length,
            '当前剩余牌数': state.remainingCards
        });
        if (room.roomId !== roomId) return { success: false, error: '房间标识不匹配' };
        if (room.gameType !== 'queen') return { success: false, error: '房间不是大姐牌游戏' };
        if (!(room.members || []).some((member) => member.openId === openId)) return { success: false, error: '不是房间成员' };
        if (!queenIsPlayer(state, openId)) return { success: false, error: '旁观者不能操作' };
        const acceptsConcurrentSubmission = ['medusaSelect', 'cameraPress', 'toiletBlock', 'toiletBreak', 'toiletSkip'].includes(actionType);
        if (!acceptsConcurrentSubmission && expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) {
            queenDebug('忽略晚到操作：客户端版本已经过期', roomId, debugRequestId, {
                '操作类型': actionType,
                '客户端期望版本': expectedVersion,
                '云端版本': state.version,
                '当前阶段': state.phase
            });
            return { success: true, stale: true, state: state };
        }

        if (actionType !== 'continue' && Number(state.nextActionAt || 0) > now) {
            return { success: false, tooEarly: true, error: '结果展示中，请稍后', state: state };
        }
        if (Number(state.nextActionAt || 0) && Number(state.nextActionAt) <= now) {
            state.nextActionAt = 0;
            state.resultEvent = null;
        }

        // 超时请求可能晚于玩家操作到达；同样由事务中的云端截止时间判负。
        if (state.phase === 'link' && state.deadlineAt && Date.now() >= state.deadlineAt) {
            const settledAt = Date.now();
            queenSettleLinkTimeout(state, settledAt);
            await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
                data: { gameState: _.set(state), status: 'playing', lastActiveTime: settledAt }
            });
            return { success: true, state: state };
        }

        const secretActions = new Set(['draw', 'minePick', 'medusaSelect']);
        const secretDirtyFields = new Set();
        let secret = null;
        if (secretActions.has(actionType)) {
            debugStage = '读取私密牌堆';
            let secretResult;
            try {
                secretResult = await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).get();
            } catch (error) {
                queenDebug('读取私密牌堆失败', roomId, debugRequestId, {
                    '错误': error && (error.message || error.errMsg) || String(error),
                    '私密集合': QUEEN_SECRET_COLLECTION
                });
                return { success: false, error: '本局私密牌堆不存在，请重新开局' };
            }
            secret = secretResult.data || {};
            queenDebug('私密牌堆按需读取成功', roomId, debugRequestId, {
                '操作类型': actionType,
                '牌堆剩余张数': Array.isArray(secret.deck) ? queenSecretRemainingCards(secret) : '不是数组',
                '本局标识是否匹配': secret.roundToken === state.roundToken
            });
            if (secret.roundToken !== state.roundToken) {
                queenDebug('操作失败：公开状态与私密牌堆不属于同一局', roomId, debugRequestId, {
                    '当前阶段': state.phase,
                    '当前版本': state.version
                });
                return { success: false, error: '本局数据已过期，请重新开局' };
            }
        }

        const actor = state.currentPlayerOpenId;
        const openResult = (effect, options) => queenOpenResult(state, effect, now, options);
        const requireActor = () => actor === openId;

        if (actionType === 'draw') {
            debugStage = '校验抽牌资格';
            if (state.phase !== 'normal' || !requireActor()) {
                queenDebug('抽牌被拒绝：阶段或当前玩家不匹配', roomId, debugRequestId, {
                    '当前阶段': state.phase,
                    '是否轮到调用者': requireActor(),
                    '当前版本': state.version
                });
                return { success: false, error: '还没轮到你抽牌' };
            }
            if (!Array.isArray(secret.deck)) {
                queenDebug('抽牌失败：私密牌堆字段不是数组', roomId, debugRequestId, {
                    '实际类型': secret.deck === null ? 'null' : typeof secret.deck,
                    '当前阶段': state.phase,
                    '当前版本': state.version
                });
                return { success: false, error: '私密牌堆格式异常，请重新开局' };
            }
            const deck = secret.deck || [];
            const drawIndex = queenSecretDrawIndex(secret);
            debugStage = '从私密牌堆抽牌';
            const card = deck[deck.length - 1 - drawIndex] || null;
            if (card) {
                secret.drawIndex = drawIndex + 1;
                secretDirtyFields.add('drawIndex');
            }
            queenDebug(card ? '已从私密牌堆抽出一张牌' : '私密牌堆已经为空', roomId, debugRequestId, {
                '抽到点数': card && card.rank || '无',
                '抽到花色': card && card.suitKey || '无',
                '抽牌后剩余张数': card ? Math.max(0, deck.length - drawIndex - 1) : 0,
                '抽牌前公开剩余张数': state.remainingCards
            });
            if (!card) {
                state.remainingCards = 0;
                queenAdvanceTurn(state, now);
            } else {
                state.remainingCards = Math.max(0, deck.length - drawIndex - 1);
                state.currentCard = card;
                state.lastEvent = { type: 'draw', playerOpenId: openId, card: card, at: now };

                if (card.rank === 'A') {
                    state.phase = 'target';
                    state.effect = { type: 'ace', sourceOpenId: openId, maxTargets: 1 };
                    state.version = (state.version || 0) + 1;
                    bumpTenHalfStateRevision(state);
                } else if (card.rank === '2') {
                    state.bossOpenId = openId;
                    state.players = state.players.map((player) => ({ ...player, isBoss: player.openId === openId }));
                    openResult({ type: 'boss', sourceOpenId: openId });
                } else if (card.rank === '3') {
                    const topics = ['fruits', 'cities', 'movies', 'brands', 'foods', 'animals'];
                    state.phase = 'garden';
                    state.effect = { type: 'garden', topic: topics[Math.floor(Math.random() * topics.length)], sourceOpenId: openId };
                    state.activePlayerOpenId = '';
                    state.deadlineAt = 0;
                    state.version = (state.version || 0) + 1;
                    bumpTenHalfStateRevision(state);
                } else if (card.rank === '4') {
                    state.players = state.players.map((player) => player.openId === openId
                        ? { ...player, cameraCards: (player.cameraCards || 0) + 1 }
                        : player);
                    openResult({ type: 'cameraCard', sourceOpenId: openId });
                } else if (card.rank === '5') {
                    state.phase = 'cp';
                    state.effect = { type: 'cp', sourceOpenId: openId };
                    state.version = (state.version || 0) + 1;
                    bumpTenHalfStateRevision(state);
                } else if (card.rank === '6') {
                    state.phase = 'link';
                    state.effect = { type: 'link', sourceOpenId: openId };
                    state.linkBoard = queenCreateLinkBoard();
                    state.linkSelected = null;
                    state.activePlayerOpenId = openId;
                    state.deadlineAt = Date.now() + QUEEN_TURN_MS;
                    state.version = (state.version || 0) + 1;
                    bumpTenHalfStateRevision(state);
                } else if (card.rank === '7') {
                    secret.mineBombs = queenCreateMineSecret();
                    secretDirtyFields.add('mineBombs');
                    state.phase = 'mine';
                    state.effect = { type: 'mine', sourceOpenId: openId };
                    state.mineCells = Array.from({ length: QUEEN_MINE_CELL_COUNT }, (_, index) => ({ id: index, revealed: false, value: 0 }));
                    state.activePlayerOpenId = openId;
                    // 扫雷以实际踩中炸弹为失败条件，不因等待自动判负。
                    state.deadlineAt = 0;
                    state.version = (state.version || 0) + 1;
                    bumpTenHalfStateRevision(state);
                } else if (card.rank === '8') {
                    state.players = state.players.map((player) => player.openId === openId
                        ? { ...player, toiletCards: (player.toiletCards || 0) + 1 }
                        : player);
                    openResult({ type: 'toiletCard', sourceOpenId: openId });
                } else if (card.rank === '9') {
                    state.phase = 'target';
                    state.effect = { type: 'nine', sourceOpenId: openId, maxTargets: Math.max(1, state.playerOrder.length - 1) };
                    state.version = (state.version || 0) + 1;
                    bumpTenHalfStateRevision(state);
                } else if (card.rank === '10') {
                    secret.medusaChoices = {};
                    secretDirtyFields.add('medusaChoices');
                    state.phase = 'medusa';
                    state.effect = { type: 'medusa', sourceOpenId: openId };
                    state.medusaSubmitted = [];
                    state.deadlineAt = Date.now() + QUEEN_MEDUSA_MS;
                    state.version = (state.version || 0) + 1;
                    bumpTenHalfStateRevision(state);
                } else if (card.rank === 'J' || card.rank === 'Q') {
                    const target = queenNeighbour(state, openId, card.rank === 'J' ? 1 : -1);
                    const drink = queenDrinkTargets(state, [target], 1, card.rank.toLowerCase());
                    openResult({ type: card.rank === 'J' ? 'right' : 'left', sourceOpenId: openId, recipients: drink.recipients });
                } else if (card.rank === 'K') {
                    state.kingCount = Math.min(4, (state.kingCount || 0) + 1);
                    const drink = queenDrinkTargets(state, [openId], state.kingCount, 'king');
                    openResult({ type: 'king', sourceOpenId: openId, count: state.kingCount, recipients: drink.recipients });
                }
            }
        } else if (actionType === 'resolveTargets') {
            if (state.phase !== 'target' || !state.effect || state.effect.sourceOpenId !== openId) {
                return { success: false, error: '当前不能选择喝酒玩家' };
            }
            const targets = Array.from(new Set((payload.targetOpenIds || []).filter((id) => id && id !== openId && queenIsPlayer(state, id))));
            const maxTargets = Number(state.effect.maxTargets) || 1;
            if (!targets.length || targets.length > maxTargets) return { success: false, error: '请选择有效玩家' };
            const resultType = state.effect.type;
            const drink = queenDrinkTargets(state, targets, 1, resultType);
            openResult({ type: resultType, sourceOpenId: openId, recipients: drink.recipients });
        } else if (actionType === 'cpCreate') {
            if (state.phase !== 'cp' || !state.effect || state.effect.sourceOpenId !== openId) return { success: false, error: '当前不能绑定CP' };
            const targets = Array.from(new Set((payload.targetOpenIds || []).filter((id) => queenIsPlayer(state, id))));
            if (targets.length !== 2 || targets[0] === targets[1]) return { success: false, error: '请选择两位玩家' };
            const existing = (state.cpPairs || []).some((pair) =>
                (pair.a === targets[0] && pair.b === targets[1]) || (pair.a === targets[1] && pair.b === targets[0]));
            if (!existing) {
                state.cpPairs = (state.cpPairs || []).concat([{
                    id: 'cp_' + now + '_' + Math.random().toString(36).slice(2, 6),
                    a: targets[0], b: targets[1]
                }]);
            }
            openResult({ type: 'cpCreated', sourceOpenId: openId, targets: targets });
        } else if (actionType === 'cpRemove') {
            if (state.phase !== 'cp' || !state.effect || state.effect.sourceOpenId !== openId) return { success: false, error: '当前不能解除CP' };
            const pair = (state.cpPairs || []).find((item) => item.id === payload.pairId);
            if (!pair) return { success: false, error: '这组CP已经不存在' };
            state.cpPairs = state.cpPairs.filter((item) => item.id !== payload.pairId);
            openResult({ type: 'cpRemoved', sourceOpenId: openId, targets: [pair.a, pair.b] });
        } else if (actionType === 'gardenEnd') {
            if (state.phase !== 'garden') return { success: false, error: '逛三园已经结束' };
            queenAdvanceTurn(state, now);
        } else if (actionType === 'linkPick') {
            if (state.phase !== 'link' || state.activePlayerOpenId !== openId) return { success: false, error: '还没轮到你' };
            const firstCellId = Number(payload.firstCellId);
            const secondCellId = Number(payload.secondCellId);
            const firstCell = (state.linkBoard || []).find((item) => item.id === firstCellId && !item.removed);
            const secondCell = (state.linkBoard || []).find((item) => item.id === secondCellId && !item.removed);
            if (!firstCell || !secondCell || firstCell.id === secondCell.id) {
                return { success: false, error: '请选择两个还在场上的方块' };
            }

            if (!queenCanLinkCells(state.linkBoard, firstCellId, secondCellId)) {
                const drink = queenDrinkTargets(state, [openId], 1, 'link');
                openResult({ type: 'linkLose', sourceOpenId: state.effect.sourceOpenId, recipients: drink.recipients });
            } else {
                const pairIds = [firstCellId, secondCellId];
                state.linkBoard = state.linkBoard.map((item) => pairIds.includes(item.id) ? { ...item, removed: true } : item);
                if (state.linkBoard.every((item) => item.removed)) {
                    openResult({ type: 'linkCleared', sourceOpenId: state.effect.sourceOpenId, recipients: [] });
                } else {
                    const order = state.playerOrder || [];
                    const nextOpenId = order[(order.indexOf(openId) + 1) % order.length];
                    if (!queenLinkPlayableCellIds(state.linkBoard).size) {
                        const drink = queenDrinkTargets(state, [openId], 1, 'link');
                        openResult({
                            type: 'linkLose',
                            sourceOpenId: state.effect.sourceOpenId,
                            noMoves: true,
                            recipients: drink.recipients
                        });
                    } else {
                        state.activePlayerOpenId = nextOpenId;
                        state.deadlineAt = Date.now() + QUEEN_TURN_MS;
                        state.version = (state.version || 0) + 1;
                        bumpTenHalfStateRevision(state);
                    }
                }
            }
        } else if (actionType === 'minePick') {
            if (state.phase !== 'mine' || state.activePlayerOpenId !== openId) return { success: false, error: '还没轮到你' };
            const cellId = Number(payload.cellId);
            const cell = (state.mineCells || []).find((item) => item.id === cellId && !item.revealed);
            if (!cell) return { success: false, error: '这个格子已经翻过' };
            const bombs = secret.mineBombs || [];
            if (bombs.includes(cellId)) {
                state.mineCells = state.mineCells.map((item) => item.id === cellId ? { ...item, revealed: true, bomb: true } : item);
                const drink = queenDrinkTargets(state, [openId], 1, 'mine');
                openResult({ type: 'mineLose', sourceOpenId: state.effect.sourceOpenId, cellId: cellId, recipients: drink.recipients });
            } else {
                state.mineCells = state.mineCells.map((item) => item.id === cellId
                    ? { ...item, revealed: true, value: queenMineValue(cellId, bombs) }
                    : item);
                const order = state.playerOrder || [];
                state.activePlayerOpenId = order[(order.indexOf(openId) + 1) % order.length];
                state.deadlineAt = 0;
                state.version = (state.version || 0) + 1;
                bumpTenHalfStateRevision(state);
            }
        } else if (actionType === 'medusaSelect') {
            if (state.phase !== 'medusa' || (state.medusaSubmitted || []).includes(openId)) {
                return { success: false, error: '本轮已经选择过了' };
            }
            const targetOpenId = payload.targetOpenId || '';
            if (targetOpenId && (targetOpenId === openId || !queenIsPlayer(state, targetOpenId))) {
                return { success: false, error: '请选择其他玩家' };
            }
            secret.medusaChoices = { ...(secret.medusaChoices || {}), [openId]: targetOpenId };
            secretDirtyFields.add('medusaChoices');
            state.medusaSubmitted = (state.medusaSubmitted || []).concat([openId]);
            if (state.medusaSubmitted.length >= state.playerOrder.length) {
                queenSettleMedusa(state, secret, now);
            } else {
                state.version = (state.version || 0) + 1;
                bumpTenHalfStateRevision(state);
            }
        } else if (actionType === 'cameraTrigger') {
            const interruptiblePhases = ['normal', 'target', 'cp', 'garden', 'link', 'mine', 'medusa'];
            if (!interruptiblePhases.includes(state.phase)) return { success: false, error: '现在不能发动紧急按钮' };
            const player = queenPlayer(state, openId);
            if (!player || Number(player.cameraCards || 0) < 1) return { success: false, error: '你没有紧急按钮牌' };
            const interrupted = {
                phase: state.phase,
                effect: state.effect || null,
                currentCard: state.currentCard || null,
                activePlayerOpenId: state.activePlayerOpenId || '',
                remainingMs: state.deadlineAt ? Math.max(600, state.deadlineAt - now) : 0
            };
            state.players = state.players.map((item) => item.openId === openId
                ? { ...item, cameraCards: item.cameraCards - 1 }
                : item);
            state.phase = 'camera';
            state.effect = { type: 'camera', sourceOpenId: openId, interrupted: interrupted };
            state.cameraPressed = [];
            state.deadlineAt = Date.now() + QUEEN_TURN_MS;
            state.version = (state.version || 0) + 1;
            bumpTenHalfStateRevision(state);
        } else if (actionType === 'cameraPress') {
            if (state.phase !== 'camera') return { success: false, error: '紧急按钮已经结束' };
            if ((state.cameraPressed || []).some((item) => item.openId === openId)) return { success: true, state: state, alreadySubmitted: true };
            state.cameraPressed = (state.cameraPressed || []).concat([{ openId: openId, at: now }]);
            if (state.cameraPressed.length >= state.playerOrder.length) queenSettleCamera(state, now);
            else {
                state.version = (state.version || 0) + 1;
                bumpTenHalfStateRevision(state);
            }
        } else if (actionType === 'toiletBlock' || actionType === 'toiletBreak' || actionType === 'toiletSkip') {
            if (state.phase !== 'toiletPrompt' || !state.effect || state.effect.type !== 'toiletPrompt') {
                return { success: true, stale: true, state: state };
            }
            if (Number(payload.promptAt || 0) !== Number(state.effect.at || 0)) {
                return { success: true, stale: true, state: state };
            }
            const pendingOpenIds = state.effect.pendingOpenIds || [];
            if (!pendingOpenIds.includes(openId)) return { success: true, alreadySubmitted: true, state: state };
            const player = queenPlayer(state, openId);
            if (!player) return { success: false, error: '玩家状态不存在' };
            if (actionType !== 'toiletSkip' && Number(player.toiletCards || 0) < 1) {
                return { success: false, error: '你没有厕所牌' };
            }

            const pendingResult = { ...(state.effect.pendingResult || {}) };
            let blockedAmount = 0;
            if (actionType === 'toiletBlock') {
                pendingResult.recipients = (pendingResult.recipients || []).map((recipient) => {
                    if (recipient.openId !== openId) return recipient;
                    const oldAmount = Math.max(0, Number(recipient.amount || 0));
                    blockedAmount = Math.min(1, oldAmount);
                    return { ...recipient, amount: Math.max(0, oldAmount - blockedAmount) };
                });
            }
            state.players = state.players.map((item) => item.openId === openId
                ? {
                    ...item,
                    toiletCards: actionType === 'toiletSkip' ? item.toiletCards : Math.max(0, Number(item.toiletCards || 0) - 1),
                    drinkCount: Math.max(0, Number(item.drinkCount || 0) - blockedAmount)
                }
                : item);

            const remainingOpenIds = pendingOpenIds.filter((item) => item !== openId);
            if (!remainingOpenIds.length) {
                queenCommitResult(state, pendingResult, now);
            } else {
                state.effect = {
                    ...state.effect,
                    pendingOpenIds: remainingOpenIds,
                    pendingResult: pendingResult
                };
                state.version = (state.version || 0) + 1;
                state.lastEvent = { type: 'toiletDecision', playerOpenId: openId, decision: actionType, at: now };
                bumpTenHalfStateRevision(state);
            }
        } else if (actionType === 'bossTarget') {
            if (state.phase !== 'normal' || state.bossOpenId !== openId) return { success: false, error: '只有当前大姐能发动满分激光枪' };
            const targetOpenId = payload.targetOpenId;
            if (!targetOpenId || targetOpenId === openId || !queenIsPlayer(state, targetOpenId)) return { success: false, error: '请选择其他玩家' };
            openResult({ type: 'bossTarget', sourceOpenId: openId, targets: [targetOpenId] }, { advanceTurn: false, resumePhase: 'normal' });
        } else if (actionType === 'continue') {
            if (state.phase !== 'result') return { success: true, stale: true, state: state };
            if (state.effect && state.effect.advanceTurn === false) {
                const interrupted = state.effect.interrupted;
                state.phase = interrupted && interrupted.phase || state.effect.resumePhase || 'normal';
                state.effect = interrupted && interrupted.effect || null;
                state.currentCard = interrupted && interrupted.currentCard || null;
                state.activePlayerOpenId = interrupted && interrupted.activePlayerOpenId || '';
                state.deadlineAt = interrupted && interrupted.remainingMs ? now + interrupted.remainingMs : 0;
                state.version = (state.version || 0) + 1;
                bumpTenHalfStateRevision(state);
            } else {
                queenAdvanceTurn(state, now);
            }
        } else {
            return { success: false, error: '不支持的大姐牌操作' };
        }

        queenDebug('操作判定完成，准备写回数据库', roomId, debugRequestId, {
            '操作类型': actionType,
            '下一阶段': state.phase,
            '下一版本': state.version,
            '同步修订号': state.stateRevision,
            '公开剩余牌数': state.remainingCards,
            '私密剩余牌数': secret && Array.isArray(secret.deck) ? queenSecretRemainingCards(secret) : '本操作未读取',
            '当前牌点数': state.currentCard && state.currentCard.rank || '无',
            '效果类型': state.effect && state.effect.type || '无'
        });
        if (secretDirtyFields.size) {
            debugStage = '按需写回私密数据';
            await updateQueenSecretState(transaction, roomId, secret, now, Array.from(secretDirtyFields));
        }
        debugStage = '写回公开房间状态';
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: state.phase === 'waiting' ? 'waiting' : 'playing', lastActiveTime: now }
        });
        debugStage = '等待事务提交';
        return { success: true, state: state };
    });
    queenDebug('游戏操作事务已提交', roomId, debugRequestId, {
        '操作类型': actionType,
        '是否成功': !!result.success,
        '是否旧请求': !!result.stale,
        '返回阶段': result.state && result.state.phase,
        '返回版本': result.state && result.state.version,
        '错误': result.error || ''
    });
    return { ...result, serverTime: Date.now() };
    } catch (error) {
        queenDebug('游戏操作事务异常', roomId, debugRequestId, {
            '操作类型': actionType,
            '失败步骤': debugStage,
            '错误': error && (error.message || error.errMsg) || String(error),
            '错误码': error && (error.errCode || error.code) || '',
            '错误堆栈': error && error.stack || ''
        });
        throw error;
    }
}

async function handleQueenTimeout(openId, roomId, expectedVersion, expectedPhase, expectedDeadlineAt, roomDocId) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room.gameState || {});
        if (room.roomId !== roomId || room.gameType !== 'queen' || !(room.members || []).some((member) => member.openId === openId)) {
            return { success: false, error: '无权推进本局' };
        }
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version) ||
            expectedPhase && expectedPhase !== state.phase ||
            expectedDeadlineAt !== undefined && Number(expectedDeadlineAt) !== Number(state.deadlineAt)) {
            return { success: true, stale: true, state: state };
        }
        const now = Date.now();
        if (!state.deadlineAt || now < state.deadlineAt) return { success: true, tooEarly: true, state: state };

        if (state.phase === 'result') {
            if (state.effect && state.effect.advanceTurn === false) {
                const interrupted = state.effect.interrupted;
                state.phase = interrupted && interrupted.phase || state.effect.resumePhase || 'normal';
                state.effect = interrupted && interrupted.effect || null;
                state.currentCard = interrupted && interrupted.currentCard || null;
                state.activePlayerOpenId = interrupted && interrupted.activePlayerOpenId || '';
                state.deadlineAt = interrupted && interrupted.remainingMs ? now + interrupted.remainingMs : 0;
                state.version = (state.version || 0) + 1;
                bumpTenHalfStateRevision(state);
            } else queenAdvanceTurn(state, now);
        } else if (state.phase === 'link') {
            queenSettleLinkTimeout(state, now);
        } else if (state.phase === 'medusa') {
            let secretResult;
            try {
                secretResult = await transaction.collection(QUEEN_SECRET_COLLECTION).doc(queenSecretId(roomId)).get();
            } catch (error) {
                return { success: false, error: '本局私密数据不存在' };
            }
            const secret = secretResult.data || {};
            if (secret.roundToken !== state.roundToken) return { success: false, error: '本局数据已过期，请重新开局' };
            queenSettleMedusa(state, secret, now);
        } else if (state.phase === 'camera') {
            queenSettleCamera(state, now);
        } else {
            return { success: true, stale: true, state: state };
        }

        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        return { success: true, state: state };
    });
    return { ...result, serverTime: Date.now() };
}

// ==================== 九宫格联机游戏 ====================

function createNineGridDeck() {
    const suits = [
        { key: 'spade', symbol: '♠', color: 'black' },
        { key: 'heart', symbol: '♥', color: 'red' },
        { key: 'diamond', symbol: '♦', color: 'red' },
        { key: 'club', symbol: '♣', color: 'black' }
    ];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (let copyIndex = 0; copyIndex < 2; copyIndex++) {
        suits.forEach((suit) => {
            ranks.forEach((rank) => {
                deck.push({
                    id: 'ninegrid-' + copyIndex + '-' + suit.key + '-' + rank,
                    rank: rank,
                    suitKey: suit.key,
                    suit: suit.symbol,
                    color: suit.color,
                    isJoker: false
                });
            });
        });
    }
    return deck;
}

function nineGridRankValue(card) {
    if (!card) return 0;
    if (card.rank === 'A') return 1;
    if (card.rank === 'J') return 11;
    if (card.rank === 'Q') return 12;
    if (card.rank === 'K') return 13;
    return Number(card.rank) || 0;
}

const nineGridDeckCache = new Map();

function nineGridDeckForSeed(seed) {
    const normalizedSeed = String(seed || 'ninegrid');
    if (nineGridDeckCache.has(normalizedSeed)) return nineGridDeckCache.get(normalizedSeed);
    const deck = createNineGridDeck();
    for (let index = deck.length - 1; index > 0; index--) {
        const digest = crypto.createHash('sha256')
            .update(normalizedSeed + ':' + index)
            .digest();
        const swapIndex = digest.readUInt32BE(0) % (index + 1);
        const card = deck[index];
        deck[index] = deck[swapIndex];
        deck[swapIndex] = card;
    }
    nineGridDeckCache.set(normalizedSeed, deck);
    if (nineGridDeckCache.size > 24) {
        const oldestKey = nineGridDeckCache.keys().next().value;
        nineGridDeckCache.delete(oldestKey);
    }
    return deck;
}

function nineGridDrawCard(state) {
    const deck = nineGridDeckForSeed(state.deckSeed);
    const drawIndex = Math.max(0, Number(state.drawIndex) || 0);
    const card = deck[drawIndex] || null;
    if (card) state.drawIndex = drawIndex + 1;
    return card;
}

function nineGridOpenBoard(state, now) {
    state.grid = Array.from({ length: 9 }, (_, index) => {
        const card = nineGridDrawCard(state);
        return {
            index: index,
            active: true,
            collected: false,
            revealed: true,
            card: card,
            cardCount: card ? 1 : 0
        };
    });
    state.referenceCard = null;
    state.streak = 0;
    state.lastGuess = null;
    state.lastEvent = { type: 'turnStarted', playerOpenId: state.currentPlayerOpenId, at: now };
    return state;
}

function nineGridDrinkCount(cardCount) {
    return Math.max(0, Number(cardCount) || 0);
}

function nineGridSettle(state, now) {
    let maxCards = -1;
    let nextStarter = (state.playerOrder || [])[0] || '';
    state.players = (state.players || []).map((player) => {
        const pileCount = (player.collectedPiles || []).reduce(
            (sum, pile) => sum + Math.max(0, Number(pile.cardCount) || 0),
            0
        );
        const cardCount = Math.max(Number(player.collectedCardCount || 0), pileCount,
            (player.collectedCards || []).length);
        if (cardCount > maxCards) {
            maxCards = cardCount;
            nextStarter = player.openId;
        }
        return { ...player, collectedCardCount: cardCount, drinkCount: nineGridDrinkCount(cardCount) };
    });
    state.phase = 'result';
    state.currentPlayerOpenId = '';
    state.nextStarterOpenId = nextStarter;
    state.streak = 0;
    state.lastEvent = { type: 'roundResult', nextStarterOpenId: nextStarter, at: now };
    return state;
}

function nineGridAdvanceTurn(state, now) {
    if ((state.grid || []).every((slot) => slot.active === false || slot.collected === true)) {
        return nineGridSettle(state, now);
    }
    const order = state.playerOrder || [];
    if (!order.length) return nineGridSettle(state, now);
    const nextIndex = (Number(state.currentTurnIndex || 0) + 1) % order.length;
    state.currentTurnIndex = nextIndex;
    state.currentPlayerOpenId = order[nextIndex];
    state.referenceCard = null;
    state.streak = 0;
    state.lastGuess = null;
    state.lastEvent = { type: 'turnStarted', playerOpenId: state.currentPlayerOpenId, at: now };
    return state;
}

function buildNineGridRound(room, current, preferredStarterOpenId, now) {
    const members = room.members || [];
    const seatOrder = members.map((member) => member.openId);
    const startIndex = Math.max(0, seatOrder.indexOf(preferredStarterOpenId));
    const playerOrder = seatOrder.slice(startIndex).concat(seatOrder.slice(0, startIndex));
    const state = {
        gameKind: 'ninegrid',
        phase: 'playing',
        version: Number(current && current.version || 0) + 1,
        stateRevision: Number(current && current.stateRevision || 0),
        round: Number(current && current.round || 0) + 1,
        playerOrder: playerOrder,
        players: members.map((member, index) => ({
            openId: member.openId,
            seat: index + 1,
            collectedCards: [],
            collectedPiles: [],
            collectedCardCount: 0,
            drinkCount: 0
        })),
        currentTurnIndex: 0,
        currentPlayerOpenId: playerOrder[0] || '',
        nextStarterOpenId: '',
        grid: [],
        referenceCard: null,
        deckSeed: crypto.randomBytes(16).toString('hex'),
        drawIndex: 0,
        streak: 0,
        lastGuess: null
    };
    nineGridOpenBoard(state, now);
    return bumpTenHalfStateRevision(state);
}

async function handleNineGridStart(openId, roomId, roomDocId) {
    if (!roomId) return { success: false, error: '缺少房间ID' };
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        if (!room || room.roomId !== roomId || room.gameType !== 'ninegrid') return { success: false, error: '房间不匹配' };
        if (!(room.members || []).some((member) => member.openId === openId)) return { success: false, error: '不是房间成员' };
        if ((room.members || []).length < 2) return { success: false, error: '至少需要2位玩家' };
        const current = room.gameState || {};
        if (current.phase && current.phase !== 'waiting') return { success: true, alreadyStarted: true, state: current };
        const now = Date.now();
        const state = buildNineGridRound(room, current, '', now);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        return { success: true, state: state };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleNineGridSelectBase(openId, roomId, roomDocId, slotIndex, expectedVersion) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room && room.gameState || {});
        if (!room || room.roomId !== roomId || room.gameType !== 'ninegrid') return { success: false, error: '房间不匹配' };
        if (!(room.members || []).some((member) => member.openId === openId) || !(state.playerOrder || []).includes(openId)) {
            return { success: false, error: '旁观者不能操作' };
        }
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) {
            return { success: true, stale: true, state: state };
        }
        if (state.phase !== 'playing' || state.currentPlayerOpenId !== openId) {
            return { success: false, error: '还没轮到你' };
        }
        // 新规则开局即公开九个牌堆，不再存在单独的“翻第一张牌”写操作。
        // 旧客户端若仍发来这个动作，只返回权威状态，避免额外写库或消耗牌库。
        return { success: true, stale: true, state: state };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleNineGridGuess(openId, roomId, roomDocId, guess, slotIndex, expectedVersion) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const validGuesses = ['small', 'black', 'red', 'big'];
    if (!validGuesses.includes(guess)) return { success: false, error: '猜法不正确' };
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room && room.gameState || {});
        if (!room || room.roomId !== roomId || room.gameType !== 'ninegrid') return { success: false, error: '房间不匹配' };
        if (!(room.members || []).some((member) => member.openId === openId) || !(state.playerOrder || []).includes(openId)) {
            return { success: false, error: '旁观者不能操作' };
        }
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) {
            return { success: true, stale: true, state: state };
        }
        if (state.phase !== 'playing' || state.currentPlayerOpenId !== openId) return { success: false, error: '还没轮到你' };
        const index = Number(slotIndex);
        const slot = (state.grid || []).find((item) => Number(item.index) === index);
        if (!slot || slot.active === false || slot.collected === true || !slot.card) {
            return { success: false, error: '这个格子的牌已经被收走' };
        }
        const card = nineGridDrawCard(state);
        if (!card) return { success: false, error: '牌库已经发完' };

        const reference = slot.card;
        const correct = guess === 'red'
            ? card.color === 'red'
            : (guess === 'black'
                ? card.color === 'black'
                : (guess === 'big'
                    ? nineGridRankValue(card) > nineGridRankValue(reference)
                    : nineGridRankValue(card) < nineGridRankValue(reference)));
        const nextPileCount = Math.max(1, Number(slot.cardCount) || 1) + 1;
        state.grid = (state.grid || []).map((item) => {
            if (Number(item.index) !== index) return item;
            return correct
                ? { ...item, active: true, collected: false, revealed: true, card: card, cardCount: nextPileCount }
                : { ...item, active: false, collected: true, revealed: false, card: null, cardCount: 0 };
        });
        state.referenceCard = null;
        state.streak = correct ? Number(state.streak || 0) + 1 : 0;
        if (!correct) {
            const collectedPile = {
                id: 'ninegrid-pile-' + state.round + '-' + index + '-' + state.drawIndex,
                card: card,
                cardCount: nextPileCount
            };
            state.players = (state.players || []).map((player) => {
                if (player.openId !== openId) return player;
                return {
                    ...player,
                    collectedPiles: (player.collectedPiles || []).concat([collectedPile]),
                    collectedCardCount: Math.max(0, Number(player.collectedCardCount || 0)) + nextPileCount
                };
            });
        }
        const now = Date.now();
        state.lastGuess = {
            playerOpenId: openId,
            guess: guess,
            slotIndex: index,
            referenceCard: reference,
            card: card,
            pileCount: nextPileCount,
            correct: correct,
            at: now
        };
        if ((state.grid || []).every((item) => item.active === false || item.collected === true)) {
            nineGridSettle(state, now);
        } else if (correct && Number(state.streak || 0) >= 3) {
            nineGridAdvanceTurn(state, now);
        }
        state.version = Number(state.version || 0) + 1;
        bumpTenHalfStateRevision(state);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        return {
            success: true,
            correct: correct,
            slotIndex: index,
            referenceCard: reference,
            card: card,
            pileCount: nextPileCount,
            state: state
        };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleNineGridSkip(openId, roomId, roomDocId, expectedVersion) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room && room.gameState || {});
        if (!room || room.roomId !== roomId || room.gameType !== 'ninegrid') return { success: false, error: '房间不匹配' };
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) return { success: true, stale: true, state: state };
        if (state.phase !== 'playing' || state.currentPlayerOpenId !== openId || Number(state.streak || 0) < 3) {
            return { success: false, error: '现在还不能跳过' };
        }
        const now = Date.now();
        nineGridAdvanceTurn(state, now);
        state.version = Number(state.version || 0) + 1;
        bumpTenHalfStateRevision(state);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        return { success: true, state: state };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleNineGridNextRound(openId, roomId, roomDocId, expectedVersion) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const current = room && room.gameState || {};
        if (!room || room.roomId !== roomId || room.gameType !== 'ninegrid') return { success: false, error: '房间不匹配' };
        if (!(room.members || []).some((member) => member.openId === openId)) return { success: false, error: '不是房间成员' };
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(current.version)) return { success: true, stale: true, state: current };
        if (current.phase !== 'result') return { success: true, stale: true, state: current };
        const now = Date.now();
        const state = buildNineGridRound(room, current, current.nextStarterOpenId, now);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        return { success: true, state: state };
    });
    return { ...result, serverTime: Date.now() };
}

// ==================== 胆小鬼联机游戏 ====================

function createCowardDeck() {
    const suits = [
        { key: 'spade', symbol: '♠', color: 'black' },
        { key: 'heart', symbol: '♥', color: 'red' },
        { key: 'diamond', symbol: '♦', color: 'red' },
        { key: 'club', symbol: '♣', color: 'black' }
    ];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    suits.forEach((suit) => {
        ranks.forEach((rank) => {
            deck.push({
                id: 'coward-' + suit.key + '-' + rank,
                rank: rank,
                suitKey: suit.key,
                suit: suit.symbol,
                color: suit.color,
                isJoker: false
            });
        });
    });
    return queenShuffle(deck);
}

function cowardRankValue(card) {
    if (!card) return Number.POSITIVE_INFINITY;
    if (card.rank === 'A') return 1;
    if (card.rank === 'J') return 11;
    if (card.rank === 'Q') return 12;
    if (card.rank === 'K') return 13;
    return Number(card.rank) || Number.POSITIVE_INFINITY;
}

function cowardCardOrder(card) {
    const suitOrder = { club: 0, diamond: 1, heart: 2, spade: 3 };
    return cowardRankValue(card) * 4 + (suitOrder[card && card.suitKey] || 0);
}

function buildCowardRound(room, currentState, now) {
    const members = room.members || [];
    const playerOrder = members.map((member) => member.openId);
    const deck = createCowardDeck();
    const hands = playerOrder.map((playerOpenId, index) => ({
        ownerOpenId: playerOpenId,
        card: deck[index],
        cardRevision: 0
    }));
    const roundToken = 'coward_' + now + '_' + crypto.randomBytes(6).toString('hex');
    const stopUnlockAt = now + COWARD_REVEAL_WAIT_MS + COWARD_READY_COUNTDOWN_MS;
    const state = bumpTenHalfStateRevision({
        gameKind: 'coward',
        phase: 'playing',
        version: Number(currentState && currentState.version || 0) + 1,
        stateRevision: Number(currentState && currentState.stateRevision || 0),
        round: Number(currentState && currentState.round || 0) + 1,
        roundToken: roundToken,
        playerOrder: playerOrder,
        players: playerOrder.map((playerOpenId, index) => ({ openId: playerOpenId, seat: index + 1, cardRevision: 0 })),
        roundStartedAt: now,
        countdownStartedAt: now + COWARD_REVEAL_WAIT_MS,
        stopUnlockAt: stopUnlockAt,
        stopDeadlineAt: stopUnlockAt + COWARD_STOP_WINDOW_MS,
        stopOpenId: '',
        loserOpenIds: [],
        resultReason: '',
        resultDrinkCount: 0,
        skillUsedOpenIds: [],
        alcoholAdjustments: {},
        readyOpenIds: [],
        lastEvent: { type: 'roundStarted', at: now }
    });
    return {
        state: state,
        secret: {
            roomId: room.roomId,
            roundToken: roundToken,
            // 整副洗好的牌只在开局时写入一次，换牌时仅推进游标。
            deck: deck,
            drawIndex: playerOrder.length,
            createdTime: now,
            updatedTime: now
        },
        hands: hands
    };
}

async function writeCowardRoundStorage(transaction, roomId, round, now) {
    // 云开发的同一个 transaction 实例不能并发执行多条命令。这里原先用
    // Promise.all 同时 set 牌堆和所有手牌，会直接触发
    // ResourceUnavailable.TransactionBusy，哪怕只有一个玩家点击 START。
    await transaction.collection(TEN_HALF_SECRET_COLLECTION).doc(cowardSecretId(roomId)).set({
        data: round.secret
    });
    for (const hand of round.hands || []) {
        await transaction.collection(COWARD_HAND_COLLECTION)
            .doc(cowardHandId(roomId, hand.ownerOpenId))
            .set({
                data: {
                    _openid: hand.ownerOpenId,
                    ownerOpenId: hand.ownerOpenId,
                    roomId: roomId,
                    roundToken: round.state.roundToken,
                    card: hand.card,
                    cardRevision: Number(hand.cardRevision || 0),
                    createdTime: now,
                    updatedTime: now
                }
            });
    }
    cowardDebug('固定牌堆与玩家独立手牌已按事务顺序写入', roomId, {
        '本轮': round.state && round.state.roundToken || '未知',
        '牌堆张数': round.secret && round.secret.deck && round.secret.deck.length || 0,
        '抽牌游标': round.secret && Number(round.secret.drawIndex || 0),
        '独立手牌文档数': round.hands && round.hands.length || 0
    });
}

async function readCowardRoundHands(transaction, roomId, playerOrder, roundToken) {
    // 与写入同理，同一 transaction 内的读取也必须依次 await，避免结算阶段
    // 在读取多名玩家手牌时再次出现 TransactionBusy。
    const hands = [];
    for (const ownerOpenId of playerOrder || []) {
        const handResult = await transaction.collection(COWARD_HAND_COLLECTION)
            .doc(cowardHandId(roomId, ownerOpenId))
            .get();
        const hand = handResult.data || {};
        if (hand.roomId !== roomId || hand.ownerOpenId !== ownerOpenId || hand.roundToken !== roundToken || !hand.card) {
            return [];
        }
        hands.push({ ownerOpenId: ownerOpenId, card: hand.card });
    }
    return hands;
}

function cowardBaseAlcohol(state, nowValue) {
    const startAt = Number(state && state.stopUnlockAt || 0);
    const deadlineAt = Number(state && state.stopDeadlineAt || 0);
    if (!startAt) return 0;
    const now = Math.min(Number(nowValue || Date.now()), deadlineAt || Number(nowValue || Date.now()));
    return Math.max(0, Math.min(100, Math.floor(Math.max(0, now - startAt) / 2000)));
}

function cowardPresenceTime(value) {
    if (value instanceof Date) return value.getTime();
    if (value && typeof value === 'object' && value.$date !== undefined) return Number(value.$date) || 0;
    if (typeof value === 'string') return Date.parse(value) || Number(value) || 0;
    return Number(value) || 0;
}

function cowardGlobalAlcohol(state, nowValue, alcoholEvents) {
    const startAt = Number(state && state.stopUnlockAt || 0);
    const deadlineAt = Number(state && state.stopDeadlineAt || 0);
    if (!startAt) return 0;
    const now = Math.min(Number(nowValue || Date.now()), deadlineAt || Number(nowValue || Date.now()));
    const base = cowardBaseAlcohol(state, now);
    let adjustment = 0;
    (alcoholEvents || []).slice().sort((first, second) =>
        Number(first.at || 0) - Number(second.at || 0) ||
        String(first.openId || '').localeCompare(String(second.openId || ''))
    ).forEach((event) => {
        const eventAt = Math.max(startAt, Math.min(Number(event.at || startAt), deadlineAt || Number(event.at || startAt)));
        const eventBase = Math.floor(Math.max(0, eventAt - startAt) / 2000);
        const before = Math.max(0, Math.min(100, eventBase + adjustment));
        const after = Math.max(0, Math.min(100, before + Number(event.delta || 0)));
        adjustment = after - eventBase;
    });
    return Math.max(0, Math.min(100, base + adjustment));
}

async function loadCowardPresenceAlcoholEvents(roomId, roundToken) {
    const events = [];
    try {
        const result = await db.collection(TEN_HALF_PRESENCE_COLLECTION)
            .where({ roomId: roomId })
            .limit(20)
            .get();
        (result.data || []).forEach((presence) => {
            if (!presence || !presence._openid || presence.cowardRoundToken !== roundToken || !presence.cowardSkillUsed ||
                (presence.cowardSkillType !== 'alcoholPlus' && presence.cowardSkillType !== 'alcoholMinus')) return;
            events.push({
                openId: presence._openid,
                at: cowardPresenceTime(presence.cowardSkillUsedAt),
                delta: Number.isFinite(Number(presence.cowardAlcoholDelta))
                    ? Number(presence.cowardAlcoholDelta)
                    : (presence.cowardSkillType === 'alcoholPlus' ? 10 : -10)
            });
        });
    } catch (error) {
        console.error('[胆小鬼调试] 读取全房间酒量事件失败，终止本次结算以避免错误口数', {
            '房间摘要': tenHalfDebugRoom(roomId),
            '本轮': roundToken,
            '错误': error && error.message,
            '错误堆栈': error && error.stack
        });
        throw error;
    }
    return events;
}

function cowardLowestOpenId(hands) {
    const normalizedHands = Array.isArray(hands) ? hands : [];
    if (!normalizedHands.length) return '';
    return normalizedHands.slice().sort((first, second) => {
        const orderDelta = cowardCardOrder(first.card) - cowardCardOrder(second.card);
        if (orderDelta) return orderDelta;
        return String(first.ownerOpenId).localeCompare(String(second.ownerOpenId));
    })[0].ownerOpenId;
}

function settleCowardRound(state, loserOpenId, reason, now, alcoholEvents) {
    state.phase = 'result';
    state.stopOpenId = reason === 'stopped' ? loserOpenId : '';
    state.loserOpenIds = loserOpenId ? [loserOpenId] : [];
    state.resultReason = reason;
    state.resultDrinkCount = loserOpenId ? cowardGlobalAlcohol(state, now, alcoholEvents) : 0;
    state.readyOpenIds = [];
    state.resultAt = now;
    state.version = Number(state.version || 0) + 1;
    state.lastEvent = { type: 'roundResult', reason: reason, loserOpenId: loserOpenId, at: now };
    return bumpTenHalfStateRevision(state);
}

async function handleCowardStart(openId, roomId, roomDocId) {
    cowardDebug('收到开始新一轮请求', roomId, {
        '调用玩家摘要': cowardDebugPlayer(openId),
        '房间文档': roomDocId || '未提供'
    });
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const current = room && room.gameState || {};
        if (!room || room.roomId !== roomId || room.gameType !== 'coward') return { success: false, error: '房间不匹配' };
        if (!(room.members || []).some((member) => member.openId === openId)) return { success: false, error: '不是房间成员' };
        if ((room.members || []).length < 2) return { success: false, error: '至少需要2位玩家' };
        if (current.phase && current.phase !== 'waiting') return { success: true, alreadyStarted: true, state: current };

        const now = Date.now();
        const round = buildCowardRound(room, current, now);
        await writeCowardRoundStorage(transaction, roomId, round, now);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(round.state), status: 'playing', lastActiveTime: now }
        });
        const ownHand = round.hands.find((hand) => hand.ownerOpenId === openId);
        cowardDebug('新一轮事务内写入完成', roomId, {
            '调用玩家摘要': cowardDebugPlayer(openId),
            '本轮': round.state.roundToken,
            '玩家数': round.state.playerOrder.length,
            '固定牌堆张数': round.secret.deck.length,
            '抽牌游标': round.secret.drawIndex
        });
        return { success: true, state: round.state, card: ownHand && ownHand.card || null };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleCowardGetCard(openId, roomId, roomDocId, roundToken) {
    // 仅供旧客户端兼容；新客户端由 GameRoom.cardRevision 触发直读本人 CowardHand。
    if (!roomId || !roundToken) return { success: false, error: '缺少本轮信息' };
    const handResult = await db.collection(COWARD_HAND_COLLECTION)
        .doc(cowardHandId(roomId, openId))
        .get();
    const ownHand = handResult.data || {};
    const valid = ownHand.roomId === roomId &&
        ownHand.ownerOpenId === openId &&
        ownHand.roundToken === roundToken &&
        !!ownHand.card;
    return {
        success: valid,
        card: valid ? ownHand.card : null,
        cardRevision: valid ? Number(ownHand.cardRevision || 0) : 0,
        serverTime: Date.now(),
        error: valid ? '' : '没有找到你的牌'
    };
}

async function handleCowardUseSkill(openId, roomId, roomDocId, roundToken, skillType, targetOpenId) {
    cowardDebug('收到技能请求', roomId, {
        '调用玩家摘要': cowardDebugPlayer(openId),
        '目标玩家摘要': cowardDebugPlayer(targetOpenId || openId),
        '本轮': roundToken || '未提供',
        '技能': skillType || '未提供'
    });
    if (skillType !== 'swap') return { success: false, error: '该技能已改为客户端直写' };
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const ownPresence = await findTenHalfPresence(roomId, openId);
    if (ownPresence && ownPresence.cowardRoundToken === roundToken && ownPresence.cowardSkillUsed) {
        return { success: false, alreadyUsed: true, error: '本轮技能已经用过' };
    }
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room && room.gameState || {});
        if (!room || room.roomId !== roomId || room.gameType !== 'coward') return { success: false, error: '房间不匹配' };
        if (!(state.playerOrder || []).includes(openId)) return { success: false, error: '本轮只能旁观' };
        if (state.roundToken !== roundToken || state.phase !== 'playing') return { success: true, stale: true, state: state };
        const now = Date.now();
        if (now < Number(state.stopUnlockAt || 0) || now >= Number(state.stopDeadlineAt || 0)) {
            return { success: false, error: '现在不能使用技能', state: state };
        }
        if ((state.skillUsedOpenIds || []).includes(openId)) {
            return { success: false, alreadyUsed: true, error: '本轮技能已经用过', state: state };
        }

        const target = targetOpenId || openId;
        if (!(state.playerOrder || []).includes(target)) return { success: false, error: '换牌目标不在本轮' };
        const secretResult = await transaction.collection(TEN_HALF_SECRET_COLLECTION).doc(cowardSecretId(roomId)).get();
        const secret = secretResult.data || {};
        if (secret.roundToken !== roundToken) return { success: false, error: '本轮私密牌已过期' };
        const deck = Array.isArray(secret.deck) ? secret.deck : [];
        const drawIndex = Math.max(0, Number(secret.drawIndex) || 0);
        if (drawIndex >= deck.length) return { success: false, error: '没有可换的新牌' };
        const nextCard = deck[drawIndex];
        const targetHandResult = await transaction.collection(COWARD_HAND_COLLECTION)
            .doc(cowardHandId(roomId, target))
            .get();
        const targetHand = targetHandResult.data || {};
        if (targetHand.roomId !== roomId || targetHand.ownerOpenId !== target || targetHand.roundToken !== roundToken) {
            return { success: false, error: '没有找到换牌目标' };
        }
        const publicPlayer = (state.players || []).find((player) => player.openId === target) || {};
        const nextRevision = Math.max(
            Number(targetHand.cardRevision || 0),
            Number(publicPlayer.cardRevision || 0)
        ) + 1;
        state.players = (state.players || []).map((player) => player.openId === target
            ? { ...player, cardRevision: nextRevision }
            : player);
        await transaction.collection(TEN_HALF_SECRET_COLLECTION).doc(cowardSecretId(roomId)).update({
            data: {
                drawIndex: drawIndex + 1,
                updatedTime: now
            }
        });
        await transaction.collection(COWARD_HAND_COLLECTION)
            .doc(cowardHandId(roomId, target))
            .update({
                data: {
                    card: _.set(nextCard),
                    cardRevision: nextRevision,
                    updatedTime: now
                }
            });

        state.skillUsedOpenIds = Array.from(new Set((state.skillUsedOpenIds || []).concat([openId])));
        state.version = Number(state.version || 0) + 1;
        state.lastEvent = {
            type: 'skillUsed',
            skillType: skillType,
            playerOpenId: openId,
            targetOpenId: target,
            at: now
        };
        bumpTenHalfStateRevision(state);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        cowardDebug('换牌事务内写入完成', roomId, {
            '调用玩家摘要': cowardDebugPlayer(openId),
            '目标玩家摘要': cowardDebugPlayer(target),
            '本轮': roundToken,
            '目标手牌版本': nextRevision,
            '新抽牌游标': drawIndex + 1
        });
        // 旧客户端自换牌时仍能从响应取牌；替别人换牌不泄露目标手牌。
        return { success: true, state: state, card: target === openId ? nextCard : null };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleCowardStop(openId, roomId, roomDocId, roundToken) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const alcoholEvents = await loadCowardPresenceAlcoholEvents(roomId, roundToken);
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room && room.gameState || {});
        if (!room || room.roomId !== roomId || room.gameType !== 'coward') return { success: false, error: '房间不匹配' };
        if (!(state.playerOrder || []).includes(openId)) return { success: false, error: '本轮只能旁观' };
        if (state.roundToken !== roundToken || state.phase !== 'playing') return { success: true, stale: true, state: state };

        const now = Date.now();
        if (now < Number(state.stopUnlockAt || 0)) return { success: true, tooEarly: true, state: state };
        const deadlinePassed = now >= Number(state.stopDeadlineAt || 0);
        let loserOpenId = openId;
        if (deadlinePassed) {
            const hands = await readCowardRoundHands(transaction, roomId, state.playerOrder || [], roundToken);
            if (hands.length !== (state.playerOrder || []).length) {
                return { success: false, error: '本轮私密手牌不完整' };
            }
            loserOpenId = cowardLowestOpenId(hands);
        }
        settleCowardRound(
            state,
            loserOpenId,
            deadlinePassed ? 'timeout' : 'stopped',
            now,
            alcoholEvents
        );
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        return { success: true, state: state };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleCowardTimeout(openId, roomId, roomDocId, roundToken) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const alcoholEvents = await loadCowardPresenceAlcoholEvents(roomId, roundToken);
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room && room.gameState || {});
        if (!room || room.roomId !== roomId || room.gameType !== 'coward') return { success: false, error: '房间不匹配' };
        if (!(state.playerOrder || []).includes(openId)) return { success: false, error: '本轮只能旁观' };
        if (state.roundToken !== roundToken || state.phase !== 'playing') return { success: true, stale: true, state: state };
        const now = Date.now();
        if (now < Number(state.stopDeadlineAt || 0)) return { success: true, tooEarly: true, state: state };
        const hands = await readCowardRoundHands(transaction, roomId, state.playerOrder || [], roundToken);
        if (hands.length !== (state.playerOrder || []).length) {
            return { success: false, error: '本轮私密手牌不完整' };
        }
        const loserOpenId = cowardLowestOpenId(hands);
        settleCowardRound(state, loserOpenId, 'timeout', now, alcoholEvents);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(state), status: 'playing', lastActiveTime: now }
        });
        return { success: true, state: state };
    });
    return { ...result, serverTime: Date.now() };
}

async function loadCowardReadyOpenIds(roomId, roundToken) {
    const result = await db.collection(TEN_HALF_PRESENCE_COLLECTION)
        .where({ roomId: roomId })
        .limit(20)
        .get();
    return Array.from(new Set((result.data || [])
        .filter((presence) => presence &&
            presence._openid &&
            presence.cowardReady === true &&
            presence.cowardReadyRoundToken === roundToken)
        .map((presence) => presence._openid)));
}

async function markCowardReadyPresence(openId, roomId, roundToken) {
    const collection = db.collection(TEN_HALF_PRESENCE_COLLECTION);
    const existing = await findTenHalfPresence(roomId, openId);
    const data = {
        cowardReady: true,
        cowardReadyRoundToken: roundToken,
        cowardReadyAt: db.serverDate(),
        activeAt: db.serverDate(),
        updatedAt: db.serverDate()
    };
    if (existing && existing._id) {
        await collection.doc(existing._id).update({ data: data });
        return;
    }
    await collection.add({ data: { _openid: openId, roomId: roomId, ...data } });
}

async function handleCowardAdvanceRound(openId, roomId, roomDocId, roundToken) {
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const readyOpenIds = await loadCowardReadyOpenIds(roomId, roundToken);
    cowardDebug('收到协调推进请求并读取拍桌状态', roomId, {
        '调用玩家摘要': cowardDebugPlayer(openId),
        '本轮': roundToken || '未提供',
        '已拍桌人数': readyOpenIds.length
    });
    const result = await db.runTransaction(async (transaction) => {
        const roomResult = await transaction.collection('GameRoom').doc(resolvedRoomDocId).get();
        const room = roomResult.data;
        const state = cloneQueenState(room && room.gameState || {});
        if (!room || room.roomId !== roomId || room.gameType !== 'coward') return { success: false, error: '房间不匹配' };
        if (!(state.playerOrder || []).includes(openId)) return { success: false, error: '本轮只能旁观' };
        if (state.roundToken !== roundToken || state.phase !== 'result') return { success: true, stale: true, state: state };

        const allReady = (state.playerOrder || []).every((playerOpenId) => readyOpenIds.includes(playerOpenId));
        if (!allReady) {
            cowardDebug('协调推进暂缓：云端尚未看到全员拍桌', roomId, {
                '本轮': roundToken,
                '已拍桌人数': readyOpenIds.length,
                '本轮玩家数': (state.playerOrder || []).length,
                '首选协调者摘要': cowardDebugPlayer((state.playerOrder || [])[0])
            });
            return {
                success: true,
                waiting: true,
                readyOpenIds: readyOpenIds,
                coordinatorOpenId: (state.playerOrder || [])[0] || '',
                state: state
            };
        }
        const now = Date.now();
        const round = buildCowardRound(room, state, now);
        await writeCowardRoundStorage(transaction, roomId, round, now);
        await transaction.collection('GameRoom').doc(resolvedRoomDocId).update({
            data: { gameState: _.set(round.state), status: 'playing', lastActiveTime: now }
        });
        const ownHand = round.hands.find((hand) => hand.ownerOpenId === openId);
        cowardDebug('协调推进事务内完成，下一轮待提交', roomId, {
            '旧轮': roundToken,
            '新轮': round.state.roundToken,
            '调用玩家摘要': cowardDebugPlayer(openId),
            '玩家数': round.state.playerOrder.length
        });
        return { success: true, newRound: true, state: round.state, card: ownHand && ownHand.card || null };
    });
    return { ...result, serverTime: Date.now() };
}

async function handleCowardReady(openId, roomId, roomDocId, roundToken) {
    // 旧客户端兼容入口：将 ready 转写到本人 Presence，不再改写 GameRoom。
    const resolvedRoomDocId = await resolveRoomDocumentId(roomId, roomDocId);
    if (!resolvedRoomDocId) return { success: false, error: '房间不存在' };
    const roomResult = await db.collection('GameRoom').doc(resolvedRoomDocId).get();
    const room = roomResult.data;
    const state = room && room.gameState || {};
    if (!room || room.roomId !== roomId || room.gameType !== 'coward') return { success: false, error: '房间不匹配' };
    if (!(state.playerOrder || []).includes(openId)) return { success: false, error: '本轮只能旁观' };
    if (state.roundToken !== roundToken || state.phase !== 'result') return { success: true, stale: true, state: state };
    await markCowardReadyPresence(openId, roomId, roundToken);
    return await handleCowardAdvanceRound(openId, roomId, resolvedRoomDocId, roundToken);
}
