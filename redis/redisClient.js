// src/redisClient.js
require('dotenv').config(); // ← 唯一读取 .env 的地方
const redis = require('redis');

/**
 * Redis 统一客户端（单例）
 * 职责：
 *   1. 连接管理
 *   2. 发布 track
 *   3. 订阅 track + 内存缓存 current
 */
class RedisClient {
    constructor() {
        this.pub = null;
        this.sub = null;
        this.channel = 'track';
        this.current = { artist: '未知', title: '加载中...' };
    }

    async init() {
        const config = {
            socket: {
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: Number(process.env.REDIS_PORT) || 6379,
            },
            database: Number(process.env.REDIS_DB) || 0,
        };
        if (process.env.REDIS_PASSWORD) {
            config.password = process.env.REDIS_PASSWORD;
        }

        // 创建两个客户端（推荐：Pub/Sub 分离）
        this.pub = redis.createClient(config);
        this.sub = redis.createClient(config);

        await this.sub.connect();
        await this.pub.connect();

        // 错误统一处理
        [this.pub, this.sub].forEach((client) => {
            client.on('error', (err) =>
                console.error('[RedisClient] error:', err.message),
            );
            client.on('connect', () =>
                console.log(
                    `[RedisClient] ${
                        client === this.pub ? 'pub' : 'sub'
                    } connected`,
                ),
            );
        });

        // 订阅并更新内存
        this.sub.subscribe(this.channel);
        this.sub.on('message', (_, msg) => {
            try {
                this.current = JSON.parse(msg);
                console.log('[RedisClient] track updated:', this.current);
            } catch (e) {
                console.error('[RedisClient] invalid JSON:', msg);
            }
        });
    }

    /**
     * 发布歌曲信息（Liquidsoap 调用）
     */
    publishTrack({ artist, title }) {
        if (!this.pub?.isOpen) {
            console.warn('[RedisClient] pub not ready');
            return;
        }
        const payload = JSON.stringify({ artist, title });
        this.pub.publish(this.channel, payload).catch((err) => {
            console.error('[RedisClient] publish failed:', err.message);
        });
    }

    /**
     * 获取当前歌曲（Express API 调用）
     */
    getCurrent() {
        return { ...this.current };
    }

    /** 优雅关闭 */
    async quit() {
        await Promise.all([this.pub?.quit(), this.sub?.quit()].filter(Boolean));
        console.log('[RedisClient] disconnected');
    }
}

// 导出单例
module.exports = new RedisClient();
