# 统一认证网关设计

## 问题分析

当前架构中，每个需要认证的API路由都需要单独使用 `authMiddleware` 进行JWT验证。虽然已经使用了统一的中间件，但存在以下问题：

1. **代码重复**：每个路由文件都需要引入和配置中间件
2. **维护成本**：如果需要修改认证逻辑，需要修改多个文件
3. **性能考虑**：每个请求都要执行JWT验证，可以考虑缓存优化
4. **架构清晰度**：认证逻辑分散在各个路由中

## 解决方案

### 方案1: 应用层统一中间件（推荐，当前优化）

**优点**：
- 实现简单，无需额外服务
- 性能开销小
- 易于调试和维护

**实现方式**：
在 `server.js` 中统一应用认证中间件，通过路径白名单排除不需要认证的接口。

```javascript
// server.js
const authMiddleware = require('./middleware/auth');

// 不需要认证的路径
const publicPaths = [
  '/health',
  '/api/auth/test-token',  // 可选：保留用于开发
];

// 统一认证中间件
app.use((req, res, next) => {
  // 检查是否为公开路径
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // 其他路径都需要认证
  return authMiddleware(req, res, next);
});
```

**优点**：
- 集中管理认证逻辑
- 易于添加白名单
- 无需修改各个路由文件

### 方案2: Nginx网关层认证（高级方案）

**优点**：
- 在网关层统一处理，应用层无需关心认证
- 可以统一处理多个服务
- 性能更好（Nginx处理）

**缺点**：
- 需要Nginx支持JWT验证（需要lua脚本或第三方模块）
- 配置复杂
- 调试困难

**实现方式**：
使用 `lua-resty-jwt` 在Nginx层验证JWT：

```nginx
location /vocab-api/ {
    access_by_lua_block {
        local jwt = require "resty.jwt"
        local auth_header = ngx.var.http_authorization
        
        if not auth_header or not string.match(auth_header, "^Bearer ") then
            ngx.status = 401
            ngx.say('{"error": "Unauthorized"}')
            ngx.exit(401)
        end
        
        local token = string.match(auth_header, "Bearer (.+)")
        local jwt_obj = jwt:verify("5c88ab2e00452305d87b018fe39fcabbf250db022645a4adf4e55bb05d9cfa", token)
        
        if not jwt_obj.valid then
            ngx.status = 401
            ngx.say('{"error": "Invalid token"}')
            ngx.exit(401)
        end
        
        -- 将用户信息传递给后端
        ngx.req.set_header("X-User-Id", jwt_obj.payload.user_id or jwt_obj.payload.id)
    }
    
    proxy_pass http://127.0.0.1:3000/;
    # ... 其他proxy配置
}
```

### 方案3: 独立认证网关服务（微服务架构）

**优点**：
- 完全解耦认证逻辑
- 可以统一管理多个服务的认证
- 易于扩展和升级

**缺点**：
- 架构复杂
- 需要额外的服务维护
- 增加网络延迟

**实现方式**：
创建一个独立的认证网关服务，所有请求先经过网关验证，再转发到后端服务。

## 推荐方案

**当前阶段推荐：方案1（应用层统一中间件）**

理由：
1. 实现简单，无需额外配置
2. 性能开销小
3. 易于维护和调试
4. 满足当前需求

**未来扩展：方案2（Nginx网关层认证）**

如果未来需要：
- 统一管理多个服务的认证
- 更高的性能要求
- 更复杂的认证策略（如限流、黑名单等）

可以考虑在Nginx层实现。

## 实施计划

### 阶段1: 优化当前中间件（立即实施）

1. 在 `server.js` 中统一应用认证中间件
2. 定义公开路径白名单
3. 移除各个路由文件中的 `authMiddleware` 引用
4. 测试所有接口

### 阶段2: 性能优化（可选）

1. 添加JWT验证结果缓存（短期缓存，如5分钟）
2. 优化JWT解析性能
3. 添加认证统计和监控

### 阶段3: 网关层认证（未来）

1. 评估Nginx lua模块支持
2. 实现Nginx层JWT验证
3. 迁移认证逻辑到网关层

## 当前实施

采用方案1，在 `server.js` 中统一应用认证中间件。

