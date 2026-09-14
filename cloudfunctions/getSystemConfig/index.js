const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

// 初始化一次，避免重复初始化
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
 * 获取系统配置
 * 用于动态控制小程序行为，如强制登录开关等
 * 
 * 数据库表: SystemConfig
 * 字段:
 *   - key: 配置键名 (string)
 *   - value: 配置值 (any)
 *   - description: 配置说明 (string)
 * 
 * 使用方法:
 * 1. 在云开发后台创建 SystemConfig 数据模型
 * 2. 添加记录: { key: "requireLogin", value: true, description: "是否强制登录" }
 * 3. 审核时将 value 改为 false，审核通过后改为 true
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    ensureInit();
    const models = app.models;

    try {
        // 尝试从数据库获取配置
        let config = {
            requireLogin: true // 默认值：需要登录
        };

        try {
            const { data } = await models.SystemConfig.list({
                filter: {
                    where: {}
                },
                select: {
                    key: true,
                    value: true
                },
                pageSize: 100,
                pageNumber: 1
            });

            const records = data.records || [];
            
            // 将数据库记录转换为配置对象
            records.forEach(item => {
                if (item.key && item.value !== undefined) {
                    let value = item.value;
                    // 【类型安全】处理可能被存储为字符串的布尔值
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    config[item.key] = value;
                }
            });

            console.log('[getSystemConfig] Config loaded from DB:', config);
        } catch (dbErr) {
            // 数据库表可能不存在，使用默认配置
            console.warn('[getSystemConfig] DB query failed, using defaults:', dbErr.message);
        }

        return {
            success: true,
            data: config
        };
    } catch (err) {
        console.error('[getSystemConfig] Error:', err);
        return {
            success: false,
            error: err.message || String(err),
            // 失败时返回默认配置，确保小程序能正常运行
            data: {
                requireLogin: true
            }
        };
    }
};


