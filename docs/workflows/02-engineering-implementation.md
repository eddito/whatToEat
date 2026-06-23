# 代码实现工作流

## 当前状态

- 状态：首版工程骨架已完成
- 负责人：代码实现工作流
- 目标：完成前端实现、后端实现、数据库设计、权限策略、评分算法、数据导入和测试。
- 默认技术栈：Next.js + TypeScript + Supabase + PostgreSQL
- 应用暂定名称：今天吃什么
- 初始管理员账号：1397854281@qq.com
- 公开规则：暂定全公开
- 首版地图：启用，地图供应商为高德地图
- 首版域名：暂时使用 Vercel 免费域名

## 已确认工程输入

- 已收到 Excel 数据文件：`C:\Users\xyc20\Downloads\今天吃什么.xlsx`。
- GitHub 仓库：`https://github.com/eddito/whatToEat`。
- 高德地图 key 已提供，后续写入 `NEXT_PUBLIC_AMAP_KEY` 或等效环境变量，不在文档或仓库中明文保存。
- Supabase publishable key 已提供，后续写入前端可用环境变量，不在文档或仓库中明文保存。
- Supabase secret key 已提供，后续仅写入服务端环境变量，不在文档或仓库中明文保存。
- Supabase Project URL 已提供：`https://lickxydbtkyijgjmpnqo.supabase.co`。
- 本地项目路径：`D:\yjl\what-to-eat-today`
- 当前实现：Next.js 应用骨架、真实种子数据、首页卡片流、榜单页、店铺详情页、地图页、后台占位、Supabase schema。
- 验证状态：TypeScript 检查通过，Next.js 生产构建通过，核心路由本地 HTTP 检查通过。
- 工作表：
  - `红榜`：74 条记录。
  - `再练练`：3 条记录。
  - `智能表1`：0 条记录，作为模板表暂不导入主数据。
- 主数据列：店名、类型、口味、特色菜、评价、地区、具体位置、停车、来源、已探店、打分（杨）、打分（陈）、打分（综合）。

## 工作流职责

代码实现工作流负责把产品和 UI 方案实现为可运行、可测试、可部署的应用。

核心职责：

- 搭建 Next.js 应用结构。
- 实现前端页面、组件和交互。
- 设计 Supabase PostgreSQL 数据模型。
- 实现认证、授权、RLS 权限策略。
- 实现队内评分、外部评分和混合总分。
- 实现腾讯文档导出数据的导入流程。
- 完成自动化和手动测试。

## 输入

- 产品统一设计工作流提供的 Product Task Brief。
- UI 设计工作流提供的 UI Handoff。
- 腾讯文档导出的 `.xlsx` 或 `.csv`。
- Supabase 项目配置，部署联调阶段提供。
- 地图 API Key，地图功能进入实现时提供。

## 输出

- 可运行的 Next.js 应用。
- 前端页面和组件。
- 数据库迁移 SQL。
- Supabase RLS 权限策略。
- 数据导入脚本或导入工具。
- API / Server Actions。
- 测试结果和已知问题。
- 部署工作流需要的环境变量清单。

## 技术栈

- Frontend：Next.js App Router、React、TypeScript。
- Styling：Tailwind CSS、shadcn/ui。
- Icons：lucide-react。
- Backend：Next.js Route Handlers / Server Actions。
- Database：Supabase PostgreSQL。
- Auth：Supabase Auth。
- Storage：Supabase Storage。
- Map：高德地图 JS API 2.0。
- Validation：Zod。
- ORM / SQL：优先直接 SQL migration；如项目复杂再引入 Drizzle。
- Testing：Vitest、Playwright、必要的 SQL policy tests。

## 数据模型草案

### Core Tables

- `profiles`：应用用户资料。
- `teams`：小队。
- `team_members`：小队成员和角色。
- `places`：店铺基础信息。
- `lists`：榜单。
- `list_places`：榜单和店铺关系。
- `ratings`：用户评分。
- `photos`：店铺图片。
- `imports`：数据导入批次。
- `import_rows`：导入行和异常记录。

### Key Fields

- `teams.visibility_default`
- `team_members.role`：`owner`、`member`、`viewer`
- `lists.visibility`：`private`、`public_view`、`public_rate`
- `ratings.source`：`team_member`、`external`
- `places.visited`
- `places.region`
- `places.category`
- `places.taste_tags`
- `places.parking_note`
- `places.source_label`
- `places.longitude`
- `places.latitude`
- `places.geocode_status`

## 初步字段映射

| Excel 列 | 目标字段 | 说明 |
| --- | --- | --- |
| 店名 | `places.name` | 店铺名称 |
| 类型 | `places.category` | 菜系或店铺类型 |
| 口味 | `places.taste_tags` | 逗号分隔后作为标签 |
| 特色菜 | `places.signature_dishes` | 可保留为文本，后续可拆标签 |
| 评价 | `places.review_summary` | 原始探店评价 |
| 地区 | `places.region` | 城区或区域 |
| 具体位置 | `places.location_label` | 地图检索名或地址别名 |
| 停车 | `places.parking_note` | 停车备注 |
| 来源 | `places.source_label` | 推荐来源 |
| 已探店 | `places.visited` | `✅` 映射为 true |
| 打分（杨） | `ratings.score` | 成员“杨”的队内评分 |
| 打分（陈） | `ratings.score` | 成员“陈”的队内评分 |
| 打分（综合） | computed / legacy field | 作为导入校验参考，正式综合分由系统计算 |

## 地图实现要求

