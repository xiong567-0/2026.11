# 2026.11

「微语 · Micro Posts」—— 一个轻量短文本发布页：写下一句话，留住此刻的想法。

前端单页应用，使用 **Node.js + Vue 3 + Pinia + TypeScript** 实现，由 Vite 构建，**Vitest 以 TDD 方式驱动开发**。没有后端服务，内容依然只保存在浏览器的 `localStorage` 中。

## 在线预览

<https://xiong567-0.github.io/2026.11/>

## 技术栈

| 层 | 选型 |
| --- | --- |
| 视图 | Vue 3（Composition API + `<script setup lang="ts">`） |
| 状态 | Pinia（`posts` / `user` / `toast` 三个 store） |
| 构建 | Node.js + Vite + `vue-tsc` |
| 测试 | Vitest + `@vue/test-utils` + happy-dom |
| 存储 | 浏览器 `localStorage`（无后端） |

界面沿用原有设计：主题变量集中在 `src/assets/base.css`，与组件相关的样式写在各自的 `<style scoped>` 中；图标为内联 SVG，字体使用系统字体栈，离线可用。

## 功能

- **发布内容**：纯文本，最多 200 字，输入时实时显示字数；为空或超限时发布按钮不可用并给出提示，支持 `Ctrl / Cmd + Enter` 快捷发布
- **浏览信息流**：内容按发布时间倒序展示为卡片，包含渐变首字母头像、昵称、相对时间（刚刚 / x 分钟前 / x 小时前 / 昨天 / 前天 / 具体日期）与正文，正文保留换行；页面停留时相对时间每 30 秒自动刷新
- **点赞**：点赞 / 取消点赞，带选中态与弹跳动效，计数与状态刷新后保留
- **删除**：删除前二次确认，卡片以过渡动画移除
- **昵称**：默认「访客」，点击右上角昵称按钮修改后，顶部展示与历史内容作者名同步更新；弹窗内支持焦点循环、`Esc` 关闭与焦点还原
- **本地持久化**：内容、点赞状态、昵称均写入 `localStorage`；存储被禁用、配额不足或数据损坏时有友好提示且页面不崩溃
- **多标签页同步**：其他标签页修改数据后，本页通过 `storage` 事件自动刷新
- **空状态与响应式**：无内容时展示引导文案；桌面单列居中，移动端自适应全宽
- **可访问性**：语义化标签、可见焦点环、`aria-live` 提示、`aria-pressed` 点赞语义、`prefers-reduced-motion` 降级

