# Static FM - 个人网络电台

## 1. 项目简介

Static FM 是一个私人的、不间断的网络音频流服务。其核心理念是模拟一个真实的"电台"，服务器在后台持续不断地根据预设的播放列表生成音频流。任何设备（电脑、手机、平板等）上的客户端只需访问一个简单的网页，即可收听这个唯一的、同步的音频流，无需登录，也无需进行任何复杂的播放控制。

该项目解决了在不同设备、不同音乐软件间同步歌单和播放状态的痛点，提供了一个"打开即听"、完全同步的纯粹听歌体验。

## 2. 核心理念与架构

本项目采用"**服务器推流，客户端收听**"的电台模式，而非传统的"客户端请求，服务器响应"的文件播放模式。

**架构图:**

```
[ 音乐文件 ] -> [ Liquidsoap (音频处理) ] -> [ Icecast (流媒体服务器) ] -> [ 客户端 (Web浏览器) ]
      ^                                                              ^
      |                                                              |
      +----------------- [ 管户端 (Web页面) ] <-> [ Node.js 控制后端 API ] --+
```

**组件分工:**

*   **音频处理核心: `Liquidsoap`**
    *   职责：读取播放列表，处理音频流，提供丰富的音频处理功能（如均衡器、压缩器等）。
    *   支持多种播放模式（顺序、随机等），并提供 Telnet 接口供外部控制。
    *   在切歌时直接调用 Node.js 脚本将歌曲信息发布到 Redis。

*   **流媒体服务器 (电台塔): `Icecast`**
    *   职责：接收来自 Liquidsoap 的音频流，并将其广播出去，允许多个客户端同时连接收听。
    *   它提供了一个稳定的、公开的流地址（如 `http://your-ip:8000/radio`）。

*   **控制后端与管理界面 (电台控制室): `Node.js + Express`**
    *   职责：
        1.  **播放列表管理**：管理歌曲列表，实现上传、删除、编辑等功能。
        2.  **控制 Liquidsoap**：通过 Telnet 接口控制 Liquidsoap，实现切歌、重载播放列表等功能。
        3.  **提供管理API**：暴露 HTTP API 接口，允许管理后台对歌曲列表进行增、删、改、查。
        4.  **实时歌曲信息推送**：通过 Redis 和 Socket.IO 将当前播放的歌曲信息实时推送到前端。
        5.  **托管Web页面**：同时作为 Web 服务器，提供"收音机"播放页面和"歌单管理"后台页面。

*   **播放前端 (收音机): `HTML + CSS + JS`**
    *   职责：一个极简的静态网页，内含一个 `<audio>` 标签，其 `src` 指向 Icecast 提供的流地址。它只负责播放，没有任何其他逻辑。

## 3. 技术栈

*   **后端**: Node.js, Express.js
*   **流媒体服务器**: Icecast 2
*   **音频处理**: Liquidsoap
*   **实时通信**: Socket.IO, Redis
*   **前端**: HTML5, CSS3, JavaScript (原生)
*   **数据存储**: JSON 文件 (用于存储播放列表)
*   **进程管理**: PM2

## 4. 优化后的项目文件结构

```
static-fm/
├── client/                  # 前端代码
│   ├── public/             # 静态资源
│   │   ├── assets/         # 图片、字体等静态资源
│   │   ├── index.html      # 收音机播放页面
│   │   ├── admin.html      # 旧版管理后台页面
│   │   ├── manager.html    # 新版管理后台页面
│   │   ├── error.html      # 错误页面
│   │   └── stats.html      # 统计页面
│   └── src/                # 前端源代码（未来可扩展）
├── server/                 # 后端代码
│   ├── config/             # 配置文件
│   │   ├── icecast.xml     # Icecast 配置文件
│   │   └── radio.liq       # Liquidsoap 脚本
│   ├── controllers/        # 控制器
│   │   ├── mainController.js    # 主要控制器
│   │   └── adminController.js   # 管理控制器
│   ├── middleware/         # 中间件
│   │   └── pino.js
│   ├── models/             # 数据模型
│   ├── routes/             # 路由
│   │   ├── main.js         # 主要 API 路由
│   │   └── admin.js        # 管理 API 路由
│   ├── scripts/            # 脚本文件
│   │   └── publish-track.js # Redis 发布脚本
│   ├── services/           # 业务逻辑服务
│   │   ├── liquidsoapService.js # Liquidsoap 服务
│   │   ├── playlistService.js   # 播放列表服务
│   │   ├── redisService.js      # Redis 服务
│   │   └── systemService.js     # 系统服务
│   ├── utils/              # 工具函数
│   │   └── logger.js
│   ├── views/              # 模板文件
│   ├── app.js              # 应用创建和配置
│   ├── server.js           # 服务器启动文件
│   └── admin.js            # 管理路由（向后兼容）
├── shared/                 # 前后端共享代码
│   └── constants/          # 常量定义
├── logs/                   # 日志文件
├── music/                  # 音乐文件
├── playlists/              # 播放列表
├── uploads/                # 上传文件
├── ecosystem.config.js     # PM2 配置
├── package.json            # 项目依赖
├── start.js                # 启动脚本
└── README.md               # 本文档
```

