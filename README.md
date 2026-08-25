# ~/short-link

> 一个自托管的短链接与文本分享服务。  
> 长得像一封写给你的小纸条,而不是一个 SaaS 套皮。

## 关于

把一行字写成一封小纸条,把它变短、变轻、变得可以放心转手。  
贴一段话、一段代码、或者一个长 URL —— 给你的人拿到的是个简短的链接,后台看到的是你希望他们看到的东西。

不追逐"功能多",不贴花哨的渐变和卡片墙。  
写起来像一封小纸条,读起来也像。

## 它能做什么

- **短链接** — 一行 URL,变成 6 位短码
- **文本分享** — 一段文字(支持 Markdown),变成短码
- **可选密码** — 文本分享可以加一个访问密码
- **阅后即焚** — 文本分享可以在第一次访问后自动清空
- **过期** — 1 小时到 30 天,或者永不过期
- **自定义后缀** — 不想用 6 位随机?自己起一个 3-20 字符的名字
- **后台** — 列表、搜索、手动编辑、删除、CSV 导出日志
- **博客嵌入** — 任何博客可以通过 oEmbed / iframe / `<script>` 拉取一段分享

## 设计选择

写代码时做的几个有意识的选择:

- **Source Serif 4 + JetBrains Mono** — 衬线让人文,等宽让短码清晰;不要 Inter + Geist
- **暖色 OKLCH 配色** — 奶白底、warm graphite 文本、赭橙 primary;不要冷色 SaaS
- **Hono 而不是裸 Next route handler** — 后期可以无痛迁到 Cloudflare Workers / EdgeOne Pages
- **Upstash Redis 而不是 Vercel Blob** — Vercel KV 在 2024 已 deprecated,Upstash 是当前推荐路径,Free 计划 10K 命令/天够用
- **bcrypt + 服务端会话** — 密码真的被哈希,会话真的在 KV 里被校验;不是 JWT 那种"签发即作废"
- **不做端到端加密** — 阅后即焚是"服务端知道但看完立即删除";不是 Zero-knowledge。如果你要给敏感数据传,自己再加一层加密

## 快速开始

### 在 Vercel 上部署(推荐)

1. **Fork 这个仓库**
2. **Vercel 仪表板** → Add New Project → 选 fork
3. **Vercel Marketplace** → Storage → 装 **Upstash Redis** → 关联到这个项目  
   会自动注入 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`
4. **环境变量** 加两个:
   - `ADMIN_USERNAME` — 默认 `admin`
   - `ADMIN_PASSWORD` — 默认 `admin123`,**生产必改**
5. **Deploy** — 第一次会建库;默认 6 位短码的碰撞处理已经写好

部署完访问 `https://your-project.vercel.app`,输入 `admin / admin123` 登录。

### 本地开发

需要 Node.js 20+ 和 pnpm。

```bash
git clone https://github.com/leebro7/Vercel-ShortLinkAndText
cd Vercel-ShortLinkAndText
pnpm install
pnpm dev
```

不连真实 KV,本地用内存驱动:

```bash
DATA_PROVIDER=memory pnpm dev
```

跑测试:

```bash
pnpm test         # 71 个测试
pnpm typecheck    # tsc --noEmit
```

## 数据存储

Data Provider 是抽象的。`lib/db/provider.ts` 按这个顺序自动选:

1. `DATA_PROVIDER=memory` — 内存(测试)
2. `UPSTASH_REDIS_REST_URL` + token — Upstash(默认,Free 计划可用)
3. `KV_REST_API_URL` + token — Vercel KV(已 deprecated,旧部署兼容)
4. `DATA_PROVIDER=cloudflare-kv` — Cloudflare KV(占位,需自实现)
5. `DATA_PROVIDER=edgeone-kv` — EdgeOne KV(占位,需自实现)

切换 driver 不用改业务代码。

## API

所有路由都走 `app/api/[[...route]]`,被一个 Hono app 统一处理。  
旧 `/api/links` 和 `/api/text-share` 改为 410 Gone(数据源已合并)。

| Method | Path | Auth | 用途 |
|---|---|---|---|
| GET    | `/api/items`                    | admin | 列出全部条目 + 统计 |
| POST   | `/api/items`                    | admin | 创建 link 或 text |
| DELETE | `/api/items?shortCode=...`      | admin | 删除 |
| PATCH  | `/api/items/:shortCode`         | admin | 手动改内容/密码/过期 |
| GET    | `/api/items/:shortCode/meta`    | 公开  | 元信息(判断要不要密码) |
| GET    | `/api/items/:shortCode/view`    | 公开  | 真正"查看"(算 viewCount,阅后即焚触发) |
| POST   | `/api/items/:shortCode/unlock`  | 公开  | 提交密码,获取 5min token + cookie |
| GET    | `/api/auth/login` (POST)        | -     | 登录 |
| GET    | `/api/auth/logout` (POST)       | -     | 登出 |
| GET    | `/api/auth/check`               | -     | 鉴权状态 |
| POST   | `/api/auth/password`            | admin | 改密码 |
| GET    | `/api/logs`                     | admin | 操作日志 |
| GET    | `/api/logs.csv`                 | admin | 日志 CSV 导出 |
| GET    | `/api/analytics`                | admin | 仪表盘数据 |
| GET    | `/api/qr?url=...&format=svg|png`| 公开  | QR 码 |
| GET    | `/api/oembed?url=...`           | 公开  | oEmbed 协议,给博客用 |
| GET    | `/api/health`                   | 公开  | 健康检查 |

## 文本分享模式

- **plain** — 默认;`<pre>` 渲染,保留换行
- **markdown** — GFM + KaTeX;禁用 raw HTML(避免 XSS)

创建时:

```bash
curl -X POST https://your-host/api/items \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "type": "text",
    "content": "# hello\n\n$x^2 + y^2 = z^2$",
    "contentFormat": "markdown",
    "password": "secret",
    "burnAfterReading": true,
    "expiresInHours": 24
  }'
```

## 嵌入到博客

三种方式:

**iframe** — 直接指向 `/embed/<code>`,`Content-Security-Policy: frame-ancestors *`

**oEmbed** — `GET /api/oembed?url=https://your-host/<code>` 返回 oEmbed JSON

**JS widget** — 在博客 HTML 里:

```html
<div data-shortlink-code="abc123"></div>
<script async src="https://your-host/embed.js"></script>
```

脚本会用 sandbox iframe 注入并通过 postMessage 调高度。

## 路线图

- [x] Vercel Free 计划适配(Upstash Redis)
- [x] 真正鉴权(bcrypt + 服务端 session)
- [x] Hono on Next 16(为后期迁 Workers / D1 留路)
- [x] MD 渲染(GFM + KaTeX, 禁用 raw HTML)
- [x] 阅后即焚(服务端可读)
- [x] 后台管理(列表/搜索/手动编辑/CSV 日志导出)
- [x] 博客嵌入(iframe / oEmbed / JS widget)
- [ ] Cloudflare Workers + D1 完整驱动
- [ ] EdgeOne Pages + KV 驱动
- [ ] 端到端加密分享(zero-knowledge)

## 贡献

欢迎 PR。代码风格:
- 业务逻辑集中 `lib/db/index.ts`,路由层只做协议适配
- 鉴权集中 `lib/auth/index.ts`,别在路由里再写一遍
- Data Provider 只在 `lib/db/*-provider.ts` 里扩展
- 测试用 `InMemoryProvider`,不要 mock 真实 KV

## 许可证

MIT

---

写得不算多。功能不算多。  
但每个能用的,都是真的能用。
