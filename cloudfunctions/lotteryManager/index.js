const cloud = require('wx-server-sdk');
const crypto = require('crypto');

const ADMIN_OPENIDS = new Set([
    'omDRE1_DMI6ti1UCmc1p3qgpDhNY',
    'omDRE11i5uj9Qvi-KViQsXM4uG0E'
]);

const APP_ID = 'wxf4daf982f0c61a12';
const ACTIVITY_COLLECTION = 'LotteryActivity';
const PARTICIPANT_COLLECTION = 'LotteryParticipant';
const WINNER_COLLECTION = 'LotteryWinner';
const SCHEDULER_COLLECTION = 'LotterySchedulerState';
const SCHEDULER_DOC_ID = 'singleton';
const TRIGGER_PREFIX = 'lotteryDraw_';
const MAX_ACTIVE_TRIGGERS = 10;
const SCHEDULER_LOCK_MS = 30 * 1000;
const FALLBACK_DRAW_GRACE_MS = 90 * 1000;
const MAX_PRIZE_COUNT = 1000;
const PAGE_SIZE = 20;
const DRAW_BATCH_SIZE = 100;

let initialized = false;
let db = null;
let _ = null;

function ensureInit() {
    if (!initialized) {
        cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
        db = cloud.database();
        _ = db.command;
        initialized = true;
    }
}

exports.main = async (event = {}, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    ensureInit();

    const wxContext = cloud.getWXContext();
    const source = wxContext.SOURCE;
    const isTimerTrigger = isTimerTriggerEvent(source, event);

    try {
        if (isTimerTrigger) {
            console.log('[LotteryTriggerDebug]', JSON.stringify({
                source,
                eventKeys: Object.keys(event || {}),
                triggerName: getTriggerEventName(event)
            }));
            return await handleDrawDue({ limit: 50, fromTrigger: true });
        }

        switch (event.action) {
            case 'create':
                return await handleCreate(event, wxContext);
            case 'dashboard':
                return await handleDashboard(event, wxContext);
            case 'getDetail':
                return await handleGetDetail(event, wxContext);
            case 'join':
                return await handleJoin(event, wxContext);
            case 'drawDue':
                return await handleDrawDue(event, wxContext);
            case 'syncDrawTriggers':
                return await handleSyncDrawTriggers(event, wxContext);
            default:
                return { success: false, error: 'Invalid action' };
        }
    } catch (err) {
        console.error('[lotteryManager] Error:', event.action, err);
        return { success: false, error: err.message || String(err) };
    }
};

async function handleCreate(event, wxContext) {
    const openId = wxContext.OPENID;
    if (!isAdminOpenId(openId)) {
        return { success: false, error: '无权限访问', code: 'PERMISSION_DENIED' };
    }

    const totalAmountFen = parseAmountFen(event.totalAmountFen, event.totalAmountYuan);
    const prizeCount = parseInt(event.prizeCount, 10);
    const openAt = Number(event.openAt);
    const now = Date.now();

    if (!Number.isInteger(totalAmountFen) || totalAmountFen <= 0) {
        return { success: false, error: '红包金额无效' };
    }
    if (!Number.isInteger(prizeCount) || prizeCount <= 0 || prizeCount > MAX_PRIZE_COUNT) {
        return { success: false, error: `红包个数需在 1-${MAX_PRIZE_COUNT} 之间` };
    }
    if (totalAmountFen < prizeCount) {
        return { success: false, error: '总金额不能小于红包个数，需保证每个红包至少 0.01 元' };
    }
    if (!Number.isFinite(openAt) || openAt <= now + 10 * 1000) {
        return { success: false, error: '开奖时间需晚于当前时间至少 10 秒' };
    }

    const lotteryId = await generateLotteryId();
    const creatorOpenIdHash = hashOpenId(openId);

    await db.collection(ACTIVITY_COLLECTION).add({
        data: {
            _id: lotteryId,
            creatorOpenIdHash,
            totalAmountFen,
            prizeCount,
            openAt,
            status: 'scheduled',
            participantCount: 0,
            luckySequence: 0,
            winnerCount: 0,
            createdAt: now,
            drawnAt: null,
            drawError: '',
            schedulerLastSyncedAt: null
        }
    });

    const scheduler = await syncDrawTriggers({ bestEffort: true });
    const detailPath = `/pages/lottery/detail?id=${lotteryId}`;

    return {
        success: true,
        data: {
            lotteryId,
            path: detailPath,
            appId: APP_ID,
            officialAccountSnippet: buildOfficialAccountSnippet(lotteryId),
            scheduler
        }
    };
}

async function handleDashboard(event, wxContext) {
    const openId = wxContext.OPENID;
    if (!openId) {
        return { success: false, error: '无法获取用户身份' };
    }

    const pageNumber = Math.max(parseInt(event.pageNumber, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(event.pageSize, 10) || PAGE_SIZE, 1), 50);
    const isAdmin = isAdminOpenId(openId);

    let response;
    if (isAdmin) {
      await drawDueForRelevantActivities({
          limit: 20,
          drawSource: 'admin_dashboard_fallback'
      });
      response = await getAdminDashboard(openId, pageNumber, pageSize);
  } else {
        await drawDueForRelevantActivities({
            limit: 20,
            drawSource: 'user_dashboard_fallback'
        });
        response = await getUserDashboard(openId, pageNumber, pageSize);
    }

    response.data.debugLastDraw = await getLatestDrawDebug();
    return response;
}

