#!/usr/bin/env node

const Redis = require('redis');
const fs = require('fs');
const path = require('path');

// 获取命令行参数
const trackInfo = process.argv[2];

if (!trackInfo) {
    console.error('请提供歌曲信息作为参数');
    process.exit(1);
}

// Redis 配置
const redisClient = Redis.createClient({
    host: '127.0.0.1',
    port: 6379
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

async function publishTrack() {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
        
        // 发布到 Redis 频道
        await redisClient.publish('current_track', trackInfo);
        console.log('Published to Redis:', trackInfo);
        
        // 同时写入文件供其他用途使用
        const logPath = path.join(__dirname, '..', '..', 'logs', 'current_track.txt');
        fs.writeFileSync(logPath, trackInfo);
        console.log('Written to file:', logPath);
        
        await redisClient.quit();
        console.log('Redis connection closed');
    } catch (err) {
        console.error('Failed to publish track:', err);
        process.exit(1);
    }
}

publishTrack();