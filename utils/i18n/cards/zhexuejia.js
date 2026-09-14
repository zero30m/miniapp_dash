function fromEntries(entries) {
    return entries.reduce(function (acc, entry) {
        acc[entry[0]] = entry[1];
        return acc;
    }, {});
}

function mapPhilosophyCards(entries, subtitle) {
    return fromEntries(entries.map(function (entry) {
        return [entry[0], {
            name: entry[1],
            subtitle: subtitle,
            description: entry[2],
            intro: entry[3],
            philosopherName: entry[4],
            philosopherIntro: entry[5]
        }];
    }));
}

const ZHEXUEJIA_CARD_COPY = {
    "zh-Hant-TW": mapPhilosophyCards([
        [1, "莊周夢蝶", "從持牌者開始，大家輪流說一句話，其他人要猜真假。揭曉後，全猜錯的人喝一口。", "你理想中最自由的生活是什麼樣子？", "莊子", "道家哲學家，承接老子思想，推崇逍遙自在的生命狀態。莊子擅長用寓言說理，淡化生死榮辱，追求與「道」合而為一的精神境界。"] ,
        [2, "魚與熊掌不可兼得", "把一個紙團藏在手裡，讓大家猜在哪一隻手。猜錯的人喝一杯。", "你相信人性本善還是本惡？", "孟子", "儒家重要代表人物，主張性善論，認為人本來就有善端，只是可能被環境帶歪。他提倡仁政，也提出「民貴君輕」，對後世儒家影響很深。"] ,
        [3, "法不阿貴，繩不繞曲", "全場把杯中酒清空。", "你怎麼看待我們現在的法律制度？", "韓非子", "戰國末期法家集大成者，主張以法治國、強調君主權威與法律至上。他的思想深刻影響秦朝的治國模式，也奠定了中國古代法家政治的骨架。"] ,
        [4, "上帝啊，讓我純潔，但先別太快。", "所有人打開短影音往下滑 10 支，每刷到一支擦邊影片就喝一口。", "你覺得人類有原罪嗎？", "聖奧古斯丁", "基督教哲學家與神學家，把柏拉圖思想融進基督教體系。著有《懺悔錄》《上帝之城》，提出「上帝之城」與「地上之城」，形塑了中世紀神學哲學的基本框架。"] ,
        [5, "這已經是最好的可能世界", "所有玩家輪流在手機計算機輸入 0 到 60 的數字，全部加總後打開指南針，數字所指方向的人喝一杯。", "如果能改掉一個人生選擇，你最想改哪個？", "戈特弗里德．萊布尼茲", "哲學家、數學家，也是微積分的重要先驅之一。他提出「單子論」，認為宇宙由無數精神性單子構成，並樂觀主張我們正活在「最好的可能世界」。"] ,
        [6, "我不想讓女性支配男性，我只希望女性能主宰自己。", "所有男生起立假裝男模，輪流自我介紹「姓名＋籍貫＋特色」。女生用酒競標，沒人拍走的男生喝一杯。", "你心中真正的女性主義是什麼？", "瑪麗．沃斯通克拉夫特", "早期女性主義思想家，《女權辯護》作者。她主張女性應享有與男性平等的教育權與社會地位，為近代女性主義鋪下很關鍵的第一塊地基。"] ,
        [7, "人生就在痛苦與無聊之間擺盪", "打開手機秒錶遮住數字，輪流挑戰，必須剛好停在 6 到 6.99 秒之間，沒停到的人喝一杯。", "你曾經因為什麼事特別悲觀？", "阿圖爾．叔本華", "悲觀主義哲學代表人物，代表作《作為意志和表象的世界》。他認為世界本質是一股盲目的意志，人生在痛苦與無聊間來回擺盪，而審美與同情能讓人短暫抽離。"] ,
        [8, "女性不是附屬品", "所有男生自罰一口酒。", "你怎麼看現在的男女對立？", "約翰．史都華．彌爾", "功利主義哲學家，也是邊沁思想的重要承接者與修正者。他在《論自由》《功利主義》中大力倡議個人自由、言論自由與性別平等，對倫理學與政治思想影響深遠。"] ,
        [9, "女人不是天生的，而是被塑造出來的", "所有人用備忘錄寫下自己對現場哪位玩家第一印象最好。寫完後大家猜拳，輸的人要公開自己寫的是誰。", "你怎麼看待彩禮？", "西蒙娜．德．波娃", "存在主義哲學家與女性主義先驅，代表作《第二性》。她系統分析女性如何在社會中被建構成「他者」，那句經典的「女人不是天生的，而是被塑造的」也影響至今。"] ,
        [10, "可能世界", "每個人在備忘錄寫下一個喝酒懲罰，之後全場猜拳，照勝利者寫下的內容執行。", "你覺得平行宇宙存在嗎？", "大衛．劉易斯", "分析哲學家，以模態實在論聞名。他認為所有可能世界都和我們的世界一樣真實，這套理論也影響到語言哲學與心靈哲學的討論。"] ,
        [11, "我們走太快，靈魂都跟不上", "所有人含一口水，由持卡者講笑話。只要有人噴出來，全場喝一杯；如果沒人笑，持卡者自己喝。", "你怎麼看待消費主義？", "斯拉沃熱．齊澤克", "當代哲學家與文化評論家，擅長把黑格爾、馬克思與拉岡揉在一起講，風格犀利又帶點瘋感。因為常直接切入時事，也被叫做文化理論界的超級明星。"] ,
        [12, "開在衡水中學的夜店", "指定兩位玩家猜拳或骰子 SOLO，全場都要拿一杯酒押其中一邊。輸家和押錯的人一起喝一杯。", "你想不想體驗一次喝到斷片？", "滿分激光槍", "滿分激光槍是中國很有代表性的線上夜生活媒體，《哲學家與酒》就是他們推出的周邊產品。想看更多夜生活資訊或喝酒桌遊內容，可以到小紅書或微信公眾號搜尋「滿分激光槍」。"] ,
        [13, "人是其選擇的總和", "所有人輪流往公杯倒酒，接著猜拳，贏的人要把公杯裡的酒全部喝完。", "你怎麼理解存在主義？", "尚-保羅．沙特", "存在主義哲學家與作家，主張「存在先於本質」，認為人被丟進世界後，必須透過選擇替自己定義人生，並為此承擔責任。他拒領諾貝爾文學獎，也成了他的代表姿態。"] ,
        [14, "人，詩意地棲居在大地上。", "每個人輪流分享一句自己覺得很有詩意的哲學金句，講不出來的人喝一杯。", "你怎麼看技術對人類文明的影響？", "馬丁．海德格", "存在主義與現象學的重要哲學家，代表作《存在與時間》。他深入追問「存在」本身的意義，提出此在、世界內存在等概念，對二十世紀歐陸哲學影響極深。"] ,
        [15, "存在即合理", "你可以任意往任何玩家杯裡倒任意口數的酒，對方必須喝完。", "你見過最不合理的一件事是什麼？", "格奧爾格．黑格爾", "德國觀念論哲學家，建立了龐大的辯證法體系。他認為歷史與理念發展遵循正、反、合的運動邏輯，《精神現象學》《法哲學原理》等作品對後世影響巨大。"] ,
        [16, "存在就是被感知", "選一位玩家轉過去，其他人隨意戳 TA 的背。TA 回頭有三次機會猜是誰，猜不中自己喝一口，猜中則戳的人喝一口。", "哪一部電影最讓你有感？", "喬治．貝克萊", "經驗主義哲學家，也是主觀唯心論代表人物。他提出「存在即被感知」，認為物質並不是獨立存在，而是透過感知與觀念才成立，這也大大衝擊了人們對客觀世界的想像。"] ,
        [17, "缸中之腦", "持卡者蒙住一位玩家的眼睛，輪流指向其他人並問：TA 喝不喝？喝幾口？被蒙眼的人指定到的玩家就得照喝。", "你覺得這個世界是虛擬的嗎？", "勒內．笛卡兒", "近代理性主義哲學家與數學家，被視為現代西方哲學之父。他用方法性懷疑一路追到「我思故我在」，也在心物二元論與解析幾何上留下巨大影響。"] ,
        [18, "所有人對所有人的惡", "全場猜拳，勝者指定敗者做一個大冒險或回答一題真心話。", "如果由你來訂一條法律，你會訂什麼？", "湯瑪斯．霍布斯", "近代政治哲學家，代表作《利維坦》。他認為人在自然狀態下會陷入彼此爭奪，所以才需要透過社會契約，把權力交給強而有力的主權者來換取秩序。"] ,
        [19, "知識就是力量。", "從持卡者開始，大家輪流說一本哲學著作，最先答不出來的人喝一口。", "你最珍惜的一條人生經驗是什麼？", "法蘭西斯．培根", "文藝復興時期哲學家與科學家，也是英國經驗主義與近代科學方法的重要奠基者。他強調透過觀察與實驗獲取知識，還提出著名的「四假象」來批判人的偏見。"] ,
        [20, "知行合一", "這一輪要喝多少由你決定，而且全場都得跟著你一起喝。", "你覺得自己最做不到知行合一的是哪一塊？", "王陽明", "明代哲學家，心學代表人物，提倡「致良知」與「知行合一」。他反對只會紙上談兵，認為真正的理解一定得落到行動裡，影響了東亞思想界好幾百年。"] ,
        [21, "如無必要，勿增實體", "你可以把自己杯裡的酒倒給任意一位玩家。", "你怎麼看第一性原理？", "奧卡姆的威廉", "中世紀經院哲學家與邏輯學家，以「奧卡姆剃刀」聞名，也就是沒必要就別加多餘假設。他同時是唯名論的重要代表人物，對後來經驗主義的發展也有推力。"]
    ], "哲學家酒牌"),
    en: mapPhilosophyCards([
        [1, "Zhuangzi's Butterfly Dream", "Starting with the cardholder, take turns making a statement. Others guess true or false. Reveal it: wrong guesses take one sip.", "What would your ideal version of freedom look like?", "Zhuangzi", "A major Daoist philosopher who carried forward Laozi's ideas and championed a free, unforced way of living. Zhuangzi loved using parables to talk about deep metaphysical ideas, softening the grip of life, death, fame, and loss in pursuit of unity with the Dao."] ,
        [2, "You Can't Have Both Fish and Bear's Paw", "Hide a paper ball in one of your hands and let everyone guess which one it is. Anyone who guesses wrong drinks.", "Do you believe human nature is basically good or basically bad?", "Mencius", "One of the most influential Confucian thinkers. Mencius argued that human nature is fundamentally good and that people go astray because of circumstance. He advocated benevolent government and famously claimed that the people matter more than the ruler."] ,
        [3, "The Law Bows to No Noble", "Everyone finishes whatever is left in their glass.", "How do you view the legal system we live under?", "Han Feizi", "The great synthesizer of Legalist thought in late Warring States China. Han Feizi emphasized strict law, state power, and the authority of the ruler. His ideas deeply shaped Qin governance and the logic of later authoritarian statecraft."] ,
        [4, "Lord, Make Me Chaste, But Not Yet", "Everyone opens a short-video app and scrolls 10 clips. Every borderline-thirst-trap video earns one sip.", "Do you think human beings are born with original sin?", "Saint Augustine", "A Christian philosopher and theologian who fused Platonic thought with Christian doctrine. Through works like Confessions and The City of God, Augustine helped build the core framework of medieval Christian philosophy."] ,
        [5, "This Is the Best of All Possible Worlds", "Everyone types a number from 0 to 60 into their phone calculator. Add them up, open the compass, and whoever the number points to drinks.", "If you could redo one life choice, which would it be?", "Gottfried Wilhelm Leibniz", "A philosopher and mathematician, and one of the pioneers behind calculus. Leibniz proposed the theory of monads, seeing reality as composed of spiritual units, and famously insisted that this is the best of all possible worlds."] ,
        [6, "I Don't Want Women to Rule Men. I Want Women to Rule Themselves.", "Men model: name, hometown, best trait. Women bid with drinks. Unpicked men drink one.", "What does real feminism mean to you?", "Mary Wollstonecraft", "An early feminist philosopher and author of A Vindication of the Rights of Woman. She argued that women deserve the same education and social standing as men, laying crucial groundwork for modern feminist thought."] ,
        [7, "Life Swings Between Suffering and Boredom", "Open a stopwatch, hide the numbers, and let people try to stop it between 6.00 and 6.99 seconds. Miss the window, take a drink.", "What has made you feel truly pessimistic before?", "Arthur Schopenhauer", "A defining philosopher of pessimism, best known for The World as Will and Representation. He saw the world as driven by a blind will, leaving human life suspended between pain and boredom, with art and compassion offering brief relief."] ,
        [8, "Women Are Not Accessories", "All the men drink one sip.", "How do you read the current gender divide online and offline?", "John Stuart Mill", "A major utilitarian thinker who expanded and revised Bentham's legacy. Through works like On Liberty and The Subjection of Women, Mill defended personal freedom, free speech, and gender equality with lasting influence on ethics and political thought."] ,
        [9, "One Is Not Born, but Becomes, a Woman", "In your notes app, name the player who made the best first impression. Play rock-paper-scissors. The loser reveals their pick.", "How do you feel about bride price or marriage payments?", "Simone de Beauvoir", "An existentialist philosopher and feminist pioneer whose The Second Sex transformed modern gender theory. Beauvoir argued that women are socially constructed as the 'Other,' helping spark a new era of feminist self-awareness."] ,
        [10, "Possible Worlds", "Everyone writes a drinking punishment in their notes app. Then you all play rock-paper-scissors and carry out the winner's punishment.", "Do you think parallel universes are real?", "David Lewis", "An analytic philosopher famous for modal realism. Lewis argued that all possible worlds are just as real as ours, a view that reshaped debates in metaphysics, language, and philosophy of mind."] ,
        [11, "We've Moved So Fast Our Souls Can't Keep Up", "Hold water in your mouths. The cardholder tells a joke. Anyone spits? Everyone takes one drink. Nobody laughs? The cardholder drinks.", "How do you see consumerism?", "Slavoj Zizek", "A contemporary philosopher and cultural critic known for blending Hegel, Marx, and Lacan with wild humor and sharp political takes. His energetic style turned him into a kind of celebrity in critical theory circles."] ,
        [12, "A Nightclub Inside a Hyper-Competitive High School", "Pick two players for rock-paper-scissors or dice. Everyone bets one drink on a side. The loser and wrong bettors each drink one.", "Would you ever want to get blackout drunk, just once?", "Perfect Laser Blaster", "Perfect Laser Blaster is one of China's best-known nightlife media brands, and Philosophers & Booze is one of its side projects. If you want more nightlife coverage or drinking-game ideas, look them up on Xiaohongshu or WeChat."] ,
        [13, "A Human Is the Sum of Their Choices", "Everyone pours into the shared cup in turn. Then you play rock-paper-scissors, and the winner has to finish the whole communal drink.", "How do you personally understand existentialism?", "Jean-Paul Sartre", "An existentialist philosopher and writer who argued that existence comes before essence. For Sartre, human beings are thrown into the world and must define themselves through free choice while carrying full responsibility for it."] ,
        [14, "Poetically, Humanity Dwells Upon This Earth", "Everyone shares a philosophical line they find poetic. Anyone who blanks drinks.", "How do you think technology is reshaping civilization?", "Martin Heidegger", "A towering figure in phenomenology and existential thought, best known for Being and Time. Heidegger explored the meaning of Being itself and introduced concepts like Dasein and being-in-the-world that transformed twentieth-century philosophy."] ,
        [15, "What Exists Is Rational", "You may pour any number of sips into any player's glass, and they must finish it.", "What's the most irrational thing you've ever witnessed?", "Georg Wilhelm Friedrich Hegel", "A central figure of German idealism who developed an enormous dialectical system. Hegel saw history and thought as unfolding through contradiction and development, and his influence runs through much of modern philosophy."] ,
        [16, "To Be Is to Be Perceived", "Pick a player to turn away. Others poke their back. They get three guesses: miss, they sip; get it right, the person who poked them sips.", "Which film has affected you the most?", "George Berkeley", "An empiricist philosopher and founder of subjective idealism. Berkeley argued that material things do not exist independently of perception, forcing later thinkers to rethink what counts as reality in the first place."] ,
        [17, "Brain in a Vat", "The cardholder blindfolds one player and points at others in turn, asking: should they drink, and how much? Whoever the blindfolded player names has to drink that amount.", "Do you think the world might be simulated?", "Rene Descartes", "A rationalist philosopher and mathematician often called the father of modern Western philosophy. Through methodic doubt, Descartes arrived at 'I think, therefore I am,' while also shaping debates on mind-body dualism and analytic geometry."] ,
        [18, "The War of All Against All", "Everyone plays rock-paper-scissors. The winner chooses one loser to do either a dare or a truth question.", "If you could create one law, what would it be?", "Thomas Hobbes", "A foundational modern political philosopher, best known for Leviathan. Hobbes argued that without political authority, human life collapses into fear and conflict, so people surrender power to a sovereign in exchange for order."] ,
        [19, "Knowledge Is Power", "Starting with the cardholder, players name philosophical books one by one. First person who can't name one drinks.", "What's the life lesson you treasure most?", "Francis Bacon", "A Renaissance philosopher and scientist, and one of the architects of modern empiricism and scientific method. Bacon championed observation and experiment while attacking the cognitive biases he famously called the four idols."] ,
        [20, "Unity of Knowledge and Action", "You decide how much everyone drinks this round, and the whole table has to match you.", "Where in life do you feel least aligned between what you know and what you do?", "Wang Yangming", "A major Ming-dynasty philosopher and the leading voice of the School of Mind. Wang argued for 'innate knowing' and the unity of knowledge and action, insisting that true understanding must show up in how one lives."] ,
        [21, "Do Not Multiply Entities Without Necessity", "You may pour your own drink into any other player's glass.", "How do you view first-principles thinking?", "William of Ockham", "A medieval scholastic philosopher and logician best known for Ockham's Razor, the idea that we should not add extra assumptions without need. He was also a major nominalist and an important precursor to empiricism."]
    ], "Philosopher's Deck"),
    ja: mapPhilosophyCards([
        [1, "胡蝶の夢", "カードを引いた人から順番に一言ずつ話し、それが本当かウソかをみんなで当てる。答え合わせで全員外した人は一口。", "あなたにとって、いちばん自由な生き方ってどんな形？", "荘子", "道家を代表する哲学者で、老子の思想を受け継ぎながら、のびやかで縛られない生を大切にした人物。寓話を通じて深い道理を語り、名誉や生死への執着をほどいて「道」と一つになる境地を説いた。"] ,
        [2, "魚と熊の手は両取りできない", "紙くずを片手に隠して、どちらの手かを全員に当ててもらう。外した人は一杯。", "人間の本性って善だと思う？ それとも悪だと思う？", "孟子", "儒家の重要人物で、性善説を唱えた思想家。人は本来善い心を持つが、環境によって乱れると考えた。仁政や「民を貴しとする」考えを打ち出し、後の儒学に大きな影響を与えた。"] ,
        [3, "法は貴人にへつらわず", "全員グラスの中身を飲み切る。", "今の法律や法制度をどう見てる？", "韓非子", "戦国末期の法家思想の集大成とされる人物。厳格な法と君主権力を重視し、その発想は秦の統治モデルにも強く影響した。中国古代の統治理論を考えるうえで外せない哲学者。"] ,
        [4, "神よ、私を清らかにしてください。でも今すぐじゃなくていいです。", "全員がショート動画を 10 本スクロールし、際どい動画が出るたびに一口飲む。", "人間には原罪があると思う？", "アウグスティヌス", "キリスト教哲学と神学を代表する人物で、プラトン的発想をキリスト教思想へと組み込んだ。『告白』『神の国』などを通じて、中世神学の大枠を築いた。"] ,
        [5, "これが最善の可能世界", "全員がスマホの計算機に 0 から 60 の数字を一つずつ入力し合計する。コンパスを開いて、その数字が指した方向の人が一杯。", "人生の選択を一つだけやり直せるなら、何を変えたい？", "ゴットフリート・ライプニッツ", "哲学者であり数学者でもあり、微積分の先駆者の一人。宇宙は無数の精神的単位「モナド」で成り立つと考え、私たちは最善の可能世界に生きていると論じた。"] ,
        [6, "女性が男性を支配してほしいのではない。女性が自分自身を治められるようになってほしい。", "男性は立ってモデル風に名前・出身・魅力を紹介。女性はお酒で入札。選ばれなかった男性は一杯。", "あなたにとって本当のフェミニズムって何？", "メアリ・ウルストンクラフト", "初期フェミニズムの代表的思想家で、『女性の権利の擁護』の著者。女性にも男性と同じ教育と社会的地位が必要だと訴え、近代フェミニズムの土台を築いた。"] ,
        [7, "人生は苦痛と退屈のあいだを揺れる", "ストップウォッチを見えないようにして、6.00〜6.99 秒ぴったりを狙って止める。外した人は一杯。", "何が原因で強く悲観的になったことがある？", "アルトゥル・ショーペンハウアー", "悲観主義哲学の代表格で、『意志と表象としての世界』で知られる。世界の本質は盲目的な意志だと見なし、人間の生は苦痛と退屈の往復だと捉えた。"] ,
        [8, "女性は付属品ではない", "男性全員が一口飲む。", "今の男女対立をどう見てる？", "ジョン・スチュアート・ミル", "功利主義を発展させた思想家で、自由・言論・男女平等を強く擁護した。『自由論』『功利主義』などを通して、近代の倫理学と政治思想に大きな影響を残した。"] ,
        [9, "女は生まれるのではない、女になるのだ", "全員がメモに「第一印象がいちばん良かった人」を書き、じゃんけんで負けた人がその名前を公開する。", "結納金や彩礼についてどう思う？", "シモーヌ・ド・ボーヴォワール", "実存主義哲学者でありフェミニズムの先駆者。『第二の性』で女性が社会の中でいかに作られるかを解き明かし、現代フェミニズムに決定的な影響を与えた。"] ,
        [10, "可能世界", "全員がメモに飲酒罰を書き、じゃんけんで勝った人の内容を全員で実行する。", "並行世界って本当にあると思う？", "デイヴィッド・ルイス", "分析哲学を代表する一人で、可能世界がすべて同じように実在するというモーダル実在論で有名。形而上学だけでなく、言語哲学や心の哲学にも強い影響を与えた。"] ,
        [11, "私たちは速く進みすぎて、魂が追いついていない", "全員が口に水を含み、持ち主がジョークを言う。誰か一人でも吹いたら全員一杯。誰も笑わなければ持ち主が飲む。", "消費主義をどう考える？", "スラヴォイ・ジジェク", "現代を代表する哲学者・文化批評家。ヘーゲル、マルクス、ラカンを横断しながら、ユーモア混じりに時事へ切り込むスタイルで知られ、理論界のスター的存在とも言われる。"] ,
        [12, "衡水高校の中にできたナイトクラブ", "二人を指名してじゃんけんかサイコロ SOLO。全員がどちらかに一杯分ベットし、負けた側と賭けを外した人が一杯。", "一度くらい記憶が飛ぶまで飲んでみたいと思う？", "満点レーザーガン", "満点レーザーガンは中国で知られるナイトライフ系メディアで、『哲学者と酒』はその周辺プロジェクト。夜遊び情報や飲み会ゲームをもっと知りたい人は、小紅書やWeChat公式アカウントで検索してみて。"] ,
        [13, "人は自分の選択の総和である", "全員で順番に共用杯へ酒を注ぎ、その後じゃんけん。勝った人が共用杯を飲み干す。", "実存主義をどう理解してる？", "ジャン＝ポール・サルトル", "実存主義を代表する哲学者・作家で、「実存は本質に先立つ」と主張した人物。人は自由な選択によって自分を形作り、その責任も引き受けるべきだと説いた。"] ,
        [14, "人はこの地上に詩的に住まう", "各自、自分が詩的だと思う哲学の名言を一つずつ言う。出てこない人は一杯。", "技術は人類文明にどんな影響を与えてると思う？", "マルティン・ハイデガー", "現象学と実存思想の巨人で、『存在と時間』で知られる。存在そのものの意味を問い直し、「現存在」や「世界内存在」といった概念で二十世紀哲学を大きく動かした。"] ,
        [15, "現実的なものは理性的である", "好きなだけ好きな相手のグラスに酒を注ぎ、その人は全部飲まなければならない。", "今まで見た中でいちばん理不尽だったことは？", "ゲオルク・ヴィルヘルム・フリードリヒ・ヘーゲル", "ドイツ観念論を代表する哲学者で、壮大な弁証法の体系を築いた。歴史も思想も矛盾を通じて展開すると考え、その影響は後の哲学全体に及んでいる。"] ,
        [16, "存在するとは知覚されることである", "一人が後ろを向き、他の人が背中をつつく。三回以内に当てたらつついた人が一口。外したら本人が一口。", "いちばん心に残った映画は何？", "ジョージ・バークリー", "経験論の哲学者で、主観的観念論の代表人物。「存在するとは知覚されること」と述べ、物質の独立した実在性そのものを問い直した。"] ,
        [17, "水槽の中の脳", "持ち主が一人を目隠しし、他の人を順に指して「飲む？何口？」と聞く。指名された人はその通りに飲む。", "この世界って仮想現実かもしれないと思う？", "ルネ・デカルト", "近代理性主義の代表であり、現代西洋哲学の父とも呼ばれる人物。徹底した懐疑を通じて「我思う、ゆえに我あり」にたどり着き、心身二元論や解析幾何でも大きな功績を残した。"] ,
        [18, "万人の万人に対する闘争", "全員でじゃんけんをして、勝者が敗者にお題チャレンジか真実の質問を一つ課す。", "あなたが法律を一つ作れるなら、何を作る？", "トマス・ホッブズ", "近代政治哲学の大物で、『リヴァイアサン』の著者。自然状態では人間の生は不安定で暴力的になるため、秩序のために主権者へ権利を委ねるべきだと考えた。"] ,
        [19, "知識は力なり", "持ち主から順番に哲学書のタイトルを一冊ずつ言う。最初に詰まった人が一口。", "あなたがいちばん大切にしてる人生の学びは？", "フランシス・ベーコン", "ルネサンス期の哲学者・科学者で、近代的な科学的方法の基礎を築いた一人。観察と実験を重視し、人間の思考を曇らせる偏見を「四つのイドラ」として批判した。"] ,
        [20, "知行合一", "このラウンドでどれだけ飲むかはあなたが決める。全員が同じだけ飲む。", "自分の中でいちばん知行合一できてない部分はどこ？", "王陽明", "明代の哲学者で、心学を大成した人物。「良知」と「知行合一」を説き、本当にわかっているなら行動にも現れるはずだと考えた。東アジア思想への影響も非常に大きい。"] ,
        [21, "必要以上に存在者を増やすな", "自分のグラスの酒を好きな相手に移してよい。", "第一原理で考えるってどう思う？", "オッカムのウィリアム", "中世スコラ哲学を代表する論理学者で、「オッカムの剃刀」で有名。余計な仮定を増やさない姿勢を貫き、唯名論や後の経験論にも強い影響を与えた。"]
    ], "哲学者の酒カード"),
    ko: mapPhilosophyCards([
        [1, "장주의 나비 꿈", "카드 소지자부터 돌아가며 한마디씩 말하고, 나머지가 그게 진실인지 거짓인지 맞힌다. 정답 공개 후 전원 틀린 사람은 한 모금.", "네가 상상하는 가장 자유로운 삶은 어떤 모습이야?", "장자", "도가를 대표하는 철학자로, 노자의 흐름을 잇고 얽매이지 않는 삶의 태도를 중시했다. 우화로 깊은 이치를 풀어내며 삶과 죽음, 영광과 치욕에 대한 집착을 내려놓고 도와 하나 되는 경지를 말한 인물이다."] ,
        [2, "물고기와 곰 발바닥은 둘 다 못 가진다", "종이 뭉치를 한 손에 숨기고 모두가 어느 손인지 맞힌다. 틀린 사람은 한 잔.", "인간 본성은 선하다고 봐, 악하다고 봐?", "맹자", "유가의 핵심 사상가로 성선설을 주장했다. 인간은 본래 선하지만 환경 때문에 흐트러질 수 있다고 보았고, 인의 정치와 '백성이 귀하다'는 발상으로 후대 유학에 큰 영향을 남겼다."] ,
        [3, "법은 귀한 자라고 봐주지 않는다", "전원 잔 안의 술을 비운다.", "지금 우리가 사는 법 체계를 어떻게 보고 있어?", "한비자", "전국시대 말 법가 사상을 집대성한 인물. 엄격한 법, 군주의 권위, 국가 통제를 강조했고 그의 이론은 진나라 통치 방식에도 강하게 반영되었다."] ,
        [4, "신이시여, 저를 순결하게 해 주세요. 다만 지금 당장은 말고요.", "모두가 숏폼 앱을 열고 영상 10개를 넘긴다. 아슬아슬한 영상이 나올 때마다 한 모금.", "인간에게 원죄가 있다고 생각해?", "성 아우구스티누스", "기독교 철학과 신학을 대표하는 인물로, 플라톤적 사유를 기독교 교리와 결합했다. 『고백록』과 『신국론』 등을 통해 중세 신학철학의 큰 틀을 세웠다."] ,
        [5, "이곳이 최선의 가능세계다", "각자 휴대폰 계산기에 0부터 60 사이 숫자를 하나씩 입력해 합산한 뒤 나침반을 연다. 그 숫자가 가리키는 방향의 사람이 한 잔.", "인생 선택 하나를 바꿀 수 있다면 뭘 바꾸고 싶어?", "고트프리트 빌헬름 라이프니츠", "철학자이자 수학자로, 미적분의 선구자 중 한 명이다. 우주는 수많은 정신적 단위인 모나드로 이루어져 있다고 보았고, 우리가 사는 세계가 가능한 세계들 중 최선이라고 주장했다."] ,
        [6, "나는 여성이 남성을 지배하길 바라지 않는다. 여성이 자기 삶을 주도하길 바랄 뿐이다.", "남자 전원이 일어나 모델 흉내를 내며 이름, 출신, 매력을 소개한다. 여자들은 술로 경매하고, 아무도 선택하지 않은 남자는 한 잔.", "네가 생각하는 진짜 페미니즘은 뭐야?", "메리 울스턴크래프트", "초기 여성주의 철학자로 『여권 옹호』의 저자다. 여성도 남성과 동등한 교육과 사회적 지위를 가져야 한다고 주장하며 근대 여성주의의 출발점 중 하나를 만들었다."] ,
        [7, "인생은 고통과 권태 사이를 흔들린다", "초시계를 열고 숫자를 가린 채 6.00초에서 6.99초 사이에 멈춰야 한다. 못 맞추면 한 잔.", "너를 극도로 비관적으로 만든 일은 뭐였어?", "아르투어 쇼펜하우어", "비관주의 철학을 대표하는 인물로 『의지와 표상으로서의 세계』로 유명하다. 세계의 본질을 맹목적인 의지로 보고, 삶을 고통과 권태 사이의 진동으로 이해했다."] ,
        [8, "여성은 부속품이 아니다", "남자 전원이 한 모금 마신다.", "요즘의 젠더 갈등을 어떻게 보고 있어?", "존 스튜어트 밀", "공리주의를 발전시킨 사상가로, 자유와 표현의 권리, 성평등을 강하게 옹호했다. 『자유론』과 『공리주의』 등을 통해 윤리학과 정치사상에 큰 영향을 남겼다."] ,
        [9, "여성은 태어나는 것이 아니라 만들어지는 것이다", "모두 메모장에 현장 플레이어 중 첫인상이 가장 좋았던 사람을 적는다. 그다음 가위바위보에서 진 사람이 누구를 적었는지 공개한다.", "예단이나 결혼 비용 문화에 대해 어떻게 생각해?", "시몬 드 보부아르", "실존주의 철학자이자 여성주의 선구자. 『제2의 성』을 통해 여성이 어떻게 사회적으로 구성되는지를 분석했고, 현대 페미니즘 담론에 결정적인 전환점을 만든 인물이다."] ,
        [10, "가능세계", "각자 메모장에 술벌칙 하나를 적고 전원 가위바위보. 이긴 사람이 적은 벌칙을 실행한다.", "평행우주가 실제로 있다고 생각해?", "데이비드 루이스", "분석철학의 대표 인물로, 가능한 세계들이 모두 동등하게 실재한다는 양상실재론으로 유명하다. 형이상학뿐 아니라 언어철학과 심철학에도 큰 영향을 끼쳤다."] ,
        [11, "우리는 너무 빨리 달려서 영혼이 따라오지 못한다", "전원이 입에 물을 머금고 카드 소지자가 농담을 한다. 누군가 한 명이라도 뿜으면 전원 한 잔, 아무도 안 웃으면 소지자가 마신다.", "소비주의를 어떻게 생각해?", "슬라보예 지젝", "현대 철학자이자 문화비평가로, 헤겔·마르크스·라캉을 엮어 날카롭고 유머 있게 말하는 것으로 유명하다. 시사 문제에도 적극 개입하며 이론계의 셀럽 같은 존재로 통한다."] ,
        [12, "입시 명문고 안에 생긴 클럽", "두 사람을 지목해 가위바위보나 주사위 SOLO를 시킨다. 모두가 한쪽에 술 한 잔씩 베팅하고, 진 쪽과 베팅 실패한 사람 모두 한 잔.", "딱 한 번쯤 블랙아웃까지 마셔 보고 싶다는 생각 해봤어?", "만점 레이저건", "만점 레이저건은 중국에서 잘 알려진 나이트라이프 미디어이고, 『철학자와 술』은 그 주변 프로젝트다. 밤문화 소식이나 술자리 보드게임이 더 궁금하면 샤오홍슈나 위챗 공식계정에서 찾아볼 수 있다."] ,
        [13, "인간은 자신이 선택한 것들의 총합이다", "모두가 돌아가며 공용잔에 술을 붓고, 이후 가위바위보를 해서 이긴 사람이 공용잔을 다 마신다.", "너는 실존주의를 어떻게 이해해?", "장폴 사르트르", "실존주의를 대표하는 철학자이자 작가. '실존은 본질에 앞선다'고 말하며, 인간은 선택을 통해 스스로를 만들어 가고 그 책임도 직접 져야 한다고 주장했다."] ,
        [14, "인간은 이 땅 위에 시적으로 거주한다", "각자 시적이라고 느끼는 철학 문장을 하나씩 말한다. 생각 안 나는 사람은 한 잔.", "기술이 인간 문명에 어떤 영향을 준다고 생각해?", "마르틴 하이데거", "현상학과 실존철학의 거장으로 『존재와 시간』의 저자다. 존재의 의미 자체를 다시 묻고, 현존재와 세계-내-존재 같은 개념으로 20세기 철학 지형을 바꿨다."] ,
        [15, "존재하는 것은 합리적이다", "원하는 만큼 원하는 사람 잔에 술을 붓고, 상대는 전부 마셔야 한다.", "네가 본 것 중 가장 말이 안 됐던 일은 뭐야?", "게오르크 빌헬름 프리드리히 헤겔", "독일 관념론의 핵심 철학자로 거대한 변증법 체계를 세웠다. 역사와 사유가 모순을 거치며 전개된다고 보았고, 그의 영향은 이후 철학 전반에 깊게 남아 있다."] ,
        [16, "존재한다는 것은 지각된다는 것이다", "한 명을 뒤돌게 하고 나머지가 마음대로 등을 찌른다. 세 번 안에 맞히면 찌른 사람이, 못 맞히면 본인이 한 모금.", "가장 크게 와닿았던 영화는 뭐야?", "조지 버클리", "경험주의 철학자이자 주관적 관념론의 대표 인물. '존재한다는 것은 지각되는 것이다'라는 주장으로 물질 세계의 독립적 실재성을 근본부터 흔들었다."] ,
        [17, "통 속의 뇌", "카드 소지자가 한 명을 눈가리고 다른 사람들을 가리키며 '마셔? 몇 모금?'을 묻는다. 눈가린 사람이 지목한 사람은 그대로 마신다.", "이 세계가 가상일 수도 있다고 생각해?", "르네 데카르트", "근대 합리주의 철학자이자 수학자로, 서양 근대철학의 아버지로 불린다. 방법적 회의를 통해 '나는 생각한다, 고로 존재한다'에 도달했고, 심신이원론과 해석기하학에도 큰 족적을 남겼다."] ,
        [18, "만인의 만인에 대한 투쟁", "전원이 가위바위보를 하고, 승자가 패자 한 명에게 미션이나 진실 질문 하나를 시킨다.", "네가 법 하나를 만들 수 있다면 뭘 만들래?", "토머스 홉스", "근대 정치철학의 핵심 인물로 『리바이어던』의 저자다. 자연 상태의 인간 사회는 불안정하고 폭력적이기 때문에, 질서를 위해 강한 주권자에게 권한을 넘겨야 한다고 봤다."] ,
        [19, "아는 것이 힘이다", "카드 소지자부터 돌아가며 철학 책 제목을 하나씩 말한다. 먼저 막히는 사람이 한 모금.", "네가 가장 아끼는 인생의 경험칙은 뭐야?", "프랜시스 베이컨", "르네상스 시기의 철학자이자 과학자로, 근대 과학 방법과 영국 경험주의의 토대를 닦은 인물이다. 관찰과 실험을 강조하고 인간 사고의 편견을 '네 가지 우상'으로 비판했다."] ,
        [20, "지행합일", "이번 라운드에 얼마나 마실지는 네가 정하고, 모두가 똑같이 따라 마신다.", "네가 가장 지행합일 못하는 부분은 어디야?", "왕양명", "명나라 철학자로 심학의 집대성자다. '양지'와 '지행합일'을 내세우며, 진짜 앎은 반드시 행동으로 드러나야 한다고 보았다. 동아시아 사상계에 미친 영향도 매우 크다."] ,
        [21, "필요 없으면 존재자를 늘리지 말라", "네 잔에 있는 술을 아무 플레이어에게나 넘겨도 된다.", "제1원리 사고에 대해 어떻게 생각해?", "오컴의 윌리엄", "중세 스콜라 철학자이자 논리학자로, '오컴의 면도날'로 가장 유명하다. 불필요한 가정을 늘리지 말자는 태도로 유명하며, 유명론과 이후 경험주의 발전에도 큰 영향을 주었다."]
    ], "철학자 덱")
};

module.exports = {
    ZHEXUEJIA_CARD_COPY: ZHEXUEJIA_CARD_COPY
};
