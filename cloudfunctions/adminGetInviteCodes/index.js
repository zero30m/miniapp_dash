const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

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
 * 验证调用者是否为管理员（简化版，不返回调试信息）
 */
async function verifyAdmin(openid, unionid, models) {
    const orConditions = [];
    if (openid) {
        orConditions.push({ OpenID: { $eq: openid } });
        orConditions.push({ UnionID: { $eq: openid } });
    }
    if (unionid) {
        orConditions.push({ UnionID: { $eq: unionid } });
    }

    if (orConditions.length === 0) return false;

    try {
        const result = await models.User.list({
            filter: { where: { $or: orConditions } },
            pageSize: 1
        });

        if (result.data?.records?.length > 0) {
            return result.data.records[0].admin === true;
        }
        return false;
    } catch (e) {
        console.error('[verifyAdmin] Error:', e);
        return false;
    }
}

/**
 * 获取邀请码列表
 * 
 * 优化策略：
 * - filter='all': 并行获取最近10条已使用 + 最近10条未使用（首次加载速度优化）
 * - filter='used'/'unused': 只获取对应状态的记录
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    ensureInit();

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID;
    const models = app.models;

    // 验证管理员身份
    const isAdmin = await verifyAdmin(openid, unionid, models);

    if (!isAdmin) {
        return {
            success: false,
            error: '无权限访问',
            code: 'PERMISSION_DENIED'
        };
    }

    const { pageNumber = 1, pageSize = 10, filter = 'all' } = event;

    try {
        // 【优化】filter='all' 时并行获取最近的已使用和未使用邀请码
        if (filter === 'all' && pageNumber === 1) {
            const [usedResult, unusedResult] = await Promise.all([
                // 最近10条已使用
                models.RegistrationCode.list({
                    filter: { where: { used: { $eq: true } } },
                    pageSize: 10,
                    orderBy: [{ createTime: 'desc' }]
                }),
                // 最近10条未使用
                models.RegistrationCode.list({
                    filter: { where: { used: { $ne: true } } },
                    pageSize: 10,
                    orderBy: [{ createTime: 'desc' }]
                })
            ]);

            const usedRecords = (usedResult.data?.records || []).map(formatRecord);
            const unusedRecords = (unusedResult.data?.records || []).map(formatRecord);

            // 合并并按创建时间排序（最新的在前）
            const allRecords = [...usedRecords, ...unusedRecords]
                .sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

            return {
                success: true,
                data: {
                    records: allRecords,
                    total: allRecords.length,
                    usedCount: usedRecords.length,
                    unusedCount: unusedRecords.length,
                    pageNumber: 1,
                    pageSize: 20,
                    hasMore: false, // 首页快速加载模式不支持分页
                    quickLoadMode: true
                }
            };
        }

        // 普通分页模式（筛选特定状态时使用）
        let whereCondition = {};
        if (filter === 'used') {
            whereCondition.used = { $eq: true };
        } else if (filter === 'unused') {
            whereCondition.used = { $ne: true };
        }

        const [countResult, dataResult] = await Promise.all([
            models.RegistrationCode.list({
                filter: { where: whereCondition },
                pageSize: 1,
                getCount: true
            }),
            models.RegistrationCode.list({
                filter: { where: whereCondition },
                pageSize: Math.min(pageSize, 50),
                pageNumber: pageNumber,
                orderBy: [{ createTime: 'desc' }]
            })
        ]);

        const total = countResult.data?.total || 0;
        const records = (dataResult.data?.records || []).map(formatRecord);

        return {
            success: true,
            data: {
                records,
                total,
                pageNumber,
                pageSize,
                hasMore: pageNumber * pageSize < total
            }
        };
    } catch (err) {
        console.error('[adminGetInviteCodes] Error:', err);
        return {
            success: false,
            error: err.message || '获取失败',
            code: 'QUERY_ERROR'
        };
    }
};

/**
 * 格式化邀请码记录
 */
function formatRecord(item) {
    return {
        _id: item._id,
        code: item.code,
        used: item.used || false,
        usedTime: item.usedTime || null,
        shichangtian: item.shichangtian || 30,  // 数据库字段已是数字类型
        UnionID: item.UnionID ? '****' + item.UnionID.slice(-4) : null,
        createTime: item.createTime || null
    };
}
