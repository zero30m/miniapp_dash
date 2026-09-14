/**
 * 二本吻痕 - 卡牌数据
 * 卡牌无固定顺序，随机展示
 */
const CARDS_KISS = [
  { id: 1, name: '侄女', subtitle: 'Straight', description: '所有人打开短视频软件展示于桌前，开始往下滑，连滑5个，每刷到一个LES的视频自己喝一杯。', englishDesc: 'Everyone opens a short-video app, scrolls 5 times. Drink per LGBTQ+ video.' },
  { id: 2, name: '枕头公主', subtitle: 'Pillow Princess', description: '将本卡放在自己面前，任何人喝酒时，你都可以大喊："我可是枕头公主"，让她多喝一杯。', englishDesc: 'When others drink, yell "I\'m a pillow princess!" to add on an additional drink.' },
  { id: 3, name: 'T', subtitle: 'T', description: '所有T起立假装男模，轮流介绍自己："姓名+籍贯+特色"，其他女生需要用酒来竞拍她们，没被拍卖出去的T罚三杯。', englishDesc: 'All T act as male models; others bid with drinks. Unpicked girls take 3 drinks.' },
  { id: 4, name: 'P', subtitle: 'P', description: '所有人清掉杯中酒，喝不下的人可以选择向身旁的人撒娇，令对方代喝。', englishDesc: 'Finish your drink or flirt with the person next to you to make them drink for you.' },
  { id: 5, name: 'H', subtitle: 'Switch', description: '选择一位玩家喝大交杯。', englishDesc: 'Pick someone to do a cross-toast.' },
  { id: 6, name: 'TTL', subtitle: 'TTL', description: '所有人轮流往一个杯子里倒酒，一起进行一个任意游戏，输的人要喝完所有杯中酒。', englishDesc: 'Take turns pouring into a shared cup; loser drinks it all.' },
  { id: 7, name: 'PPL', subtitle: 'PPL', description: '一起玩成语接龙，先接不上的人罚一口。', englishDesc: 'Play idiom chains; first to fail drinks.' },
  { id: 8, name: '侄女装姬', subtitle: 'Straight Actress', description: '所有与该持牌者说话的人都需喝酒。使用三次后报废。', englishDesc: 'Anyone that speaks to this cardholder drinks. (3 uses max.)' },
  { id: 9, name: '姬圈天菜', subtitle: 'Dream Girl', description: '指定任意玩家推一位单身朋友给你，如果照片你满意自己喝一杯，不满意对方喝一杯。', englishDesc: 'Pick someone to share a single friend\'s contact. Drink if you like it; they drink if not.' },
  { id: 10, name: '"姬达"', subtitle: 'Gaydar', description: '添加在场所有玩家微信，并送上一句夸赞对方的话，每新加一个微信，需要喝一口。', englishDesc: 'Add all players on WeChat with a compliment. Drink per every new friend.' },
  { id: 11, name: '二本吻痕', subtitle: 'Second Tier Hickey', description: '在任意玩家身上种下一颗草莓。', englishDesc: 'Leave a hickey on any player.' },
  { id: 12, name: '杜鹃无香', subtitle: 'Regret', description: '轮流分享一段最让自己意难平的经历，没有或不愿意分享者喝一口。', englishDesc: 'Share an unresolved regret or drink.' },
  { id: 13, name: '一本恬静的书', subtitle: 'Quiet Book', description: '每个人轮流分享自己最近读过的一本书，分享不出来的罚一口。', englishDesc: 'Share a recent book you have been reading or drink.' },
  { id: 14, name: '圆形监狱', subtitle: 'Panopticon', description: '抽中此卡的人请所有人一轮酒或今晚的宵夜。', englishDesc: 'Buy a round of drinks or late-night snack for all.' },
  { id: 15, name: '贱斥', subtitle: 'Abjection', description: '不是985&211、QS前100的人罚一口。', englishDesc: 'Non-QS top-100 uni grads drink.' },
  { id: 16, name: '贞德的烈火', subtitle: 'Joan of Arc\'s fire', description: '指定一位玩家做一个大冒险，对方不愿意的话罚两杯酒。', englishDesc: 'Dare a player; if refuses, take 2 drinks.' },
  { id: 17, name: '赛博宣言', subtitle: 'Cyber Manifesto', description: '此时此刻正在看手机的所有人喝一杯。', englishDesc: 'Anyone currently on their phone drinks.' },
  { id: 18, name: '荆棘项链', subtitle: 'Thorn Necklace', description: '用口红在一位玩家脖颈上画画，对方今晚不允许擦掉，如果对方拒绝，需要罚一口酒。', englishDesc: 'Draw on a player\'s neck with lipstick. If refuses, take a drink.' },
  { id: 19, name: '茵纳斯弗利岛', subtitle: 'The Lake Isle of Innisfree', description: '轮流分享自己心中最理想的生活，分享完所有人碰一杯酒。', englishDesc: 'Take turns sharing your ideal life; cheers after.' },
  { id: 20, name: '白裙子', subtitle: 'White Dress', description: '轮流分享，什么时候发现自己是LES的？侄女或不愿意分享者喝一口。', englishDesc: 'Share coming-out story. Straight/unwilling drink.' },
  { id: 21, name: '恶之花', subtitle: 'The Flowers of Evil', description: '除你之外，所有人都喝一口酒。', englishDesc: 'Everyone but you drinks.' },
  { id: 22, name: '绿康乃馨', subtitle: 'Green Carnation', description: '抽中此卡的人轮流闻所有人身上的香水味，只要猜中一款，所有人都要喝酒。一款都没猜中，自己喝酒。', englishDesc: 'Guess everyone\'s perfumes. Everyone drinks if you make 1 correct guess, otherwise you drink.' },
  { id: 23, name: '贝雅特丽齐', subtitle: 'Beatrice', description: '如果在场有你心动的人，你自己喝一口。', englishDesc: 'Drink if you have a crush here.' },
  { id: 24, name: '后翼弃兵', subtitle: 'Queen\'s Gambit', description: '抽到本卡的要分别介绍在场所有朋友，记不住名字或介绍有误自己喝一杯。', englishDesc: 'Introduce everyone here. Drink if you make a mistake.' },
  { id: 25, name: '午夜真心人', subtitle: 'Midnight Confessor', description: '轮流介绍自己（性格、职业、家庭、爱好），不愿意介绍的罚一口。', englishDesc: 'Self-intro (traits/job/hobbies). Those unwilling take a drink.' },
  { id: 26, name: '钟形罩', subtitle: 'The Bell Jar', description: '选择一对玩家把她们关进小房间，外面人用手机记时60秒，但不告诉她们。她们需要自己估算时间出来，每早或晚出来2秒钟都要喝一杯酒。', englishDesc: 'Lock 2 players in a room; they have to come out in 60s. Every ±2s equals 1 drink.' },
  { id: 27, name: '曼德尔布罗特的海岸线', subtitle: 'Mandelbrot\'s Coastline', description: '指定一位玩家给所有人展示备忘录的前五页，如果她不愿意展示，则罚一杯酒。', englishDesc: 'Show memo\'s first 5 pages. If refuse, take a drink.' },
  { id: 28, name: '不要未来', subtitle: 'No Future', description: '指定两位玩家换上自己选的情侣头像，在朋友圈发对方照片。不愿意的话她们喝两杯酒。', englishDesc: 'Pick 2 players to set couple profile pics and post on Wechat.' },
  { id: 29, name: '特斯拉的鸽子', subtitle: 'Tesla\'s Pigeon', description: '轮流分享自己正在养或想要养的宠物，分享完所有人碰一杯酒。', englishDesc: 'Take turns sharing your pets; cheers after.' },
  { id: 30, name: '永劫回归', subtitle: 'Eternal Recurrence', description: '做一个动作，右边的人需要模仿这个动作且再加上一个新的动作，如此向右传递，直到有人做不出来。', englishDesc: 'Copy and add new actions based on the previous person.' },
  { id: 31, name: '波伏娃的苹果', subtitle: 'Beauvoir\'s Apple', description: '把酒倒在自己的锁骨，指定一位玩家喝完，对方不愿意喝需要罚一杯酒。', englishDesc: 'Pour drink on collarbone; pick someone to lick.' },
  { id: 32, name: '布尔乔亚的蜘蛛', subtitle: 'Bourgeois\' Spider', description: '指定一位玩家拥抱另一位玩家，在她耳边表白。如若有一方不愿需要罚一口酒。', englishDesc: 'Pick a player to hug and whisper love confession to another player.' },
  { id: 33, name: '莫里索的扇子', subtitle: 'Morisot\'s Fan', description: '捂住任意玩家的眼睛，轮流指别的玩家，问她喝不喝？如果她说喝，被指向的玩家就要喝酒。', englishDesc: 'Blindfold; ask "Drink?" If yes, pointed player drinks.' },
  { id: 34, name: '阿布拉莫维奇的凝视', subtitle: 'Abramović\'s Gaze', description: '挑选一位玩家壁咚，掐住她的脖子，喂她喝完一口酒。', englishDesc: 'Kabedon and throat-hold to feed a drink.' },
  { id: 35, name: '欧姬芙的鸢尾', subtitle: 'O\'Keeffe\'s Iris', description: '指定一位玩家向大家展示相册的最近删除，如果她不愿意展示罚一杯酒。', englishDesc: 'Show recently deleted photos. Refusal equals a drink.' },
  { id: 36, name: '西苏的美杜莎', subtitle: 'Cixous\' Medusa', description: '所有人低头倒数123，同时抬头与一人对视，对视的两人需要同时喊出"美杜莎"，喊慢的人或落单的人罚一杯。', englishDesc: 'Count 123 and look a person, whoever locks eyes, yell "Medusa." Slower one drink.' },
  { id: 37, name: '包法利夫人的毒药', subtitle: 'Madame Bovary\'s Poison', description: '轮流回答上次哭是因为什么？不愿意回答的人罚一口酒。', englishDesc: 'Share the last time you cried.' },
  { id: 38, name: '伊丽莎白的十四行', subtitle: 'Elizabeth\'s Sonnets', description: '选择一位玩家嘴对嘴喂酒，或跟在场所有玩家每人碰一杯。', englishDesc: 'Mouth-to-mouth feed or take a one drink each with all.' },
  { id: 39, name: '达摩克利斯之剑', subtitle: 'Sword of Damocles', description: '在场玩家轮流往公杯里倒任意酒，抽卡人指定一个游戏大家玩，输的人要喝完公杯内的所有酒。', englishDesc: 'Pour into shared cup and play a game; loser drinks it all.' },
  { id: 40, name: '费马大定理', subtitle: 'Fermat\'s Last Theorem', description: '开始逢七过，数到7或7的倍数时需拍手喊"过"，出错者喝酒。', englishDesc: 'Play 7-clap. The one that messes up drinks.' },
  { id: 41, name: '薛定谔的猫箱', subtitle: 'Schrödinger\'s catbox', description: '把一个纸团随意藏在手里，让大家猜在哪只手里，猜错的人喝。', englishDesc: 'Guess hand with paper ball. Those that picks the wrong hand drink.' },
  { id: 42, name: '拉格朗日点', subtitle: 'Lagrange Point', description: '公主抱一位玩家，抱的过程她要喂你喝完一小杯酒。', englishDesc: 'Carry someone up while they feed you a drink.' },
  { id: 43, name: '杜拉斯的酩酊', subtitle: 'Duras\' Intoxication', description: '选择一位玩家隔着本卡KISS五秒钟，做不到罚一杯酒。', englishDesc: 'Kiss through card for 5s. If fails, take a drink.' },
  { id: 44, name: '美狄亚的金羊毛', subtitle: 'Medea\'s Golden Fleece', description: '倒一杯酒，留给下一张卡牌指定喝酒的玩家喝。', englishDesc: 'Pour a drink for next card\'s target.' },
  { id: 45, name: '安妮·李斯特的密码日记', subtitle: 'Anne Lister\'s Coded Diaries', description: '轮流向右边的人悄悄问一个问题，被问的人必须大声说出答案。若有人想知道问题是什么，需要拿一杯酒来买。', englishDesc: 'Whisper question to right; answer aloud. Buy question with drink.' },
  { id: 46, name: '伍尔夫的墨水渍', subtitle: 'Woolf\'s Inkblot', description: '拿一个冰块轮流在手里传递，冰块在谁手上融化，谁就要喝一杯。', englishDesc: 'Pass ice cube. Whoever completely melts the cube drinks.' },
  { id: 47, name: '芝加哥的晚宴桌', subtitle: 'Chicago\'s Dinner Party', description: '轮流分享人生中让自己最有成就感的事，分享后一起碰杯。', englishDesc: 'Share proudest life moment; cheers.' },
  { id: 48, name: '烦人的爱', subtitle: 'Troublesome Love', description: '有人喝酒时，你都需大喊"妈妈请喝好"并陪喝，直到某位"妈妈"让你下班。', englishDesc: 'Yell "Mom, enjoy!" + drink with others until "mom" releases you.' },
  { id: 49, name: '黑色皮革', subtitle: 'Black Leather', description: '轮流分享近来让自己最最愤怒的一件事，分享完所有人碰一杯酒。', englishDesc: 'Share recent rage; cheers after.' },
  { id: 50, name: '坎普美学', subtitle: 'Camp Aesthetics', description: '所有人轮流往一个杯子里倒酒，谁先倒在外面，谁喝完。', englishDesc: 'Take turns pouring into cup; whoever spills take a drink.' },
  { id: 51, name: '莎乐美的银盘', subtitle: 'Salome\'s Silver Platter', description: '从0-360选一个数字，打开指南针，数字对应方向的人喝一杯。', englishDesc: 'Pick a number between 0-360; corresponding compass direction drinks.' },
  { id: 52, name: '桑塔格的相机', subtitle: 'Sontag\'s Camera', description: '抽到此牌的玩家可随时喊"照相机"，所有人需静止五秒，最先移动者喝酒，若五秒内无人动则此牌作废。', englishDesc: 'Yell "Camera!" to freeze. First mover drinks.' },
  { id: 53, name: '寂静的春天', subtitle: 'Silent Spring', description: '三轮游戏内，禁止说"你"、"我"、"她"、"喝"、"酒"这五个字，说的人罚一口酒。', englishDesc: 'Ban "you/me/her/drink/alcohol" for 3 rounds. Take a drink whenever one fails.' },
  { id: 54, name: '分析机笔记', subtitle: 'Analytical Engine Notes', description: '打出计算器，打出"错误"，最晚一个打出错误的罚一口酒。提示：苹果手机用任意数字除以零即可打出错误。', englishDesc: 'Type "Error" on calculator. Slowest drinks. (Tip: Divide by zero.)' },
  { id: 55, name: '艾米莉的白手套', subtitle: 'Emily\'s White Gloves', description: '用嘴唇在任意玩家后脖写一个七笔以内的字，她猜不出来的话你们同时喝一杯。', englishDesc: 'Lip-write a character on neck. If fail, both drink.' },
  { id: 56, name: '萨冈的忧郁', subtitle: 'Sagan\'s Melancholy', description: '所有人轮流分享自己种草的商品，分享完所有人碰一杯酒。', englishDesc: 'Share wishlist items; cheers.' },
  { id: 57, name: '恋人絮语', subtitle: 'Lover\'s Discourse', description: '指定两位玩家为CP，今晚一方喝酒时另一方必须陪喝。', englishDesc: 'Pair 2 as a couple; they have to drink together when someone has to drink.' },
  { id: 58, name: '释放蜂群', subtitle: 'Release the Swarm', description: '把今晚所有玩家拉到一个微信群内，发一个手气红包，手气最差的人喝一杯。', englishDesc: 'Make a group chat and send a red pocket; worst luck drinks.' },
  { id: 59, name: '玛格丽特的烟斗', subtitle: 'Magritte\'s Pipe', description: '指定一位玩家今晚禁止抽烟，除非她喝一杯酒或完成一个由持卡人指定的大冒险。没人抽烟则随意指定一位玩家喝一口。', englishDesc: 'Ban one person smoking unless do a drink and dare.' },
  { id: 60, name: '满分激光枪', subtitle: 'Life', description: '轮流回答：人生的意义是什么？', englishDesc: 'Answer: "Meaning of life?"' }
];

// 预计算卡牌映射表
const CARD_MAP_KISS = CARDS_KISS.reduce((acc, card) => {
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
  CARDS_KISS,
  CARD_MAP_KISS,
  shuffleArray
};


