#!/bin/bash

# ========================================
# 从 online_config 仓库同步配置
# ========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_REPO="https://git.wemomo.com/yu.zhenyu/online_config.git"

# 优先使用本地已克隆的仓库（和 english_helper 同级）
LOCAL_CONFIG_DIR="$(dirname "$PROJECT_DIR")/online_config"
TEMP_DIR="/tmp/online_config_sync"

echo "=========================================="
echo "  🔄 同步配置文件"
echo "=========================================="

# 检查本地仓库是否存在
if [ -d "$LOCAL_CONFIG_DIR/.git" ]; then
    echo "📂 使用本地仓库: $LOCAL_CONFIG_DIR"
    cd "$LOCAL_CONFIG_DIR" && git pull --quiet
    CONFIG_SOURCE="$LOCAL_CONFIG_DIR"
elif [ -d "$TEMP_DIR/.git" ]; then
    echo "📥 更新临时仓库..."
    cd "$TEMP_DIR" && git pull --quiet
    CONFIG_SOURCE="$TEMP_DIR"
else
    echo "📥 克隆配置仓库..."
    git clone --quiet "$CONFIG_REPO" "$TEMP_DIR"
    CONFIG_SOURCE="$TEMP_DIR"
fi

# 检查 spooky-vocab 配置目录
if [ ! -d "$CONFIG_SOURCE/spooky-vocab" ]; then
    echo "❌ 未找到 spooky-vocab 配置目录"
    exit 1
fi

# 复制配置文件
echo ""
echo "📋 复制配置文件..."

# 1. 项目配置
if [ -f "$CONFIG_SOURCE/spooky-vocab/config.js" ]; then
    cp "$CONFIG_SOURCE/spooky-vocab/config.js" "$PROJECT_DIR/config/config.local.js"
    echo "  ✅ config/config.local.js"
fi

# 2. Docker Compose（可选）
if [ -f "$CONFIG_SOURCE/spooky-vocab/docker-compose.yml" ]; then
    mkdir -p "$PROJECT_DIR/online_config"
    cp "$CONFIG_SOURCE/spooky-vocab/docker-compose.yml" "$PROJECT_DIR/online_config/docker-compose.server.yml"
    echo "  ✅ online_config/docker-compose.server.yml"
fi

# 3. 监控页面（可选）
if [ -d "$CONFIG_SOURCE/spooky-vocab/monitor" ]; then
    mkdir -p "$PROJECT_DIR/online_config/monitor"
    cp -r "$CONFIG_SOURCE/spooky-vocab/monitor/"* "$PROJECT_DIR/online_config/monitor/"
    echo "  ✅ online_config/monitor/"
fi

echo ""
echo "=========================================="
echo "  ✅ 配置同步完成！"
echo "=========================================="
echo ""
echo "接下来运行以下命令应用配置："
echo "  node scripts/apply-config.js"
echo ""