async function handleGetDetail(event, wxContext) {
    const openId = wxContext.OPENID;
    const lotteryId = normalizeLotteryId(event.lotteryId || event.id);
    if (!lotteryId) {
        return { success: false, error: '缺少抽奖ID' };
    }

    await maybeDrawOne(lotteryId, { drawSource: 'detail_fallback' });

    const activity = await getActivity(lotteryId);
    if (!activity) {
        return { success: false, error: '抽奖不存在', code: 'NOT_FOUND' };
    }

    const userState = openId ? await getUserLotteryState(lotteryId, openId) : {};
    const detail = formatActivity(activity, userState);
    if (openId && isAdminOpenId(openId) && activity.status === 'drawn') {
        detail.adminWinners = await getAdminWinnerLuckyList(lotteryId);
    }
    detail.debugLastDraw = await getLatestDrawDebug();

    return {
        success: true,
        data: detail
    };
}

async function handleJoin(event, wxContext) {
    const openId = wxContext.OPENID;
    const lotteryId = normalizeLotteryId(event.lotteryId || event.id);
    if (!openId) {
        return { success: false, error: '无法获取用户身份' };
    }
    if (!lotteryId) {
        return { success: false, error: '缺少抽奖ID' };
    }

    await maybeDrawOne(lotteryId, { drawSource: 'join_fallback' });

    const activity = await getActivity(lotteryId);
    if (!activity) {
        return { success: false, error: '抽奖不存在', code: 'NOT_FOUND' };
    }
    if (activity.status !== 'scheduled') {
        const userState = await getUserLotteryState(lotteryId, openId);
        return {
            success: false,
            error: '本次抽奖已开奖',
            code: 'LOTTERY_CLOSED',
            data: await attachDrawDebug(formatActivity(activity, userState))
        };
    }
    if (activity.openAt <= Date.now()) {
        const drawResult = await maybeDrawOne(lotteryId, { force: true, drawSource: 'join_fallback' });
        const refreshedActivity = await getActivity(lotteryId);
        const userState = await getUserLotteryState(lotteryId, openId);
        const waitingForTrigger = drawResult?.reason === 'waiting_timer_trigger_grace';
        return {
            success: false,
            error: waitingForTrigger ? '开奖时间已到，正在等待定时触发器开奖，请稍后刷新' : (refreshedActivity?.status === 'drawing' ? '正在开奖，请稍后刷新' : '本次抽奖已开奖'),
            code: 'LOTTERY_CLOSED',
            data: await attachDrawDebug(formatActivity(refreshedActivity || activity, userState))
        };
    }

    const openIdHash = hashOpenId(openId);
    const participantId = buildParticipantId(lotteryId, openIdHash);
    const now = Date.now();

    const existing = await getParticipantById(participantId);
    if (existing) {
        const userState = await getUserLotteryState(lotteryId, openId);
        return {
            success: true,
            alreadyJoined: true,
            data: await attachDrawDebug(formatActivity(activity, userState))
        };
    }

    try {
        const joinResult = await createParticipantWithLuckyCode({
            lotteryId,
            openId,
            openIdHash,
            participantId,
            joinedAt: now
        });
        const refreshed = await getActivity(lotteryId);
        return {
            success: true,
            alreadyJoined: !!joinResult.alreadyJoined,
            data: await attachDrawDebug(formatActivity(refreshed || activity, {
                isParticipant: true,
                joinedAt: joinResult.participant?.joinedAt || now,
                luckyNumber: joinResult.participant?.luckyNumber || null,
                luckyCode: joinResult.participant?.luckyCode || ''
            }))
        };
    } catch (err) {
        if (isDuplicateError(err)) {
            const userState = await getUserLotteryState(lotteryId, openId);
            return {
                success: true,
                alreadyJoined: true,
                data: await attachDrawDebug(formatActivity(activity, userState))
            };
        }
        if (err.code === 'LOTTERY_CLOSED') {
            const refreshedActivity = await getActivity(lotteryId);
            const userState = await getUserLotteryState(lotteryId, openId);
            return {
                success: false,
                error: err.message || '本次抽奖已开奖',
                code: 'LOTTERY_CLOSED',
                data: await attachDrawDebug(formatActivity(refreshedActivity || activity, userState))
            };
        }
        throw err;
    }
}

async function handleDrawDue(event = {}, wxContext = {}) {
    if (!event.fromTrigger && !isAdminOpenId(wxContext.OPENID)) {
        return { success: false, error: '无权限访问', code: 'PERMISSION_DENIED' };
    }

    const limit = Math.min(Math.max(parseInt(event.limit, 10) || 50, 1), 100);
    const result = await drawDue({
        limit,
        drawSource: event.fromTrigger ? 'timer_trigger' : 'admin_manual_draw_due'
    });
    const scheduler = await syncDrawTriggers({ bestEffort: true });
    return {
        success: true,
        data: {
            ...result,
            scheduler
        }
    };
}

