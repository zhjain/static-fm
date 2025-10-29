require('dotenv').config();
const redis = require('redis');

class RedisClient {
    constructor() {
        this.pub = null;
        this.sub = null;
        this.channel = 'track';
        this.current = { artist: '未知', title: '加载中...' };
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        const config = this._getConfig();
        this.pub = redis.createClient(config);
        this.sub = redis.createClient(config);

        [this.pub, this.sub].forEach((client) => {
            client.on('error', (err) =>
                console.error('[RedisClient] error:', err.message)
            );
            client.on('connect', () =>
                console.log(
                    `[RedisClient] ${client === this.pub ? 'pub' : 'sub'} connected`
                )
            );
        });

        await Promise.all([this.pub.connect(), this.sub.connect()]);

        await this.sub.subscribe(this.channel, (msg) => {
            try {
                this.current = JSON.parse(msg);
                console.log('[RedisClient] track updated:', this.current);
            } catch (e) {
                console.error('[RedisClient] invalid JSON:', msg);
            }
        });

        console.log('[RedisClient] subscribed to channel:', this.channel);
    }

    /** 内部复用的 Redis 连接配置 */
    _getConfig() {
        return {
            socket: {
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
            },
            database: parseInt(process.env.REDIS_DB ?? '0', 10),
            password: process.env.REDIS_PASSWORD || undefined,
        };
    }

    /** 🔧 为每个 SSE 客户端创建独立订阅连接 */
    async createSubscriber() {
        const client = redis.createClient(this._getConfig());
        client.on('error', (err) =>
            console.error('[RedisClient] subscriber error:', err.message)
        );
        await client.connect();
        return client;
    }

    async publishTrack({ artist, title }) {
        if (!this.pub?.isOpen) {
            console.warn('[RedisClient] pub not ready');
            return;
        }
        const payload = JSON.stringify({ artist, title });
        try {
            await this.pub.publish(this.channel, payload);
            console.log('[RedisClient] track published:', payload);
        } catch (err) {
            console.error('[RedisClient] publish failed:', err.message);
        }
    }

    getCurrent() {
        return { ...this.current };
    }

    async quit() {
        try {
            if (this.pub?.isOpen) await this.pub.quit();
            if (this.sub?.isOpen) await this.sub.quit();
            console.log('[RedisClient] disconnected');
        } catch (err) {
            console.error('[RedisClient] quit failed:', err.message);
        }
    }
}

module.exports = new RedisClient();
