/**
 * 台球之奕 - 卡牌数据
 * 卡牌随机展示，翡翠绿主题
 */
const CARDS_TAIQIU = [
    { id: 1, name: '红牛认输礼', description: '对手落败时需购买一瓶红牛向己方双手奉上并配合说"心服口服"' },
    { id: 2, name: '独眼船长', description: '对手下一杆击球只能用一只眼睛瞄准和击打' },
    { id: 3, name: '五连封神', description: '连续进球5个及以上即可获得"准神"称号，对手需更改微信备注并截图发朋友圈称赞' },
    { id: 4, name: '爱心手架', description: '对手下一杆由己方用"比心手势"的手架代替对手的手架' },
    { id: 5, name: '战术点名', description: '发动此卡即可指定对手下一次所要打进的球，进错拿出至黑8点位或附近' },
    { id: 6, name: '同进同消', description: '发动此卡后，对手每进一个球，己方也移除一个球（对手进球连杆，己方最多移除两个）' },
    { id: 7, name: '倒握一击', description: '对手下一杆必须用球杆尾部击球' },
    { id: 8, name: '天旋地转', description: '对手出杆之前必须原地转10圈' },
    { id: 9, name: '禁区封锁', description: '此次出杆禁止对方打袋口球，黑8除外（袋口指离袋口2颗球距离及以内）' },
    { id: 10, name: '重来一次', description: '击打目标球未进，可使用此卡再次击打，但目标球不可更换（黑8除外）' },
    { id: 11, name: '强制换色', description: '分球时可强行获得对手所选花色球，分球者继续击球' },
    { id: 12, name: '暗箱抽牌', description: '发动此卡，可在对方现有手牌中抽取一张' },
    { id: 13, name: '先手优势', description: '本局游戏对手让己方前二' },
    { id: 14, name: '指定归宿', description: '替对手指定下一球的进球袋口，如进错袋口拿出至黑8点位或附近' },
    { id: 15, name: '禁用架杆', description: '对手下一杆击球不许使用架杆，只能手架' },
    { id: 16, name: '反手试炼', description: '对手下一杆击球必须为反手握杆击球' },
    { id: 17, name: '卧龙代打', description: '对手下一杆由己方邀请一位场外选手替对手击打' },
    { id: 18, name: '凤雏代打', description: '对手下一杆由己方邀请一位场外选手替对手击打' },
    { id: 19, name: '后手让球', description: '本局游戏对手让己方后一' },
    { id: 20, name: '双球让利', description: '本局游戏对手让己方后二' },
    { id: 21, name: '无痕击球', description: '对手此杆击打的花色球不可以碰任何库和球，否则进球无效' },
    { id: 22, name: '赦免令', description: '可免除己方一次非落袋自由球（白球摔袋、打飞、不可免）' },
    { id: 23, name: '开球惩戒', description: '对手开球没下，己方获得全场自由球（如遇上"关系户卡"只能管遮锋芒，换卡一张）' },
    { id: 24, name: '自由降级', description: '使对手此次获得的全场自由球变为线上自由或者在己方击球前直接获得线上自由球' },
    { id: 25, name: '双数先行', description: '对手下一杆白球必须先碰撞双数球，犯规己方获自由球' },
    { id: 26, name: '袋口封王', description: '指定一个袋口，对手此次击球不可进球在该袋口，如有进球全部拿出放至黑8点位，并交换球权' },
    { id: 27, name: '架杆专注', description: '对手下一杆无论距离必须使用架杆' },
    { id: 28, name: '情绪输出', description: '己方每进一球对手必须夸奖"哥哥打得好"，忘记夸奖罚球一颗' },
    { id: 29, name: '自我确认', description: '对手每进一球必须问一句"准不准"，忘了需罚球一颗并交换球权' },
    { id: 30, name: '额外记分', description: '己方进球时，由对手为己方额外选择一颗球算进（黑8除外）' },
    { id: 31, name: '单数法则', description: '对手下一杆白球必须先碰撞单数球，犯规己方获自由球' },
    { id: 32, name: '两秒极限', description: '对手的下一杆必须在两秒内击球，超时罚球一颗' },
    { id: 33, name: '一换一赚', description: '对手将己方和对方的球同时打进后，可将对手的进球拿出放至黑8点位或附近，己方算进，并获得球权' },
    { id: 34, name: '紧贴消除', description: '可将己方两颗紧密相贴的球任意移除一颗（两球之间不可有缝隙）' },
    { id: 35, name: '误伤修正', description: '当击打己方花色球时误将对方球打进，可将对方球拿出放至黑8点位或附近' },
    { id: 36, name: '独脚挑战', description: '对手下一杆必须以单腿站立的方式完成击打' },
    { id: 37, name: '力量裁决', description: '扳手腕获胜者获得开球权（如遇上"关系户卡"只能管遮锋芒，换卡一张）' },
    { id: 38, name: '关系直通', description: '直接获得开球权，有无下球都可连杆（开球下白球作废，对手线上自由）' },
    { id: 39, name: '运气审判', description: '对手需石头剪刀布获胜才可连杆' },
    { id: 40, name: '球体重塑', description: '己方击球前可移除任意一颗花色球' },
    { id: 41, name: '低保触发', description: '对手只剩黑8时，己方还有两颗或以上的花色球，立即交换球权并获得自由球' },
    { id: 42, name: '盲狙一杆', description: '对手下一杆瞄准后须紧闭双眼完成击打' },
    { id: 43, name: '反射定律', description: '对手下一杆必须以翻袋的方式完成进球' },
    { id: 44, name: '反噬镜像', description: '将对手向己方所出的卡牌效果反弹至对手身上，下一回合生效' },
    { id: 45, name: '蒙进无效', description: '对手蒙进球后，可将进球拿出放至黑8点位或附近并交换球权' },
    { id: 46, name: '黑八契约', description: '分球后移除己方所有花色球，只留黑8，但打不进时对方可移除一颗花色球并且获得线上自由（当对手只剩黑8时，直接获胜）' },
    { id: 47, name: '最后一搏', description: '对手打进黑8时，可将黑8放回开球点位，白球位置不变，对手再次击打，如果没进，己方将花色球移除至剩一个并获得击球权' },
    { id: 48, name: '花式出杆', description: '对手下一杆必须用背后出杆的方式击打' },
    { id: 49, name: '断臂大侠', description: '对手下一杆必须单手持杆击球，不可使用手架和架杆' },
    { id: 50, name: '攻防转换', description: '此球打进，可将对手一颗球移至贴库' },
    { id: 51, name: '金钱即胜利', description: '打几号球未进，可向对手发几元红包，把球买进继续连杆' },
    { id: 52, name: '口是心非', description: '对手下一杆击球时，需一边击球一边说"我肯定进不了"，说错或停顿视为犯规' },
    { id: 53, name: '假动作大师', description: '对手出杆前必须连续做三次假出杆，少一次或多一次视为犯规' },
    { id: 54, name: '选择困难症', description: '对手下一杆击球前，需在5秒内决定目标球，超时则由己方指定目标球' },
    { id: 55, name: '声控进球', description: '对手下一杆击球时，需喊出目标球号码，喊错或未喊视为犯规' },
    { id: 56, name: '站位惩罚', description: '对手下一杆击球时，双脚必须完全踩在同一块地砖或同一条地面纹路上' },
    { id: 57, name: '牌运反转', description: '当对手即将使用一张卡牌时，可发动此卡，使该卡效果立即失效并弃置' }
];

// 预计算卡牌映射表
const CARD_MAP_TAIQIU = CARDS_TAIQIU.reduce((acc, card) => {
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
    CARDS_TAIQIU,
    CARD_MAP_TAIQIU,
    shuffleArray
};
