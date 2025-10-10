# Makefile for Express Radio Server

# 定义变量
NODE_BIN = ./node_modules/.bin
NODE_ENV = development
PORT = 3000
ICECAST_CONFIG = ./config/icecast.xml
LIQUIDSOAP_CONFIG = ./config/radio.liq

# 默认目标
.PHONY: help
help:
	@echo "Express Radio Server Makefile"
	@echo "============================"
	@echo "make install           - 安装Node.js依赖"
	@echo "make install-all       - 安装所有依赖（Node.js, Icecast, Liquidsoap）"
	@echo "make install-icecast   - 安装Icecast2"
	@echo "make install-liquidsoap - 安装Liquidsoap"
	@echo "make configure-icecast - 复制Icecast配置文件到/etc目录"
	@echo "make setup-directories - 创建Liquidsoap所需的目录"
	@echo "make start             - 启动所有服务（Express, Icecast, Liquidsoap）"
	@echo "make dev               - 开发模式启动（带热重载）"
	@echo "make stop              - 停止所有服务"
	@echo "make restart           - 重启所有服务"
	@echo "make status            - 查看所有服务状态"
	@echo "make logs              - 查看服务器日志"
	@echo "make clean             - 清理日志文件"
	@echo "make daemon            - 后台运行服务（使用PM2）"
	@echo "make daemon-stop       - 停止后台运行的服务"
	@echo "make daemon-status     - 查看后台运行的服务状态"
	@echo "make daemon-logs       - 查看后台服务日志"
	@echo ""
	@echo "Icecast相关命令:"
	@echo "make icecast-start     - 启动Icecast服务"
	@echo "make icecast-stop      - 停止Icecast服务"
	@echo "make icecast-status    - 查看Icecast服务状态"
	@echo "make icecast-systemctl-enable  - 设置Icecast开机自启"
	@echo "make icecast-systemctl-disable - 禁用Icecast开机自启"
	@echo "make icecast-systemctl-start   - 使用systemctl启动Icecast"
	@echo "make icecast-systemctl-stop    - 使用systemctl停止Icecast"
	@echo ""
	@echo "Liquidsoap相关命令:"
	@echo "make liquidsoap-start  - 启动Liquidsoap服务"
	@echo "make liquidsoap-stop   - 停止Liquidsoap服务"
	@echo "make liquidsoap-status - 查看Liquidsoap服务状态"
	@echo ""
	@echo "make help              - 显示帮助信息"

# 安装Node.js依赖
.PHONY: install
install:
	@echo "正在安装Node.js依赖..."
	pnpm install

# 安装Icecast2
.PHONY: install-icecast
install-icecast:
	@echo "正在安装Icecast2..."
	@if command -v apt-get &> /dev/null; then \
		sudo apt-get update && sudo apt-get install -y icecast2; \
		echo "Icecast2安装完成，大多数系统会自动创建systemctl服务文件"; \
		echo "您可以使用 'systemctl status icecast2' 检查服务状态"; \
	elif command -v yum &> /dev/null; then \
		sudo yum install -y icecast; \
		echo "Icecast安装完成，可能需要手动配置systemctl服务文件"; \
	elif command -v pacman &> /dev/null; then \
		sudo pacman -S icecast; \
		echo "Icecast安装完成，可能需要手动配置systemctl服务文件"; \
	elif command -v apk &> /dev/null; then \
		sudo apk add icecast; \
		echo "Icecast安装完成，可能需要手动配置systemctl服务文件"; \
	else \
		echo "不支持的包管理器，请手动安装Icecast2"; \
	fi

# 安装Liquidsoap
.PHONY: install-liquidsoap
install-liquidsoap:
	@echo "正在安装Liquidsoap..."
	@if command -v apt-get &> /dev/null; then \
		sudo apt-get update && sudo apt-get install -y liquidsoap ffmpeg; \
	elif command -v yum &> /dev/null; then \
		sudo yum install -y liquidsoap; \
	elif command -v pacman &> /dev/null; then \
		sudo pacman -S liquidsoap; \
	elif command -v apk &> /dev/null; then \
		sudo apk add liquidsoap; \
	elif command -v dnf &> /dev/null; then \
		sudo dnf install -y liquidsoap; \
	else \
		echo "不支持的包管理器，请手动安装Liquidsoap"; \
	fi

