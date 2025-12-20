# 认证服务集成部署指南

## 当前状态

✅ **代码已完成**：所有认证相关的代码修改已完成
❌ **尚未部署**：需要部署到生产环境

## 部署步骤

### 1. 更新服务器代码

```bash
# SSH登录服务器
ssh root@43.156.244.45

# 进入项目目录（根据实际路径调整）
cd /opt/english_helper/backend
# 或
cd /root/english_helper/backend

# 拉取最新代码
git pull origin main
# 或手动上传更新的文件
```

### 2. 更新环境变量

在服务器上更新 `.env` 文件或 `deploy.env`：

```bash
# 编辑环境变量文件
nano .env
# 或
nano deploy.env
```

添加或更新以下配置：

```env
AUTH_SERVICE_JWT_SECRET=5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa
```

### 3. 更新Docker配置（如果使用Docker）

如果使用docker-compose，更新 `docker-compose.yml` 中的环境变量：

```yaml
environment:
  - AUTH_SERVICE_JWT_SECRET=5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa
```

### 4. 重启服务

#### 如果使用Docker Compose：

```bash
cd /opt/english_helper  # 或实际项目路径
docker-compose down
docker-compose up -d --build
docker-compose logs -f  # 查看日志确认启动成功
```

#### 如果使用PM2：

```bash
pm2 restart english-helper-backend
pm2 logs english-helper-backend  # 查看日志
```

#### 如果直接运行Node.js：

```bash
# 停止旧进程
pkill -f "node.*server.js"

# 启动新进程
cd /opt/english_helper/backend
npm install  # 如果需要更新依赖
npm start
# 或使用forever/pm2等进程管理器
```

### 5. 验证部署

#### 5.1 检查服务健康

```bash
curl http://localhost:3000/health
# 或
curl https://kuroneko.chat/vocab-api/health
```

预期响应：
```json
{
  "status": "ok",
  "service": "spookyvocab-backend",
  "version": "1.0.0",
  "timestamp": "2025-12-02T..."
}
```

#### 5.2 测试认证（需要有效token）

```bash
# 使用认证服务获取的token测试
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://kuroneko.chat/vocab-api/api/user/settings
```

#### 5.3 测试未认证请求（应返回401）

```bash
curl https://kuroneko.chat/vocab-api/api/user/settings
```

预期响应：
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid Authorization header..."
  }
}
```

### 6. 更新扩展（前端）

#### 6.1 打包扩展

```bash
cd extension
zip -r ../extension.zip .
```

#### 6.2 更新扩展

1. 在Chrome中打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension` 文件夹
5. 或点击"重新加载"按钮（如果已加载）

#### 6.3 测试扩展登录

1. 点击扩展图标
2. 点击"前往登录"按钮
3. 在认证服务页面登录
4. 确认登录成功后自动切换界面

## 部署检查清单

- [ ] 服务器代码已更新
- [ ] 环境变量已配置 `AUTH_SERVICE_JWT_SECRET`
- [ ] 服务已重启
- [ ] 健康检查通过
- [ ] 认证验证正常（401响应）
- [ ] 扩展已更新
- [ ] 登录流程测试通过

## 回滚方案

如果部署后出现问题，可以快速回滚：

```bash
# 恢复旧代码
git checkout HEAD~1  # 或指定commit

# 恢复旧环境变量
# 编辑.env文件，移除AUTH_SERVICE_JWT_SECRET

# 重启服务
docker-compose restart
# 或
pm2 restart english-helper-backend
```

## 注意事项

1. **JWT Secret安全**：确保 `AUTH_SERVICE_JWT_SECRET` 不会泄露到日志或版本控制中
2. **向后兼容**：旧的 `JWT_SECRET` 配置仍然支持（作为fallback）
3. **用户数据**：确保认证服务的用户ID与现有数据兼容
4. **监控**：部署后监控错误日志，确保认证正常工作

## 故障排查

### 问题：认证失败，返回401

**检查**：
1. 环境变量 `AUTH_SERVICE_JWT_SECRET` 是否正确设置
2. Token是否来自认证服务（使用正确的JWT_SECRET签名）
3. Token是否过期

### 问题：用户ID不匹配

**检查**：
1. 从JWT payload中提取的user_id字段名（id/user_id/sub）
2. 确保后端正确提取用户ID

### 问题：扩展无法登录

**检查**：
1. manifest.json中的web_accessible_resources配置
2. auth-callback.html和auth-callback.js是否正确
3. 浏览器控制台是否有错误

## 联系信息

如有问题，请检查：
- 服务器日志：`docker-compose logs` 或 `pm2 logs`
- 浏览器控制台：F12 → Console
- 扩展后台页面：`chrome://extensions/` → 扩展详情 → 检查视图

