/**
* 全局配置常量
* 集中管理所有配置项，便于维护和修改
*/

// ==================== 云环境配置 ====================
const CLOUD_ENV = 'cloud1-8g74dghocf4b61d4';

// ==================== 应用版本 ====================
// 每次发版时更新此版本号，用于更新通知功能
const APP_VERSION = '0.4.3';

// ==================== 云存储文件ID ====================
// 字体文件 ID；图片资源见 IMAGE_URLS 和 TOOL_CARDS。
const CLOUD_FILE_IDS = {
    // 字体文件（云存储，本地缓存24小时）
    TITLE_FONT: 'cloud://cloud1-8g74dghocf4b61d4.636c-cloud1-8g74dghocf4b61d4-1388894526/ff/titleF_subset.otf',
    SUBTITLE_FONT: 'cloud://cloud1-8g74dghocf4b61d4.636c-cloud1-8g74dghocf4b61d4-1388894526/ff/titleF1_subset.otf'
};

// ==================== 图片资源（随包图片及外部URL） ====================
const IMAGE_URLS = {
    // 首页资源
    WELCOME_GIF: 'https://tvax2.sinaimg.cn/large/00688Ukogy1i7yvdq079wg30lc0lce83.gif',
    LOGO: '/logo.png',
    // 骰子卡片图片（透明背景）
    DICE_IMAGE: '/image-pack-tools/dice-e8bc5ad5.png',
    // 点老头卡片图片（透明背景）
    OLDMAN_CARD_IMAGE: '/image-pack-tools/oldman-normal-1a7fa183.png',
    // 按手指卡片图片（透明背景）
    FINGER_CARD_IMAGE: '/image-pack-tools/finger-3b096378.png',
    // 抓手指页面图片
    FINGER_IMAGES: [
        'https://tvax3.sinaimg.cn/large/00688Ukogy1i7yxlt1lj6j30zk0qo43h.jpg',
        'https://tvax1.sinaimg.cn/large/00688Ukogy1i7yxmx2xaoj31uo1dse83.jpg',
        'https://tvax2.sinaimg.cn/large/00688Ukogy1i7yxn8t2q1j31uo1ds7wm.jpg'
    ],
    // 点老头游戏图片（透明背景）
    OLDMAN_NORMAL: '/image-pack-tools/oldman-normal-1a7fa183.png',
    OLDMAN_ANGRY: '/image-pack-tools/oldman-angry-b8bb5caa.png',
    // 默认封面图（文章无封面时使用）
    DEFAULT_COVER: 'https://images.unsplash.com/photo-1535295972055-1c762f4483e5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
};

// ==================== 缓存配置 ====================
const CACHE_CONFIG = {
    // 文章缓存时间（毫秒）
    ARTICLE_TTL: 30 * 60 * 1000, // 30分钟
    // 登录缓存时间（毫秒）
    LOGIN_TTL: 60 * 1000, // 1分钟
    // 本地存储键名
    STORAGE_KEYS: {
        ARTICLES: 'cached_articles',
        ARTICLES_TIME: 'cached_articles_time',
        BANNER_ARTICLE: 'cached_banner_article',
        BANNER_ARTICLE_TIME: 'cached_banner_time'
    }
};

// ==================== 云函数配置 ====================
const CLOUD_FUNCTION_CONFIG = {
    TIMEOUT: 15000, // 15秒
    WARMUP_TIMEOUT: 20000, // 20秒预热超时
    MAX_RETRY: 1,
    RETRY_DELAY: 500
};

// ==================== UI配置 ====================
const UI_CONFIG = {
    // 主题色
    COLORS: {
        PRIMARY: '#39FF14', // 霓虹绿
        BACKGROUND: '#050505',
        TEXT: '#eeeeee',
        ACCENT_RED: '#FF0055',
        ACCENT_CYAN: '#00FFFF'
    },
    // 标签颜色池
    TAG_COLORS: [
        '#39FF14', '#00FFFF', '#FF3333', '#FF00FF', '#AA00FF',
        '#00FF99', '#FFFF00', '#FF0055', '#CCCCCC', '#0088FF',
        '#FF6600', '#FFAA00', '#FF0099'
    ],
    // 动画时长
    ANIMATION: {
        SPLASH_MIN_TIME: 1800, // 开屏最小显示时间（从 2500 减少到 1800）
        PAGE_TRANSITION: 400
    },
    // 功能开关
    FEATURES: {
        // 真心话大冒险页面：下滑洗牌功能开关
        SWIPE_DOWN_SHUFFLE: true
    }
};