async function createParticipantWithLuckyCode({ lotteryId, openId, openIdHash, participantId, joinedAt }) {
    if (typeof db.runTransaction !== 'function') {
        throw new Error('当前云数据库 SDK 不支持事务，无法安全分配幸运数字');
    }

    return await db.runTransaction(async transaction => {
        const activityResult = await transaction.collection(ACTIVITY_COLLECTION).doc(lotteryId).get();
        const activity = activityResult?.data;
        if (!activity) {
            const err = new Error('抽奖不存在');
            err.code = 'NOT_FOUND';
            throw err;
        }
        if (activity.status !== 'scheduled' || Number(activity.openAt) <= Date.now()) {
            const err = new Error(activity.status === 'drawing' ? '正在开奖，请稍后刷新' : '本次抽奖已开奖');
            err.code = 'LOTTERY_CLOSED';
            throw err;
        }

        const existingResult = await transaction.collection(PARTICIPANT_COLLECTION).doc(participantId).get()
            .catch(err => {
                if (isNotFoundError(err)) return null;
                throw err;
            });
        if (existingResult?.data) {
            return { alreadyJoined: true, participant: existingResult.data };
        }

        const baseSequence = Math.max(
            Number(activity.luckySequence || 0),
            Number(activity.participantCount || 0)
        );
        const luckyNumber = baseSequence + 1;
        const luckyCode = formatLuckyCode(luckyNumber);
        const participant = {
            _id: participantId,
            lotteryId,
            openId,
            openIdHash,
            randomKey: crypto.randomBytes(12).toString('hex'),
            luckyNumber,
            luckyCode,
            joinedAt
        };

        await transaction.collection(PARTICIPANT_COLLECTION).add({ data: participant });
        await transaction.collection(ACTIVITY_COLLECTION).doc(lotteryId).update({
            data: {
                participantCount: _.inc(1),
                luckySequence: luckyNumber,
                lastParticipantAt: joinedAt
            }
        });

        return { alreadyJoined: false, participant };
    });
}

async function handleSyncDrawTriggers(event, wxContext) {
    const openId = wxContext.OPENID;
    if (!isAdminOpenId(openId)) {
        return { success: false, error: '无权限访问', code: 'PERMISSION_DENIED' };
    }

    const result = await syncDrawTriggers({ bestEffort: false, force: true });
    return { success: true, data: result };
}

async function getAdminDashboard(openId, pageNumber, pageSize) {
  const { data } = await db.collection(ACTIVITY_COLLECTION)
      .orderBy('createdAt', 'desc')
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .get();

  const records = (data || []).map(item => formatActivity(item, { adminView: true }));
  return {
      success: true,
      data: {
          role: 'admin',
          records,
          pageNumber,
          pageSize,
          hasMore: records.length === pageSize
      }
  };
}


async function getUserDashboard(openId, pageNumber, pageSize) {
    const openIdHash = hashOpenId(openId);
    const { data: activityData } = await db.collection(ACTIVITY_COLLECTION)
        .orderBy('createdAt', 'desc')
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .get();

    const activities = activityData || [];
    const lotteryIds = activities.map(item => item._id);
    if (lotteryIds.length === 0) {
        return {
            success: true,
            data: {
                role: 'user',
                records: [],
                pageNumber,
                pageSize,
                hasMore: false
            }
        };
    }

    const participantIds = lotteryIds.map(lotteryId => buildParticipantId(lotteryId, openIdHash));
    const winnerIds = lotteryIds.map(lotteryId => buildWinnerId(lotteryId, openIdHash));
    const [participantsResult, winnersResult] = await Promise.all([
        db.collection(PARTICIPANT_COLLECTION).where({ _id: _.in(participantIds) }).get(),
        db.collection(WINNER_COLLECTION).where({ _id: _.in(winnerIds) }).get()
    ]);

    const participantMap = new Map((participantsResult.data || []).map(item => [item.lotteryId, item]));
    const winnerMap = new Map((winnersResult.data || []).map(item => [item.lotteryId, item]));

    const records = activities.map(activity => {
        const participant = participantMap.get(activity._id);
        const winner = winnerMap.get(activity._id);
        return formatActivity(activity, {
            isParticipant: !!participant,
            isWinner: !!winner,
            prizeAmountFen: winner?.prizeAmountFen || 0,
            luckyNumber: participant?.luckyNumber || null,
            luckyCode: participant?.luckyCode || '',
            joinedAt: participant?.joinedAt || null
        });
    });

    return {
        success: true,
        data: {
            role: 'user',
            records,
            pageNumber,
            pageSize,
            hasMore: records.length === pageSize
        }
    };
}

