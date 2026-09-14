const cloud = require('wx-server-sdk');

let initialized = false;

function ensureInit() {
    if (!initialized) {
        cloud.init({
            env: cloud.DYNAMIC_CURRENT_ENV
        });
        initialized = true;
    }
}

/**
 * 沉寂朋友聚合云函数
 * 
 * action 参数:
 * - 'record': 记录用户B的互动（需登录）
 * - 'getStats': 获取发起者统计（需登录）
 * - 'getStatsPublic': 获取公开统计（不需登录，单页模式用）
 * - 'saveProfile': 保存用户头像和昵称
 * - 'getProfile': 获取用户头像和昵称
 * - 'getInitiatorInfo': 获取发起人信息（单页模式用）
 * - 'saveInnerChildResult': 保存内心小孩测试结果
 * - 'getInnerChildResultPublic': 公开获取内心小孩测试结果（分享页用）
 * 
 * 【已移除】分享图生成功能（改为前端 Canvas 生成）
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    ensureInit();

    const { action } = event;
    console.log('【viralManager】========== 云函数入口 ==========');
    console.log('【viralManager】action:', action);

    switch (action) {
        case 'record':
            return await recordViralHi(event, context);
        case 'getStats':
            return await getViralStats(event, context);
        case 'getStatsPublic':
            return await getViralStatsPublic(event, context);
        case 'saveProfile':
            return await saveUserProfile(event, context);
        case 'getProfile':
            return await getUserProfile(event, context);
        case 'getInitiatorInfo':
            return await getInitiatorInfo(event, context);
        case 'saveInnerChildResult':
            return await saveInnerChildResult(event, context);
        case 'getInnerChildResultPublic':
            return await getInnerChildResultPublic(event, context);
        default:
            console.log('【viralManager】✗ 未知操作:', action);
            return {
                success: false,
                error: `未知操作: ${action}`
            };
    }
};

// ==================== 用户资料相关 ====================

/**
 * 保存用户头像和昵称
 * 【简化】移除分享图生成逻辑（改为前端 Canvas 生成）
 */
