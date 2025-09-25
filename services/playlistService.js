const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const { exec } = require('child_process');

/**
 * 获取播放列表
 * @returns {Array} 播放列表数组
 */
function getPlaylist() {
    try {
        const playlistFile = path.join(__dirname, '..', '..', 'playlists', 'current.json');
        if (fs.existsSync(playlistFile)) {
            return JSON.parse(fs.readFileSync(playlistFile, 'utf8'));
        }
    } catch (error) {
        console.error('获取播放列表失败:', error);
    }
    return [];
}

/**
 * 保存播放列表
 * @param {Array} playlist - 播放列表数组
 * @returns {boolean} 是否保存成功
 */
function savePlaylist(playlist) {
    try {
        const playlistFile = path.join(__dirname, '..', '..', 'playlists', 'current.json');
        fs.writeFileSync(playlistFile, JSON.stringify(playlist, null, 2));
        
        // 生成 M3U 格式播放列表供 Liquidsoap 使用
        generateM3UPlaylist(playlist);
        return true;
    } catch (error) {
        console.error('保存播放列表失败:', error);
        return false;
    }
}

/**
 * 生成 M3U 播放列表
 * @param {Array} playlist - 播放列表数组
 */
function generateM3UPlaylist(playlist) {
    try {
        const m3uFile = path.join(__dirname, '..', '..', 'playlists', 'current.m3u');
        let m3uContent = '#EXTM3U\n';
        
        playlist.forEach(track => {
            const duration = track.duration || 0;
            const artist = track.artist || 'Unknown';
            const title = track.name || track.title || 'Unknown';
            
            m3uContent += `#EXTINF:${duration},${artist} - ${title}\n`;
            m3uContent += `${track.path}\n`;
        });
        
        fs.writeFileSync(m3uFile, m3uContent);
        console.log('M3U 播放列表已生成');
        
        // 通知 Liquidsoap 重载播放列表
        exec('echo "reload" | nc -w 1 localhost 1234', (error) => {
            if (!error) {
                console.log('Liquidsoap 播放列表已重载');
            }
        });
        
    } catch (error) {
        console.error('生成 M3U 播放列表失败:', error);
    }
}

/**
 * 移动文件到音乐目录
 * @param {Object} uploadedFile - 上传的文件对象
 * @param {string} targetName - 目标文件名
 * @returns {Promise<string>} 目标文件路径
 */
async function moveToMusicDir(uploadedFile, targetName) {
    const musicDir = path.join(__dirname, '..', '..', 'music');
    const targetPath = path.join(musicDir, targetName);
    
    await fse.move(uploadedFile.path, targetPath);
    return targetPath;
}

module.exports = {
    getPlaylist,
    savePlaylist,
    generateM3UPlaylist,
    moveToMusicDir
};