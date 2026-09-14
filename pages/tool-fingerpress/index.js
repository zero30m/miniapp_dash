const COLORS = [
  '#39FF14', // Neon Green
  '#00FFFF', // Cyan
  '#FF0055', // Neon Red
  '#FF9900', // Neon Orange
  '#CC00FF'  // Neon Purple
];
const i18n = require('../../utils/i18n');

Page({
  data: {
    locale: 'zh-Hans',
    uiCopy: i18n.getPageCopy('fingerpress', 'zh-Hans'),
    fingers: [], // { id, x, y, color, isWinner, isEliminated }
    gameState: 'IDLE', // IDLE, READY, SELECTING, ELIMINATING, RESULT
    selectorPos: { x: 0, y: 0 },
    showStartZone: false, // 是否显示开始区域
    screenHeight: 0,
    screenWidth: 0,
    winnerColor: '#39FF14', // 获胜者的颜色
    startZoneHeight: 120, // 开始区域高度(px)
    navTop: 60 // 返回按钮距顶部距离
  },

  onLoad() {
    this._syncI18n();
    this.touchMap = new Map();
    this.colorPool = [...COLORS];
    this.animationTimer = null;
    this.eliminationTimer = null; // 淘汰动画定时器

    // 计算导航布局，使返回按钮与胶囊按钮对齐
    this._calculateNavLayout();

    // 获取屏幕尺寸
    const systemInfo = wx.getSystemInfoSync();
    const startZoneHeight = Math.max(100, systemInfo.windowHeight * 0.15); // 底部15%或至少100px

    this.setData({
      screenHeight: systemInfo.windowHeight,
      screenWidth: systemInfo.windowWidth,
      startZoneHeight: startZoneHeight
    });

    // 【优化】进入页面时上报（只在登录状态下，每会话一次）
    this._reportGamePlay();
  },

  onUnload() {
    this._clearTimer();

  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  /**
   * 阻止事件冒泡（用于返回按钮等不参与游戏的UI元素）
   */
  onPreventBubble() {
    // 空函数，仅用于阻止事件冒泡到父元素
  },

  /**
   * 计算导航布局，使返回按钮与胶囊按钮对齐
   */
  _calculateNavLayout() {
    try {
      const menuBtn = wx.getMenuButtonBoundingClientRect();
      if (menuBtn && menuBtn.top > 0) {
        this.setData({ navTop: menuBtn.top });
      }
    } catch (e) {
      console.warn('[NavLayout] Failed to get menu button rect:', e);
    }
  },

  onShow() {
    this._syncI18n();
    // 【优化】隐藏 TabBar（工具页面不需要显示 TabBar）
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
    if (tabBar && !tabBar.data.hidden) {
      tabBar.setData({ hidden: true });
    }
  },

  onHide() {
    // 页面隐藏时清理定时器
    this._clearTimer();

    // 【修复】恢复 TabBar 显示
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
    if (tabBar) {
      // 【修改】登录弹窗已移到真心话大冒险页面，不需要模糊
      tabBar.setData({
        hidden: false,
        blurred: false
      });
    }
  },

  _clearTimer() {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    if (this.eliminationTimer) {
      clearTimeout(this.eliminationTimer);
      this.eliminationTimer = null;
    }
  },

  isInStartZone(y) {
    const { screenHeight, startZoneHeight, showStartZone } = this.data;
    if (!showStartZone || !screenHeight) return false;
    return y > screenHeight - startZoneHeight;
  },

  // Touch Handlers
  onTouchStart(e) {
    // 选择中或淘汰中时忽略所有触摸
    if (this.data.gameState === 'SELECTING' || this.data.gameState === 'ELIMINATING') return;

    // 结果状态：触摸任意位置重置游戏
    if (this.data.gameState === 'RESULT') {
      this.resetGame();
      return;
    }

    const { showStartZone, fingers } = this.data;

    // 检查新触摸点是否在开始区域
    if (showStartZone && fingers.length >= 2 && e.changedTouches && e.changedTouches.length > 0) {
      const newTouch = e.changedTouches[0];
      if (this.isInStartZone(newTouch.clientY)) {
        // 点击开始区域，启动游戏
        wx.vibrateShort({ type: 'medium' });
        this.startGame([...fingers]);
        return;
      }
    }

    this.updateFingers(e.touches);
  },

  onTouchMove(e) {
    // 选择中、淘汰中或结果状态时忽略
    if (this.data.gameState === 'SELECTING' || this.data.gameState === 'ELIMINATING' || this.data.gameState === 'RESULT') return;
    this.updateFingers(e.touches);
  },

  onTouchEnd(e) {
    // 选择中、淘汰中或结果状态时忽略
    if (this.data.gameState === 'SELECTING' || this.data.gameState === 'ELIMINATING' || this.data.gameState === 'RESULT') return;
    this.updateFingers(e.touches);
  },

  onTouchCancel(e) {
    this.onTouchEnd(e);
  },

  updateFingers(touches) {
    // 防止在游戏进行中更新手指状态
    const { gameState } = this.data;
    if (gameState === 'SELECTING' || gameState === 'ELIMINATING' || gameState === 'RESULT') {
      return;
    }

    const newFingers = [];
    const currentIds = new Set();
    const { showStartZone, startZoneHeight, screenHeight } = this.data;

    // 过滤并处理触摸点
    for (let i = 0; i < touches.length && i < 5; i++) {
      const touch = touches[i];

      // 如果开始区域显示，忽略该区域的触摸点
      if (showStartZone && touch.clientY > screenHeight - startZoneHeight) {
        continue;
      }

      const id = touch.identifier;
      currentIds.add(id);

      let finger = this.touchMap.get(id);
      if (!finger) {
        // 新手指
        finger = {
          id: id,
          x: touch.clientX,
          y: touch.clientY,
          color: this._getNextColor(),
          isWinner: false
        };
        this.touchMap.set(id, finger);
        wx.vibrateShort({ type: 'light' });
      } else {
        // 更新位置
        finger.x = touch.clientX;
        finger.y = touch.clientY;
      }
      newFingers.push(finger);
    }

    // 清理已抬起的手指
    for (const [id] of this.touchMap) {
      if (!currentIds.has(id)) {
        this.touchMap.delete(id);
      }
    }

    // 更新状态
    const count = newFingers.length;
    let newState = 'IDLE';
    let showStart = false;

    if (count >= 5) {
      // 5个手指自动开始
      if (this.data.gameState !== 'SELECTING') {
        // 【修复】先更新 fingers 数据，确保第5个手指的光圈能显示
        this.setData({ fingers: newFingers });
        // 使用 setTimeout 确保 UI 更新后再开始游戏
        setTimeout(() => {
          this.startGame(newFingers);
        }, 50);
        return;
      }
    } else if (count >= 2) {
      newState = 'READY';
      showStart = true;
    } else if (count > 0) {
      newState = 'READY';
    }

    this.setData({
      fingers: newFingers,
      gameState: newState,
      showStartZone: showStart
    });
  },

  _getNextColor() {
    // 找到当前未被使用的第一个颜色
    var usedColors = new Set();
    this.touchMap.forEach(function (finger) {
      usedColors.add(finger.color);
    });
    for (var i = 0; i < COLORS.length; i++) {
      if (!usedColors.has(COLORS[i])) return COLORS[i];
    }
    return COLORS[0]; // 兜底
  },

  startGame(fingers) {
    this._clearTimer();

    this.setData({
      gameState: 'SELECTING',
      showStartZone: false
    });

    wx.vibrateShort({ type: 'medium' });

    // 复制手指数据
    const fingersCopy = fingers.map(f => ({ ...f }));

    let rounds = 0;
    const maxRounds = 20;
    let interval = 80;

    const animate = () => {
      if (rounds >= maxRounds) {
        this.animationTimer = null;
        this.finishGame(fingersCopy);
        return;
      }

      const targetIndex = Math.floor(Math.random() * fingersCopy.length);
      const target = fingersCopy[targetIndex];

      this.setData({
        selectorPos: { x: target.x, y: target.y }
      });

      wx.vibrateShort({ type: 'light' });

      rounds++;
      interval += 15;
      this.animationTimer = setTimeout(animate, interval);
    };

    animate();
  },

  finishGame(fingers) {

    const winnerIndex = Math.floor(Math.random() * fingers.length);
    const winner = fingers[winnerIndex];

    // 先更新所有手指状态，标记获胜者
    const updatedFingers = fingers.map((f, i) => ({
      ...f,
      isWinner: i === winnerIndex,
      isEliminated: false
    }));

    // 进入淘汰阶段
    this.setData({
      fingers: updatedFingers,
      gameState: 'ELIMINATING',
      selectorPos: { x: winner.x, y: winner.y },
      winnerColor: winner.color
    });

    wx.vibrateShort({ type: 'medium' });

    // 开始淘汰动画：依次熄灭非获胜者的圆环
    this._startElimination(updatedFingers, winnerIndex);
  },

  /**
   * 淘汰动画：依次熄灭非获胜者的圆环
   */
  _startElimination(fingers, winnerIndex) {
    // 获取非获胜者的索引列表
    const loserIndices = [];
    fingers.forEach((f, i) => {
      if (i !== winnerIndex) {
        loserIndices.push(i);
      }
    });

    if (loserIndices.length === 0) {
      // 只有一个手指，直接显示结果
      this._showResult();
      return;
    }

    let eliminateCount = 0;
    const eliminateNext = () => {
      if (eliminateCount < loserIndices.length) {
        const idx = loserIndices[eliminateCount];

        // 更新该手指为已淘汰
        const newFingers = this.data.fingers.map((f, i) => {
          if (i === idx) {
            return { ...f, isEliminated: true };
          }
          return f;
        });

        this.setData({ fingers: newFingers });
        wx.vibrateShort({ type: 'light' });

        eliminateCount++;
        this.eliminationTimer = setTimeout(eliminateNext, 400);
      } else {
        // 淘汰完成，显示最终结果
        this._showResult();
      }
    };

    // 延迟一下再开始淘汰
    this.eliminationTimer = setTimeout(eliminateNext, 600);
  },

  /**
   * 显示最终结果
   */
  _showResult() {
    // 只保留获胜者
    const finalFingers = this.data.fingers.filter(f => !f.isEliminated);

    this.setData({
      fingers: finalFingers,
      gameState: 'RESULT'
    });

    wx.vibrateShort({ type: 'heavy' });
  },

  resetGame() {
    this._clearTimer();

    this.setData({
      fingers: [],
      gameState: 'IDLE',
      showStartZone: false
    });
    this.touchMap.clear();

    wx.vibrateShort({ type: 'light' });
  },

  // 开始区域点击处理
  onStartZoneTap() {
    const { fingers, showStartZone } = this.data;
    if (showStartZone && fingers.length >= 2) {
      wx.vibrateShort({ type: 'medium' });
      this.startGame([...fingers]);
    }
  },

  // 结果弹窗点击
  onResultTap() {
    this.resetGame();
  },

  /**
   * 【优化】静默上报游戏游玩记录
   * - 使用批量上报机制，在 App 进入后台时统一上报
   */
  _reportGamePlay() {
    const app = getApp();
    app.addGameStat('fingerpress');
  },

  _syncI18n() {
    const locale = i18n.getAppLocale();
    this.setData({
      locale,
      uiCopy: i18n.getPageCopy('fingerpress', locale)
    });
    i18n.setNavigationBarTitle('fingerpress.navTitle', locale);
  },

  // ==================== 分享功能 ====================

  onShareAppMessage() {
    return {
      title: this.data.uiCopy.shareTitle || '按手指 | 抓手指-满分激光枪',
      path: '/pages/tool-fingerpress/index',
      imageUrl: '/logo.png'
    };
  }, onShareTimeline() {
    return {
      title: this.data.uiCopy.shareTitle || '按手指 | 抓手指-满分激光枪',
      imageUrl: '/logo.png'
    };
  }
});
