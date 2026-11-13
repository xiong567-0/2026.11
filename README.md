# 2026.11

「微语 · Micro Posts」—— 一个轻量短文本发布页：写下一句话，留住此刻的想法。

纯前端单页应用，使用 **HTML + CSS + 原生 JavaScript** 编写，无构建步骤、无第三方依赖、无后端服务。所有内容保存在浏览器本地，刷新或关闭后再次打开依然存在。

## 在线预览

<https://xiong567-0.github.io/2026.11/>

## 功能

- **发布内容**：纯文本，最多 200 字，输入时实时显示字数；为空或超限时发布按钮不可用并给出提示，支持 `Ctrl / Cmd + Enter` 快捷发布
- **浏览信息流**：所有内容按发布时间倒序展示为卡片，包含渐变首字母头像、昵称、相对时间（刚刚 / x 分钟前 / x 小时前 / 昨天 / 具体日期）与正文，正文保留换行
- **点赞**：点赞 / 取消点赞，带选中态与弹跳动效，计数与状态刷新后保留
- **删除**：删除前二次确认，卡片淡出后即时移除
- **昵称**：默认「访客」，点击右上角昵称按钮修改后，顶部展示与历史内容作者名同步更新
- **本地持久化**：内容、点赞状态、昵称均写入 `localStorage`，数据损坏或存储不可用时有友好提示且页面不崩溃
- **空状态与响应式**：无内容时展示引导文案；桌面单列居中，移动端自适应全宽
- **可访问性**：语义化标签、可见焦点环、`aria-live` 提示、弹窗焦点循环与 `Esc` 关闭、`prefers-reduced-motion` 降级

## 本地运行

方式一：直接双击 `index.html`（脚本为普通 `<script>`，非 ES Module，`file://` 协议可直接运行）。

方式二：启动一个本地静态服务器（推荐，行为与线上一致）：

```bash
python -m http.server 8099
# 浏览器访问 http://127.0.0.1:8099/
```

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

清空本地数据：打开浏览器开发者工具 → Application / 存储 → Local Storage，删除上述两个键；或在控制台执行：

```js
localStorage.removeItem('weiyu:posts:v1');
localStorage.removeItem('weiyu:user:v1');
```

## 目录结构

```
2026.11/
├── index.html          # 页面骨架：导航、发布区、信息流、空状态、昵称弹窗
├── css/
│   └── style.css       # 主题变量、布局、组件样式、动效与响应式
├── js/
│   └── app.js          # 存储层、渲染层、事件层与初始化
├── README.md           # 项目说明
└── .gitignore          # Git 忽略规则
```

## 实现说明

- **单向数据流**：`state`（内容 + 昵称）为唯一数据源，任何操作先更新状态并写入 `localStorage`，再重绘信息流
- **渲染**：`DocumentFragment` 批量构建卡片后一次性插入，个人级数据量下全量重绘成本可忽略
- **安全**：用户内容一律通过 `textContent` 注入，不使用 `innerHTML` 拼接，避免 XSS
- **事件委托**：点赞与删除仅在列表容器上绑定一次，通过 `data-action` + `data-id` 定位目标
- **零外部资源**：图标为内联 SVG，favicon 为 `data:` URI，字体使用系统字体栈，离线可用；`backdrop-filter` 不支持时自动退化为纯色背景

## 浏览器兼容

近两年版本的 Chrome / Edge / Firefox / Safari 及移动端浏览器。核心依赖 `localStorage`、`Element.closest`、CSS 自定义属性与 `backdrop-filter`（后者可降级）。

## 提交规范

建议使用语义化提交信息，例如：

- `feat: 新增 xxx 功能`
- `fix: 修复 xxx 问题`
- `docs: 更新文档`

## 说明

本项目为原创界面、文案与代码实现，与任何第三方社交产品的界面、标识及品牌元素无关。

## 许可证

暂未指定许可证。
