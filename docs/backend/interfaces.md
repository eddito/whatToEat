# 后端接口文档

## 文档状态

- 状态：进行中
- 分支：`codex/backend-dev`
- 当前切片：公开浏览数据读取 + username 业务身份模型
- 维护规则：新增或修改后端服务、脚本、Route Handler、Server Action 时，同步更新本文档。

## 后端边界

| 层级 | 路径 | 责任 |
| --- | --- | --- |
| 数据库 | `supabase/schema.sql` | 表结构、枚举、RLS、触发器 |
| 数据访问层 | `src/server/**/repository.ts` | 封装 Supabase 查询，返回数据库记录 |
| 服务层 | `src/server/**/service.ts` | 输出前端/integration 可用的数据契约 |
| 脚本 | `scripts/*.mjs` | seed、用户初始化等可重复任务 |

页面和 UI 组件不在本后端切片内改动。

## 认证模型

业务侧只使用 `username + password`。

Supabase Auth 底层仍需要一个 email 或 phone 承载 password auth。后端创建用户脚本会自动生成内部占位 email：

```txt
<username>@users.what-to-eat-today.invalid
```

这个 email 是实现细节，不作为产品账号展示，也不写入 `public.profiles`。

### Username 规则

```txt
^[a-z][a-z0-9_]{2,31}$
```

- 3 到 32 位。
- 必须以小写字母开头。
- 只允许小写字母、数字、下划线。
- 不要求是邮箱。
- 按大小写不敏感的唯一索引约束。

## 环境变量

| 变量 | 端 | 必填 | 说明 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | server/client | 是 | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | 是 | 浏览器端公开 key，后续 Auth/RLS 验证使用 |
| `SUPABASE_SECRET_KEY` | server only | 是 | 服务端 admin client 和脚本使用，不暴露到客户端 |
| `NEXT_PUBLIC_APP_URL` | server/client | 是 | 本地或线上应用地址 |
| `NEXT_PUBLIC_MAP_PROVIDER` | client | 是 | 当前为 `amap` |
| `NEXT_PUBLIC_AMAP_KEY` | client | 是 | 高德地图 key |

## 数据库契约

| 表 | 用途 | 当前字段 |
| --- | --- | --- |
| `profiles` | 业务用户资料 | `id`、`username`、`display_name`、`avatar_url`、`created_at` |
| `teams` | 小队空间 | `id`、`slug`、`name`、`description` |
| `team_members` | 成员和角色 | `team_id`、`user_id`、`role` |
| `lists` | 榜单 | `slug`、`name`、`description`、`visibility` |
| `places` | 店铺 | 基础信息、口味、评价、停车、来源、地图字段 |
| `list_places` | 榜单和店铺关联 | `list_id`、`place_id`、`sort_order` |
| `ratings` | 评分 | `source`、`rater_label`、`score`、`note` |

`profiles.email` 已从业务表移除。Supabase `auth.users.email` 仍由 Supabase Auth 内部使用。

## RLS 最小闭环

当前公开浏览切片只开放读取，不开放写入。

| 资源 | 未登录用户权限 |
| --- | --- |
| `lists` | 可 `select visibility in ('public_view', 'public_rate')` 的榜单 |
| `places` | 可 `select` 挂在公开榜单下的店铺 |
| `list_places` | 可 `select` 公开榜单的关联记录 |
| `ratings` | 可 `select` 公开店铺的评分，用于统计展示 |
| `photos` | 可 `select` 公开店铺图片 |

私密榜单、写入、成员管理、后台管理策略留到后续切片。

## 公开浏览服务层接口

路径：`src/server/places/service.ts`

| 函数 | 说明 |
| --- | --- |
| `getLists()` | 获取公开榜单列表，包含统计信息 |
| `getList(slug)` | 获取单个公开榜单和统计信息 |
| `getPlacesByList(slug)` | 获取某个公开榜单下的店铺 |
| `getPlace(id)` | 获取公开店铺详情，`id` 可以是 `places.import_key` 或 UUID |
| `getMapPlaces()` | 获取地图页需要的公开店铺数据 |
| `getListStats(slug)` | 获取公开榜单统计 |