async function drawDue({ limit = 50, drawSource = 'unknown' } = {}) {
    const now = Date.now();
    const { data } = await db.collection(ACTIVITY_COLLECTION)
        .where({
            status: 'scheduled',
            openAt: _.lte(now)
        })
        .orderBy('openAt', 'asc')
        .limit(limit)
        .get();

    const activities = data || [];
    const results = [];
    for (const activity of activities) {
        results.push(await maybeDrawOne(activity._id, { force: true, drawSource }));
    }

    return {
        checked: activities.length,
        drawn: results.filter(item => item.drawn).length,
        results
    };
}

async function drawDueForRelevantActivities({ creatorOpenIdHash, userOpenIdHash, limit = 20, drawSource = 'dashboard_fallback' }) {
    const fallbackDueAt = getFallbackDueAt(drawSource);
    if (creatorOpenIdHash) {
        const { data } = await db.collection(ACTIVITY_COLLECTION)
            .where({ creatorOpenIdHash, status: 'scheduled', openAt: _.lte(fallbackDueAt) })
            .orderBy('openAt', 'asc')
            .limit(limit)
            .get();
        for (const activity of data || []) {
            await maybeDrawOne(activity._id, { force: true, drawSource });
        }
        return;
    }

    if (userOpenIdHash) {
        const { data: participantData } = await db.collection(PARTICIPANT_COLLECTION)
            .where({ openIdHash: userOpenIdHash })
            .orderBy('joinedAt', 'desc')
            .limit(limit)
            .get();
        const ids = (participantData || []).map(item => item.lotteryId);
        if (ids.length === 0) return;
        const { data: activityData } = await db.collection(ACTIVITY_COLLECTION)
            .where({ _id: _.in(ids), status: 'scheduled', openAt: _.lte(fallbackDueAt) })
            .get();
        for (const activity of activityData || []) {
            await maybeDrawOne(activity._id, { force: true, drawSource });
        }
        return;
    }

    const { data } = await db.collection(ACTIVITY_COLLECTION)
        .where({ status: 'scheduled', openAt: _.lte(fallbackDueAt) })
        .orderBy('openAt', 'asc')
        .limit(limit)
        .get();
    for (const activity of data || []) {
        await maybeDrawOne(activity._id, { force: true, drawSource });
    }
}

async function maybeDrawOne(lotteryId, options = {}) {
    const drawSource = normalizeDrawSource(options.drawSource);
    const activity = await getActivity(lotteryId);
    if (!activity) return { lotteryId, drawn: false, reason: 'not_found' };
    if (activity.status === 'drawn') return { lotteryId, drawn: false, reason: 'already_drawn' };
    if (activity.status !== 'scheduled') return { lotteryId, drawn: false, reason: activity.status };
    if (!options.force && activity.openAt > Date.now()) {
        return { lotteryId, drawn: false, reason: 'not_due' };
    }
    if (shouldWaitForTimerTrigger(activity, drawSource, options)) {
        const waitUntil = Number(activity.openAt) + FALLBACK_DRAW_GRACE_MS;
        console.log('[LotteryDrawDebug]', JSON.stringify({
            lotteryId,
            drawSource,
            drawSourceText: getDrawSourceText(drawSource),
            reason: 'waiting_timer_trigger_grace',
            openAt: activity.openAt,
            openAtText: formatTime(activity.openAt),
            waitUntil,
            waitUntilText: formatTime(waitUntil)
        }));
        return {
            lotteryId,
            drawn: false,
            reason: 'waiting_timer_trigger_grace',
            drawSource,
            waitUntil,
            waitUntilText: formatTime(waitUntil)
        };
    }

    const lockResult = await db.collection(ACTIVITY_COLLECTION)
        .where({ _id: lotteryId, status: 'scheduled' })
        .update({
            data: {
                status: 'drawing',
                drawingStartedAt: Date.now(),
                drawSource,
                drawSourceText: getDrawSourceText(drawSource),
                drawError: ''
            }
        });

    if (!lockResult?.stats?.updated) {
        return { lotteryId, drawn: false, reason: 'locked' };
    }

    try {
        const totalResult = await db.collection(PARTICIPANT_COLLECTION)
            .where({ lotteryId })
            .count();
        const participantTotal = totalResult.total || 0;
        const winnerCount = Math.min(activity.prizeCount || 0, participantTotal);

        if (winnerCount <= 0) {
            const drawnAt = Date.now();
            await db.collection(ACTIVITY_COLLECTION).doc(lotteryId).update({
                data: {
                    status: 'drawn',
                    participantCount: participantTotal,
                    winnerCount: 0,
                    drawnAt,
                    drawingStartedAt: null,
                    drawSource,
                    drawSourceText: getDrawSourceText(drawSource),
                    drawDebugLoggedAt: drawnAt
                }
            });
            logDrawDebug({
                lotteryId,
                drawSource,
                drawnAt,
                participantCount: participantTotal,
                winnerCount: 0
            });
            return { lotteryId, drawn: true, winnerCount: 0 };
        }

        const winners = await getWinnerParticipants(lotteryId, winnerCount);
        const basePrize = Math.floor(activity.totalAmountFen / winnerCount);
        const remainder = activity.totalAmountFen % winnerCount;
        const now = Date.now();

        for (let i = 0; i < winners.length; i++) {
            const participant = winners[i];
            const prizeAmountFen = basePrize + (i < remainder ? 1 : 0);
            await addWinnerIfMissing({
                lotteryId,
                openIdHash: participant.openIdHash,
                luckyNumber: participant.luckyNumber || null,
                luckyCode: participant.luckyCode || '',
                prizeAmountFen,
                rank: i + 1,
                drawnAt: now
            });
        }

        await db.collection(ACTIVITY_COLLECTION).doc(lotteryId).update({
            data: {
                status: 'drawn',
                participantCount: participantTotal,
                winnerCount: winners.length,
                drawnAt: now,
                drawingStartedAt: null,
                drawSource,
                drawSourceText: getDrawSourceText(drawSource),
                drawDebugLoggedAt: now,
                drawError: ''
            }
        });

        logDrawDebug({
            lotteryId,
            drawSource,
            drawnAt: now,
            participantCount: participantTotal,
            winnerCount: winners.length
        });

        return { lotteryId, drawn: true, winnerCount: winners.length };
    } catch (err) {
        console.error('[lotteryManager] draw failed:', lotteryId, err);
        await db.collection(ACTIVITY_COLLECTION).doc(lotteryId).update({
            data: {
                status: 'scheduled',
                drawingStartedAt: null,
                drawError: err.message || String(err)
            }
        });
        return { lotteryId, drawn: false, reason: 'draw_failed', error: err.message || String(err) };
    }
}

