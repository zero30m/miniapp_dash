const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

// 懒加载初始化，避免冷启动时重复初始化（与 login 云函数保持一致）
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
 * 根据邀请码天数确定会员类型
 * @param {number} days - 邀请码天数
 * @returns {string} - 会员类型 (week/month/quarter/year/permanent)
 */
function getMemberType(days) {
    if (days >= 3650) return 'permanent'; // 10年以上视为永久
    if (days >= 365) return 'year';
    if (days >= 90) return 'quarter';
    if (days >= 30) return 'month';
    return 'week'; // 小于30天为周卡
}

/**
 * 根据邀请码的天数计算会员有效期
 * @param {number} days - 邀请码对应的天数（数据库已是数字类型）
 * @returns {number} - 有效期时间戳（毫秒）
 */
function calculateValidityDate(days) {
    const d = days || 30; // 默认30天
    // 【修复】直接从当前时间加 N 天，避免时区问题
    // 之前的逻辑设置为 UTC 23:59:59，导致中国时区显示为次日 07:59:59
    const validityTime = Date.now() + d * 24 * 60 * 60 * 1000;
    return validityTime;
}

/**
 * 检查会员资格是否已过期
 * @param {number|string|null} memberExpiry - 有效期时间戳或日期字符串
 * @returns {boolean}
 */
function checkIfExpired(memberExpiry) {
    if (!memberExpiry) return true;
    let expiryTime;
    if (typeof memberExpiry === 'number') {
        expiryTime = memberExpiry;
    } else if (typeof memberExpiry === 'string') {
        expiryTime = new Date(memberExpiry).getTime();
    } else {
        return true;
    }
    return Date.now() > expiryTime;
}

exports.main = async (event, context) => {
    // 防止超时：不等待空事件循环
    context.callbackWaitsForEmptyEventLoop = false;

    ensureInit();

    const { inviteCode } = event;
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID;
    const uid = unionid || openid;

    // 验证用户身份（以 OPENID 为主，UNIONID 为辅）
    if (!openid && !unionid) {
        return {
            success: false,
            message: '无法获取用户身份信息'
        };
    }

    const models = app.models;

    if (!inviteCode) {
        return { success: false, message: '请输入邀请码' };
    }

    // 确保邀请码是字符串类型
    const codeStr = String(inviteCode).trim();
    console.log('[Register] Checking invite code:', codeStr, 'Type:', typeof codeStr, 'Length:', codeStr.length);

    try {
        // 0. 检查用户是否已存在
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

        const userExists = existingUser && existingUser.records && existingUser.records.length > 0;
        let existingUserRecord = userExists ? existingUser.records[0] : null;

        // 1. 检查邀请码是否有效且未使用
        const { data: codeData } = await models.RegistrationCode.list({
            filter: {
                where: {
                    code: { $eq: codeStr }
                }
            },
            pageSize: 1
        });

        console.log('[Register] Query result:', JSON.stringify(codeData));

        if (!codeData || !codeData.records || codeData.records.length === 0) {
            return { success: false, message: '邀请码无效' };
        }

        const codeRecord = codeData.records[0];
        console.log('[Register] Found code record:', JSON.stringify(codeRecord));

        // 检查是否已被使用（只有 used === true 才表示已使用）
        if (codeRecord.used === true) {
            return { success: false, message: '该邀请码已被使用' };
        }

        // 获取邀请码对应的天数（数据库已是数字类型）
        const days = codeRecord.shichangtian || 30;
        const validityDate = calculateValidityDate(days);

        // 根据邀请码天数确定会员类型
        const memberType = getMemberType(days);

        console.log('[Register] days:', days, 'memberType:', memberType, 'validityDate:', new Date(validityDate).toISOString());

        // 2. 标记邀请码为已使用（使用条件更新确保原子性，防止竞态条件）
        const updateResult = await models.RegistrationCode.update({
            data: {
                used: true,
                usedTime: Date.now(),
                UnionID: uid,
                OpenID: openid || null
            },
            filter: {
                where: {
                    _id: { $eq: codeRecord._id },
                    used: { $eq: false }  // 只有未使用才更新，确保原子性
                }
            }
        });

        // 检查是否成功更新（如果 affectedCount 为 0，说明邀请码已被其他人使用）
        if (!updateResult || updateResult.affectedCount === 0) {
            console.log('[Register] Race condition detected - invite code already used by another user');
            return { success: false, message: '该邀请码已被使用' };
        }

        // 3. 根据用户是否存在决定创建还是更新
        if (userExists) {
            // 用户已存在：检查是否过期，如果过期则续费
            const isExpired = checkIfExpired(existingUserRecord.memberExpiry);

            if (isExpired) {
                // 会员已过期，执行续费：更新有效期和会员类型
                await models.User.update({
                    data: {
                        memberExpiry: validityDate,
                        memberType: memberType,
                        // 同时补全可能缺失的身份信息
                        ...((!existingUserRecord.OpenID && openid) ? { OpenID: openid } : {}),
                        ...((!existingUserRecord.UnionID && unionid) ? { UnionID: unionid } : {})
                    },
                    filter: {
                        where: {
                            _id: { $eq: existingUserRecord._id }
                        }
                    }
                });

                console.log('[Register] User renewed, memberType:', memberType, 'new validity:', new Date(validityDate).toISOString());
                return { success: true, message: '续费成功', renewed: true, memberExpiry: validityDate, memberType };
            } else {
                // 会员未过期，但仍然可以使用邀请码延长有效期
                // 从当前有效期基础上延长
                const currentValidity = typeof existingUserRecord.memberExpiry === 'number'
                    ? existingUserRecord.memberExpiry
                    : new Date(existingUserRecord.memberExpiry).getTime();
                const extendedValidity = currentValidity + days * 24 * 60 * 60 * 1000;

                await models.User.update({
                    data: {
                        memberExpiry: extendedValidity,
                        memberType: memberType,
                        ...((!existingUserRecord.OpenID && openid) ? { OpenID: openid } : {}),
                        ...((!existingUserRecord.UnionID && unionid) ? { UnionID: unionid } : {})
                    },
                    filter: {
                        where: {
                            _id: { $eq: existingUserRecord._id }
                        }
                    }
                });

                console.log('[Register] User extended, memberType:', memberType, 'new validity:', new Date(extendedValidity).toISOString());
                return { success: true, message: '会员时长已延长', renewed: true, memberExpiry: extendedValidity, memberType };
            }
        } else {
            // 新用户：创建用户记录
            await models.User.create({
                data: {
                    OpenID: openid || null,
                    UnionID: uid,
                    Phone: '',
                    memberExpiry: validityDate,
                    memberType: memberType,
                    // 【新增】初始化登录统计
                    loginCount: 0,
                    lastLoginTime: null
                }
            });

            console.log('[Register] New user created with memberType:', memberType, 'validity:', new Date(validityDate).toISOString());
            return { success: true, memberExpiry: validityDate, memberType };
        }

    } catch (err) {
        console.error('Register error:', err);
        return { success: false, message: err.message || '注册失败，请重试' };
    }
};
