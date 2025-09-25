const Redis = require('redis');

// Redis 配置
const redisSubscriber = Redis.createClient({
    host: '127.0.0.1',
    port: 6379
});

redisSubscriber.on('error', (err) => {
    console.error('Redis subscriber error:', err);
});

/**
 * 连接到 Redis 并订阅频道
 * @param {string} channel - 要订阅的频道
 * @param {function} callback - 接收消息的回调函数
 */
async function subscribeToChannel(channel, callback) {
    try {
        await redisSubscriber.connect();
        console.log('Connected to Redis for subscription');
        
        // 订阅频道
        await redisSubscriber.subscribe(channel, callback);
        console.log(`Subscribed to Redis channel: ${channel}`);
    } catch (err) {
        console.error('Failed to connect to Redis for subscription:', err);
    }
}

/**
 * 断开 Redis 连接
 */
async function disconnect() {
    try {
        await redisSubscriber.quit();
        console.log('Redis connection closed');
    } catch (err) {
        console.error('Failed to close Redis connection:', err);
    }
}

module.exports = {
    subscribeToChannel,
    disconnect
};