async function getWinnerParticipants(lotteryId, winnerCount) {
    const winners = [];
    let offset = 0;
    while (winners.length < winnerCount) {
        const batchSize = Math.min(DRAW_BATCH_SIZE, winnerCount - winners.length);
        const { data } = await db.collection(PARTICIPANT_COLLECTION)
            .where({ lotteryId })
            .orderBy('randomKey', 'asc')
            .skip(offset)
            .limit(batchSize)
            .get();
        const batch = data || [];
        winners.push(...batch);
        if (batch.length < batchSize) break;
        offset += batchSize;
    }
    return winners;
}

async function getAdminWinnerLuckyList(lotteryId) {
    const winners = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
        const { data } = await db.collection(WINNER_COLLECTION)
            .where({ lotteryId })
            .orderBy('rank', 'asc')
            .skip(offset)
            .limit(pageSize)
            .get();
        const batch = data || [];
        winners.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    const missingParticipantIds = winners
        .filter(item => !item.luckyCode && item.openIdHash)
        .map(item => buildParticipantId(lotteryId, item.openIdHash));
    const participantMap = await getParticipantsByIds(missingParticipantIds);

    return winners.map(winner => {
        const participant = participantMap.get(buildParticipantId(lotteryId, winner.openIdHash));
        const luckyCode = winner.luckyCode || participant?.luckyCode || '';
        const luckyNumber = winner.luckyNumber || participant?.luckyNumber || null;
        return {
            id: winner._id || `${lotteryId}_${winner.rank || 'unknown'}`,
            rank: winner.rank || null,
            luckyNumber,
            luckyCode,
            luckyCodeText: luckyCode,
            prizeAmountFen: winner.prizeAmountFen || 0,
            prizeAmountText: formatFen(winner.prizeAmountFen || 0)
        };
    }).filter(item => !!item.luckyCode);
}

async function getParticipantsByIds(ids) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    const participantMap = new Map();
    for (let i = 0; i < uniqueIds.length; i += 100) {
        const chunk = uniqueIds.slice(i, i + 100);
        if (chunk.length === 0) continue;
        const { data } = await db.collection(PARTICIPANT_COLLECTION)
            .where({ _id: _.in(chunk) })
            .get();
        for (const item of data || []) {
            participantMap.set(item._id, item);
        }
    }
    return participantMap;
}

async function attachDrawDebug(data) {
    if (!data) return data;
    return {
        ...data,
        debugLastDraw: await getLatestDrawDebug()
    };
}

async function getLatestDrawDebug() {
    try {
        const { data } = await db.collection(ACTIVITY_COLLECTION)
            .where({ status: 'drawn' })
            .orderBy('drawnAt', 'desc')
            .limit(1)
            .get();
        const activity = data?.[0];
        if (!activity) return null;
        return formatDrawDebug(activity);
    } catch (err) {
        console.warn('[LotteryDrawDebug] 查询最近开奖记录失败:', err.message || err);
        return null;
    }
}

function formatDrawDebug(activity) {
    const drawSource = normalizeDrawSource(activity.drawSource);
    return {
        lotteryId: activity._id,
        drawSource,
        drawSourceText: activity.drawSourceText || getDrawSourceText(drawSource),
        openAt: activity.openAt || null,
        openAtText: formatTime(activity.openAt),
        drawnAt: activity.drawnAt || null,
        drawnAtText: formatTime(activity.drawnAt),
        participantCount: activity.participantCount || 0,
        winnerCount: activity.winnerCount || 0
    };
}

