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

exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    console.log('========== adminDeleteInviteCode 开始 ==========');

    ensureInit();

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID;
    const models = app.models;

    console.log('[adminDeleteInviteCode] OPENID:', openid);
    console.log('[adminDeleteInviteCode] UNIONID:', unionid);

    // 验证管理员身份
    const isAdmin = await verifyAdmin(openid, unionid, models);
    console.log('[adminDeleteInviteCode] isAdmin:', isAdmin);

    if (!isAdmin) {
        console.log('[adminDeleteInviteCode] 无权限访问');
        return { success: false, error: '无权限访问' };
    }

    const { codeId } = event;
    if (!codeId) {
        return { success: false, error: '缺少邀请码ID' };
    }

    console.log('[adminDeleteInviteCode] codeId:', codeId);

    try {
        const { data: codeData } = await models.RegistrationCode.list({
            filter: { where: { _id: { $eq: codeId } } },
            pageSize: 1
        });

        if (!codeData?.records?.length) {
            return { success: false, error: '邀请码不存在' };
        }

        const codeRecord = codeData.records[0];
        if (codeRecord.used === true) {
            return { success: false, error: '已使用的邀请码不能删除' };
        }

        await models.RegistrationCode.delete({
            filter: { where: { _id: { $eq: codeId } } }
        });

        console.log('[adminDeleteInviteCode] 删除成功:', codeId);

        return { success: true };
    } catch (err) {
        console.error('[adminDeleteInviteCode] 错误:', err.message || err);
        return { success: false, error: err.message || '删除失败' };
    }
};