async function saveUserProfile(event, context) {
    console.log('【saveUserProfile】========== 开始保存用户信息 ==========');
    
    const wxContext = cloud.getWXContext();
    const openId = wxContext.OPENID;
    const { avatarUrl, nickname } = event;

    if (!openId) {
        return { success: false, error: '无法获取用户身份' };
    }

    if (!avatarUrl || !nickname) {
        return { success: false, error: '头像和昵称不能为空' };
    }

    const db = cloud.database();

    try {
        // 检查是否已有记录
        const existing = await db.collection('ViralStats')
            .where({ openId: openId })
            .get();

        // 【优化】如果用户已有完整资料，检查是否需要更新
        if (existing.data.length > 0 && existing.data[0].avatarUrl && existing.data[0].nickname) {
            const existingProfile = existing.data[0];
            
            // 如果资料相同，直接返回，不重复更新
            if (existingProfile.avatarUrl === avatarUrl && existingProfile.nickname === nickname) {
                console.log('【saveUserProfile】✓ 资料相同，跳过更新');
                return {
                    success: true,
                    avatarUrl: existingProfile.avatarUrl,
                    nickname: existingProfile.nickname,
                    skipped: true
                };
            }
            
            console.log('【saveUserProfile】资料有变化，更新中...');
        }

        if (existing.data.length > 0) {
            // 更新现有记录
            await db.collection('ViralStats')
                .where({ openId: openId })
                .update({
                    data: {
                        avatarUrl: avatarUrl,
                        nickname: nickname,
                        profileUpdated: Date.now()
                    }
                });
            console.log('【saveUserProfile】✓ 更新用户信息成功');
        } else {
            // 创建新记录
            await db.collection('ViralStats').add({
                data: {
                    openId: openId,
                    avatarUrl: avatarUrl,
                    nickname: nickname,
                    hiCount: 0,
                    hasNew: false,
                    lastUpdated: Date.now(),
                    profileUpdated: Date.now()
                }
            });
            console.log('【saveUserProfile】✓ 创建用户信息成功');
        }

        return { 
            success: true, 
            avatarUrl: avatarUrl,
            nickname: nickname
        };

    } catch (err) {
        console.error('【saveUserProfile】✗ 异常:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * 获取用户头像和昵称
 * 【简化】移除 shareImageFileId（分享图改为前端生成）
 */
async function getUserProfile(event, context) {
    const wxContext = cloud.getWXContext();
    const openId = wxContext.OPENID;

    if (!openId) {
        return { success: false, error: '无法获取用户身份' };
    }

    const db = cloud.database();

    try {
        const result = await db.collection('ViralStats')
            .where({ openId: openId })
            .field({ avatarUrl: true, nickname: true })
            .get();

        if (result.data.length > 0 && result.data[0].avatarUrl && result.data[0].nickname) {
            return {
                success: true,
                hasProfile: true,
                avatarUrl: result.data[0].avatarUrl,
                nickname: result.data[0].nickname
            };
        }

        return {
            success: true,
            hasProfile: false
        };

    } catch (err) {
        console.error('【getUserProfile】✗ 异常:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * 获取发起人信息（单页模式可用）
 */
async function getInitiatorInfo(event, context) {
    const { initiatorOpenId } = event;

    if (!initiatorOpenId) {
        return { success: false, error: '缺少发起者ID' };
    }

    const db = cloud.database();

    try {
        const result = await db.collection('ViralStats')
            .where({ openId: initiatorOpenId })
            .field({ avatarUrl: true, nickname: true })
            .get();

        if (result.data.length > 0) {
            return {
                success: true,
                avatarUrl: result.data[0].avatarUrl || '',
                nickname: result.data[0].nickname || ''
            };
        }

        return {
            success: true,
            avatarUrl: '',
            nickname: ''
        };

    } catch (err) {
        console.error('【getInitiatorInfo】✗ 异常:', err);
        return { success: false, error: err.message || String(err) };
    }
}

// ==================== 内心小孩测试结果 ====================

const INNER_CHILD_CODES = ['BT', 'DS', 'KF', 'BZ', 'TG', 'AM', 'YJ', 'MW', 'YZ', 'RJ', 'RW', 'TH', 'WM', 'ZS'];

/**
 * 保存当前用户的内心小孩测试结果
 */
async function saveInnerChildResult(event, context) {
    const wxContext = cloud.getWXContext();
    const openId = wxContext.OPENID;
    const { resultCode, resultTitle, scores, answers, avatarUrl, nickname } = event;

    if (!openId) {
        return { success: false, error: '无法获取用户身份' };
    }

    if (!INNER_CHILD_CODES.includes(resultCode)) {
        return { success: false, error: '测试结果无效' };
    }

    const db = cloud.database();
    const now = Date.now();
    const innerChildResult = {
        code: resultCode,
        title: resultTitle || '',
        scores: scores || {},
        answers: Array.isArray(answers) ? answers : [],
        updatedAt: now
    };

    try {
        const existing = await db.collection('ViralStats')
            .where({ openId: openId })
            .get();

        if (existing.data.length > 0) {
            const updateData = {
                innerChildResult,
                innerChildUpdatedAt: now,
                lastUpdated: now
            };
            if (avatarUrl) updateData.avatarUrl = avatarUrl;
            if (nickname) updateData.nickname = nickname;

            await db.collection('ViralStats')
                .where({ openId: openId })
                .update({
                    data: updateData
                });
        } else {
            await db.collection('ViralStats').add({
                data: {
                    openId: openId,
                    avatarUrl: avatarUrl || '',
                    nickname: nickname || '',
                    hiCount: 0,
                    hasNew: false,
                    innerChildResult,
                    innerChildUpdatedAt: now,
                    lastUpdated: now
                }
            });
        }

        return {
            success: true,
            resultCode,
            resultTitle: resultTitle || ''
        };
    } catch (err) {
        console.error('【saveInnerChildResult】✗ 异常:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * 分享页公开读取某个用户的内心小孩结果
 */
async function getInnerChildResultPublic(event, context) {
    const { initiatorOpenId } = event;

    if (!initiatorOpenId) {
        return { success: false, error: '缺少发起者ID' };
    }

    const db = cloud.database();

    try {
        const result = await db.collection('ViralStats')
            .where({ openId: initiatorOpenId })
            .field({
                avatarUrl: true,
                nickname: true,
                innerChildResult: true
            })
            .get();

        if (!result.data.length || !result.data[0].innerChildResult) {
            return {
                success: true,
                hasResult: false
            };
        }

        const record = result.data[0];
        const childResult = record.innerChildResult || {};

        if (!INNER_CHILD_CODES.includes(childResult.code)) {
            return {
                success: true,
                hasResult: false
            };
        }

        return {
            success: true,
            hasResult: true,
            avatarUrl: record.avatarUrl || '',
            nickname: record.nickname || 'TA',
            resultCode: childResult.code,
            resultTitle: childResult.title || '',
            updatedAt: childResult.updatedAt || null
        };
    } catch (err) {
        console.error('【getInnerChildResultPublic】✗ 异常:', err);
        return { success: false, error: err.message || String(err) };
    }
}

// ==================== 互动记录相关 ====================

/**
 * 记录用户B对用户A的时空裂缝互动
 */
async function recordViralHi(event, context) {
    console.log('【recordViralHi】========== 开始处理互动记录 ==========');

    const wxContext = cloud.getWXContext();
    const visitorOpenId = wxContext.OPENID;
    const { initiatorOpenId, source, visitorAvatarUrl, visitorNickname } = event;

    console.log('【recordViralHi】访客OpenID:', visitorOpenId || '【空】');
    console.log('【recordViralHi】发起者OpenID:', initiatorOpenId || '【空】');

    // 参数校验
    if (!initiatorOpenId) {
        return { success: false, error: '缺少发起者ID' };
    }

    if (!visitorOpenId) {
        return { success: false, error: '无法获取用户身份' };
    }

    if (visitorOpenId === initiatorOpenId) {
        return { success: false, error: '不能给自己发送信号' };
    }

    if (!visitorAvatarUrl || !visitorNickname) {
        return { success: false, error: '请先完善头像和昵称' };
    }

    const db = cloud.database();
    const _ = db.command;

    try {
        // 防重复
        const existing = await db.collection('ViralFriendship')
            .where({
                initiatorOpenId: initiatorOpenId,
                visitorOpenId: visitorOpenId
            })
            .count();

        if (existing.total > 0) {
            return {
                success: false,
                error: '你已经发送过信号了',
                alreadySent: true
            };
        }

        // 记录互动（包含访客头像和昵称）
        await db.collection('ViralFriendship').add({
            data: {
                initiatorOpenId: initiatorOpenId,
                visitorOpenId: visitorOpenId,
                visitorAvatarUrl: visitorAvatarUrl,
                visitorNickname: visitorNickname,
                source: source || 'unknown',
                createTime: Date.now()
            }
        });
        console.log('【recordViralHi】✓ ViralFriendship 写入成功');

        // 更新统计缓存
        const statsResult = await db.collection('ViralStats')
            .where({ openId: initiatorOpenId })
            .get();

        if (statsResult.data.length > 0) {
            await db.collection('ViralStats')
                .where({ openId: initiatorOpenId })
                .update({
                    data: {
                        hiCount: _.inc(1),
                        lastUpdated: Date.now(),
                        hasNew: true
                    }
                });
        } else {
            await db.collection('ViralStats').add({
                data: {
                    openId: initiatorOpenId,
                    hiCount: 1,
                    lastUpdated: Date.now(),
                    hasNew: true
                }
            });
        }

        // 同时保存访客的个人资料（如果没有的话）
        const visitorStats = await db.collection('ViralStats')
            .where({ openId: visitorOpenId })
            .get();

        if (visitorStats.data.length === 0) {
            await db.collection('ViralStats').add({
                data: {
                    openId: visitorOpenId,
                    avatarUrl: visitorAvatarUrl,
                    nickname: visitorNickname,
                    hiCount: 0,
                    hasNew: false,
                    lastUpdated: Date.now(),
                    profileUpdated: Date.now()
                }
            });
        } else if (!visitorStats.data[0].avatarUrl) {
            // 如果访客还没有头像，更新
            await db.collection('ViralStats')
                .where({ openId: visitorOpenId })
                .update({
                    data: {
                        avatarUrl: visitorAvatarUrl,
                        nickname: visitorNickname,
                        profileUpdated: Date.now()
                    }
                });
        }

        return { success: true, message: '信号已送达' };

    } catch (err) {
        console.error('【recordViralHi】✗ 异常:', err);
        return { success: false, error: err.message || String(err) };
    }
}

// ==================== 统计查询相关 ====================

/**
 * 获取发起者的时空裂缝统计数据（需要登录）
 */
async function getViralStats(event, context) {
    const wxContext = cloud.getWXContext();
    const openId = wxContext.OPENID;
    const { clearNew, pageNum = 1, pageSize = 50 } = event;

    if (!openId) {
        return { success: false, error: '无法获取用户身份' };
    }

    const db = cloud.database();

    try {
        // 获取统计缓存和用户资料
        const statsResult = await db.collection('ViralStats')
            .where({ openId: openId })
            .get();

        let stats = {
            hiCount: 0,
            hasNew: false,
            lastUpdated: null,
            avatarUrl: '',
            nickname: ''
        };

        if (statsResult.data.length > 0) {
            stats = statsResult.data[0];

            if (clearNew && stats.hasNew) {
                await db.collection('ViralStats')
                    .where({ openId: openId })
                    .update({
                        data: { hasNew: false }
                    });
                stats.hasNew = false;
            }
        }

        // 获取助力用户列表（包含头像和昵称）
        const skip = (pageNum - 1) * pageSize;
        const recordsResult = await db.collection('ViralFriendship')
            .where({ initiatorOpenId: openId })
            .orderBy('createTime', 'desc')
            .skip(skip)
            .limit(pageSize)
            .get();

        // 构建助力用户列表
        const supporters = recordsResult.data.map(record => ({
            id: record._id,
            visitorId: record.visitorOpenId,
            avatarUrl: record.visitorAvatarUrl || '',
            nickname: record.visitorNickname || '匿名用户',
            source: record.source,
            createTime: record.createTime
        }));

        return {
            success: true,
            hiCount: stats.hiCount || 0,
            hasNew: stats.hasNew || false,
            lastUpdated: stats.lastUpdated,
            hasProfile: !!(stats.avatarUrl && stats.nickname),
            avatarUrl: stats.avatarUrl || '',
            nickname: stats.nickname || '',
            supporters: supporters,
            total: stats.hiCount || recordsResult.data.length
        };

    } catch (err) {
        console.error('getViralStats error:', err);
        return { success: false, error: err.message || String(err) };
    }
}

/**
 * 获取公开的时空裂缝统计（单页模式可用，无需登录）
 */
async function getViralStatsPublic(event, context) {
    const { initiatorOpenId } = event;

    if (!initiatorOpenId) {
        return { success: false, error: '缺少发起者ID' };
    }

    const db = cloud.database();

    try {
        const statsResult = await db.collection('ViralStats')
            .where({ openId: initiatorOpenId })
            .field({ hiCount: true, avatarUrl: true, nickname: true })
            .get();

        let hasInteractions = false;
        let initiatorInfo = { avatarUrl: '', nickname: '' };

        if (statsResult.data.length > 0) {
            if (statsResult.data[0].hiCount > 0) {
                hasInteractions = true;
            }
            initiatorInfo.avatarUrl = statsResult.data[0].avatarUrl || '';
            initiatorInfo.nickname = statsResult.data[0].nickname || '';
        }

        return {
            success: true,
            hasInteractions: hasInteractions,
            initiatorAvatarUrl: initiatorInfo.avatarUrl,
            initiatorNickname: initiatorInfo.nickname
        };

    } catch (err) {
        console.error('getViralStatsPublic error:', err);
        return { success: false, error: err.message || String(err) };
    }
}
