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
    console.log('========== verifyAdmin 调试开始 ==========');
    console.log('[verifyAdmin] OpenID:', openid);
    console.log('[verifyAdmin] UnionID:', unionid);

    const orConditions = [];
    if (openid) {
        orConditions.push({ OpenID: { $eq: openid } });
        orConditions.push({ UnionID: { $eq: openid } });
    }
    if (unionid) {
        orConditions.push({ UnionID: { $eq: unionid } });
    }

    console.log('[verifyAdmin] 查询条件:', JSON.stringify(orConditions));

    if (orConditions.length === 0) {
        console.log('[verifyAdmin] 无查询条件');
        return false;
    }

    try {
        const result = await models.User.list({
            filter: { where: { $or: orConditions } },
            pageSize: 10
        });

        console.log('[verifyAdmin] 查询结果数量:', result.data?.records?.length || 0);

        if (result.data?.records?.length > 0) {
            const user = result.data.records[0];
            console.log('[verifyAdmin] 用户 admin 字段:', user.admin, '类型:', typeof user.admin);
            const isAdmin = user.admin === true;
            console.log('[verifyAdmin] 返回:', isAdmin);
            return isAdmin;
        }

        console.log('[verifyAdmin] 未找到用户');
        return false;
    } catch (e) {
        console.error('[verifyAdmin] 错误:', e.message || e);
        return false;
    }
}

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    console.log('========== adminCreateInviteCode 开始 ==========');

    ensureInit();

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID;
    const models = app.models;

    console.log('[adminCreateInviteCode] OPENID:', openid);
    console.log('[adminCreateInviteCode] UNIONID:', unionid);

    // 验证管理员身份
    const isAdmin = await verifyAdmin(openid, unionid, models);
    console.log('[adminCreateInviteCode] isAdmin:', isAdmin);

    if (!isAdmin) {
        console.log('[adminCreateInviteCode] 无权限访问');
        return { success: false, error: '无权限访问' };
    }

    const { shichangtian = 30 } = event;
    const days = parseInt(shichangtian, 10) || 30;

    console.log('[adminCreateInviteCode] 天数:', days);

    try {
        let code = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            const candidateCode = generateCode();

            const { data: existing } = await models.RegistrationCode.list({
                filter: { where: { code: { $eq: candidateCode } } },
                pageSize: 1
            });

            if (!existing?.records?.length) {
                code = candidateCode;
                break;
            }
            attempts++;
        }

        if (!code) {
            return { success: false, error: '生成邀请码失败，请重试' };
        }

        await models.RegistrationCode.create({
            data: {
                code: code,
                shichangtian: days,  // 数据库字段已是数字类型
                used: false,
                createTime: Date.now()
            }
        });

        console.log('[adminCreateInviteCode] 创建成功:', code);

        return {
            success: true,
            data: { code, shichangtian: days }
        };
    } catch (err) {
        console.error('[adminCreateInviteCode] 错误:', err.message || err);
        return { success: false, error: err.message || '创建失败' };
    }
};
