const { exec } = require('child_process');

/**
 * 获取系统状态
 * @returns {Promise<Object>} 系统状态对象
 */
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

module.exports = {
    getSystemStatus
};