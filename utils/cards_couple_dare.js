/**
 * 情侣心动挑战 - 卡牌数据
 * 47 张不翻转卡牌
 */
var CARDS_COUPLE_DARE = [
    { id: 1, name: '乳燕归巢', description: '将对方揽入怀中，进行模拟喂哺的亲密互动。' },
    { id: 2, name: '承欢膝下', description: '跪姿，模仿犬类呼吸，用舌尖探索对方身体任一部位。' },
    { id: 3, name: '墙头马上', description: '强势将对方逼至墙角，粗暴的接吻。' },
    { id: 4, name: '落红成阵', description: '在对方大腿内侧留下深色吻痕，或使用工具/掌心掌责 3 下。' },
    { id: 5, name: '冷香凝脂', description: '将冰块置于对方皮肤，书写不少于 5 个字。' },
    { id: 6, name: '鱼戏莲叶', description: '模仿猫/狗的叫声，并摆出最具诱惑感的仿生姿势。' },
    { id: 7, name: '耳鬓厮磨', description: '舌吻对方耳朵，目标在 15 秒内引导对方发出情动之声。' },
    { id: 8, name: '手如柔荑', description: '双方进行 15 秒的全程肢体游走抚触。' },
    { id: 9, name: '青青子衿', description: '设定一个专属称呼持续全局。' },
    { id: 10, name: '温香软玉', description: '被对方用胸部敏感区贴合面部摩擦 15 秒。' },
    { id: 11, name: '雨打芭蕉', description: '趴在对方腿上，接受对臀部的 5 下掌心或工具责罚。' },
    { id: 12, name: '刻骨铭心', description: '用手指在对方身体任意部位描摹自己的名字。' },
    { id: 13, name: '交杯换盏', description: '以口为媒，将食物或液体渡入对方口中。' },
    { id: 14, name: '依稀入怀', description: '公主抱 5 秒，或骑坐在对方腿部面对面相拥 15 秒。' },
    { id: 15, name: '昵昵小语', description: '贴耳倾诉一句露骨的对白，令对方产生羞耻红晕。' },
    { id: 16, name: '吐气如兰', description: '贴近耳廓，轻声说出一段令其心动的赞美。' },
    { id: 17, name: '狸奴入梦', description: '保持猫咪姿态，接受对方的「摸头杀」或抚摸下巴。' },
    { id: 18, name: '宽衣解带', description: '褪去身上任意一件遮蔽物。' },
    { id: 19, name: '唇齿留香', description: '将液体/冰块/水果置于对方身体任意部位，用唇舌慢慢清理品尝。' },
    { id: 20, name: '天作之合', description: '拥有一次绝对意志，让对方配合你完成任意一项身体探索。' },
    { id: 21, name: '禁声莫语', description: '设定日常禁词，违规者需减少一件衣物或接受一项体罚。' },
    { id: 22, name: '按图索骥', description: '用易洗笔在对方身体标注敏感阀值，并据此进行后续感官开发。' },
    { id: 23, name: '寻芳问径', description: '共同绘制身体版图，标记已开发区域、待深入区域与禁区。' },
    { id: 24, name: '气若游丝', description: '轻覆对方呼吸，配合深层湿吻进行供氧，循环 3 次。' },
    { id: 25, name: '焚香侍立', description: '蒙眼状态下为对方解衣、穿衣或全身推拿，全程听从声控。' },
    { id: 26, name: '附耳低言', description: '下达一项即时指令（如：数到三），对方需无条件配合。' },
    { id: 27, name: '晨光熹微', description: '次日清晨的特殊唤醒服务。' },
    { id: 28, name: '步步生莲', description: '被对方用足部轻踩、磨蹭或夹紧其他身体部位。' },
    { id: 29, name: '齿间留情', description: '仅限动用唇齿，帮对方脱下内衣裤。' },
    { id: 30, name: '林间猎艳', description: '佩戴铃铛狩猎，捕获后撕毁/除去对方遮蔽物。' },
    { id: 31, name: '待价而沽', description: '将自己作为「物品」展示，指认并触碰对方的部位。' },
    { id: 32, name: '画屏陈设', description: '扮演家具（如：脚凳），对方可用足部在其身上放置物品 3 分钟。' },
    { id: 33, name: '冰壶秋月', description: '将冰块滑入对方贴身内衣内。' },
    { id: 34, name: '梨园入戏', description: '模拟一段小电影中的台词、神情或特定动作。' },
    { id: 35, name: '缚茧自缚', description: '蒙眼并固定双臂，将身体的控制权完全交给对方。' },
    { id: 36, name: '声色犬马', description: '在被对方持续挑逗/抚弄的过程中，坚持完整朗读一段文字。' },
    { id: 37, name: '顾影自怜', description: '换上特定QQNY，在对方面前展示诱人姿态。' },
    { id: 38, name: '锦书难托', description: '分享一段关于床上幻想的语音记录。' },
    { id: 39, name: '画地为牢', description: '担任对方的私人仆从，服务沐浴、更衣等所有私密事宜。' },
    { id: 40, name: '醉墨淋漓', description: '在对方身体书写羞耻的词汇，随后用舌尖清理干净。' },
    { id: 41, name: '金屋藏娇', description: '按对方要求拍摄一张局部敏感处的照片发给对方。' },
    { id: 42, name: '冷暖自知', description: '交替使用冰块与低温蜡烛刺激身体，并描述感官温差。' },
    { id: 43, name: '妆点春色', description: '对对方私处毛发进行修剪或清理。' },
    { id: 44, name: '千金一掷', description: '表演才艺，直到获得对方的「打赏」（由对方定义动作）。' },
    { id: 45, name: '暗香疏影', description: '蒙眼，通过感官辨别对方递来的玩具或衣物。' },
    { id: 46, name: '知彼知己', description: '找一份特殊偏好测试，当着对方面完成。' },
    { id: 47, name: '纵马驰骋', description: '保持跪趴位，由对方骑坐并进行臀部拍打。' }
];

// 构建 ID -> 卡牌映射
var CARD_MAP_COUPLE_DARE = {};
CARDS_COUPLE_DARE.forEach(function (card) {
    CARD_MAP_COUPLE_DARE[card.id] = card;
});

module.exports = {
    CARDS_COUPLE_DARE: CARDS_COUPLE_DARE,
    CARD_MAP_COUPLE_DARE: CARD_MAP_COUPLE_DARE
};
