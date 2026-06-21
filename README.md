# 短链接服务 (Short Link Service)

一个功能完整、简洁美观的短链接服务，支持链接缩短、文本分享、点击统计和管理员管理。使用 Vercel Blob 作为数据存储，提供安全可靠的分享体验。

## 🎯 核心特性

### 📌 链接与分享
- **短链接生成** - 快速将长链接转换为简短可分享的链接
- **文本分享** - 创建可设置过期时间的临时文本分享
- **自定义短码** - 支持 3-20 字符的自定义后缀，更易记忆
- **过期管理** - 精确到小时的过期时间设置，安全灵活

### 🔍 统计与监控
- **点击追踪** - 实时记录每个链接/文本的点击数
- **详细统计** - 创建时间、最后访问时间、访问趋势
- **数据分析** - 管理后台展示热门项目和统计数据
- **数据脱敏** - 隐私保护，管理后台显示脱敏内容

### 🔐 安全与管理
- **管理员认证** - 环境变量配置的安全认证系统
- **防重复验证** - 自动检测重复链接和占用的 URI
- **保留路由保护** - 禁用系统路由作为短链接
- **会话管理** - HTTP-Only Cookie 安全存储认证信息

### 🚀 技术特性
- **高性能** - 基于 Next.js 16 App Router，Vercel Blob 云存储
- **响应式设计** - 完美适配桌面、平板、手机
- **Electron 支持** - 可打包为跨平台桌面应用
- **类型安全** - 完整的 TypeScript 支持

## 🌟 快速开始

### 前置要求
- Node.js 18+
- npm / yarn / pnpm
- Vercel 账户 + Blob 令牌（部署到 Vercel 时需要）

### 本地开发

```bash
# 1. 克隆项目
```
git clone https://github.com/leebro7/Vercel-ShortLinkAndText

cd Vercel-Short_Link-text
```
# 2. 安装依赖
npm install

# 3. 配置环境变量
cat > .env.local << EOF
BLOB_READ_WRITE_TOKEN=your_blob_token_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
EOF

# 4. 启动开发服务器
npm run dev
vercel login
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)，默认管理员账号：`admin / admin123`

### 快速测试

```bash
# 首页创建短链接（无需登录）
输入长链接 → 点击创建 → 获得短链接

# 访问短链接
浏览器输入生成的短链接 → 自动跳转到原始链接

# 管理后台（需登录）
点击"管理登录" → 使用 admin/admin123 登录 → 查看统计和管理
```

## 📁 项目结构

```
short-link-service/
├── app/
│   ├── page.tsx                 # 首页 - 创建链接/文本
│   ├── login/page.tsx           # 登录页
│   ├── analytics/page.tsx       # 数据分析面板
│   ├── settings/page.tsx        # 管理员设置
│   ├── [shortCode]/page.tsx     # 链接重定向
│   ├── share/[code]/page.tsx    # 文本分享展示
│   └── api/
│       ├── items/route.ts       # 项目 API (创建、查询、删除)
│       └── auth/                # 认证 API (登录、登出)
├── components/
│   ├── link-form.tsx            # 链接/文本创建表单
│   ├── recent-links.tsx         # 项目列表（需登录）
│   └── ui/                      # shadcn/ui 组件库
├── lib/
│   ├── db.ts                    # 数据库操作（Blob 集成）
│   ├── auth.ts                  # 认证系统
│   ├── types.ts                 # 类型定义
│   ├── constants.ts             # 常量（保留路由）
│   └── utils.ts                 # 工具函数
├── electron/                    # Electron 配置
├── public/                      # 静态资源
└── README.md / DEPLOYMENT.md    # 文档
```

## 🔌 API 文档

### 项目管理

#### 获取所有项目
```http
GET /api/items
```
**认证**: ✅ 需要管理员登录

**响应**:
```json
{
  "items": [
    {
      "id": "uuid",
      "shortCode": "my-link",
      "type": "link",
      "originalUrl": "https://exa...ple.com",
      "clickCount": 42,
      "expiresAt": 1700000000000,
      "createdAt": 1699900000000
    }
  ],
  "stats": { "totalItems": 10, "totalClicks": 156 }
}
```

#### 创建项目
```http
POST /api/items
Content-Type: application/json

