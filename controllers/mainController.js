const { sendLiquidsoapCommand } = require('../services/liquidsoapService');

/**
 * 获取当前歌曲信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
async function getCurrentTrack(req, res) {
    try {
        const liquidsoapResponse = await sendLiquidsoapCommand('current');
        res.status(200).json({ success: true, message: liquidsoapResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: error });
    }
}

module.exports = {
    getCurrentTrack
};