# 安装所有依赖
.PHONY: install-all
install-all: install install-icecast install-liquidsoap
	@echo "所有依赖安装完成"

# 配置Icecast
.PHONY: configure-icecast
configure-icecast:
	@echo "正在复制Icecast配置文件到/etc目录..."
	@if [ -f $(ICECAST_CONFIG) ]; then \
		sudo cp $(ICECAST_CONFIG)  /usr/local/etc/icecast.xml; \
		sudo chown icecast2:icecast  /usr/local/etc/icecast.xml; \
		echo "Icecast配置文件已复制到 /usr/local/etc/icecast.xml"; \
	else \
		echo "未找到Icecast配置文件: $(ICECAST_CONFIG)"; \
	fi

# 创建Liquidsoap所需的目录
.PHONY: setup-directories
setup-directories:
	@echo "正在创建Liquidsoap所需的目录..."
	@if [ ! -d "/var/run/liquidsoap" ]; then \
		sudo mkdir -p /var/run/liquidsoap; \
		sudo chown $(USER):$(USER) /var/run/liquidsoap; \
		echo "已创建 /var/run/liquidsoap 目录"; \
	else \
		echo "/var/run/liquidsoap 目录已存在"; \
	fi
	@if [ ! -d "/var/log/liquidsoap" ]; then \
		sudo mkdir -p /var/log/liquidsoap; \
		sudo chown $(USER):$(USER) /var/log/liquidsoap; \
		echo "已创建 /var/log/liquidsoap 目录"; \
	else \
		echo "/var/log/liquidsoap 目录已存在"; \
	fi

# 启动所有服务
.PHONY: start
start: setup-directories icecast-systemctl-start liquidsoap-start
	@echo "正在启动Express服务器..."
	node server.js

# 开发模式启动（如果使用nodemon）
.PHONY: dev
dev: setup-directories icecast-start liquidsoap-start
	@echo "正在以开发模式启动服务器..."
	@if [ -f $(NODE_BIN)/nodemon ]; then \
		$(NODE_BIN)/nodemon server.js; \
	else \
		echo "nodemon未安装，使用node启动"; \
		node server.js; \
	fi

# 停止所有服务
.PHONY: stop
stop: liquidsoap-stop icecast-stop
	@echo "正在停止Express服务器..."
	@if pgrep -f "node server.js" > /dev/null; then \
		pkill -f "node server.js"; \
		echo "Express服务器已停止"; \
	else \
		echo "Express服务器未运行"; \
	fi

# 重启所有服务
.PHONY: restart
restart: stop start

# 查看所有服务状态
.PHONY: status
status: icecast-status liquidsoap-status
	@echo "检查Express服务器状态..."
	@if pgrep -f "node server.js" > /dev/null; then \
		echo "Express服务器正在运行"; \
	else \
		echo "Express服务器未运行"; \
	fi

# 查看日志
.PHONY: logs
logs:
	@echo "查看服务器日志..."
	@if [ -f logs/app.log ]; then \
		tail -f logs/app.log; \
	else \
		echo "日志文件不存在"; \
	fi

# 后台运行服务（使用PM2，仅Node.js应用）
.PHONY: daemon
daemon: setup-directories icecast-systemctl-restart
	@echo "正在后台启动服务..."
	@if command -v pm2 &> /dev/null; then \
		pm2 start ecosystem.config.js; \
	else \
		echo "PM2未安装，请先运行 'npm install pm2 -g' 进行安装"; \
	fi

# 停止后台运行的服务
.PHONY: daemon-stop
daemon-stop:
	@echo "正在停止后台服务..."
	@if command -v pm2 &> /dev/null; then \
		pm2 stop ecosystem.config.js; \
		pm2 delete ecosystem.config.js; \
		echo "PM2任务已停止并删除"; \
	else \
		echo "PM2未安装"; \
	fi

# 查看后台运行的服务状态
.PHONY: daemon-status
daemon-status:
	@echo "检查后台服务状态..."
	@if command -v pm2 &> /dev/null; then \
		pm2 list; \
	else \
		echo "PM2未安装"; \
	fi

# 查看后台服务日志
.PHONY: daemon-logs
daemon-logs:
	@echo "查看后台服务日志..."
	@if command -v pm2 &> /dev/null; then \
		pm2 logs static-fm; \
	else \
		echo "PM2未安装"; \
	fi

