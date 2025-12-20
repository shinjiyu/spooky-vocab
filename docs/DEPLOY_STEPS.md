# 认证服务集成部署步骤

## 服务器信息

- **服务器**: 43.156.244.45
- **用户**: root
- **密码**: Wp7)jg(NHh+~8?S-
- **项目路径**: /opt/english_helper/backend
- **容器名**: english-helper-backend

## 部署步骤

### 方式1: 使用部署脚本（推荐）

```bash
# 1. 确保脚本有执行权限
chmod +x deploy-auth.sh

# 2. 运行部署脚本
./deploy-auth.sh
```

### 方式2: 手动部署

#### 步骤1: SSH登录服务器

```bash
ssh root@43.156.244.45
# 密码: Wp7)jg(NHh+~8?S-
```

#### 步骤2: 进入项目目录

```bash
cd /opt/english_helper/backend
```

#### 步骤3: 备份当前代码（可选）

```bash
# 如果有git
git stash

# 或备份整个目录
cp -r /opt/english_helper/backend /opt/english_helper/backend.backup.$(date +%Y%m%d)
```

#### 步骤4: 更新代码

**选项A: 如果使用git**

```bash
# 拉取最新代码
git pull origin main
# 或
git fetch origin
git checkout origin/main
```

**选项B: 手动上传文件**

需要上传以下文件：
- `backend/src/middleware/auth.js`
- `backend/src/server.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/vocabulary.js`
- `backend/src/routes/user.js`
- `backend/src/routes/feedback.js`
- `backend/src/routes/review.js`
- `backend/src/routes/spaced-repetition.js`
- `backend/env.example`
- `docker-compose.yml` (如果在项目根目录)

可以使用scp上传：

```bash
# 在本地执行
scp backend/src/middleware/auth.js root@43.156.244.45:/opt/english_helper/backend/src/middleware/
scp backend/src/server.js root@43.156.244.45:/opt/english_helper/backend/src/
# ... 其他文件
```

#### 步骤5: 更新环境变量

```bash
cd /opt/english_helper/backend

# 编辑.env文件
nano .env
# 或
vi .env
```

添加或更新以下配置：

```env
NODE_ENV=production
PORT=3000
AUTH_SERVICE_JWT_SECRET=5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa
MONGODB_URI=mongodb://admin:252625@host.docker.internal:27017/admin?authSource=admin
MONGODB_DB_NAME=english_helper
```

**重要**: 使用认证服务的JWT_SECRET_KEY (`5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa`)

#### 步骤6: 检查Docker容器

```bash
# 查看容器状态
docker ps | grep english-helper-backend

# 查看容器详细信息
docker inspect english-helper-backend
```

#### 步骤7: 重启容器

**如果使用docker-compose:**

```bash
cd /opt/english_helper
docker-compose restart english-helper-backend
```

**如果直接使用docker:**

```bash
docker restart english-helper-backend
```

**如果需要重建镜像:**

```bash
cd /opt/english_helper
docker-compose up -d --build english-helper-backend
```

#### 步骤8: 查看日志

```bash
# 查看容器日志
docker logs -f english-helper-backend

# 或查看最近50行
docker logs --tail 50 english-helper-backend
```

#### 步骤9: 验证部署

```bash
# 1. 检查健康状态
curl http://localhost:3000/health

# 预期响应:
# {"status":"ok","service":"spookyvocab-backend","version":"1.0.0","timestamp":"..."}

# 2. 测试未认证请求（应返回401）
curl http://localhost:3000/api/user/settings

# 预期响应:
# {"error":{"code":"UNAUTHORIZED","message":"Missing or invalid Authorization header..."}}

# 3. 通过Nginx测试
curl https://kuroneko.chat/vocab-api/health
```

#### 步骤10: 测试认证（需要有效token）

```bash
# 使用认证服务获取的token测试
TOKEN="your_token_from_auth_service"
curl -H "Authorization: Bearer $TOKEN" \
  https://kuroneko.chat/vocab-api/api/user/settings

# 预期响应: 用户设置信息
```

## 故障排查

### 问题1: 容器无法启动

```bash
# 查看详细错误
docker logs english-helper-backend

# 检查环境变量
docker exec english-helper-backend env | grep JWT

# 进入容器调试
docker exec -it english-helper-backend sh
```

### 问题2: 认证失败

检查：
1. 环境变量 `AUTH_SERVICE_JWT_SECRET` 是否正确
2. Token是否来自认证服务
3. 查看日志中的错误信息

```bash
# 检查环境变量
docker exec english-helper-backend printenv | grep JWT

# 查看认证相关日志
docker logs english-helper-backend | grep -i auth
```

### 问题3: MongoDB连接失败

```bash
# 检查MongoDB容器
docker ps | grep mongodb

# 测试MongoDB连接
docker exec english-helper-backend node -e "
const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:252625@host.docker.internal:27017/admin?authSource=admin';
MongoClient.connect(uri).then(() => {
  console.log('MongoDB连接成功');
  process.exit(0);
}).catch(err => {
  console.error('MongoDB连接失败:', err);
  process.exit(1);
});
"
```

## 回滚方案

如果部署后出现问题，可以快速回滚：

```bash
# 1. 恢复代码
cd /opt/english_helper/backend
git checkout HEAD~1  # 或指定commit

# 2. 恢复环境变量
# 编辑.env文件，移除AUTH_SERVICE_JWT_SECRET

# 3. 重启容器
docker restart english-helper-backend
```

## 验证清单

部署完成后，确认：

- [ ] 容器正常运行: `docker ps | grep english-helper-backend`
- [ ] 健康检查通过: `curl http://localhost:3000/health`
- [ ] 未认证请求返回401: `curl http://localhost:3000/api/user/settings`
- [ ] 认证请求正常: `curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/user/settings`
- [ ] 日志无错误: `docker logs english-helper-backend | grep -i error`
- [ ] Nginx代理正常: `curl https://kuroneko.chat/vocab-api/health`

## 注意事项

1. **JWT Secret安全**: 确保不会泄露到日志中
2. **数据备份**: 部署前建议备份数据库
3. **监控**: 部署后持续监控日志和错误
4. **测试**: 充分测试认证流程后再上线

## 联系信息

如有问题，检查：
- 容器日志: `docker logs english-helper-backend`
- 系统日志: `journalctl -u docker`
- Nginx日志: `/var/log/nginx/error.log`