function logDrawDebug({ lotteryId, drawSource, drawnAt, participantCount, winnerCount }) {
    const debug = {
        lotteryId,
        drawSource,
        drawSourceText: getDrawSourceText(drawSource),
        drawnAt,
        drawnAtText: formatTime(drawnAt),
        participantCount,
        winnerCount
    };
    console.log('[LotteryDrawDebug]', JSON.stringify(debug));
}

async function addWinnerIfMissing({ lotteryId, openIdHash, luckyNumber, luckyCode, prizeAmountFen, rank, drawnAt }) {
    const winnerId = buildWinnerId(lotteryId, openIdHash);
    try {
        await db.collection(WINNER_COLLECTION).add({
            data: {
                _id: winnerId,
                lotteryId,
                openIdHash,
                luckyNumber: luckyNumber || null,
                luckyCode: luckyCode || '',
                prizeAmountFen,
                rank,
                drawnAt
            }
        });
    } catch (err) {
        if (!isDuplicateError(err)) throw err;
    }
}

async function syncDrawTriggers(options = {}) {
    const lock = await acquireSchedulerLock(options);
    if (!lock.acquired) return lock;

    try {
        const manager = getManagerClient();
        if (!manager.ok) {
            await updateSchedulerState({
                syncingUntil: 0,
                lastSyncedAt: Date.now(),
                lastError: manager.error,
                activeTriggerNames: lock.previousState?.activeTriggerNames || [],
                activeTriggerTimes: lock.previousState?.activeTriggerTimes || []
            });
            return { synced: false, reason: manager.error };
        }

        const futureTimes = await getUpcomingDrawTimes();
        const desiredTriggers = futureTimes.map(openAt => ({
            name: buildTriggerName(openAt),
            type: 'timer',
            config: buildCron(openAt)
        }));
        const previousNames = lock.previousState?.activeTriggerNames || [];

        if (previousNames.length > 0) {
            try {
                await manager.client.functions.batchDeleteTriggers({
                    envId: manager.envId,
                    functions: [{
                        name: manager.functionName,
                        triggers: previousNames.map(name => ({ name }))
                    }]
                });
            } catch (err) {
                console.warn('[lotteryManager] delete old triggers failed:', err.message || err);
            }
        }

        if (desiredTriggers.length > 0) {
            await manager.client.functions.batchCreateTriggers({
                envId: manager.envId,
                functions: [{
                    name: manager.functionName,
                    triggers: desiredTriggers
                }]
            });
        }

        await updateSchedulerState({
            activeTriggerNames: desiredTriggers.map(item => item.name),
            activeTriggerTimes: futureTimes,
            syncingUntil: 0,
            lastSyncedAt: Date.now(),
            lastError: ''
        });

        return {
            synced: true,
            triggerCount: desiredTriggers.length,
            triggerNames: desiredTriggers.map(item => item.name)
        };
    } catch (err) {
        await updateSchedulerState({
            syncingUntil: 0,
            lastSyncedAt: Date.now(),
            lastError: err.message || String(err)
        });
        if (options.bestEffort) {
            return { synced: false, reason: err.message || String(err) };
        }
        throw err;
    }
}

async function acquireSchedulerLock(options = {}) {
    const collection = db.collection(SCHEDULER_COLLECTION);
    const now = Date.now();
    const { data } = await collection.where({ _id: SCHEDULER_DOC_ID }).limit(1).get();
    const state = data?.[0] || null;

    if (state?.syncingUntil && state.syncingUntil > now && !options.force) {
        return { acquired: false, synced: false, reason: 'sync_in_progress' };
    }

    const nextState = {
        syncingUntil: now + SCHEDULER_LOCK_MS,
        lockUpdatedAt: now
    };

    if (state) {
        await collection.doc(SCHEDULER_DOC_ID).update({ data: nextState });
    } else {
        await collection.add({
            data: {
                _id: SCHEDULER_DOC_ID,
                activeTriggerNames: [],
                activeTriggerTimes: [],
                lastSyncedAt: null,
                lastError: '',
                ...nextState
            }
        });
    }

    return { acquired: true, previousState: state };
}

async function updateSchedulerState(data) {
    const collection = db.collection(SCHEDULER_COLLECTION);
    try {
        await collection.doc(SCHEDULER_DOC_ID).update({ data });
    } catch (err) {
        await collection.add({
            data: {
                _id: SCHEDULER_DOC_ID,
                activeTriggerNames: [],
                activeTriggerTimes: [],
                ...data
            }
        }).catch(addErr => {
            if (!isDuplicateError(addErr)) throw addErr;
        });
    }
}

