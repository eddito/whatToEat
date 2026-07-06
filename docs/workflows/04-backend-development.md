# 后端开发计划与进度

## 当前状态

- 状态：进行中
- 分支：`codex/backend-dev`
- 当前切片：公开浏览数据读取
- 后端工作树：`C:/Users/xyc20/.codex/worktrees/5f6f/what-to-eat-today`
- 集成策略：本分支只提交后端切片；不合入前端分支，不合入 integration 分支。
- 接口文档：`docs/backend/interfaces.md`
- 数据库：Supabase PostgreSQL

## 后端边界

- 后端代码范围：`supabase/**`、`src/server/**`、`scripts/**`、后端文档。
- 本切片不修改页面和 UI 组件。
- integration 分支后续负责把前端从 seed JSON 切到 Supabase 读取，并保留失败回退。

## 阶段计划

| 阶段 | 目标 | 状态 | 说明 |
| --- | --- | --- | --- |
| B0 | 建立后端工作记录和边界 | 已完成 | 后端进度表和接口文档已建立 |
| B1 | Supabase schema 初始化 | 已完成 | 核心表、枚举、RLS、触发器 |
| B2 | 初始数据导入 | 已完成 | seed 脚本和初始数据导入能力 |
| B3 | 公开浏览读取层 | 已完成 | `getLists/getList/getPlacesByList/getPlace/getMapPlaces/getListStats` |
| B4 | integration 联调接入 | 待联调 | 由 integration 分支合入后验证 |
| B5 | 认证、评分、后台写入 | 后续切片 | 本次不提交写入接口和 UI |

## 任务进度表

| ID | 任务 | 状态 | 产出 | 验证 |
| --- | --- | --- | --- | --- |
| BE-001 | 创建后端专用工作树分支 | 已完成 | `codex/backend-dev` | `git status --branch` |
| BE-002 | 创建 `.env.local` 并填写本地环境变量 | 已完成 | `.env.local` 本地文件 | 变量存在性检查 |
| BE-003 | 建立公开浏览 schema | 已完成 | `supabase/schema.sql` | 核心表覆盖公开浏览字段 |
| BE-004 | 建立公开读取 RLS 最小闭环 | 已完成 | `lists/places/list_places/ratings/photos` select policies | 写策略未开放 |
| BE-005 | 编写 Supabase seed 脚本 | 已完成 | `scripts/seed-supabase.mjs`、`pnpm db:seed` | `node --check` |
| BE-006 | 新增 Supabase server admin client | 已完成 | `src/server/env.ts`、`src/server/supabase/admin.ts` | `tsc --noEmit` |
| BE-007 | 新增公开浏览 repository | 已完成 | `src/server/places/repository.ts` | `tsc --noEmit` |
| BE-008 | 新增公开浏览 service 契约 | 已完成 | `src/server/places/service.ts` | `tsc --noEmit` |
| BE-009 | 建立后端接口文档 | 已完成 | `docs/backend/interfaces.md` | 已记录公开浏览契约 |
| BE-010 | 后端切片构建验证 | 已完成 | `pnpm typecheck`、`pnpm build` | `node --check`、`tsc --noEmit`、`next build` 通过 |

## 完成记录

| 日期 | 完成内容 | 涉及文件 | 验证 |
| --- | --- | --- | --- |
| 2026-06-24 | 建立 Supabase schema，并确认远端核心表可访问 | `supabase/schema.sql` | 表 count 查询全部 OK |
| 2026-06-24 | 创建并填写本地 `.env.local` | `.env.local` | 环境变量存在 |
| 2026-06-24 | 完成初始 seed 脚本并导入真实数据 | `scripts/seed-supabase.mjs`、`package.json` | `teams:1`、`lists:2`、`places:77`、`ratings:60` |
| 2026-07-06 | 收拢公开浏览后端切片，移除本次不提交的页面/UI/评分写入改动 | `src/server/**`、`supabase/schema.sql`、`docs/**` | `git status` 确认无页面/UI 改动 |
| 2026-07-06 | 完成公开浏览数据读取契约 | `src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `node --check scripts/seed-supabase.mjs`、`tsc --noEmit`、`next build` 通过 |

## 当前数据库快照

| 表 | 当前数量 | 说明 |
| --- | ---: | --- |
| `teams` | 1 | 默认探店小队 |
| `lists` | 2 | 红榜、再练练 |
| `places` | 77 | 初始店铺数据 |
| `list_places` | 77 | 店铺和榜单关联 |
| `ratings` | 60 | 已有成员评分 |
| `import_batches` | 1 | 初始导入批次 |
| `profiles` | 1 | Auth 用户资料 |
| `team_members` | 1 | 初始 owner 成员 |

## 下一步

1. 提交 `Implement public browsing backend slice`。
2. 等 integration 分支合入后，联调前端 seed fallback 与 Supabase 读取。

## 记录规则

- 每完成一个后端任务，更新“任务进度表”的状态。
- 每次有可验证结果，追加到“完成记录”。
- 每次数据库结构变化，更新 RLS 或迁移说明。
- 每次新增或修改后端接口，同步更新 `docs/backend/interfaces.md`。