## 5. 部署与运行指南

### 前置条件
确保服务器上已安装以下软件:

1.  Node.js (LTS 版本)
2.  npm
3.  Liquidsoap
4.  Icecast2
5.  Redis

### 步骤 1: 配置并启动 Icecast

1.  编辑 Icecast 配置文件 (`server/config/icecast.xml`)。
2.  修改以下关键部分：
    *   `<source-password>`: 设置一个复杂的密码，这是 Liquidsoap 推流时需要用的。
    *   `<admin-password>`: 设置管理后台的密码。
    *   记下 `<port>` (默认为 `8000`)。
3.  启动 Icecast 服务:

    ```bash
    icecast -c server/config/icecast.xml
    ```

### 步骤 2: 配置 Node.js 后端

1.  将本项目代码克隆或上传到服务器。
2.  在项目根目录，安装项目依赖:

    ```bash
    npm install
    ```

### 步骤 3: 配置 Liquidsoap

1.  编辑 `server/config/radio.liq` 文件，根据需要调整配置。
2.  启动 Liquidsoap:

    ```bash
    liquidsoap server/config/radio.liq
    ```

### 步骤 4: 启动 Redis 服务器

```bash
redis-server
```

### 步骤 5: 启动 Node.js 服务

推荐使用 PM2 进行持久化运行:

```bash
# 安装 PM2 (如果尚未安装)
npm install pm2 -g

# 使用 PM2 启动服务
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

或者使用我们提供的启动脚本:

```bash
node start.js
```

### 步骤 6: 访问

*   **收听电台**: `http://你的服务器IP:3000`
*   **新版管理后台**: `http://你的服务器IP:3000/manager.html`
*   **旧版管理后台**: `http://你的服务器IP:3000/admin`
*   **Icecast 管理界面**: `http://你的服务器IP:8000`

## 6. 实时歌曲信息推送机制

本项目通过以下方式实现实时歌曲信息推送：

1.  **Liquidsoap** 在切歌时直接调用 Node.js 脚本 `server/scripts/publish-track.js`
2.  **Node.js 脚本** 将歌曲信息发布到 Redis 频道 `current_track`
3.  **Node.js 服务器** 订阅 Redis 频道，并通过 Socket.IO 将信息推送到所有连接的客户端
4.  **前端页面** 通过 Socket.IO 接收实时歌曲信息并显示

## 7. API 接口说明

### 歌曲管理 (通过 admin.js 提供)

*   **`GET /admin/api/playlist`**: 获取当前播放列表中的所有歌曲。
*   **`POST /admin/upload`**: 上传一首新歌曲。使用 `multipart/form-data` 格式。
*   **`DELETE /admin/api/playlist/:id`**: 从播放列表中删除指定ID的歌曲。
*   **`PUT /admin/api/playlist/:id`**: 更新指定ID歌曲的信息。
*   **`POST /admin/api/playlist/reorder`**: 重新排序播放列表。

### 系统控制 (通过 admin.js 提供)

*   **`POST /admin/api/system/skip`**: 强制立即切换到下一首歌。
*   **`POST /admin/api/system/reload`**: 重新加载播放列表。
*   **`POST /admin/api/system/start-liquidsoap`**: 启动 Liquidsoap。
*   **`POST /admin/api/system/stop-liquidsoap`**: 停止 Liquidsoap。
*   **`POST /admin/api/system/restart-liquidsoap`**: 重启 Liquidsoap。

### 当前播放信息 (通过 server.js 提供)

*   **`GET /api/current`**: 获取当前播放的歌曲信息。

## 8. 后续开发计划

*   [x] **实时歌曲信息推送**: 通过 Redis 和 Socket.IO 实现当前播放歌曲的实时推送
*   [x] **改进管理界面**: 创建更现代化、功能更完善的管理界面
*   [x] **优化项目结构**: 采用更清晰的目录结构，便于维护和扩展
*   [x] **合并应用**: 将主应用和管理应用合并为单一 Web 应用，简化部署
*   [x] **控制器拆分**: 将路由逻辑拆分为独立的控制器，提高代码可维护性
*   [ ] **播放统计**: 记录歌曲播放次数、用户收听时长等统计信息
*   [ ] **定时播放列表**: 支持按时间自动切换不同的播放列表
*   [ ] **远程音乐库**: 支持从网络位置（如云存储）添加音乐
*   [ ] **Docker 化部署**: 创建 `Dockerfile` 和 `docker-compose.yml`，实现一键部署整个服务