const { createApp } = require('./app');
const logger = require('./utils/logger');
const { subscribeToChannel } = require('./services/redisService');

const { app, server, io } = createApp();
const PORT = 3000;

// 订阅 Redis 频道
subscribeToChannel('current_track', (message) => {
    console.log('Received from Redis:', message);
    // 通过 Socket.IO 发送到所有连接的客户端
    io.emit('current_track', message);
});

server.listen(PORT, '0.0.0.0', () => {
    logger.info(`服务器运行在 http://localhost:${PORT}`);
    logger.info('电台管理系统已启动');
});

module.exports = app;