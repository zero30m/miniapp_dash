const cloud = require('wx-server-sdk');
const crypto = require('crypto');

const ADMIN_OPENIDS = new Set([
    'omDRE1_DMI6ti1UCmc1p3qgpDhNY',
    'omDRE11i5uj9Qvi-KViQsXM4uG0E'
]);

const TEMPLATE_ID = 'XFkqYn8Cw06bRDbo46cABhWhK-0IZyo9rFKvBaTo8gw';
const ACTIVITY_COLLECTION = 'LotteryActivity';
const PARTICIPANT_COLLECTION = 'LotteryParticipant';
const WINNER_COLLECTION = 'LotteryWinner';
const CONSENT_COLLECTION = 'LotterySubscribeConsent';
const SEND_LOG_COLLECTION = 'LotterySubscribeSendLog';
const MINIPROGRAM_STATE = 'formal';
const SEND_LANG = 'zh_CN';
const CLAIM_TIP = '速来领奖';

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

    try {
        switch (event.action) {
            case 'saveConsent':
                return await handleSaveConsent(event, wxContext);
            case 'adminTestSend':
                return await handleAdminTestSend(event, wxContext);
            default:
                return await handleWinnerEvent(event);
        }
    } catch (err) {
        console.error('[lotterySubscribeManager] Error:', event.action || 'winner_event', err);
        return { success: false, error: err.message || String(err) };
    }
};

async function handleSaveConsent(event, wxContext) {
    const openId = wxContext.OPENID;
    const lotteryId = normalizeLotteryId(event.lotteryId || event.id);
    const templateId = normalizeTemplateId(event.templateId);
    const status = normalizeSubscribeStatus(event.status);
    const now = Date.now();

    if (!openId) {
        return { success: false, error: '无法获取用户身份' };
    }
    if (!lotteryId) {
        return { success: false, error: '缺少抽奖ID' };
    }

    const openIdHash = hashOpenId(openId);
    const consentId = buildConsentId(lotteryId, openIdHash, templateId);
    const data = {
        _id: consentId,
        lotteryId,
        openId,
        openIdHash,
        templateId,
        templateIdHash: hashTemplateId(templateId),
        status,
        rawStatus: String(event.status || ''),
        requestErrMsg: limitText(event.requestErrMsg || event.errMsg || '', 240),
        requestedAt: Number(event.requestedAt) || now,
        updatedAt: now
    };

    const writeResult = await upsertById(CONSENT_COLLECTION, consentId, data);
    return { success: true, data: { consentId, status, writeResult } };
}

async function handleAdminTestSend(event, wxContext) {
    const openId = wxContext.OPENID;
    if (!isAdminOpenId(openId)) {
        return { success: false, error: '无权限访问', code: 'PERMISSION_DENIED' };
    }

    const lotteryId = normalizeLotteryId(event.lotteryId || '');
    const page = lotteryId ? buildDetailPage(lotteryId) : 'pages/lottery/index';
    const activityName = limitThing(event.activityName || buildActivityName(Date.now()));
    const result = await sendSubscribeMessage({
        openId,
        page,
        activityName
    });

    return { success: isSendSuccess(result), data: result };
}

async function handleWinnerEvent(event) {
    if (isDeleteEvent(event)) {
        return { success: true, handled: 0, reason: 'delete_event_skipped' };
    }

    const winnerIds = extractWinnerIds(event);
    const inlineWinners = extractInlineWinners(event);
    const winners = [];

    for (const winner of inlineWinners) {
        if (winner && winner._id) winners.push(winner);
    }

    for (const winnerId of winnerIds) {
        if (winners.some(item => item._id === winnerId)) continue;
        const winner = await getDocById(WINNER_COLLECTION, winnerId);
        if (winner) winners.push(winner);
    }

    if (winners.length === 0) {
        return {
            success: true,
            handled: 0,
            reason: 'no_winner_payload',
            eventKeys: Object.keys(event || {})
        };
    }

    const results = [];
    for (const winner of winners) {
        results.push(await notifyWinnerOnce(normalizeWinner(winner)));
    }

    return {
        success: true,
        handled: results.length,
        sent: results.filter(item => item.sent).length,
        results
    };
}

