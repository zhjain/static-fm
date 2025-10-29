const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const multer = require('multer');
const fse = require('fs-extra');
const { parseFile } = require('music-metadata');

const pinoHttp = require('./middleware/pino');
const redisClient = require('./redis/redisClient');
const logger = require('./utils/logger');

const app = express();
const PORT = 3000;

// 日志中间件
app.use(pinoHttp);

// 静态文件
// app.use(express.static(path.join(__dirname, 'public')));

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 确保必要目录存在
const ensureDirectories = () => {
    const dirs = ['music', 'playlists', 'uploads', 'logs'];
    dirs.forEach((dir) => {
        fse.ensureDirSync(path.join(__dirname, dir));
    });
};

ensureDirectories();

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        // 保持原文件名，处理中文
        const originalName = Buffer.from(file.originalname, 'latin1').toString(
            'utf8',
        );
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        const timestamp = Date.now();
        cb(null, `${name}_${timestamp}${ext}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/flac',
            'audio/ogg',
            'audio/m4a',
            'audio/aac',
            'audio/x-m4a',
        ];

        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];

        if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的音频格式'), false);
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
    },
});

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

// 保存播放列表
function savePlaylist(playlist) {
    try {
        const playlistFile = path.join(__dirname, 'playlists', 'current.json');
        fs.writeFileSync(playlistFile, JSON.stringify(playlist, null, 2));

        // 生成 M3U 格式播放列表供 Liquidsoap 使用
        generateM3UPlaylist(playlist);
        return true;
    } catch (error) {
        logger.error({ err: error }, '保存播放列表失败');
        return false;
    }
}

// 生成 M3U 播放列表
function generateM3UPlaylist(playlist) {
    try {
        const m3uFile = path.join(__dirname, 'playlists', 'current.m3u');
        let m3uContent = '#EXTM3U\n';

        playlist.forEach((track) => {
            const duration = track.duration || 0;
            const artist = track.artist || 'Unknown';
            const title = track.name || track.title || 'Unknown';

            m3uContent += `#EXTINF:${duration},${artist} - ${title}\n`;
            m3uContent += `${track.path}\n`;
        });

        fs.writeFileSync(m3uFile, m3uContent);
        logger.info('M3U 播放列表已生成');

        // 通知 Liquidsoap 重载播放列表
        exec('echo "reload" | nc -w 1 localhost 1234', (error) => {
            if (!error) {
                logger.info('Liquidsoap 播放列表已重载');
            }
        });
    } catch (error) {
        logger.error({ err: error }, '生成 M3U 播放列表失败');
    }
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
                    streamUrl: 'http://localhost:8900/radio',
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
                description:
                    config.radioDescription ||
                    '一个私人的、不间断的网络音频流服务',
                genre: config.radioGenre || '多种类型',
                website: config.radioWebsite || '',
                logo: config.radioLogo || '/logo.png',
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
        logo: '/logo.png',
    };
}

// 移动文件到音乐目录
async function moveToMusicDir(uploadedFile, targetName) {
    const musicDir = path.join(__dirname, 'music');
    const targetPath = path.join(musicDir, targetName);

    await fse.move(uploadedFile.path, targetPath);
    return targetPath;
}

// 获取系统状态
function getSystemStatus() {
    return new Promise((resolve) => {
        exec('pgrep -f liquidsoap', (error, stdout, stderr) => {
            const liquidsoap = !error && stdout.trim() !== '';

            exec('pgrep -f icecast', (ice_error, ice_stdout, ice_stderr) => {
                const icecast = !ice_error && ice_stdout.trim() !== '';

                resolve({ liquidsoap, icecast });
            });
        });
    });
}

// ====================
// 公共路由 (无前缀)
// ====================

// 首页路由
app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 发布接口（Liquidsoap 调用）
app.post('/publish', (req, res) => {
    const { artist = '', title = '' } = req.body;
    redisClient.publishTrack({ artist, title });
    res.sendStatus(200);
});

// 普通 GET（App / 极简客户端）
app.get('/current', (req, res) => res.json(redisClient.getCurrent()));

// SSE 实时流（网页）
app.get('/current/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify(redisClient.getCurrent())}\n\n`);
    // 订阅 Redis 频道，实时转发
    const listener = (_, msg) => res.write(`data: ${msg}\n\n`);
    redisClient.sub.on('message', listener);
    req.on('close', () => {
        redisClient.sub.removeListener('message', listener);
        res.end();
    });
});

// API: 获取播放列表
app.get('/api/playlist', (req, res) => {
    const playlist = getPlaylist();
    res.json({
        success: true,
        data: playlist,
        total: playlist.length,
    });
});

