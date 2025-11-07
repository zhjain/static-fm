function adminApp() {
    return {
        // 数据属性
        selectedFiles: [],
        songs: [],
        currentSong: '未知',
        playerStatus: '未知',
        uploading: false,
        uploadStatus: '',
        uploadResult: [],
        
        // 初始化
        init() {
            this.loadSongs();
            this.updateStatus();
            // 每5秒更新一次状态
            setInterval(() => this.updateStatus(), 5000);
            // 每30秒更新一次歌曲列表
            setInterval(() => this.loadSongs(), 30000);
        },
        
        // 处理文件选择
        handleFileSelect(event) {
            const files = Array.from(event.target.files);
            this.selectedFiles = files;
        },
        
        // 上传歌曲
        async uploadSongs() {
            if (this.selectedFiles.length === 0) {
                alert('请至少选择一个文件');
                return;
            }
            
            this.uploading = true;
            this.uploadStatus = '上传中...请稍候';
            this.uploadResult = [];
            
            try {
                const formData = new FormData();
                this.selectedFiles.forEach(file => {
                    formData.append('songs', file);
                });
                
                const response = await fetch('/admin/upload', {
                    method: 'POST',
                    body: formData,
                });
                
                const data = await response.json();
                
                if (data.error) {
                    alert('上传失败: ' + data.error);
                } else {
                    alert('上传成功!');
                    this.loadSongs(); // 重新加载歌曲列表
                    document.getElementById('songFile').value = ''; // 清空文件输入
                    this.selectedFiles = []; // 清空选中文件列表
                }
            } catch (error) {
                console.error('上传失败:', error);
                alert('上传失败: ' + error.message);
            } finally {
                this.uploading = false;
                this.uploadStatus = '';
            }
        },
        
        // 加载歌曲列表
        async loadSongs() {
            try {
                const response = await fetch('/admin/api/playlist');
                const data = await response.json();
                // 翻转歌曲列表，使最新添加的歌曲显示在最上面
                this.songs = data.data.slice().reverse();
            } catch (error) {
                console.error('加载歌曲列表失败:', error);
            }
        },
        
        // 删除歌曲
        async deleteSong(songId) {
            if (!confirm('确定要删除这首歌曲吗?')) {
                return;
            }
            
            try {
                const response = await fetch(`/admin/api/playlist/${songId}`, {
                    method: 'DELETE',
                });
                
                const data = await response.json();
                
                if (data.error) {
                    alert('删除失败: ' + data.error);
                } else {
                    alert('删除成功!');
                    this.loadSongs(); // 重新加载歌曲列表
                }
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败: ' + error.message);
            }
        },
        
        // 重新扫描
        async rescanSongs() {
            try {
                const response = await fetch('/admin/api/control/rescan', {
                    method: 'POST',
                });
                
                const data = await response.json();
                alert('重新扫描完成');
                this.loadSongs();
            } catch (error) {
                console.error('重新扫描失败:', error);
                alert('操作失败: ' + error.message);
            }
        },
        
        // 下一首
        async nextSong() {
            try {
                const response = await fetch('/admin/api/control/next', {
                    method: 'POST',
                });
                
                const data = await response.json();
                alert('已切换到下一首');
            } catch (error) {
                console.error('切换下一首失败:', error);
                alert('操作失败: ' + error.message);
            }
        },
        
        // 更新状态
        async updateStatus() {
            try {
                const response = await fetch('/admin/api/status');
                const data = await response.json();
                
                if (data.data) {
                    this.currentSong = data.data.currentTrack || '暂无信息';
                    this.playerStatus = data.data.liquidsoap && data.data.icecast 
                        ? '正在播放' 
                        : '未播放';
                } else {
                    this.currentSong = '暂无信息';
                    this.playerStatus = '未知';
                }
            } catch (error) {
                console.error('获取状态失败:', error);
            }
        },
        
        // 格式化文件大小
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        // 格式化日期
        formatDate(dateString) {
            return new Date(dateString).toLocaleString();
        }
    };
}