const express = require('express');
const router = express.Router();
const {
    getPlaylistHandler,
    upload,
    uploadAudio,
    deleteTrack,
    updateTrack,
    reorderPlaylist,
    systemControl,
    getSystemStatusHandler
} = require('../controllers/adminController');

// 获取播放列表API
router.get('/api/playlist', getPlaylistHandler);

// 上传音频文件
router.post('/upload', upload, uploadAudio);

// 删除歌曲
router.delete('/api/playlist/:id', deleteTrack);

// 更新歌曲信息
router.put('/api/playlist/:id', updateTrack);

// 播放列表排序
router.post('/api/playlist/reorder', reorderPlaylist);

// 系统控制API
router.post('/api/system/:action', systemControl);

// 获取系统状态API
router.get('/api/status', getSystemStatusHandler);

module.exports = router;