// API: 获取当前播放信息
app.get('/api/current', (req, res) => {
    const currentTrack = getCurrentTrack();
    res.json({
        success: true,
        data: {
            current: currentTrack,
            timestamp: new Date().toISOString(),
        },
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
            isLive: status.liquidsoap && status.icecast,
        },
    });
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
    const totalDuration = playlist.reduce(
        (sum, track) => sum + (track.duration || 0),
        0,
    );
    const artists = [
        ...new Set(playlist.map((track) => track.artist || 'Unknown')),
    ];

    const stats = {
        totalTracks: playlist.length,
        totalDuration: Math.round(totalDuration / 60), // 转为分钟
        totalArtists: artists.length,
        uptime: Math.round(process.uptime() / 60), // 转为分钟
        status,
        currentTrack,
        artists: artists.slice(0, 10), // 只显示前10个艺术家
    };

    res.json({
        success: true,
        data: stats,
    });
});

// ====================
// 管理路由 (/admin)
// ====================

// 管理界面首页
app.get('/admin', async (req, res) => {
    const playlist = getPlaylist();
    const status = await getSystemStatus();

    // 计算统计信息
    const totalDuration = playlist.reduce(
        (sum, track) => sum + (track.duration || 0),
        0,
    );
    const artists = [
        ...new Set(playlist.map((track) => track.artist || 'Unknown')),
    ];

    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 上传音频文件
app.post('/admin/upload', upload.single('song'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请选择音频文件',
            });
        }

        const { title, artist } = req.body;
        const originalName = Buffer.from(
            req.file.originalname,
            'latin1',
        ).toString('utf8');

        // 生成目标文件名
        const ext = path.extname(originalName);
        const displayName = title || path.basename(originalName, ext);
        const targetName = `${displayName}${ext}`;

        // 移动文件到音乐目录
        const finalPath = await moveToMusicDir(req.file, targetName);

        // 尝试获取音频元数据
        let duration = 0;
        let metadata = {};

        try {
            const audioMetadata = await parseFile(finalPath);
            duration = Math.round(audioMetadata.format.duration || 0);
            metadata = {
                title: audioMetadata.common.title || displayName,
                artist: audioMetadata.common.artist || artist || 'Unknown',
                album: audioMetadata.common.album || '',
                year: audioMetadata.common.year || '',
                genre: audioMetadata.common.genre?.[0] || '',
            };
        } catch (metaError) {
            logger.error({ err: metaError }, '无法获取音频元数据');
            metadata = {
                title: displayName,
                artist: artist || 'Unknown',
                album: '',
                year: '',
                genre: '',
            };
        }

        // 添加到播放列表
        const playlist = getPlaylist();
        const newTrack = {
            id: Date.now().toString(),
            path: finalPath,
            name: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            genre: metadata.genre,
            year: metadata.year,
            duration,
            addedAt: new Date().toISOString(),
            fileSize: req.file.size,
        };

        playlist.push(newTrack);

        if (savePlaylist(playlist)) {
            res.json({
                success: true,
                message: '音频文件上传成功',
                track: newTrack,
            });
        } else {
            res.status(500).json({
                success: false,
                message: '保存播放列表失败',
            });
        }
    } catch (error) {
        logger.error({ err: error }, '上传失败');
        res.status(500).json({
            success: false,
            message: error.message || '上传失败',
        });
    }
});

// 获取播放列表API
app.get('/admin/api/playlist', (req, res) => {
    const playlist = getPlaylist();
    res.json({
        success: true,
        data: playlist,
    });
});

// 删除歌曲
app.delete('/admin/api/playlist/:id', (req, res) => {
    try {
        const { id } = req.params;
        const playlist = getPlaylist();
        const trackIndex = playlist.findIndex((track) => track.id === id);

        if (trackIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '歌曲不存在',
            });
        }

        const track = playlist[trackIndex];

        // 删除文件
        if (fs.existsSync(track.path)) {
            fs.unlinkSync(track.path);
        }

        // 从播放列表移除
        playlist.splice(trackIndex, 1);

        if (savePlaylist(playlist)) {
            res.json({
                success: true,
                message: '歌曲删除成功',
            });
        } else {
            res.status(500).json({
                success: false,
                message: '保存播放列表失败',
            });
        }
    } catch (error) {
        logger.error({ err: error }, '删除歌曲失败');
        res.status(500).json({
            success: false,
            message: '删除失败',
        });
    }
});

