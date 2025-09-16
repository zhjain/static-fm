export default {
    icecast: {
        host: 'localhost',
        port: 8000,
        password: 'your_source_password_here',
        mount: '/stream.mp3' // 电台频道名
    },
    server: {
        port: 3000 // Node.js 服务运行的端口
    },
    musicDirectory: './music'
};