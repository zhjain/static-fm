const pino = require('pino');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 创建日志文件流
const streams = [
    { stream: process.stdout },  // 控制台输出
    { stream: fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' }) }  // 文件输出
];

// 配置Pino日志器
const logger = pino(
    {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            level: (label) => {
                return { level: label.toUpperCase() };
            }
        },
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                singleLine: true  // 改为单行显示
            }
        }
    },
    pino.multistream(streams)
);


module.exports = logger;