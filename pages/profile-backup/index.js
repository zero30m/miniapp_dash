Page({
    data: {
        animationClass: '',
        storeAppId: 'wx9c72df599267e341',
        customStyle: {
            card: {
                'background': 'transparent', // Make component transparent to show wrapper bg
                'background-color': 'transparent',
                'border-radius': '0', // Wrapper handles radius
                'border': 'none',
                'backdrop-filter': 'none',
                'box-shadow': 'none',
                'padding': '36rpx',
                'color': '#333333',
                'overflow': 'visible',
                'position': 'relative',
                'z-index': '2' // Ensure content is above animation
            },
            image: {
                'border-radius': '40rpx', // Match wrapper border-radius exactly
                'overflow': 'hidden'
            },
            title: {
                color: '#1A1A1A', // Dark text
                'font-weight': '900',
                'font-size': '36rpx',
                'line-height': '1.3',
                'margin-bottom': '16rpx',
                'position': 'relative',
                'z-index': '2'
            },
            price: {
                color: '#000000', // Black price
                'font-weight': '900',
                'font-size': '48rpx',
                'font-family': 'DIN Alternate, sans-serif',
                'position': 'relative',
                'z-index': '2'
            },
            'original-price': {
                color: 'rgba(0,0,0,0.4)',
                'text-decoration': 'line-through',
                'font-size': '24rpx',
                'margin-left': '12rpx',
                'position': 'relative',
                'z-index': '2'
            },
            'sold-num': {
                color: 'rgba(0,0,0,0.5)',
                'font-size': '22rpx',
                'margin-top': '10rpx',
                'position': 'relative',
                'z-index': '2'
            },
            tag: {
                color: '#333333',
                'border': '1rpx solid rgba(0, 0, 0, 0.1)',
                'background-color': 'rgba(255, 255, 255, 0.5)',
                'border-radius': '12rpx',
                'padding': '6rpx 16rpx',
                'font-weight': 'bold',
                'font-size': '20rpx',
                'position': 'relative',
                'z-index': '2'
            },
            'buy-button': {
                'background': 'rgba(255, 255, 255, 0.4)', // Frosted glass base
                color: '#000000',
                'border-radius': '100rpx', // Perfect pill shape
                'font-weight': '900',
                'padding': '16rpx 56rpx', // Slightly wider
                'box-shadow': '0 8rpx 24rpx rgba(0, 0, 0, 0.05)',
                'border': '1rpx solid rgba(255, 255, 255, 0.8)',
                'backdrop-filter': 'blur(10px)',
                'position': 'relative',
                'z-index': '2',
                'animation': 'buttonBreath 4s infinite ease-in-out' // Add breathing animation
            },
            'buy-button-disabled': {
                'background-color': '#F0F0F0',
                color: '#CCCCCC'
            }
        },
        products: [
            { id: '10000366338831' },
            { id: '10000334157469' },
            { id: '10000334443566' }
        ]
    },

    onLoad() {
        // No complex logic needed, just standard products
        // The unified style is handled in WXSS
    },

    onShow() {
        // 【修复-思路10】使用 wx.nextTick 确保 TabBar 可操作
        wx.nextTick(() => {
            const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
            if (tabBar) {
                const app = getApp();

                // 【修改】登录弹窗已移到真心话大冒险页面，其他页面不需要模糊
                const needsUpdate = tabBar.data.selected !== 3 ||
                    tabBar.data.hidden !== false ||
                    tabBar.data.blurred !== false;

                if (needsUpdate) {
                    tabBar.setData({
                        selected: 3,
                        hidden: false,
                        blurred: false
                    });
                }

                // 同步管理员状态
                if (app.globalData.isAdmin) {
                    tabBar.updateAdminStatus(true);
                }
            }
        });

        // Trigger page entry animation
        this.setData({ animationClass: '' }, () => {
            setTimeout(() => {
                this.setData({ animationClass: 'page-entry-animate' });
            }, 50);
        });
    },

    onHide() {
        this.setData({ animationClass: '' });
    },

    // ==================== 分享功能 ====================

    onShareAppMessage() {
        return {
            title: '周边产品 | 抓手指-满分激光枪',
            path: '/pages/profile/index',
            imageUrl: '/logo.png'
        };
    },

    onShareTimeline() {
        return {
            title: '周边产品 | 抓手指-满分激光枪',
            imageUrl: '/logo.png'
        };
    }
})