{
  "type": "link",
  "originalUrl": "https://example.com/path",
  "customSuffix": "my-link",
  "expiresInHours": 24
}
```

**错误处理**:
- `400` - 参数错误（URL 格式、后缀冲突、保留路由）
- `401` - 认证失败
- `500` - 服务器错误

#### 删除项目
```http
DELETE /api/items?shortCode=my-link
```
**认证**: ✅ 需要管理员登录

### 认证

#### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

#### 登出
```http
POST /api/auth/logout
```

## ⚙️ 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `BLOB_READ_WRITE_TOKEN` | ✅ | - | Vercel Blob 读写令牌 |
| `ADMIN_USERNAME` | ❌ | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | ❌ | `admin123` | 管理员密码 |

**获取 Blob 令牌**:
1. 登录 [Vercel 仪表板](https://vercel.com/dashboard)
2. 选择项目 → Settings → Storage → Blob
3. 复制 **Read/Write Token**

## 📖 使用指南

### 创建短链接

1. 在首页输入要缩短的长链接
2. 点击"链接"类型标签
3. （可选）输入自定义短码（3-20 字符）
4. （可选）选择过期时间
5. 点击"创建短链接"
6. 复制并分享生成的链接

### 创建文本分享

1. 在首页点击"文本"类型标签
2. 输入要分享的内容
3. （可选）选择过期时间
4. 点击"创建分享"
5. 分享链接给他人

### 管理后台

1. 首页 → 点击"管理登录"
2. 输入账号密码（默认 `admin / admin123`）
3. 进入后台查看：
   - 📊 统计数据和热门项目
   - 📋 所有已创建的链接和文本
   - 🗑️ 删除不需要的项目

## 🚀 部署

### Vercel 部署（推荐）

```bash
# 1. 推送到 GitHub
git push origin main

# 2. Vercel 仪表板导入项目
# 3. 配置环境变量并部署
```

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

### Docker 部署

```bash
docker build -t short-link .
docker run -p 3000:3000 \
  -e BLOB_READ_WRITE_TOKEN=your_token \
  short-link
```

### Electron 桌面应用

```bash
npm run build:electron
# 输出在 dist/ 目录
```

## ❓ 常见问题

**Q: 链接永久保存吗？**
A: 否。可设置过期时间，过期后无法访问。未设置过期时间的项目无限期保存。

**Q: 短码有长度限制吗？**
A: 有。必须 3-20 字符，支持字母、数字、连字符。不能重复或使用保留路由。

**Q: 如何修改密码？**
A: 修改环境变量 `ADMIN_PASSWORD` 后重新部署。

**Q: 数据安全吗？**
A: 是的。所有数据存储在 Vercel Blob（99.99% 可用性），自动备份。

**Q: 可以导出数据吗？**
A: 支持通过 API 查询所有数据手动导出。

**Q: 支持 API 集成吗？**
A: 支持。所有 API 都可集成到第三方工具，需提供认证信息。

## 🛠 技术栈

| 模块 | 技术 |
|------|------|
| 框架 | Next.js 16 App Router |
| UI | shadcn/ui + Tailwind CSS v4 |
| 数据库 | Vercel Blob |
| 认证 | Cookie 会话 + bcrypt |
| 桌面 | Electron |
| 语言 | TypeScript |

## 📄 许可证

MIT License - 可自由使用和修改

## 🤝 获取帮助

- 📚 查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 了解部署和故障排除
- 🐛 提交 [Issue](https://github.com/your-repo/issues)
- 💬 讨论和建议

---

**最后更新**: 2025年11月15日 | **版本**: 1.0.0
