/**
 * DIY 卡牌索引 - 为全部卡牌池打标签
 * 不含台球之奕、二本吻痕、哲学家酒牌
 *
 * 四维标签设计原则（极值下正相关）：
 *   酒精浓度 → 得吃大逃杀、喝酒之弈
 *   刺激程度 → 社死模拟器、情侣心动挑战
 *   沟通深度 → 不是陌生人、情侣暖甜交流、COFFEE CHAT
 *   暧昧程度 → 得吃大逃杀大尺度牌(red/black)、情侣心动挑战
 */
const { CARDS } = require('./cards.js');
const { CARDS_CHESS } = require('./cards3.js');
const { CARDS_DARE } = require('./cards4.js');
const { CARDS_TRUTH } = require('./cards5.js');
const { CARDS_WE } = require('./cards_we.js');
const { CARDS_COUPLE_DARE } = require('./cards_couple_dare.js');
const { CARDS_COUPLE_TALK } = require('./cards_couple_talk.js');
const { CARDS_COFFEE } = require('./cards_coffee.js');
const { CARDS_FINGER } = require('./cards_finger.js');

// 来源主题映射（名称 + 颜色 + 文字颜色）
const SOURCE_THEMES = {
    drinking: { name: '得吃大逃杀', color: '#FF5252', textColor: '#FFF' },
    chess: { name: '喝酒之弈', color: '#FFD740', textColor: '#000' },
    dare: { name: '社死模拟器', color: '#18FFFF', textColor: '#000' },
    we: { name: '不是陌生人', color: '#43A047', textColor: '#FFF' },
    couple_dare: { name: '情侣心动挑战', color: '#E91E63', textColor: '#FFF' },
    couple_talk: { name: '情侣暖甜交流', color: '#FFAB91', textColor: '#000' },
    coffee: { name: 'COFFEE CHAT', color: '#8D6E63', textColor: '#FFF' },
    finger: { name: '抓手指', color: '#AB47BC', textColor: '#FFF' }
};

// ============ 得吃大逃杀 color -> 四维映射 ============
// 酒精浓度：颜色越深越高
var COLOR_ALCOHOL_MAP = {
    grey: 20, green: 40, white: 60, red: 80, black: 95
};
// 刺激程度：中等偏高（喝酒本身就有刺激）
var COLOR_STIM_MAP = {
    grey: 25, green: 35, white: 50, red: 65, black: 80
};
// 沟通深度：全都很低（偏娱乐不偏对话）
var COLOR_DEPTH_MAP = {
    grey: 5, green: 5, white: 5, red: 5, black: 5
};
// 暧昧程度：大尺度牌(red/black)高，其他低
var COLOR_AMBIGUITY_MAP = {
    grey: 5, green: 10, white: 30, red: 75, black: 95
};

// ============ 关键词推断最低人数 ============
function inferMinPlayers(text) {
    if (!text) return 2;
    if (/所有人|全员|每个人|所有玩家|轮流/.test(text)) return 3;
    if (/两位玩家|两人|指定两名|CP|互相|对方|伙伴|Partner/.test(text)) return 2;
    if (/指定一人|指定一位|选择一位/.test(text)) return 2;
    return 2;
}

// ============ 添加微小随机波动（±5） ============
function jitter(base) {
    return Math.max(0, Math.min(100, base + Math.floor(Math.random() * 10) - 5));
}

// ============ 构建带标签的卡牌池 ============

// 1. 得吃大逃杀 - 基于 color 精确标签
//    酒精高、深度低、暧昧随颜色递增
var drinking_cards = CARDS.map(function (card) {
    var c = card.color || 'white';
    return {
        id: card.id,
        name: card.name || '',
        description: card.description || '',
        subtitle: card.subtitle || '',
        color: c,
        diyId: 'drinking_' + card.id,
        source: SOURCE_THEMES.drinking.name,
        sourceTheme: 'drinking',
        sourceColor: SOURCE_THEMES.drinking.color,
        sourceTextColor: SOURCE_THEMES.drinking.textColor,
        alcohol: jitter(COLOR_ALCOHOL_MAP[c] || 50),
        stimulation: jitter(COLOR_STIM_MAP[c] || 50),
        depth: jitter(COLOR_DEPTH_MAP[c] || 5),
        ambiguity: jitter(COLOR_AMBIGUITY_MAP[c] || 30),
        minPlayers: inferMinPlayers(card.description),
        gameType: { drinking: 0.9, dialogue: 0.05, dare: 0.05 }
    };
});

// 2. 喝酒之弈 - 策略酒牌
//    酒精高、刺激中、深度低、暧昧低
var chess_cards = CARDS_CHESS.map(function (card) {
    return {
        id: card.id,
        name: card.name || '',
        description: card.description || '',
        diyId: 'chess_' + card.id,
        source: SOURCE_THEMES.chess.name,
        sourceTheme: 'chess',
        sourceColor: SOURCE_THEMES.chess.color,
        sourceTextColor: SOURCE_THEMES.chess.textColor,
        alcohol: jitter(70),
        stimulation: jitter(35),
        depth: jitter(5),
        ambiguity: jitter(10),
        minPlayers: inferMinPlayers(card.description),
        gameType: { drinking: 0.9, dialogue: 0.05, dare: 0.05 }
    };
});

// 3. 社死模拟器 - 大冒险
//    酒精低、刺激极高、深度低、暧昧中
var dare_cards = CARDS_DARE.map(function (card) {
    return {
        id: card.id,
        name: '',
        description: card.description || '',
        diyId: 'dare_' + card.id,
        source: SOURCE_THEMES.dare.name,
        sourceTheme: 'dare',
        sourceColor: SOURCE_THEMES.dare.color,
        sourceTextColor: SOURCE_THEMES.dare.textColor,
        alcohol: jitter(10),
        stimulation: jitter(90),
        depth: jitter(5),
        ambiguity: jitter(30),
        minPlayers: inferMinPlayers(card.description),
        gameType: { drinking: 0.0, dialogue: 0.05, dare: 0.95 }
    };
});