async function notifyWinnerOnce(winner) {
    if (!winner?._id || !winner.lotteryId || !winner.openIdHash) {
        return { winnerId: winner?._id || '', sent: false, reason: 'invalid_winner' };
    }

    const logId = buildSendLogId(winner._id, TEMPLATE_ID);
    const now = Date.now();
    try {
        await db.collection(SEND_LOG_COLLECTION).add({
            data: {
                _id: logId,
                winnerId: winner._id,
                lotteryId: winner.lotteryId,
                openIdHash: winner.openIdHash,
                templateId: TEMPLATE_ID,
                templateIdHash: hashTemplateId(TEMPLATE_ID),
                status: 'sending',
                createdAt: now,
                sentAt: null,
                errCode: null,
                errMsg: ''
            }
        });
    } catch (err) {
        if (isDuplicateError(err)) {
            return { winnerId: winner._id, sent: false, reason: 'already_handled' };
        }
        throw err;
    }

    try {
        const consent = await getDocById(CONSENT_COLLECTION, buildConsentId(winner.lotteryId, winner.openIdHash, TEMPLATE_ID));
        if (!isAcceptedStatus(consent?.status)) {
            await updateSendLog(logId, {
                status: 'skipped_no_consent',
                finishedAt: Date.now(),
                errCode: 43101,
                errMsg: consent ? `status=${consent.status}` : 'missing_consent'
            });
            return { winnerId: winner._id, sent: false, reason: 'no_accepted_consent' };
        }

        const participantId = buildParticipantId(winner.lotteryId, winner.openIdHash);
        const [participant, activity] = await Promise.all([
            getDocById(PARTICIPANT_COLLECTION, participantId),
            getDocById(ACTIVITY_COLLECTION, winner.lotteryId)
        ]);
        const openId = consent.openId || participant?.openId;
        if (!openId) {
            await updateSendLog(logId, {
                status: 'skipped_missing_openid',
                finishedAt: Date.now(),
                errCode: 40003,
                errMsg: 'missing_openid'
            });
            return { winnerId: winner._id, sent: false, reason: 'missing_openid' };
        }

        const sendResult = await sendSubscribeMessage({
            openId,
            page: buildDetailPage(winner.lotteryId),
            activityName: buildActivityName(activity?.openAt || winner.drawnAt || Date.now())
        });
        const sentAt = Date.now();
        const success = isSendSuccess(sendResult);
        await updateSendLog(logId, {
            status: success ? 'sent' : 'failed',
            sentAt,
            finishedAt: sentAt,
            errCode: getResultCode(sendResult),
            errMsg: limitText(getResultMessage(sendResult), 240),
            msgId: sendResult.msgId || sendResult.msgid || '',
            rawResult: sendResult
        });

        return {
            winnerId: winner._id,
            sent: success,
            errCode: getResultCode(sendResult),
            errMsg: getResultMessage(sendResult)
        };
    } catch (err) {
        await updateSendLog(logId, {
            status: 'failed',
            finishedAt: Date.now(),
            errCode: Number(err.errCode || err.errcode || -1),
            errMsg: limitText(err.errMsg || err.errmsg || err.message || String(err), 240),
            rawError: normalizeError(err)
        });
        return {
            winnerId: winner._id,
            sent: false,
            reason: 'send_failed',
            errCode: Number(err.errCode || err.errcode || -1),
            errMsg: err.errMsg || err.errmsg || err.message || String(err)
        };
    }
}

async function sendSubscribeMessage({ openId, page, activityName }) {
    return await cloud.openapi.subscribeMessage.send({
        touser: openId,
        templateId: TEMPLATE_ID,
        page,
        miniprogramState: MINIPROGRAM_STATE,
        lang: SEND_LANG,
        data: {
            thing1: {
                value: limitThing(activityName)
            },
            thing3: {
                value: CLAIM_TIP
            }
        }
    });
}

async function upsertById(collectionName, id, data) {
    const collection = db.collection(collectionName);
    const { _id, ...updateData } = data;

    try {
        await collection.add({ data });
        return { created: true, updated: 0 };
    } catch (err) {
        if (!isDuplicateError(err)) throw err;
    }

    const updateResult = await collection.doc(id).update({ data: updateData });
    const updated = getUpdatedCount(updateResult);
    if (updated === 0) {
        throw new Error(`upsert_failed_no_document_updated:${collectionName}:${id}`);
    }

    return { created: false, updated };
}

async function updateSendLog(id, data) {
    await db.collection(SEND_LOG_COLLECTION).doc(id).update({ data }).catch(err => {
        console.warn('[lotterySubscribeManager] update send log failed:', id, err.message || err);
    });
}

async function getDocById(collectionName, id) {
    if (!id) return null;
    try {
        const { data } = await db.collection(collectionName).doc(id).get();
        return data || null;
    } catch (err) {
        if (isNotFoundError(err)) return null;
        throw err;
    }
}

function extractWinnerIds(event = {}) {
    const ids = new Set();
    const candidates = [
        event.$docId,
        event.ID,
        event.DocID,
        event.docId,
        event.docID,
        event.id,
        event._id,
        event.documentId,
        event.DocumentId
    ];

    candidates.forEach(value => collectIds(value, ids));
    collectSubjectDocId(event.subject, ids);
    collectIds(event.ids, ids);
    collectIds(event.IDs, ids);
    collectIds(event.docIds, ids);
    collectIds(event.DocIds, ids);
    collectIds(event.documentIds, ids);
    collectIds(event.DocumentIds, ids);

    for (const doc of extractInlineWinners(event)) {
        if (doc && doc._id) ids.add(doc._id);
    }

    return Array.from(ids);
}

function collectSubjectDocId(subject, ids) {
    if (typeof subject !== 'string' || !subject) return;
    const parts = subject.split('.');
    const docId = parts[parts.length - 1];
    if (docId) ids.add(docId);
}

function collectIds(value, ids) {
    if (!value) return;
    if (Array.isArray(value)) {
        value.forEach(item => collectIds(item, ids));
        return;
    }
    if (typeof value === 'string' && value) {
        ids.add(value);
    }
}

