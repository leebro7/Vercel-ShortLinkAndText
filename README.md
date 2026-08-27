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
- **次数限制** — 链接和文本都支持 `maxClicks`;`burnAfterReading: true` 等价于 `maxClicks: 1`
- **过期** — 1 小时到 30 天,或者永不过期
- **自定义后缀** — 不想用 6 位随机?自己起一个 3-20 字符的名字
- **后台** — 列表、搜索、手动编辑、删除、CSV 导出日志
- **博客嵌入** — 任何博客可以通过 oEmbed / iframe / `<script>` 拉取一段分享
- **匿名访客入口** — `/u` 颁发临时 guest session,可在限流下创建分享(默认开启,可在 `/admin/settings` 关闭)

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

1. **Fork 这个仓库**(右上角 Fork 按钮)

2. **在 Vercel 导入项目**
   - 打开 [vercel.com/new](https://vercel.com/new)
   - 选刚才 fork 的仓库 → **Import**
   - 选一个 team / 命名项目

3. **配置 Project Settings**(重要,默认不对)

   展开 **"Build and Output Settings"** → 确认:
   - **Framework Preset**: `Next.js`(自动检测)
   - **Build Command**: `pnpm build`(默认即可,仓库里有 `pnpm` 锁)
   - **Install Command**: `pnpm install`  
     ⚠️ **必须改** — Vercel 默认是 `npm install`,会读错 lockfile
   - **Output Directory**: `.next`(默认)
   - **Node.js Version**: `22.x` (Settings → General → Node Version)  
     pnpm@11 与 Node 20+ 兼容;建议锁 22

4. **关联 Upstash Redis**(Vercel Marketplace)
   - 还在 import 页面 → **Storage** 标签 → 选 **Upstash**
   - 或项目创建后 → **Storage** 标签 → **Connect Store** → 选 Upstash → 选 region(选离你用户近的)
   - 关联后会自动注入两个环境变量到三个环境(Production / Preview / Development):
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`
   - ⚠️ **Free 计划限制**:10K 命令/天,256 MB 存储。够自托管短链

5. **手动加项目自己的环境变量**  
   Settings → Environment Variables:
   - `ADMIN_USERNAME` — 默认 `admin`,生产建议改
   - `ADMIN_PASSWORD` — **生产必改**(≥6 字符)
   
   三个环境都加(或只 Production + Preview)。
   
   完整变量清单(可选):
   | 变量 | 必需 | 说明 |
   |---|---|---|
   | `UPSTASH_REDIS_REST_URL` | 是 | Upstash Marketplace 注入 |
   | `UPSTASH_REDIS_REST_TOKEN` | 是 | 同上 |
   | `ADMIN_USERNAME` | 否 | 默认 `admin` |
   | `ADMIN_PASSWORD` | 否 | 默认 `admin123`,**生产必改** |
   | `DATA_PROVIDER` | 否 | 显式选 driver;不设则自动按 env 推断 |

6. **Deploy**  
   点 Deploy,等 1-2 分钟。  
   部署完访问 `https://your-project.vercel.app` → 用你的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。

7. **验证**
   - 首页能创建短链接
   - `/admin` 能登录
   - 创建条目后,`/admin/items` 能看到
   - `/api/health` 返回 `{"ok": true}`(确认 Upstash 已联通)

8. **(可选)自定义域名**  
   Settings → Domains → 添加 → 按提示配 DNS。  
   注意:`/api/auth/check` 依赖 cookie,设了非主域 cookie 时要确保 SameSite=Lax 配置正确(已默认)

#### 部署后必做

- **改密码**:`/admin/settings` → 改默认 `admin123`  
  改完会让所有会话失效,需要重新登录
- **(推荐) GitHub Branch Protection** + 关闭 Preview Deployments  
  Preview 部署会暴露你的 `/admin`,不关的话任何 PR 都能访问;或者在 Preview env 设**不同的** `ADMIN_PASSWORD` + 关掉 Upstash 关联(用 `DATA_PROVIDER=memory`)

### 在自己的 VPS 上部署(Next.js 原生 + Upstash Cloud)

不想用 Vercel?也行。

```bash
# 1. 注册 upstash.com,免费 10K 命令/天
# 2. 创建 Redis database,拿 REST URL + Token
# 3. clone & build:
git clone https://github.com/leebro7/Vercel-ShortLinkAndText
cd Vercel-ShortLinkAndText
pnpm install
pnpm build

# 4. 跑:
UPSTASH_REDIS_REST_URL=https://... UPSTASH_REDIS_REST_TOKEN=... \
  ADMIN_USERNAME=admin ADMIN_PASSWORD=changeme \
  pnpm start
```

进程管理用 PM2:

```bash
pm2 start pnpm --name short-link -- start
pm2 save
pm2 startup
```

反向代理用 nginx(把 `localhost:3000` 暴露到 `https://yourdomain.com`):

```nginx
server {
  listen 443 ssl http2;
  server_name yourdomain.com;
  # ... cert & key ...

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

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
pnpm build        # 生产构建(14 routes)
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
| GET    | `/api/settings`                 | admin | 读全局设置(如 `anonymousAccessEnabled`) |
| PATCH  | `/api/settings`                 | admin | 改全局设置 |
| GET    | `/u`                            | 公开  | 颁发临时 guest session(匿名访客入口) |

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

`maxClicks` 适用 link 和 text(整数 ≥ 1,达到次数后 `/view` 返回 410)。`burnAfterReading: true` 是 `maxClicks: 1` 的语法糖。

## 匿名访客与限流

- 任何人可以 `GET /u` 拿一个临时 guest session(`__Host-guest_session` cookie),就能 `POST /api/items` 创建分享。
- guest 创建被限流:每个 IP 每分钟最多 5 次,超限返回 `429 Too Many Requests`(带 `X-RateLimit-*` 头)。admin 不受限。
- `/admin/settings` 关闭 "Allow anonymous access" 后:
  - `GET /u` 直接 401(不透露原因)
  - `POST /api/items` 不再接受 guest session,即使 cookie 仍有效;只允许 admin。已颁发的 guest session **不主动撤销**,但下一次创建请求就会被 401 拦截,直到 cookie 自然过期(默认 24h)
  - `GET /api/settings` 始终需要 admin(用于 admin 切换开关)
- 三种身份(admin / guest / 陌生人)在 `lib/auth/index.ts` `getSessionFromCookie` 里区分,admin 优先。

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
- [x] 次数限制(`maxClicks`,link/text 都支持)
- [x] 匿名访客入口(`/u` + 限流,可关)
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
