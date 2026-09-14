/**
 * 喝酒之弈 - 卡牌数据
 * 卡牌随机展示，金色主题
 */
const CARDS_CHESS = [
    { id: 1, name: '超级加倍', description: '随便喝多少杯，下一个人翻一倍。' },
    { id: 2, name: '利滚利', description: '你的酒会开始积累，每四杯则增加一杯。' },
    { id: 3, name: '天涯若比邻', description: '当你需要喝酒时，离你最远的玩家需要喝半杯。' },
    { id: 4, name: '掀桌', description: '都别玩了，本轮卡牌作废，全员干杯。' },
    { id: 5, name: '卑鄙之人', description: '将自己的酒分给左右两边的人。' },
    { id: 6, name: '背水一战', description: '指定一名玩家与其干杯，直到他认输为止。' },
    { id: 7, name: '不必理会', description: '免疫一次他人的任何要求。' },
    { id: 8, name: '不拘一格', description: '可以去上厕所一次。' },
    { id: 9, name: '彩色赠礼', description: '免酒3次。' },
    { id: 10, name: '成吨的伤害', description: '喝两杯。' },
    { id: 11, name: '多多益善', description: '你可以随机指向一人让他本回合每次喝酒多喝三分之一。' },
    { id: 12, name: '恶魔契约', description: '连喝三杯换取后两回合不用喝。' },
    { id: 13, name: '纷乱头脑', description: '回复任何人都只能说不知道, 失败罚两杯。若坚持至回合结束,搭话最多的人喝半杯。' },
    { id: 14, name: '孤注一掷', description: '掷骰子，单数右边喝，双数自己喝。' },
    { id: 15, name: '光明圣物', description: '可以免三杯。' },
    { id: 16, name: '好兄弟', description: '指定一名玩家陪你喝。' },
    { id: 17, name: '厚脸皮', description: '所有人允许持有者养鱼。' },
    { id: 18, name: '假人辅助', description: '下次喝酒任意一个人替你喝半杯，但是需要喝交杯酒。' },
    { id: 19, name: '禁烟大使', description: '收集在场的所有打火机,他人想要抽烟必须满足你的要求。' },
    { id: 20, name: '就是你了', description: '发动后谁说了酒字谁就要罚酒一杯，五次效果。' },
    { id: 21, name: '举手投降', description: '摇白旗,发朋友圈承认自己是小趴菜。' },
    { id: 22, name: '开摆', description: '这一回合你不能动，回合结束时获得免喝两次资格。' },
    { id: 23, name: '开启伤害', description: '有或没对象的喝一杯，持有者自选。' },
    { id: 24, name: '空空如也', description: '持有者左边一位将自己的酒喝完，并展示空空如也。' },
    { id: 25, name: '来短信啦', description: '谁手机先来弹窗信息谁喝酒。' },
    { id: 26, name: '联合抵抗', description: '与左右两名玩家共同承担下次喝酒。' },
    { id: 27, name: '炼狱合约', description: '本回合不需要喝酒，但是回合结束需要喝完桌上的酒。' },
    { id: 28, name: '恋爱脑', description: '大喊三遍我是XX。' },
    { id: 29, name: '麻烦来咯', description: '与在场每个人划拳，输了就喝。' },
    { id: 30, name: '冒险举动', description: '掷骰子，摇到多少喝多少。' },
    { id: 31, name: '命运相连', description: '投掷骰子，如果一二上家喝，三四下家喝，五六自己喝。' },
    { id: 32, name: '你在狗叫什么', description: '大喊你在狗叫什么啊，下一个对你说话的罚酒。' },
    { id: 33, name: '潘多拉的酒杯', description: '任意与桌上一人交换杯中酒。' },
    { id: 34, name: '乾坤大挪移', description: '场上所有玩家换位置，你可以指定自己和两个玩家的位置。' },
    { id: 35, name: '强制消费', description: '全场让您消费购买一件商品(香烟或任意零食)。' },
    { id: 36, name: '权力游戏', description: '指定一位玩家, 大冒险真心话,喝N杯(三选一)。' },
    { id: 37, name: '入门套件', description: '你需要喝一杯，与你穿相同颜色衣服最多的需要喝一瓶。' },
    { id: 38, name: '升天喽', description: '强制所有人干杯，持有者多喝两杯。' },
    { id: 39, name: '绳之以法', description: '找出那个喝的最少的罚他三杯。' },
    { id: 40, name: '事在人为', description: '给所有人任意倒酒。' },
    { id: 41, name: '说话过脑', description: '场上不能有人说"我"字，违反了喝一杯。' },
    { id: 42, name: '逃酒街区', description: '每回合可以少喝半杯。' },
    { id: 43, name: '天选之子', description: '本局游戏当你需要喝酒时只需要喝三分之二。' },
    { id: 44, name: '我要变身', description: '持有者大喊"我要变身"休息10分钟。' },
    { id: 45, name: '先苦后甜', description: '第一轮需要喝三杯，第二轮1.5杯之后每次喝酒都只需要喝一半。' },
    { id: 46, name: '心动嘉宾', description: '连喝三杯换取任意一玩家每次都只需要喝一半，可以选择放弃。' },
    { id: 47, name: '幸运之手', description: '投掷两次骰子,分别决定谁可以免并且免除多少杯。' },
    { id: 48, name: '以大欺小', description: '你可以自己制定本回合的惩罚,但是强大的力量必然带来反噬,下一轮你的惩罚×1.5倍。' },
    { id: 49, name: '宇将军飞踢', description: '表演宇将军飞踢，表演完毕指定一位喝，若不表演自己喝。' },
    { id: 50, name: '冤种之王', description: '整局不需要玩游戏，接下来每个人喝酒你都要陪酒。' },
    { id: 51, name: '再来一杯', description: '当你需要喝酒时有33%概率再喝一杯。' },
    { id: 52, name: '知识的力量', description: '每人背诵首诗词，背不出的罚一杯。' },
    { id: 53, name: '专心听讲', description: '讲述或做一个动作并选择三位学生,模仿最差的罚两杯。' },
    { id: 54, name: '嘴硬', description: '当有人催你喝酒时，你可以说喝了，借此免去一杯。' }
];

// 预计算卡牌映射表
const CARD_MAP_CHESS = CARDS_CHESS.reduce((acc, card) => {
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
    CARDS_CHESS,
    CARD_MAP_CHESS,
    shuffleArray
};
