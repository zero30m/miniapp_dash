const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

const ADMIN_OPENIDS = new Set([
    'omDRE1_DMI6ti1UCmc1p3qgpDhNY',
    'omDRE11i5uj9Qvi-KViQsXM4uG0E'
]);

// 懒加载初始化，避免冷启动时重复初始化
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

/**
 * 检查会员资格是否已过期
 * @param {number|string|null} memberExpiry - 有效期时间戳（毫秒）或日期字符串
 * @returns {boolean} - true 表示已过期，false 表示未过期或无限期
 */
function checkIfExpired(memberExpiry) {
    if (!memberExpiry) {
        // 没有设置有效期，视为已过期（需要续费）
        return true;
    }

    let expiryTime;
    if (typeof memberExpiry === 'number') {
        expiryTime = memberExpiry;
    } else if (typeof memberExpiry === 'string') {
        expiryTime = new Date(memberExpiry).getTime();
    } else {
        return true;
    }

    // 比较当前时间与有效期
    const now = Date.now();
    return now > expiryTime;
}

exports.main = async (event, context) => {
    // Prevent timeout
    context.callbackWaitsForEmptyEventLoop = false;

    ensureInit();

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID;
    const isFixedAdmin = ADMIN_OPENIDS.has(openid);

    // 【调试输出】打印用户身份信息，可在云函数日志中查看
    console.log('========== 用户登录调试信息 ==========');
    console.log('OpenID:', openid);
    console.log('UnionID:', unionid);
    console.log('AppID:', wxContext.APPID);
    console.log('=======================================');

    // 验证用户身份（以 OPENID 为主，UNIONID 为辅）
    if (!openid && !unionid) {
        return {
            success: false,
            error: '无法获取用户身份信息'
        };
    }

    const models = app.models;

    try {
        let userRecord = null;

        // 【性能优化】使用 $or 一次查询替代多次查询
        // 合并查询条件：OpenID 匹配 或 UnionID 匹配 或 UnionID=openid（兼容旧数据）
        const orConditions = [];
        if (openid) {
            orConditions.push({ OpenID: { $eq: openid } });
            orConditions.push({ UnionID: { $eq: openid } }); // 兼容早期写法
        }
        if (unionid) {
            orConditions.push({ UnionID: { $eq: unionid } });
        }

        if (orConditions.length > 0) {
            try {
                const { data } = await models.User.list({
                    filter: {
                        where: {
                            $or: orConditions
                        }
                    },
                    pageSize: 1,
                    pageNumber: 1
                });
                if (data && data.records && data.records.length > 0) {
                    userRecord = data.records[0];
                }
            } catch (e) {
                console.warn('Login query failed:', e);
            }
        }

        // 未找到用户：返回未注册状态（仍然返回 openid 供联机功能使用）
        if (!userRecord) {
            return {
                success: true,
                isRegistered: false,
                openid: openid,  // 【新增】返回 openid 供游戏联机功能使用
                admin: isFixedAdmin
            };
        }

        // 找到用户：更新登录统计和补全身份信息
        try {
            const updateData = {
                // 【新增】更新登录次数和时间
                loginCount: (userRecord.loginCount || 0) + 1,
                lastLoginTime: Date.now()
            };

            // 补全缺失的身份信息
            if (!userRecord.OpenID && openid) {
                updateData.OpenID = openid;
            }
            if (!userRecord.UnionID && unionid) {
                updateData.UnionID = unionid;
            }

            await models.User.update({
                data: updateData,
                filter: {
                    where: {
                        _id: { $eq: userRecord._id }
                    }
                }
            });
        } catch (e) {
            console.warn('Login user update failed:', e);
        }

        // 检查会员资格是否已过期
        const isExpired = checkIfExpired(userRecord.memberExpiry);

        console.log('========== 会员资格调试信息 ==========');
        console.log('有效期:', userRecord.memberExpiry);
        console.log('是否过期:', isExpired);
        console.log('是否管理员:', userRecord.admin === true || isFixedAdmin);
        console.log('累计登录次数:', (userRecord.loginCount || 0) + 1);
        console.log('=======================================');

        return {
            success: true,
            isRegistered: true,
            userInfo: userRecord,
            admin: userRecord.admin === true || isFixedAdmin,
            memberExpiry: userRecord.memberExpiry || null,
            isExpired: isExpired,
            openid: openid // 【新增】无论是否注册都返回 openid
        };
    } catch (err) {
        console.error('Login error:', err);
        return {
            success: false,
            error: err.message || String(err)
        };
    }
};
