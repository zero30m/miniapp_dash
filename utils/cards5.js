/**
 * 朋友真心话 - 卡牌数据
 * 卡牌随机展示，玫瑰金主题
 * 共60张真心话卡牌（仅内容，无标题）
 */
const CARDS_TRUTH = [
    { id: 1, description: '讲讲你人生中怼人最爽、发挥最好的一次经历。' },
    { id: 2, description: '你遇到过学历不高但收入吓死人的人吗？他是做什么的？' },
    { id: 3, description: '如果伴侣年薪是你10倍但要求你全职在家，你干不干？' },
    { id: 4, description: '你曾因为什么和朋友绝交过？' },
    { id: 5, description: '你心中最完美的恋爱关系是什么？' },
    { id: 6, description: '你人生中踩过最大的坑是什么？导致了什么后果？' },
    { id: 7, description: '你最相信在座的谁？' },
    { id: 8, description: '你用过哪些理由结束一段关系？' },
    { id: 9, description: '你最讨厌什么样的行为？' },
    { id: 10, description: '你最理想的职业是什么？' },
    { id: 11, description: '假如给你一个亿，你会怎么花？' },
    { id: 12, description: '你用过最奇葩的省钱方式是什么？' },
    { id: 13, description: '如果必须出卖一个朋友的秘密来换取金钱，你会做吗？' },
    { id: 14, description: '如果要做博主你会想做什么博主？' },
    { id: 15, description: '有什么事你想做很久但一直没做？' },
    { id: 16, description: '你人生中最孤独的时刻是什么时候？' },
    { id: 17, description: '说实话，你觉得你现在的名气配得上你的才华吗？' },
    { id: 18, description: '如果明天公司/学校倒闭，你第一反应是焦虑还是窃喜？' },
    { id: 19, description: '你做过最叛逆的事是什么？' },
    { id: 20, description: '什么是你心中经济上行的美？' },
    { id: 21, description: '你有没有被PUA过？当时是怎么反击（或忍受）的？' },
    { id: 22, description: '如果你被强奸，你会如何处理？' },
    { id: 23, description: '你愿不愿意为了高薪去干一份非常枯燥且被人看不起的工作？' },
    { id: 24, description: '从小到大最令你骄傲的一件事是什么？' },
    { id: 25, description: '假如你是超级反派，想要毁灭世界，你会从哪里下手？' },
    { id: 26, description: '你会选择你爱的人还是爱你的人？' },
    { id: 27, description: '如果你两位朋友恋爱，其中一位劈腿，你会直接告诉另一方吗？' },
    { id: 28, description: '你觉得怎么样才算不虚度大学时光？' },
    { id: 29, description: '你觉得恋爱期间，能不能保留异性知己？底线在哪里？' },
    { id: 30, description: '你有没有那一瞬间，觉得"单身真好，狗都不谈恋爱"？' },
    { id: 31, description: '如果前任发财了回来找你复合，你会动摇吗？' },
    { id: 32, description: '你能不能接受伴侣为了赚钱，每周996甚至一个月见不到人？' },
    { id: 33, description: '你认为人是怎么废掉的？' },
    { id: 34, description: '你觉得什么才是真正的道德？' },
    { id: 35, description: '如何判断一个人有钱还是装的？' },
    { id: 36, description: '你能接受幼稚的伴侣吗？是觉得可爱还是累？' },
    { id: 37, description: '目前为止，你总结出的最大人生经验是什么？' },
    { id: 38, description: '你认识的最有钱的人是怎样生活的？' },
    { id: 39, description: '如果你喜欢的人喜欢上你朋友，你会怎么想？' },
    { id: 40, description: '你有没有对朋友的伴侣产生过一瞬间的非分之想？' },
    { id: 41, description: '你觉得恋人之间应该毫无保留地坦白过去的情史吗？' },
    { id: 42, description: '讲一次你为了引起某人注意而做的蠢事。' },
    { id: 43, description: '你在互联网上最喜欢的一位博主是谁？' },
    { id: 44, description: '你如何看待当下互联网的男女对立？' },
    { id: 45, description: '你收到过最不满意的礼物是什么？' },
    { id: 46, description: '你认为精神出轨和肉体出轨，哪个更不可原谅？' },
    { id: 47, description: '你有没有"备胎"或者被人当过"备胎"的经历？' },
    { id: 48, description: '恋爱期间有对别人心动过吗？' },
    { id: 49, description: '你对幸福的定义是什么？' },
    { id: 50, description: '你理想的家庭模式是怎么样的？' },
    { id: 51, description: '分享一个你最近听到的劲爆八卦。' },
    { id: 52, description: '你觉得在座谁的性格反差最大？' },
    { id: 53, description: '你有没有哪怕一瞬间，想拉黑你最好的朋友？为什么？' },
    { id: 54, description: '第一次见我时，你对我的真实印象是什么？和现在差别大吗？' },
    { id: 55, description: '如果有一天变成动物，你会想变成什么动物？' },
    { id: 56, description: '你是否曾在背后偷偷说过朋友坏话？' },
    { id: 57, description: '你跟儿时的朋友还有联系吗？' },
    { id: 58, description: '你最痛苦的回忆是什么？' },
    { id: 59, description: '你觉得在座谁最容易被骗？' },
    { id: 60, description: '如果要借一万块钱，在座你会向谁借？' }
];

// 预计算卡牌映射表
const CARD_MAP_TRUTH = CARDS_TRUTH.reduce((acc, card) => {
    acc[card.id] = card;
    return acc;
}, {});

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

module.exports = {
    CARDS_TRUTH,
    CARD_MAP_TRUTH,
    shuffleArray
};
