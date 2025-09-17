export default {
    icecast: {
        host: '127.0.0.1',
        port: 8900,
        password: 'hackme',
        mount: '/stream.mp3' // 电台频道名
    },
    server: {
        port: 3000 // Node.js 服务运行的端口
    },
    musicDirectory: './music'
};