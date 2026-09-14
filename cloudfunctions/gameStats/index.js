const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

// 懒加载初始化
let initialized = false;
let app = null;

function ensureInit() {
    if (!initialized) {
        cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
        app = cloudbase.init({ env: cloud.DYNAMIC_CURRENT_ENV });
        initialized = true;
    }
}

/**
 * 游戏统计云函数
 * 
 * @param {Object} event
 * @param {string} event.action - 'get' 获取统计 | 'record' 上报游玩
 * @param {string} event.gameType - 游戏类型（record时必填）
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    ensureInit();

    const { action = 'get', gameType, gameTypes } = event;
    const wxContext = cloud.getWXContext();
    const openId = wxContext.OPENID;

    try {
        if (action === 'get') {
            return await handleGet(openId);
        } else if (action === 'record') {
            return await handleRecord(openId, gameType);
        } else if (action === 'batchRecord') {
            // 【新增】批量上报多个游戏统计
            return await handleBatchRecord(openId, gameTypes);
        } else {
            return { success: false, error: 'Invalid action' };
        }
    } catch (err) {
        console.error('[gameStats] Error:', err);
        return { success: false, error: err.message };
    }
};

/**
 * 获取所有游戏统计数据
 */
async function handleGet(openId) {
    const models = app.models;

    // 获取全局统计
    const { data: globalData } = await models.GameStats.list({
        filter: { where: {} },
        select: { gameType: true, totalPlays: true, uniquePlayers: true, displayPlays: true },
        pageSize: 20,
        pageNumber: 1
    });

    // 转换为 { gameType: { totalPlays, uniquePlayers } } 格式
    const stats = {};
    (globalData.records || []).forEach(r => {
        stats[r.gameType] = {
            totalPlays: r.totalPlays || 0,
            uniquePlayers: r.uniquePlayers || 0,
            displayPlays: r.displayPlays || r.totalPlays || 0
        };
    });

    // 如果有openId，获取用户个人统计
    let userStats = {};
    if (openId) {
        const { data: userData } = await models.UserGameStats.list({
            filter: { where: { openId: { $eq: openId } } },
            select: { gameType: true, playCount: true },
            pageSize: 20,
            pageNumber: 1
        });

        (userData.records || []).forEach(r => {
            userStats[r.gameType] = r.playCount || 0;
        });
    }

    return {
        success: true,
        data: {
            global: stats,
            user: userStats
        }
    };
}

/**
 * 上报一次游玩记录
 * 注意：数据模型 API 不支持 _.inc() 原子操作，需要先查询再更新
 */
async function handleRecord(openId, gameType) {
    if (!gameType) {
        return { success: false, error: 'Missing gameType' };
    }

    const models = app.models;
    const now = Date.now();

    try {
        // 1. 更新用户个人统计
        let isNewUser = false;

        // 先查询是否存在该用户的记录
        const { data: existingUserStats } = await models.UserGameStats.list({
            filter: {
                where: {
                    openId: { $eq: openId },
                    gameType: { $eq: gameType }
                }
            },
            pageSize: 1,
            pageNumber: 1
        });

        if (existingUserStats.records && existingUserStats.records.length > 0) {
            // 用户记录存在，更新计数
            const record = existingUserStats.records[0];
            const newCount = (record.playCount || 0) + 1;
            await models.UserGameStats.update({
                data: {
                    playCount: newCount,
                    lastPlayed: now
                },
                filter: {
                    where: {
                        openId: { $eq: openId },
                        gameType: { $eq: gameType }
                    }
                }
            });
        } else {
            // 用户记录不存在，创建新记录
            isNewUser = true;
            await models.UserGameStats.create({
                data: {
                    openId: openId,
                    gameType: gameType,
                    playCount: 1,
                    lastPlayed: now
                }
            });
        }

        // 2. 更新全局统计
        const { data: existingGlobalStats } = await models.GameStats.list({
            filter: {
                where: { gameType: { $eq: gameType } }
            },
            pageSize: 1,
            pageNumber: 1
        });

        if (existingGlobalStats.records && existingGlobalStats.records.length > 0) {
            // 全局记录存在，更新计数
            const record = existingGlobalStats.records[0];
            // totalPlays: 真实数据 +1
            const newTotalPlays = (record.totalPlays || 0) + 1;
            // displayPlays: 展示数据 +100~150
            const inflateAmount = 100 + Math.floor(Math.random() * 51);
            const newDisplayPlays = (record.displayPlays || record.totalPlays || 0) + inflateAmount;
            const newUniquePlayers = isNewUser ? (record.uniquePlayers || 0) + 1 : record.uniquePlayers;

            await models.GameStats.update({
                data: {
                    totalPlays: newTotalPlays,
                    displayPlays: newDisplayPlays,
                    uniquePlayers: newUniquePlayers,
                    lastUpdated: now
                },
                filter: {
                    where: { gameType: { $eq: gameType } }
                }
            });
        } else {
            // 全局记录不存在，创建新记录
            await models.GameStats.create({
                data: {
                    gameType: gameType,
                    totalPlays: 1,
                    displayPlays: 100 + Math.floor(Math.random() * 51),
                    uniquePlayers: 1,
                    lastUpdated: now
                }
            });
        }

        return { success: true };
    } catch (err) {
        console.error('[gameStats] handleRecord error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 【新增】批量上报多个游戏类型的游玩记录
 * @param {string} openId - 用户 OpenID
 * @param {string[]} gameTypes - 游戏类型数组
 */
async function handleBatchRecord(openId, gameTypes) {
    if (!gameTypes || !Array.isArray(gameTypes) || gameTypes.length === 0) {
        return { success: false, error: 'Missing or invalid gameTypes array' };
    }

    // 限制单次批量上报数量，防止滥用
    const maxBatchSize = 10;
    const typesToRecord = gameTypes.slice(0, maxBatchSize);

    console.log('[gameStats] batchRecord:', typesToRecord.length, 'types');

    const results = [];
    for (const gameType of typesToRecord) {
        if (gameType && typeof gameType === 'string') {
            try {
                const result = await handleRecord(openId, gameType);
                results.push({ gameType, success: result.success });
            } catch (err) {
                results.push({ gameType, success: false, error: err.message });
            }
        }
    }

    return {
        success: true,
        recorded: results.filter(r => r.success).length,
        results
    };
}