// 更新歌曲信息
app.put('/admin/api/playlist/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, artist, album, genre, year } = req.body;
        const playlist = getPlaylist();
        const trackIndex = playlist.findIndex((track) => track.id === id);

        if (trackIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '歌曲不存在',
            });
        }

        // 更新歌曲信息
        playlist[trackIndex] = {
            ...playlist[trackIndex],
            name: name || playlist[trackIndex].name,
            artist: artist || playlist[trackIndex].artist,
            album: album || playlist[trackIndex].album,
            genre: genre || playlist[trackIndex].genre,
            year: year || playlist[trackIndex].year,
            updatedAt: new Date().toISOString(),
        };

        if (savePlaylist(playlist)) {
            res.json({
                success: true,
                message: '歌曲信息更新成功',
                track: playlist[trackIndex],
            });
        } else {
            res.status(500).json({
                success: false,
                message: '保存播放列表失败',
            });
        }
    } catch (error) {
        logger.error({ err: error }, '更新歌曲信息失败');
        res.status(500).json({
            success: false,
            message: '更新失败',
        });
    }
});

// 播放列表排序
app.post('/admin/api/playlist/reorder', (req, res) => {
    try {
        const { order } = req.body; // 新的ID顺序数组
        const playlist = getPlaylist();

        if (!Array.isArray(order)) {
            return res.status(400).json({
                success: false,
                message: '无效的排序数据',
            });
        }

        // 根据新顺序重新排列播放列表
        const reorderedPlaylist = order
            .map((id) => playlist.find((track) => track.id === id))
            .filter(Boolean);

        if (savePlaylist(reorderedPlaylist)) {
            res.json({
                success: true,
                message: '播放列表排序成功',
            });
        } else {
            res.status(500).json({
                success: false,
                message: '保存播放列表失败',
            });
        }
    } catch (error) {
        logger.error({ err: error }, '播放列表排序失败');
        res.status(500).json({
            success: false,
            message: '排序失败',
        });
    }
});

// 系统控制API
app.post('/admin/api/system/:action', (req, res) => {
    const { action } = req.params;

    switch (action) {
        case 'start-liquidsoap':
            exec('liquidsoap config/radio.liq &', (error, stdout, stderr) => {
                if (error) {
                    res.json({
                        success: false,
                        message: '启动 Liquidsoap 失败',
                        error: error.message,
                    });
                } else {
                    res.json({ success: true, message: 'Liquidsoap 启动成功' });
                }
            });
            break;

        case 'stop-liquidsoap':
            exec('pkill -f liquidsoap', (error, stdout, stderr) => {
                res.json({ success: true, message: 'Liquidsoap 已停止' });
            });
            break;

        case 'restart-liquidsoap':
            exec(
                'pkill -f liquidsoap && sleep 2 && liquidsoap config/radio.liq &',
                (error, stdout, stderr) => {
                    if (error) {
                        res.json({
                            success: false,
                            message: '重启 Liquidsoap 失败',
                            error: error.message,
                        });
                    } else {
                        res.json({
                            success: true,
                            message: 'Liquidsoap 重启成功',
                        });
                    }
                },
            );
            break;

        case 'skip':
            exec(
                'echo "skip" | nc -w 1 localhost 1234',
                (error, stdout, stderr) => {
                    if (error) {
                        res.json({
                            success: false,
                            message: '跳过失败',
                            error: error.message,
                        });
                    } else {
                        res.json({ success: true, message: '已跳到下一首' });
                    }
                },
            );
            break;

        default:
            res.json({ success: false, message: '未知操作' });
    }
});

// 获取系统状态API
app.get('/admin/api/status', async (req, res) => {
    const status = await getSystemStatus();
    const playlist = getPlaylist();

    res.json({
        success: true,
        data: {
            ...status,
            totalTracks: playlist.length,
            uptime: process.uptime(),
        },
    });
});

// 日志查看
app.get('/admin/logs', (req, res) => {
    try {
        const logFile = path.join(__dirname, 'logs', 'liquidsoap.log');
        let logs = '';

        if (fs.existsSync(logFile)) {
            logs = fs
                .readFileSync(logFile, 'utf8')
                .split('\n')
                .slice(-100) // 只显示最后100行
                .join('\n');
        }

        res.sendFile(path.join(__dirname, 'public', 'logs.html'));
    } catch (error) {
        res.sendFile(path.join(__dirname, 'public', 'error.html'));
    }
});

// 错误处理
app.use((err, req, res, next) => {
    logger.error({ err }, '服务器错误');

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: '文件大小超出限制 (最大100MB)',
            });
        }
    }

    res.status(500).json({
        success: false,
        message: err.message || '服务器内部错误',
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '您访问的页面不存在',
    });
});

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`服务器运行在 http://localhost:${PORT}`);
    logger.info('电台管理系统已启动');
});

process.on('SIGTERM', async () => {
  await redisClient.quit();
  server.close(() => process.exit(0));
});

module.exports = app;
