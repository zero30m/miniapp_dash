const { UI_COPY } = require('./ui.js');
const { CARD_COPY, FINGER_QUESTION_COPY } = require('./cards.js');
const { LOCALE_DEBUG_SWITCH, getDebugLocaleOverride } = require('./debug.js');

const SUPPORTED_LOCALES = ['zh-Hans', 'zh-Hant-TW', 'en', 'ja', 'ko'];
const DEFAULT_LOCALE = 'zh-Hans';

function normalizeWxLanguage(language) {
    var safeLanguage = typeof language === 'string' ? language : 'zh_CN';
    var lang = safeLanguage.toLowerCase();
    if (!lang) return DEFAULT_LOCALE;
    if (lang.indexOf('zh_tw') === 0 || lang.indexOf('zh-hk') === 0 || lang.indexOf('zh_mo') === 0 || lang.indexOf('zh-hant') === 0) {
        return 'zh-Hant-TW';
    }
    if (lang.indexOf('zh') === 0) return 'zh-Hans';
    if (lang.indexOf('ja') === 0) return 'ja';
    if (lang.indexOf('ko') === 0) return 'ko';
    if (lang.indexOf('en') === 0) return 'en';
    return DEFAULT_LOCALE;
}

function getAppBaseInfoSafe() {
    try {
        if (wx.getAppBaseInfo) return wx.getAppBaseInfo();
    } catch (e) {}
    return null;
}

function getLegacySystemInfoSafe() {
    try {
        if (wx.getSystemInfoSync) return wx.getSystemInfoSync();
    } catch (e) {}
    return null;
}

function resolveLocaleMeta() {
    var appBaseInfo = getAppBaseInfoSafe() || {};
    var sysInfo = getLegacySystemInfoSafe() || {};
    var language = typeof appBaseInfo.language === 'string'
        ? appBaseInfo.language
        : (typeof sysInfo.language === 'string' ? sysInfo.language : 'zh_CN');
    if (!language) {
        language = 'zh_CN';
    }
    var fontScale = appBaseInfo.fontSizeScaleFactor || sysInfo.fontSizeScaleFactor || 1;
    var locale = normalizeWxLanguage(language);
    var debugLocale = getDebugLocaleOverride();

    if (debugLocale) {
        locale = debugLocale;
        language = debugLocale;
    }

    return {
        language: language,
        locale: locale,
        fontScale: fontScale
    };
}

function getAppLocale() {
    try {
        var app = getApp();
        if (app && app.globalData && app.globalData.locale) {
            return app.globalData.locale;
        }
    } catch (e) {}
    return resolveLocaleMeta().locale;
}

function getAppFontScale() {
    try {
        var app = getApp();
        if (app && app.globalData && app.globalData.fontScale) {
            return app.globalData.fontScale;
        }
    } catch (e) {}
    return resolveLocaleMeta().fontScale;
}

function getLocalePack(locale) {
    return UI_COPY[locale] || UI_COPY[DEFAULT_LOCALE];
}

function getValueByPath(source, path) {
    if (!source || !path) return undefined;
    var parts = path.split('.');
    var cursor = source;
    for (var i = 0; i < parts.length; i++) {
        if (cursor == null) return undefined;
        cursor = cursor[parts[i]];
    }
    return cursor;
}

function t(path, locale) {
    var lang = locale || getAppLocale();
    var value = getValueByPath(getLocalePack(lang), path);
    if (value !== undefined) return value;
    return getValueByPath(getLocalePack(DEFAULT_LOCALE), path);
}

function getPageCopy(pageKey, locale) {
    return t(pageKey, locale) || {};
}

function isZhHans(locale) {
    return (locale || getAppLocale()) === 'zh-Hans';
}

function isChineseLocale(locale) {
    var lang = locale || getAppLocale();
    return lang === 'zh-Hans' || lang === 'zh-Hant-TW';
}

function shouldUseDynamicChineseOnly(locale) {
    return !isChineseLocale(locale);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function formatString(template, params) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, function (match, key) {
        return params && params[key] !== undefined ? params[key] : match;
    });
}

function getToolCardCopy(cardId, locale) {
    return t('toolCards.' + cardId, locale) || {};
}

function getLocalizedToolCards(baseCards, locale) {
    return (baseCards || []).map(function (card) {
        var override = getToolCardCopy(card.id, locale);
        return Object.assign({}, card, override);
    });
}

function getGameNames(locale) {
    return clone(t('games.gameNames', locale) || {});
}

function getGameShortNames(locale) {
    return clone(t('games.gameShortNames', locale) || {});
}

function getGameInfo(locale) {
    return clone(t('games.gameInfo', locale) || {});
}

function getBrandLabel(theme, color, locale) {
    if (theme === 'drinking') {
        return t('drinkingGame.brands.drinking.' + (color || 'grey'), locale) || '';
    }
    return t('drinkingGame.brands.' + theme, locale) || '';
}

function getCardCopy(theme, cardKey, locale) {
    var lang = locale || getAppLocale();
    return (CARD_COPY[lang] && CARD_COPY[lang][theme] && CARD_COPY[lang][theme][cardKey]) || {};
}

function getFingerQuestionCopy(questionId, locale) {
    var lang = locale || getAppLocale();
    return (FINGER_QUESTION_COPY[lang] && FINGER_QUESTION_COPY[lang][questionId]) || {};
}

function getDiySourceLabel(sourceTheme, locale) {
    return t('drinkingGame.diySources.' + sourceTheme, locale) || '';
}

function localizeCardCardinality(value, locale) {
    var copy = getPageCopy('diy', locale);
    if (value === 0) return copy.unlimited;
    return '' + value + copy.peopleSuffix;
}

function setNavigationBarTitle(path, locale) {
    var title = t(path, locale);
    if (!title || !wx.setNavigationBarTitle) return;
    try {
        wx.setNavigationBarTitle({ title: title });
    } catch (e) {}
}

module.exports = {
    SUPPORTED_LOCALES: SUPPORTED_LOCALES,
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    normalizeWxLanguage: normalizeWxLanguage,
    resolveLocaleMeta: resolveLocaleMeta,
    getAppLocale: getAppLocale,
    getAppFontScale: getAppFontScale,
    t: t,
    getPageCopy: getPageCopy,
    getLocalizedToolCards: getLocalizedToolCards,
    getGameNames: getGameNames,
    getGameShortNames: getGameShortNames,
    getGameInfo: getGameInfo,
    getBrandLabel: getBrandLabel,
    getDiySourceLabel: getDiySourceLabel,
    getCardCopy: getCardCopy,
    getFingerQuestionCopy: getFingerQuestionCopy,
    localizeCardCardinality: localizeCardCardinality,
    setNavigationBarTitle: setNavigationBarTitle,
    isZhHans: isZhHans,
    isChineseLocale: isChineseLocale,
    shouldUseDynamicChineseOnly: shouldUseDynamicChineseOnly,
    formatString: formatString,
    LOCALE_DEBUG_SWITCH: LOCALE_DEBUG_SWITCH
};
