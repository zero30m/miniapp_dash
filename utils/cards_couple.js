/**
 * 情侣互动 - 卡牌数据
 * 解析自 诗经主题游戏卡牌整理.txt
 * 
 * 字段说明：
 * - id: 序号
 * - name: 卡牌标题
 * - description: 卡牌内容（正面）
 * - backTitle: 背面标题（诗经出处）
 * - backContent: 背面内容（原文）
 * - backTranslation: 背面翻译
 * - phase: 阶段 1(1-40) 2(41-70) 3(71-100)
 */
const CARDS_COUPLE = [
    { id: 1, name: '柔荑', description: '用指尖在对方大腿内侧或腰际线缓慢游走，如同在宣纸上作画，不许停留，直到对方呼吸变乱。', backTitle: '《诗经·卫风·硕人》', backContent: '手如柔荑，肤如凝脂。', backTranslation: '女子的手像嫩草芽一样洁白柔软，肌肤像凝固的油脂一样细腻。', phase: 1 },
    { id: 2, name: '静女', description: '将对方逼至墙角或视线死角，单手撑墙，鼻尖摩挲其颈窝并深嗅，停留 15 秒感受彼此升温。', backTitle: '《诗经·邶风·静女》', backContent: '静女其姝，俟我于城隅。', backTranslation: '文静美丽的姑娘，在城角暗处等待着我。', phase: 1 },
    { id: 3, name: '采薇', description: '在对方呼吸最急促的部位（如锁骨或耳后），用齿尖轻轻衔住那一小块皮肤，留下一个专属的淡红印记。', backTitle: '《诗经·小雅·采薇》', backContent: '采薇采薇，薇亦柔止。', backTranslation: '采摘薇菜啊，薇菜的叶片是多么鲜嫩。', phase: 1 },
    { id: 4, name: '关雎', description: '贴近对方耳廓，用舌尖缓慢描绘轮廓，伴随低沉的呼吸，直到对方产生明显的颤栗感。', backTitle: '《诗经·周南·关雎》', backContent: '关关雎鸠，在河之洲。', backTranslation: '雄雌水鸟在河中小洲和合鸣叫。', phase: 1 },
    { id: 5, name: '子衿', description: '两人鼻尖相抵，在不触碰唇部的前提下，捕捉对方呼出的每一寸热气，持续 30 秒。', backTitle: '《诗经·郑风·子衿》', backContent: '青青子衿，悠悠我心。', backTranslation: '青青的是你衣领，悠悠的是我的心境。', phase: 1 },
    { id: 6, name: '鹿鸣', description: '模仿幼兽，在对方怀中用脸颊蹭遍对方的颈部、胸膛与腹部，寻求对方的温存。', backTitle: '《诗经·小雅·鹿鸣》', backContent: '呦呦鹿鸣，食野之苹。', backTranslation: '鹿群发出呦呦的呼唤声，在原野吃着艾蒿。', phase: 1 },
    { id: 7, name: '有冽', description: '取一丝凉意点涂在对方后颈，随即用温热的呼吸完全覆盖，体验冷热交替的冲击。', backTitle: '《诗经·小雅·大东》', backContent: '有冽氿泉，无浸获薪。', backTranslation: '寒冷的泉水喷涌，不要浸湿那砍下的柴火。', phase: 1 },
    { id: 8, name: '束薪', description: '使用丝缎暂时限制对方的双臂，你拥有 1 分钟的主导权，可以探索对方身体任何防线。', backTitle: '《诗经·唐风·绸缪》', backContent: '绸缪束薪，三星在天。', backTranslation: '捆捆柴火扎得紧，三星高照在天顶。', phase: 1 },
    { id: 9, name: '甘棠', description: '对方仰卧，你从下方钻入被褥进行深度"丈量"，对方需忍耐你的所有动作且不许躲闪。', backTitle: '《诗经·召南·甘棠》', backContent: '蔽芾甘棠，勿剪勿伐。', backTranslation: '郁郁葱葱的棠梨树，请不要修剪它。', phase: 1 },
    { id: 10, name: '椒聊', description: '指定对方的一处禁区，用除了手以外的部位（如唇齿、发丝）去挑逗，直到对方失控。', backTitle: '《诗经·唐风·椒聊》', backContent: '椒聊之实，蕃衍盈匊。', backTranslation: '花椒结了籽，繁茂多得满手抓。', phase: 1 },
    { id: 11, name: '木瓜', description: '坐在对方腿上，双手环绕颈部，感受彼此重心完全交叠，维持 30 秒。', backTitle: '《诗经·卫风·木瓜》', backContent: '投我以木瓜，报之以琼琚。', backTranslation: '送我一个木瓜，我送他一块佩玉。', phase: 1 },
    { id: 12, name: '幽幽', description: '对方需含住一件你的私密衣物，在不许发声的情况下，任由你摆布姿势进行观赏。', backTitle: '《诗经·小雅·斯干》', backContent: '秩秩斯干，幽幽南山。', backTranslation: '溪水潺潺流淌，南山幽静深远。', phase: 1 },
    { id: 13, name: '考槃', description: '让对方俯卧在你的膝盖上，选一处圆润之地，用掌心连击 5 下，力道由你掌控。', backTitle: '《诗经·卫风·考槃》', backContent: '考槃在阿，硕人之薖。', backTranslation: '他在山间隐居盘桓，贤人如此快乐。', phase: 1 },
    { id: 14, name: '载驰', description: '对方跪趴在地上，你骑坐在其腰间，指挥其在室内缓慢移动，体验被驯服的张力。', backTitle: '《诗经·邶风·载驰》', backContent: '载驰载驱，归唁卫侯。', backTranslation: '策马疾驰啊，奔走在回国的路上。', phase: 1 },
    { id: 15, name: '蒹葭', description: '在水汽氤氲的浴室中，利用水流的颤动刺激对方敏感部位，直到对方发出失控的声音。', backTitle: '《诗经·秦风·蒹葭》', backContent: '蒹葭凄凄，白露未晞。', backTranslation: '芦苇密密繁茂，清晨的露水还未干。', phase: 1 },
    { id: 16, name: '月出', description: '熄灭灯光，仅靠微弱光芒，指定对方一个部位，你必须用极具诱惑力的方式对其洗礼 30 秒。', backTitle: '《诗经·陈风·月出》', backContent: '月出皎兮，佼人僚兮。', backTranslation: '月亮出来明晃晃，那位美人真漂亮。', phase: 1 },
    { id: 17, name: '葛生', description: '进入极窄空间（如衣橱），在黑暗中仅凭触觉完成一次不限时的深度交缠。', backTitle: '《诗经·唐风·葛生》', backContent: '葛生蒙楚，蔹蔓于野。', backTranslation: '葛草覆盖荆木，蔓藤在旷野蔓延。', phase: 1 },
    { id: 18, name: '匏有', description: '玩一次背诵挑战。每算错一次，对方就褪去你身上的一件遮挡，直到坦诚相见。', backTitle: '《诗经·邶风·匏有》', backContent: '匏有苦叶，济有深涉。', backTranslation: '葫芦叶子枯黄了，过河要找水深处。', phase: 1 },
    { id: 19, name: '终风', description: '支配者给出反向指令（如：说不要就是要）。对方需在被挑逗时违心地做出反应。', backTitle: '《诗经·邶风·终风》', backContent: '终风且暴，顾我则笑。', backTranslation: '大风刮过狂暴异常，看到我就笑。', phase: 1 },
    { id: 20, name: '文茵', description: '用指尖在对方后背描摹一个秘密词汇，让对方通过皮肤触觉猜出答案。', backTitle: '《诗经·秦风·小戎》', backContent: '文茵畅毂，驾我骐馵。', backTranslation: '车上铺着虎皮褥子，驾着壮美的马儿。', phase: 1 },
    { id: 21, name: '嘉鱼', description: '指定一个私密昵称，在本轮游戏结束前，对方只能以此称呼你。', backTitle: '《诗经·小雅·南有嘉鱼》', backContent: '南有嘉鱼，烝然罩罩。', backTranslation: '南方有肥美的鱼，鱼群在水中欢快。', phase: 1 },
    { id: 22, name: '颀颀', description: '挑选一件你最想看对方穿的装束，让对方立刻换上并为你展示。', backTitle: '《诗经·卫风·硕人》', backContent: '硕人其颀，衣锦褧衣。', backTranslation: '美人身材修长，外穿薄纱蝉衣。', phase: 1 },
    { id: 23, name: '匪风', description: '蒙住对方双眼，用身体任意部位触碰对方，让其猜出该部位的名称。', backTitle: '《诗经·邶风·匪风》', backContent: '匪风发兮，匪车偈兮。', backTranslation: '不因为狂风大作，不因为车行疾速。', phase: 1 },
    { id: 24, name: '在河', description: '让对方仰卧，你从其足部开始一寸寸亲吻至颈部，不许略过任何一寸皮肤。', backTitle: '《诗经·周南·关雎》', backContent: '关关雎鸠，在河之洲。', backTranslation: '雄雌水鸟在河中小洲和合鸣叫。', phase: 1 },
    { id: 25, name: '思齐', description: '挑选一种食物，以唇对唇的方式缓缓渡给对方，不许洒出一滴。', backTitle: '《诗经·大雅·思齐》', backContent: '思齐大任，文王之母。', backTranslation: '端庄贤淑的大任，周文王的母亲。', phase: 1 },
    { id: 26, name: '露草', description: '细致地清理对方身体某处的"丛林"，使其呈现最洁净、坦诚的状态。', backTitle: '《诗经·郑风·野有蔓草》', backContent: '野有蔓草，零露漙兮。', backTranslation: '野外蔓草青青，草上的露珠晶莹。', phase: 1 },
    { id: 27, name: '鸣鸠', description: '对方需模拟一种受宠的小兽，发出最撩人的低吟并复述其此刻的心理渴望。', backTitle: '《诗经·曹风·候人》', backContent: '维鸠居之，尸鸠在桑。', backTranslation: '斑鸠筑巢居住，在那桑树枝头。', phase: 1 },
    { id: 28, name: '履薄', description: '将碎冰置于对方身体任意部位并慢慢品尝，对方需保持静止，违规者抽牌。', backTitle: '《诗经·小雅·小旻》', backContent: '如临深渊，如履薄冰。', backTranslation: '如同站在深渊边缘，如同踩在薄冰之上。', phase: 1 },
    { id: 29, name: '有葛', description: '穿戴一件带有铃铛的饰品，在此后的三分钟内，每发出一次声音需接受一次吻。', backTitle: '《诗经·王风·采葛》', backContent: '彼采葛兮，一日不见，如三秋兮。', backTranslation: '那个采葛的姑娘，一天不见，就像过了三年。', phase: 1 },
    { id: 30, name: '伐檀', description: '双方同时用口或手为对方服务，最先失去定力投降的一方需接受额外惩罚。', backTitle: '《诗经·魏风·伐檀》', backContent: '坎坎伐檀兮，置之河之干兮。', backTranslation: '砍伐檀木啊，把它放在河岸边。', phase: 1 },
    { id: 31, name: '鸣佩', description: '在半开放的私密空间（如阳台），通过耳语传达一个羞涩的即时指令。', backTitle: '《诗经·秦风·终南》', backContent: '佩玉案案，寿考不忘。', backTranslation: '身上佩玉叮当作响，令人终生难忘。', phase: 1 },
    { id: 32, name: '素衣', description: '扮演对方的仆人，在约定时间内完成沐浴、更衣、按摩等全套侍奉。', backTitle: '《诗经·唐风·扬之水》', backContent: '素衣朱绣，从子于鹄。', backTranslation: '身着素色外衣，跟着你前往远方。', phase: 1 },
    { id: 33, name: '野有', description: '两人在关闭光源的"地堡"中，仅凭听觉与触觉完成一次高强度的体力博弈。', backTitle: '《诗经·郑风·野有蔓草》', backContent: '野有蔓草，零露瀼瀼。', backTranslation: '野地草蔓长，清晨露珠凉。', phase: 1 },
    { id: 34, name: '采葑', description: '用指尖或温和笔触在对方禁区标记"敏感等级"，后续据此进行深度探索。', backTitle: '《诗经·邶风·谷风》', backContent: '采葑采菲，无以下体。', backTranslation: '采葑菜采菲菜，不要因为根部不好就丢弃。', phase: 1 },
    { id: 35, name: '舒窈', description: '对方需保持跪趴姿势，你从后方缓慢亲吻其背脊，感受对方肌肉的紧绷。', backTitle: '《诗经·陈风·月出》', backContent: '舒窈纠兮，劳心悄兮。', backTranslation: '举止舒缓苗条，让人思念。', phase: 1 },
    { id: 36, name: '如琢', description: '两人身体紧贴摩擦，在不进行最后一步的前提下，共同抵达颤动的云端。', backTitle: '《诗经·卫风·淇奥》', backContent: '如切如磋，如琢如磨。', backTranslation: '骨器象牙要切磋，玉石美石要雕琢。', phase: 1 },
    { id: 37, name: '维桑', description: '扮演"严师"审讯"学生"，在受限的状态下让对方交代一个从未启齿的身体秘密。', backTitle: '《诗经·小雅·小弁》', backContent: '维桑与梓，必恭敬止。', backTranslation: '看到家乡的桑树，必须心存敬意。', phase: 1 },
    { id: 38, name: '北风', description: '模拟极冷场景，两人紧紧拥抱取暖，对方需在你的撩拨下忍住不出声。', backTitle: '《诗经·邶风·北风》', backContent: '北风其凉，雨雪其雱。', backTranslation: '北风凄凄凉意浓，大雪漫漫落不停。', phase: 1 },
    { id: 39, name: '有苓', description: '蒙住对方眼，用不同材质（羽毛、金属、冰块）依次刺激同一隐秘区域。', backTitle: '《诗经·邶风·简兮》', backContent: '山有榛，隰有苓。', backTranslation: '山上有榛树，湿地有甘草。', phase: 1 },
    { id: 40, name: '中心', description: '在对方即将抵达终点前，强制其停止动作，需获得你的许可方可继续。', backTitle: '《诗经·曹风·下泉》', backContent: '中心养养，念彼周京。', backTranslation: '心中烦乱不安，思念那周朝京城。', phase: 1 },
    { id: 41, name: '如川', description: '衔住那点晶莹，在指尖揉碎或舌尖细品对方的源泉液体，感受那种拉丝的张力。', backTitle: '《诗经·小雅·天保》', backContent: '如川之方至，以莫不兴。', backTranslation: '如同河水奔流不息，万物生长。', phase: 2 },
    { id: 42, name: '载寝', description: '让对方仰卧，你从下方钻入被褥，深度探索其核心源泉。', backTitle: '《诗经·小雅·斯干》', backContent: '乃生女子，载寝之地。', backTranslation: '生下女孩啊，让她睡在地上。', phase: 2 },
    { id: 43, name: '硕鼠', description: '对方佩戴铃铛躲避，你蒙眼狩猎，捕获后可对其执行任何一项你想要的调教。', backTitle: '《诗经·魏风·硕鼠》', backContent: '硕鼠硕鼠，无食我黍。', backTranslation: '那大老鼠啊，不要吃我的粮食。', phase: 2 },
    { id: 44, name: '终南', description: '两人共同观看一部充满张力的影片，电影结束前禁止任何形式的自我或互相触碰。', backTitle: '《诗经·秦风·终南》', backContent: '终南何有？有条有梅。', backTranslation: '终南山上有什么？有山楸也有梅树。', phase: 2 },
    { id: 45, name: '衡门', description: '寻找家中最不常用的角落，完成一次高难度的肢体博弈。', backTitle: '《诗经·陈风·衡门》', backContent: '衡门之下，可以栖迟。', backTranslation: '破旧的横木门下，也可以安身休息。', phase: 2 },
    { id: 46, name: '三月', description: '在对方最脆弱处涂抹甜品，你需在 30 秒内清理干净，不许剩下一滴。', backTitle: '《诗经·王风·采葛》', backContent: '彼采葛兮，一日不见，如三月兮。', backTranslation: '那个采葛草的姑娘，一天不见就像三个月。', phase: 2 },
    { id: 47, name: '如松', description: '两人交换平时的强弱身份，被动者变主动，体验一次彻底的博弈互换。', backTitle: '《诗经·小雅·斯干》', backContent: '如松之盛，如柏之茂。', backTranslation: '如同松柏般繁茂昌盛。', phase: 2 },
    { id: 48, name: '宛汤', description: '对方需在你的近距离注视下，完成一次自我取悦的全过程。', backTitle: '《诗经·陈风·宛丘》', backContent: '子之汤兮。', backTranslation: '你在高坡上跳舞，多么肆意奔放。', phase: 2 },
    { id: 49, name: '如切', description: '两人互换上方位，尝试一个平日极少触碰的"探索"视角。', backTitle: '《诗经·卫风·淇奥》', backContent: '如切如磋，如琢如磨。', backTranslation: '加工骨器需反复切磋，如雕琢美玉。', phase: 2 },
    { id: 50, name: '隰桑', description: '对方俯卧，你用双手包裹住对方的柔软处，反复揉捏直至对方红温。', backTitle: '《诗经·小雅·隰桑》', backContent: '隰桑有阿，其叶有难。', backTranslation: '湿地的桑树多柔美，叶儿多么肥厚。', phase: 2 },
    { id: 51, name: '东门', description: '对方跨坐在你腿上，两人维持这个姿势深吻，期间不许松开。', backTitle: '《诗经·郑风·东门之墠》', backContent: '东门之墠，茹藘在阪。', backTranslation: '东门外平地好，茜草长在斜坡上。', phase: 2 },
    { id: 52, name: '桃夭', description: '在对方娇红之处涂抹温水，用你的呼吸将其吹干。', backTitle: '《诗经·周南·桃夭》', backContent: '桃之夭夭，灼灼其华。', backTranslation: '桃花盛开多灿烂，花朵红艳。', phase: 2 },
    { id: 53, name: '扬水', description: '对方需保持绝对的固定姿势，你利用小道具在其敏感区制造如水流般的震颤。', backTitle: '《诗经·郑风·扬之水》', backContent: '扬之水，不流束薪。', backTranslation: '激起的水流冲不动成捆的柴。', phase: 2 },
    { id: 54, name: '狡童', description: '下达"禁声令"，对方在接下来的互动中不许发出一点声音，违规者加抽卡牌。', backTitle: '《诗经·郑风·狡童》', backContent: '彼狡童兮，不与我言兮。', backTranslation: '那个狡黠的少年啊，不再跟我说话。', phase: 2 },
    { id: 55, name: '首阳', description: '对方仰面躺下，你以如急雨般密集的指尖叩击在其源泉处反复盘旋。', backTitle: '《诗经·唐风·采苓》', backContent: '采苓采苓，首阳之巅。', backTranslation: '采甘草啊采甘草，在那首阳山之巅。', phase: 2 },
    { id: 56, name: '小戎', description: '寻找一件细长的丝织物，在对方禁区交替抽动 5 次。', backTitle: '《诗经·秦风·小戎》', backContent: '小戎俴收，五楘梁辀。', backTranslation: '兵车轻便车厢浅，装饰精美。', phase: 2 },
    { id: 57, name: '子兮', description: '描述一个你曾梦见过但不敢提出的"坏场景"，并在当场模拟其中一个片段。', backTitle: '《诗经·唐风·绸缪》', backContent: '见此良人，子兮子兮。', backTranslation: '见到这位好郎君，你呀你呀。', phase: 2 },
    { id: 58, name: '邂逅', description: '对方蒙眼，你带其去阳台或落地窗前（确保安全），从后方紧贴其背部。', backTitle: '《诗经·郑风·野有蔓草》', backContent: '邂逅相遇，适我愿兮。', backTranslation: '偶然相遇，正合我心意。', phase: 2 },
    { id: 59, name: '竹苞', description: '用指尖沾满润滑介质，在对方禁区进行一次深入的"探访"。', backTitle: '《诗经·小雅·斯干》', backContent: '如竹苞矣，如松茂矣。', backTranslation: '像竹丛般繁茂，像松树般长青。', phase: 2 },
    { id: 60, name: '南山', description: '模仿狐狸的姿态，在对方身上寻找最敏感的几处"猎物"进行捕食。', backTitle: '《诗经·齐风·南山》', backContent: '南山崔崔，雄狐绥绥。', backTranslation: '南山高耸，雄狐在慢慢行走。', phase: 2 },
    { id: 61, name: '采菲', description: '对方需将脚置于你的肩头，你对其进行一次深度的足底礼赞。', backTitle: '《诗经·邶风·谷风》', backContent: '采葑采菲，无以下体。', backTranslation: '不因根部不好就丢弃。', phase: 2 },
    { id: 62, name: '清庙', description: '模拟一段电影里的"羞耻台词"，对方需配合你完成相应动作。', backTitle: '《诗经·周颂·清庙》', backContent: '於穆清庙，肃雝显相。', backTranslation: '庄严肃穆的宗庙。', phase: 2 },
    { id: 63, name: '弗告', description: '录制一段对方此刻最动人的状态（不露脸），事后强制对方观看并聆听。', backTitle: '《诗经·卫风·考槃》', backContent: '独寐寤言，永矢弗告。', backTranslation: '独自睡觉醒来感慨，誓不向人倾诉。', phase: 2 },
    { id: 64, name: '梓桑', description: '对方作为"供品"，在约定的时间内维持指定姿势，由你任意享用。', backTitle: '《诗经·小雅·小弁》', backContent: '维桑与梓，必恭敬止。', backTranslation: '看到家乡树木必心生敬意。', phase: 2 },
    { id: 65, name: '载寝', description: '把酸奶或水果放在对方身体任意部位，你需在不用手的情况下一一享用。', backTitle: '《诗经·小雅·斯干》', backContent: '乃生男子，载寝之床。', backTranslation: '生下男孩，让他睡在床上。', phase: 2 },
    { id: 66, name: '终朝', description: '对方仅着轻薄外衣，你用湿润的指尖在其内部进行"秘密捕捉"。', backTitle: '《诗经·小雅·采绿》', backContent: '终朝采绿，不盈一匊。', backTranslation: '一早晨采摘王刍草，采不满一捧。', phase: 2 },
    { id: 67, name: '汉广', description: '对方平躺，你利用感官道具，让对方体验这种"浩瀚"的冲击。', backTitle: '《诗经·周南·汉广》', backContent: '汉之广矣，不可泳思。', backTranslation: '汉水浩瀚宽阔，无法游过去。', phase: 2 },
    { id: 68, name: '有榛', description: '对方双脚需被轻度束缚，你用羽毛在其中间区域游走 15 秒。', backTitle: '《诗经·邶风·简兮》', backContent: '山有榛，隰有苓。', backTranslation: '山上有榛树，湿地有甘草。', phase: 2 },
    { id: 69, name: '周行', description: '指定一个除了手以外的身体部位，对方需用它为你提供一次舒适的服务。', backTitle: '《诗经·小雅·鹿鸣》', backContent: '人之好我，示我周行。', backTranslation: '待我好的人，指示我走正道。', phase: 2 },
    { id: 70, name: '三星', description: '利用束缚类小道具固定住对方双脚，你拥有 3 分钟的单向开启对方身体防线的权力。', backTitle: '《诗经·唐风·绸缪》', backContent: '三星在户。', backTranslation: '三星映在门前。', phase: 2 },
    { id: 71, name: '心悦', description: '什么是你内心最渴望从我这里得到，目前却还没有让我明确知道的？', backTitle: '《越人歌》', backContent: '心悦君兮君周知。', backTranslation: '心中喜欢你，希望你知道。', phase: 3 },
    { id: 72, name: '大任', description: '在最亲密的时刻，你更希望我是主导全局的"捕猎者"，还是温顺配合的"猎物"？', backTitle: '《诗经·大雅·思齐》', backContent: '思齐大任。', backTranslation: '端庄贤淑的大任，周文王的母亲。', phase: 3 },
    { id: 73, name: '如兰', description: '描述一个你脑海中最隐秘的画面。在那个场景里，我正在对你做一件你平日不敢开口要求的事。', backTitle: '《孔子家语》', backContent: '其香如兰。', backTranslation: '气味如兰花般芬芳。', phase: 3 },
    { id: 74, name: '扬觯', description: '我身体的哪个部位，即便闭上眼，你也能仅凭触觉产生的颤栗瞬间认出来？', backTitle: '《诗经·卫风·硕人》', backContent: '硕人其颀，扬觯语笑。', backTranslation: '美人身材修长，扬起酒杯谈笑。', phase: 3 },
    { id: 75, name: '窈窕', description: '哪一次的深度交流让你至今记忆犹新？请具体描述那个让你失控的瞬间细节。', backTitle: '《诗经·周南·关雎》', backContent: '窈窕淑女，君子好逑。', backTranslation: '文静美好的姑娘，是好配偶。', phase: 3 },
    { id: 76, name: '缘君', description: '你内心是否隐藏着一种渴望被掌控、甚至是被"轻度羞辱"的情绪？', backTitle: '《诗经·唐风·绸缪》', backContent: '见此邂逅。', backTranslation: '见到你这个好伴侣，缘分不浅。', phase: 3 },
    { id: 77, name: '采葛', description: '你认为控制欲在我们的关系中是加分项还是减分项？为什么？', backTitle: '《诗经·王风·采葛》', backContent: '彼采葛兮。', backTranslation: '采葛草的姑娘。', phase: 3 },
    { id: 78, name: '棠梨', description: '当你不开心或有压力的时候，什么样的肢体接触能让你瞬间感到被珍惜？', backTitle: '《诗经·召南·甘棠》', backContent: '勿剪勿拜。', backTranslation: '爱屋及乌，舍不得剪伐。', phase: 3 },
    { id: 79, name: '未晞', description: '请说出一个你从未告诉过任何人的、关于欲望的最高级秘密。', backTitle: '《诗经·秦风·蒹葭》', backContent: '蒹葭凄凄，白露未晞。', backTranslation: '芦苇密繁，清晨露水未干。', phase: 3 },
    { id: 80, name: '南幽', description: '哪一次我的言行曾伤到了你，但你选择了独自消化？请现在告诉我当时的感受。', backTitle: '《诗经·小雅·斯干》', backContent: '幽幽南山。', backTranslation: '南山深处幽静。', phase: 3 },
    { id: 81, name: '僚兮', description: '描述一下我身上那一个在你看来最性感、最迷人的瞬间。', backTitle: '《诗经·陈风·月出》', backContent: '佼人僚兮。', backTranslation: '那位美人真漂亮。', phase: 3 },
    { id: 82, name: '吊兮', description: '你有从事后温存中得到满足吗？我做哪些事能让你更觉得被照顾？', backTitle: '《诗经·邶风·匪风》', backContent: '中心吊兮。', backTranslation: '心中忧伤。', phase: 3 },
    { id: 83, name: '如雪', description: '如果用一种水果来比喻我们的爱，它会是什么？为什么？', backTitle: '《诗经·曹风·蜉蝣》', backContent: '衣裳楚楚，其志如雪。', backTranslation: '志气洁白如雪。', phase: 3 },
    { id: 84, name: '薇柔', description: '有没有一个瞬间，你在我面前感到既快乐又想完全依赖我？', backTitle: '《诗经·小雅·采薇》', backContent: '薇亦柔止。', backTranslation: '薇菜鲜嫩。', phase: 3 },
    { id: 85, name: '凝脂', description: '你觉得我在最亲密的时候表现出的哪一种神态，是你最喜欢的？', backTitle: '《诗经·卫风·硕人》', backContent: '手如柔荑。', backTranslation: '手白嫩细腻。', phase: 3 },
    { id: 86, name: '维鸠', description: '你对自己有支配/服从倾向的自我认知是多少？你希望我们朝哪个方向尝试？', backTitle: '《诗经·曹风·候人》', backContent: '维鸠居之。', backTranslation: '斑鸠筑巢。', phase: 3 },
    { id: 87, name: '在林', description: '如果我们可以交换一天性别，你最想对我做的第一件事是什么？', backTitle: '《诗经·周南·兔罝》', backContent: '肃肃兔罝。', backTranslation: '捕兔的网。', phase: 3 },
    { id: 88, name: '栖迟', description: '想象我们走到生命尽头，你希望我们的爱被定义为什么？', backTitle: '《陈风·衡门》', backContent: '可以栖迟。', backTranslation: '破旧的门下也可以休息。', phase: 3 },
    { id: 89, name: '宛丘', description: '你理想中的未来生活图景里，包含关于我们两人的特殊情趣空间吗？', backTitle: '《诗经·陈风·宛丘》', backContent: '子之汤兮，宛丘之上兮。', backTranslation: '在高坡跳舞，肆意奔放。', phase: 3 },
    { id: 90, name: '柏茂', description: '你觉得我们现在的亲密频率和质量，还有哪些提升空间？', backTitle: '《诗经·小雅·斯干》', backContent: '如柏之茂。', backTranslation: '松柏长青。', phase: 3 },
    { id: 91, name: '一匊', description: '请描述我们初次深度接触时，你当时内心最真实的心理活动。', backTitle: '《诗经·小雅·采绿》', backContent: '不盈一匊。', backTranslation: '采不满一捧。', phase: 3 },
    { id: 92, name: '泳思', description: '哪种情绪只有你自己能感受，而我可能忽略了？请尝试描述。', backTitle: '《诗经·周南·汉广》', backContent: '不可泳思。', backTranslation: '无法游过去。', phase: 3 },
    { id: 93, name: '隰苓', description: '我们可以想一个专属的"暂停暗号"吗？当一方感到压力或过火时立即停止。', backTitle: '《诗经·邶风·简兮》', backContent: '山有榛，隰有苓。', backTranslation: '山上有榛树，湿地有甘草。', phase: 3 },
    { id: 94, name: '不兴', description: '你认为"爱"是一系列选择的行为，还是一种无法自控的状态？', backTitle: '《诗经·小雅·天保》', backContent: '如川之方至，以莫不兴。', backTranslation: '如同河水奔流。', phase: 3 },
    { id: 95, name: '下泉', description: '最近哪一刻在你沉浸于亲密时，让你仿佛完全忘记了时间的流逝？', backTitle: '《诗经·曹风·下泉》', backContent: '念彼周京。', backTranslation: '思念那周朝京城。', phase: 3 },
    { id: 96, name: '寤言', description: '有没有一个你一直想做却迟迟未做的探索？如果我愿意配合，你希望是什么时候？', backTitle: '《诗经·卫风·考槃》', backContent: '独寐寤言。', backTranslation: '睡觉醒来感慨。', phase: 3 },
    { id: 97, name: '悠悠', description: '在关系的过程中，你最喜欢自己慢慢成长或改变在不同阶段呈现不同的样子？', backTitle: '《诗经·郑风·子衿》', backContent: '悠悠我心。', backTranslation: '思念深沉。', phase: 3 },
    { id: 98, name: '呦呦', description: '你觉得控制欲对于感情是加分项还是减分项，为什么？', backTitle: '《诗经·小雅·鹿鸣》', backContent: '呦呦鹿鸣，食野之苹。', backTranslation: '鹿群呼唤。', phase: 3 },
    { id: 99, name: '归飞', description: '有没有一个你儿时的梦想，是你希望我能帮你重新点燃或一起实现的？', backTitle: '《诗经·曹风·下泉》', backContent: '归飞隼翼。', backTranslation: '隼鸟归巢。', phase: 3 },
    { id: 100, name: '夷愉', description: '此时此刻，面对这个游戏后的我，你最想对我做的一件事是什么？', backTitle: '《诗经·小雅·隰桑》', backContent: '既见君子，胡不夷愉。', backTranslation: '既然见到了心上人，怎么不快乐。', phase: 3 }
];

// 创建卡牌映射表（用于快速查找）
const CARD_MAP_COUPLE = {};
CARDS_COUPLE.forEach(card => {
    CARD_MAP_COUPLE[card.id] = card;
});

module.exports = {
    CARDS_COUPLE,
    CARD_MAP_COUPLE
};