// ==================== 喝酒道具卡片配置 ====================
const TOOL_CARDS = [
    {
        id: 'dice',
        title: '骰子',
        subtitle: '赛博骰盅 / 轻触即投',
        meta: '即时热身',
        gradient: 'linear-gradient(145deg, #002200, #000000)',
        mediaGradient: 'transparent',
        accent: '#39FF14',
        stageLight: 'transparent',
        placeholder: 'DICE',
        // 骰子卡片使用透明背景图片（引用 IMAGE_URLS.DICE_IMAGE）
        mediaUrl: '/image-pack-tools/dice-e8bc5ad5.png',
        path: '/pages/tool-dice/index'
    },
    {
        id: 'oldman',
        title: '点老头',
        subtitle: '老派划拳的仪式感',
        meta: '敬酒神招',
        gradient: 'linear-gradient(145deg, #221100, #000000)',
        mediaGradient: 'transparent',
        accent: '#FF9B4A',
        stageLight: 'transparent',
        placeholder: 'MASTER',
        // 点老头卡片使用透明背景图片（引用 IMAGE_URLS.OLDMAN_CARD_IMAGE）
        mediaUrl: '/image-pack-tools/oldman-normal-1a7fa183.png',
        path: '/pages/tool-oldman/index'
    },
    {
        id: 'fingerpress',
        title: '按手指',
        subtitle: '极速裁决谁先干杯',
        meta: '现场裁判',
        gradient: 'linear-gradient(145deg, #001122, #000000)',
        mediaGradient: 'transparent',
        accent: '#7AE7FF',
        stageLight: 'transparent',
        placeholder: 'FINGER',
        // 按手指卡片使用透明背景图片（引用 IMAGE_URLS.FINGER_CARD_IMAGE）
        mediaUrl: '/image-pack-tools/finger-3b096378.png',
        path: '/pages/tool-fingerpress/index'
    },
    {
        id: 'countdown',
        title: '倒计时',
        subtitle: '手速决定谁先喝',
        meta: '反应游戏',
        gradient: 'linear-gradient(145deg, #2a0011, #000000)',
        mediaGradient: 'transparent',
        accent: '#FF0055',
        stageLight: 'transparent',
        placeholder: 'COUNT',
        mediaUrl: '/image-pack-tools/countdown-7774ee8e.png',
        path: '/pages/tool-countdown/index'
    },
    {
        id: 'drunk',
        title: '喝醉了吗',
        shortTitle: '喝醉没', // 【新增】最近玩过显示的短标题（防遮挡）
        subtitle: '看看你的手有多抖',
        meta: '清醒测试',
        gradient: 'linear-gradient(145deg, #1a0022, #000000)',
        mediaGradient: 'transparent',
        accent: '#AA00FF',
        stageLight: 'transparent',
        placeholder: 'TEST',
        // 破框图（2048x2048像素）
        mediaUrl: '/image-pack-tools/drunk-0ccf086b.png',
        path: '/pages/tool-drunk/index'
    },
    {
        id: 'danmu',
        title: '夜店弹幕',
        shortTitle: '发弹幕', // 【新增】最近玩过显示的短标题（防遮挡）
        subtitle: '全场最靓的仔',
        meta: '氛围神器',
        gradient: 'linear-gradient(145deg, #332a00, #000000)',
        mediaGradient: 'transparent',
        accent: '#FFD700',
        stageLight: 'transparent',
        placeholder: 'DANMU',
        // 破框图（2048x2048像素）
        mediaUrl: '/image-pack-tools/danmu-3ef4933e.png',
        path: '/pages/tool-danmu/index'
    },
    {
        id: 'flappy',
        title: '像素鸟',
        shortTitle: '像素鸟',
        subtitle: '会跳的小鸟来咯',
        meta: '休闲游戏',
        gradient: 'linear-gradient(145deg, #DDF7FF, #8FDBFF)',
        mediaGradient: 'transparent',
        accent: '#45B8E8',
        stageLight: 'transparent',
        placeholder: 'BIRD',
        // 原小鸟图片，随资源分包发布
        mediaUrl: '/image-pack-tools/bird-bfb6f350.png',
        path: '/pages/tool-flappy/index'
    },
    {
        id: 'bottle',
        title: '转酒瓶',
        shortTitle: '转酒瓶',
        subtitle: '瓶口指谁谁喝',
        meta: '随机裁判',
        gradient: 'linear-gradient(145deg, #221100, #000000)',
        mediaGradient: 'transparent',
        accent: '#FF9B4A',
        stageLight: 'transparent',
        placeholder: 'BOTTLE',
        mediaUrl: '/image-pack-tools/bottle-card-5fc37d78.png',
        path: '/pages/tool-bottle/index'
    }
    // 蹦迪游戏已归档到 archive/tool-disco，待后续完善后恢复
];

module.exports = {
    CLOUD_ENV,
    APP_VERSION,
    CLOUD_FILE_IDS,
    IMAGE_URLS,
    CACHE_CONFIG,
    CLOUD_FUNCTION_CONFIG,
    UI_CONFIG,
    TOOL_CARDS
};
