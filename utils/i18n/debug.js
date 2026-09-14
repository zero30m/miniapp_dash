const LOCALE_DEBUG_SWITCH = 'chs';

const DEBUG_LOCALE_MAP = {
    1: null,
    '1': null,
    auto: null,
    chs: 'zh-Hans',
    zh: 'zh-Hans',
    'zh-hans': 'zh-Hans',
    cht: 'zh-Hant-TW',
    'zh-tw': 'zh-Hant-TW',
    'zh-hant': 'zh-Hant-TW',
    eng: 'en',
    en: 'en',
    ja: 'ja',
    jp: 'ja',
    ko: 'ko',
    kr: 'ko'
};

function normalizeDebugSwitch(value) {
    if (value === 1) return '1';
    return (value || '').toString().trim().toLowerCase();
}

function getDebugLocaleOverride() {
    var normalized = normalizeDebugSwitch(LOCALE_DEBUG_SWITCH);
    if (!normalized || !(normalized in DEBUG_LOCALE_MAP)) {
        return null;
    }
    return DEBUG_LOCALE_MAP[normalized];
}

module.exports = {
    LOCALE_DEBUG_SWITCH: LOCALE_DEBUG_SWITCH,
    getDebugLocaleOverride: getDebugLocaleOverride
};
