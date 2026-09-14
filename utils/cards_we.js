/**
 * 不是陌生人 - 卡牌数据
 * Fixed Titles
 */
const CARDS_WE = [
  {
    "id": 1,
    "name": "改变想法",
    "subtitle": "We're Not Strangers",
    "description": "我是否在任何事情上改变了你的想法？",
    "englishDesc": "Have I Changed Your Mind About Anything?"
  },
  {
    "id": 2,
    "name": "最惊讶的",
    "subtitle": "We're Not Strangers",
    "description": "在整个游戏中，我的哪个回答最让你感到惊讶（如果有的话）？",
    "englishDesc": "What Answer Of Mine Surprised You The Most Throughout This Game, If Any?"
  },
  {
    "id": 3,
    "name": "年度目标",
    "subtitle": "We're Not Strangers",
    "description": "今年你实现哪个目标会感觉最好？我如何能在这方面支持你？",
    "englishDesc": "What Goal Would Feel Best For You To Accomplish This Year? How Can I Support You In That?"
  },
  {
    "id": 4,
    "name": "唯一的人",
    "subtitle": "We're Not Strangers",
    "description": "完成句子：你是唯一一个我可以一起____的人。",
    "englishDesc": "Finish The Sentence: You're The Only Person I Can ____ With."
  },
  {
    "id": 5,
    "name": "见物如人",
    "subtitle": "We're Not Strangers",
    "description": "有什么东西会让你想起我？",
    "englishDesc": "What's Something That Reminds You Of Me?"
  },
  {
    "id": 6,
    "name": "关系意图",
    "subtitle": "We're Not Strangers",
    "description": "写下你对我们这段关系的意图。进行比较。",
    "englishDesc": "Write Down Your Intention For Our Relationship. Compare."
  },
  {
    "id": 7,
    "name": "亲密时刻",
    "subtitle": "We're Not Strangers",
    "description": "你什么时候觉得我们最亲近？我们在做什么？",
    "englishDesc": "When Do You Feel Closest To Me? What Are We Doing?"
  },
  {
    "id": 8,
    "name": "心烦意乱",
    "subtitle": "We're Not Strangers",
    "description": "当你心烦意乱时，你最需要什么？",
    "englishDesc": "When You're Upset, What Do You Need Most?"
  },
  {
    "id": 9,
    "name": "从未问过",
    "subtitle": "We're Not Strangers",
    "description": "问你的伙伴一个你以前从未问过他们的问题。",
    "englishDesc": "Ask Your Partner Something You've Never Asked Them Before."
  },
  {
    "id": 10,
    "name": "友谊回忆",
    "subtitle": "We're Not Strangers",
    "description": "画出你最喜欢的一段友谊回忆。30秒。进行比较。",
    "englishDesc": "Draw One Of Your Favorite Memories Of Our Friendship. 30 Seconds. Compare."
  },
  {
    "id": 11,
    "name": "遇到困难",
    "subtitle": "We're Not Strangers",
    "description": "下次我遇到困难时，你希望我记住什么？",
    "englishDesc": "What Do You Want Me To Remember The Next Time I'm Having A Hard Day?"
  },
  {
    "id": 12,
    "name": "维系友谊",
    "subtitle": "We're Not Strangers",
    "description": "是什么让我们的友谊得以维系？",
    "englishDesc": "What Makes Our Friendship Work?"
  },
  {
    "id": 13,
    "name": "未知之事",
    "subtitle": "We're Not Strangers",
    "description": "关于我，你是否还有什么不知道但希望知道的事情？",
    "englishDesc": "Is There Anything You Still Don't Know About Me That You Wish You Did?"
  },
  {
    "id": 14,
    "name": "停止道歉",
    "subtitle": "We're Not Strangers",
    "description": "有什么事情是你应该停止道歉的？",
    "englishDesc": "What's Something Should Stop Apologizing For?"
  },
  {
    "id": 15,
    "name": "想起我",
    "subtitle": "We're Not Strangers",
    "description": "哪首歌会让你想起我？",
    "englishDesc": "What Song Makes You Think Of Me?"
  },
  {
    "id": 16,
    "name": "引以为傲",
    "subtitle": "We're Not Strangers",
    "description": "对于我们的关系，你最引以为傲的是什么？",
    "englishDesc": "What About Our Relationship Are You Proudest Of?"
  },
  {
    "id": 17,
    "name": "自我肯定",
    "subtitle": "We're Not Strangers",
    "description": "我没有给自己足够肯定的地方是什么？",
    "englishDesc": "What Don't I Give Myself Enough Credit For?"
  },
  {
    "id": 18,
    "name": "变得更好",
    "subtitle": "We're Not Strangers",
    "description": "我们的友谊如何让你变得更好？",
    "englishDesc": "How Has Our Friendship Charged You For The Better?"
  },
  {
    "id": 19,
    "name": "相互补充",
    "subtitle": "We're Not Strangers",
    "description": "我们的不同之处是如何相互补充的？",
    "englishDesc": "In What Ways Do Our Differences Complement Each Other?"
  },
  {
    "id": 20,
    "name": "自我认知",
    "subtitle": "We're Not Strangers",
    "description": "你希望我能从自己身上看到什么你从我身上看到的东西？",
    "englishDesc": "What Do You Wish I Could See In Myself That You See In Me?"
  },
  {
    "id": 21,
    "name": "心领神会",
    "subtitle": "We're Not Strangers",
    "description": "关于你，有什么是我“心领神会”的？",
    "englishDesc": "What Is Something That I Just \"get\" About You?"
  },
  {
    "id": 22,
    "name": "共同度过",
    "subtitle": "We're Not Strangers",
    "description": "我们一起度过了什么让你最引以为傲的事情？",
    "englishDesc": "What Are You Proudest Of Us For Getting Through Together?"
  },
  {
    "id": 23,
    "name": "最珍视的",
    "subtitle": "We're Not Strangers",
    "description": "对于我们的友谊，你最珍视的一点是什么？",
    "englishDesc": "What's One Thing You Cherish About Our Friendship?"
  },
  {
    "id": 24,
    "name": "无意帮助",
    "subtitle": "We're Not Strangers",
    "description": "我是如何在没有意识到的情况下帮助了你？",
    "englishDesc": "How Have I Helped You Without Realizing?"
  },
  {
    "id": 25,
    "name": "重大胜利",
    "subtitle": "We're Not Strangers",
    "description": "你上一次取得重大胜利是什么时候？我们如何庆祝？",
    "englishDesc": "When Was The Last Time You Had A Big Win? How Can We Celebrate?"
  },
  {
    "id": 26,
    "name": "保护欲",
    "subtitle": "We're Not Strangers",
    "description": "你什么时候对我感觉最有保护欲？",
    "englishDesc": "When Do You Feel Most Protective Over Me?"
  },
  {
    "id": 27,
    "name": "理所当然",
    "subtitle": "We're Not Strangers",
    "description": "我们过去认为理所当然的事情是什么？现在我们可能认为理所当然的事情是什么？",
    "englishDesc": "What's Something We Used To Take For Granted? What's Something We Could Be Taking For Granted Now?"
  },
  {
    "id": 28,
    "name": "诚实建议",
    "subtitle": "We're Not Strangers",
    "description": "你最需要关于什么的、极其诚实的建议？",
    "englishDesc": "What Do You Need Brutally Honest Advice About?"
  },
  {
    "id": 29,
    "name": "摆脱成长",
    "subtitle": "We're Not Strangers",
    "description": "你认为我正在摆脱什么？你认为我正在成长为什么？",
    "englishDesc": "What Do You Think I'm Growing Out Of? What Do You Think I'm Growing Into?"
  },
  {
    "id": 30,
    "name": "兴奋成长",
    "subtitle": "We're Not Strangers",
    "description": "你最近在我身上看到了哪些令人兴奋的成长？",
    "englishDesc": "What Growth Have You Seen In Me Recently That's Been Exciting To Watch?"
  },
  {
    "id": 31,
    "name": "感谢理解",
    "subtitle": "We're Not Strangers",
    "description": "感谢你对我____的理解。",
    "englishDesc": "Thank You For Being Understanding Of My ____."
  },
  {
    "id": 32,
    "name": "相互赋能",
    "subtitle": "We're Not Strangers",
    "description": "我们是如何相互赋能的？未来我们如何能更好地相互督促？",
    "englishDesc": "In What Ways Do We Enable Each Other? How Can We Hold Each Other Accountable Moving Forward?"
  },
  {
    "id": 33,
    "name": "幸运时刻",
    "subtitle": "We're Not Strangers",
    "description": "你上一次觉得自己很幸运能成为我的朋友是什么时候？",
    "englishDesc": "When Was The Last Time You Felt Lucky To Be My Friend?"
  },
  {
    "id": 34,
    "name": "超能力",
    "subtitle": "We're Not Strangers",
    "description": "作为朋友，我的超能力是什么？",
    "englishDesc": "What's My Superpower As A Friend?"
  },
  {
    "id": 35,
    "name": "变化与否",
    "subtitle": "We're Not Strangers",
    "description": "你看到我随着时间发生了哪些变化？又有哪些是完全没有改变的？",
    "englishDesc": "How Have You Seen Me Change Over Time? What Hasn't Changed At All?"
  },
  {
    "id": 36,
    "name": "提高标准",
    "subtitle": "We're Not Strangers",
    "description": "我们的友谊如何提高了你对其他所有人的标准？",
    "englishDesc": "How Has Our Friendship Raised Your Standards For All The Rest?"
  },
  {
    "id": 37,
    "name": "经历困难",
    "subtitle": "We're Not Strangers",
    "description": "当你经历困难时，我能为你提供的最好的支持方式是什么？",
    "englishDesc": "What's The Best Way I Can Show Up For You When You're Going Through It?"
  },
  {
    "id": 38,
    "name": "游戏收获",
    "subtitle": "We're Not Strangers",
    "description": "在这次游戏中，你学到了什么对我们的友谊有帮助？",
    "englishDesc": "What Did You Learn During This Game Feels Helpful For Our Friendship?"
  },
  {
    "id": 39,
    "name": "永远依赖",
    "subtitle": "We're Not Strangers",
    "description": "有什么事情是你永远可以依赖我的？",
    "englishDesc": "What's Something You Can Always Rely On Me For?"
  },
  {
    "id": 40,
    "name": "敞开心扉",
    "subtitle": "We're Not Strangers",
    "description": "你最难向我敞开心扉的事情是什么？是什么让你感到安全？",
    "englishDesc": "What Was Hardest For You To Open Up To Me About? What Made You Feel Safe?"
  },
  {
    "id": 41,
    "name": "自我发现",
    "subtitle": "We're Not Strangers",
    "description": "完成句子：你让我看到了关于我自己的____。",
    "englishDesc": "Finish The Sentence: You've Shown Me ____ About Myself."
  },
  {
    "id": 42,
    "name": "采纳理念",
    "subtitle": "We're Not Strangers",
    "description": "我的哪个理念是你想要采纳的？",
    "englishDesc": "What's A Philosophy Of Mine That You'd Like To Adopt?"
  },
  {
    "id": 43,
    "name": "启发习惯",
    "subtitle": "We're Not Strangers",
    "description": "我的哪个习惯让你受到启发？",
    "englishDesc": "What's A Habit Of Mine That You're Inspired By?"
  },
  {
    "id": 44,
    "name": "需要听到",
    "subtitle": "We're Not Strangers",
    "description": "你认为我现在需要听到什么？",
    "englishDesc": "What Do You Think I Need To Hear Right Now?"
  },
  {
    "id": 45,
    "name": "如果不是你",
    "subtitle": "We're Not Strangers",
    "description": "完成句子：如果不是你，我就会。",
    "englishDesc": "Finish The Sentence: If It Weren't For You I'd ."
  },
  {
    "id": 46,
    "name": "内部笑话",
    "subtitle": "We're Not Strangers",
    "description": "我们之间哪个内部笑话永远不会过时？",
    "englishDesc": "What Inside Joke Of Ours Will Never Stop Being Funny?"
  },
  {
    "id": 47,
    "name": "自我肯定",
    "subtitle": "We're Not Strangers",
    "description": "有什么事情是我没有给自己足够肯定的？",
    "englishDesc": "What's Something I Dont Give Myself Enough Credit For?"
  },
  {
    "id": 48,
    "name": "肯定语",
    "subtitle": "We're Not Strangers",
    "description": "写下一句你需要听到的肯定语。折叠并交换。在你最需要的时候打开。",
    "englishDesc": "Write An Affirmation You Need To Hear. Fold And Exchange. Open When You Need It Most."
  },
  {
    "id": 49,
    "name": "友谊意图",
    "subtitle": "We're Not Strangers",
    "description": "两位玩家都为你们的友谊设定一个意图。进行比较。",
    "englishDesc": "Both Players Set An Intention For Your Friendship. Compare."
  },
  {
    "id": 50,
    "name": "朋友约会",
    "subtitle": "We're Not Strangers",
    "description": "计划一次朋友约会。坚持执行！",
    "englishDesc": "Plan A Friend Date. Stick To It!"
  },
  {
    "id": 51,
    "name": "梦想派对",
    "subtitle": "We're Not Strangers",
    "description": "为我策划一个梦想派对。主题是什么？有哪些人？",
    "englishDesc": "Plan A Dream Party For Me. What's The Theme? Who's There?"
  },
  {
    "id": 52,
    "name": "为你骄傲",
    "subtitle": "We're Not Strangers",
    "description": "两位玩家，完成句子：我为你____感到非常骄傲。",
    "englishDesc": "Both Players, Finish The Sentence: I'm So Proud Of You For ____."
  },
  {
    "id": 53,
    "name": "微笑回忆",
    "subtitle": "We're Not Strangers",
    "description": "写下一个我们共同拥有的、让你微笑的回忆。谈论它。30秒。",
    "englishDesc": "Write Down A Memory We Share Together That Makes You Smile. Talk About It. 30 Seconds."
  },
  {
    "id": 54,
    "name": "看待自己",
    "subtitle": "We're Not Strangers",
    "description": "以你最好的朋友看待你的方式看待自己。",
    "englishDesc": "View Yourself The Way Your Best Friend Does."
  },
  {
    "id": 55,
    "name": "从未问过",
    "subtitle": "We're Not Strangers",
    "description": "问一个你以前从未问过的问题。",
    "englishDesc": "Ask A Question You've Never Asked Before."
  },
  {
    "id": 56,
    "name": "自拍回忆",
    "subtitle": "We're Not Strangers",
    "description": "拍一张自拍。保存下来作为回忆。",
    "englishDesc": "Take A Selfie. Save It For Memories."
  },
  {
    "id": 57,
    "name": "限制信念",
    "subtitle": "We're Not Strangers",
    "description": "你认为哪个限制性信念最阻碍我？",
    "englishDesc": "What Limiting Belief Do You Think Is Holding Me Back The Most?"
  },
  {
    "id": 58,
    "name": "好的朋友",
    "subtitle": "We're Not Strangers",
    "description": "你不需要很多最好的朋友。只需要对的人。",
    "englishDesc": "You Dont Need A Lot Of Besties. Just The Right Ones."
  },
  {
    "id": 59,
    "name": "我的风格",
    "subtitle": "We're Not Strangers",
    "description": "我的风格中有什么是毋庸置疑地属于我的？",
    "englishDesc": "Why About My Style Is Undeniably Me?"
  },
  {
    "id": 60,
    "name": "理想约会",
    "subtitle": "We're Not Strangers",
    "description": "从头到尾描述我理想中的第一次约会。",
    "englishDesc": "Describe My Ideal First Date From Start To Finish."
  },
  {
    "id": 61,
    "name": "痴迷",
    "subtitle": "We're Not Strangers",
    "description": "你认为我强烈不喜欢的大多数人却痴迷的东西是什么？",
    "englishDesc": "What Do You Think I Strongly Dislike That Most People Obsess Over?"
  },
  {
    "id": 62,
    "name": "迟到借口",
    "subtitle": "We're Not Strangers",
    "description": "如果我迟到了，最有可能的借口是什么？",
    "englishDesc": "If I'm Running Late, What's Most Likely To Be My Excuse?"
  },
  {
    "id": 63,
    "name": "激发",
    "subtitle": "We're Not Strangers",
    "description": "你认为我生命中谁能激发我最好的一面？",
    "englishDesc": "Who In My Life Do You Think Brings Out The Best In Me?"
  },
  {
    "id": 64,
    "name": "无聊",
    "subtitle": "We're Not Strangers",
    "description": "有什么事情我可以连续做几个小时而不会感到无聊？",
    "englishDesc": "What's Something I Could Do For Hours On End Without Getting Bored?"
  },
  {
    "id": 65,
    "name": "伴侣数量",
    "subtitle": "We're Not Strangers",
    "description": "你认为我睡过多少人？",
    "englishDesc": "How Many People Do You Think I've Slept With?"
  },
  {
    "id": 66,
    "name": "望而生畏",
    "subtitle": "We're Not Strangers",
    "description": "我身上有什么是最令人望而生畏的（如果有的话）？",
    "englishDesc": "What About Me Is Most Intimidating, If Anything?"
  },
  {
    "id": 67,
    "name": "最亲近者",
    "subtitle": "We're Not Strangers",
    "description": "你认为我最亲近的人是谁（除了你）？",
    "englishDesc": "Who Do You Think I'm Closest To (besides You)?"
  },
  {
    "id": 68,
    "name": "最近所想",
    "subtitle": "We're Not Strangers",
    "description": "你认为我最近大部分时间都在想什么？在想谁？",
    "englishDesc": "What Do You Think I Spend Most Of My Time Thinking About These Days? On Who?"
  },
  {
    "id": 69,
    "name": "第一印象",
    "subtitle": "We're Not Strangers",
    "description": "你对我的第一印象是什么？了解我之后，什么让你感到惊讶？",
    "englishDesc": "What Was Your First Impression Of Me? What Surprised You After Getting To Know Me?"
  },
  {
    "id": 70,
    "name": "最大伤害",
    "subtitle": "We're Not Strangers",
    "description": "你认为我过去哪个习惯对我伤害最大？",
    "englishDesc": "Which One Of My Past Habits Do You Think Was The Hardest On Me?"
  },
  {
    "id": 71,
    "name": "约会穿着",
    "subtitle": "We're Not Strangers",
    "description": "第一次约会我最有可能穿什么衣服？说具体点。",
    "englishDesc": "What Outfit Am I Most Likely To Wear On A First Date? Get Specific."
  },
  {
    "id": 72,
    "name": "疯狂夜晚",
    "subtitle": "We're Not Strangers",
    "description": "想象我刚从一个疯狂的夜晚醒来。我最后在哪里？我后悔什么？",
    "englishDesc": "Imagine I Just Woke Up From A Crazy Night Out. Where Did I End Up? What Do I Regret?"
  },
  {
    "id": 73,
    "name": "网络追踪",
    "subtitle": "We're Not Strangers",
    "description": "你认为我上一个在 Instagram 上“跟踪”的人是谁？我在找什么？",
    "englishDesc": "Who Do You Think Was The Last Person I Stalked On Instagram? What Was I Looking For?"
  },
  {
    "id": 74,
    "name": "低容忍度",
    "subtitle": "We're Not Strangers",
    "description": "我对人们的什么行为容忍度很低？",
    "englishDesc": "What Do I Have A Low Tolerance For In People?"
  },
  {
    "id": 75,
    "name": "爱情篇章",
    "subtitle": "We're Not Strangers",
    "description": "从你的角度来看，我爱情生活的这一章会叫什么名字？",
    "englishDesc": "From Your Perspective, What Would This Chapter Of My Love Life Be Called?"
  },
  {
    "id": 76,
    "name": "常点饮品",
    "subtitle": "We're Not Strangers",
    "description": "我最常点的饮品是什么？我的酒量上限是多少？",
    "englishDesc": "What's My Go-to Drink Order? What Is My Limit?"
  },
  {
    "id": 77,
    "name": "安慰食物",
    "subtitle": "We're Not Strangers",
    "description": "在我度过了特别艰难的一天后，你会给我带什么食物？",
    "englishDesc": "What Food Are You Bringing Me After A Particularly Hard Day?"
  },
  {
    "id": 78,
    "name": "取消计划",
    "subtitle": "We're Not Strangers",
    "description": "在我们之间，谁最有可能在最后一刻取消计划？",
    "englishDesc": "Between Us, Who's Most Likely To Cancel Plans Last Minute?"
  },
  {
    "id": 79,
    "name": "性尴尬",
    "subtitle": "We're Not Strangers",
    "description": "从1到10分，你认为我在性方面有多尴尬？",
    "englishDesc": "On A Scale Of 1-10, How Sexually Awkward Do You Think I Am?"
  },
  {
    "id": 80,
    "name": "如鱼得水",
    "subtitle": "We're Not Strangers",
    "description": "你认为我什么时候最如鱼得水（状态最好）？我在做什么？我和谁在一起？",
    "englishDesc": "When Do You Think I Am Most In My Element? What Am I Doing? Who Am I With?"
  },
  {
    "id": 81,
    "name": "得心应手",
    "subtitle": "We're Not Strangers",
    "description": "你认为对我来说很容易，但对别人来说很难的事情是什么？",
    "englishDesc": "What Do You Think Comes Easily To Me That's Hard For Others?"
  },
  {
    "id": 82,
    "name": "最爱短信",
    "subtitle": "We're Not Strangers",
    "description": "你最喜欢收到我发的哪种短信？",
    "englishDesc": "What's Your Favorite Text To Receive From Me?"
  },
  {
    "id": 83,
    "name": "意想不到",
    "subtitle": "We're Not Strangers",
    "description": "关于我，人们最意想不到的是什么？",
    "englishDesc": "What About Me Would People Least Expect?"
  },
  {
    "id": 84,
    "name": "敏感之处",
    "subtitle": "We're Not Strangers",
    "description": "你认为我对什么很敏感？",
    "englishDesc": "What Do You Think I'm Sensitive To?"
  },
  {
    "id": 85,
    "name": "最合得来",
    "subtitle": "We're Not Strangers",
    "description": "你认为我其他朋友中，谁和我最合得来？请解释。",
    "englishDesc": "Which One Of My Other Friends Do You Think Is Most Compatible With? Explain."
  },
  {
    "id": 86,
    "name": "初见细节",
    "subtitle": "We're Not Strangers",
    "description": "关于我们第一次见面，你记得的哪个小细节？",
    "englishDesc": "What's One Small Detail You Remember About The First Time We Met?"
  },
  {
    "id": 87,
    "name": "起床时间",
    "subtitle": "We're Not Strangers",
    "description": "你认为我平均每天什么时候醒来？不要解释。",
    "englishDesc": "When Do You Think I Wake Up On An Average Day? Don't Explain."
  },
  {
    "id": 88,
    "name": "错误假设",
    "subtitle": "We're Not Strangers",
    "description": "你对我做出的哪个假设与事实相去甚远？",
    "englishDesc": "What Assumption Did You Make About Me That Was Furthest From The Truth?"
  },
  {
    "id": 89,
    "name": "补水狂人",
    "subtitle": "We're Not Strangers",
    "description": "我们俩谁是更注重补水的朋友？",
    "englishDesc": "Who's The More Hydrated Friend?"
  },
  {
    "id": 90,
    "name": "别叫上我",
    "subtitle": "We're Not Strangers",
    "description": "有什么是你喜欢但知道不该邀请我参加的？",
    "englishDesc": "What's Something You Love But Know Not To Invite Me To?"
  },
  {
    "id": 91,
    "name": "内心独白",
    "subtitle": "We're Not Strangers",
    "description": "你认为我现在有多少“内心独白”？",
    "englishDesc": "How Many Inner Texts Do You Think I Have Right Now?"
  },
  {
    "id": 92,
    "name": "电影海报",
    "subtitle": "We're Not Strangers",
    "description": "如果我的墙上有一张电影海报，会是哪一张？",
    "englishDesc": "If I Had A Movie Poster On My Wall, Which Would It Be?"
  },
  {
    "id": 93,
    "name": "偶遇地点",
    "subtitle": "We're Not Strangers",
    "description": "你最有可能在哪里偶遇我？",
    "englishDesc": "Where Are You Most Likely To Run Into Me?"
  },
  {
    "id": 94,
    "name": "朋友共性",
    "subtitle": "We're Not Strangers",
    "description": "你认为我的朋友圈有什么共同点？",
    "englishDesc": "What Do You Think My Circle Of Friends Have In Common?"
  },
  {
    "id": 95,
    "name": "社媒印象",
    "subtitle": "We're Not Strangers",
    "description": "你认为陌生人根据我的社交媒体对我做出了什么判断？",
    "englishDesc": "Do You Think What Strangers Make About Me Based Off Of My Social Media?"
  },
  {
    "id": 96,
    "name": "互相吸引",
    "subtitle": "We're Not Strangers",
    "description": "是什么让你被我吸引，想和我做朋友？",
    "englishDesc": "What Made You Gravitate Towards Me As A Friend?"
  },
  {
    "id": 97,
    "name": "理想室友",
    "subtitle": "We're Not Strangers",
    "description": "从你的角度来看，描述一下我理想的室友，以及我永远不能和谁一起住？",
    "englishDesc": "From Your Perspective, Describe My Ideal Roommate Who Could Never Live With?"
  },
  {
    "id": 98,
    "name": "最好节目",
    "subtitle": "We're Not Strangers",
    "description": "史上最好的节目是什么？数到3，说出你的答案。大声引用。",
    "englishDesc": "What Is The Best Show Of All Time? On The Count Of 3, Say Your Answers. Quot Loud."
  },
  {
    "id": 99,
    "name": "伴侣品质",
    "subtitle": "We're Not Strangers",
    "description": "你认为我长期伴侣最需要具备哪些品质？我倾向于选择哪种类型？",
    "englishDesc": "What Qualities Do You Think I Need Most In A Long Term Partner? What Do I Tend To Go For?"
  },
  {
    "id": 100,
    "name": "不会拒绝",
    "subtitle": "We're Not Strangers",
    "description": "有什么是我永远不会拒绝的？",
    "englishDesc": "What's Something I'll Never Say \"no\" To?"
  },
  {
    "id": 101,
    "name": "朋友品质",
    "subtitle": "We're Not Strangers",
    "description": "写下朋友最重要的3个品质。30秒。进行比较。",
    "englishDesc": "Write Down The 3 Most Important Qualities In A Friend. 30 Seconds. Compare."
  },
  {
    "id": 102,
    "name": "真实的我",
    "subtitle": "We're Not Strangers",
    "description": "我的哪条 Instagram 帖子最能描述真实的我？",
    "englishDesc": "Which One Of My Instagram Posts Best Describes Who I Really Am?"
  },
  {
    "id": 103,
    "name": "约会离场",
    "subtitle": "We're Not Strangers",
    "description": "我最有可能因为什么原因在约会中途离场？",
    "englishDesc": "What Am I Most Likely To Walk Out On A Date Because Of?"
  },
  {
    "id": 104,
    "name": "多喝水",
    "subtitle": "We're Not Strangers",
    "description": "多喝水。",
    "englishDesc": "Drink More Water."
  },
  {
    "id": 105,
    "name": "约会照片",
    "subtitle": "We're Not Strangers",
    "description": "互相浏览对方的 Instagram。你会为你的朋友选择哪些照片作为他们的约会应用资料照片？",
    "englishDesc": "Scroll Through Each Other's Instagram. What Photos Would You Choose For Your Friend's Dating App Profile?"
  },
  {
    "id": 106,
    "name": "简介编写",
    "subtitle": "We're Not Strangers",
    "description": "两位玩家都为对方写一个 Instagram 简介。30秒。分享。奖励：将其作为你的简介保持24小时。",
    "englishDesc": "Both Players Write Down An Instagram Bio For The Other. 30 Seconds. Share. Bonus: Put It As Your Bio For 24 Hours."
  },
  {
    "id": 107,
    "name": "模仿我",
    "subtitle": "We're Not Strangers",
    "description": "模仿我，尽你所能。",
    "englishDesc": "Do Your Best Impression Of Me."
  },
  {
    "id": 108,
    "name": "初次注意",
    "subtitle": "We're Not Strangers",
    "description": "写下你第一次注意到对方的事情。30秒。进行比较。",
    "englishDesc": "Write Down The First Thing You Noticed About Each Other. 30 Seconds. Compare."
  },
  {
    "id": 109,
    "name": "儿时交友",
    "subtitle": "We're Not Strangers",
    "description": "你小时候交朋友时感到舒服吗？请解释。",
    "englishDesc": "Were You Comfortable Having Friends Growing Up? Explain."
  },
  {
    "id": 110,
    "name": "不想",
    "subtitle": "We're Not Strangers",
    "description": "你正试图不去想什么？",
    "englishDesc": "What Are You Trying Not To Think About?"
  },
  {
    "id": 111,
    "name": "自我骄傲",
    "subtitle": "We're Not Strangers",
    "description": "你最为你自己感到骄傲的是什么？允许你吹嘘一下。",
    "englishDesc": "What Are You Proudest Of Yourself For? Permission To Brag."
  },
  {
    "id": 112,
    "name": "工作幸福",
    "subtitle": "We're Not Strangers",
    "description": "用1-10分来评价你目前工作的幸福水平。什么能让它达到10分？哪个点更高？",
    "englishDesc": "Rate Your Happiness Level At Your Current Job On A Scale Of 1-10. What Would Make It 10? What Point Higher?"
  },
  {
    "id": 113,
    "name": "持续受伤",
    "subtitle": "We're Not Strangers",
    "description": "你一直做着什么让你持续受伤的事情？",
    "englishDesc": "What Do You Keep Doing That Keeps Hurting?"
  },
  {
    "id": 114,
    "name": "设定界限",
    "subtitle": "We're Not Strangers",
    "description": "你生命中谁让你感到被烙印？你可以和他们设定什么界限？",
    "englishDesc": "Who In Your Life Leaves You Feeling Branded? What Boundary Could You Set With Them?"
  },
  {
    "id": 115,
    "name": "爱意之事",
    "subtitle": "We're Not Strangers",
    "description": "你最近为自己做的最充满爱意的事情是什么？",
    "englishDesc": "What's The Most Loving Thing You've Done For Yourself Recently?"
  },
  {
    "id": 116,
    "name": "穿衣风格",
    "subtitle": "We're Not Strangers",
    "description": "你通常最适合穿什么？你总是后悔穿什么？",
    "englishDesc": "What Are You Usually Best To Wear? What Do You Always Regret Wearing?"
  },
  {
    "id": 117,
    "name": "友谊破裂",
    "subtitle": "We're Not Strangers",
    "description": "你以前经历过友谊破裂吗？它教会了你什么？",
    "englishDesc": "Have You Ever Had A Friendship Breakup Before? What Did It Teach You?"
  },
  {
    "id": 118,
    "name": "学会放手",
    "subtitle": "We're Not Strangers",
    "description": "放手什么会对你有益？你为什么仍然紧抓不放？",
    "englishDesc": "What Could You Benefit From Letting Go Of? Why Are You Still Holding On?"
  },
  {
    "id": 119,
    "name": "厌倦抱怨",
    "subtitle": "We're Not Strangers",
    "description": "你厌倦了抱怨什么？",
    "englishDesc": "What Are You Tired Of Complaining About?"
  },
  {
    "id": 120,
    "name": "标志一天",
    "subtitle": "We're Not Strangers",
    "description": "如果我能重温我们友谊中一个标志性的一天，会是哪一天？",
    "englishDesc": "If I Could Relive An Iconic Day In Our Friendship What Would It Be?"
  },
  {
    "id": 121,
    "name": "关于前任",
    "subtitle": "We're Not Strangers",
    "description": "你当时对我前任有什么想法但没有说出来吗？",
    "englishDesc": "Did You Have Any Thoughts About My Ex That You Didn't Voice At The Time?"
  },
  {
    "id": 122,
    "name": "避免之事",
    "subtitle": "We're Not Strangers",
    "description": "我们过去常做的一件有趣的事情，现在我们会不惜一切代价避免去做的是什么？",
    "englishDesc": "What's Something We Used To Do For Fun That We'd Avoid At All Costs Today?"
  },
  {
    "id": 123,
    "name": "过度思考",
    "subtitle": "We're Not Strangers",
    "description": "你一直在过度思考什么？或者谁？",
    "englishDesc": "What Have You Been Overthinking? Or Who?"
  },
  {
    "id": 124,
    "name": "需要发泄",
    "subtitle": "We're Not Strangers",
    "description": "你现在需要发泄什么？允许你发泄出来。",
    "englishDesc": "What Do You Need To Vent About Right Now? Permission To Let It Out."
  },
  {
    "id": 125,
    "name": "腾出时间",
    "subtitle": "We're Not Strangers",
    "description": "你想要为哪件事腾出更多时间？是什么阻碍了你？",
    "englishDesc": "What Do You Want To Make More Time For? What's Getting In The Way Of That?"
  },
  {
    "id": 126,
    "name": "拖延症",
    "subtitle": "We're Not Strangers",
    "description": "你现在正在拖延什么？为什么感觉这么难？",
    "englishDesc": "What Are You Procrastinating Right Now? Why Does It Feel So Hard?"
  },
  {
    "id": 127,
    "name": "推荐好物",
    "subtitle": "We're Not Strangers",
    "description": "我向你介绍了什么你现在喜欢的东西？",
    "englishDesc": "What Have I Introduced You To That You Now Love?"
  },
  {
    "id": 128,
    "name": "更多认可",
    "subtitle": "We're Not Strangers",
    "description": "你希望你在什么方面得到更多的认可？",
    "englishDesc": "What Do You Wish You Got More Credit For?"
  },
  {
    "id": 129,
    "name": "今日欢笑",
    "subtitle": "We're Not Strangers",
    "description": "今天什么让你笑了？",
    "englishDesc": "What Made You Smile Today?"
  },
  {
    "id": 130,
    "name": "交友困难",
    "subtitle": "We're Not Strangers",
    "description": "对你来说，交新朋友最困难的部分是什么？",
    "englishDesc": "What's The Hardest Part About Making New Friends For You?"
  },
  {
    "id": 131,
    "name": "接受自己",
    "subtitle": "We're Not Strangers",
    "description": "随着时间的推移，你学会接受了自己哪方面？",
    "englishDesc": "What Have You Learned To Accept About Yourself With Time?"
  },
  {
    "id": 132,
    "name": "避免对话",
    "subtitle": "We're Not Strangers",
    "description": "你在避免哪场对话？",
    "englishDesc": "What Conversation Are You Avoiding?"
  },
  {
    "id": 133,
    "name": "种草好物",
    "subtitle": "We're Not Strangers",
    "description": "你最近被影响购买的东西是什么？",
    "englishDesc": "What's The Most Recent Thing You've Been Influenced To Buy?"
  },
  {
    "id": 134,
    "name": "自我疏远",
    "subtitle": "We're Not Strangers",
    "description": "我会在____时疏远自己。",
    "englishDesc": "I Distance Myself When ____."
  },
  {
    "id": 135,
    "name": "无后果短信",
    "subtitle": "We're Not Strangers",
    "description": "如果没有任何后果，你现在会发什么短信？",
    "englishDesc": "What Text Would You Send Right Now If There Weren't Any Consequences?"
  },
  {
    "id": 136,
    "name": "不像工作",
    "subtitle": "We're Not Strangers",
    "description": "你工作中哪一部分感觉不像是在工作？",
    "englishDesc": "What Part Of Your Job Doesn't Feel Like Work?"
  },
  {
    "id": 137,
    "name": "最像自己",
    "subtitle": "We're Not Strangers",
    "description": "你什么时候感觉最像自己？你和谁在一起？你在做什么？",
    "englishDesc": "When Do You Feel Most Like Yourself? Who Are You With? What Are You Doing?"
  },
  {
    "id": 138,
    "name": "最早暗恋",
    "subtitle": "We're Not Strangers",
    "description": "你最早暗恋的人是谁？关于他们的一件事是什么？",
    "englishDesc": "Who Was Your Earliest Crush And One Thing About Them?"
  },
  {
    "id": 139,
    "name": "正在消化",
    "subtitle": "We're Not Strangers",
    "description": "你还在消化什么？",
    "englishDesc": "What Are You Still Processing?"
  },
  {
    "id": 140,
    "name": "失联朋友",
    "subtitle": "We're Not Strangers",
    "description": "哪个失联的朋友你至今仍在想念？",
    "englishDesc": "Who's A Friend You've Lost Touch With That You Think About To This Day?"
  },
  {
    "id": 141,
    "name": "上次分手",
    "subtitle": "We're Not Strangers",
    "description": "我的上一次分手对你来说是怎样的？",
    "englishDesc": "What Was My Last Breakup Like For You?"
  },
  {
    "id": 142,
    "name": "不再是朋友",
    "subtitle": "We're Not Strangers",
    "description": "你的朋友中是否有人不再感觉像朋友了？",
    "englishDesc": "Do Any Of Your Friends No Longer Feel Like Friends?"
  },
  {
    "id": 143,
    "name": "困惑前任",
    "subtitle": "We're Not Strangers",
    "description": "我的哪个前任最让你感到困惑？",
    "englishDesc": "What Ex Of Mine Confused You The Most?"
  },
  {
    "id": 144,
    "name": "被爱小事",
    "subtitle": "We're Not Strangers",
    "description": "我最近为你做的一件小事，让你感觉被深深爱着的是什么？",
    "englishDesc": "What's One Small Thing I've Done For You Recently That Made You Feel Loved In A Big Way?"
  },
  {
    "id": 145,
    "name": "第一好友",
    "subtitle": "We're Not Strangers",
    "description": "你第一个最好的朋友是谁？关于他们的一件事是什么？",
    "englishDesc": "Who Was Your First Best Friend And One Thing About Them?"
  },
  {
    "id": 146,
    "name": "兴奋变化",
    "subtitle": "We're Not Strangers",
    "description": "你最近在自己身上看到了哪些令人兴奋的变化？",
    "englishDesc": "What's An Exciting Change You've Been Seeing In Yourself?"
  },
  {
    "id": 147,
    "name": "成长",
    "subtitle": "We're Not Strangers",
    "description": "成长就是意识到____。",
    "englishDesc": "Growth Is Realizing That____."
  },
  {
    "id": 148,
    "name": "所谓“坏事”",
    "subtitle": "We're Not Strangers",
    "description": "发生在你身上最好的“最坏”的事情是什么？",
    "englishDesc": "What's The Best Worst Thing That's Ever Happened To You?"
  },
  {
    "id": 149,
    "name": "关系剧名",
    "subtitle": "We're Not Strangers",
    "description": "如果你的上一段关系是一部 Netflix 剧集，它会叫什么名字？",
    "englishDesc": "If Your Last Relationship Was A Netflix Series, What Would It Be Called?"
  },
  {
    "id": 150,
    "name": "想对前任说",
    "subtitle": "We're Not Strangers",
    "description": "你希望你对你的前任说过的一件事是什么？但你为什么说了？ ",
    "englishDesc": "What's One Thing You Wish You'd Said To Your Ex, But Why Did You?"
  },
  {
    "id": 151,
    "name": "对自己苛刻",
    "subtitle": "We're Not Strangers",
    "description": "你最近对自己格外苛刻的是什么？",
    "englishDesc": "What Have You Been Extra Hard On Yourself For Lately?"
  },
  {
    "id": 152,
    "name": "伴侣印象",
    "subtitle": "We're Not Strangers",
    "description": "你对我最近的伴侣的第一印象是什么？你现在怎么看？",
    "englishDesc": "What Was Your First Impression Of My Most Recent Partner? What Do You Think Now?"
  },
  {
    "id": 153,
    "name": "团队时刻",
    "subtitle": "We're Not Strangers",
    "description": "你上一次我们是一个团队是什么时候？你本可以做些什么不同的事情？",
    "englishDesc": "When Was The Last Time You Were A Team? What Could You Have Done Differently?"
  },
  {
    "id": 154,
    "name": "配对纹身",
    "subtitle": "We're Not Strangers",
    "description": "两位玩家画出他们认为最适合的配对纹身。30秒。分享。",
    "englishDesc": "Both Players Draw Their Best Idea For Matching Tattoos. 30 Seconds. Share."
  },
  {
    "id": 155,
    "name": "感情模式",
    "subtitle": "We're Not Strangers",
    "description": "你注意到我的感情生活中有什么模式吗？",
    "englishDesc": "Is There A Pattern You've Noticed In My Love Life?"
  },
  {
    "id": 156,
    "name": "性生活满意",
    "subtitle": "We're Not Strangers",
    "description": "用1-10分来评价你对你的性生活有多满意。两位玩家。进行比较。",
    "englishDesc": "On A Scale On 1-10, Arte How Satisfied You Are With Your Sex Life. Both Players. Compare."
  },
  {
    "id": 157,
    "name": "决定性时刻",
    "subtitle": "We're Not Strangers",
    "description": "描述我们友谊的决定性时刻。具体说明。进行比较。",
    "englishDesc": "Describe Our Friendship's Defining Moment. Get Specific. Compare."
  },
  {
    "id": 158,
    "name": "消化美好",
    "subtitle": "We're Not Strangers",
    "description": "也要花时间去消化那些美好的事情。",
    "englishDesc": "Take Time To Process The Good Things Too."
  },
  {
    "id": 159,
    "name": "今年实现",
    "subtitle": "We're Not Strangers",
    "description": "两位玩家写下今年想要实现的一件事并注明日期。进行比较。",
    "englishDesc": "Both Players Write Down One Thing You Want To Manifest This Year And Date It. Compare."
  }
];

// 预计算卡牌映射表
const CARD_MAP_WE = CARDS_WE.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {});

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  CARDS_WE,
  CARD_MAP_WE,
  shuffleArray
};
