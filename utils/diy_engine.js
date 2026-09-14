/**
 * DIY 选牌算法引擎
 * 根据用户滑块参数，从 DIY_CARD_POOL 中加权随机抽取 100 张卡牌
 *
 * 算法流程：
 * 1. 极值硬过滤（slider ≤20 时排除 tag>70 的卡；slider ≥80 时排除 tag<30 的卡）→ 永不绕过
 *    中间区间 30-70 为中性区，不会被任何方向的极值硬过滤排除，由评分系统处理排序
 * 2. 人数过滤（可放宽）
 * 3. 距离评分（25/25/25/20/5 权重）
 * 4. 分数平方加权随机抽样
 * 5. 不足则从合格池循环填充（永不引入不合格卡）
 */
var cardIndex = require('./cards_diy_index.js');
var DIY_CARD_POOL = cardIndex.DIY_CARD_POOL;

var TARGET_COUNT = 100;

// ============ 极值硬过滤 ============
var SLIDER_LOW = 20;
var SLIDER_HIGH = 80;
var CARD_LOW_THRESHOLD = 30;   // slider≥80 时，排除标签<30 的卡（明确低值）
var CARD_HIGH_THRESHOLD = 70;  // slider≤20 时，排除标签>70 的卡（明确高值）

function passesHardFilter(card, options) {
    // 酒精
    if (options.alcohol <= SLIDER_LOW && card.alcohol > CARD_HIGH_THRESHOLD) return false;
    if (options.alcohol >= SLIDER_HIGH && card.alcohol < CARD_LOW_THRESHOLD) return false;
    // 刺激
    if (options.stimulation <= SLIDER_LOW && card.stimulation > CARD_HIGH_THRESHOLD) return false;
    if (options.stimulation >= SLIDER_HIGH && card.stimulation < CARD_LOW_THRESHOLD) return false;
    // 深度
    if (options.depth <= SLIDER_LOW && card.depth > CARD_HIGH_THRESHOLD) return false;
    if (options.depth >= SLIDER_HIGH && card.depth < CARD_LOW_THRESHOLD) return false;
    // 暧昧
    var cardAmb = card.ambiguity !== undefined ? card.ambiguity : 0;
    if (options.ambiguity <= SLIDER_LOW && cardAmb > CARD_HIGH_THRESHOLD) return false;
    if (options.ambiguity >= SLIDER_HIGH && cardAmb < CARD_LOW_THRESHOLD) return false;
    return true;
}

// ============ 距离匹配评分 ============
function calcRelevanceScore(card, options) {
    var alcoholScore = (1 - Math.abs(card.alcohol - options.alcohol) / 100) * 25;
    var stimScore = (1 - Math.abs(card.stimulation - options.stimulation) / 100) * 25;
    var depthScore = (1 - Math.abs(card.depth - options.depth) / 100) * 25;
    var cardAmbiguity = card.ambiguity !== undefined ? card.ambiguity : 0;
    var ambiguityScore = (1 - Math.abs(cardAmbiguity - options.ambiguity) / 100) * 20;
    var randomFactor = Math.random() * 5;
    return alcoholScore + stimScore + depthScore + ambiguityScore + randomFactor;
}

// ============ 加权随机抽样（分数平方） ============
function weightedSample(scored, count) {
    if (scored.length <= count) {
        return scored.map(function (s) { return s.card; });
    }

    var totalScore = 0;
    for (var i = 0; i < scored.length; i++) {
        var w = scored[i].score * scored[i].score;
        scored[i]._weight = Math.max(w, 0.01);
        totalScore += scored[i]._weight;
    }

    var selected = [];
    var usedIndices = {};
    var attempts = 0;
    var maxAttempts = count * 10;

    while (selected.length < count && attempts < maxAttempts) {
        attempts++;
        var rand = Math.random() * totalScore;
        var cumulative = 0;
        for (var j = 0; j < scored.length; j++) {
            cumulative += scored[j]._weight;
            if (cumulative >= rand && !usedIndices[j]) {
                usedIndices[j] = true;
                selected.push(scored[j].card);
                break;
            }
        }
    }

    return selected;
}

