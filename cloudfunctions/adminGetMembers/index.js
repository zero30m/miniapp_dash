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
 * 验证调用者是否为管理员
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
        console.error('[verifyAdmin] 错误:', e.message || e);
        return false;
    }
}

// 2029-05-01 00:00:00 中国时区对应的时间戳（永久会员判断阈值）
const PERMANENT_DATE = 1872259200000;

/**
 * 根据用户的 memberType 字段确定会员标签
 */
function getMemberTag(memberType, memberExpiry) {
    if (memberExpiry) {
        const expiryTime = typeof memberExpiry === 'number' ? memberExpiry : new Date(memberExpiry).getTime();
        if (expiryTime >= PERMANENT_DATE) return '超绝永久卡';
        if (Date.now() > expiryTime) return '已过期';
    } else {
        return '未知';
    }

    switch (memberType) {
        case 'free': return '免费用户';
        case 'week': return '周卡';
        case 'month': return '月卡';
        case 'quarter': return '季卡';
        case 'year': return '年卡';
        case 'permanent': return '超绝永久卡';
        default: return '周卡';
    }
}

/**
 * 根据会员类型返回标签代码
 */
function getTagFromMemberType(memberType, memberExpiry) {
    if (memberExpiry) {
        const expiryTime = typeof memberExpiry === 'number' ? memberExpiry : new Date(memberExpiry).getTime();
        if (expiryTime >= PERMANENT_DATE) return 'permanent';
        if (Date.now() > expiryTime) return 'expired';
    }

    switch (memberType) {
        case 'free': return 'free';
        case 'week': return 'week';
        case 'month': return 'month';
        case 'quarter': return 'quarter';
        case 'year': return 'year';
        case 'permanent': return 'permanent';
        default: return 'week';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '未知';
    const CHINA_OFFSET = 8 * 60 * 60 * 1000;
    const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    const date = new Date(ts + CHINA_OFFSET);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 【优化】使用数据库查询获取各类别计数
 * 避免加载全量数据到内存
 */
async function getStatsWithQueries(models) {
    const now = Date.now();

    // 并行执行多个计数查询
    const [totalResult, freeResult, weekResult, monthResult, yearResult, permanentResult, expiredResult] = await Promise.all([
        // 总数
        models.User.list({ filter: { where: {} }, pageSize: 1, getCount: true }),
        // 免费用户：memberType='free'
        models.User.list({
            filter: {
                where: {
                    memberType: { $eq: 'free' }
                }
            },
            pageSize: 1,
            getCount: true
        }),
        // 周卡：memberType='week' 且未过期 且非永久
        models.User.list({
            filter: {
                where: {
                    memberType: { $eq: 'week' },
                    memberExpiry: { $gt: now, $lt: PERMANENT_DATE }
                }
            },
            pageSize: 1,
            getCount: true
        }),
        // 月卡
        models.User.list({
            filter: {
                where: {
                    memberType: { $eq: 'month' },
                    memberExpiry: { $gt: now, $lt: PERMANENT_DATE }
                }
            },
            pageSize: 1,
            getCount: true
        }),
        // 年卡（包含 quarter 和 year）
        models.User.list({
            filter: {
                where: {
                    $or: [
                        { memberType: { $eq: 'quarter' } },
                        { memberType: { $eq: 'year' } }
                    ],
                    memberExpiry: { $gt: now, $lt: PERMANENT_DATE }
                }
            },
            pageSize: 1,
            getCount: true
        }),
        // 永久卡（memberExpiry >= PERMANENT_DATE 或 memberType='permanent'）
        models.User.list({
            filter: {
                where: {
                    $or: [
                        { memberExpiry: { $gte: PERMANENT_DATE } },
                        { memberType: { $eq: 'permanent' } }
                    ]
                }
            },
            pageSize: 1,
            getCount: true
        }),
        // 已过期
        models.User.list({
            filter: {
                where: {
                    memberExpiry: { $lte: now, $gt: 0 }
                }
            },
            pageSize: 1,
            getCount: true
        })
    ]);

    return {
        total: totalResult.data?.total || 0,
        free: freeResult.data?.total || 0,
        week: weekResult.data?.total || 0,
        month: monthResult.data?.total || 0,
        year: yearResult.data?.total || 0,
        permanent: permanentResult.data?.total || 0,
        expired: expiredResult.data?.total || 0
    };
}

/**
 * 构建筛选条件
 */
function buildFilterCondition(filter) {
    const now = Date.now();

    switch (filter) {
        case 'free':
            return {
                memberType: { $eq: 'free' }
            };
        case 'week':
            return {
                memberType: { $eq: 'week' },
                memberExpiry: { $gt: now, $lt: PERMANENT_DATE }
            };
        case 'month':
            return {
                memberType: { $eq: 'month' },
                memberExpiry: { $gt: now, $lt: PERMANENT_DATE }
            };
        case 'year':
            return {
                $or: [
                    { memberType: { $eq: 'quarter' } },
                    { memberType: { $eq: 'year' } }
                ],
                memberExpiry: { $gt: now, $lt: PERMANENT_DATE }
            };
        case 'permanent':
            return {
                $or: [
                    { memberExpiry: { $gte: PERMANENT_DATE } },
                    { memberType: { $eq: 'permanent' } }
                ]
            };
        case 'expired':
            return {
                memberExpiry: { $lte: now, $gt: 0 }
            };
        default:
            return {}; // 'all' - 无筛选
    }
}

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
        return { success: false, error: '无权限访问', code: 'PERMISSION_DENIED' };
    }

    const { pageNumber = 1, pageSize = 20, filter = 'all' } = event;
    const safepageSize = Math.min(pageSize, 50); // 限制单页最大50条

    try {
        // 【优化】并行获取统计数据和分页列表
        const whereCondition = buildFilterCondition(filter);

        const [stats, countResult, listResult] = await Promise.all([
            // 统计数据（首次加载或缓存过期时获取）
            pageNumber === 1 ? getStatsWithQueries(models) : Promise.resolve(null),
            // 筛选后的总数
            models.User.list({
                filter: { where: whereCondition },
                pageSize: 1,
                getCount: true
            }),
            // 分页数据
            models.User.list({
                filter: { where: whereCondition },
                pageSize: safepageSize,
                pageNumber: pageNumber,
                orderBy: [{ memberExpiry: 'desc' }] // 按有效期降序
            })
        ]);

        const filteredTotal = countResult.data?.total || 0;
        const records = listResult.data?.records || [];

        // 处理记录（只处理当前页的数据，不是全量）
        const processedRecords = records.map(item => {
            const id = item.UnionID || item.OpenID || '';
            const maskedId = id ? '****' + id.slice(-4) : '未知';

            return {
                _id: item._id,
                maskedId,
                memberExpiry: item.memberExpiry || null,
                memberExpiryFormatted: formatDate(item.memberExpiry),
                tag: getMemberTag(item.memberType, item.memberExpiry),
                tagCode: getTagFromMemberType(item.memberType, item.memberExpiry),
                admin: item.admin || false,
                memberType: item.memberType || 'week',
                loginCount: item.loginCount || 0,
                lastLoginTime: item.lastLoginTime || null
            };
        });

        return {
            success: true,
            data: {
                records: processedRecords,
                total: stats?.total || filteredTotal,
                filteredTotal,
                pageNumber,
                pageSize: safepageSize,
                hasMore: pageNumber * safepageSize < filteredTotal,
                // 统计数据（仅首页返回，减少后续请求开销）
                stats: stats ? {
                    free: stats.free,
                    week: stats.week,
                    month: stats.month,
                    year: stats.year,
                    permanent: stats.permanent,
                    expired: stats.expired
                } : undefined
            }
        };
    } catch (err) {
        console.error('[adminGetMembers] 错误:', err.message || err);
        return {
            success: false,
            error: err.message || '获取失败',
            code: 'QUERY_ERROR'
        };
    }
};
