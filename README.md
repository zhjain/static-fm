# Static FM - 个人网络电台

## 1. 项目简介

Static FM 是一个私人的、不间断的网络音频流服务。其核心理念是模拟一个真实的"电台"，服务器在后台持续不断地根据预设的播放列表生成音频流。任何设备（电脑、手机、平板等）上的客户端只需访问一个简单的网页，即可收听这个唯一的、同步的音频流，无需登录，也无需进行任何复杂的播放控制。

该项目解决了在不同设备、不同音乐软件间同步歌单和播放状态的痛点，提供了一个"打开即听"、完全同步的纯粹听歌体验。

## 2. 核心理念与架构

本项目采用"**服务器推流，客户端收听**"的电台模式，而非传统的"客户端请求，服务器响应"的文件播放模式。

**架构图:**

```
[ 音乐文件 ] -> [ Node.js 控制后端 ] -> [ FFmpeg (编码推流) ] -> [ Icecast (流媒体服务器) ] -> [ 客户端 (Web浏览器) ]
      ^                                                                                    ^
      |                                                                                    |
      +----------------- [ 管理后台 (Web页面) ] <-> [ Node.js 控制后端 API ] -------------------+
```

**组件分工:**

*   **推流核心 (DJ): `FFmpeg`**
    *   职责：读取指定的音乐文件，将其编码为连续的 MP3 音频流。
    *   它不关心播放列表，只负责执行由 Node.js 后端下达的"播放这个文件"的指令。

*   **流媒体服务器 (电台塔): `Icecast`**
    *   职责：接收来自 FFmpeg 的音频流，并将其广播出去，允许多个客户端同时连接收听。
    *   它提供了一个稳定的、公开的流地址（如 `http://your-ip:8000/stream.mp3`）。

*   **控制后端与管理界面 (电台控制室): `Node.js + Express`**
    *   职责：
        1.  **播放逻辑控制**：管理歌曲列表，实现随机、顺序等播放逻辑，决定"下一首"要播放什么。
        2.  **驱动 FFmpeg**：通过 `child_process` 模块启动、监控和停止 FFmpeg 进程，命令它播放指定的歌曲文件。
        3.  **提供管理API**：暴露 HTTP API 接口，允许管理后台对歌曲列表进行增、删、改、查。
        4.  **托管Web页面**：同时作为 Web 服务器，提供"收音机"播放页面和"歌单管理"后台页面。

*   **播放前端 (收音机): `HTML + CSS + JS`**
    *   职责：一个极简的静态网页，内含一个 `<audio>` 标签，其 `src` 指向 Icecast 提供的流地址。它只负责播放，没有任何其他逻辑。

## 3. 技术栈

*   **后端**: Node.js, Express.js
*   **流媒体服务器**: Icecast 2
*   **音视频处理**: FFmpeg
*   **前端**: HTML5, CSS3, JavaScript (原生)
*   **数据存储**: JSON 文件 (用于存储播放列表，后续可升级为 SQLite 或其他数据库)
*   **进程管理 (推荐)**: PM2

## 4. 项目文件结构

```
static-fm/
├── music/                # 存放所有音乐源文件 (.mp3, .flac, etc.)
├── data/
│   └── playlist.json     # 存储歌曲列表和播放状态
├── public/               # 存放所有对外的静态Web文件
│   ├── index.html        # "收音机"播放页面
│   └── admin.html        # "歌单管理"后台页面
│   └── assets/           # 存放 css, js, images 等
│       └── admin.js      # 管理后台的逻辑
├── config.js             # 配置文件 (Icecast密码, 端口等)
├── server.js             # Express 应用主文件, 包含API和FFmpeg驱动逻辑
├── package.json
└── README.md             # 本文档
```

## 5. 部署与运行指南

### 前置条件
确保服务器上已安装以下软件:

1.  Node.js (LTS 版本)
2.  npm
3.  FFmpeg
4.  Icecast2

### 步骤 1: 配置并启动 Icecast

1.  编辑 Icecast 配置文件 (通常在 `/etc/icecast2/icecast.xml`)。
2.  修改以下关键部分：
    *   `<source-password>`: 设置一个复杂的密码，这是 FFmpeg 推流时需要用的。
    *   `<admin-password>`: 设置管理后台的密码。
    *   记下 `<port>` (默认为 `8000`)。
3.  启动 Icecast 服务:

    ```bash
    sudo systemctl start icecast2
    sudo systemctl enable icecast2 # 设置开机自启
    ```

### 步骤 2: 配置 Node.js 后端

1.  将本项目代码克隆或上传到服务器。
2.  在项目根目录，创建 `config.js` 文件，内容如下：

    ```javascript
    export default {
        icecast: {
            host: 'localhost',
            port: 8000,
            password: '你在icecast.xml中设置的source-password',
            mount: '/stream.mp3' // 电台频道名
        },
        server: {
            port: 3000 // Node.js 服务运行的端口
        },
        musicDirectory: './music'
    };
    ```

3.  安装项目依赖:

    ```bash
    npm install
    ```

### 步骤 3: 运行项目

1.  将你的音乐文件放入 `music/` 文件夹。
2.  首次运行或音乐文件有变动时，可以设计一个初始化脚本来生成 `data/playlist.json`。
3.  启动 Node.js 服务 (推荐使用 PM2 进行持久化运行):

    ```bash
    # 安装 PM2 (如果尚未安装)
    npm install pm2 -g
    
    # 使用 PM2 启动服务
    pm2 start server.js --name "static-fm"
    
    # 设置开机自启
    pm2 startup
    pm2 save
    ```

### 步骤 4: 访问

*   **收听电台**: `http://你的服务器IP:3000`
*   **管理后台**: `http://你的服务器IP:3000/admin.html`
*   **Icecast 管理界面**: `http://你的服务器IP:8000`

## 6. API 接口说明 (V1.0)

所有 API 均由 `server.js` 提供，前缀为 `/api`。

### 歌曲管理

*   **`GET /api/songs`**: 获取当前播放列表中的所有歌曲。
*   **`POST /api/upload`**: 上传一首新歌曲。使用 `multipart/form-data` 格式。
*   **`DELETE /api/songs/:id`**: 从播放列表中删除指定ID的歌曲。

### 播放控制

*   **`GET /api/status`**: 获取当前电台状态，包括正在播放的歌曲、开始时间等。
*   **`POST /api/control/next`**: 强制立即切换到下一首歌。
*   **`POST /api/control/rescan`**: 重新扫描 `music/` 文件夹，更新歌曲库。

## 7. 后续开发计划

*   [ ] **无缝切歌**: 研究更平滑的 FFmpeg 切歌方案，例如使用 `concat` 协议或交叉渐变滤镜，消除切换时的短暂中断。
*   [ ] **实时元数据**: 实现将当前播放的歌曲名、艺术家等信息实时推送到 Icecast，并在播放前端显示。
*   [ ] **管理后台认证**: 为 `admin.html` 页面增加简单的密码认证。
*   [ ] **数据库支持**: 将 `playlist.json` 升级为 SQLite 数据库，以支持更大规模的音乐库和更复杂的查询。
*   [ ] **多样化播放列表**: 增加"点歌"、"按主题播放"等更丰富的播放列表管理功能。
*   [ ] **Docker 化部署**: 创建 `Dockerfile` 和 `docker-compose.yml`，实现一键部署整个服务。