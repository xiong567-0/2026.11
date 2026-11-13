# 2026.11

「微语 · Micro Posts」—— 一个轻量短文本发布页：写下一句话，留住此刻的想法。

前后端分离的短文本发布应用：前端使用 **Vue 3 + Pinia + TypeScript**，由 Vite 构建；后端使用 **Node.js + Hono** 提供 REST API，数据保存在**服务端进程内存**中，不再写入浏览器本地存储。测试仍以 **Vitest + TDD** 方式驱动。

## 在线预览

<https://xiong567-0.github.io/2026.11/>

> 静态托管只包含前端界面。数据来自后端 API，需本地启动服务端（见「本地运行」）；未启动时页面会展示「网络请求失败，请检查后端服务是否已启动」一类提示。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 视图 | Vue 3（Composition API + `<script setup lang="ts">`） |
| 状态 | Pinia（`posts` / `user` / `toast` 三个 store） |
| 后端 | Node.js + Hono + `@hono/node-server` |
| 构建 | Node.js + Vite + `vue-tsc` |
| 测试 | Vitest + `@vue/test-utils` + happy-dom（服务端用例跑在 node 环境） |
| 存储 | 进程内内存（`Map`），重启即清空 |

界面沿用原有设计：主题变量集中在 `src/assets/base.css`，与组件相关的样式写在各自的 `<style scoped>` 中；图标为内联 SVG，字体使用系统字体栈。

## 功能

- **发布内容**：纯文本，最多 200 字，输入时实时显示字数；为空或超限时发布按钮不可用并给出提示，支持 `Ctrl / Cmd + Enter` 快捷发布；发布中按钮进入禁用态
- **浏览信息流**：内容按发布时间倒序展示为卡片，包含渐变首字母头像、昵称、相对时间（刚刚 / x 分钟前 / x 小时前 / 昨天 / 前天 / 具体日期）与正文，正文保留换行；页面停留时相对时间每 30 秒自动刷新
- **点赞**：点赞 / 取消点赞，带选中态与弹跳动效，计数与状态由服务端保存，刷新后保留
- **收藏**：收藏 / 取消收藏（书签按钮），带琥珀色选中态与弹跳动效；信息流可按「全部 / 收藏」筛选，收藏空态给出引导文案；提示「已收藏 / 已取消收藏」，状态与计数由服务端保存，刷新后保留
- **删除**：删除前二次确认，卡片以过渡动画移除
- **昵称**：默认「访客」，点击右上角昵称按钮修改后，服务端会同步更新全部历史内容的作者名，页面顶部与信息流一起刷新；弹窗内支持焦点循环、`Esc` 关闭与焦点还原
- **服务端存储**：内容、点赞状态、昵称都保存在后端进程内存中，多个浏览器/标签页看到同一份数据
- **失败提示**：后端不可用、接口返回错误或数据格式异常时，界面给出可读提示且不崩溃；首次加载展示加载态而不是「还没有内容」
- **空状态与响应式**：无内容时展示引导文案；桌面单列居中，移动端自适应全宽
- **可访问性**：语义化标签、可见焦点环、`aria-live` 提示、`aria-pressed` 点赞 / 收藏 / 筛选语义、`prefers-reduced-motion` 降级

## 后端 API

服务端入口为 `server/index.ts`，路由定义在 `server/app.ts`（`createApp()` 只创建路由，不监听端口，便于测试）。默认端口 **8787**，可用环境变量 `PORT` 覆盖。

| 方法 | 路径 | 说明 | 成功响应 |
| --- | --- | --- | --- |
| `GET` | `/api/posts` | 全部内容，按 `createdAt` 倒序 | `200 { posts: Post[] }` |
| `POST` | `/api/posts` | body `{ content, author? }`；`author` 省略或空白时固定回退「访客」，不继承当前昵称 | `201 { post }`，带 `Location: /api/posts/:id` |
| `PATCH` | `/api/posts/:id` | body `{ liked: boolean }`，幂等 | `200 { post }` |
| `DELETE` | `/api/posts/:id` | 删除单条内容 | `204`（无 body） |
| `GET` | `/api/profile` | 当前昵称 | `200 { name }` |
| `PUT` | `/api/profile` | body `{ name }`，同时同步全部历史内容作者 | `200 { name }` |
| `GET` | `/api/health` | 健康检查 | `200 { status: 'ok' }` |

