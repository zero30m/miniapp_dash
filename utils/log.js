/**
 * 实时日志工具 - 用于将错误日志上报到 We分析 后台
 * 
 * 使用说明：
 * 1. 只有 error() 和 warn() 会上报到实时日志后台（节省配额）
 * 2. info() 和 debug() 只在控制台打印，不上报
 * 3. 使用 setFilterMsg/addFilterMsg 添加标签便于搜索
 * 
 * 示例：
 * const log = require('./log.js');
 * log.error('recovery', '后台恢复失败', { page: 'games', reason: 'displayCards empty' });
 * log.addFilterMsg('games-recovery');
 */

// 获取实时日志管理器
const realtimeLogger = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null;

/**
 * 格式化日志参数，将对象转为字符串
 */
function formatArgs(args) {
    return Array.from(args).map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return arg;
    });
}

/**
 * 获取当前页面路径（用于日志标签）
 */
function getCurrentPageRoute() {
    try {
        const pages = getCurrentPages();
        if (pages.length > 0) {
            return pages[pages.length - 1].route || 'unknown';
        }
    } catch (e) { }
    return 'unknown';
}

module.exports = {
    /**
     * 调试日志 - 仅控制台输出，不上报
     */
    debug() {
        console.debug.apply(console, arguments);
        // 不上报到实时日志，节省配额
    },

    /**
     * 信息日志 - 仅控制台输出，不上报
     */
    info() {
        console.log.apply(console, arguments);
        // 不上报到实时日志，节省配额
    },

    /**
     * 警告日志 - 控制台输出 + 上报
     */
    warn() {
        console.warn.apply(console, arguments);
        if (realtimeLogger) {
            try {
                realtimeLogger.warn.apply(realtimeLogger, formatArgs(arguments));
            } catch (e) { }
        }
    },

    /**
     * 错误日志 - 控制台输出 + 上报（最重要）
     */
    error() {
        console.error.apply(console, arguments);
        if (realtimeLogger) {
            try {
                realtimeLogger.error.apply(realtimeLogger, formatArgs(arguments));
            } catch (e) { }
        }
    },

    /**
     * 设置过滤关键字（会覆盖之前的）
     * @param {string} msg - 过滤关键字
     */
    setFilterMsg(msg) {
        if (!realtimeLogger || !realtimeLogger.setFilterMsg) return;
        if (typeof msg !== 'string') return;
        realtimeLogger.setFilterMsg(msg);
    },

    /**
     * 添加过滤关键字（可多次调用）
     * @param {string} msg - 过滤关键字（不能含空格）
     */
    addFilterMsg(msg) {
        if (!realtimeLogger || !realtimeLogger.addFilterMsg) return;
        if (typeof msg !== 'string') return;
        realtimeLogger.addFilterMsg(msg);
    },

    /**
     * 上报页面级别的错误（带页面路径标签）
     * @param {string} category - 错误类别（如 'recovery', 'init', 'network'）
     * @param {string} message - 错误信息
     * @param {object} data - 附加数据
     */
    reportError(category, message, data = {}) {
        const route = getCurrentPageRoute();
        const errorInfo = {
            category,
            message,
            route,
            timestamp: Date.now(),
            ...data
        };

        console.error(`[${category}]`, message, errorInfo);

        if (realtimeLogger) {
            try {
                // 添加过滤标签便于搜索
                realtimeLogger.addFilterMsg(category);
                realtimeLogger.addFilterMsg(route.replace(/\//g, '-'));
                realtimeLogger.error(`[${category}] ${message}`, JSON.stringify(errorInfo));
            } catch (e) { }
        }
    },

    /**
     * 上报后台恢复失败
     */
    reportRecoveryFailure(page, reason, extraData = {}) {
        this.reportError('recovery-failure', `页面恢复失败: ${page}`, {
            page,
            reason,
            ...extraData
        });
    },

    /**
     * 上报组件初始化失败
     */
    reportInitFailure(component, reason, extraData = {}) {
        this.reportError('init-failure', `组件初始化失败: ${component}`, {
            component,
            reason,
            ...extraData
        });
    },

    /**
     * 上报网络请求失败
     */
    reportNetworkError(api, error, extraData = {}) {
        this.reportError('network-error', `网络请求失败: ${api}`, {
            api,
            error: String(error),
            ...extraData
        });
    },

    /**
     * 上报页面/组件生命周期错误
     * @param {string} lifecycle - 生命周期方法名（如 'onLoad', 'onShow', 'attached'）
     * @param {string} pageName - 页面或组件名称
     * @param {Error|string} error - 错误对象或信息
     * @param {object} extraData - 附加数据
     */
    reportLifecycleError(lifecycle, pageName, error, extraData = {}) {
        this.reportError('lifecycle-error', `${pageName}.${lifecycle} 错误`, {
            lifecycle,
            pageName,
            error: error?.message || String(error),
            stack: error?.stack || '',
            ...extraData
        });
    },

    // ==================== 调试功能 ====================

    /**
     * 检查实时日志是否可用
     * @returns {boolean}
     */
    isAvailable() {
        return !!realtimeLogger;
    },

    /**
     * 发送测试日志（用于验证上报是否成功）
     * 在体验版/正式版真机上调用后，可在 We分析 后台查看
     * @param {boolean} showToast - 是否显示提示
     */
    test(showToast = true) {
        const timestamp = new Date().toLocaleString('zh-CN');
        const testData = {
            testTime: timestamp,
            route: getCurrentPageRoute(),
            available: this.isAvailable(),
            systemInfo: wx.getSystemInfoSync ? wx.getSystemInfoSync().model : 'unknown'
        };

        console.log('[Log] 测试日志发送', testData);

        if (realtimeLogger) {
            try {
                realtimeLogger.addFilterMsg('log-test');
                realtimeLogger.info('实时日志测试 - info', JSON.stringify(testData));
                realtimeLogger.warn('实时日志测试 - warn', JSON.stringify(testData));
                realtimeLogger.error('实时日志测试 - error', JSON.stringify(testData));

                if (showToast) {
                    wx.showToast({
                        title: '日志已发送',
                        icon: 'success',
                        duration: 2000
                    });
                }
                console.log('[Log] ✅ 测试日志已发送到 We分析');
            } catch (e) {
                console.error('[Log] ❌ 发送测试日志失败:', e);
                if (showToast) {
                    wx.showToast({
                        title: '发送失败',
                        icon: 'error'
                    });
                }
            }
        } else {
            console.warn('[Log] ⚠️ 实时日志不可用（可能在开发工具中）');
            if (showToast) {
                wx.showToast({
                    title: '日志不可用',
                    icon: 'none',
                    duration: 2000
                });
            }
        }

        return testData;
    },

    /**
     * 在页面 onLoad 时自动发送测试日志（开发调试用）
     * 正式发布时可关闭
     */
    testOnPageLoad(pageName) {
        console.log(`[Log] 页面加载: ${pageName}`);
        // 仅在体验版自动发送测试日志，正式版不发送
        const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : {};
        const envVersion = accountInfo.miniProgram?.envVersion || 'release';

        if (envVersion === 'trial') {
            // 体验版自动发送，不显示 toast
            this.test(false);
            console.log('[Log] 体验版自动发送测试日志');
        }
    }
};
