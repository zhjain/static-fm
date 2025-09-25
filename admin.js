const express = require('express');
const path = require('path');
const adminRoutes = require('./routes/admin');
const { createAdminApp } = require('./admin-app');

const app = createAdminApp();
const PORT = 3001;

app.listen(PORT, '127.0.0.1', () => {
    console.log(`http://localhost:${PORT}/admin`)
})

// 管理后台路由已移至 routes/admin.js
// 此文件保留以确保向后兼容性
module.exports = () => {};
module.exports = app;