// ============ Fisher-Yates 洗牌 ============
function shuffleArray(array) {
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

// ============ 极值组合 → 指定来源映射 ============
// 当四个滑块全部处于极值（≤20 或 ≥80）时，按此表指定卡牌来源
// key 格式: '酒精_刺激_深度_暧昧'（0=低极值, 100=高极值）
var EXTREME_THEME_MAP = {
    '0_0_0_100': { themes: ['couple_dare', 'drinking'] },
    '0_0_100_100': { themes: ['couple_dare', 'couple_talk'] },
    '0_100_0_0': { themes: ['dare', 'drinking'] },
    '0_100_0_100': { themes: ['dare', 'couple_dare'] },
    '0_100_100_0': { themes: ['couple_dare', 'couple_talk', 'dare'] },
    '0_100_100_100': { themes: ['couple_talk', 'dare', 'couple_dare'] },
    '100_0_100_0': { themes: ['drinking', 'finger', 'couple_talk', 'we'] },
    '100_0_100_100': { themes: ['drinking', 'couple_talk', 'couple_dare'], noLimit: true },
    '100_0_0_100': { themes: ['drinking', 'couple_dare'] },
    '100_100_0_0': { themes: ['drinking', 'finger', 'dare'] },
    '100_100_0_100': { themes: ['drinking', 'dare', 'couple_dare'] },
    '100_100_100_0': { themes: ['drinking', 'finger', 'we', 'couple_talk'] },
    '100_100_100_100': { themes: ['drinking', 'finger', 'couple_talk', 'we', 'couple_dare'] }
};

// ============ 混合过渡区检测 ============
// 在极值映射路径和普通算法之间创建平滑过渡
// 过渡区：滑块 20-40（低端）和 60-80（高端）
var BLEND_LOW_INNER = 40;    // 低端过渡上界
var BLEND_HIGH_INNER = 60;   // 高端过渡下界

/**
 * 检测是否所有滑块都处于极值或近极值区域
 * 返回 { key, factor } 或 null
 *   key    = 最近的极值映射 key，如 '100_0_0_100'
 *   factor = 混合因子 0.0~1.0（0=全用普通算法，1=全用极值映射）
 */
function getBlendInfo(options) {
    function dimInfo(val) {
        // 完全极值区
        if (val <= SLIDER_LOW) return { extreme: '0', factor: 1.0 };
        if (val >= SLIDER_HIGH) return { extreme: '100', factor: 1.0 };
        // 近低极值过渡区 (20-40)
        if (val < BLEND_LOW_INNER) {
            return { extreme: '0', factor: (BLEND_LOW_INNER - val) / (BLEND_LOW_INNER - SLIDER_LOW) };
        }
        // 近高极值过渡区 (60-80)
        if (val > BLEND_HIGH_INNER) {
            return { extreme: '100', factor: (val - BLEND_HIGH_INNER) / (SLIDER_HIGH - BLEND_HIGH_INNER) };
        }
        // 中间区 (40-60)：不参与混合
        return null;
    }

    var alc = dimInfo(options.alcohol);
    var stim = dimInfo(options.stimulation);
    var dep = dimInfo(options.depth);
    var amb = dimInfo(options.ambiguity);

    // 任何维度在中间区 → 不混合
    if (!alc || !stim || !dep || !amb) return null;

    var key = alc.extreme + '_' + stim.extreme + '_' + dep.extreme + '_' + amb.extreme;
    // 取最弱因子（木桶效应）
    var factor = Math.min(alc.factor, stim.factor, dep.factor, amb.factor);

    if (factor <= 0) return null;
    return { key: key, factor: factor };
}

// ============ 从指定主题列表生成牌组 ============
// 保证每个主题至少有一定数量的卡牌，其余按评分加权随机抽取
function generateFromThemes(mapping, options) {
    var themeList = mapping.themes;
    var noLimit = mapping.noLimit || false;

    // 按主题收集卡牌并打分
    var themePools = {};
    var allScored = [];
    for (var i = 0; i < DIY_CARD_POOL.length; i++) {
        var card = DIY_CARD_POOL[i];
        for (var t = 0; t < themeList.length; t++) {
            if (card.sourceTheme === themeList[t]) {
                allScored.push({ card: card, score: calcRelevanceScore(card, options) });
                if (!themePools[themeList[t]]) themePools[themeList[t]] = [];
                themePools[themeList[t]].push(card);
                break;
            }
        }
    }

    // 不限牌数 或 总量不足 TARGET_COUNT：返回全部
    if (noLimit || allScored.length <= TARGET_COUNT) {
        return shuffleArray(allScored.map(function (s) { return s.card; }));
    }

    // 保证每个主题至少 minPerTheme 张
    var minPerTheme = Math.max(5, Math.floor(TARGET_COUNT / themeList.length * 0.2));
    var result = [];
    var usedIds = {};

    for (var t2 = 0; t2 < themeList.length; t2++) {
        var pool = shuffleArray((themePools[themeList[t2]] || []).slice());
        var count = Math.min(minPerTheme, pool.length);
        for (var j = 0; j < count; j++) {
            result.push(pool[j]);
            usedIds[pool[j].diyId] = true;
        }
    }

    // 剩余名额通过加权随机从未选卡牌中抽取
    var remainingScored = allScored.filter(function (s) { return !usedIds[s.card.diyId]; });
    var needed = TARGET_COUNT - result.length;
    var sampled = weightedSample(remainingScored, needed);
    result = result.concat(sampled);

    return shuffleArray(result);
}

// ============ 普通算法生成牌组 ============
function generateNormalDeck(options) {
    var minPlayers = Math.max(options.players || 2, 2);

    // ---- 特殊情况 A：暧昧程度高 + 深度低 ----
    if (options.ambiguity >= SLIDER_HIGH &&
        options.depth <= SLIDER_LOW) {
        var drinkingScored = [];
        for (var d = 0; d < DIY_CARD_POOL.length; d++) {
            if (DIY_CARD_POOL[d].sourceTheme === 'drinking') {
                drinkingScored.push({
                    card: DIY_CARD_POOL[d],
                    score: calcRelevanceScore(DIY_CARD_POOL[d], options)
                });
            }
        }
        var drinkResult = weightedSample(drinkingScored, Math.min(TARGET_COUNT, drinkingScored.length));
        return shuffleArray(drinkResult);
    }

    // ---- 特殊情况 B：深度与酒精/刺激互斥冲突 ----
    var opts = {
        alcohol: options.alcohol,
        stimulation: options.stimulation,
        depth: options.depth,
        ambiguity: options.ambiguity,
        players: options.players
    };
    if (opts.depth >= SLIDER_HIGH) {
        if (opts.alcohol >= SLIDER_HIGH) opts.alcohol = 50;
        if (opts.stimulation >= SLIDER_HIGH) opts.stimulation = 50;
    }

    // 第一步：极值硬过滤
    var hardFiltered = [];
    for (var i = 0; i < DIY_CARD_POOL.length; i++) {
        if (passesHardFilter(DIY_CARD_POOL[i], opts)) {
            hardFiltered.push(DIY_CARD_POOL[i]);
        }
    }

    // 第二步：人数过滤 + 打分
    var scored = [];
    for (var j = 0; j < hardFiltered.length; j++) {
        if (hardFiltered[j].minPlayers <= minPlayers) {
            scored.push({
                card: hardFiltered[j],
                score: calcRelevanceScore(hardFiltered[j], options)
            });
        }
    }

    // 第三步：人数不足则放宽
    if (scored.length < TARGET_COUNT) {
        scored = [];
        for (var k = 0; k < hardFiltered.length; k++) {
            scored.push({
                card: hardFiltered[k],
                score: calcRelevanceScore(hardFiltered[k], options)
            });
        }
    }

    // 第四步：加权随机抽取
    var result = weightedSample(scored, Math.min(TARGET_COUNT, scored.length));
    return shuffleArray(result);
}

// ============ 核心：生成牌组（带混合过渡） ============
function generateDeck(options) {
    var blendInfo = getBlendInfo(options);

    // 没有映射或不在近极值区 → 直接走普通算法
    if (!blendInfo || !EXTREME_THEME_MAP[blendInfo.key]) {
        return generateNormalDeck(options);
    }

    var mapping = EXTREME_THEME_MAP[blendInfo.key];

    // 完全极值（factor=1.0）→ 100% 走映射路径
    if (blendInfo.factor >= 1.0) {
        return generateFromThemes(mapping, options);
    }

    // ---- 混合过渡区：按 factor 比例混合映射牌和普通牌 ----
    var mappingDeck = generateFromThemes(mapping, options);
    var normalDeck = generateNormalDeck(options);

    // 按混合因子分配名额
    var mappingCount = Math.round(TARGET_COUNT * blendInfo.factor);
    var normalCount = TARGET_COUNT - mappingCount;

    // 去重：优先保留映射牌，从普通牌中去除重复
    var mappingIds = {};
    mappingDeck.forEach(function (c) { mappingIds[c.diyId] = true; });
    var uniqueNormal = normalDeck.filter(function (c) { return !mappingIds[c.diyId]; });

    // 抽取
    var mappingPick = shuffleArray(mappingDeck).slice(0, Math.min(mappingCount, mappingDeck.length));
    var normalPick = shuffleArray(uniqueNormal).slice(0, normalCount);

    var result = mappingPick.concat(normalPick);

    // 不足时从映射牌补充
    if (result.length < TARGET_COUNT && mappingDeck.length > mappingPick.length) {
        var usedIds = {};
        result.forEach(function (c) { usedIds[c.diyId] = true; });
        var extra = mappingDeck.filter(function (c) { return !usedIds[c.diyId]; });
        result = result.concat(shuffleArray(extra).slice(0, TARGET_COUNT - result.length));
    }

    return shuffleArray(result);
}

module.exports = {
    generateDeck: generateDeck
};

