#!/bin/bash

# ========================================
# Spooky Vocab 线上部署脚本
# ========================================

set -e

# 加载配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 检查配置文件
if [ -f "$PROJECT_DIR/config/config.local.js" ]; then
    echo "✓ 使用本地配置文件"
    # 从 JS 配置文件提取值
    SERVER_HOST=$(node -e "console.log(require('$PROJECT_DIR/config/config.local.js').server.host)")
    SERVER_USER=$(node -e "console.log(require('$PROJECT_DIR/config/config.local.js').server.user)")
    REMOTE_DIR=$(node -e "console.log(require('$PROJECT_DIR/config/config.local.js').server.remoteDir)")
else
    echo "❌ 未找到配置文件: config/config.local.js"
    echo "请复制 config/config.example.js 为 config/config.local.js 并填入真实配置"
    exit 1
fi

SERVER="${SERVER_USER}@${SERVER_HOST}"

echo "=========================================="
echo "  🚀 Spooky Vocab 部署脚本"
echo "=========================================="
echo "服务器: ${SERVER}"
echo "目标目录: ${REMOTE_DIR}"
echo ""

# 检查 rsync
if ! command -v rsync &> /dev/null; then
    echo "❌ 需要安装 rsync: brew install rsync"
    exit 1
fi

# 1. 同步后端代码
echo ""
echo "[1/4] 📦 同步后端代码..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'data/*.db' \
  --exclude 'data/*.db-*' \
  "$PROJECT_DIR/backend/" "${SERVER}:${REMOTE_DIR}/backend/"

# 2. 同步复习系统
echo ""
echo "[2/4] 📦 同步复习系统..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  "$PROJECT_DIR/review-app/" "${SERVER}:${REMOTE_DIR}/review-app/"

# 3. 同步监控页面（如果存在）
if [ -d "$PROJECT_DIR/online_config/monitor" ]; then
    echo ""
    echo "[3/4] 📦 同步监控页面..."
    rsync -avz --progress \
      "$PROJECT_DIR/online_config/monitor/" "${SERVER}:${REMOTE_DIR}/monitor/"
else
    echo ""
    echo "[3/4] ⏭ 跳过监控页面（目录不存在）"
fi

# 4. 同步 docker-compose 配置（如果存在）
if [ -f "$PROJECT_DIR/online_config/docker-compose.server.yml" ]; then
    echo ""
    echo "[4/4] 📦 同步 Docker 配置..."
    rsync -avz --progress \
      "$PROJECT_DIR/online_config/docker-compose.server.yml" "${SERVER}:${REMOTE_DIR}/docker-compose.yml"
else
    echo ""
    echo "[4/4] ⏭ 跳过 Docker 配置（文件不存在）"
fi

echo ""
echo "=========================================="
echo "  ✅ 文件同步完成！"
echo "=========================================="
echo ""
echo "📋 接下来请 SSH 登录服务器重启服务："
echo ""
echo "  ssh ${SERVER}"
echo ""
echo "  cd ${REMOTE_DIR}"
echo "  docker-compose down"
echo "  docker-compose up -d --build"
echo "  docker-compose logs -f"
echo ""