- 首版使用高德地图 JS API 2.0。
- 店铺详情页提供地图定位入口。
- 地图页支持按地区、类型、口味、评分筛选后的点位展示。
- 导入阶段优先用 `具体位置`、`地区`、店名组合做地理编码准备；若无法自动解析，经纬度可为空并在后台标记待补全。
- 地图 key 只能通过环境变量注入，不提交到 GitHub。

## 权限策略

- 全公开规则下，未登录用户可读取公开榜单和公开店铺详情。
- 登录外部用户可读取公开榜单详情。
- 登录外部用户只可在 `public_rate` 榜单关联店铺上评分。
- 小队成员可读取队内私密榜单和店铺。
- 小队成员可创建和编辑队内店铺。
- owner 可管理成员、榜单权限和删除/归档。
- 所有敏感写操作必须在服务端校验成员角色。

## 评分算法

默认混合总分：

```txt
mixed_score = team_score * 0.7 + external_score * 0.3
```

外部评分人数少于 5 时降低外部权重：

```txt
external_weight = min(external_rating_count / 5, 1) * 0.3
team_weight = 1 - external_weight
mixed_score = team_score * team_weight + external_score * external_weight
```

队内评分、外部评分和混合总分必须分开展示，避免外部用户稀释小队口味。

## 阶段拆解

### E0 项目初始化

- 创建 Next.js + TypeScript 项目。
- 配置 Tailwind CSS 和基础组件。
- 建立目录结构。
- 配置 lint、format、test。

### E1 数据库和权限

- 编写 schema migration。
- 编写 RLS policies。
- 建立 seed 数据。
- 建立本地或远程 Supabase 连接说明。

### E2 前端公开页面

- 实现首页卡片流。
- 实现榜单页。
- 实现店铺详情页。
- 实现登录入口。
- 实现公开权限下的数据读取。

### E3 小队和后台

- 实现小队主页。
- 实现店铺新增和编辑。
- 实现榜单管理。
- 实现成员管理。
- 实现评分入口。

### E4 数据导入

- 解析腾讯文档导出的 `.xlsx` 或 `.csv`。
- 映射店名、类型、口味、特色菜、评价、地区、具体位置、停车、来源、已探店、成员评分、综合分。
- 记录无法映射或重复数据。
- 导入后生成审核报告。

### E5 测试和交付

- 编写核心单元测试。
- 编写权限测试。
- 编写关键路径 Playwright 测试。
- 输出部署环境变量清单。
- 交付部署工作流。

## 任务清单

- [x] 初始化项目。
- [x] 建立基础页面和路由。
- [x] 建立数据库 schema。
- [ ] 建立 RLS 策略。
- [ ] 实现认证流程。
- [x] 实现基于种子数据的公开浏览。
- [ ] 实现小队和成员管理。
- [ ] 实现榜单权限。
- [ ] 实现评分和混合总分。
- [x] 生成 Excel 种子数据和导入说明。
- [ ] 实现图片上传。
- [ ] 完成测试。
- [ ] 交付部署清单。

## 验收标准

- 应用可在本地启动。
- 未登录访客只能访问公开内容。
- 登录外部用户可在开放打分榜单评分。
- 小队成员可编辑队内数据。
- owner 可管理榜单权限。
- 混合评分计算正确。
- 腾讯文档导出数据可导入并生成异常报告。
- 关键页面在桌面和移动端可用。
- 工程输出可交给部署工作流上线。

## 需要用户提供的信息

- Supabase Project URL 已提供：`https://lickxydbtkyijgjmpnqo.supabase.co`。
- Supabase publishable / anon key 已提供，需部署时写入环境变量。
- Supabase secret / service role key 已提供，需部署时写入服务端环境变量。
- GitHub 仓库已提供：`https://github.com/eddito/whatToEat`。
- 管理员邮箱已提供：`1397854281@qq.com`。
- 腾讯文档导出的 `.xlsx` 已提供。
- 高德地图 API Key 已提供，需部署时写入环境变量。
- 是否提供真实图片或允许先用占位图。

## 阻塞项

- Supabase secret key 必须只存在于服务端环境变量中，不能提交到 GitHub。
- 如高德地图 key 失效、域名白名单未配置或免费额度不足，地图功能可能无法正常加载。
- 如管理员邮箱变化，需要同步更新 seed 和部署初始化步骤。

## 测试计划

- 单元测试：评分算法、字段映射、权限 helper。
- 集成测试：登录、创建店铺、创建榜单、评分、导入。
- RLS 测试：匿名、外部用户、member、owner 的读写权限。
- E2E 测试：首页浏览、榜单查看、店铺详情、登录评分、后台编辑。
- 响应式测试：移动端 375px、桌面端 1280px。

## 变更记录

| 日期 | 变更 | 来源 | 影响 |
| --- | --- | --- | --- |
| 2026-06-21 | 创建代码实现工作流 | Codex | 前端、后端、数据库、测试 |
| 2026-06-21 | 写入管理员账号、公开规则、Excel 结构和字段映射 | 用户 / Codex | 数据库、导入、权限 |
| 2026-06-21 | 写入 GitHub 仓库地址 `eddito/whatToEat` | 用户 / Codex | 代码初始化、版本管理、部署 |
| 2026-06-21 | 写入高德地图、免费域名和地图 key 状态 | 用户 / Codex | 地图实现、环境变量、部署 |
| 2026-06-21 | 写入 Supabase key 提供状态，Project URL 待补 | 用户 / Codex | 环境变量、后端连接 |
| 2026-06-21 | 写入 Supabase Project URL | 用户 / Codex | 数据库连接、认证配置 |
| 2026-06-21 | 初始化 Next.js 首版应用并完成构建验证 | Codex | 前端、数据、Supabase schema |