## 本地运行

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（默认 http://localhost:5173/）
npm run build    # 类型检查 + 生产构建，产物在 dist/
npm run preview  # 预览构建产物
```

> 若当前环境的 Node.js 由 fnm/nvm 管理，请先确保 `node`、`npm` 在当前 shell 的 `PATH` 中。

## 测试与 TDD 流程

```bash
npm test          # 单次运行全部测试（CI 用）
npm run test:watch # 监听模式
npm run typecheck  # 仅做类型检查
```

开发顺序是严格的 **红 → 绿 → 重构**：每一层先写会失败的测试，再补最小实现，最后在不改变行为的前提下重构。

| 顺序 | 测试文件 | 覆盖内容 |
| --- | --- | --- |
| 1 | `src/lib/*.spec.ts` | 字数统计（emoji 按字素簇计 1 个）、相对时间、存储适配器、内容与昵称规则、本地数据修复 |
| 2 | `src/stores/*.spec.ts` | Pinia store 的读写、排序、点赞计数不变量、持久化失败降级、轻提示计时 |
| 3 | `src/components/*.spec.ts` | 组件黑盒行为：按角色/`data-testid` 查询，模拟用户输入与点击，断言渲染结果与 `emits` |
| 4 | `src/App.spec.ts` | 集成：发布 / 点赞 / 删除 / 改名 / 数据恢复 / 多标签页同步 |

当前共 **142 个测试用例**，全部通过。测试环境为 happy-dom，`localStorage` 与定时器均在用例内可控（`createFakeStorage`、`vi.useFakeTimers()`）。

## 目录结构

```
2026.11/
├── index.html                 # Vite 入口
├── vite.config.ts             # Vue 插件 + Vitest（happy-dom）配置
├── tsconfig.json
├── src/
│   ├── main.ts                # 创建应用与 Pinia
│   ├── App.vue                # 页面装配：初始化数据、协调跨功能操作
│   ├── assets/base.css        # 设计令牌、重置、头像/按钮、信息流过渡、动效
│   ├── lib/                   # 与框架无关的领域逻辑（纯函数，易测）
│   │   ├── text.ts            # 字素计数、截断、头像首字
│   │   ├── time.ts            # 相对时间与完整时间格式化
│   │   ├── storage.ts         # localStorage 探测与安全读写适配器
│   │   ├── post.ts            # 内容规则、Post 模型、本地数据解析
│   │   └── profile.ts         # 昵称规则与本地昵称解析
│   ├── stores/
│   │   ├── posts.ts           # 内容集合（唯一数据源）
│   │   ├── user.ts            # 昵称
│   │   └── toast.ts           # 全局轻提示
│   ├── composables/
│   │   └── useNow.ts          # 30 秒刷新的「当前时间」，用于相对时间
│   ├── components/
│   │   ├── AppHeader.vue      # 品牌与昵称入口
│   │   ├── PostComposer.vue   # 发布框（本地草稿 + 字数校验）
│   │   ├── PostFeed.vue       # 信息流、数量、空状态、增删过渡
│   │   ├── PostCard.vue       # 单条内容（展示与事件上抛）
│   │   ├── NicknameDialog.vue # 昵称弹窗（校验、焦点陷阱、滚动锁定）
│   │   └── AppToast.vue       # 轻提示
│   └── test-utils/
│       └── fakeStorage.ts     # 可模拟写入失败的内存存储
├── package.json
└── README.md
```

## 架构说明

- **单一数据源**：`posts` store 持有全部内容，所有读写都经过 store；组件不直接触碰 `localStorage`
- **数据流**：`props` 向下、`emits` 向上。`PostCard` 只负责展示并抛出 `like` / `delete`，由 `App.vue` 决定确认、删除与提示
- **跨功能协调放在装配层**：修改昵称需要同时更新 `user` 与历史内容的作者名，这段编排写在 `App.vue`，两个 store 之间不互相依赖
- **领域逻辑与框架解耦**：`src/lib` 全部是纯函数，字符规则、时间格式与数据修复可以脱离 Vue 单独测试
- **存储降级**：`createStorageAdapter` 先探测可写性；不可用时应用退化为纯内存运行，store 通过 `writeFailed` 暴露写入失败，由装配层提示用户
- **数据修复**：读取历史数据时逐条 `normalizePost`（补默认值、纠正类型、丢弃非法记录），JSON 损坏时保留原始值不覆盖
- **安全**：用户内容只通过插值渲染（等价于 `textContent`），不使用 `v-html`
- **动画**：列表增删使用 `<TransitionGroup>` + CSS 过渡，`prefers-reduced-motion` 下自动降级

## 数据存储

数据仅保存在当前浏览器的 `localStorage` 中，不会上传到任何服务器，换浏览器或清除浏览器数据后内容不会保留。

| 键名 | 类型 | 说明 |
| --- | --- | --- |
| `weiyu:posts:v1` | `Post[]` | 全部内容，按创建时间倒序 |
| `weiyu:user:v1` | `{ name: string }` | 当前昵称 |

```ts
interface Post {
  id: string;        // 唯一标识
  author: string;    // 作者昵称
  content: string;   // 正文（纯文本）
  likes: number;     // 点赞数
  liked: boolean;    // 当前设备是否已点赞
  createdAt: number; // 创建时间戳（毫秒）
}
```

键名与旧版一致，因此旧版本留下的数据可以直接读取。

清空本地数据：浏览器开发者工具 → Application / 存储 → Local Storage，删除上述两个键；或在控制台执行：

```js
localStorage.removeItem('weiyu:posts:v1');
localStorage.removeItem('weiyu:user:v1');
```

## 浏览器兼容

近两年版本的 Chrome / Edge / Firefox / Safari 及移动端浏览器。核心依赖 `localStorage`、`Intl.Segmenter`（缺失时退化为按码点计数）、CSS 自定义属性与 `backdrop-filter`（后者可降级为纯色背景）。

## 提交规范

建议使用语义化提交信息，例如：

- `feat: 新增 xxx 功能`
- `test: 补充 xxx 用例`
- `refactor: 重构 xxx`
- `docs: 更新文档`

## 说明

本项目为原创界面、文案与代码实现，与任何第三方社交产品的界面、标识及品牌元素无关。

## 许可证

暂未指定许可证。