# 清理日志
.PHONY: clean
clean:
	@echo "清理日志文件..."
	@if [ -f logs/app.log ]; then \
		rm logs/app.log; \
		echo "日志文件已清理"; \
	else \
		echo "没有找到日志文件"; \
	fi

# Icecast相关命令
.PHONY: icecast-start
icecast-start:
	@echo "正在启动Icecast服务..."
	@if command -v icecast &> /dev/null; then \
		icecast -c $(ICECAST_CONFIG) -b; \
		echo "Icecast服务已启动"; \
	else \
		echo "未找到Icecast，请先安装Icecast"; \
	fi

.PHONY: icecast-stop
icecast-stop:
	@echo "正在停止Icecast服务..."
	@if pgrep -f "icecast" > /dev/null; then \
		pkill -f "icecast"; \
		echo "Icecast服务已停止"; \
	else \
		echo "Icecast服务未运行"; \
	fi

.PHONY: icecast-status
icecast-status:
	@echo "检查Icecast服务状态..."
	@if pgrep -f "icecast" > /dev/null; then \
		echo "Icecast服务正在运行"; \
	else \
		echo "Icecast服务未运行"; \
	fi

# Icecast systemctl相关命令
.PHONY: icecast-systemctl-enable
icecast-systemctl-enable:
	@echo "设置Icecast开机自启..."
	@if systemctl list-unit-files | grep -q icecast; then \
		sudo systemctl enable icecast2; \
		echo "Icecast已设置为开机自启"; \
	else \
		echo "未找到Icecast systemctl服务文件，可能需要手动创建"; \
	fi

.PHONY: icecast-systemctl-disable
icecast-systemctl-disable:
	@echo "禁用Icecast开机自启..."
	@if systemctl list-unit-files | grep -q icecast; then \
		sudo systemctl disable icecast2; \
		echo "Icecast已禁用开机自启"; \
	else \
		echo "未找到Icecast systemctl服务文件"; \
	fi

.PHONY: icecast-systemctl-start
icecast-systemctl-start:
	@echo "使用systemctl启动Icecast服务..."
	@if systemctl list-unit-files | grep -q icecast; then \
		sudo systemctl start icecast2; \
		echo "Icecast服务已通过systemctl启动"; \
	else \
		echo "未找到Icecast systemctl服务文件，使用传统方式启动"; \
		make icecast-start; \
	fi

.PHONY: icecast-systemctl-restart
icecast-systemctl-restart:
	@echo "使用systemctl重启Icecast服务..."
	@if systemctl list-unit-files | grep -q icecast; then \
		sudo systemctl restart icecast2; \
		echo "Icecast服务已通过systemctl重启"; \
	else \
		echo "未找到Icecast systemctl服务文件，使用传统方式重启"; \
		make icecast-stop; \
		make icecast-start; \
	fi

.PHONY: icecast-systemctl-stop
icecast-systemctl-stop:
	@echo "使用systemctl停止Icecast服务..."
	@if systemctl list-unit-files | grep -q icecast; then \
		sudo systemctl stop icecast2; \
		echo "Icecast服务已通过systemctl停止"; \
	else \
		echo "未找到Icecast systemctl服务文件，使用传统方式停止"; \
		make icecast-stop; \
	fi

# Liquidsoap相关命令
.PHONY: liquidsoap-start
liquidsoap-start:
	@echo "正在启动Liquidsoap服务..."
	@if command -v liquidsoap &> /dev/null; then \
		liquidsoap -d $(LIQUIDSOAP_CONFIG) & \
		echo "Liquidsoap服务已启动"; \
	else \
		echo "未找到Liquidsoap，请先安装Liquidsoap"; \
	fi

.PHONY: liquidsoap-stop
liquidsoap-stop:
	@echo "正在停止Liquidsoap服务..."
	@if pgrep -f "liquidsoap" > /dev/null; then \
		pkill -f "liquidsoap"; \
		echo "Liquidsoap服务已停止"; \
	else \
		echo "Liquidsoap服务未运行"; \
	fi

.PHONY: liquidsoap-status
liquidsoap-status:
	@echo "检查Liquidsoap服务状态..."
	@if pgrep -f "liquidsoap" > /dev/null; then \
		echo "Liquidsoap服务正在运行"; \
	else \
		echo "Liquidsoap服务未运行"; \
	fi