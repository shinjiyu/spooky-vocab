#!/bin/bash

# ========================================
# 从 online_config 仓库同步配置
# ========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_REPO="https://git.wemomo.com/yu.zhenyu/online_config.git"
TEMP_DIR="/tmp/online_config_sync"

echo "=========================================="
echo "  🔄 同步配置文件"
echo "=========================================="

# 克隆或更新配置仓库
if [ -d "$TEMP_DIR" ]; then
    echo "📥 更新配置仓库..."
    cd "$TEMP_DIR" && git pull --quiet
else
    echo "📥 克隆配置仓库..."
    git clone --quiet "$CONFIG_REPO" "$TEMP_DIR"
fi

# 检查 spooky-vocab 配置目录
if [ ! -d "$TEMP_DIR/spooky-vocab" ]; then
    echo "❌ 未找到 spooky-vocab 配置目录"
    exit 1
fi

# 复制配置文件
echo ""
echo "📋 复制配置文件..."

# 1. 项目配置
if [ -f "$TEMP_DIR/spooky-vocab/config.js" ]; then
    cp "$TEMP_DIR/spooky-vocab/config.js" "$PROJECT_DIR/config/config.local.js"
    echo "  ✅ config/config.local.js"
fi

# 2. Docker Compose（可选）
if [ -f "$TEMP_DIR/spooky-vocab/docker-compose.yml" ]; then
    mkdir -p "$PROJECT_DIR/online_config"
    cp "$TEMP_DIR/spooky-vocab/docker-compose.yml" "$PROJECT_DIR/online_config/docker-compose.server.yml"
    echo "  ✅ online_config/docker-compose.server.yml"
fi

# 3. 监控页面（可选）
if [ -d "$TEMP_DIR/spooky-vocab/monitor" ]; then
    mkdir -p "$PROJECT_DIR/online_config/monitor"
    cp -r "$TEMP_DIR/spooky-vocab/monitor/"* "$PROJECT_DIR/online_config/monitor/"
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