请求示例：

```bash
# 读取信息流
curl http://localhost:8787/api/posts

# 发布一条内容
curl -X POST http://localhost:8787/api/posts \
  -H 'content-type: application/json' \
  -d '{"content":"第一条微语","author":"访客"}'
# → 201 {"post":{"id":"...","author":"访客","content":"第一条微语","likes":0,"liked":false,"createdAt":1750000000000}}

# 点赞
curl -X PATCH http://localhost:8787/api/posts/<id> \
  -H 'content-type: application/json' \
  -d '{"liked":true}'

# 收藏（可与 liked 同时提交，也只接受布尔值）
curl -X PATCH http://localhost:8787/api/posts/<id> \
  -H 'content-type: application/json' \
  -d '{"favorited":true}'

# 修改昵称（会同步历史内容作者）
curl -X PUT http://localhost:8787/api/profile \
  -H 'content-type: application/json' \
  -d '{"name":"小明"}'
```

前端侧统一通过 `src/lib/api.ts` 调用，不使用裸 `fetch`：

```ts
import { api } from './lib/api'

const posts = await api.listPosts()
const created = await api.createPost({ content: '你好', author: '访客' })
await api.setLike(created.id, true)
await api.setFavorite(created.id, true)
await api.deletePost(created.id)
```

错误统一为 `{ error: { code, message } }`，前端 `ApiError` 会保留 `status` 与 `code`：

```json
{ "error": { "code": "invalid_content", "message": "内容不能为空，且最多 200 字" } }
```

| `code` | HTTP | 触发条件 |
| --- | --- | --- |
| `invalid_content` | 400 | 内容为空或超过 200 字 |
| `invalid_body` | 400 | body 字段类型不对（如 `liked` / `favorited` 不是布尔），或 `PATCH` 未提供任何可更新字段 |
| `invalid_json` | 400 | 请求体不是合法 JSON |
| `invalid_name` | 400 | 昵称为空或超长 |
| `not_found` | 404 | 内容不存在，或未匹配的 `/api/*` 路由（非 `/api` 的未知路径在有 `dist/` 时回退 `index.html`，不是 JSON 404） |
| `internal_error` | 500 | 仅 `app.onError` 兜底命中时出现，正常流程不会返回 |

请求没到达服务端时（服务未启动、断网），前端会得到 `status: 0`、`code: 'network_error'` 的 `ApiError`。

## 本地运行

```bash
npm install         # 安装依赖
```

开发时前后端分别启动（推荐两个终端）：

```bash
# 终端 A：API 服务，默认 http://localhost:8787/
npm run server:dev

# 终端 B：前端开发服务器，默认 http://localhost:5173/
npm run dev
```

也可以一条命令同时启动（`concurrently` 并行运行，输出前缀 `web` / `api`）：

```bash
npm run dev:all
```

Vite 开发服务器已配置代理：`/api` 的请求会转发到 `http://localhost:8787`，前端代码始终请求同源路径，不需要配置跨域。

生产模式：先构建静态产物，再由 API 服务托管 `dist/`（存在 `dist/` 时会自动提供静态文件并把未知路径回退到 `index.html`）：

```bash
npm run build       # vue-tsc 类型检查 + vite build，产物在 dist/
npm start           # 启动服务，访问 http://localhost:8787/
```

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 前端开发服务器（5173） |
| `npm run server` | 启动 API 服务（8787） |
| `npm run server:dev` | 以 `tsx watch` 启动 API 服务，改代码自动重启 |
| `npm run dev:all` | 同时启动前端与 API |
| `npm run build` | 类型检查 + 生产构建 |
| `npm start` | 启动 API 服务并托管 `dist/` |
| `npm run preview` | 预览构建产物 |

