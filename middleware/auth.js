const basicAuth = require('express-basic-auth');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 从环境变量获取管理员凭证
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

// 创建基本认证中间件
const authMiddleware = basicAuth({
    users: {
        [adminUsername]: adminPassword
    },
    challenge: true, // 发送WWW-Authenticate头
    realm: 'Static FM Admin' // 认证领域
});

// 只对管理路径应用认证
function adminAuth(req, res, next) {
    if (req.path.startsWith('/admin')) {
        return authMiddleware(req, res, next);
    }
    next();
}

module.exports = adminAuth;