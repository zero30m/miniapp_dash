const cloud = require('wx-server-sdk');
const cloudbase = require('@cloudbase/node-sdk');

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
 * 获取指定版本的更新日志
 * 
 * @param {Object} event - 请求参数
 * @param {string} event.version - 要查询的版本号
 * @returns {Object} - { success: boolean, data: VersionInfo | null }
 */
exports.main = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    ensureInit();

    const { version } = event;

    if (!version) {
        return { success: false, error: '缺少版本号参数' };
    }

    const models = app.models;

    try {
        // 查询指定版本且已启用的更新日志
        const { data } = await models.AppVersion.list({
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

        const record = data?.records?.[0] || null;

        return {
            success: true,
            data: record
        };
    } catch (err) {
        console.error('[getAppVersion] Error:', err);
        return {
            success: false,
            error: err.message || '查询失败',
            data: null
        };
    }
};
