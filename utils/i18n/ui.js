const { UI_COPY_EXTRA } = require('./ui_extra.js');

const UI_COPY = {
    'zh-Hans': {
        common: {
            loading: '加载中...',
            submit: '提交中...',
            cancel: '取消',
            confirm: '确认',
            retry: '重试'
        },
        app: {
            defaultWindowTitle: '抓手指-满分激光枪'
        },
        tabBar: {
            home: '首页',
            finger: '抓手指',
            games: '真心话大冒险',
            gamesShort: '游戏',
            diy: '扑克牌',
            admin: '后台'
        },
        home: {
            navTitle: '抓手指-满分激光枪',
            skipSplash: '跳过',
            brandTitle: '满分激光枪',
            brandSubtitle: 'FULL SCORE LASER',
            sectionRecent: '最近玩过',
            sectionTools: '喝酒道具',
            playerUnit: '人',
            welcomeBack: '欢迎回来',
            shareTitle: '首页 | 抓手指-满分激光枪',
            specialBanner: {
                desc: '快来测一测',
                btnText: '去看看'
            }
        },
        toolCards: {
            dice: { title: '骰子', shortTitle: '骰子', subtitle: '赛博骰盅 / 轻触即投', meta: '即时热身' },
            oldman: { title: '点老头', shortTitle: '点老头', subtitle: '老派划拳的仪式感', meta: '敬酒神招' },
            fingerpress: { title: '按手指', shortTitle: '按手指', subtitle: '极速裁决谁先干杯', meta: '现场裁判' },
            countdown: { title: '倒计时', shortTitle: '倒计时', subtitle: '手速决定谁先喝', meta: '反应游戏' },
            drunk: { title: '喝醉了吗', shortTitle: '喝醉没', subtitle: '看看你的手有多抖', meta: '清醒测试' },
            danmu: { title: '夜店弹幕', shortTitle: '发弹幕', subtitle: '全场最靓的仔', meta: '氛围神器' },
            flappy: { title: '像素鸟', shortTitle: '像素鸟', subtitle: '会跳的小鸟来咯', meta: '休闲游戏' },
            bottle: { title: '转酒瓶', shortTitle: '转酒瓶', subtitle: '瓶口指谁谁喝', meta: '随机裁判' }
        },
        games: {
            navTitle: '游戏大厅',
            pullToSwitch: '下滑切换',
            selectorTitle: '你的选择',
            detailView: '详情视图',
            simpleView: '简约视图',
            simpleScrollHint: '左右滑动查看更多',
            detailScrollHint: '上下滑动查看更多',
            closeHint: '点击空白处或上滑关闭',
            placeholderTitle: '更多游戏',
            placeholderDesc: '敬请期待',
            shareSuffix: '抓手指-满分激光枪',
            gameNames: {
                drinking: '得吃大逃杀',
                kiss: '二本吻痕',
                chess: '喝酒之弈',
                dare: '社死模拟器',
                we: '不是陌生人',
                zhexuejia: '哲学家酒牌',
                taiqiu: '台球之奕',
                couple_dare: '情侣心动挑战',
                couple_talk: '情侣暖甜交流',
                coffee: 'COFFEE CHAT',
                diy: 'DIY',
                more: '更多游戏'
            },
            gameShortNames: {
                drinking: '得吃',
                kiss: '吻痕',
                chess: '酒弈',
                dare: '社死',
                we: '陌生人',
                zhexuejia: '哲学',
                taiqiu: '台球',
                couple_dare: '心动',
                couple_talk: '暖甜',
                coffee: 'COFFEE',
                diy: 'DIY',
                more: '更多'
            },
            gameInfo: {
                drinking: {
                    name: '得吃大逃杀',
                    desc: 'CYBERPUNK',
                    intro: '- 赛博朋克风格经典卡牌\n- 惩罚刺激，越玩越嗨\n- 适合3-8人小聚',
                    tags: ['经典', '热门']
                },
                kiss: {
                    name: '二本吻痕',
                    desc: 'LES EDITION',
                    intro: '- 专为姐妹们设计的私密问答\n- 增进感情，打破尴尬\n- 大胆互动，甜蜜升温',
                    tags: ['姐妹局', '刺激']
                },
                chess: {
                    name: '喝酒之弈',
                    desc: 'STRATEGY',
                    intro: '- 策略博弈，智勇双全\n- 回合制玩法，考验脑力\n- 赢家制定规则，输家接受惩罚',
                    tags: ['策略', '烧脑']
                },
                dare: {
                    name: '社死模拟器',
                    desc: 'ADVENTURE',
                    intro: '- 胆量挑战，越玩越嗨\n- 真心话与大冒险结合\n- 突破舒适区，释放自我',
                    tags: ['冒险', '劲爆']
                },
                we: {
                    name: '不是陌生人',
                    desc: 'DEEP TALK',
                    intro: '- 灵魂共鸣，深度交流\n- 包含“朋友真心话”与“深度对话”双模式\n- 拉近距离，适合知己与情侣',
                    tags: ['走心', '共鸣']
                },
                zhexuejia: {
                    name: '哲学家酒牌',
                    desc: 'PHILOSOPHY',
                    intro: '- 与伟大思想家对饮\n- 趣味惩罚，哲思灵感\n- 翻转卡牌，探索背后故事',
                    tags: ['哲学', '翻转']
                },
                taiqiu: {
                    name: '台球之奕',
                    desc: 'BILLIARDS',
                    intro: '- 台球桌上的策略卡牌对决\n- 57张趣味技能牌，花式整活\n- 适合台球局双人对战',
                    tags: ['台球', '对战']
                },
                couple_dare: {
                    name: '情侣心动挑战',
                    desc: 'HEARTBEAT',
                    intro: '- 古典诗意，大胆挑战\n- 47张亲密互动卡牌\n- 从浅尝到深入，层层递进',
                    tags: ['情侣', '挑战']
                },
                couple_talk: {
                    name: '情侣暖甜交流',
                    desc: 'SWEET TALK',
                    intro: '- 灵魂对话，暖心交流\n- 48张深度话题卡牌\n- 走进彼此内心，升温感情',
                    tags: ['情侣', '走心']
                },
                coffee: {
                    name: 'COFFEE CHAT',
                    desc: 'NETWORKING',
                    intro: '- 107张深度社交对话卡牌\n- 覆盖职场、行业、AI、自我探索等话题\n- 适合商务社交与深度交流',
                    tags: ['社交', '深度']
                },
                diy: {
                    name: 'DIY',
                    desc: 'CUSTOM MIX',
                    intro: '- 人数、酒精与刺激度随你调\n- 从多套人气卡牌里智能混搭\n- 这一局，玩成你们自己的样子',
                    tags: ['自定义', '混搭']
                },
                more: {
                    name: '更多游戏',
                    desc: 'COMING SOON',
                    intro: '- 更多精彩游戏即将上线\n- 持续更新，敬请期待\n- 关注我们获取最新动态',
                    tags: ['敬请期待']
                }
            }
        },
        drinkingGame: {
            last: 'LAST',
            next: 'NEXT',
            shuffle: 'SHUFFLE',
            shuffling: '洗牌中...',
            flipFront: '👆 点击看看背面',
            flipBack: '👆 点击翻回正面',
            alreadyFirst: '已经是第一张了',
            brands: {
                drinking: {
                    grey: '小酌怡情',
                    green: '渐入佳境',
                    white: '酩酊大醉',
                    red: '无法无天',
                    black: '地狱模式'
                },
                kiss: '二本吻痕',
                chess: '喝酒之弈',
                dare: '社死模拟器',
                we: '不是陌生人',
                zhexuejia: '哲学家酒牌',
                taiqiu: '台球之奕',
                couple_dare: '情侣心动挑战',
                couple_talk: '情侣暖甜交流',
                coffee: 'COFFEE CHAT',
                diy: 'DIY'
            },
            diySources: {
                drinking: '得吃大逃杀',
                chess: '喝酒之弈',
                dare: '社死模拟器',
                we: '不是陌生人',
                couple_dare: '情侣心动挑战',
                couple_talk: '情侣暖甜交流',
                coffee: 'COFFEE CHAT',
                finger: '抓手指',
                zhexuejia: '哲学家酒牌',
                taiqiu: '台球之奕',
                kiss: '二本吻痕'
            }
        },
        diy: {
            navTitle: 'DIY',
            settings: 'DIY 设置',
            closeHint: '点击空白处关闭',
            players: '人数',
            alcohol: '酒精浓度',
            stimulation: '刺激程度',
            depth: '沟通深度',
            ambiguity: '暧昧程度',
            unlimited: '不限',
            peopleSuffix: '人'
        },
        finger: {
            navTitle: '抓手指',
            readyTitle: '准备好了吗？',
            readyContent: '点击 NEXT 开始',
            loading: 'LOADING...',
            imageEmpty: '这里空空如也',
            exit: 'EXIT',
            next: 'NEXT',
            last: 'LAST',
            newRound: '新一轮开始',
            notStarted: '还没开始游戏',
            alreadyFirst: '已经是第一张了',
            shareTitle: '抓手指 | 抓手指-满分激光枪'
        },
        fingerpress: {
            navTitle: '按手指',
            shareTitle: '按手指 | 抓手指-满分激光枪',
            back: '返回',
            maxPlayers: '最多5人',
            hintDesc: '多人同时按住屏幕',
            hintSubdesc: '系统将随机选出一名幸运儿',
            startZone: '点击此处开始选择',
            resultTitle: '就是你了',
            resultHint: '点击任意位置再来一局'
        },
        auth: {
            loginTitle: '欢迎来到满分激光枪',
            loginSubtitle: '登录后解锁更多精彩内容和个性化推荐',
            featurePersonalized: '个性化内容推荐',
            featureTools: '超多有趣喝酒道具',
            featureVip: '会员专享道具更新',
            loginButton: '微信快捷登录',
            cancelButton: '稍后再说',
            agreementTitle: '用户协议与隐私政策',
            agreementDesc: '为了更好地保障您的权益，请在注册前仔细阅读并同意以下协议：',
            agreementNotice: '点击“同意并注册”即表示您已阅读并同意上述协议',
            agreeButton: '同意并注册',
            disagreeButton: '暂不同意',
            inviteTitle: '请输入邀请码',
            inviteSubtitle: '当前为内测阶段，需邀请码注册',
            renewalTitle: '会员续费',
            renewalSubtitle: '您的会员已过期，请输入新的邀请码续费',
            verifyButton: '验证并进入',
            welcomeTitle: '注册成功！',
            welcomeSubtitle: '正在进入满分激光枪...',
            serviceAgreement: '《用户服务协议》',
            privacyPolicy: '《隐私保护政策》',
            loadingLogin: '登录中...',
            loadingRegister: '注册中...',
            loadingVerify: '校验中...',
            toastMembershipExpired: '会员已过期，请续费',
            toastRegisterFailed: '注册失败',
            toastLoginFailed: '登录失败，请重试',
            toastLoginRequired: '请登录以继续使用',
            toastRetryLogin: '连接失败，请重试',
            toastRetryConnect: '连接超时，请重试',
            toastNetworkError: '网络错误，请重试',
            toastNetworkFailed: '网络连接失败',
            toastInviteCodeRequired: '请输入邀请码',
            toastInviteInvalid: '邀请码无效，请重新输入',
            toastInviteExpired: '邀请码已过期',
            toastInviteUsed: '邀请码已被使用',
            toastVerifyFailed: '验证失败',
            toastCancelled: '已取消，请重新登录'
        }
    },
    'zh-Hant-TW': {
        common: {
            loading: '載入中...',
            submit: '送出中...',
            cancel: '取消',
            confirm: '確認',
            retry: '再試一次'
        },
        app: {
            defaultWindowTitle: '抓手指-滿分雷射槍'
        },
        tabBar: {
            home: '首頁',
            finger: '抓手指',
            games: '真心話大冒險',
            gamesShort: '遊戲',
            diy: '撲克牌',
            admin: '後台'
        },
        home: {
            navTitle: '抓手指-滿分雷射槍',
            skipSplash: '略過',
            brandTitle: '滿分雷射槍',
            brandSubtitle: 'FULL SCORE LASER',
            sectionRecent: '最近玩過',
            sectionTools: '喝酒道具',
            playerUnit: '人',
            welcomeBack: '歡迎回來',
            shareTitle: '首頁 | 抓手指-滿分雷射槍',
            specialBanner: {
                desc: '快來測一測',
                btnText: '看看'
            }
        },
        toolCards: {
            dice: { title: '骰子', shortTitle: '骰子', subtitle: '點一下就丟', meta: '暖場神器' },
            oldman: { title: '點老頭', shortTitle: '點老頭', subtitle: '復古划拳感', meta: '敬酒神招' },
            fingerpress: { title: '按手指', shortTitle: '按手指', subtitle: '秒判誰喝', meta: '現場裁判' },
            countdown: { title: '倒數計時', shortTitle: '倒數', subtitle: '手慢就喝', meta: '反應遊戲' },
            drunk: { title: '喝醉了嗎', shortTitle: '喝醉沒', subtitle: '手抖測試', meta: '清醒測試' },
            danmu: { title: '夜店彈幕', shortTitle: '發彈幕', subtitle: '全場焦點', meta: '氣氛神器' },
            flappy: { title: '像素鳥', shortTitle: '像素鳥', subtitle: '會跳的小鳥來啦', meta: '休閒小品' },
            bottle: { title: '轉酒瓶', shortTitle: '轉酒瓶', subtitle: '瓶口指誰誰喝', meta: '隨機裁判' }
        },
        games: {
            navTitle: '遊戲大廳',
            pullToSwitch: '下滑切換',
            selectorTitle: '你的選擇',
            detailView: '詳情檢視',
            simpleView: '簡約檢視',
            simpleScrollHint: '左右滑動查看更多',
            detailScrollHint: '上下滑動查看更多',
            closeHint: '點空白處或上滑關閉',
            placeholderTitle: '更多遊戲',
            placeholderDesc: '敬請期待',
            shareSuffix: '抓手指-滿分雷射槍',
            gameNames: {
                drinking: '得吃大逃殺',
                kiss: '二本吻痕',
                chess: '喝酒之弈',
                dare: '社死模擬器',
                we: '深聊局',
                zhexuejia: '哲學酒牌',
                taiqiu: '台球對奕',
                couple_dare: '心動挑戰',
                couple_talk: '暖甜對話',
                coffee: '咖啡聊聊',
                diy: 'DIY',
                more: '更多'
            },
            gameShortNames: {
                drinking: '得吃',
                kiss: '吻痕',
                chess: '酒弈',
                dare: '社死',
                we: '深聊',
                zhexuejia: '哲學',
                taiqiu: '對奕',
                couple_dare: '心動',
                couple_talk: '暖聊',
                coffee: '咖啡',
                diy: 'DIY',
                more: '更多'
            },
            gameInfo: {
                drinking: {
                    name: '得吃大逃殺',
                    desc: 'CYBERPUNK',
                    intro: '- 賽博風經典牌\n- 懲罰狠，氣氛快熱\n- 3-8 人剛剛好',
                    tags: ['經典', '熱門']
                },
                kiss: {
                    name: '二本吻痕',
                    desc: 'LES EDITION',
                    intro: '- 姐妹局私密問答\n- 破冰很快\n- 甜裡帶點壞',
                    tags: ['姐妹局', '刺激']
                },
                chess: {
                    name: '喝酒之弈',
                    desc: 'STRATEGY',
                    intro: '- 策略型喝酒對局\n- 回合制很有來回\n- 贏家定規則',
                    tags: ['策略', '燒腦']
                },
                dare: {
                    name: '社死模擬器',
                    desc: 'ADVENTURE',
                    intro: '- 膽量挑戰牌組\n- 真心話混大冒險\n- 很適合玩瘋',
                    tags: ['冒險', '勁爆']
                },
                we: {
                    name: '深聊局',
                    desc: 'DEEP TALK',
                    intro: '- 深聊型對話卡\n- 問題走心不硬尬\n- 知己跟情侶都適合',
                    tags: ['走心', '共鳴']
                },
                zhexuejia: {
                    name: '哲學酒牌',
                    desc: 'PHILOSOPHY',
                    intro: '- 和思想家邊喝邊聊\n- 正面鬧，背面想\n- 翻面更有戲',
                    tags: ['哲學', '翻面']
                },
                taiqiu: {
                    name: '台球對奕',
                    desc: 'BILLIARDS',
                    intro: '- 台球桌對戰卡\n- 57 張技能牌\n- 雙人局很對味',
                    tags: ['台球', '對戰']
                },
                couple_dare: {
                    name: '心動挑戰',
                    desc: 'HEARTBEAT',
                    intro: '- 看起來詩，玩起來辣\n- 47 張親密挑戰\n- 越玩越上頭',
                    tags: ['情侶', '挑戰']
                },
                couple_talk: {
                    name: '暖甜對話',
                    desc: 'SWEET TALK',
                    intro: '- 兩人暖聊卡\n- 48 個深聊題\n- 適合慢慢升溫',
                    tags: ['情侶', '走心']
                },
                coffee: {
                    name: '咖啡聊聊',
                    desc: 'NETWORKING',
                    intro: '- 107 張對話卡\n- 職場、AI、自我探索都聊\n- 咖啡聊或社交場都能用',
                    tags: ['社交', '深度']
                },
                diy: {
                    name: 'DIY',
                    desc: 'CUSTOM MIX',
                    intro: '- 人數、酒精與刺激度自己調\n- 從熱門牌組裡聰明混搭\n- 這一局玩成你們自己的樣子',
                    tags: ['自訂', '混搭']
                },
                more: {
                    name: '更多',
                    desc: 'COMING SOON',
                    intro: '- 新遊戲準備中\n- 還會繼續更新\n- 先追一下我們',
                    tags: ['敬請期待']
                }
            }
        },
        drinkingGame: {
            last: '上一張',
            next: '下一張',
            shuffle: '洗牌',
            shuffling: '洗牌中...',
            flipFront: '👆 點一下看看背面',
            flipBack: '👆 點一下翻回正面',
            alreadyFirst: '已經是第一張了',
            brands: {
                drinking: {
                    grey: '小酌怡情',
                    green: '漸入佳境',
                    white: '酩酊大醉',
                    red: '無法無天',
                    black: '地獄模式'
                },
                kiss: '二本吻痕',
                chess: '喝酒之弈',
                dare: '社死模擬器',
                we: '深聊局',
                zhexuejia: '哲學酒牌',
                taiqiu: '台球對奕',
                couple_dare: '心動挑戰',
                couple_talk: '暖甜對話',
                coffee: '咖啡聊聊',
                diy: 'DIY'
            },
            diySources: {
                drinking: '得吃大逃殺',
                chess: '喝酒之弈',
                dare: '社死模擬器',
                we: '深聊局',
                couple_dare: '心動挑戰',
                couple_talk: '暖甜對話',
                coffee: '咖啡聊聊',
                finger: '抓手指',
                zhexuejia: '哲學酒牌',
                taiqiu: '台球對奕',
                kiss: '二本吻痕'
            }
        },
        diy: {
            navTitle: 'DIY',
            settings: 'DIY 設定',
            closeHint: '點空白處關閉',
            players: '人數',
            alcohol: '酒精濃度',
            stimulation: '刺激程度',
            depth: '溝通深度',
            ambiguity: '曖昧程度',
            unlimited: '不限',
            peopleSuffix: '人'
        },
        finger: {
            navTitle: '抓手指',
            readyTitle: '準備好了嗎？',
            readyContent: '點 NEXT 開始',
            loading: 'LOADING...',
            imageEmpty: '這裡暫時空空的',
            exit: 'EXIT',
            next: 'NEXT',
            last: 'LAST',
            newRound: '新一輪開始',
            notStarted: '還沒開始遊戲',
            alreadyFirst: '已經是第一張了',
            shareTitle: '抓手指 | 抓手指-滿分雷射槍'
        },
        fingerpress: {
            navTitle: '按手指',
            shareTitle: '按手指 | 抓手指-滿分雷射槍',
            back: '返回',
            maxPlayers: '最多 5 人',
            hintDesc: '大家一起把手指按在螢幕上',
            hintSubdesc: '系統會隨機抽出一位幸運兒',
            startZone: '點這裡開始抽人',
            resultTitle: '就是你了',
            resultHint: '點任意位置再來一局'
        },
        auth: {
            loginTitle: '歡迎來到滿分雷射槍',
            loginSubtitle: '登入後解鎖更多精彩內容和個人化推薦',
            featurePersonalized: '個人化內容推薦',
            featureTools: '超多好玩的喝酒道具',
            featureVip: '會員專屬道具更新',
            loginButton: '微信快速登入',
            cancelButton: '稍後再說',
            agreementTitle: '用戶協議與隱私政策',
            agreementDesc: '為了保障你的權益，註冊前請先閱讀並同意以下條款：',
            agreementNotice: '點擊「同意並註冊」即表示你已閱讀並同意上述內容',
            agreeButton: '同意並註冊',
            disagreeButton: '先不要',
            inviteTitle: '請輸入邀請碼',
            inviteSubtitle: '目前仍是內測階段，需要邀請碼才能註冊',
            renewalTitle: '會員續費',
            renewalSubtitle: '你的會員已到期，請輸入新的邀請碼續費',
            verifyButton: '驗證並進入',
            welcomeTitle: '註冊成功！',
            welcomeSubtitle: '正在進入滿分雷射槍...',
            serviceAgreement: '《用戶服務協議》',
            privacyPolicy: '《隱私權政策》',
            loadingLogin: '登入中...',
            loadingRegister: '註冊中...',
            loadingVerify: '驗證中...',
            toastMembershipExpired: '會員已到期，請續費',
            toastRegisterFailed: '註冊失敗',
            toastLoginFailed: '登入失敗，請再試一次',
            toastLoginRequired: '請先登入再繼續使用',
            toastRetryLogin: '連線失敗，請再試一次',
            toastRetryConnect: '連線逾時，請稍後再試',
            toastNetworkError: '網路錯誤，請稍後再試',
            toastNetworkFailed: '網路連線失敗',
            toastInviteCodeRequired: '請輸入邀請碼',
            toastInviteInvalid: '邀請碼無效，請重新輸入',
            toastInviteExpired: '邀請碼已過期',
            toastInviteUsed: '邀請碼已被使用',
            toastVerifyFailed: '驗證失敗',
            toastCancelled: '已取消，請重新登入'
        }
    },
    en: {
        common: {
            loading: 'Loading...',
            submit: 'Submitting...',
            cancel: 'Cancel',
            confirm: 'Confirm',
            retry: 'Retry'
        },
        app: {
            defaultWindowTitle: 'Finger Grab - Full Score Laser'
        },
        tabBar: {
            home: 'Home',
            finger: 'Finger',
            games: 'Games',
            gamesShort: 'Games',
            diy: 'Cards',
            admin: 'Admin'
        },
        home: {
            navTitle: 'Finger Grab - Full Score Laser',
            skipSplash: 'Skip',
            brandTitle: 'Full Score Laser',
            brandSubtitle: 'FULL SCORE LASER',
            sectionRecent: 'Recently Played',
            sectionTools: 'Party Tools',
            playerUnit: ' ppl',
            welcomeBack: 'Welcome back',
            shareTitle: 'Home | Finger Grab - Full Score Laser',
            specialBanner: {
                desc: 'Take the quiz',
                btnText: 'Start'
            }
        },
        toolCards: {
            dice: { title: 'Dice', shortTitle: 'Dice', subtitle: 'Tap & roll', meta: 'Warm-up' },
            oldman: { title: 'Old Man', shortTitle: 'Old Man', subtitle: 'Tap at your risk', meta: 'Luck check' },
            fingerpress: { title: 'Finger Pick', shortTitle: 'Pick', subtitle: 'Who drinks?', meta: 'Random pick' },
            countdown: { title: 'Countdown', shortTitle: 'Timer', subtitle: 'Fast hands', meta: 'Reaction' },
            drunk: { title: 'Drunk?', shortTitle: 'Drunk?', subtitle: 'Shake check', meta: 'Shake test' },
            danmu: { title: 'LED Banner', shortTitle: 'Banner', subtitle: 'Main character', meta: 'Hype tool' },
            flappy: { title: 'Flappy Bird', shortTitle: 'Flappy', subtitle: 'Flap. Dodge. Repeat.', meta: 'Chill game' },
            bottle: { title: 'Bottle Spin', shortTitle: 'Bottle', subtitle: 'Spin to pick', meta: 'Random pick' }
        },
        games: {
            navTitle: 'Game Lobby',
            pullToSwitch: 'Pull Down',
            selectorTitle: 'Pick a Deck',
            detailView: 'Details',
            simpleView: 'Simple',
            simpleScrollHint: 'Swipe for more',
            detailScrollHint: 'Scroll for more',
            closeHint: 'Tap out or swipe up',
            placeholderTitle: 'More Games',
            placeholderDesc: 'Coming soon',
            shareSuffix: 'Finger Grab - Full Score Laser',
            gameNames: {
                drinking: 'Drink Raid',
                kiss: 'Kiss Marks',
                chess: 'Drink Chess',
                dare: 'Cringe Mode',
                we: 'Real Talk',
                zhexuejia: 'Philo Deck',
                taiqiu: 'Pool Duel',
                couple_dare: 'Heart Dares',
                couple_talk: 'Soft Talk',
                coffee: 'Coffee Chat',
                diy: 'DIY',
                more: 'More'
            },
            gameShortNames: {
                drinking: 'Raid',
                kiss: 'Kiss',
                chess: 'Chess',
                dare: 'Cringe',
                we: 'Real',
                zhexuejia: 'Philo',
                taiqiu: 'Pool',
                couple_dare: 'Heart',
                couple_talk: 'Soft',
                coffee: 'Coffee',
                diy: 'DIY',
                more: 'More'
            },
            gameInfo: {
                drinking: {
                    name: 'Drink Raid',
                    desc: 'CYBERPUNK',
                    intro: '- Cyberpunk party deck\n- Hard dares, fast hype\n- Best with 3-8 people',
                    tags: ['Classic', 'Popular']
                },
                kiss: {
                    name: 'Kiss Marks',
                    desc: 'LES EDITION',
                    intro: '- Flirty deck for girls\n- Kills awkward vibes fast\n- Sweet, bold, a bit feral',
                    tags: ['Girls Night', 'Spicy']
                },
                chess: {
                    name: 'Drink Chess',
                    desc: 'STRATEGY',
                    intro: '- Brainy, turn-based chaos\n- Bluff, plan, then punish\n- Winners set the rules',
                    tags: ['Strategy', 'Brainy']
                },
                dare: {
                    name: 'Cringe Mode',
                    desc: 'ADVENTURE',
                    intro: '- A dare deck with no brakes\n- Truth plus chaos in one pack\n- Great for pushing limits',
                    tags: ['Dare', 'Wild']
                },
                we: {
                    name: 'Real Talk',
                    desc: 'DEEP TALK',
                    intro: '- Truths + deep talk\n- Skip the small talk\n- For friends and couples',
                    tags: ['Deep', 'Connection']
                },
                zhexuejia: {
                    name: 'Philo Deck',
                    desc: 'PHILOSOPHY',
                    intro: '- Drink with dead geniuses\n- Chaos front, philosophy back\n- Flip for the full bit',
                    tags: ['Philosophy', 'Flip']
                },
                taiqiu: {
                    name: 'Pool Duel',
                    desc: 'BILLIARDS',
                    intro: '- Cards for pool-table duels\n- 57 skills to stir things up\n- Bring a 1v1 rival',
                    tags: ['Pool', 'Versus']
                },
                couple_dare: {
                    name: 'Heart Dares',
                    desc: 'HEARTBEAT',
                    intro: '- Soft look, spicy core\n- 47 dares for couples\n- Starts cute, ends bold',
                    tags: ['Couples', 'Spicy']
                },
                couple_talk: {
                    name: 'Soft Talk',
                    desc: 'SWEET TALK',
                    intro: '- Cozy deep-talk deck\n- 48 prompts for couples\n- Best for slow nights',
                    tags: ['Couples', 'Deep']
                },
                coffee: {
                    name: 'Coffee Chat',
                    desc: 'NETWORKING',
                    intro: '- 107 convo cards\n- Work, AI, life, self\n- Great for coffee chats',
                    tags: ['Social', 'Deep']
                },
                diy: {
                    name: 'DIY',
                    desc: 'CUSTOM MIX',
                    intro: '- Set players, drinks and spice\n- Mix your favorite decks\n- Your crew, your rules',
                    tags: ['Custom', 'Mixed']
                },
                more: {
                    name: 'More',
                    desc: 'COMING SOON',
                    intro: '- More decks are cooking\n- Updates keep coming\n- Stay tuned',
                    tags: ['Soon']
                }
            }
        },
        drinkingGame: {
            last: 'PREV',
            next: 'NEXT',
            shuffle: 'SHUFFLE',
            shuffling: 'Shuffling...',
            flipFront: '👆 Flip over',
            flipBack: '👆 Flip back',
            alreadyFirst: 'First card already',
            brands: {
                drinking: {
                    grey: 'Warm-Up',
                    green: 'Getting There',
                    white: 'Wasted',
                    red: 'No Mercy',
                    black: 'Hell Mode'
                },
                kiss: 'Kiss Marks',
                chess: 'Drink Chess',
                dare: 'Cringe Mode',
                we: 'Real Talk',
                zhexuejia: 'Philo Deck',
                taiqiu: 'Pool Duel',
                couple_dare: 'Heart Dares',
                couple_talk: 'Soft Talk',
                coffee: 'Coffee Chat',
                diy: 'DIY'
            },
            diySources: {
                drinking: 'Drink Raid',
                chess: 'Drink Chess',
                dare: 'Cringe Mode',
                we: 'Real Talk',
                couple_dare: 'Heart Dares',
                couple_talk: 'Soft Talk',
                coffee: 'Coffee Chat',
                finger: 'Finger Grab',
                zhexuejia: 'Philo Deck',
                taiqiu: 'Pool Duel',
                kiss: 'Kiss Marks'
            }
        },
        diy: {
            navTitle: 'DIY',
            settings: 'DIY Setup',
            closeHint: 'Tap outside to close',
            players: 'Players',
            alcohol: 'Alcohol',
            stimulation: 'Spice',
            depth: 'Depth',
            ambiguity: 'Flirt Level',
            unlimited: 'No Limit',
            peopleSuffix: 'P'
        },
        finger: {
            navTitle: 'Finger Grab',
            readyTitle: 'Ready?',
            readyContent: 'Tap NEXT to start',
            loading: 'LOADING...',
            imageEmpty: 'Nothing to see here yet',
            exit: 'EXIT',
            next: 'NEXT',
            last: 'PREV',
            newRound: 'Fresh round, let’s go',
            notStarted: 'Start a round first',
            alreadyFirst: 'First card already',
            shareTitle: 'Finger Grab | Full Score Laser'
        },
        fingerpress: {
            navTitle: 'Finger Pick',
            shareTitle: 'Finger Pick | Full Score Laser',
            back: 'Back',
            maxPlayers: 'Max 5 players',
            hintDesc: 'Everyone hold a finger down',
            hintSubdesc: 'One random pick. Who’s it?',
            startZone: 'Tap here to pick',
            resultTitle: 'It’s you.',
            resultHint: 'Tap anywhere to replay'
        },
        auth: {
            loginTitle: 'Welcome, party crew',
            loginSubtitle: 'Sign in to unlock more chaos, more tools, and better picks for your vibe.',
            featurePersonalized: 'Picks for your vibe',
            featureTools: 'Party tools for days',
            featureVip: 'Members-only deck drops',
            loginButton: 'WeChat Login',
            cancelButton: 'Maybe later',
            agreementTitle: 'Terms & Privacy',
            agreementDesc: 'Please read and agree to the following before creating your account:',
            agreementNotice: 'By tapping "Agree & Join", you confirm that you have read and accepted the terms above.',
            agreeButton: 'Agree & Join',
            disagreeButton: 'Not now',
            inviteTitle: 'Enter invite code',
            inviteSubtitle: 'This app is still in closed beta, so an invite code is required.',
            renewalTitle: 'Renew membership',
            renewalSubtitle: 'Your membership expired. Enter a fresh invite code to renew it.',
            verifyButton: 'Verify & Join',
            welcomeTitle: 'You are in.',
            welcomeSubtitle: 'Jumping into Full Score Laser...',
            serviceAgreement: 'Terms of Service',
            privacyPolicy: 'Privacy Policy',
            loadingLogin: 'Signing in...',
            loadingRegister: 'Creating account...',
            loadingVerify: 'Checking code...',
            toastMembershipExpired: 'Your access expired. Renew to keep going.',
            toastRegisterFailed: 'Sign-up failed',
            toastLoginFailed: 'Sign-in failed. Try again.',
            toastLoginRequired: 'Sign in to keep using this feature',
            toastRetryLogin: 'Connection failed. Try again.',
            toastRetryConnect: 'Timed out. Try again.',
            toastNetworkError: 'Network error. Try again.',
            toastNetworkFailed: 'Network connection failed.',
            toastInviteCodeRequired: 'Enter your invite code',
            toastInviteInvalid: 'That invite code does not look right.',
            toastInviteExpired: 'That invite code has expired.',
            toastInviteUsed: 'That invite code was already used.',
            toastVerifyFailed: 'Code verification failed.',
            toastCancelled: 'Cancelled. Please sign in again.'
        }
    },
    ja: {
        common: {
            loading: '読み込み中...',
            submit: '送信中...',
            cancel: 'キャンセル',
            confirm: '確認',
            retry: '再試行'
        },
        app: {
            defaultWindowTitle: '指キャッチ - フルスコアレーザー'
        },
        tabBar: {
            home: 'ホーム',
            finger: '指キャッチ',
            games: '真実か挑戦',
            gamesShort: 'ゲーム',
            diy: 'トランプ',
            admin: '管理'
        },
        home: {
            navTitle: '指キャッチ - フルスコアレーザー',
            skipSplash: 'スキップ',
            brandTitle: 'Full Score Laser',
            brandSubtitle: 'FULL SCORE LASER',
            sectionRecent: '最近プレイしたもの',
            sectionTools: '飲み会ツール',
            playerUnit: '人',
            welcomeBack: 'おかえり',
            shareTitle: 'ホーム | 指キャッチ - フルスコアレーザー',
            specialBanner: {
                desc: 'サクッと見てみる',
                btnText: '見に行く'
            }
        },
        toolCards: {
            dice: { title: 'サイコロ', shortTitle: 'サイコロ', subtitle: 'タップで振る', meta: '場あたため' },
            oldman: { title: 'オヤジ当て', shortTitle: 'オヤジ', subtitle: 'レトロ勝負', meta: '乾杯ネタ' },
            fingerpress: { title: '指押し', shortTitle: '指押し', subtitle: '飲み即決', meta: '判定係' },
            countdown: { title: 'カウント', shortTitle: 'タイマー', subtitle: '手速勝負', meta: '反応勝負' },
            drunk: { title: '酔ってる？', shortTitle: '酔い度', subtitle: '手ブレ診断', meta: '酔い診断' },
            danmu: { title: '電光ボード', shortTitle: 'ボード', subtitle: '主役モード', meta: '盛り上げ' },
            flappy: { title: 'ピクセルバード', shortTitle: 'バード', subtitle: '跳ぶトリ、来たよ', meta: '暇つぶし' },
            bottle: { title: 'ボトル回し', shortTitle: 'ボトル', subtitle: '瓶口が向いた人が飲む', meta: 'ランダム指名' }
        },
        games: {
            navTitle: 'ゲームロビー',
            pullToSwitch: '下にスワイプ',
            selectorTitle: 'どれにする？',
            detailView: '詳しく',
            simpleView: 'シンプル表示',
            simpleScrollHint: '左右で切替',
            detailScrollHint: '上下で見る',
            closeHint: '外タップか上スワイプで閉じる',
            placeholderTitle: 'もっとゲーム',
            placeholderDesc: '近日追加',
            shareSuffix: '指キャッチ - フルスコアレーザー',
            gameNames: {
                drinking: '飲みサバ',
                kiss: 'キスマーク',
                chess: '飲みチェス',
                dare: '黒歴史メーカー',
                we: '深トーク',
                zhexuejia: '哲学デッキ',
                taiqiu: 'ビリヤード',
                couple_dare: '恋人ミッション',
                couple_talk: 'ふたりトーク',
                coffee: 'コーヒートーク',
                diy: 'DIY',
                more: 'もっと'
            },
            gameShortNames: {
                drinking: '飲み',
                kiss: 'キス',
                chess: 'チェス',
                dare: '黒歴史',
                we: '深ト',
                zhexuejia: '哲学',
                taiqiu: 'ビリヤ',
                couple_dare: '恋ミ',
                couple_talk: 'ふたり',
                coffee: 'コーヒー',
                diy: 'DIY',
                more: 'もっと'
            },
            gameInfo: {
                drinking: {
                    name: '飲みサバ',
                    desc: 'CYBERPUNK',
                    intro: '- サイパン系飲みデッキ\n- 罰重めで一気に上がる\n- 3〜8人向け',
                    tags: ['定番', '人気']
                },
                kiss: {
                    name: 'キスマーク',
                    desc: 'LES EDITION',
                    intro: '- 女子会向け濃い質問\n- 気まずさを即オフ\n- 甘めでちゃんと攻める',
                    tags: ['ガールズ', '刺激']
                },
                chess: {
                    name: '飲みチェス',
                    desc: 'STRATEGY',
                    intro: '- 頭脳派の飲み勝負\n- ターン制で駆け引き濃い\n- 勝者がルール担当',
                    tags: ['戦略', '頭脳']
                },
                dare: {
                    name: '黒歴史メーカー',
                    desc: 'ADVENTURE',
                    intro: '- 度胸試し特化デッキ\n- TruthもDareも入る\n- 殻を破りたい夜向け',
                    tags: ['挑戦', 'カオス']
                },
                we: {
                    name: '深トーク',
                    desc: 'DEEP TALK',
                    intro: '- 深く話せる会話カード\n- 表面トークで終わらない\n- 親友や気になる相手向け',
                    tags: ['深い', '共感']
                },
                zhexuejia: {
                    name: '哲学デッキ',
                    desc: 'PHILOSOPHY',
                    intro: '- 哲学者気分で乾杯\n- 表は遊び、裏は思想\n- めくると余韻も濃い',
                    tags: ['哲学', '反転']
                },
                taiqiu: {
                    name: 'ビリヤード',
                    desc: 'BILLIARDS',
                    intro: '- ビリヤード用対戦カード\n- 57枚で小技を回す\n- 2人戦にちょうどいい',
                    tags: ['ビリヤード', '対戦']
                },
                couple_dare: {
                    name: '恋人ミッション',
                    desc: 'HEARTBEAT',
                    intro: '- 見た目は詩的、中身は攻め\n- カップル向け47ミッション\n- じわじわ熱くなる',
                    tags: ['カップル', '刺激']
                },
                couple_talk: {
                    name: 'ふたりトーク',
                    desc: 'SWEET TALK',
                    intro: '- ふたりで深く話すカード\n- 感情を開く48問\n- しっとり夜向け',
                    tags: ['カップル', '深い']
                },
                coffee: {
                    name: 'コーヒートーク',
                    desc: 'NETWORKING',
                    intro: '- 会話カード107枚\n- 仕事もAIも自己理解も\n- コーヒーチャット向け',
                    tags: ['交流', '深い']
                },
                diy: {
                    name: 'DIY',
                    desc: 'CUSTOM MIX',
                    intro: '- 人数も酒量も刺激も自分好み\n- 人気デッキをいい感じにミックス\n- 今夜だけのマイデッキを作ろう',
                    tags: ['カスタム', 'ミックス']
                },
                more: {
                    name: 'もっと',
                    desc: 'COMING SOON',
                    intro: '- 新作デッキ準備中\n- まだまだ追加予定\n- 気長に待ってて',
                    tags: ['近日']
                }
            }
        },
        drinkingGame: {
            last: '前へ',
            next: '次へ',
            shuffle: 'シャッフル',
            shuffling: 'シャッフル中...',
            flipFront: '👆 裏を見る',
            flipBack: '👆 表に戻す',
            alreadyFirst: 'もう最初のカードです',
            brands: {
                drinking: {
                    grey: 'ウォームアップ',
                    green: 'いい感じ',
                    white: 'ベロベロ',
                    red: '容赦なし',
                    black: '地獄モード'
                },
                kiss: 'キスマーク',
                chess: '飲みチェス',
                dare: '黒歴史メーカー',
                we: '深トーク',
                zhexuejia: '哲学デッキ',
                taiqiu: 'ビリヤード',
                couple_dare: '恋人ミッション',
                couple_talk: 'ふたりトーク',
                coffee: 'コーヒートーク',
                diy: 'DIY'
            },
            diySources: {
                drinking: '飲みサバ',
                chess: '飲みチェス',
                dare: '黒歴史メーカー',
                we: '深トーク',
                couple_dare: '恋人ミッション',
                couple_talk: 'ふたりトーク',
                coffee: 'コーヒートーク',
                finger: '指キャッチ',
                zhexuejia: '哲学デッキ',
                taiqiu: 'ビリヤード',
                kiss: 'キスマーク'
            }
        },
        diy: {
            navTitle: 'DIY',
            settings: 'DIY設定',
            closeHint: '外側をタップして閉じる',
            players: '人数',
            alcohol: '酒量',
            stimulation: '刺激度',
            depth: '深さ',
            ambiguity: 'イチャ度',
            unlimited: '制限なし',
            peopleSuffix: '人'
        },
        finger: {
            navTitle: '指キャッチ',
            readyTitle: '準備OK？',
            readyContent: 'NEXT を押してスタート',
            loading: 'LOADING...',
            imageEmpty: 'まだ何も表示できません',
            exit: 'EXIT',
            next: 'NEXT',
            last: 'LAST',
            newRound: '新しいラウンド開始',
            notStarted: 'まだ始まっていません',
            alreadyFirst: 'もう最初のカードです',
            shareTitle: '指キャッチ | Full Score Laser'
        },
        fingerpress: {
            navTitle: '指押し',
            shareTitle: '指押し | Full Score Laser',
            back: '戻る',
            maxPlayers: '最大5人',
            hintDesc: 'みんなで同時に画面を押してね',
            hintSubdesc: '誰が当たるか運次第！',
            startZone: 'タップで抽選',
            resultTitle: '君の番。',
            resultHint: 'どこでもタップでもう一回'
        },
        auth: {
            loginTitle: 'ようこそ、飲み仲間！',
            loginSubtitle: 'ログインすると、もっと面白いコンテンツやおすすめが解放されます。',
            featurePersonalized: 'あなた向けのおすすめ',
            featureTools: '飲み会ツールが勢ぞろい',
            featureVip: '会員限定デッキの追加もあり',
            loginButton: 'WeChatでログイン',
            cancelButton: 'あとで',
            agreementTitle: '利用規約とプライバシー',
            agreementDesc: '登録前に、以下の内容を確認して同意してください。',
            agreementNotice: '「同意して登録」を押すと、上記内容に同意したものとみなされます。',
            agreeButton: '同意して登録',
            disagreeButton: '今はしない',
            inviteTitle: '招待コードを入力',
            inviteSubtitle: '現在はクローズドβのため、招待コードが必要です。',
            renewalTitle: '会員更新',
            renewalSubtitle: '会員期限が切れました。新しい招待コードを入力してください。',
            verifyButton: '確認して入る',
            welcomeTitle: '登録完了！',
            welcomeSubtitle: 'Full Score Laser に入ります...',
            serviceAgreement: '利用規約',
            privacyPolicy: 'プライバシーポリシー',
            loadingLogin: 'ログイン中...',
            loadingRegister: '登録中...',
            loadingVerify: 'コード確認中...',
            toastMembershipExpired: '利用期限が切れました。継続するには更新してください。',
            toastRegisterFailed: '登録に失敗しました',
            toastLoginFailed: 'ログインに失敗しました。もう一度お試しください。',
            toastLoginRequired: 'この機能を使うにはログインが必要です',
            toastRetryLogin: '接続に失敗しました。再試行してください。',
            toastRetryConnect: 'タイムアウトしました。もう一度お試しください。',
            toastNetworkError: '通信エラーです。もう一度お試しください。',
            toastNetworkFailed: 'ネットワーク接続に失敗しました。',
            toastInviteCodeRequired: '招待コードを入力してください',
            toastInviteInvalid: '招待コードが正しくありません。',
            toastInviteExpired: '招待コードの期限が切れています。',
            toastInviteUsed: 'その招待コードはすでに使用済みです。',
            toastVerifyFailed: 'コード確認に失敗しました。',
            toastCancelled: 'キャンセルされました。もう一度ログインしてください。'
        }
    },
    ko: {
        common: {
            loading: '불러오는 중...',
            submit: '전송 중...',
            cancel: '취소',
            confirm: '확인',
            retry: '다시 시도'
        },
        app: {
            defaultWindowTitle: '핑거 캐치 - 풀 스코어 레이저'
        },
        tabBar: {
            home: '홈',
            finger: '핑거',
            games: '진실게임',
            gamesShort: '게임',
            diy: '카드',
            admin: '관리'
        },
        home: {
            navTitle: '핑거 캐치 - 풀 스코어 레이저',
            skipSplash: '건너뛰기',
            brandTitle: 'Full Score Laser',
            brandSubtitle: 'FULL SCORE LASER',
            sectionRecent: '최근 플레이',
            sectionTools: '술자리 도구',
            playerUnit: '명',
            welcomeBack: '다시 왔네',
            shareTitle: '홈 | 핑거 캐치 - 풀 스코어 레이저',
            specialBanner: {
                desc: '가볍게 테스트',
                btnText: '보러 가기'
            }
        },
        toolCards: {
            dice: { title: '주사위', shortTitle: '주사위', subtitle: '톡 굴리기', meta: '워밍업' },
            oldman: { title: '올드맨', shortTitle: '올드맨', subtitle: '레트로 승부', meta: '건배 스킬' },
            fingerpress: { title: '핑거탭', shortTitle: '탭', subtitle: '즉석 술픽', meta: '현장 심판' },
            countdown: { title: '카운트', shortTitle: '카운트', subtitle: '손 빠른 자 승리', meta: '반응 게임' },
            drunk: { title: '취했어?', shortTitle: '취했어?', subtitle: '손떨림 체크', meta: '상태 체크' },
            danmu: { title: '전광판', shortTitle: '전광판', subtitle: '주인공 모드', meta: '분위기 업' },
            flappy: { title: '픽셀 버드', shortTitle: '버드', subtitle: '통통 뛰는 새가 왔다', meta: '킬링타임' },
            bottle: { title: '병 돌리기', shortTitle: '병 돌리기', subtitle: '병이 가리킨 사람이 마셔', meta: '랜덤 지목' }
        },
        games: {
            navTitle: '게임 로비',
            pullToSwitch: '아래로 당겨 전환',
            selectorTitle: '뭘로 갈래',
            detailView: '자세히',
            simpleView: '심플',
            simpleScrollHint: '좌우로 더 보기',
            detailScrollHint: '스크롤 더 보기',
            closeHint: '바깥 탭이나 위로 닫기',
            placeholderTitle: '더 많은 게임',
            placeholderDesc: '곧 추가됩니다',
            shareSuffix: '핑거 캐치 - 풀 스코어 레이저',
            gameNames: {
                drinking: '술판 로얄',
                kiss: '키스마크',
                chess: '술체스',
                dare: '흑역사 제조기',
                we: '리얼톡',
                zhexuejia: '철학자 덱',
                taiqiu: '당구 대전',
                couple_dare: '심쿵 미션',
                couple_talk: '둘만의 톡',
                coffee: '커피챗',
                diy: 'DIY',
                more: '더보기'
            },
            gameShortNames: {
                drinking: '로얄',
                kiss: '키스',
                chess: '체스',
                dare: '흑역사',
                we: '리얼',
                zhexuejia: '철학',
                taiqiu: '당구',
                couple_dare: '심쿵',
                couple_talk: '톡',
                coffee: '커피',
                diy: 'DIY',
                more: '더'
            },
            gameInfo: {
                drinking: {
                    name: '술판 로얄',
                    desc: 'CYBERPUNK',
                    intro: '- 사이버펑크 술게임 덱\n- 벌칙 세고 텐션 좋음\n- 3~8명 모임 추천',
                    tags: ['클래식', '인기']
                },
                kiss: {
                    name: '키스마크',
                    desc: 'LES EDITION',
                    intro: '- 걸스나잇용 진한 질문\n- 어색함 순삭\n- 달달한데 꽤 세다',
                    tags: ['걸스나잇', '스파이시']
                },
                chess: {
                    name: '술체스',
                    desc: 'STRATEGY',
                    intro: '- 머리 쓰는 술게임\n- 턴제로 수 싸움 쫀쫀\n- 이긴 쪽이 룰 정함',
                    tags: ['전략', '두뇌']
                },
                dare: {
                    name: '흑역사 제조기',
                    desc: 'ADVENTURE',
                    intro: '- 배짱 테스트용 덱\n- 진실게임+벌칙 한 팩\n- 선 넘고 싶은 밤용',
                    tags: ['도전', '혼돈']
                },
                we: {
                    name: '리얼톡',
                    desc: 'DEEP TALK',
                    intro: '- 깊게 얘기하는 카드\n- 겉도는 질문이 없음\n- 친한 사이나 썸에 딱',
                    tags: ['딥토크', '연결']
                },
                zhexuejia: {
                    name: '철학자 덱',
                    desc: 'PHILOSOPHY',
                    intro: '- 철학자 느낌으로 한 잔\n- 앞은 장난, 뒤는 생각\n- 뒤집는 맛이 포인트',
                    tags: ['철학', '플립']
                },
                taiqiu: {
                    name: '당구 대전',
                    desc: 'BILLIARDS',
                    intro: '- 당구대용 대전 카드\n- 57장으로 잔기술 가능\n- 2인전에 딱',
                    tags: ['당구', '대전']
                },
                couple_dare: {
                    name: '심쿵 미션',
                    desc: 'HEARTBEAT',
                    intro: '- 겉은 시적, 속은 매움\n- 커플용 미션 47장\n- 갈수록 수위 업',
                    tags: ['커플', '스파이시']
                },
                couple_talk: {
                    name: '둘만의 톡',
                    desc: 'SWEET TALK',
                    intro: '- 둘이 깊게 얘기하는 카드\n- 감정 여는 질문 48개\n- 잔잔한 밤에 잘 맞음',
                    tags: ['커플', '딥']
                },
                coffee: {
                    name: '커피챗',
                    desc: 'NETWORKING',
                    intro: '- 대화 카드 107장\n- 일, AI, 자기탐색까지\n- 커피챗에 딱',
                    tags: ['소셜', '딥']
                },
                diy: {
                    name: 'DIY',
                    desc: 'CUSTOM MIX',
                    intro: '- 인원, 술, 자극 수위까지 내 맘대로\n- 인기 덱을 취향대로 믹스\n- 오늘 판은 우리 스타일로',
                    tags: ['커스텀', '믹스']
                },
                more: {
                    name: '더보기',
                    desc: 'COMING SOON',
                    intro: '- 새 덱 준비 중\n- 계속 업데이트 예정\n- 조금만 기다려',
                    tags: ['예정']
                }
            }
        },
        drinkingGame: {
            last: '이전',
            next: '다음',
            shuffle: '셔플',
            shuffling: '셔플 중...',
            flipFront: '👆 뒷면 보기',
            flipBack: '👆 앞면 보기',
            alreadyFirst: '이미 첫 카드예요',
            brands: {
                drinking: {
                    grey: '가볍게 시작',
                    green: '슬슬 오른다',
                    white: '만취 코스',
                    red: '자비 없음',
                    black: '헬 모드'
                },
                kiss: '키스마크',
                chess: '술체스',
                dare: '흑역사 제조기',
                we: '리얼톡',
                zhexuejia: '철학자 덱',
                taiqiu: '당구 대전',
                couple_dare: '심쿵 미션',
                couple_talk: '둘만의 톡',
                coffee: '커피챗',
                diy: 'DIY'
            },
            diySources: {
                drinking: '술판 로얄',
                chess: '술체스',
                dare: '흑역사 제조기',
                we: '리얼톡',
                couple_dare: '심쿵 미션',
                couple_talk: '둘만의 톡',
                coffee: '커피챗',
                finger: '핑거 캐치',
                zhexuejia: '철학자 덱',
                taiqiu: '당구 대전',
                kiss: '키스마크'
            }
        },
        diy: {
            navTitle: 'DIY',
            settings: 'DIY 설정',
            closeHint: '바깥쪽을 눌러 닫기',
            players: '인원',
            alcohol: '술 강도',
            stimulation: '자극도',
            depth: '대화 깊이',
            ambiguity: '썸 농도',
            unlimited: '제한 없음',
            peopleSuffix: '명'
        },
        finger: {
            navTitle: '핑거 캐치',
            readyTitle: '준비됐어?',
            readyContent: 'NEXT 눌러서 시작',
            loading: 'LOADING...',
            imageEmpty: '아직 보여줄 게 없어요',
            exit: 'EXIT',
            next: 'NEXT',
            last: 'LAST',
            newRound: '새 라운드 시작',
            notStarted: '아직 시작 전이야',
            alreadyFirst: '이미 첫 번째 카드야',
            shareTitle: '핑거 캐치 | Full Score Laser'
        },
        fingerpress: {
            navTitle: '핑거탭',
            shareTitle: '핑거탭 | Full Score Laser',
            back: '뒤로',
            maxPlayers: '최대 5명',
            hintDesc: '다 같이 화면을 누르고 있어',
            hintSubdesc: '랜덤 한 명, 과연 누구?',
            startZone: '여길 눌러서 시작',
            resultTitle: '너 차례야.',
            resultHint: '아무 데나 눌러서 한 판 더'
        },
        auth: {
            loginTitle: '어서 와, 술친구!',
            loginSubtitle: '로그인하면 더 많은 콘텐츠와 맞춤 추천을 볼 수 있어.',
            featurePersonalized: '상황 맞춤 추천',
            featureTools: '술자리 도구 한가득',
            featureVip: '멤버 전용 덱 업데이트',
            loginButton: 'WeChat으로 로그인',
            cancelButton: '나중에',
            agreementTitle: '약관 및 개인정보',
            agreementDesc: '가입 전에 아래 내용을 읽고 동의해 주세요.',
            agreementNotice: '"동의하고 가입"을 누르면 위 내용에 동의한 것으로 간주됩니다.',
            agreeButton: '동의하고 가입',
            disagreeButton: '지금은 안 할래',
            inviteTitle: '초대 코드를 입력해',
            inviteSubtitle: '현재 클로즈드 베타라서 초대 코드가 필요해.',
            renewalTitle: '멤버십 연장',
            renewalSubtitle: '멤버십이 만료됐어. 새 초대 코드를 입력해 줘.',
            verifyButton: '확인하고 입장',
            welcomeTitle: '가입 완료!',
            welcomeSubtitle: '풀 스코어 레이저로 들어가는 중...',
            serviceAgreement: '서비스 약관',
            privacyPolicy: '개인정보 처리방침',
            loadingLogin: '로그인 중...',
            loadingRegister: '가입 처리 중...',
            loadingVerify: '코드 확인 중...',
            toastMembershipExpired: '이용 기간이 끝났어요. 계속하려면 갱신해 주세요.',
            toastRegisterFailed: '가입에 실패했어요',
            toastLoginFailed: '로그인에 실패했어요. 다시 시도해 주세요.',
            toastLoginRequired: '이 기능을 쓰려면 로그인해야 해요',
            toastRetryLogin: '연결에 실패했어요. 다시 시도해 주세요.',
            toastRetryConnect: '시간이 초과됐어요. 다시 시도해 주세요.',
            toastNetworkError: '네트워크 오류예요. 다시 시도해 주세요.',
            toastNetworkFailed: '네트워크 연결에 실패했어요.',
            toastInviteCodeRequired: '초대 코드를 입력해 주세요',
            toastInviteInvalid: '초대 코드가 올바르지 않아요.',
            toastInviteExpired: '초대 코드가 만료됐어요.',
            toastInviteUsed: '이미 사용된 초대 코드예요.',
            toastVerifyFailed: '코드 확인에 실패했어요.',
            toastCancelled: '취소됐어요. 다시 로그인해 주세요.'
        }
    }
};

function isPlainObject(value) {
    return !!value && Object.prototype.toString.call(value) === '[object Object]';
}

function deepClone(value) {
    if (Array.isArray(value)) {
        return value.map(deepClone);
    }
    if (isPlainObject(value)) {
        var cloned = {};
        Object.keys(value).forEach(function (key) {
            cloned[key] = deepClone(value[key]);
        });
        return cloned;
    }
    return value;
}

function deepMerge(base, extra) {
    var result = deepClone(base);
    Object.keys(extra || {}).forEach(function (key) {
        var extraValue = extra[key];
        var baseValue = result[key];
        if (isPlainObject(baseValue) && isPlainObject(extraValue)) {
            result[key] = deepMerge(baseValue, extraValue);
        } else {
            result[key] = deepClone(extraValue);
        }
    });
    return result;
}

const MERGED_UI_COPY = deepMerge(UI_COPY, UI_COPY_EXTRA);

module.exports = {
    UI_COPY: MERGED_UI_COPY
};
