const net = require('net');

// Liquidsoap Telnet 服务器的配置
const LIQUIDSOAP_HOST = '127.0.0.1';
const LIQUIDSOAP_PORT = 1234;

/**
 * 一个辅助函数，用于连接到 Liquidsoap、发送命令并获取响应。
 * @param {string} command - 要发送给 Liquidsoap 的命令 (例如 "skip", "reload").
 * @returns {Promise<string>} - Liquidsoap 返回的响应.
 */
function sendLiquidsoapCommand(command) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let responseData = '';

        // 连接到 Liquidsoap Telnet 服务器
        client.connect(LIQUIDSOAP_PORT, LIQUIDSOAP_HOST, () => {
            console.log(`Connected to Liquidsoap. Sending command: ${command}`);
            // 发送命令，必须以换行符结尾
            client.write(`${command}\n`);
        });

        // 监听从服务器返回的数据
        client.on('data', (data) => {
            responseData += data.toString();
            // Liquidsoap 通常在发送完响应后就会关闭连接，
            // 所以我们在这里可以立即结束写入，等待 'close' 事件
            client.end();
        });

        // 监听连接关闭事件
        client.on('close', () => {
            console.log('Connection to Liquidsoap closed.');
            // 返回整理后的响应数据（去掉多余的空格和结尾的提示符）
            resolve(responseData.trim());
        });

        // 监听错误事件
        client.on('error', (err) => {
            console.error('Liquidsoap connection error:', err);
            reject(
                `Failed to connect or communicate with Liquidsoap: ${err.message}`,
            );
        });
    });
}

module.exports = {
    sendLiquidsoapCommand
};