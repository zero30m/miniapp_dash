// 图片缓存：所有入口共享本地文件和正在进行的资源加载。
const imagePaths = new Map();
const imageTasks = new Map();
const packageTasks = new Map();

function isBundledImage(source) {
    return /^\/image-pack-(tools|fan)\//.test(source || '');
}

function loadImagePackage(name) {
    if (!packageTasks.has(name)) {
        const task = new Promise((resolve, reject) => {
            wx.loadSubpackage({ name, success: resolve, fail: reject });
        }).catch(error => {
            packageTasks.delete(name);
            throw error;
        });
        packageTasks.set(name, task);
    }
    return packageTasks.get(name);
}

// 主包通过文件系统读取资源分包，复制到本地缓存供 image、Canvas 和长按识图使用。
// 文件名包含内容摘要，替换资源后不会继续使用旧图片。
function loadBundledImage(source) {
    const fs = wx.getFileSystemManager();
    const destPath = `${wx.env.USER_DATA_PATH}/miniapp-${source.split('/').pop()}`;
    try {
        fs.accessSync(destPath);
        return Promise.resolve(destPath);
    } catch (error) {
        // 首次使用或缓存已被清理，从资源分包复制。
    }
    return loadImagePackage(source.split('/')[1]).then(() => new Promise((resolve, reject) => {
        fs.copyFile({
            srcPath: source.slice(1),
            destPath,
            success: () => resolve(destPath),
            fail: reject
        });
    }));
}

function getCachedToolImage(source) {
    if (!source || (!source.startsWith('cloud://') && !isBundledImage(source))) return source || '';

    const path = imagePaths.get(source);
    if (!path) return '';

    try {
        // 临时文件被系统清理后，下次使用时才重新下载。
        if (typeof wx.getFileSystemManager === 'function') {
            wx.getFileSystemManager().accessSync(path);
        }
        return path;
    } catch (error) {
        imagePaths.delete(source);
        return '';
    }
}

function invalidateToolImage(source, failedPath) {
    // 过期图片的失败回调不能清掉后来已下载成功的新文件。
    if (imagePaths.get(source) === failedPath) imagePaths.delete(source);
}

function loadToolImage(source) {
    const cachedPath = getCachedToolImage(source);
    if (cachedPath) return Promise.resolve(cachedPath);
    if (!source) return Promise.reject(new Error('Missing tool image source'));

    const existingTask = imageTasks.get(source);
    if (existingTask) return existingTask;

    // 在开始下载前登记 Promise，首页、热身图和 Canvas 同时加载也只有一个请求。
    const task = Promise.resolve().then(() => isBundledImage(source)
        ? loadBundledImage(source)
        : new Promise((resolve, reject) => {
        wx.cloud.downloadFile({
            fileID: source,
            success(result) {
                if (!result.tempFilePath) {
                    reject(new Error(`Tool image has no local path: ${source}`));
                    return;
                }
                resolve(result.tempFilePath);
            },
            fail: reject
        });
    })).then(path => {
        imagePaths.set(source, path);
        return path;
    }).finally(() => {
        imageTasks.delete(source);
    });

    imageTasks.set(source, task);
    return task;
}

module.exports = { getCachedToolImage, loadToolImage, invalidateToolImage, isBundledImage };
