#!/bin/bash
# Docker部署快速测试脚本

set -e

echo "🐳 Spooky Vocab - Docker部署测试"
echo "=================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Docker是否安装
echo "1️⃣  检查Docker安装..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker未安装${NC}"
    echo "请访问 https://www.docker.com/products/docker-desktop/"
    exit 1
fi
echo -e "${GREEN}✓ Docker已安装${NC}"
echo ""

# 检查Docker是否运行
echo "2️⃣  检查Docker状态..."
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker未运行${NC}"
    echo "请启动Docker Desktop"
    exit 1
fi
echo -e "${GREEN}✓ Docker正在运行${NC}"
echo ""

# 检查词典文件
echo "3️⃣  检查ECDICT词典..."
if [ ! -f "backend/data/ecdict.db" ]; then
    echo -e "${YELLOW}⚠ ECDICT词典不存在，开始下载...${NC}"
    mkdir -p backend/data
    cd backend/data
    echo "下载中... (约206MB，需要几分钟)"
    curl -L -o ecdict.zip "https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip"
    echo "解压中..."
    unzip -q ecdict.zip
    mv stardict.db ecdict.db
    rm ecdict.zip
    cd ../..
    echo -e "${GREEN}✓ 词典下载完成${NC}"
else
    echo -e "${GREEN}✓ ECDICT词典已存在${NC}"
    ls -lh backend/data/ecdict.db
fi
echo ""

# 构建并启动服务
echo "4️⃣  启动Docker服务..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build
echo -e "${GREEN}✓ 服务已启动${NC}"
echo ""

# 等待服务就绪
echo "5️⃣  等待服务就绪..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 服务已就绪${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ 服务启动超时${NC}"
        echo "查看日志："
        docker-compose logs --tail=50
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""

# 测试健康检查
echo "6️⃣  测试健康检查..."
HEALTH=$(curl -s http://localhost:3000/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ 健康检查通过${NC}"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo -e "${RED}❌ 健康检查失败${NC}"
    exit 1
fi
echo ""

# 测试登陆
echo "7️⃣  测试JWT登陆..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/test-token \
  -H "Content-Type: application/json" \
  -d '{"user_id":"docker_test","cefr_level":"B1"}')

if echo "$TOKEN_RESPONSE" | grep -q '"token"'; then
    echo -e "${GREEN}✓ 登陆成功${NC}"
    TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Token: ${TOKEN:0:50}..."
else
    echo -e "${RED}❌ 登陆失败${NC}"
    echo "$TOKEN_RESPONSE"
    exit 1
fi
echo ""

# 测试词汇查询
echo "8️⃣  测试词汇查询..."
VOCAB_RESPONSE=$(curl -s -X POST http://localhost:3000/api/vocabulary/batch-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"words":["hello","paradigm","ubiquitous"],"include_translation":true}')

if echo "$VOCAB_RESPONSE" | grep -q 'paradigm'; then
    echo -e "${GREEN}✓ 词汇查询成功${NC}"
    echo "示例翻译："
    echo "$VOCAB_RESPONSE" | python3 -m json.tool 2>/dev/null | grep -A 5 '"paradigm"' || echo "$VOCAB_RESPONSE"
else
    echo -e "${RED}❌ 词汇查询失败${NC}"
    echo "$VOCAB_RESPONSE"
    exit 1
fi
echo ""

# 显示容器状态
echo "9️⃣  容器状态..."
docker-compose ps
echo ""

# 成功提示
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 所有测试通过！Docker部署成功！${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo "📊 服务信息："
echo "  • 后端API: http://localhost:3000"
echo "  • 健康检查: http://localhost:3000/health"
echo "  • 词典: ECDICT (340万词)"
echo ""
echo "🔧 常用命令："
echo "  • 查看日志: docker-compose logs -f"
echo "  • 停止服务: docker-compose down"
echo "  • 重启服务: docker-compose restart"
echo ""
echo "📚 详细文档: DOCKER_DEPLOYMENT.md"
echo ""

