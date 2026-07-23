# 后端开发计划与进度

## 当前状态

- 状态：进行中
- 分支：`codex/backend-dev`
- 后端工作树：`C:/Users/xyc20/.codex/worktrees/5f6f/what-to-eat-today`
- 集成策略：本分支只提交后端切片；不合入前端分支，不合入 integration 分支。
- 接口文档：`docs/backend/interfaces.md`

## 后端边界

- 后端代码范围：`supabase/**`、`src/server/**`、`src/app/api/**`、`scripts/**`、后端文档。
- 页面和 UI 组件由前端或 integration 分支接入。
- 认证产品形态：`username + password`，不做免密登录、magic link、OTP。

## 阶段计划

| 阶段 | 目标 | 状态 | 说明 |
| --- | --- | --- | --- |
| B0 | 建立后端工作记录和边界 | 已完成 | 后端进度表和接口文档已建立 |
| B1 | Supabase schema 初始化 | 已完成 | 核心表、枚举、RLS、触发器 |
| B2 | 初始数据导入 | 已完成 | seed 脚本和初始数据导入能力 |
| B3 | 公开浏览读取层 | 已完成 | `getLists/getList/getPlacesByList/getPlace/getMapPlaces/getListStats` |
| B4 | username 业务身份模型 | 已完成 | `profiles.username` 和创建用户脚本 |
| B5 | 认证与评分 | 已完成 | 登录、bearer token、评分写入、权限 smoke |
| B6 | 后台写入接口 | 进行中 | 店铺新增/编辑、软归档和榜单新增/编辑接口已实现 |

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
| BE-009 | 建立后端接口文档 | 已完成 | `docs/backend/interfaces.md` | 文档已更新 |
| BE-010 | 后端切片构建验证 | 已完成 | `pnpm typecheck`、`pnpm build` | `node --check`、`tsc --noEmit`、`next build` 通过 |
| BE-011 | 增加 username 业务身份模型 | 已完成 | `profiles.username`、username 约束、触发器更新 | `tsc --noEmit`、`next build` |
| BE-012 | 增加 username 创建用户脚本 | 已完成 | `scripts/create-auth-user.mjs`、`pnpm auth:create-user` | `node --check` |
| BE-013 | 创建测试登录账号 | 已完成 | `test_user` member 账号 | `pnpm auth:create-user` 成功 |
| BE-014 | 实现 username/password 登录接口 | 已完成 | `POST /api/auth/login`、`src/server/auth/**` | 登录 smoke 通过 |
| BE-015 | 实现 bearer token 解析 | 已完成 | `src/server/auth/session.ts` | 未带 token 返回 401 |
| BE-016 | 实现评分写入接口 | 已完成 | `POST /api/ratings`、`src/server/ratings/**` | 评分 smoke 通过 |
| BE-017 | 创建外部测试账号 | 已完成 | `test_external` 无小队账号 | `pnpm auth:create-user -- --no-team` 成功 |
| BE-018 | 新增登录和评分权限 smoke 脚本 | 已完成 | `scripts/smoke-auth-ratings.mjs`、`pnpm smoke:auth-ratings` | member/external/401/403 路径通过 |
| BE-019 | 实现后台店铺新增/编辑接口 | 已完成 | `POST /api/admin/places`、`upsertAdminPlace` | member 写入 200，external 403，未登录 401 |
| BE-020 | 实现后台榜单新增/编辑接口 | 已完成 | `POST /api/admin/lists`、`upsertAdminList` | member 写入 200，external 403，未登录 401 |
| BE-021 | 实现后台店铺软归档接口 | 已完成 | `POST /api/admin/places/archive`、`places.archived_at` | `tsc --noEmit`、`next build` 通过；远端 smoke 待执行最新 schema |

## 完成记录

