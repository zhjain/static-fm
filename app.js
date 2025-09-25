const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const pinoHttp = require('./middleware/pino');
const logger = require('./utils/logger');
const mainRoutes = require('./routes/main');
const adminRoutes = require('./routes/admin');

/**
 * 创建并配置 Express 应用
 * @returns {Object} 包含 app 和 server 的对象
 */
function createApp() {
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // 日志中间件
    app.use(pinoHttp);

    // 静态文件
    app.use(express.static(path.join(__dirname, 'public')));

    // 中间件
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // API 路由
    app.use('/api', mainRoutes);
    app.use('/admin', adminRoutes);

    // 管理界面首页
    app.get('/admin', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'client', 'public', 'admin.html'));
    });

    // 错误处理
    app.use((err, req, res, next) => {
        logger.error({ err }, '服务器错误');
        res.json({
            success: false,
            error: '服务器内部错误',
        });
    });

    // 404处理
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: '您访问的页面不存在',
        });
    });

    return { app, server, io };
}

module.exports = { createApp };