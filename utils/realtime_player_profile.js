const DEFAULT_AVATAR_URL = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
const PROFILE_CACHE_KEY = 'viral_profile_cache';
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

function normalizeProfile(profile) {
    const avatarUrl = profile && typeof profile.avatarUrl === 'string'
        ? profile.avatarUrl.trim()
        : '';
    const nickname = profile && typeof profile.nickname === 'string'
        ? profile.nickname.trim()
        : '';
    return {
        hasProfile: !!(avatarUrl && nickname),
        avatarUrl: avatarUrl,
        nickname: nickname
    };
}

function getStoredProfile() {
    try {
        const app = getApp();
        const globalProfile = normalizeProfile(app && app.globalData && app.globalData.viralProfile);
        if (globalProfile.hasProfile) return globalProfile;
    } catch (error) {}

    try {
        const cache = wx.getStorageSync(PROFILE_CACHE_KEY);
        if (cache && Number(cache.expireAt || 0) > Date.now()) {
            const cachedProfile = normalizeProfile(cache.data);
            if (cachedProfile.hasProfile) return cachedProfile;
        }
    } catch (error) {}

    return normalizeProfile(null);
}

function saveStoredProfile(profile) {
    const normalized = normalizeProfile(profile);
    if (!normalized.hasProfile) return normalized;

    try {
        wx.setStorageSync(PROFILE_CACHE_KEY, {
            data: normalized,
            expireAt: Date.now() + PROFILE_CACHE_TTL
        });
    } catch (error) {}

    try {
        const app = getApp();
        if (app && app.globalData) app.globalData.viralProfile = normalized;
    } catch (error) {}

    return normalized;
}

function getMemberProfile(members, openId, fallbackName) {
    const member = (members || []).find((item) => item && item.openId === openId) || {};
    const profile = normalizeProfile(member);
    return {
        nickname: profile.nickname || fallbackName || '',
        avatarUrl: profile.avatarUrl || DEFAULT_AVATAR_URL
    };
}

module.exports = {
    DEFAULT_AVATAR_URL,
    normalizeProfile,
    getStoredProfile,
    saveStoredProfile,
    getMemberProfile
};
