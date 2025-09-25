const Redis = require('redis');

// 创建发布者
const publisher = Redis.createClient({
    host: '127.0.0.1',
    port: 6379
});

// 创建订阅者
const subscriber = Redis.createClient({
    host: '127.0.0.1',
    port: 6379
});

publisher.on('error', (err) => {
    console.error('Publisher error:', err);
});

subscriber.on('error', (err) => {
    console.error('Subscriber error:', err);
});

async function testRedis() {
    try {
        await publisher.connect();
        await subscriber.connect();
        
        console.log('Connected to Redis');
        
        // 订阅频道
        await subscriber.subscribe('current_track', (message) => {
            console.log('Received message:', message);
        });
        
        console.log('Subscribed to channel');
        
        // 发布消息
        setTimeout(() => {
            publisher.publish('current_track', 'Test Artist - Test Song');
            console.log('Published message');
        }, 1000);
        
        // 5秒后退出
        setTimeout(() => {
            publisher.quit();
            subscriber.quit();
            console.log('Test completed');
        }, 5000);
        
    } catch (err) {
        console.error('Test failed:', err);
    }
}

testRedis();