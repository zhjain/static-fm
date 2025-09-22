const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const logger = require('./logger');
const pinoHttp = require('pino-http')({
    logger: logger,
    autoLogging: true,
    useLevel: 'info',
    customSuccessMessage: function(req, res) {
        return `${req.method} ${req.url} ${res.statusCode} ${res.headers['content-length'] || 0}b sent`;
    },
    customErrorMessage: function(req, res, err) {
        return `${req.method} ${req.url} ${res.statusCode} ${err.message}`;
    },
    serializers: {
        req: (req) => {
            return {
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress || req.ip
            };
        },
        res: (res) => {
            return {
                statusCode: res.statusCode,
                headers: {
                    'content-length': res.headers['content-length']
                }
            };
        }
    }
});

const app = express();
const PORT = 3000;

// 日志中间件
app.use(pinoHttp);

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 获取播放列表
function getPlaylist() {
    try {
        const playlistFile = path.join(__dirname, 'playlists', 'current.json');
        if (fs.existsSync(playlistFile)) {
            return JSON.parse(fs.readFileSync(playlistFile, 'utf8'));
        }
    } catch (error) {
        logger.error({ err: error }, '获取播放列表失败');
    }
    return [];
}

// 获取当前播放信息
function getCurrentTrack() {
    try {
        const currentFile = path.join(__dirname, 'logs', 'current_track.txt');
        if (fs.existsSync(currentFile)) {
            return fs.readFileSync(currentFile, 'utf8').trim();
        }
    } catch (error) {
        logger.error({ err: error }, '获取当前播放信息失败');
    }
    return '暂无播放信息';
}

// 获取电台状态
function getRadioStatus() {
    return new Promise((resolve) => {
        exec('pgrep -f liquidsoap', (error, stdout, stderr) => {
            const isRunning = !error && stdout.trim() !== '';
            
            // 检查 Icecast 状态
            exec('pgrep -f icecast', (ice_error, ice_stdout, ice_stderr) => {
                const icecastRunning = !ice_error && ice_stdout.trim() !== '';
                
                resolve({
                    liquidsoap: isRunning,
                    icecast: icecastRunning,
                    streamUrl: 'http://localhost:8000/radio'
                });
            });
        });
    });
}

// 获取电台信息
function getRadioInfo() {
    try {
        const configFile = path.join(__dirname, 'config.js');
        if (fs.existsSync(configFile)) {
            const config = require('./config.js');
            return {
                name: config.radioName || '网络电台',
                description: config.radioDescription || '一个私人的、不间断的网络音频流服务',
                genre: config.radioGenre || '多种类型',
                website: config.radioWebsite || '',
                logo: config.radioLogo || '/logo.png'
            };
        }
    } catch (error) {
        logger.error({ err: error }, '获取电台信息失败');
    }
    
    // 默认电台信息
    return {
        name: '网络电台',
        description: '一个私人的、不间断的网络音频流服务',
        genre: '多种类型',
        website: '',
        logo: '/logo.png'
    };
}



// 首页路由
app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: 获取播放列表
app.get('/api/playlist', (req, res) => {
    const playlist = getPlaylist();
    res.json({
        success: true,
        data: playlist,
        total: playlist.length
    });
});

// API: 获取当前播放信息
app.get('/api/current', (req, res) => {
    const currentTrack = getCurrentTrack();
    res.json({
        success: true,
        data: {
            current: currentTrack,
            timestamp: new Date().toISOString()
        }
    });
});

// API: 获取电台状态
app.get('/api/status', async (req, res) => {
    const radioInfo = getRadioInfo();
    const playlist = getPlaylist();
    const currentTrack = getCurrentTrack();
    const status = await getRadioStatus();
    
    res.json({
        success: true,
        data: {
            ...radioInfo,
            ...status,
            currentTrack,
            totalTracks: playlist.length,
            uptime: process.uptime(),
            isLive: status.liquidsoap && status.icecast
        }
    });
});


// API: 控制播放器
app.post('/api/control/:action', (req, res) => {
    const { action } = req.params;
    
    switch (action) {
        case 'skip':
            exec('echo "skip" | nc -w 1 localhost 1234', (error, stdout, stderr) => {
                if (error) {
                    res.json({ success: false, message: '跳过失败', error: error.message });
                } else {
                    res.json({ success: true, message: '已跳到下一首' });
                }
            });
            break;
            
        case 'reload':
            exec('echo "reload" | nc -w 1 localhost 1234', (error, stdout, stderr) => {
                if (error) {
                    res.json({ success: false, message: '重载失败', error: error.message });
                } else {
                    res.json({ success: true, message: '播放列表已重载' });
                }
            });
            break;
            
        default:
            res.json({ success: false, message: '未知操作' });
    }
});

// 统计信息页面
app.get('/stats', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

// API: 获取统计信息
app.get('/api/stats', async (req, res) => {
    const playlist = getPlaylist();
    const status = await getRadioStatus();
    const currentTrack = getCurrentTrack();
    
    // 计算统计信息
    const totalDuration = playlist.reduce((sum, track) => sum + (track.duration || 0), 0);
    const artists = [...new Set(playlist.map(track => track.artist || 'Unknown'))];
    
    const stats = {
        totalTracks: playlist.length,
        totalDuration: Math.round(totalDuration / 60), // 转为分钟
        totalArtists: artists.length,
        uptime: Math.round(process.uptime() / 60), // 转为分钟
        status,
        currentTrack,
        artists: artists.slice(0, 10) // 只显示前10个艺术家
    };
    
    res.json({
        success: true,
        data: stats
    });
});

// 错误处理
app.use((err, req, res, next) => {
    logger.error({ err }, '服务器错误');
    res.json({
        success: false,
        error: '服务器内部错误'
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '您访问的页面不存在'
    });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`服务器运行在 http://localhost:${PORT}`);
  logger.info('电台管理系统已启动');
})

module.exports = app;