## 数据访问层接口

路径：`src/server/places/repository.ts`

| 函数 | 说明 |
| --- | --- |
| `getPublicLists()` | 查询公开榜单原始记录 |
| `getPublicListBySlug(slug)` | 按 slug 查询公开榜单 |
| `getPlacesForPublicListId(listId)` | 查询公开榜单下的店铺关联和店铺记录 |
| `getPublicPlaceByStableId(id)` | 按 `import_key` 或 UUID 查询店铺 |
| `getPublicListsForPlace(placeId)` | 查询某店铺所属的公开榜单 |
| `getRatingsForPlaces(placeIds)` | 批量读取评分记录 |

## 脚本接口

### `pnpm db:seed`

路径：`scripts/seed-supabase.mjs`

用途：创建默认小队、公开榜单、导入初始店铺、榜单关联和已有评分。

### `pnpm auth:create-user`

路径：`scripts/create-auth-user.mjs`

用途：用 `username + password` 创建或更新业务用户。

示例：

```powershell
pnpm auth:create-user -- --username yang --password "<password>" --display-name "Yang" --role owner
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--username` | 是 | 业务账号，必须符合 username 规则 |
| `--password` | 是 | 密码，至少 8 位 |
| `--display-name` | 否 | 展示名，默认等于 username |
| `--role` | 否 | `owner`、`member`、`viewer`，默认 `member` |
| `--team-slug` | 否 | 默认 `what-to-eat` |

输出不会打印密码。

## HTTP 接口

### `POST /api/auth/login`

路径：`src/app/api/auth/login/route.ts`

用途：使用业务账号 `username + password` 登录。

说明：
- 不支持免密登录、magic link、OTP。
- `username` 不要求是邮箱。
- 服务端内部会把 username 映射到占位 email，再调用 Supabase password auth。
- 响应返回 Supabase session token，后续需要登录态的接口使用 `Authorization: Bearer <accessToken>`。

请求体：

```ts
type LoginRequest = {
  username: string;
  password: string;
};
```

成功响应：

```ts
type LoginResponse = {
  ok: true;
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
    tokenType: string;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
};
```

错误响应：

| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或缺少 username/password |
| 401 | `invalid_username` | username 格式不合法 |
| 401 | `profile_not_found` | 账号不存在 |
| 401 | `invalid_credentials` | 密码错误或 Supabase Auth 登录失败 |
| 500 | `internal_error` | 未预期服务端错误 |

测试账号：

```txt
username: test_user
password: TestUser_2026
role: member
```

### `POST /api/ratings`

路径：`src/app/api/ratings/route.ts`

用途：登录用户给公开店铺评分。

认证：

```txt
Authorization: Bearer <accessToken>
```

权限规则：
- `owner` / `member`：写入 `team_member` 评分。
- 非成员登录用户：仅当店铺所在榜单包含 `public_rate` 时写入 `external` 评分。
- `viewer`：不写 `team_member`，如榜单允许 `public_rate`，按 `external` 处理。
- 数据库 RLS 仍不直接开放客户端写入；写入由服务端验证 token 后使用 server admin client 完成。

请求体：

```ts
type UpsertRatingRequest = {
  placeId: string;
  score: number;
  note?: string | null;
};
```

成功响应：

```ts
type UpsertRatingResponse = {
  ok: true;
  rating: {
    id: string;
    source: "team_member" | "external";
    score: number;
    note: string | null;
    updated_at: string;
  };
  source: "team_member" | "external";
  role: "owner" | "member" | "viewer" | null;
};
```

错误响应：

| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或 `placeId/score/note` 不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `place_not_public` | 店铺不在公开榜单中 |
| 403 | `rating_not_allowed` | 当前用户无权评分 |
| 404 | `place_not_found` | 店铺不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

幂等性：
- 同一用户对同一店铺、同一评分来源再次提交时更新原评分。
