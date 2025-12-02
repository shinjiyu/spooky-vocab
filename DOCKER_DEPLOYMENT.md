# 🐳 Docker部署指南

## 📋 前提条件

### 1. 安装Docker Desktop (Mac)

**方法1: 官网下载**
```bash
# 访问 https://www.docker.com/products/docker-desktop/
# 下载Mac版本并安装
```

**方法2: Homebrew安装**
```bash
brew install --cask docker
```

**验证安装：**
```bash
docker --version
# 应显示：Docker version 24.x.x

docker-compose --version
# 应显示：Docker Compose version v2.x.x
```

---

## 🚀 快速开始

### 1. 准备ECDICT词典（首次运行）

```bash
cd backend/data

# 下载ECDICT词典（约206MB）
curl -L -o ecdict.zip "https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip"

# 解压
unzip ecdict.zip

# 重命名
mv stardict.db ecdict.db

# 清理
rm ecdict.zip

# 验证
ls -lh ecdict.db
# 应显示：812M的文件
```

### 2. 配置环境变量（可选）

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑环境变量（可选）
vim backend/.env
```

### 3. 启动服务

```bash
# 构建并启动（首次运行）
docker-compose up --build

# 或者后台运行
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 4. 验证服务

**健康检查：**
```bash
curl http://localhost:3000/health
```

**预期输出：**
```json
{
  "status": "ok",
  "service": "spookyvocab-backend",
  "version": "1.0.0",
  "timestamp": "2025-11-30T12:00:00.000Z"
}
```

---

## 📊 Docker Compose命令

### 基本操作

```bash
# 启动服务
docker-compose up

# 后台启动
docker-compose up -d

# 停止服务
docker-compose down

# 停止并删除数据卷（⚠️ 会删除数据库）
docker-compose down -v

# 重启服务
docker-compose restart

# 查看运行状态
docker-compose ps
```

### 日志管理

```bash
# 查看所有日志
docker-compose logs

# 实时跟踪日志
docker-compose logs -f

# 查看最近100行日志
docker-compose logs --tail=100

# 只看backend服务的日志
docker-compose logs backend
```

### 构建和更新

```bash
# 重新构建镜像
docker-compose build

# 重新构建并启动
docker-compose up --build

# 拉取最新镜像
docker-compose pull
```

---

## 🔧 开发模式

### 启用代码热重载

编辑 `docker-compose.yml`，取消注释：
```yaml
volumes:
  - ./backend/data:/app/data
  - ./backend/src:/app/src  # ← 取消这行注释
```

然后重启：
```bash
docker-compose down
docker-compose up -d
```

### 进入容器调试

```bash
# 进入容器shell
docker-compose exec backend sh

# 查看文件
ls -la /app/data

# 查看进程
ps aux

# 退出
exit
```

### 查看容器资源使用

```bash
# 实时资源监控
docker stats spooky-vocab-backend

# 查看容器详情
docker inspect spooky-vocab-backend
```

---

## 📁 数据持久化

### 数据卷说明

```yaml
volumes:
  - ./backend/data:/app/data  # 数据库文件持久化
```

**包含的文件：**
- `user_data.db` - 用户数据（自动创建）
- `ecdict.db` - ECDICT词典（需手动下载）

### 备份数据库

```bash
# 备份用户数据
cp backend/data/user_data.db backup/user_data_$(date +%Y%m%d).db

# 或使用tar打包
tar -czf backup_$(date +%Y%m%d).tar.gz backend/data/
```

### 恢复数据库

```bash
# 停止服务
docker-compose down

# 恢复数据库文件
cp backup/user_data_20251130.db backend/data/user_data.db

# 重启服务
docker-compose up -d
```

---

## 🌐 生产环境部署

### 1. 环境变量配置

创建 `.env` 文件：
```bash
cat > backend/.env << EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRATION=24h
EOF
```

### 2. 反向代理（Nginx示例）

