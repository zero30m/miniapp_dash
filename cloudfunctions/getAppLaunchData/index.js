const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

const ADMIN_OPENIDS = new Set([
    'omDRE1_DMI6ti1UCmc1p3qgpDhNY',
    'omDRE11i5uj9Qvi-KViQsXM4uG0E'
]);

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
 * 检查会员资格是否已过期
 * @param {number|string|null} memberExpiry - 有效期时间戳（毫秒）或日期字符串
 * @returns {boolean} - true 表示已过期，false 表示未过期或无限期
 */
function checkIfExpired(memberExpiry) {
    if (!memberExpiry) {
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

    return Date.now() > expiryTime;
}

/**
 * 聚合云函数：getAppLaunchData
 * 【优化】合并 login、getSystemConfig、getAppVersion 三个云函数调用
 * 一次请求返回所有 App 启动所需数据，减少冷启动时的云函数调用次数
 * 
 * 【兼容性说明】
 * - viralProfile 字段是新增字段（v2.x+），旧版本小程序会忽略此字段
 * - 新版本小程序在 viralProfile 不存在时会 fallback 到独立云函数查询
 * - 因此可以先部署此云函数，不会影响现有用户
 * 
 * @param {Object} event
 * @param {string} event.version - 当前App版本号（用于获取更新日志）
 * 
 * @returns {Object} {
 *   success: boolean,
 *   openid: string,                    // 用户 OpenID
 *   userInfo: Object | null,           // 用户信息（如已注册）
 *   isRegistered: boolean,             // 是否已注册
 *   memberExpiry: number | null,       // 会员有效期时间戳
 *   isExpired: boolean,                // 会员是否已过期
 *   admin: boolean,                    // 是否为管理员
 *   systemConfig: Object,              // 系统配置
 *   appVersion: Object | null,         // 版本更新信息
 *   viralProfile: Object | undefined   // 时空裂缝资料状态（v2.x新增，旧版本忽略）
 * }
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    ensureInit();

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const unionid = wxContext.UNIONID;
    const { version } = event;
    const isFixedAdmin = ADMIN_OPENIDS.has(openid);

    console.log('========== [getAppLaunchData] 聚合启动数据 ==========');
    console.log('[getAppLaunchData] OpenID:', openid?.substring(0, 8) + '...');
    console.log('[getAppLaunchData] 请求版本:', version);

    const result = {
        success: true,
        openid: openid,
        userInfo: null,
        isRegistered: false,
        memberExpiry: null,
        isExpired: true,
        admin: isFixedAdmin,
        systemConfig: { requireLogin: false },  // 默认值（与 app.js 保持一致）
        appVersion: null,
        // 沉寂朋友用户资料状态
        viralProfile: {
            hasProfile: false,
            avatarUrl: '',
            nickname: ''
        }
    };

    // 【调试】检查 cloudbase SDK 初始化状态
    console.log('[getAppLaunchData] 🔍 SDK初始化状态检查:');
    console.log('   - app 对象:', app ? '✅ 已创建' : '❌ 未创建');
    console.log('   - app.models:', app?.models ? '✅ 可用' : '❌ 不可用');
    if (app) {
        console.log('   - app 的属性:', Object.keys(app).join(', '));
    }

    const models = app?.models;
    if (!models) {
        console.error('[getAppLaunchData] ❌ 严重错误: models 对象不可用，数据库查询将全部失败！');
    }

    // ==================== 1. 查询用户信息（替代 login） ====================
    try {
        const orConditions = [];
        if (openid) {
            orConditions.push({ OpenID: { $eq: openid } });
            orConditions.push({ UnionID: { $eq: openid } }); // 兼容早期写法
        }
        if (unionid) {
            orConditions.push({ UnionID: { $eq: unionid } });
        }

        if (orConditions.length > 0) {
            const { data } = await models.User.list({
                filter: {
                    where: { $or: orConditions }
                },
                pageSize: 1,
                pageNumber: 1
            });

            console.log('[getAppLaunchData] 📋 User表查询结果: 找到', data?.records?.length || 0, '条记录');
            if (data?.records?.length > 0) {
                const userRecord = data.records[0];
                console.log('[getAppLaunchData] 📋 用户原始数据:', JSON.stringify({
                    _id: userRecord._id,
                    OpenID: userRecord.OpenID?.substring(0, 8) + '...',
                    memberExpiry: userRecord.memberExpiry,
                    admin: userRecord.admin,
                    memberType: userRecord.memberType
                }));
                result.isRegistered = true;
                result.userInfo = userRecord;
                result.memberExpiry = userRecord.memberExpiry || null;
                result.isExpired = checkIfExpired(userRecord.memberExpiry);
                result.admin = userRecord.admin === true || isFixedAdmin;

                console.log('[getAppLaunchData] ✅ 用户已注册');
                console.log('[getAppLaunchData] 会员状态:', result.isExpired ? '已过期' : '有效');
                console.log('[getAppLaunchData] 管理员:', result.admin);

                // 更新登录统计（异步，不影响返回）
                models.User.update({
                    data: {
                        loginCount: (userRecord.loginCount || 0) + 1,
                        lastLoginTime: Date.now()
                    },
                    filter: {
                        where: { _id: { $eq: userRecord._id } }
                    }
                }).catch(e => console.warn('[getAppLaunchData] 更新登录统计失败:', e.message));
            } else {
                console.log('[getAppLaunchData] 用户未注册');
            }
        }
    } catch (e) {
        console.warn('[getAppLaunchData] 查询用户信息失败:', e.message);
    }

    // ==================== 2. 获取系统配置（替代 getSystemConfig） ====================
    try {
        const { data: configData } = await models.SystemConfig.list({
            filter: { where: {} },
            select: { key: true, value: true },
            pageSize: 100,
            pageNumber: 1
        });

        const config = { requireLogin: false };  // 默认值（与 app.js 保持一致，避免配置加载失败时错误弹窗）
        const records = configData?.records || [];
        console.log('[getAppLaunchData] 📋 SystemConfig表查询结果: 找到', records.length, '条记录');
        console.log('[getAppLaunchData] 📋 原始配置数据:', JSON.stringify(records.map(r => ({ key: r.key, value: r.value, type: typeof r.value }))));

        records.forEach(item => {
            if (item.key && item.value !== undefined) {
                let value = item.value;
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                config[item.key] = value;
            }
        });

        result.systemConfig = config;
        console.log('[getAppLaunchData] ✅ 系统配置:', JSON.stringify(config));
    } catch (e) {
        console.warn('[getAppLaunchData] 获取系统配置失败:', e.message);
        // 使用默认值
    }

    // ==================== 3. 获取版本更新信息（替代 getAppVersion） ====================
    if (version) {
        try {
            const { data: versionData } = await models.AppVersion.list({
                filter: {
                    where: {
                        version: { $eq: version },
                        enabled: { $eq: true }
                    }
                },
                select: {
                    version: true,
                    title: true,
                    content: true,
                    releaseTime: true
                },
                pageSize: 1,
                pageNumber: 1
            });

            console.log('[getAppLaunchData] 📋 AppVersion表查询结果: 找到', versionData?.records?.length || 0, '条记录');
            const versionRecord = versionData?.records?.[0] || null;
            result.appVersion = versionRecord;

            if (versionRecord) {
                console.log('[getAppLaunchData] ✅ 版本更新:', versionRecord.title);
            } else {
                console.log('[getAppLaunchData] 无版本更新信息');
            }
        } catch (e) {
            console.warn('[getAppLaunchData] 获取版本信息失败:', e.message);
        }
    }

    // ==================== 4. 获取沉寂朋友用户资料 ====================
    if (openid) {
        try {
            const db = cloud.database();
            const viralResult = await db.collection('ViralStats')
                .where({ openId: openid })
                .field({ avatarUrl: true, nickname: true })
                .get();

            if (viralResult.data && viralResult.data.length > 0) {
                const profile = viralResult.data[0];
                if (profile.avatarUrl && profile.nickname) {
                    result.viralProfile = {
                        hasProfile: true,
                        avatarUrl: profile.avatarUrl,
                        nickname: profile.nickname
                    };
                    console.log('[getAppLaunchData] ✅ 沉寂朋友资料已存在');
                }
            }
        } catch (e) {
            console.warn('[getAppLaunchData] 获取沉寂朋友资料失败:', e.message);
        }
    }

    // ==================== 调试摘要 ====================
    console.log('');
    console.log('========== [getAppLaunchData] 数据获取摘要 ==========');
    console.log('📊 1. 用户数据:');
    console.log('   - OpenID:', result.openid ? '✅ 已获取' : '❌ 未获取');
    console.log('   - 是否已注册:', result.isRegistered ? '✅ 是' : '❌ 否');
    console.log('   - 会员有效期:', result.memberExpiry ? new Date(result.memberExpiry).toLocaleString() : '无');
    console.log('   - 会员状态:', result.isExpired ? '❌ 已过期' : '✅ 有效');
    console.log('   - 管理员:', result.admin ? '✅ 是' : '❌ 否');
    console.log('');
    console.log('📊 2. 系统配置:');
    console.log('   - requireLogin:', result.systemConfig.requireLogin);
    console.log('   - 配置项数量:', Object.keys(result.systemConfig).length);
    console.log('   - 完整配置:', JSON.stringify(result.systemConfig));
    console.log('');
    console.log('📊 3. 版本更新:');
    console.log('   - 请求版本:', version || '未传入');
    console.log('   - 更新信息:', result.appVersion ? '✅ 有 (' + result.appVersion.title + ')' : '❌ 无');
    console.log('');
    console.log('========== [getAppLaunchData] 完成 ==========');
    return result;
};
