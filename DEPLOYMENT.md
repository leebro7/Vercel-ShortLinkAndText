# 部署指南

## 📋 前置要求

- Node.js 18+
- Vercel 账户 + Blob 存储
- GitHub 账户（可选，推荐用于 Vercel 部署）

## 🔑 获取 Blob 令牌

### 步骤 1: 创建 Vercel 项目
访问 [vercel.com/new](https://vercel.com/new) 创建新项目

### 步骤 2: 添加 Blob 存储
1. 进入项目 Settings → Storage
2. 点击 "Create Database" 选择 "Blob"
3. 确认创建

### 步骤 3: 复制令牌
1. 进入 Storage 标签页
2. 点击 "..." 选择 "Tokens"
3. 复制 **Read/Write Token**

⚠️ **注意**: 令牌包含敏感信息，不要公开分享！

## 🌐 Vercel 部署

### 方式一: GitHub 自动部署（推荐）

\`\`\`bash
# 1. 推送代码到 GitHub
git add .
git commit -m "Initial commit"
git push origin main
\`\`\`

在 Vercel 仪表板:
1. 点击 "Add New" → "Project"
2. 连接 GitHub 仓库
3. 配置环境变量（见下方）
4. 点击 "Deploy"

### 方式二: Vercel CLI

\`\`\`bash
# 安装 CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel
\`\`\`

### 环境变量配置

在 Vercel 项目 Settings → Environment Variables 中添加:

\`\`\`bash
BLOB_READ_WRITE_TOKEN=<your_blob_token>
ADMIN_USERNAME=admin              # 可选
ADMIN_PASSWORD=admin123           # 可选
\`\`\`

### 验证部署

\`\`\`bash
# 检查部署日志
vercel logs

# 测试应用
curl https://your-project.vercel.app
\`\`\`

## 🐳 Docker 部署

### Dockerfile

\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
\`\`\`

### 构建和运行

\`\`\`bash
# 构建镜像
docker build -t short-link-service .

# 运行容器
docker run -p 3000:3000 \
  -e BLOB_READ_WRITE_TOKEN="your_token" \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="admin123" \
  short-link-service
\`\`\`

### Docker Compose

\`\`\`yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - BLOB_READ_WRITE_TOKEN=${BLOB_READ_WRITE_TOKEN}
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=admin123
    restart: unless-stopped
\`\`\`

运行: `docker-compose up -d`

## 🖥️ 本地部署 (VPS/云服务器)

### 使用 PM2

\`\`\`bash
# 安装 PM2
npm i -g pm2

# 构建项目
npm run build

# 启动应用
pm2 start npm --name "short-link" -- start

# 监控
pm2 monit

# 自启动
pm2 startup
pm2 save
\`\`\`

### Nginx 反向代理

\`\`\`nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

### SSL 证书 (Let's Encrypt)

\`\`\`bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com
\`\`\`

## 🖱️ Electron 桌面应用打包

### 开发模式

\`\`\`bash
npm run dev:electron
\`\`\`

### 生产构建

\`\`\`bash
npm run build:electron
\`\`\`

输出文件:
- **Windows**: `dist/short-link-service Setup 1.0.0.exe`
- **macOS**: `dist/short-link-service-1.0.0.dmg`
- **Linux**: `dist/short-link-service-1.0.0.AppImage`

### 签名 (可选)

在 `electron/main.js` 配置签名信息用于生产分发

## 🔒 安全检查清单

- [ ] 修改默认管理员密码
- [ ] 设置强密码 (12+ 字符，混合大小写、数字、符号)
- [ ] 启用 HTTPS (使用 Vercel、Nginx、Let's Encrypt)
- [ ] 定期备份数据
- [ ] 监控访问日志
- [ ] 更新依赖包 (`npm audit fix`)
- [ ] 配置防火墙规则
- [ ] 隐藏敏感环境变量

## 🐛 故障排除

### 问题 1: Blob 令牌无效

**症状**: `403 Forbidden` 或 `401 Unauthorized`

**解决方案**:
\`\`\`bash
# 检查令牌是否正确
echo $BLOB_READ_WRITE_TOKEN

# 重新生成令牌
# 1. Vercel 仪表板 → Storage → Tokens
# 2. 删除旧令牌，创建新令牌
# 3. 更新环境变量并重新部署
\`\`\`

### 问题 2: 登录失败

**症状**: `401 Unauthorized` 或用户名/密码错误提示

**解决方案**:
\`\`\`bash
# 检查环境变量
# 1. 确认 ADMIN_USERNAME 和 ADMIN_PASSWORD 已设置
# 2. 检查 .env.local (本地开发)
# 3. 检查 Vercel 环境变量 (生产环境)
# 4. 重启应用
\`\`\`

### 问题 3: 短链接不工作

**症状**: 访问短链接返回 404

**解决方案**:
- [ ] 检查短链接是否已过期
- [ ] 检查短链接格式是否正确
- [ ] 确认 Blob 连接正常
- [ ] 查看服务器日志

### 问题 4: 环境变量未生效

**症状**: 使用硬编码的默认值而不是环境变量

**解决方案**:
\`\`\`bash
# 本地开发
# 1. 检查 .env.local 语法
# 2. 重启开发服务器: npm run dev

# Vercel 部署
# 1. 确认环境变量已添加
# 2. 点击 "Redeploy" 重新部署
# 3. 检查部署日志 (vercel logs)

# Docker
# 确保使用 -e 传递环境变量:
docker run -e ADMIN_PASSWORD=newpass image_name
\`\`\`

### 问题 5: 性能缓慢

**症状**: 页面加载慢，API 响应慢

**解决方案**:
- 检查 Blob 存储大小 (可能数据过大)
- 启用 Vercel 缓存
- 分析 Next.js 构建体积 (`npm run build -- --analyze`)
- 清理过期链接

## 📊 监控和日志

### Vercel 监控

\`\`\`bash
# 查看实时日志
vercel logs

# 查看特定时间的日志
vercel logs --since 1h

# 查看错误
vercel logs --level error
\`\`\`

### 本地日志 (Docker)

\`\`\`bash
# 查看容器日志
docker logs <container_id>

# 持续监控
docker logs -f <container_id>
\`\`\`

### 应用内日志

检查浏览器控制台 (F12) 查看客户端错误

## 🔄 更新和维护

### 更新依赖

\`\`\`bash
# 检查过期包
npm outdated

# 更新到最新版本
npm update

# 安全更新
npm audit fix
\`\`\`

### 数据维护

\`\`\`bash
# 定期导出数据
curl -H "Cookie: auth=token" https://yourapp.com/api/items

# 删除过期项目
# 自动进行，无需手动操作
\`\`\`

## 📈 扩展应用

### 添加自定义域名 (Vercel)

1. 项目 Settings → Domains
2. 添加自定义域名
3. 配置 DNS 记录

### 配置 CDN

Vercel 内置 Vercel Edge Network，自动全球加速

### 数据库迁移 (未来计划)

当 Blob 数据量超大时，考虑迁移到专业数据库:
- Neon PostgreSQL
- Supabase
- MongoDB Atlas

---

**最后更新**: 2025年11月15日 | **文档版本**: 1.0
