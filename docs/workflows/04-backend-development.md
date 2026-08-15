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
| B6 | 后台写入接口 | 已完成 | 店铺新增/编辑、软归档和榜单新增/编辑接口已实现 |
| B7 | 成员管理接口 | 已完成 | owner-only 成员添加、角色调整和移除接口已实现 |
| B8 | 导入脚本运维能力 | 已完成 | seed dry-run、批次追踪、归档缺失项和按批次回滚 |
| B9 | 导入批次后台读取 | 已完成 | owner-only 导入批次列表和关联数据计数接口 |
| B10 | 后台只读管理数据 | 进行中 | 成员列表、后台汇总、后台榜单列表、店铺详情、已归档店铺、榜单内店铺管理视图和店铺评分明细接口已实现 |
| B11 | 登录态读取 | 已完成 | 当前用户资料、小队角色和 refresh token 换新接口已实现 |

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
| BE-021 | 实现后台店铺软归档接口 | 已完成 | `POST /api/admin/places/archive`、`places.archived_at` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-022 | 实现后台成员管理接口 | 已完成 | `POST /api/admin/members`、`DELETE /api/admin/members`、`src/server/teams/service.ts` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-023 | 增强 Supabase seed 导入脚本 | 已完成 | `scripts/seed-supabase.mjs`、`import_batches` 批次字段、`import_batch_id` 追踪字段 | `node --check`、`tsc --noEmit`、`next build`、远端 `pnpm db:seed:dry-run` 通过 |
| BE-024 | 实现导入批次后台读取接口 | 已完成 | `GET /api/admin/import-batches`、`src/server/imports/**`、`import_batches.team_id` | `node --check`、`tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-025 | 实现后台成员列表接口 | 已完成 | `GET /api/admin/members`、`getAdminMembers` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-026 | 实现后台已归档店铺列表接口 | 已完成 | `GET /api/admin/places/archived`、`getAdminArchivedPlaces` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-027 | 实现榜单内店铺管理视图接口 | 已完成 | `GET /api/admin/lists/[slug]/places`、`getAdminPlacesByList` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-028 | 实现后台店铺评分明细接口 | 已完成 | `GET /api/admin/places/[id]/ratings`、`getAdminPlaceRatings` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-029 | 实现当前用户登录态接口 | 已完成 | `GET /api/auth/me`、`getCurrentUserSession` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-030 | 实现 refresh token 换新接口 | 已完成 | `POST /api/auth/refresh`、`refreshSession` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-031 | 实现后台榜单列表接口 | 已完成 | `GET /api/admin/lists`、`getAdminLists` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-032 | 补齐远端 seed 导入批次追踪 | 已完成 | 远端 `places/list_places/ratings.import_batch_id` | `pnpm db:seed` 和 `GET /api/admin/import-batches?limit=3` 验证通过 |
| BE-033 | 实现榜单内店铺排序接口 | 已完成 | `POST /api/admin/lists/[slug]/places/order`、`reorderAdminListPlaces` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-034 | 实现后台店铺详情接口 | 已完成 | `GET /api/admin/places/[id]`、`getAdminPlace` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| BE-035 | 新增后台只读 smoke 脚本 | 已完成 | `pnpm smoke:admin-read`、`scripts/smoke-admin-read.mjs` | `node --check`、`tsc --noEmit`、`pnpm smoke:admin-read` 通过 |
| BE-036 | 实现后台店铺列表查询接口 | 已完成 | `GET /api/admin/places`、`getAdminPlaces` | `node --check`、`tsc --noEmit`、`pnpm smoke:admin-read` 通过 |
| BE-037 | 实现账号联系方式校验修改密码接口 | 已完成 | `POST /api/auth/change-password`、`profiles.contact_email/contact_phone`、username 规则收紧 | `node --check`、`tsc --noEmit`、`next build`、远端 `pnpm smoke:change-password` 通过 |
| BE-038 | 新增修改密码 smoke 脚本 | 已完成 | `pnpm smoke:change-password`、`scripts/smoke-change-password.mjs` | `node --check`、`tsc --noEmit`、`pnpm smoke:change-password` 通过 |
| BE-039 | 实现当前用户评分读取和删除接口 | 已完成 | `GET /api/ratings`、`DELETE /api/ratings`、`getMyRating/deleteMyRating` | `node --check`、`tsc --noEmit`、`next build`、`pnpm smoke:auth-ratings` 通过 |
| BE-040 | 接入店铺照片公开读取契约 | 已完成 | `photos` 读取、`coverPhotoUrl/photoCount`、后台详情 `photos` | `tsc --noEmit`、`next build`、`pnpm smoke:admin-read` 通过 |
| BE-041 | 实现店铺照片上传和真删除接口 | 已完成 | `place-photos` bucket、`photos.storage_path`、`POST/PATCH/DELETE /api/admin/places/[id]/photos` | `node --check`、`tsc --noEmit`、`next build`、`pnpm smoke:admin-photos` 通过 |
| BE-042 | 新增店铺照片上传/真删除 smoke 脚本 | 已完成 | `pnpm smoke:admin-photos`、`scripts/smoke-admin-photos.mjs` | `node --check`、`tsc --noEmit`、`next build`、远端 smoke 通过 |
| BE-043 | 实现后台评分删除接口 | 已完成 | `DELETE /api/admin/places/[id]/ratings`、`deleteAdminPlaceRating` | `node --check`、`tsc --noEmit`、`next build`、`pnpm smoke:auth-ratings` 通过 |
| BE-044 | 新增后台写入 smoke 脚本 | 已完成 | `pnpm smoke:admin-write`、`scripts/smoke-admin-write.mjs` | `node --check`、`tsc --noEmit`、`next build`、远端 smoke 通过 |
| BE-045 | 细化 viewer 角色后台内容只读权限 | 已完成 | `canReadTeamContent`、后台内容 GET 接口允许 viewer | `node --check`、`tsc --noEmit`、`next build`、远端 `pnpm smoke:admin-write` 通过 |
| BE-046 | 实现后台汇总计数接口 | 已完成 | `GET /api/admin/summary`、`getAdminSummary`、team 内容计数读取 | `node --check`、`tsc --noEmit`、`pnpm smoke:admin-read` 覆盖 |

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
| 2026-07-23 | 实现后台店铺软归档接口 | `supabase/schema.sql`、`src/app/api/admin/places/archive/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-07-23 | 远端后台店铺归档验证 | Supabase `places.archived_at` | `admin-smoke-place` 归档返回 200、恢复返回 200、external 403、未登录 401；最终已恢复 |
| 2026-07-23 | 实现后台成员管理接口 | `src/app/api/admin/members/route.ts`、`src/server/teams/repository.ts`、`src/server/teams/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-07-23 | 远端后台成员管理验证 | Supabase `profiles`、`team_members` | `test_owner` 创建并绑定为 `what-to-eat` owner；`test_member_target` 创建为无小队用户；owner 添加/移除 target 返回 200，member 添加返回 403，未登录添加返回 401；target 最终已移除 |
| 2026-08-02 | 增强 seed 导入脚本 | `supabase/schema.sql`、`scripts/seed-supabase.mjs`、`package.json`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build` 通过 |
| 2026-08-02 | 验证远端 seed dry-run | Supabase `lists`、`places`、`list_places`、`ratings`、`import_batches` | `pnpm db:seed:dry-run` 通过；计划更新 2 个榜单、77 个店铺、77 个榜单关联、60 条评分，跳过 94 个空评分，不新增数据 |
| 2026-08-02 | 实现导入批次后台读取接口本地代码 | `supabase/schema.sql`、`src/app/api/admin/import-batches/route.ts`、`src/server/imports/repository.ts`、`src/server/imports/service.ts`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build` 通过；远端探测显示缺少 `import_batches.team_id` |
| 2026-08-02 | 远端导入批次后台读取验证 | Supabase `import_batches`、`places`、`list_places`、`ratings` | `GET /api/admin/import-batches?limit=5`：owner 返回 200，member 返回 403，未登录返回 401；历史 seed 批次可读取 |
| 2026-08-02 | 实现后台成员列表接口 | `src/app/api/admin/members/route.ts`、`src/server/teams/repository.ts`、`src/server/teams/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端后台成员列表验证 | Supabase `team_members`、`profiles` | `GET /api/admin/members`：owner 返回 200，member 返回 403，未登录返回 401；当前返回 3 个成员并包含 `test_owner` |
| 2026-08-02 | 实现后台已归档店铺列表接口 | `src/app/api/admin/places/archived/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端后台已归档店铺列表验证 | Supabase `places`、`list_places`、`lists` | 临时归档 `admin-smoke-place` 后，owner/member 读取返回 200，未登录返回 401，列表包含 `admin-smoke-place`；测试结束已恢复，`archived_at = null` |
| 2026-08-02 | 实现榜单内店铺管理视图接口 | `src/app/api/admin/lists/[slug]/places/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端榜单内店铺管理视图验证 | Supabase `lists`、`list_places`、`places`、`ratings` | `GET /api/admin/lists/red-list/places`：owner/member 返回 200，external 返回 403，未登录返回 401，不存在榜单返回 404；`red-list` 当前返回 75 个未归档店铺 |
| 2026-08-02 | 实现后台店铺评分明细接口 | `src/app/api/admin/places/[id]/ratings/route.ts`、`src/server/ratings/repository.ts`、`src/server/ratings/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端后台店铺评分明细验证 | Supabase `places`、`ratings`、`profiles` | `GET /api/admin/places/red-list-1/ratings`：owner/member 返回 200，external 返回 403，未登录返回 401，不存在店铺返回 404；当前返回 3 条评分 |
| 2026-08-02 | 实现当前用户登录态接口 | `src/app/api/auth/me/route.ts`、`src/server/auth/repository.ts`、`src/server/auth/service.ts`、`src/server/teams/repository.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端当前用户登录态验证 | Supabase `profiles`、`team_members`、`teams` | `GET /api/auth/me`：owner 返回 200 且包含 owner 角色，external 返回 200 且 memberships 为空，未登录返回 401 |
| 2026-08-02 | 实现 refresh token 换新接口 | `src/app/api/auth/refresh/route.ts`、`src/server/auth/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端 refresh token 换新验证 | Supabase Auth、`profiles` | `POST /api/auth/refresh`：有效 refresh token 返回 200 且返回新 token，非法 token 返回 401，缺少 token 返回 400 |
| 2026-08-02 | 实现后台榜单列表接口 | `src/app/api/admin/lists/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端后台榜单列表验证 | Supabase `teams`、`team_members`、`lists`、`places`、`ratings` | `GET /api/admin/lists`：owner/member 返回 200，external 返回 403，未登录返回 401，不存在小队返回 404；当前返回 3 个榜单并包含 `red-list` |
| 2026-08-02 | 补齐远端 seed 导入批次追踪 | Supabase `import_batches`、`places`、`list_places`、`ratings` | `pnpm db:seed` 创建批次 `2f6b5e12-f2aa-4440-997a-d538302b5372`；更新 77 个店铺、77 个榜单关联、60 条评分，跳过 94 个空评分，无新增数据，无归档数据 |
| 2026-08-02 | 验证导入批次后台可读 | `GET /api/admin/import-batches?limit=3` | 最新批次返回 200，计数为 `places:77`、`listPlaces:77`、`ratings:60` |
| 2026-08-02 | 实现榜单内店铺排序接口 | `src/app/api/admin/lists/[slug]/places/order/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端榜单内店铺排序验证 | Supabase `list_places` | 临时交换 `red-list` 前两个店铺后读取顺序生效，再恢复原顺序；owner/member 返回 200，external 返回 403，未登录返回 401，重复 id 返回 400 |
| 2026-08-02 | 实现后台店铺详情接口 | `src/app/api/admin/places/[id]/route.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、远端 API smoke test 通过 |
| 2026-08-02 | 远端后台店铺详情验证 | Supabase `places`、`list_places`、`lists`、`ratings` | `GET /api/admin/places/red-list-1`：owner/member 返回 200，external 返回 403，未登录返回 401，不存在店铺返回 404；响应包含 `teamId` 和所属榜单 |
| 2026-08-02 | 新增后台只读 smoke 脚本 | `scripts/smoke-admin-read.mjs`、`package.json`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`pnpm smoke:admin-read` 通过 |
| 2026-08-02 | 实现后台店铺列表查询接口 | `src/app/api/admin/places/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`scripts/smoke-admin-read.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`pnpm smoke:admin-read` 通过 |
| 2026-08-02 | 实现账号联系方式校验修改密码接口 | `supabase/schema.sql`、`src/app/api/auth/change-password/route.ts`、`src/server/auth/**`、`scripts/create-auth-user.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、远端 `pnpm smoke:change-password` 通过 |
| 2026-08-02 | 收紧测试账号命名规则 | `scripts/smoke-auth-ratings.mjs`、`scripts/smoke-admin-read.mjs`、`supabase/schema.sql` | 执行新 schema 后，历史测试账号会从 `test_user/test_external/test_owner/test_member_target` 迁移为 `testuser/testexternal/testowner/testmembertarget` |
| 2026-08-02 | 更新远端测试账号联系方式 | Supabase Auth、`profiles`、`team_members` | `testuser/testowner/testexternal` 已按新 username 规则更新，并写入 `contact_email/contact_phone` |
| 2026-08-02 | 远端修改密码闭环验证 | Supabase Auth、`profiles.contact_email` | `pnpm smoke:change-password` 通过：错误邮箱返回 `contact_mismatch`，正确邮箱可修改密码，旧密码失效，新密码可登录，最后恢复 `TestUser_2026` |
| 2026-08-02 | 实现当前用户评分读取和删除接口 | `src/app/api/ratings/route.ts`、`src/server/ratings/repository.ts`、`src/server/ratings/service.ts`、`scripts/smoke-auth-ratings.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、`pnpm smoke:auth-ratings` 通过 |
| 2026-08-02 | 接入店铺照片公开读取契约 | `src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `tsc --noEmit`、`next build`、`pnpm smoke:admin-read` 通过 |
| 2026-08-02 | 实现店铺照片上传和真删除接口 | `supabase/schema.sql`、`src/app/api/admin/places/[id]/photos/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、`pnpm smoke:admin-photos` 通过；远端 `place-photos` 公开 10MB，上传后已真删除 |
| 2026-08-02 | 新增店铺照片上传/真删除 smoke 脚本 | `scripts/smoke-admin-photos.mjs`、`package.json`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、远端 `pnpm smoke:admin-photos` 通过 |
| 2026-08-15 | 实现后台评分删除接口 | `src/app/api/admin/places/[id]/ratings/route.ts`、`src/server/ratings/repository.ts`、`src/server/ratings/service.ts`、`scripts/smoke-auth-ratings.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、`pnpm smoke:auth-ratings` 通过；owner 可删除指定评分，external 删除后台评分返回 403，测试评分已恢复 |
| 2026-08-15 | 新增后台写入 smoke 脚本 | `scripts/smoke-admin-write.mjs`、`package.json`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、远端 `pnpm smoke:admin-write` 通过；测试成员已移除，测试店铺已恢复未归档 |
| 2026-08-15 | 细化 viewer 角色后台内容只读权限 | `src/server/teams/repository.ts`、`src/server/places/service.ts`、`src/server/ratings/service.ts`、`scripts/smoke-admin-write.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`next build`、远端 `pnpm smoke:admin-write` 通过；`testexternal` 临时 viewer 已移除 |
| 2026-08-15 | 实现后台汇总计数接口 | `src/app/api/admin/summary/route.ts`、`src/server/places/repository.ts`、`src/server/places/service.ts`、`src/server/teams/repository.ts`、`scripts/smoke-admin-read.mjs`、`docs/backend/interfaces.md` | `node --check`、`tsc --noEmit`、`pnpm smoke:admin-read` 覆盖 owner/member 可读、external 禁止 |

