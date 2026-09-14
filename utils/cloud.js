/**
 * 云函数调用工具模块
 * 提供统一的超时处理、重试机制和错误处理
 */

const { CLOUD_FUNCTION_CONFIG, CACHE_CONFIG } = require('./config');

// 从配置文件读取常量
const CLOUD_FUNCTION_TIMEOUT = CLOUD_FUNCTION_CONFIG.TIMEOUT;
const WARMUP_TIMEOUT = CLOUD_FUNCTION_CONFIG.WARMUP_TIMEOUT;
const MAX_RETRY_COUNT = CLOUD_FUNCTION_CONFIG.MAX_RETRY;
const RETRY_DELAY = CLOUD_FUNCTION_CONFIG.RETRY_DELAY;
const LOGIN_CACHE_TTL = CACHE_CONFIG.LOGIN_TTL;

/**
 * 带超时的 Promise 包装器
 * @param {Promise} promise - 要包装的 Promise
 * @param {number} ms - 超时时间（毫秒）
 * @param {string} errorMessage - 超时错误信息
 * @returns {Promise}
 */
function withTimeout(promise, ms, errorMessage = '请求超时') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);
    });
    
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * 延迟函数
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的云函数调用
 * @param {string} name - 云函数名称
 * @param {object} data - 调用参数
 * @param {object} options - 配置选项
 * @param {number} options.maxRetries - 最大重试次数
 * @param {number} options.timeout - 超时时间
 * @param {boolean} options.silent - 是否静默失败（不打印错误日志）
 * @returns {Promise}
 */
async function callCloudFunction(name, data = {}, options = {}) {
    const {
        maxRetries = MAX_RETRY_COUNT,
        timeout = CLOUD_FUNCTION_TIMEOUT,
        silent = false
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                if (!silent) {
                    console.log(`[CloudUtil] Retrying ${name} (attempt ${attempt + 1}/${maxRetries + 1})...`);
                }
                // 递增延迟：第1次重试 800ms，第2次 1600ms...
                await delay(RETRY_DELAY * attempt);
            }
            
            const result = await withTimeout(
                wx.cloud.callFunction({ name, data }),
                timeout,
                `${name} 请求超时`
            );
            
            return result;
        } catch (err) {
            lastError = err;
            if (!silent) {
                console.warn(`[CloudUtil] ${name} attempt ${attempt + 1} failed:`, err.message || err);
            }
            
            // 如果是最后一次尝试，不再重试
            if (attempt === maxRetries) {
                throw lastError;
            }
        }
    }
    
    throw lastError;
}

/**
 * 创建云函数调用管理器
 * 用于管理单个云函数的调用状态，支持请求复用和取消
 */
class CloudFunctionManager {
    constructor(name, options = {}) {
        this.name = name;
        this.defaultOptions = options;
        this.pendingPromise = null;
        this.pendingMode = null; // 'warmup' | 'normal'
        this.cache = null;
        this.cacheTimestamp = 0;
        this.cacheTTL = options.cacheTTL || 0;
    }
    
    /**
     * 检查缓存是否有效
     */
    isCacheFresh() {
        if (!this.cacheTTL) return false;
        return this.cache && (Date.now() - this.cacheTimestamp) < this.cacheTTL;
    }
    
    /**
     * 清除缓存和待处理请求
     */
    clear() {
        this.cache = null;
        this.cacheTimestamp = 0;
        this.pendingPromise = null;
        this.pendingMode = null;
    }
    
    /**
     * 调用云函数（支持缓存和请求复用）
     * @param {object} data - 调用参数
     * @param {object} options - 配置选项
     * @param {boolean} options.warmup - 是否为预热调用
     * @param {boolean} options.force - 是否强制刷新（忽略缓存和pending）
     * @param {boolean} options.useCache - 是否使用缓存（默认 true）
     */
    async call(data = {}, options = {}) {
        const {
            warmup = false,
            force = false,
            useCache = true,
            ...callOptions
        } = options;
        
        // 如果有有效缓存且非强制刷新，直接返回缓存
        if (!force && useCache && this.isCacheFresh()) {
            console.log(`[CloudUtil] ${this.name} using cache`);
            return this.cache;
        }
        
        // 【优化】如果是 force 模式，清除当前的 pending 请求
        if (force && this.pendingPromise) {
            console.log(`[CloudUtil] ${this.name} force mode, clearing pending request`);
            this.pendingPromise = null;
            this.pendingMode = null;
        }
        
        // 如果已有请求在进行中，复用该请求
        if (this.pendingPromise) {
            console.log(`[CloudUtil] ${this.name} reusing pending request (mode: ${this.pendingMode})`);
            
            // 【优化】如果当前是 warmup 模式但用户需要 normal 结果
            // 不再简单复用，而是取消 warmup 并发起新请求
            if (!warmup && this.pendingMode === 'warmup') {
                console.log(`[CloudUtil] ${this.name} upgrading from warmup, starting new request`);
                // 不等待 warmup 完成，直接发起新请求
                this.pendingPromise = null;
                this.pendingMode = null;
            } else {
                return this.pendingPromise;
            }
        }
        
        // 发起新请求
        const mergedOptions = {
            ...this.defaultOptions,
            ...callOptions,
            timeout: warmup ? WARMUP_TIMEOUT : (callOptions.timeout || this.defaultOptions.timeout || CLOUD_FUNCTION_TIMEOUT),
            maxRetries: warmup ? 0 : (callOptions.maxRetries ?? this.defaultOptions.maxRetries ?? MAX_RETRY_COUNT),
            silent: warmup
        };
        
        console.log(`[CloudUtil] ${this.name} starting ${warmup ? 'warmup' : 'normal'} request`);
        
        const requestPromise = callCloudFunction(this.name, data, mergedOptions)
            .then(res => {
                // 提取结果
                const result = res?.result;
                // 只缓存成功的结果
                if (result && result.success && this.cacheTTL) {
                    this.cache = result;
                    this.cacheTimestamp = Date.now();
                    console.log(`[CloudUtil] ${this.name} result cached`);
                }
                return result;
            })
            .catch(err => {
                // warmup 模式下静默失败
                if (this.pendingMode === 'warmup') {
                    console.warn(`[CloudUtil] ${this.name} warmup failed (silent):`, err.message);
                    return null;
                }
                throw err;
            })
            .finally(() => {
                // 只有当前 promise 才清理状态
                if (this.pendingPromise === requestPromise) {
                    this.pendingPromise = null;
                    this.pendingMode = null;
                }
            });
        
        this.pendingPromise = requestPromise;
        this.pendingMode = warmup ? 'warmup' : 'normal';
        
        return requestPromise;
    }
    
    /**
     * 预热调用（静默失败，不阻塞用户操作）
     */
    warmup(data = {}) {
        if (this.isCacheFresh() || this.pendingPromise) {
            return;
        }
        this.call(data, { warmup: true }).catch(() => {});
    }
}

module.exports = {
    CLOUD_FUNCTION_TIMEOUT,
    WARMUP_TIMEOUT,
    MAX_RETRY_COUNT,
    RETRY_DELAY,
    LOGIN_CACHE_TTL,
    withTimeout,
    delay,
    callCloudFunction,
    CloudFunctionManager
};