function getManagerClient() {
    const secretId = process.env.TCB_MANAGER_SECRET_ID;
    const secretKey = process.env.TCB_MANAGER_SECRET_KEY;
    const envId = process.env.TCB_ENV_ID || process.env.SCF_NAMESPACE || process.env.TCB_ENV;
    const functionName = process.env.LOTTERY_TRIGGER_FUNCTION || 'lotteryManager';
    const apiKey = process.env.TCB_MANAGER_API_KEY || process.env.TCB_SERVER_API_KEY || process.env.TCB_API_KEY;

    if (apiKey && (!secretId || !secretKey)) {
        return { ok: false, error: 'api_key_cannot_manage_triggers' };
    }

    if (!secretId || !secretKey || !envId) {
        return { ok: false, error: 'missing_manager_env' };
    }

    try {
        const CloudBaseModule = require('@cloudbase/manager-node');
        const CloudBase = CloudBaseModule.default || CloudBaseModule;
        const client = new CloudBase({ secretId, secretKey, envId });
        return { ok: true, client, envId, functionName };
    } catch (err) {
        return { ok: false, error: err.message || String(err) };
    }
}

async function getUpcomingDrawTimes() {
    const now = Date.now();
    const { data } = await db.collection(ACTIVITY_COLLECTION)
        .where({ status: 'scheduled', openAt: _.gt(now) })
        .orderBy('openAt', 'asc')
        .limit(100)
        .get();

    const times = [];
    const seen = new Set();
    for (const activity of data || []) {
        const openAt = Number(activity.openAt);
        if (!Number.isFinite(openAt) || seen.has(openAt)) continue;
        seen.add(openAt);
        times.push(openAt);
        if (times.length >= MAX_ACTIVE_TRIGGERS) break;
    }
    return times;
}

function buildCron(timestamp) {
    const chinaDate = new Date(Number(timestamp) + 8 * 60 * 60 * 1000);
    const second = chinaDate.getUTCSeconds();
    const minute = chinaDate.getUTCMinutes();
    const hour = chinaDate.getUTCHours();
    const day = chinaDate.getUTCDate();
    const month = chinaDate.getUTCMonth() + 1;
    const year = chinaDate.getUTCFullYear();
    return `${second} ${minute} ${hour} ${day} ${month} * ${year}`;
}

function buildTriggerName(timestamp) {
    const chinaDate = new Date(Number(timestamp) + 8 * 60 * 60 * 1000);
    const y = chinaDate.getUTCFullYear();
    const m = pad2(chinaDate.getUTCMonth() + 1);
    const d = pad2(chinaDate.getUTCDate());
    const h = pad2(chinaDate.getUTCHours());
    const min = pad2(chinaDate.getUTCMinutes());
    const s = pad2(chinaDate.getUTCSeconds());
    return `${TRIGGER_PREFIX}${y}${m}${d}${h}${min}${s}`;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

async function getActivity(lotteryId) {
    const { data } = await db.collection(ACTIVITY_COLLECTION)
        .where({ _id: lotteryId })
        .limit(1)
        .get();
    return data?.[0] || null;
}

async function getParticipantById(participantId) {
    const { data } = await db.collection(PARTICIPANT_COLLECTION)
        .where({ _id: participantId })
        .limit(1)
        .get();
    return data?.[0] || null;
}

async function getUserLotteryState(lotteryId, openId) {
    const openIdHash = hashOpenId(openId);
    const participantId = buildParticipantId(lotteryId, openIdHash);
    const winnerId = buildWinnerId(lotteryId, openIdHash);

    const [participant, winnerResult] = await Promise.all([
        getParticipantById(participantId),
        db.collection(WINNER_COLLECTION).where({ _id: winnerId }).limit(1).get()
    ]);
    const winner = winnerResult.data?.[0] || null;

    return {
        isParticipant: !!participant,
        joinedAt: participant?.joinedAt || null,
        luckyNumber: participant?.luckyNumber || null,
        luckyCode: participant?.luckyCode || '',
        isWinner: !!winner,
        prizeAmountFen: winner?.prizeAmountFen || 0,
        winnerRank: winner?.rank || null
    };
}

async function generateLotteryId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let attempt = 0; attempt < 10; attempt++) {
        let id = '';
        const bytes = crypto.randomBytes(16);
        for (let i = 0; i < 16; i++) {
            id += chars[bytes[i] % chars.length];
        }
        const existing = await getActivity(id);
        if (!existing) return id;
    }
    throw new Error('生成抽奖ID失败，请重试');
}

function parseAmountFen(totalAmountFen, totalAmountYuan) {
    if (totalAmountFen !== undefined && totalAmountFen !== null && totalAmountFen !== '') {
        return Math.round(Number(totalAmountFen));
    }
    const amount = Number(totalAmountYuan);
    if (!Number.isFinite(amount)) return NaN;
    return Math.round(amount * 100);
}

function normalizeLotteryId(value) {
    return String(value || '').trim();
}

function isAdminOpenId(openId) {
    return !!openId && ADMIN_OPENIDS.has(openId);
}

function isTimerTriggerEvent(source, event = {}) {
    if (source === 'wx_trigger') return true;
    const triggerName = getTriggerEventName(event);
    if (triggerName && triggerName.startsWith(TRIGGER_PREFIX)) return true;
    const type = String(
        event.Type ||
        event.type ||
        event.EventType ||
        event.eventType ||
        event.source ||
        ''
    ).toLowerCase();
    return type.includes('timer');
}

function getTriggerEventName(event = {}) {
    return String(
        event.TriggerName ||
        event.triggerName ||
        event.name ||
        event.trigger_name ||
        ''
    );
}

