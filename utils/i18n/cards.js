const { DRINKING_CARD_COPY } = require('./cards/drinking.js');
const { KISS_CARD_COPY } = require('./cards/kiss.js');
const { CHESS_CARD_COPY } = require('./cards/chess.js');
const { DARE_CARD_COPY } = require('./cards/dare.js');
const { WE_CARD_COPY } = require('./cards/we.js');
const { TRUTH_CARD_COPY } = require('./cards/truth.js');
const { ZHEXUEJIA_CARD_COPY } = require('./cards/zhexuejia.js');
const { TAIQIU_CARD_COPY } = require('./cards/taiqiu.js');
const { COUPLE_DARE_CARD_COPY } = require('./cards/couple_dare.js');
const { COUPLE_TALK_CARD_COPY } = require('./cards/couple_talk.js');
const { COFFEE_CARD_COPY } = require('./cards/coffee.js');
const { FINGER_QUESTION_COPY } = require('./finger_questions.js');

const CARD_COPY = {
    'zh-Hans': {},
    'zh-Hant-TW': {},
    en: {},
    ja: {},
    ko: {}
};

function assignThemeCopy(theme, themeCopy) {
    Object.keys(CARD_COPY).forEach(function (locale) {
        CARD_COPY[locale][theme] = (themeCopy && themeCopy[locale]) || {};
    });
}

function mergeThemeCopies(themeCopies) {
    const merged = {
        'zh-Hans': {},
        'zh-Hant-TW': {},
        en: {},
        ja: {},
        ko: {}
    };

    themeCopies.forEach(function (themeCopy) {
        Object.keys(merged).forEach(function (locale) {
            merged[locale] = Object.assign({}, merged[locale], (themeCopy && themeCopy[locale]) || {});
        });
    });

    return merged;
}

// DIY 抓手指牌池是原始 161 道文字题中按顺序筛出的 133 道，
// 这里保留其原题索引，直接复用 finger_questions 中已有的各语言译文。
const FINGER_DIY_QUESTION_IDS = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 40,
    41, 42, 43, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 70, 71, 73,
    74, 77, 79, 80, 82, 83, 84, 86, 87, 88, 89, 91, 93, 94, 95, 96, 97, 98, 99, 100,
    101, 102, 103, 104, 107, 108, 109, 110, 111, 112, 113, 115, 117, 118, 119, 120, 121,
    122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138,
    140, 141, 142, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158,
    159, 160
];

function buildFingerDiyCardCopy() {
    const result = {
        'zh-Hans': {},
        'zh-Hant-TW': {},
        en: {},
        ja: {},
        ko: {}
    };

    Object.keys(result).forEach(function (locale) {
        const questions = FINGER_QUESTION_COPY[locale] || {};
        FINGER_DIY_QUESTION_IDS.forEach(function (questionId, index) {
            const question = questions[questionId];
            if (question && question.content) {
                result[locale][index + 1] = { description: question.content };
            }
        });
    });

    return result;
}

assignThemeCopy('drinking', DRINKING_CARD_COPY);
assignThemeCopy('kiss', KISS_CARD_COPY);
assignThemeCopy('chess', CHESS_CARD_COPY);
assignThemeCopy('dare', DARE_CARD_COPY);
assignThemeCopy('we', mergeThemeCopies([WE_CARD_COPY, TRUTH_CARD_COPY]));
assignThemeCopy('zhexuejia', ZHEXUEJIA_CARD_COPY);
assignThemeCopy('taiqiu', TAIQIU_CARD_COPY);
assignThemeCopy('couple_dare', COUPLE_DARE_CARD_COPY);
assignThemeCopy('couple_talk', COUPLE_TALK_CARD_COPY);
assignThemeCopy('coffee', COFFEE_CARD_COPY);
assignThemeCopy('finger', buildFingerDiyCardCopy());

module.exports = {
    CARD_COPY,
    FINGER_QUESTION_COPY
};
