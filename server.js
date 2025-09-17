import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import config from './config.js';

const require = createRequire(import.meta.url);
const http = require('http');

const app = express();
const PORT = config.server.port;

// 中间件
app.use(cors());
app.use(express.json());

// 添加代理路由解决跨域问题
app.get('/stream.mp3', (req, res) => {
  // 代理到 Icecast 服务器
  const url = `http://${config.icecast.host}:${config.icecast.port}${config.icecast.mount}`;
  
  http.get(url, (proxyRes) => {
    // 设置响应头
    res.status(proxyRes.statusCode);
    for (const key in proxyRes.headers) {
      res.setHeader(key, proxyRes.headers[key]);
    }
    
    // 转发数据
    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  });
});

// 静态文件中间件（放在路由之后）
app.use(express.static('public'));

// 确保必要的目录存在
const musicDir = config.musicDirectory;
const dataDir = './data';

if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir);
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 初始化播放列表文件
const playlistPath = path.join(dataDir, 'playlist.json');
if (!fs.existsSync(playlistPath)) {
  fs.writeFileSync(playlistPath, JSON.stringify([]));
}

// 读取播放列表
function getPlaylist() {
  try {
    const data = fs.readFileSync(playlistPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// 保存播放列表
function savePlaylist(playlist) {
  fs.writeFileSync(playlistPath, JSON.stringify(playlist, null, 2));
}

// 当前播放状态
let currentSong = null;
let ffmpegProcess = null;

// 上传文件配置
const storage = multer.diskStorage({
  destination: musicDir,
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// API 路由

// 获取歌曲列表
app.get('/api/songs', (req, res) => {
  const playlist = getPlaylist();
  res.json(playlist);
});

// 上传歌曲
app.post('/api/upload', upload.single('song'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const playlist = getPlaylist();
  const newSong = {
    id: Date.now().toString(),
    filename: req.file.filename,
    originalname: req.file.originalname,
    path: req.file.path,
    uploadTime: new Date().toISOString()
  };

  playlist.push(newSong);
  savePlaylist(playlist);

  res.json({ message: 'Song uploaded successfully', song: newSong });
});

// 删除歌曲
app.delete('/api/songs/:id', (req, res) => {
  const songId = req.params.id;
  let playlist = getPlaylist();
  
  const songIndex = playlist.findIndex(song => song.id === songId);
  if (songIndex === -1) {
    return res.status(404).json({ error: 'Song not found' });
  }

  const song = playlist[songIndex];
  
  // 从磁盘删除文件
  try {
    fs.unlinkSync(song.path);
  } catch (err) {
    console.error('Failed to delete file:', err);
  }

  // 从播放列表中移除
  playlist.splice(songIndex, 1);
  savePlaylist(playlist);

  res.json({ message: 'Song deleted successfully' });
});

// 获取电台状态
app.get('/api/status', (req, res) => {
  res.json({
    currentSong: currentSong,
    isPlaying: !!ffmpegProcess
  });
});

// 重新扫描音乐目录
app.post('/api/control/rescan', (req, res) => {
  // 这里可以实现扫描音乐目录的功能
  res.json({ message: 'Rescan triggered' });
});

// 播放下一首歌
app.post('/api/control/next', (req, res) => {
  playNextSong();
  res.json({ message: 'Playing next song' });
});

// 播放下一首歌曲的函数
function playNextSong() {
  const playlist = getPlaylist();
  if (playlist.length === 0) {
    console.log('Playlist is empty');
    return;
  }

  // 简单的随机播放逻辑
  const randomIndex = Math.floor(Math.random() * playlist.length);
  const song = playlist[randomIndex];
  
  currentSong = song;
  
  // 停止当前的FFmpeg进程
  if (ffmpegProcess) {
    ffmpegProcess.kill();
  }
  
  // 启动FFmpeg推流
  startStreaming(song.path);
}

// 启动FFmpeg推流
function startStreaming(songPath) {
  const icecastConfig = config.icecast;
  
  const ffmpegArgs = [
    '-re', // 实时读取输入
    '-i', songPath, // 输入文件
    '-f', 'mp3', // 输出格式
    '-b:a', '96k', // 降低音频比特率以减少CPU和带宽使用
    '-ar', '44100', // 固定采样率
    '-ac', '2', // 固定声道数
    '-content_type', 'audio/mpeg',
    '-ice_name', 'Static FM',
    '-ice_description', 'Personal radio streaming',
    '-ice_genre', 'Various',
    '-ice_public', '0',
    '-password', icecastConfig.password,
    '-listen', '1', // 启用监听模式，有助于稳定连接
    '-bufsize', '32k', // 减小缓冲区大小以适应低内存环境
    '-legacy_icecast', '1', // 使用传统Icecast协议
    '-mpegts_flags', 'resend_headers', // 重新发送标头
    `icecast://${icecastConfig.host}:${icecastConfig.port}${icecastConfig.mount}`
  ];

  console.log('Starting FFmpeg with args:', ffmpegArgs);
  
  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  
  ffmpegProcess.stdout.on('data', (data) => {
    console.log(`FFmpeg stdout: ${data}`);
  });
  
  ffmpegProcess.stderr.on('data', (data) => {
    console.log(`FFmpeg stderr: ${data}`);
  });
  
  ffmpegProcess.on('error', (err) => {
    console.error('FFmpeg process error:', err);
  });
  
  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
    // 播放完一首歌后自动播放下一首
    setTimeout(playNextSong, 1000);
  });
}

// 创建必要的目录
if (!fs.existsSync('./music')) {
  fs.mkdirSync('./music');
}

if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public');
}

if (!fs.existsSync('./public/assets')) {
  fs.mkdirSync('./public/assets');
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access the radio at http://localhost:${PORT}`);
  console.log(`Access the admin panel at http://localhost:${PORT}/admin.html`);
});