> 若当前环境的 Node.js 由 fnm/nvm 管理，请先确保 `node`、`npm` 在当前 shell 的 `PATH` 中。

## 测试与 TDD 流程

```bash
npm test            # 单次运行全部测试（CI 用）
npm run test:watch  # 监听模式
npm run typecheck   # 仅做类型检查
```

开发顺序是严格的 **红 → 绿 → 重构**：每一层先写会失败的测试，再补最小实现，最后在不改变行为的前提下重构。

| 顺序 | 测试文件 | 覆盖内容 |
| --- | --- | --- |
| 1 | `server/*.spec.ts` | REST 契约（状态码、错误码、`Location` 头、CORS）与内存存储不变量；node 环境运行 |
| 2 | `src/lib/*.spec.ts` | 字数统计（emoji 按字素簇计 1 个）、相对时间、API 客户端（错误映射、204、非法 JSON）、内容与昵称规则 |
| 3 | `src/stores/*.spec.ts` | Pinia store 的异步读写、排序、点赞 / 收藏计数不变量、接口失败时的降级、轻提示计时 |
| 4 | `src/components/*.spec.ts` | 组件黑盒行为：按角色/`data-testid` 查询，模拟用户输入与点击，断言渲染结果与 `emits`（含收藏筛选） |
| 5 | `src/App.spec.ts` | 集成：用真实 Hono app（`src/test-utils/fakeApi.ts` 拦截 `fetch`）跑通发布 / 点赞 / 删除 / 改名 / 加载失败 |

当前共 **224 个测试用例**（17 个测试文件，`npx vitest run` 实测全部通过）。测试环境默认 happy-dom，`server/*.spec.ts` 通过 `// @vitest-environment node` 切到 node 环境；`src/test-utils/fakeApi.ts` 用真实 Hono app 接管 `fetch`，用例内不需要起真实端口。

## 目录结构

```
2026.11/
├── index.html                 # Vite 入口
├── vite.config.ts             # Vue 插件 + /api 开发代理 + Vitest 配置
├── tsconfig.json              # 同时包含 src/ 与 server/
├── server/
│   ├── app.ts                 # Hono 路由（createApp，不监听端口）
│   ├── store.ts               # 进程内内存存储（createMemoryStore）
│   ├── index.ts               # @hono/node-server 启动，托管 dist/ 静态站点
│   ├── app.spec.ts            # REST 契约测试
│   └── store.spec.ts          # 内存存储测试
├── src/
│   ├── main.ts                # 创建应用与 Pinia
│   ├── App.vue                # 页面装配：初始化数据、协调跨功能操作
│   ├── assets/base.css        # 设计令牌、重置、头像/按钮、信息流过渡、动效
│   ├── lib/                   # 与框架无关的领域逻辑（纯函数 + API 客户端）
│   │   ├── api.ts             # createApiClient / ApiError / 默认实例 api
│   │   ├── text.ts            # 字素计数、截断、头像首字
│   │   ├── time.ts            # 相对时间与完整时间格式化
│   │   ├── post.ts            # 内容规则与 Post 模型
│   │   └── profile.ts         # 昵称规则
│   ├── stores/
│   │   ├── posts.ts           # 内容集合（服务端数据的镜像）
│   │   ├── user.ts            # 昵称
│   │   └── toast.ts           # 全局轻提示
│   ├── composables/
│   │   └── useNow.ts          # 30 秒刷新的「当前时间」，用于相对时间
│   ├── components/
│   │   ├── AppHeader.vue      # 品牌与昵称入口
│   │   ├── PostComposer.vue   # 发布框（本地草稿 + 字数校验）
│   │   ├── PostFeed.vue       # 信息流、加载态、数量、空状态、增删过渡
│   │   ├── PostCard.vue       # 单条内容（展示与事件上抛）
│   │   ├── NicknameDialog.vue # 昵称弹窗（校验、焦点陷阱、滚动锁定）
│   │   └── AppToast.vue       # 轻提示
│   └── test-utils/
│       └── fakeApi.ts         # 用真实 Hono app 接管 fetch 的测试后端
├── package.json
└── README.md
```

