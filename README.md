# VibeDistill

把播客、视频和深度长文，脱水成一句值得记住的话。一个面向长内容整理与个人知识归档的交互式前端作品。

[在线体验](https://dryout.pages.dev)

## 核心亮点

- **内容脱水**：输入标题、来源与逐字稿，在本地完成句子提取、金句筛选、核心结论和结构化要点生成。
- **原始出处与字幕导入**：粘贴视频 / 播客链接自动识别平台，或拖入 SRT / VTT / TXT 字幕直接填入文稿；音视频只读取本地元信息，不上传原文件。只有出处、没有文稿时会明确提示，而不是假装能脱水。
- **思想画廊**：以高光金句为视觉主体，关键词、来源、标签与星标四者可任意叠加筛选；点击卡片标签即按标签收敛，顶栏出现可单独清除的标签徽章。
- **阅读与批注**：三段式结构化论据配合可编辑个人批注，形成完整的阅读与复盘闭环。
- **账户与云端同步**：邮箱密码注册登录，归档存进 Supabase。未登录也能浏览公开切片，点脱水、星标、批注、删除时才要求登录；星标与批注按人隔离，退出登录立刻回到公开默认。
- **默认私密，按需公开**：新建卡片默认只有自己可见，详情抽屉里可一键切换公开 / 私密，卡片上直接标出当前状态。
- **产出方式可追溯**：每张卡都记着是 DeepSeek 生成的还是本地算法降级的，卡片与详情里都有角标。
- **藏书票导出**：提供三套平面构成配色，可一键生成并下载 1080 × 1440 高清金句卡片。
- **三套视觉主题**：原色构成、蓝图纸版与夜间展厅，均采用平涂色块、粗线框和硬边投影。
- **可复现的测试样本**：内置播客、视频、深度长文三份样本，一键装填标题、来源与正文，快速验证整条提炼链路。
- **完整响应式体验**：针对桌面、平板和手机重新编排信息层级，并支持键盘操作与减少动态效果偏好。

## 技术栈

- React 19
- Vite 8
- Supabase（Postgres + Auth + Row Level Security）
- Supabase Edge Function（Deno）+ DeepSeek（大模型脱水）
- 原生 CSS Design Tokens
- Lucide React
- Canvas 2D（高清卡片导出）
- localStorage（仅保存主题偏好）

## 本地运行

需要 Node.js 20.19+ 或 22.12+，以及一个自己的 Supabase 项目。

```bash
# 1. 配置环境变量：在项目根目录新建 .env
#    VITE_SUPABASE_URL=https://<your-project>.supabase.co
#    VITE_SUPABASE_ANON_KEY=<your-anon-key>
#    VITE_DISTILL_FUNCTION=distill   # 可选，函数名不同时覆盖

# 2. 在 Supabase SQL Editor 里依次执行
#    supabase/init.sql            -- 建表、RLS、6 条示例数据
#    supabase/02_personal_state.sql  -- 个人星标与批注表

# 3. 安装依赖并启动
npm install
npm run dev
```

```bash
npm run build      # 生产构建
npm run preview    # 预览生产构建
npm run lint       # ESLint
npm run test:e2e   # Playwright（没配 Supabase 时只跑冒烟部分）
```

默认访问地址：`http://localhost:5173`

`.env` 已被 `.gitignore` 忽略，不会进版本库。

## 部署

### 1. Supabase（数据库 + 登录 + 大模型代理）

1. SQL Editor 执行 `supabase/init.sql`（幂等，可重复执行，不会删数据）
   - 旧库升级：跑完 init.sql 再跑一次 `supabase/migrate-private.sql`，把历史用户卡片转为私密
   - 想要第 8 张 AI 样本卡：再跑 `supabase/seed-ai-sample.sql`
   - 只有想清空演示数据时才用 `supabase/reset.sql`（⚠️ 破坏性）
2. Edge Functions → 新建函数 `distill` → 粘贴 `supabase/functions/distill/index.ts` → Deploy
3. Project Settings → Edge Functions → Secrets 里加 `DEEPSEEK_API_KEY`
4. Authentication → 关闭邮箱验证，注册后可直接登录

大模型 Key 只存在 Supabase Secret，不会进前端产物；没配 Key 时应用会自动降级到本地算法。

> 函数名如果不是 `distill`（Supabase 新建时会自动生成随机名），在前端加一条 `VITE_DISTILL_FUNCTION=<函数名>` 即可，不用改代码。

### 2. Cloudflare Pages（前端）

Dashboard → Workers & Pages → Create → Pages → Connect to Git → 选本仓库，然后填：

| 项 | 值 |
| --- | --- |
| 项目名 | `dryout` |
| Production branch | `main` |
| Framework preset | `None`（下面两项手动填） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| 环境变量 | `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` |

环境变量在 **Settings → Build → Variables and secrets** 里加，两条都要落在 Production 作用域。

仓库里**刻意不放** `wrangler.toml`、也**不提交** `package-lock.json`，原因见下一节。

命令行部署：

```bash
npm run build
npx wrangler pages deploy dist --project-name dryout
```

## 上线踩坑记录

部署时真正踩到的四个坑。共同点是现象很有迷惑性——构建显示成功、页面能打开，但结果不对。

### 1. 仓库里的 `wrangler.toml` 会吞掉面板里的环境变量

**现象**：构建成功、页面能打开，但画廊永远是空的，控制台也不报错。

**根因**：构建日志里 `Found wrangler.toml file. Reading build configuration...` 之后紧跟 `Build environment variables: (none found)`。Pages 一旦在仓库里检测到 `wrangler.toml`，就改从文件读取构建配置，面板里的 `VITE_*` 不再注入构建环境。Vite 是构建时把变量写进 JS 的，读不到就是 `undefined`，应用直接跳过数据请求、渲染空状态。

**怎么发现**：下载线上 JS，搜数据库地址。搜不到就说明变量没进去。

**修法**：删掉 `wrangler.toml`，构建配置全写在面板里。

### 2. Windows 生成的 `package-lock.json` 会让 Linux 构建失败

**现象**：`Cannot find module 'vite'`，或 `npm ci` 报 `Missing: @rolldown/binding-linux-x64-gnu from lock file`。

**根因**：Vite 8 用 rolldown，依赖平台专属的原生二进制。本机（Windows）生成的 lockfile 只记录 `@rolldown/binding-win32-x64-msvc`，Linux 构建环境装不出对应绑定。

**修法**：不提交 lockfile，交给 CI 在 Linux 上解析依赖树。

### 3. Retry deployment 重试的是同一个 commit

**现象**：改了配置点重试，日志和产物一模一样，像是改动没生效。

**根因**：Pages 的 Retry 重建的是**同一个 commit**，只改面板设置不会改变源码树。涉及依赖或文件增删的改动，必须等新推送触发的构建。

### 4. 框架预设选错会生成完全无关的构建命令

**现象**：日志里出现 `Executing user command: npx vitepress build`，然后去装 vitepress。

**根因**：创建时框架预设被识别成了 VitePress，构建命令和产物目录都被带偏。这个项目是 Vite + React，预设应为 `None` 或 `Vite`。

## 项目结构

```text
.
├── src/
│   ├── components/          # 控制台、画廊卡片、详情抽屉、登录弹窗、藏书票、错误兜底
│   ├── hooks/
│   │   ├── useAuth.js       # 会话订阅、登录弹窗开关与原因
│   │   ├── useCards.js      # 拉取与合并、四维筛选、星标/批注/可见性/删除
│   │   ├── useTheme.js      # 三套主题与持久化
│   │   └── useToast.js      # 单条 toast
│   ├── lib/
│   │   ├── distill.js       # 本地启发式脱水：切句、打分、标签与标题推断
│   │   ├── sourceImport.js  # 链接规范化、平台识别、字幕解析、附件元信息
│   │   ├── exportPoster.js  # Canvas 2D 藏书票导出
│   │   ├── supabase.js      # Supabase 客户端与配置检测
│   │   ├── cardsApi.js      # 行与卡片对象映射、CRUD、个人状态合并
│   │   ├── llm.js           # 调用 Edge Function，失败时返回降级信号
│   │   └── constants.js     # 来源类型、主题、测试样本
│   ├── App.jsx              # 只做编排：组合 hooks 与 JSX
│   └── index.css            # 设计令牌、布局与三套主题
├── supabase/
│   ├── init.sql             # 幂等建库：表 + 增量迁移 + RLS + 6 条示例数据
│   ├── reset.sql            # ⚠️ 破坏性：清空全部卡片与个人状态
│   ├── migrate-private.sql  # 一次性：把已有用户卡片转为私密
│   ├── seed-ai-sample.sql   # 第 8 张卡：DeepSeek 真实生成的证据样本
│   └── functions/distill/   # Edge Function：调 DeepSeek 生成卡片字段
├── tests/                   # Playwright：smoke（无需密钥）+ archive（需数据）
├── public/_redirects        # Cloudflare Pages 的 SPA 回退
├── DESIGN.md                # 视觉与交互设计规范
├── LICENSE                  # MIT
├── eslint.config.js
├── playwright.config.js
├── index.html
└── vite.config.js
```

## 测试

仓库里的 E2E 是 Node 版 Playwright，分两组：

| 文件 | 依赖 | 说明 |
| --- | --- | --- |
| `tests/smoke.spec.js` | 无 | 页面骨架、三套主题与持久化、样本装填、校验提示、1440/940/700/390 四档横向溢出 |
| `tests/archive.spec.js` | 需 Supabase 数据 | 分类 / 标签 / 关键词组合筛选、编号不随筛选变化、详情抽屉 ESC 与角标 |

```bash
npm run test:e2e
```

没配 `VITE_SUPABASE_URL` 时画廊为空，`archive.spec.js` 会整组自动跳过——所以 CI 不需要任何密钥也能跑通冒烟部分。

更深的验收（注册登录、真实增删改查、大模型链路、降级路径）需要真实账号与 DeepSeek Key，没有入库，属于本地开发时的手工验收。

## 迭代记录

### v0.2 · 补上「投喂入口」与「标签筛选」

阶段一验收暴露了两个真问题，这一版只修这两处，其余交互保持原样。

**问题一：长内容没有地方放。**
控制台只有标题、来源和逐字稿，但用户手上真正握着的是一个 B 站链接、一段视频文件或一份 SRT 字幕，产品却没有接住它们的位置。

做法是加一行紧凑的「原始出处」操作区，而不是再开一个弹窗或独立页面：

- 链接只做规范化与平台识别，界面明确标注「仅保留出处」，不假装会自动抓取内容；
- SRT / VTT / TXT 在浏览器本地解析成纯文本后填入文稿，过滤时间码、VTT 注释与内联标签；
- 音视频只读取名称、大小和时长，原文件不上传、不持久化；
- 只有出处、没有文稿时主按钮禁用，并提示「还需要至少 20 字的逐字稿或字幕」。

这里的判断是：文稿才是脱水的原料，链接和附件只是出处。所以宁可在缺文稿时拦住用户，也不做「输入链接就自动生成」的假承诺。

**问题二：标签只是装饰。**
卡片底部的 `#标签` 原本是静态文字，点上去还会误触发详情抽屉。四个筛选维度里，只有它是假的。

- 标签改为真正的按钮，与关键词、来源、星标共享同一套筛选管线，四者可叠加；
- 顶栏出现 `#标签 ×` 徽章，只清除标签，不动搜索词和星标；
- 顺带修掉一个结构隐患：整张卡原本是一个 `<button>`，内部套 `<blockquote>` 属于非法内容模型。改成容器加绝对定位的打开层后，点整卡仍能打开详情，也能 Tab 聚焦后回车触发，标签按钮浮在打开层之上，不再冒泡。

**另外补了三份测试样本。**
播客、视频、长文各一份：视频样本带时间码，长文样本密集包含信号词，用来验证提炼逻辑在不同输入形态下都成立。

**验证方式**
当时用的是本地 Python + Playwright 脚本，没有入库。现在仓库里有了正式的 `tests/`（见 v0.5），那批脚本已被替换。

### v0.3 · 从本地演示走向真实云端

阶段二把「能演示」变成了「能真用」，界面与配色一处没动，换掉的是数据层。

**接了 Supabase。** 卡片从内置数组换成 `distill_cards` 表的实时查询，补上邮箱密码注册登录。未登录可以浏览公开切片，点脱水、星标、批注、删除时才弹出登录框；脱水被拦下时草稿不会丢，登录回来还能接着提交。

**示例卡片可以收藏和批注了。** 第一版把星标和批注直接写在卡片行上，结果是谁收藏了别人也看得见，公开默认被个人操作污染。改成独立的状态表 `distill_card_personal`，按 `(user_id, card_id)` 存每个人的星标与批注——卡片是内容，状态是各自的。退出登录后示例卡立刻回到「自带批注 + 未收藏」。批注字段用 `null` 区分「没写过」和「主动清空」，只点星标不会把示例批注吞掉。

**测试跟着改。** 所有断言从实际数据推算期望值，不再写死卡片数量；新增最关键的一条：退出登录后示例卡必须回到公开默认。

### v0.4 · 接上真实大模型

**为什么不在前端调模型。** `VITE_*` 变量会被 Vite 打进 JS 产物，任何人打开 DevTools 都能拿到。Anon Key 无所谓（有 RLS 兜着），大模型 Key 不行——泄露就是别人的免费额度。所以调用挪到 Supabase Edge Function，Key 存成 Secret。

**函数做三件事。** 校验用户 JWT，否则匿名拿 anon key 就能刷额度；调 DeepSeek 并强制 JSON 输出；服务端再校验一遍字段与长度，脏数据直接拒绝而不是入库。

**降级是默认行为。** 函数报错、超时或没配 Key，前端自动回落到本地启发式算法，界面一行不改，只在提示里说明这次不是模型生成的。演示不会因为网络或额度中断。

### v0.5 · 把「说过的」和「做到的」对齐

一次针对仓库描述的审计，逐条核验后发现七处描述与实现不符或工程卫生问题，这一版把它们全部修掉。

**默认全部公开（安全）。** `cardToRow` 写的是 `is_public: card.isPublic !== false`，而草稿里没有 `isPublic` 字段，于是每张新建卡片都默认公开——匿名访客用 anon key 就能读到别人的整张卡片，包括 `user_id`。改成 `isPublic === true` 才公开，并在详情抽屉里给了「公开 / 私密」开关，卡片与抽屉上都显示当前状态。存量数据用 `migrate-private.sql` 一次性转为私密。

**AI 效果不可追溯。** `distilledBy` 一直只存在于前端草稿里，落库时被丢掉了，事后无法判断哪张卡是模型生成、哪张是本地算法降级。新增 `distilled_by` 列（`llm` / `local`），卡片与抽屉都显示角标，`seed-ai-sample.sql` 里那第 8 张卡就是 DeepSeek 的真实输出，原稿一并附在脚本注释里。

**建库脚本是破坏性的。** 原 `init.sql` 开头 `drop table ... cascade`，会连带删掉个人状态表的外键约束，留下一张无约束的孤儿表。重写成幂等脚本：`create table if not exists` + `alter table add column if not exists` + 种子 `on conflict do nothing`，重复执行不丢数据；破坏性版本单独放进 `reset.sql`。

**来源类型的语义错了。** `bilibili` 把平台当成了格式，YouTube 链接被映射成 `type: 'bilibili'`。类型改为描述形态：`podcast` / `video` / `article`，B 站与 YouTube 都是 `video`，平台差异留在 `source_name` 里。

**README 声称有 Playwright 测试，仓库里一个都没有。** 现在 `tests/` 下有真正的 Node 版用例，并在 CI 里跑；README 的表述也改成如实描述，不再暗示仓库里有更多。

**工程卫生。** 补 MIT LICENSE；删掉零引用的 Vite 模板资源与 `supabase/.temp/`；ESLint 9 + Prettier + GitHub Actions（lint → build → e2e）；加 ErrorBoundary，渲染异常时给出可复制的错误信息而不是白屏；表结构去冗余——删掉恒为 false 的 `starred` 列，`personal_note` 改名 `sample_note` 以区别于个人状态表里的同名概念。

**App.jsx 拆分。** 12.8KB 的单一组件拆成 `useAuth` / `useCards` / `useTheme` / `useToast` 四个 hook，`App.jsx` 只保留编排与 JSX，行为零变化。

## 数据说明

归档卡片、个人星标与批注存放在 Supabase（Postgres），通过 Row Level Security 隔离：访客只能读公开卡片，登录用户只能写自己的个人状态，删除仅限卡片创建者。主题偏好仍留在浏览器 `localStorage`。原始出处的链接与附件信息只作为卡片元数据保存，音视频原文件不会被读取内容或上传。
