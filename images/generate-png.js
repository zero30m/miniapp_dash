const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// 创建 500x400 的画布
const canvas = createCanvas(500, 400);
const ctx = canvas.getContext('2d');

// 绘制分享图
function drawShareImage() {
    // 奶油色背景
    ctx.fillStyle = '#FFFDE7';
    ctx.fillRect(0, 0, 500, 400);

    // 黑色装饰边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    roundRect(ctx, 12, 12, 476, 376, 20);
    ctx.stroke();

    // 头像占位区域 - 外圈边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(120, 200, 65, 0, Math.PI * 2);
    ctx.stroke();

    // 头像占位区域 - 内圈填充
    ctx.fillStyle = '#EEEEEE';
    ctx.beginPath();
    ctx.arc(120, 200, 60, 0, Math.PI * 2);
    ctx.fill();

    // 保存状态并裁剪为圆形
    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 200, 60, 0, Math.PI * 2);
    ctx.clip();

    // 头像占位图标 - 头部
    ctx.fillStyle = '#CCCCCC';
    ctx.beginPath();
    ctx.arc(120, 178, 26, 0, Math.PI * 2);
    ctx.fill();

    // 头像占位图标 - 身体
    ctx.fillStyle = '#CCCCCC';
    ctx.beginPath();
    ctx.arc(120, 280, 50, Math.PI, 0, false);
    ctx.fill();

    ctx.restore();

    // 重绘外圈边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(120, 200, 65, 0, Math.PI * 2);
    ctx.stroke();

    // 右侧文字
    ctx.fillStyle = '#000000';
    ctx.font = '900 38px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif';
    ctx.fillText('我该喊你', 210, 180);
    ctx.fillText('出来玩吗？', 210, 235);

    // 装饰圆点 - 右上角（黑色）
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(450, 55, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(428, 78, 5, 0, Math.PI * 2);
    ctx.fill();

    // 装饰圆点 - 右下角（紫色）
    ctx.fillStyle = '#9B5DE5';
    ctx.beginPath();
    ctx.arc(460, 340, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(438, 360, 4, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛装饰 - 左眼
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(420, 300, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(424, 302, 5, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛装饰 - 右眼
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(448, 300, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(452, 302, 5, 0, Math.PI * 2);
    ctx.fill();
}

// 绘制圆角矩形的辅助函数
function roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// 绘制图片
drawShareImage();

// 保存为 PNG
const buffer = canvas.toBuffer('image/png');
const outputPath = path.join(__dirname, 'share-viral.png');
fs.writeFileSync(outputPath, buffer);

console.log('✅ 分享图片已生成: ' + outputPath);
console.log('   尺寸: 500 x 400');
