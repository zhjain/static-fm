const { spawn } = require('child_process');
const path = require('path');

console.log('正在启动电台系统...');

// 启动主服务器
const server = spawn('node', [path.join(__dirname, 'server', 'server.js')], {
    cwd: __dirname
});

server.stdout.on('data', (data) => {
    console.log(`[Server] ${data}`);
});

server.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data}`);
});

server.on('close', (code) => {
    console.log(`[Server] 进程退出，退出码 ${code}`);
});

console.log('电台系统启动完成！');
console.log('访问收音机页面: http://localhost:3000');
console.log('访问管理页面: http://localhost:3000/manager.html');
console.log('访问管理后台: http://localhost:3000/admin');