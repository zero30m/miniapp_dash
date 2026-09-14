const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

// 懒加载初始化
let initialized = false;
let app = null;

function ensureInit() {
    if (!initialized) {
        cloud.init({
            env: cloud.DYNAMIC_CURRENT_ENV
        });
        app = cloudbase.init({
            env: cloud.DYNAMIC_CURRENT_ENV
        });
        initialized = true;
    }
}

// 免费用户有效期：2029-12-31 00:00:00 中国时区 (UTC+8)
// 计算方式：new Date('2029-12-31T00:00:00+08:00').getTime()
const FREE_USER_EXPIRY = 1893340800000;

/**
 * 免费用户注册云函数
 * 用户同意隐私协议后，无需邀请码直接注册为免费用户
 * 
 * memberType: 'free' (与永久卡 'permanent' 区分)
 * memberExpiry: 2029-12-31 00:00:00 (与永久卡相同的有效期)
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    ensureInit();

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID;
    const uid = unionid || openid;

    // 验证用户身份
    if (!openid && !unionid) {
        return {
            success: false,
            message: '无法获取用户身份信息'
        };
    }

    const models = app.models;

    try {
        // 检查用户是否已存在
        const { data: existingUser } = await models.User.list({
            filter: {
                where: {
                    $or: [
                        ...(openid ? [{ OpenID: { $eq: openid } }] : []),
                        ...(unionid ? [{ UnionID: { $eq: unionid } }] : []),
                        ...(openid ? [{ UnionID: { $eq: openid } }] : [])
                    ]
                }
            },
            pageSize: 1
        });

        if (existingUser && existingUser.records && existingUser.records.length > 0) {
            // 用户已存在，直接返回成功（已是注册用户）
            const user = existingUser.records[0];
            console.log('[registerFree] User already exists, returning existing info');
            return {
                success: true,
                message: '用户已注册',
                memberExpiry: user.memberExpiry,
                memberType: user.memberType,
                isExisting: true
            };
        }

        // 创建新的免费用户
        await models.User.create({
            data: {
                OpenID: openid || null,
                UnionID: uid,
                Phone: '',
                memberExpiry: FREE_USER_EXPIRY,
                memberType: 'free',
                loginCount: 1,
                lastLoginTime: Date.now()
            }
        });

        console.log('[registerFree] New free user created:', uid);

        return {
            success: true,
            message: '注册成功',
            memberExpiry: FREE_USER_EXPIRY,
            memberType: 'free'
        };

    } catch (err) {
        console.error('[registerFree] Error:', err);
        return {
            success: false,
            message: err.message || '注册失败，请重试'
        };
    }
};
