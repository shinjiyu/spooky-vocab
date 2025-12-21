#!/bin/bash

# ========================================
# Spooky Vocab 线上部署脚本
# ========================================

set -e

echo "=========================================="
echo "  🚀 Spooky Vocab 部署脚本"
echo "=========================================="

# 服务器信息
SERVER="root@43.156.244.45"
REMOTE_DIR="/root/english-helper"

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
  ./backend/ ${SERVER}:${REMOTE_DIR}/backend/

# 2. 同步复习系统
echo ""
echo "[2/4] 📦 同步复习系统..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  ./review-app/ ${SERVER}:${REMOTE_DIR}/review-app/

# 3. 同步监控页面
echo ""
echo "[3/4] 📦 同步监控页面..."
rsync -avz --progress \
  ./online_config/monitor/ ${SERVER}:${REMOTE_DIR}/monitor/

# 4. 同步 docker-compose 配置
echo ""
echo "[4/4] 📦 同步 Docker 配置..."
rsync -avz --progress \
  ./online_config/docker-compose.server.yml ${SERVER}:${REMOTE_DIR}/docker-compose.yml

echo ""
echo "=========================================="
echo "  ✅ 文件同步完成！"
echo "=========================================="
echo ""
echo "📋 接下来请 SSH 登录服务器重启服务："
echo ""
echo "  ssh ${SERVER}"
echo "  # 密码: Wp7)jg(NHh+~8?S-"
echo ""
echo "  cd ${REMOTE_DIR}"
echo "  docker-compose down"
echo "  docker-compose up -d --build"
echo "  docker-compose logs -f"
echo ""
echo "📍 访问地址："
echo "  - API: https://kuroneko.chat/vocab-api/health"
echo "  - 复习: https://kuroneko.chat/vocab-review/"
echo "  - 监控: https://kuroneko.chat/vocab-monitor/"
echo ""
