const avatarPathCache = new Map();
const avatarLoadTasks = new Map();

function normalizeUrl(url) {
    return typeof url === 'string' ? url.trim() : '';
}

function isCloudFileUrl(url) {
    return url.indexOf('cloud://') === 0;
}

function getCloudTempUrl(fileId) {
    return new Promise((resolve, reject) => {
        if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
            reject(new Error('wx.cloud.getTempFileURL is unavailable'));
            return;
        }

        wx.cloud.getTempFileURL({
            fileList: [fileId],
            success(result) {
                const file = result && Array.isArray(result.fileList)
                    ? result.fileList[0]
                    : null;
                const tempUrl = file && typeof file.tempFileURL === 'string'
                    ? file.tempFileURL.trim()
                    : '';

                const hasStatus = file && file.status !== undefined && file.status !== null;
                if (!tempUrl || (hasStatus && Number(file.status) !== 0)) {
                    reject(new Error('failed to resolve cloud avatar URL'));
                    return;
                }
                resolve(tempUrl);
            },
            fail: reject
        });
    });
}

function getLocalImagePath(src) {
    return new Promise((resolve, reject) => {
        if (typeof wx.getImageInfo !== 'function') {
            reject(new Error('wx.getImageInfo is unavailable'));
            return;
        }

        wx.getImageInfo({
            src,
            success(result) {
                const localPath = result && typeof result.path === 'string'
                    ? result.path.trim()
                    : '';
                if (!localPath) {
                    reject(new Error('avatar image has no local path'));
                    return;
                }
                resolve(localPath);
            },
            fail: reject
        });
    });
}

function getCachedAvatarPath(url) {
    const sourceUrl = normalizeUrl(url);
    if (!sourceUrl) return '';
    return avatarPathCache.get(sourceUrl) || sourceUrl;
}

function preloadAvatar(url) {
    const sourceUrl = normalizeUrl(url);
    if (!sourceUrl) return Promise.resolve('');

    const cachedPath = avatarPathCache.get(sourceUrl);
    if (cachedPath) return Promise.resolve(cachedPath);

    const existingTask = avatarLoadTasks.get(sourceUrl);
    if (existingTask) return existingTask;

    const task = (async () => {
        try {
            const imageUrl = isCloudFileUrl(sourceUrl)
                ? await getCloudTempUrl(sourceUrl)
                : sourceUrl;
            const localPath = await getLocalImagePath(imageUrl);
            avatarPathCache.set(sourceUrl, localPath);
            return localPath;
        } catch (error) {
            // Keep failures out of the cache so a later call can retry the download.
            return sourceUrl;
        } finally {
            avatarLoadTasks.delete(sourceUrl);
        }
    })();

    avatarLoadTasks.set(sourceUrl, task);
    return task;
}

function preloadAvatars(urls) {
    const avatarUrls = Array.isArray(urls) ? urls : [];
    return Promise.all(avatarUrls.map((url) => preloadAvatar(url)));
}

module.exports = {
    getCachedAvatarPath,
    preloadAvatar,
    preloadAvatars
};
