const express = require('express');
const router = express.Router();
const { getCurrentTrack } = require('../controllers/mainController');

// 创建一个 API 端点来获取当前歌曲信息
router.get('/current', getCurrentTrack);

module.exports = router;