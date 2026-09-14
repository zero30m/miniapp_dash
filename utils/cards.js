const CARDS = [
  // ==================== 灰色卡牌 ====================
  { id: 3, color: 'grey', name: '私党', description: '轮流向右边的人悄悄问一个问题，被问的人大声说出答案。有人不愿公布答案需要喝一杯酒。', subtitle: '也能用一杯酒换答案' },
  { id: 5, color: 'grey', name: '逢七必过', description: '数到7或7的倍数时需拍手喊"过"，出错者喝酒', subtitle: '直接从951开始得了' },
  { id: 21, color: 'grey', name: '逛三园', description: '抽到此牌的玩家需设定一个话题（如"情趣园里有什么"），自己先说一个，顺时针轮流接龙，说不出来的喝酒', subtitle: '老说动物园很没新意！' },
  { id: 23, color: 'grey', name: '照相机', description: '抽到此牌的玩家可随时喊"照相机"，所有人需静止五秒，最先移动者喝酒，若五秒内无人动则此牌作废', subtitle: '不许动' },
  { id: 25, color: 'grey', name: '2025', description: '从摸到这张牌的人开始，依次掷骰子，投出6点的玩家和其左边玩家依次喝2杯、0杯、2杯和5杯', subtitle: '这种游戏我一般故意输' },
  { id: 27, color: 'grey', name: '吹牛', description: '轮流介绍自己和家庭，不愿意介绍的喝一杯。', subtitle: '吹牛争霸赛' },
  { id: 28, color: 'grey', name: '跳一跳', description: '打开微信跳一跳，先失败的人喝一杯。', subtitle: '没想到要玩这个吧？' },
  { id: 38, color: 'grey', name: '暗板', description: '把一个纸团随意藏在手里，让大家猜在哪只手里，猜错的人喝。', subtitle: '悄咪咪的.' },
  { id: 41, color: 'grey', name: '神经病', description: '所有与该持牌者说话的人都需喝酒。使用三次后报废。', subtitle: '别烦' },
  { id: 42, color: 'grey', name: '擦边', description: '所有人打开短视频软件展示于桌前，开始往下滑，连滑5个，每刷到一个异性擦边视频自己喝一杯', subtitle: '看看是谁每天在刷擦边视频' },
  { id: 49, color: 'grey', name: '美杜莎', description: '所有人低头倒数123，同时抬头与一人对视，对视的两人需要同时喊出"美杜莎"，喊慢的人或落单的人罚一杯。', subtitle: '听说人之间是有量子纠缠的' },
  { id: 55, color: 'grey', name: '揭底', description: '轮流背圆周率（3.14159265358...）先背不出后面数字的人喝。', subtitle: '九年制义务教育的重要性' },
  { id: 58, color: 'grey', name: '下头', description: '此时此刻正在看手机的所有人喝一杯', subtitle: '专注喝酒！' },
  { id: 60, color: 'grey', name: '指南针', description: '从0-360选一个数字，打开指南针，数字对应方向的人喝一杯。', subtitle: '上北下南左西右东' },
  { id: 68, color: 'grey', name: '眉目暴击', description: '全体低头321抬头，对视成功者立刻拥抱，落单的人喝酒', subtitle: '缘分是随机的' },
  { id: 81, color: 'grey', name: '藏牌搜身', description: '将牌藏在身上，对方30秒内寻找，找不到对方喝，找到你喝', subtitle: '搜证时间' },

  // ==================== 绿色卡牌 ====================
  { id: 2, color: 'green', name: '红包局', description: '在场所有异性玩家喝一杯酒，并添加持卡人的微信。', subtitle: '花钱喊来的，我肯定任性点' },
  { id: 6, color: 'green', name: 'DISS', description: '挑一位前任吐槽，至少要吐槽够五句话，少一句罚一口。', subtitle: '我要DISS你！' },
  { id: 10, color: 'green', name: 'F426', description: '自己喝一杯，指定一人接受大冒险，若他拒绝则需喝四杯', subtitle: '清纯男大得吃的秘密武器' },
  { id: 12, color: 'green', name: '作死', description: '在场玩家轮流往公杯里倒任意酒，抽卡人指定一个游戏大家玩，输的人要喝完公杯内的所有酒', subtitle: '总有人会倒满，活该他自己喝' },
  { id: 13, color: 'green', name: '鱼塘', description: '指定一位玩家在微信聊天记录中搜"宝宝"，搜出一个人，喝一杯。', subtitle: '让你鱼塘那么大' },
  { id: 15, color: 'green', name: '生日快乐', description: '抽到这张卡的人指定一个人当寿星，所有人都可以用生日快乐的理由敬他酒', subtitle: '最怕酒局突然过生日' },
  { id: 16, color: 'green', name: '你&我&他&喝酒', description: '此刻开始，所有人聊天中禁止说"你"、"我"、"他"、"喝"、"酒"这五个字，谁说了就必须喝一杯酒。', subtitle: '可以讲方言和洋文嘛～' },
  { id: 20, color: 'green', name: '禁止吸烟', description: '指定一位玩家今晚禁止抽烟，除非他喝三杯酒或完成一个由持卡人指定的大冒险', subtitle: '我料想你也会喝酒做冒险的' },
  { id: 26, color: 'green', name: '满分激光枪', description: '从抽到本卡的人开始顺时针回答"人生的意义是什么？"，不愿意回答者罚一杯。', subtitle: '这可是以我命名的牌！' },
  { id: 30, color: 'green', name: '短择', description: '这个局如果有自己有好感的人，自己喝一杯', subtitle: '别害羞' },
  { id: 34, color: 'green', name: '头孢', description: '保留本牌，遇到自己喝酒时可以大喊"我吃了头孢"拒绝喝酒，免掉一次喝酒惩罚后本卡作废。', subtitle: '我今天吃了头孢' },
  { id: 40, color: 'green', name: '点兵点将', description: '指定两位玩家换上自己选的情侣头像，发对方照片且置顶在朋友圈，直到今晚酒局结束为止。不愿意的话每人喝两杯酒。', subtitle: '我们总想把必然假装成偶然' },
  { id: 43, color: 'green', name: '发菜', description: '推一个异性的微信名片给在场任意一人，若对方不满意，推荐者喝一杯；若对方满意，则对方喝一杯。', subtitle: '你是菜农还是果农？' },
  { id: 47, color: 'green', name: '红包女', description: '有人喝酒时，你都需大喊"主人请喝好"并陪喝，直到某位"主人"让你下班。', subtitle: '上钟了' },
  { id: 57, color: 'green', name: '大哥', description: '持此牌时，任何人喝酒时，你都可以大喊："我配不配让你多喝一口？"，让他多喝一杯。', subtitle: '大哥是这样的' },
  { id: 77, color: 'green', name: '偏心豁免', description: '所有异性各喝一杯，你可指定一名你喜欢的人免喝', subtitle: '爱就是偏袒' },
  { id: 117, color: 'green', name: '摸鼻陷阱', description: '最后摸鼻子的人喝酒', subtitle: '别眨眼' },

  // ==================== 白色卡牌 ====================
  { id: 14, color: 'white', name: 'SOLO', description: '抽卡人任选一位玩家划拳或吹牛，谁输了喝一杯酒。输者今晚要一直以"妈妈"或"爸爸"称呼对方。', subtitle: '真正的父子局' },
  { id: 17, color: 'white', name: '备胎', description: '盯着一位玩家的眼睛说："做我备胎吧"，把你杯中酒都倒给对方，如果没有杯中酒，则要求对方喝一杯。', subtitle: '可怜的备胎' },
  { id: 24, color: 'white', name: '岔道', description: '选一位玩家，与TA一起喝三杯酒。', subtitle: '总有人出其不意' },
  { id: 29, color: 'white', name: '空降', description: '抽到此牌者喝一杯，可以调换在场所有人的位置，所有被换位置的人都需要喝酒。', subtitle: '她的微信签名是全国可飞' },
  { id: 31, color: 'white', name: 'CP', description: '指定两人为CP坐在一起，若一方喝酒，另一方也必须陪喝。两人若有一方不愿组成CP需喝一口。', subtitle: 'CPDD' },
  { id: 35, color: 'white', name: '大动作', description: '做一个动作，右边的人需要模仿这个动作且再加上一个新的动作，如此向右传递，直到有人做不出来，罚一杯酒。', subtitle: '尺度看你' },
  { id: 36, color: 'white', name: '扩列', description: '添加在场所有人为好友，每加一个人必须夸对方一句，夸不出来或重复罚一口。', subtitle: '希望这个局人不多' },
  { id: 37, color: 'white', name: '男模', description: '所有男生起立假装男模，轮流介绍自己："姓名+籍贯+特色"，女生需要用酒来竞拍他们，没被拍卖出去的男生罚三杯', subtitle: '姐姐好' },
  { id: 39, color: 'white', name: '有礼貌', description: '此刻开始，所有人喝完酒把酒杯放到桌子上时必须说"谢谢"，如果不说"谢谢"，就得再喝一杯酒', subtitle: '做人要有礼貌' },
  { id: 44, color: 'white', name: '养鱼', description: '所有人清掉杯中酒，喝不下的人可以选择向身旁异性撒娇，令对方代喝', subtitle: '别养鱼了！' },
  { id: 45, color: 'white', name: '手机', description: '手机电量低于50%的人喝一杯', subtitle: '该借充电宝了' },
  { id: 46, color: 'white', name: '上头', description: '所有人轮流往一个杯子里倒酒，谁先倒在外面，谁喝完。', subtitle: '轻点倒' },
  { id: 48, color: 'white', name: '接盘', description: '盯着任意一位异性的眼睛对TA说："我玩累了，我们结婚吧！"，未来三杯酒都由对方代喝。', subtitle: '谢谢你老实人' },
  { id: 50, color: 'white', name: '天菜', description: '请用三个词描述这个局上某位朋友，大家来猜你描述的是谁？猜错他们喝，猜对你自己喝。', subtitle: '有没有可能你喜欢的类型刚好在这个局上？' },
  { id: 52, color: 'white', name: '蹭卡', description: '现场找一位异性搭讪，或微信邀请一位异性来喝酒，做不到的话自罚一杯酒', subtitle: '靠你了' },
  { id: 59, color: 'white', name: '组局', description: '除你之外，所有人都需喝一杯。但你需要把在场的大家拉到一个群聊里，发一个手气红包。', subtitle: '组过局的人，才知道照顾大家有多累' },
  { id: 61, color: 'white', name: '暧昧指令官', description: '指定两名玩家组成CP坐在一起，并完成你的任意指令（如公主抱/深蹲等），完不成则各喝一杯', subtitle: '权力一小点，快乐一大堆' },
  { id: 63, color: 'white', name: '错位恋人', description: '指定两名玩家拍一张"看起来像在接吻但没亲到"的错位照片，完不成则各喝一杯', subtitle: '朋友圈诈骗现场' },
  { id: 65, color: 'white', name: '心跳对视', description: '指定两名玩家保持一个拳头距离深情对视，谁先笑或移开视线就输，输的喝一杯', subtitle: '眼神比酒更上头' },
  { id: 67, color: 'white', name: '靠太近了', description: '指定两名玩家面对面缓慢靠近，直到一方喊停，喊停者喝一杯', subtitle: '再近就不礼貌了' },
  { id: 69, color: 'white', name: '指定情侣照', description: '指定两名玩家拍一张由你指定动作的情侣合照，完不成则各喝一杯', subtitle: '摄影师的恶趣味' },
  { id: 70, color: 'white', name: '牵手计时器', description: '指定两名玩家十指紧扣牵手并倒数10秒，差几秒喝几杯', subtitle: '时间从不偏心' },
  { id: 71, color: 'white', name: '拥抱精度测试', description: '指定两名玩家拥抱并一起倒数10秒，误差多少喝多少', subtitle: '抱紧了别抖' },
  { id: 73, color: 'white', name: '闻香识人局', description: '指定一名玩家靠近一位异性闻气味并描述，说不出来喝一杯', subtitle: '嗅觉社交' },
  { id: 78, color: 'white', name: '星座审判', description: '指定一个星座喝一杯并说明理由，场上没有则自己喝两杯', subtitle: '玄学也是学' },
  { id: 79, color: 'white', name: '不心动测谎', description: '轮流分享心动视频，出现心动反应者罚酒', subtitle: '表情管理失败' },
  { id: 83, color: 'white', name: '魅力展示台', description: '指定一人展示自己最有魅力的地方，展示失败喝酒', subtitle: '请开始你的表演' },
  { id: 84, color: 'white', name: '亲密代号', description: '给左边玩家起亲密称呼，10分钟内叫错罚酒', subtitle: '喊错比出轨还严重' },
  { id: 96, color: 'white', name: '力量对决', description: '指定两名玩家扳手腕，输的人喝一杯', subtitle: '酒局健身环节' },
  { id: 106, color: 'white', name: '公杯审判', description: '往公杯倒酒，溢出的喝', subtitle: '早晚有人手抖' },
  { id: 120, color: 'white', name: '谁更可能', description: '倒酒投票，最后干杯', subtitle: '群众的眼睛是雪亮的' },
  { id: 122, color: 'white', name: '团队混战', description: '分队PK，输队全体喝', subtitle: '没有个人英雄' },

  // ==================== 红色卡牌 ====================
  { id: 1, color: 'red', name: '小动作', description: '选择一位异性玩家壁咚五秒钟，若做不到喝一杯。', subtitle: '尺度小吗！' },
  { id: 4, color: 'red', name: '大表哥', description: '选择一位异性玩家，在TA身上做十个俯卧撑，差一个喝一口酒。', subtitle: '不愧是大师兄！' },
  { id: 7, color: 'red', name: '小圈子', description: '所有人坦白自己SM属性，少数派们喝一杯，羞于启齿的也喝一杯', subtitle: '调皮的Brat～' },
  { id: 8, color: 'red', name: '撕纸巾', description: '开始撕纸巾，先传不下去的人喝两杯', subtitle: '暧昧开始了' },
  { id: 9, color: 'red', name: '定心', description: '指定两位玩家隔着本卡片KISS五秒钟，TA们做不到需要每人罚一杯。', subtitle: '希望TA们能定心' },
  { id: 11, color: 'red', name: 'BBS', description: '选择一位异性玩家和对方拥抱大交杯喝一口，做不到罚一杯酒。', subtitle: '抱抱？' },
  { id: 18, color: 'red', name: '大舌头', description: '所有人把舌头伸出来，舌头最短的人罚一杯酒。', subtitle: '别翻白眼' },
  { id: 19, color: 'red', name: 'PDF', description: '指定一人向大家展示相册的最近删除，若TA不愿展示，需要喝两杯', subtitle: '我要给你写PDF了' },
  { id: 22, color: 'red', name: '得吃', description: '把酒倒在自己的锁骨，指定一位玩家喝完，对方不愿意喝需要罚一杯酒。', subtitle: '没锁骨的自己喝' },
  { id: 32, color: 'red', name: 'CRUSH', description: '选择一位玩家把膝盖放到TA脚尖，对方让你喝几杯就喝几杯', subtitle: '沉沦是把主动权给对方' },
  { id: 33, color: 'red', name: '行情', description: '选择一位异性嘴对嘴喂酒，或跟在场所有异性每人碰一杯。', subtitle: '希望有你的行情' },
  { id: 51, color: 'red', name: '海王', description: '所有人打开外卖软件，最近一个月购买过避孕套的人喝。', subtitle: '有点意思' },
  { id: 53, color: 'red', name: '自闭', description: '选择一对异性把他们关进小房间，外面人用手机记时60秒，但不告诉他们。他们需要自己估算时间出来，每早或晚出来10秒钟都要喝一杯酒。', subtitle: '我自闭了！' },
  { id: 54, color: 'red', name: '狗叫', description: '命令一位玩家对另一位玩家发出狗叫10秒钟，不愿需要喝一杯酒', subtitle: '别狗叫了' },
  { id: 56, color: 'red', name: '炸鱼', description: '抽卡人向大家展示微信里"被舔"或"跪舔"的聊天记录，没有则喝一杯。', subtitle: '反正不是我喝' },
  { id: 66, color: 'red', name: '嘴对嘴接力', description: '指定两名玩家嘴对嘴接住你松手的牌，三次都失败则各喝一杯', subtitle: '物理意义上的接盘' },
  { id: 72, color: 'red', name: '锁骨陷阱', description: '指定一名玩家在异性锁骨倒酒并喝完，完不成喝两杯', subtitle: '人体杯具' },
  { id: 92, color: 'red', name: '我猜你不敢', description: '对一名玩家发起"不敢挑战"，拒绝喝两杯，敢就必须做', subtitle: '激将法永不过时' },
  { id: 98, color: 'red', name: '无手喝酒', description: '指定一名玩家不用手喝完一杯酒', subtitle: '人类退化实验' },
  { id: 103, color: 'red', name: '点名倒霉', description: '指定一人连喝两杯并完成大冒险', subtitle: '就是你了' },
  { id: 111, color: 'red', name: '酒量单挑', description: '和一人喝到认输为止', subtitle: '今天必须躺一个' },

  // ==================== 黑色卡牌（地狱模式） ====================
  { id: 74, color: 'black', name: '蒙眼亲判', description: '蒙住一位玩家眼睛，指向他人问"这里亲不亲"，直到答"亲"为止，失败喝两杯', subtitle: '伦理边缘反复横跳' },
  { id: 102, color: 'black', name: '全场工具人', description: '你负责全场倒酒和陪酒，直到下一张出现', subtitle: '冤种轮值制' },
  { id: 118, color: 'black', name: '毒酒轮盘', description: '选到毒酒的人喝完剩余所有酒', subtitle: '总得有个倒霉蛋' },
  { id: 125, color: 'black', name: '同归于尽', description: '你喝多少，全场陪多少', subtitle: '疯子型卡牌' }
];

// 预计算卡牌映射表，提升查找效率 O(1)
const CARD_MAP = CARDS.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {});

module.exports = {
  CARDS,
  CARD_MAP
};
