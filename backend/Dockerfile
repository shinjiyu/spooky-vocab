# Spooky Vocab Backend - Dockerfile
# Node.js + SQLite + ECDICT词典

# 使用Node.js 18 LTS Alpine版本（体积小）
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装SQLite3（Alpine需要额外安装）
RUN apk add --no-cache sqlite

# 复制package文件
COPY package*.json ./

# 安装依赖（生产环境）
RUN npm ci --only=production

# 复制应用代码
COPY src ./src

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动应用
CMD ["npm", "start"]

