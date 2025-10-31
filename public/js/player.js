// 最终修正版
function radioPlayer() {
    return {
        audio: null,
        canvas: null,
        waveInstance: null,
        isPlaying: false,
        hasError: false,
        loading: false,
        trackTitle: '加载中...',
        artist: '',
        statusMessage: '准备就绪',
        volume: 0.5,
        eventSource: null, // 添加SSE连接

        init() {
            this.audio = document.getElementById('radio-audio');
            this.canvas = document.getElementById('wave-canvas');
            this.audio.volume = this.volume;

            // --- 修改后的事件监听 --- 
            // 'play' 和 'pause' 只负责更新UI状态，不执行任何破坏性操作
            this.audio.addEventListener('play', () => {
                this.isPlaying = true;
                this.hasError = false;
                this.statusMessage = '正在播放';
                // 确保在播放时重新初始化可视化
                if (!this.waveInstance) {
                    this.setupWave();
                }
            });

            this.audio.addEventListener('pause', () => {
                this.isPlaying = false;
                // 不再在这里销毁src，只更新标题
                if (
                    this.audio.readyState > 0 &&
                    !this.audio.ended
                ) {
                    this.statusMessage = '已暂停';
                }
            });

            // 其他事件监听保持不变
            this.audio.addEventListener('error', (e) => {
                console.error('Audio error', e);
                this.showError('音频播放出错');
            });
            this.audio.addEventListener('ended', () => {
                this.isPlaying = false;
            });
            this.audio.addEventListener('timeupdate', () => {
                if (this.isPlaying && this.waveInstance) {
                    if (this.waveInstance.animationCallback) {
                        this.waveInstance.animationCallback();
                    }
                }
            });

            // 设置 Media Session，这是关键
            this.setupMediaSession();

            // 初始化SSE连接以获取歌曲信息
            this.initSSE();

            // Wave.js 初始化... (这部分不变)
            const waitForWave = () => {
                if (typeof Wave !== 'undefined') {
                    this.setupWave();
                } else {
                    setTimeout(waitForWave, 100);
                }
            };
            waitForWave();

            window.addEventListener('resize', () =>
                this.resizeCanvas(),
            );
            this.resizeCanvas();
        },

        // 初始化SSE连接
        initSSE() {
            try {
                // 如果已存在连接，先关闭它
                if (this.eventSource) {
                    this.eventSource.close();
                }

                this.eventSource = new EventSource('/current/stream');
                
                this.eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.updateTrackInfo(data);
                    } catch (e) {
                        console.error('解析SSE数据失败:', e);
                    }
                };

                this.eventSource.onerror = (err) => {
                    console.error('SSE连接错误:', err);
                    this.statusMessage = '无法获取歌曲信息';
                };

            } catch (e) {
                console.error('初始化SSE连接失败:', e);
                this.statusMessage = '无法建立歌曲信息连接';
            }
        },

        // 更新歌曲信息
        updateTrackInfo(data) {
            if (data.title) {
                this.trackTitle = data.title;
            }
            if (data.artist) {
                this.artist = data.artist;
            }
            
            // 更新媒体会话元数据
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: this.trackTitle,
                    artist: this.artist,
                    album: 'Radio',
                });
            }
        },

        setupMediaSession() {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata(
                    {
                        title: '实时电台',
                        artist: 'Live Stream',
                        album: 'Radio',
                    },
                );

                // 核心：将浏览器的"播放"指令指向我们自定义的 startStream 函数
                navigator.mediaSession.setActionHandler(
                    'play',
                    () => {
                        this.startStream();
                    },
                );

                // 核心：将浏览器的"暂停"指令指向 audio 元素自身的 pause 方法
                navigator.mediaSession.setActionHandler(
                    'pause',
                    () => {
                        this.audio.pause();
                    },
                );
            }
        },

        // 统一的、永远播放最新流的函数
        async startStream() {
            if (this.loading) return; // 防止重复点击

            this.loading = true;
            this.statusMessage = '正在连接...';

            try {
                // --- 强制重新加载的逻辑现在只在这里 ---
                const streamUrl =
                    'https://radio.startend.xyz/radio';
                this.audio.src = streamUrl;
                this.audio.load(); // 明确告诉浏览器去加载
                await this.audio.play();
                // 播放成功后的状态更新会由 'play' 事件监听器处理
            } catch (err) {
                console.error('播放失败:', err);
                this.showError('无法播放音频: ' + err.message);
            } finally {
                this.loading = false;
            }
        },

        // 页面上的播放/暂停按钮
        togglePlay() {
            if (this.isPlaying) {
                this.audio.pause(); // 仅仅暂停
            } else {
                this.startStream(); // 总是通过"智能"播放函数来启动
            }
        },

        // 重连按钮
        reloadStream() {
            this.startStream();
        },

        // --- 您原来的其他辅助函数保持不变 ---
        resizeCanvas() {
            if (!this.canvas) return;

            const dpr = window.devicePixelRatio || 1;
            const rect = this.canvas.getBoundingClientRect();
            this.canvas.width = Math.max(
                1,
                Math.floor(rect.width * dpr),
            );
            this.canvas.height = Math.max(
                1,
                Math.floor(rect.height * dpr),
            );
            if (this.waveInstance) {
                this.waveInstance.canvas = this.canvas;
            }
        },
        setupWave() {
            try {
                if (!this.audio || !this.canvas) return;
                const ctx = this.canvas.getContext('2d');
                if (!ctx) throw new Error('无法获取canvas上下文');
                if (this.waveInstance) {
                    if (this.waveInstance.animationFrames) {
                        this.waveInstance.animationFrames = [];
                    }
                } else {
                    this.waveInstance = new Wave(
                        this.audio,
                        this.canvas,
                    );
                }
                if (
                    this.waveInstance &&
                    this.waveInstance.animations
                ) {
                    this.waveInstance.animationFrames = [];
                    const animationsOptions = {
                        Lines: {
                            count: 64,
                            lineWidth: 2,
                            lineColor: {
                                gradient: ['#00ffd5', '#0077ff'],
                                rotate: 90,
                            },
                            frequencyBand: 'mids',
                        },
                        Wave: {
                            lineWidth: 3,
                            lineColor: {
                                gradient: ['#00ffd5', '#0077ff'],
                                rotate: 90,
                            },
                            frequencyBand: 'mids',
                        },
                    };
                    const animationPriority = ['Lines', 'Wave'];
                    let selectedAnimation = null;
                    for (const animType of animationPriority) {
                        if (
                            this.waveInstance.animations[animType]
                        ) {
                            selectedAnimation = animType;
                            break;
                        }
                    }
                    if (!selectedAnimation) {
                        const availableAnimations = Object.keys(
                            this.waveInstance.animations,
                        );
                        if (availableAnimations.length > 0)
                            selectedAnimation =
                                availableAnimations[0];
                    }
                    if (
                        selectedAnimation &&
                        this.waveInstance.animations[
                            selectedAnimation
                        ]
                    ) {
                        const options =
                            animationsOptions[selectedAnimation] ||
                            {};
                        this.waveInstance.addAnimation(
                            new this.waveInstance.animations[
                                selectedAnimation
                            ](options),
                        );
                    }
                } else {
                    throw new Error('Wave.js动画对象未正确初始化');
                }
            } catch (err) {
                console.error('Wave.js 初始化失败', err);
                this.showError('可视化初始化失败: ' + err.message);
            }
        },
        setVolume() {
            if (this.audio) this.audio.volume = this.volume;
        },
        showError(msg) {
            this.statusMessage = msg;
            this.hasError = true;
        },
    };
}