```nginx
# /etc/nginx/sites-available/spooky-vocab
server {
    listen 80;
    server_name api.spookyvocab.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 3. HTTPS配置（Let's Encrypt）

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d api.spookyvocab.com
```

### 4. 系统服务（自动启动）

创建 `/etc/systemd/system/spooky-vocab.service`：
```ini
[Unit]
Description=Spooky Vocab Backend
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/english_helper
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
sudo systemctl enable spooky-vocab
sudo systemctl start spooky-vocab
```

---

## 🐛 故障排查

### 问题1: 端口已被占用

```bash
# 查找占用3000端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或修改docker-compose.yml中的端口映射
ports:
  - "3001:3000"  # 改用3001端口
```

### 问题2: 词典加载失败

```bash
# 检查词典文件
ls -lh backend/data/ecdict.db

# 应该是812MB
# 如果不存在或大小不对，重新下载
```

### 问题3: 容器无法启动

```bash
# 查看详细日志
docker-compose logs backend

# 检查配置
docker-compose config

# 删除容器和镜像重新构建
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### 问题4: 权限问题

```bash
# 修复数据目录权限
chmod -R 755 backend/data
chown -R $(whoami):$(whoami) backend/data
```

---

## 📊 性能优化

### 1. 资源限制

编辑 `docker-compose.yml`：
```yaml
services:
  backend:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 2. 日志轮转

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 3. 构建优化

使用多阶段构建（已在Dockerfile中实现）：
- 减小镜像体积
- 只包含生产依赖
- 使用Alpine Linux

---

## 📈 监控和维护

### 健康检查

Docker已配置自动健康检查：
```bash
# 查看健康状态
docker ps
# STATUS列会显示：Up 5 minutes (healthy)
```

### 日志监控

```bash
# 实时监控错误
docker-compose logs -f | grep ERROR

# 统计请求
docker-compose logs | grep "GET /api"
```

### 定期维护

```bash
# 每周清理未使用的镜像
docker image prune -a

# 每月清理未使用的容器
docker container prune

# 清理所有未使用的资源
docker system prune -a
```

---

## 🔄 CI/CD集成

### GitHub Actions示例

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and push Docker image
        run: |
          docker build -t spooky-vocab:latest ./backend
          docker tag spooky-vocab:latest registry.example.com/spooky-vocab:latest
          docker push registry.example.com/spooky-vocab:latest
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /path/to/app
            docker-compose pull
            docker-compose up -d
```

---

## 📚 Docker镜像信息

### 基础镜像
- **Base:** `node:18-alpine`
- **Size:** ~180MB（不含数据库）
- **Node.js:** 18.x LTS
- **Package Manager:** npm

### 已包含的工具
- SQLite3
- Node.js
- npm

---

## ✅ 部署清单

部署前检查：

- [ ] Docker Desktop已安装并运行
- [ ] ECDICT词典已下载到 `backend/data/ecdict.db`
- [ ] 环境变量已配置（`.env`文件）
- [ ] 端口3000未被占用
- [ ] 运行 `docker-compose up --build`
- [ ] 访问 `http://localhost:3000/health` 验证
- [ ] 测试API登陆和查询功能

---

## 🎯 快速命令参考

```bash
# 🚀 启动
docker-compose up -d

# 📊 查看状态
docker-compose ps

# 📝 查看日志
docker-compose logs -f

# 🔄 重启
docker-compose restart

# 🛑 停止
docker-compose down

# 🔨 重新构建
docker-compose up --build

# 💾 备份数据
tar -czf backup.tar.gz backend/data/

# 🧹 清理
docker system prune -a
```

---

## 📞 获取帮助

如果遇到问题：

1. 检查Docker Desktop是否运行
2. 查看容器日志：`docker-compose logs backend`
3. 验证词典文件：`ls -lh backend/data/ecdict.db`
4. 检查端口：`lsof -i :3000`

---

**当前版本:** Docker配置 v1.0.0  
**最后更新:** 2025-11-30  
**状态:** ✅ Production Ready