// 4. 不是陌生人（含朋友真心话）- 深度对话
//    酒精极低、刺激极低、深度极高、暧昧极低
var truth_cards = CARDS_TRUTH.map(function (card) {
    return {
        id: card.id,
        name: '',
        description: card.description || '',
        diyId: 'truth_' + card.id,
        source: SOURCE_THEMES.we.name,
        sourceTheme: 'we',
        sourceColor: SOURCE_THEMES.we.color,
        sourceTextColor: SOURCE_THEMES.we.textColor,
        alcohol: jitter(0),
        stimulation: jitter(10),
        depth: jitter(90),
        ambiguity: jitter(5),
        minPlayers: inferMinPlayers(card.description),
        gameType: { drinking: 0.0, dialogue: 0.95, dare: 0.05 }
    };
});

// 5. 不是陌生人 - 深度对话
//    酒精极低、刺激极低、深度极高、暧昧极低
var we_cards = CARDS_WE.map(function (card) {
    return {
        id: card.id,
        name: card.name || '',
        description: card.description || '',
        subtitle: card.subtitle || '',
        englishDesc: card.englishDesc || '',
        diyId: 'we_' + card.id,
        source: SOURCE_THEMES.we.name,
        sourceTheme: 'we',
        sourceColor: SOURCE_THEMES.we.color,
        sourceTextColor: SOURCE_THEMES.we.textColor,
        alcohol: jitter(0),
        stimulation: jitter(5),
        depth: jitter(95),
        ambiguity: jitter(5),
        minPlayers: inferMinPlayers(card.description),
        gameType: { drinking: 0.0, dialogue: 0.95, dare: 0.05 }
    };
});

// 6. 情侣心动挑战 - 亲密互动冒险
//    酒精低、刺激高、深度低、暧昧极高
var couple_dare_cards = CARDS_COUPLE_DARE.map(function (card) {
    return {
        id: card.id,
        name: card.name || '',
        description: card.description || '',
        diyId: 'couple_dare_' + card.id,
        source: SOURCE_THEMES.couple_dare.name,
        sourceTheme: 'couple_dare',
        sourceColor: SOURCE_THEMES.couple_dare.color,
        sourceTextColor: SOURCE_THEMES.couple_dare.textColor,
        alcohol: jitter(10),
        stimulation: jitter(85),
        depth: jitter(15),
        ambiguity: jitter(90),
        minPlayers: 2,
        gameType: { drinking: 0.0, dialogue: 0.1, dare: 0.9 }
    };
});

// 7. 情侣暖甜交流 - 情侣深度对话
//    酒精极低、刺激低、深度高、暧昧中
var couple_talk_cards = CARDS_COUPLE_TALK.map(function (card) {
    return {
        id: card.id,
        name: card.name || '',
        description: card.description || '',
        diyId: 'couple_talk_' + card.id,
        source: SOURCE_THEMES.couple_talk.name,
        sourceTheme: 'couple_talk',
        sourceColor: SOURCE_THEMES.couple_talk.color,
        sourceTextColor: SOURCE_THEMES.couple_talk.textColor,
        alcohol: jitter(0),
        stimulation: jitter(15),
        depth: jitter(85),
        ambiguity: jitter(55),
        minPlayers: 2,
        gameType: { drinking: 0.0, dialogue: 0.9, dare: 0.1 }
    };
});

// 8. COFFEE CHAT - 深度社交对话
//    酒精极低、刺激极低、深度极高、暧昧极低
var coffee_cards = CARDS_COFFEE.map(function (card) {
    return {
        id: card.id,
        name: '',
        description: card.description || '',
        diyId: 'coffee_' + card.id,
        source: SOURCE_THEMES.coffee.name,
        sourceTheme: 'coffee',
        sourceColor: SOURCE_THEMES.coffee.color,
        sourceTextColor: SOURCE_THEMES.coffee.textColor,
        alcohol: jitter(0),
        stimulation: jitter(5),
        depth: jitter(95),
        ambiguity: jitter(5),
        minPlayers: 2,
        gameType: { drinking: 0.0, dialogue: 0.95, dare: 0.05 }
    };
});

// 9. 抓手指 - 物理互动酒牌
//    酒精高、刺激极低、深度极低、暧昧高
var finger_cards = CARDS_FINGER.map(function (card) {
    return {
        id: card.id,
        name: '',
        description: card.description || '',
        diyId: 'finger_' + card.id,
        source: SOURCE_THEMES.finger.name,
        sourceTheme: 'finger',
        sourceColor: SOURCE_THEMES.finger.color,
        sourceTextColor: SOURCE_THEMES.finger.textColor,
        alcohol: jitter(70),
        stimulation: jitter(5),
        depth: jitter(5),
        ambiguity: jitter(65),
        minPlayers: inferMinPlayers(card.description),
        gameType: { drinking: 0.85, dialogue: 0.05, dare: 0.1 }
    };
});

// 合并全部卡牌池（不含台球之奕、二本吻痕、哲学家酒牌）
var DIY_CARD_POOL = [].concat(
    drinking_cards,
    chess_cards,
    dare_cards,
    truth_cards,
    we_cards,
    couple_dare_cards,
    couple_talk_cards,
    coffee_cards,
    finger_cards
);

module.exports = {
    DIY_CARD_POOL: DIY_CARD_POOL,
    SOURCE_THEMES: SOURCE_THEMES
};