| 日期 | 完成内容 | 涉及文件 | 验证 |
| --- | --- | --- | --- |
| 2026-06-24 | 建立 Supabase schema，并确认远端核心表可访问 | `supabase/schema.sql` | 表 count 查询全部 OK |
| 2026-06-24 | 创建并填写本地 `.env.local` | `.env.local` | 环境变量存在 |
| 2026-06-24 | 完成初始 seed 脚本并导入真实数据 | `scripts/seed-supabase.mjs`、`package.json` | `teams:1`、`lists:2`、`places:77`、`ratings:60` |
| 2026-07-06 | 完成公开浏览数据读取契约 | `src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build` 通过 |
| 2026-07-16 | 调整认证模型为 username + password，业务表移除 email | `supabase/schema.sql`、`scripts/create-auth-user.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build` 通过 |
| 2026-07-16 | 创建测试登录账号 | Supabase Auth、`profiles`、`team_members` | `test_user` 已创建并绑定为 `what-to-eat` member |
| 2026-07-16 | 实现 username/password 登录接口 | `src/app/api/auth/login/route.ts`、`src/server/auth/**`、`src/server/supabase/auth.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、登录 API smoke test 通过 |
| 2026-07-16 | 实现评分写入接口 | `src/app/api/ratings/route.ts`、`src/server/auth/session.ts`、`src/server/ratings/**`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、登录后评分 API smoke test 通过 |
| 2026-07-16 | 远端测试评分写入 | Supabase `ratings` | `test_user` 对 `red-list-1` 写入/更新 `team_member` 评分 `4.2` |
| 2026-07-23 | 创建外部测试账号并补权限 smoke 脚本 | `scripts/create-auth-user.mjs`、`scripts/smoke-auth-ratings.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、`pnpm smoke:auth-ratings` 通过 |
| 2026-07-23 | 远端权限测试评分写入 | Supabase `ratings` | `test_user` 更新 `team_member` 评分；`test_external` 写入/更新 `external` 评分 |
| 2026-07-23 | 实现后台店铺新增/编辑接口 | `src/app/api/admin/places/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`src/server/teams/repository.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、API smoke test 通过 |
| 2026-07-23 | 远端后台店铺写入测试 | Supabase `places`、`list_places` | `admin-smoke-place` 已写入/更新并关联 `red-list` |
| 2026-07-23 | 实现后台榜单新增/编辑接口 | `src/app/api/admin/lists/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`src/server/teams/repository.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、API smoke test 通过 |
| 2026-07-23 | 远端后台榜单写入测试 | Supabase `lists` | `admin-smoke-list` 已写入/更新到 `what-to-eat` |
| 2026-07-23 | 实现后台店铺软归档接口 | `supabase/schema.sql`、`src/app/api/admin/places/archive/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build` 通过；远端需执行最新 schema 后 smoke |

## 当前数据库快照

| 表 | 当前数量 | 说明 |
| --- | ---: | --- |
| `teams` | 1 | 默认探店小队 |
| `lists` | 3+ | 红榜、再练练和后台接口 smoke 测试榜单 |
| `places` | 78+ | 初始店铺数据和后台接口 smoke 测试店 |
| `list_places` | 78+ | 店铺和榜单关联，包含后台接口 smoke 测试关联 |
| `ratings` | 60+ | 初始评分和测试评分 |
| `import_batches` | 1 | 初始导入批次 |
| `profiles` | 2+ | `test_user`、`test_external` 等测试账号 |
| `team_members` | 1+ | 默认小队成员 |

## 下一步

1. 在 Supabase SQL Editor 执行最新 `supabase/schema.sql`，再远端验证 `POST /api/admin/places/archive`。
2. 后续 integration 接入后台表单时使用 `POST /api/admin/places`、`POST /api/admin/places/archive` 和 `POST /api/admin/lists`。
3. 继续补成员管理能力。

## 记录规则

- 每完成一个后端任务，更新“任务进度表”的状态。
- 每次有可验证结果，追加到“完成记录”。
- 每次数据库结构变化，更新 RLS 或迁移说明。
- 每次新增或修改后端接口，同步更新 `docs/backend/interfaces.md`。
