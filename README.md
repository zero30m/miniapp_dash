# miniapp_dash

基于「抓手指-满分激光枪」制作的定制版微信小程序，提供聚会互动游戏、卡牌问答和实用小游戏。

## 小程序介绍

- **首页**：骰子、点老头、按手指、倒计时、喝醉了吗、夜店弹幕、像素鸟、转酒瓶，以及文章和最近玩过入口。
- **抓手指**：保留原题库前 27 道文字题和 3 道图片题，共 30 个游戏；随机抽取，支持上一题、下一题，抽完后重新洗牌。
- **真心话大冒险**：保留原有主题卡牌及 DIY 功能。
- **扑克牌**：仅保留「开花」。
- **其他功能**：保留登录、会员、管理后台、抽奖、好友互动和测试功能。

## 配置说明

### 本地运行

1. 使用微信开发者工具导入项目根目录，项目类型为小程序。
2. 在 `project.config.json` 中配置目标小程序的 `appid`。云函数目录为 `cloudfunctions/`，当前配置的基础库版本为 `3.11.3`。
3. 在 `utils/config.js` 中配置 `CLOUD_ENV`、版本号和字体资源地址。仓库沿用原项目的 AppID 和云环境，切换时需要同步核对。
4. 根据 `database.txt` 创建或核对云 MySQL 数据模型、文档型数据库集合、索引及访问权限。
5. 在微信开发者工具中上传所需云函数，并选择云端安装依赖。云函数使用 `cloud.DYNAMIC_CURRENT_ENV` 访问部署环境。

### 图片配置

- 原云存储中的 15 张固定图片已随源码提供：`image-pack-tools/` 存放游戏图片，`image-pack-fan/` 存放测试横幅、背景和 3 张群二维码。图片保持原始内容与格式，无需上传到新云环境。
- `app.json` 声明两个图片资源分包，`utils/tool_image_cache.js` 加载分包并复制到本地缓存，供页面和 Canvas 使用。请保留分包配置；首次使用时由微信加载分包，之后复用本地缓存。
- 图片引用位于 `utils/config.js`、`utils/fan_test_quiz.js` 和对应游戏页面。原文件与随包文件的对应关系记录在 `assets/cloud-image-manifest.json`。更换图片时更新路径及文件名中的内容摘要，以免复用旧缓存；群二维码应按实际业务替换。
- 外部网址图片（开屏动图、抓手指的 3 道图片题、默认封面等）保持原配置；用户上传的头像、文章封面等动态图片仍需目标云环境提供。字体也保留原云资源配置。

### 业务配置

- **登录和会员**：由 `SystemConfig` 中的 `requireLogin` 控制强制登录；用户及注册码对应 `User`、`RegistrationCode` 模型。
- **文章和版本通知**：分别配置 `HomepageArticle`、`AppVersion` 模型；客户端版本号位于 `utils/config.js`。
- **管理员**：核对相关云函数中的 `ADMIN_OPENIDS` 和用户模型中的 `admin` 字段，按目标小程序实际用户身份配置。
- **抽奖**：按 `database.txt` 配置抽奖相关集合。自动开奖需配置 `lotteryManager` 的定时触发机制；中奖通知需配置订阅消息模板及 `lotterySubscribeManager` 的中奖记录事件触发器，并保留其 `subscribeMessage.send` 权限。
- **动态开奖触发器**：`lotteryManager` 支持环境变量 `TCB_MANAGER_SECRET_ID`、`TCB_MANAGER_SECRET_KEY` 或 `TCB_MANAGER_API_KEY`，以及 `TCB_ENV_ID`；可用 `LOTTERY_TRIGGER_FUNCTION` 指定函数名。凭据在云端环境变量中配置。
- **语言**：语言调试配置位于 `utils/i18n/debug.js`。当前 `chs` 强制简体中文，设为 `auto` 可跟随微信语言。

### 本地检查

安装 Node.js 后，在项目根目录执行：

```bash
node --test scripts/test-custom-edition.js
node scripts/check-i18n.js
```