function normalizeDrawSource(source) {
    const value = String(source || '').trim();
    const knownSources = new Set([
        'timer_trigger',
        'detail_fallback',
        'join_fallback',
        'admin_dashboard_fallback',
        'user_dashboard_fallback',
        'admin_manual_draw_due',
        'dashboard_fallback'
    ]);
    return knownSources.has(value) ? value : 'unknown';
}

function getDrawSourceText(source) {
    switch (normalizeDrawSource(source)) {
        case 'timer_trigger': return '定时触发器准点开奖';
        case 'detail_fallback': return '详情页访问兜底开奖';
        case 'join_fallback': return '参与请求兜底开奖';
        case 'admin_dashboard_fallback': return '管理员列表访问兜底开奖';
        case 'user_dashboard_fallback': return '用户参与列表访问兜底开奖';
        case 'admin_manual_draw_due': return '管理员手动调用 drawDue 开奖';
        case 'dashboard_fallback': return '列表访问兜底开奖';
        default: return '未知开奖方式';
    }
}

function isFallbackDrawSource(source) {
    return normalizeDrawSource(source).endsWith('_fallback') || normalizeDrawSource(source) === 'dashboard_fallback';
}

function shouldWaitForTimerTrigger(activity, drawSource, options = {}) {
    if (options.skipFallbackGrace) return false;
    if (!isFallbackDrawSource(drawSource)) return false;
    const openAt = Number(activity?.openAt || 0);
    const elapsed = Date.now() - openAt;
    return Number.isFinite(openAt) && elapsed >= 0 && elapsed < FALLBACK_DRAW_GRACE_MS;
}

function getFallbackDueAt(drawSource) {
    return isFallbackDrawSource(drawSource)
        ? Date.now() - FALLBACK_DRAW_GRACE_MS
        : Date.now();
}

function hashOpenId(openId) {
    return crypto.createHash('sha256').update(String(openId || '')).digest('hex');
}

function buildParticipantId(lotteryId, openIdHash) {
    return `${lotteryId}_${openIdHash}`;
}

function buildWinnerId(lotteryId, openIdHash) {
    return `${lotteryId}_${openIdHash}`;
}

function formatLuckyCode(luckyNumber) {
    return `MF${String(luckyNumber).padStart(6, '0')}`;
}

function buildOfficialAccountSnippet(lotteryId) {
    return `<a data-miniprogram-appid="${APP_ID}" data-miniprogram-path="/pages/lottery/detail?id=${lotteryId}" href=" ">点我参与抽奖！</a>`;
}

function formatActivity(activity, state = {}) {
    const winnerCount = activity.winnerCount || 0;
    const effectivePrizeCount = activity.status === 'drawn' ? winnerCount : activity.prizeCount;
    return {
        lotteryId: activity._id,
        totalAmountFen: activity.totalAmountFen || 0,
        totalAmountText: formatFen(activity.totalAmountFen || 0),
        prizeCount: activity.prizeCount || 0,
        effectivePrizeCount,
        openAt: activity.openAt || null,
        openAtText: formatTime(activity.openAt),
        status: activity.status || 'scheduled',
        statusText: getStatusText(activity.status),
        participantCount: activity.participantCount || 0,
        winnerCount,
        drawnAt: activity.drawnAt || null,
        drawnAtText: formatTime(activity.drawnAt),
        drawSource: activity.drawSource || '',
        drawSourceText: activity.drawSourceText || getDrawSourceText(activity.drawSource),
        isParticipant: !!state.isParticipant,
        joinedAt: state.joinedAt || null,
        luckyNumber: state.luckyNumber || null,
        luckyCode: state.luckyCode || '',
        isWinner: !!state.isWinner,
        prizeAmountFen: state.prizeAmountFen || 0,
        prizeAmountText: state.prizeAmountFen ? formatFen(state.prizeAmountFen) : '',
        winnerRank: state.winnerRank || null,
        path: `/pages/lottery/detail?id=${activity._id}`,
        appId: APP_ID,
        officialAccountSnippet: buildOfficialAccountSnippet(activity._id)
    };
}

function getStatusText(status) {
    switch (status) {
        case 'scheduled': return '待开奖';
        case 'drawing': return '开奖中';
        case 'drawn': return '已开奖';
        default: return '未知';
    }
}

function formatFen(fen) {
    return (Number(fen || 0) / 100).toFixed(2);
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(Number(timestamp) + 8 * 60 * 60 * 1000);
    const y = date.getUTCFullYear();
    const m = pad2(date.getUTCMonth() + 1);
    const d = pad2(date.getUTCDate());
    const h = pad2(date.getUTCHours());
    const min = pad2(date.getUTCMinutes());
    return `${y}-${m}-${d} ${h}:${min}`;
}

function isDuplicateError(err) {
    const message = err?.message || String(err || '');
    return /duplicate|E11000|already exists|存在|重复/i.test(message);
}

function isNotFoundError(err) {
    const message = err?.message || String(err || '');
    return /not found|does not exist|document not exists|不存在/i.test(message);
}
