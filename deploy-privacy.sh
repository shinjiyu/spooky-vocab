#!/bin/bash
# 部署隐私政策页面到服务器

echo "=== 部署隐私政策页面 ==="
echo ""
echo "请手动执行以下命令："
echo ""
echo "1. SSH 登录服务器:"
echo "   ssh root@43.156.244.45"
echo "   密码: Wp7)jg(NHh+~8?S-"
echo ""
echo "2. 更新代码并重启服务:"
echo "   cd /opt/english_helper"
echo "   git pull"
echo "   docker-compose up -d --build"
echo ""
echo "3. 验证部署:"
echo "   curl https://kuroneko.chat/vocab-api/public/privacy.html | head -20"
echo ""
echo "=== 隐私政策 URL ==="
echo "https://kuroneko.chat/vocab-api/public/privacy.html"
echo ""