## 架构说明

- **前端只通过一个入口访问数据**：组件与 store 都不直接 `fetch`，全部经由 `src/lib/api.ts` 的 `createApiClient()`；默认实例 `api` 以同源相对路径请求 `/api/...`，开发时由 Vite 代理转发，生产时由 Hono 服务同源提供
- **服务端是唯一数据源**：`posts` / `user` store 只是服务端数据的镜像，写操作（发布、点赞、删除、改名）以接口返回值为准；id、`createdAt`、作者归一化、字数校验都在服务端完成
- **数据流**：`props` 向下、`emits` 向上。`PostCard` 只负责展示并抛出 `like` / `favorite` / `delete`，由 `App.vue` 决定确认、删除与提示；「全部 / 收藏」筛选是 `PostFeed` 的纯展示状态，不改动传入的 `posts`
- **跨功能协调放在装配层**：修改昵称会同时影响 `user` 与全部历史内容的作者名，这段编排写在 `App.vue`，两个 store 之间不互相依赖
- **领域逻辑与框架解耦**：`src/lib` 基本都是纯函数，字符规则与时间格式可以脱离 Vue 单独测试；服务端复用同一份 `src/lib/post.ts`、`src/lib/profile.ts` 规则，前后端校验不会漂移
- **错误处理与降级**：store 的异步方法不抛异常，失败时写入 `error` 并返回失败值，由装配层弹出可读提示；`ApiError` 保留 `status` / `code`，`status === 0` 表示请求没到达服务端；删除时若服务端返回 404 视为「已被删除」并清理本地列表
- **内存存储的取舍**：实现简单、无外部依赖、测试中可以完全隔离（每次 `createMemoryStore()` 都是独立世界）；代价是**不做持久化**（进程重启数据丢失）、**不能水平扩展**（多个实例各自一份数据，前端请求必须落在同一进程）
- **安全**：用户内容只通过插值渲染（等价于 `textContent`），不使用 `v-html`
- **动画**：列表增删使用 `<TransitionGroup>` + CSS 过渡，`prefers-reduced-motion` 下自动降级

## 数据存储

数据保存在后端进程的内存里（`server/store.ts` 的 `createMemoryStore()`：一个 `Map<string, Post>` 加一个昵称字符串），只在该进程存活期间有效：**重启服务或进程退出后数据全部丢失**，也不会同步到磁盘或数据库。

```ts
interface Post {
  id: string;        // 唯一标识
  author: string;    // 作者昵称
  content: string;   // 正文（纯文本，最多 200 字）
  likes: number;     // 点赞数
  liked: boolean;    // 当前是否已点赞
  favorites: number; // 收藏数
  favorited: boolean;// 当前是否已收藏
  createdAt: number; // 创建时间戳（毫秒）
}
```

- **清空数据**：重启 API 服务即可（`Ctrl + C` 后重新 `npm run server:dev`）
- **多实例**：每个 `createMemoryStore()` 互相隔离，`createApp()` 不传 `store` 时会新建一个；生产环境请只启动一个进程
- **后续可替换**：存储接口（`MemoryStore`）与路由解耦，需要持久化时替换 `server/store.ts` 的实现即可，路由与前端无需改动

## 浏览器兼容

近两年版本的 Chrome / Edge / Firefox / Safari 及移动端浏览器。核心依赖 `fetch`、`Intl.Segmenter`（缺失时退化为按码点计数）、CSS 自定义属性与 `backdrop-filter`（后者可降级为纯色背景）。运行完整功能需要能访问后端 API。

## 提交规范

建议使用语义化提交信息，例如：

- `feat: 新增 xxx 功能`
- `test: 补充 xxx 用例`
- `refactor: 重构 xxx`
- `docs: 更新文档`

## 说明

本项目为原创界面、文案与代码实现，与任何第三方社交产品的界面、标识及品牌元素无关。

## 许可证