function extractInlineWinners(event = {}) {
    const docs = [];
    const candidates = [
        event.doc,
        event.Doc,
        event.document,
        event.Document,
        event.data,
        event.Data,
        event.fullDocument,
        event.FullDocument,
        event.value,
        event.Value
    ];

    for (const candidate of candidates) {
        collectDocs(candidate, docs);
    }
    collectDocs(event.docs, docs);
    collectDocs(event.Docs, docs);
    collectDocs(event.records, docs);
    collectDocs(event.Records, docs);

    return docs.filter(item => item && item._id);
}

function collectDocs(value, docs) {
    if (!value) return;
    if (Array.isArray(value)) {
        value.forEach(item => collectDocs(item, docs));
        return;
    }
    if (typeof value !== 'object') return;
    if (value._id || value.lotteryId || value.openIdHash) {
        docs.push(value);
    }
    if (value.after) collectDocs(value.after, docs);
    if (value.After) collectDocs(value.After, docs);
    if (value.data) collectDocs(value.data, docs);
    if (value.Data) collectDocs(value.Data, docs);
}

function normalizeWinner(winner = {}) {
    const fallback = parseWinnerId(winner._id);
    return {
        ...winner,
        _id: winner._id || '',
        lotteryId: winner.lotteryId || fallback.lotteryId,
        openIdHash: winner.openIdHash || fallback.openIdHash,
        drawnAt: winner.drawnAt || null
    };
}

function parseWinnerId(winnerId = '') {
    const index = String(winnerId).indexOf('_');
    if (index <= 0) return { lotteryId: '', openIdHash: '' };
    return {
        lotteryId: winnerId.slice(0, index),
        openIdHash: winnerId.slice(index + 1)
    };
}

function normalizeLotteryId(value) {
    return String(value || '').trim();
}

function normalizeTemplateId(value) {
    const templateId = String(value || TEMPLATE_ID).trim();
    return templateId || TEMPLATE_ID;
}

function normalizeSubscribeStatus(value) {
    const status = String(value || '').trim();
    return status || 'unknown';
}

function isAcceptedStatus(status) {
    return ['accept', 'acceptWithAudio', 'acceptWithAlert'].includes(String(status || ''));
}

function isDeleteEvent(event = {}) {
    const type = String(
        event.eventType ||
        event.EventType ||
        event.operationType ||
        event.OperationType ||
        event.$action ||
        event.event ||
        event.Event ||
        event.type ||
        ''
    ).toLowerCase();
    return type.includes('delete') || type.includes('remove');
}

function isAdminOpenId(openId) {
    return !!openId && ADMIN_OPENIDS.has(openId);
}

function hashOpenId(openId) {
    return crypto.createHash('sha256').update(String(openId || '')).digest('hex');
}

function hashTemplateId(templateId) {
    return crypto.createHash('sha1').update(String(templateId || '')).digest('hex').slice(0, 16);
}

function buildConsentId(lotteryId, openIdHash, templateId) {
    return `${lotteryId}_${openIdHash}_${hashTemplateId(templateId)}`;
}

function buildSendLogId(winnerId, templateId) {
    return `${winnerId}_${hashTemplateId(templateId)}`;
}

function buildParticipantId(lotteryId, openIdHash) {
    return `${lotteryId}_${openIdHash}`;
}

function buildDetailPage(lotteryId) {
    return `pages/lottery/detail?id=${lotteryId}`;
}

function buildActivityName(timestamp) {
    const date = new Date(Number(timestamp || Date.now()) + 8 * 60 * 60 * 1000);
    return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日的抽奖`;
}

function limitThing(value) {
    return limitText(value || '抽奖活动', 20);
}

function limitText(value, maxLength) {
    const text = String(value || '');
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function isSendSuccess(result = {}) {
    return getResultCode(result) === 0;
}

function getResultCode(result = {}) {
    if (result.errCode !== undefined || result.errcode !== undefined) {
        return Number(result.errCode ?? result.errcode);
    }
    const message = getResultMessage(result);
    if (/:ok\b/i.test(message) || /\bok\b/i.test(message)) {
        return 0;
    }
    return -1;
}

function getResultMessage(result = {}) {
    return String(result.errMsg || result.errmsg || '');
}

function normalizeError(err) {
    return {
        errCode: err.errCode || err.errcode || -1,
        errMsg: err.errMsg || err.errmsg || err.message || String(err)
    };
}

function getUpdatedCount(result = {}) {
    if (result?.stats?.updated !== undefined) return Number(result.stats.updated);
    if (result?.updated !== undefined) return Number(result.updated);
    if (result?.modified !== undefined) return Number(result.modified);
    return null;
}

function isDuplicateError(err) {
    const message = err?.message || String(err || '');
    const code = String(err?.errCode || err?.errcode || err?.code || '');
    return /duplicate|E11000|already exist|document exists|存在|重复/i.test(`${code} ${message}`);
}

function isNotFoundError(err) {
    const message = err?.message || String(err || '');
    return /not found|does not exist|document not exists|不存在/i.test(message);
}