## 当前数据库快照

| 表 | 当前数量 | 说明 |
| --- | ---: | --- |
| `teams` | 1 | 默认探店小队 |
| `lists` | 3+ | 红榜、再练练和后台接口 smoke 测试榜单 |
| `places` | 78+ | 初始店铺数据和后台接口 smoke 测试店 |
| `list_places` | 78+ | 店铺和榜单关联，包含后台接口 smoke 测试关联 |
| `ratings` | 60+ | 初始评分和测试评分 |
| `import_batches` | 2+ | 初始导入批次和最新 seed 追踪批次；schema 已支持 operation/status/summary/finished_at/rolled_back_at |
| `profiles` | 4+ | `testuser`、`testexternal`、`testowner`、`testmembertarget` 等测试账号 |
| `team_members` | 2+ | 默认小队成员和 `testowner` owner |

## 下一步

1. 后续 integration 接入后台首页统计时使用 `GET /api/admin/summary`。
2. 后续如需检查归档缺失项，运行 `pnpm db:seed -- --archive-missing --dry-run`。
3. 后续可以继续补后台运维能力，例如导入预检详情、批次差异审计和更细的成员角色策略。

## 记录规则

- 每完成一个后端任务，更新“任务进度表”的状态。
- 每次有可验证结果，追加到“完成记录”。
- 每次数据库结构变化，更新 RLS 或迁移说明。
- 每次新增或修改后端接口，同步更新 `docs/backend/interfaces.md`。
