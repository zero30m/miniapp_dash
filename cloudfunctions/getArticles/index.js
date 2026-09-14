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

exports.main = async (event, context) => {
    // Prevent timeout by not waiting for empty event loop
    context.callbackWaitsForEmptyEventLoop = false;

    ensureInit();
    const models = app.models;

    try {
        const { data } = await models.HomepageArticle.list({
            filter: {
                where: {}
            },
            orderBy: [{
                sortOrder: 'asc'
            }],
            // 【优化】移除 coverImage 字段，现在只使用图床链接 imageurl
            select: {
                _id: true,
                title: true,
                titie1: true,
                imageurl: true,
                summary: true,
                tag: true,
                wechatArticleUrl: true
            },
            pageSize: 100,
            pageNumber: 1
        });

        const records = data.records || [];

        // 如果没有记录，直接返回
        if (records.length === 0) {
            return { success: true, data: [] };
        }

        // 【优化】移除云存储转换逻辑，现在只使用图床链接
        const processedRecords = records.map(item => {
            const imageUrl = (item.imageurl || '').trim();

            return {
                _id: item._id,
                title: item.title,
                titie1: item.titie1,
                coverImage: imageUrl, // 保持返回字段名兼容前端
                imageurl: imageUrl,
                summary: item.summary,
                tag: item.tag,
                wechatArticleUrl: item.wechatArticleUrl
            };
        });

        return {
            success: true,
            data: processedRecords
        };
    } catch (err) {
        console.error('getArticles error:', err);
        return {
            success: false,
            error: err.message || String(err)
        };
    }
};
