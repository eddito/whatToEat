# 后端接口文档

## 文档状态

- 状态：进行中
- 分支：`codex/backend-dev`
- 维护规则：新增或修改后端服务、脚本、Route Handler、Server Action 时，同步更新本文档。

## 后端边界

| 层级 | 路径 | 责任 |
| --- | --- | --- |
| 数据库 | `supabase/schema.sql` | 表结构、枚举、RLS、触发器 |
| 数据访问层 | `src/server/**/repository.ts` | 封装 Supabase 查询，返回数据库记录 |
| 服务层 | `src/server/**/service.ts` | 输出前端/integration 可用的数据契约 |
| API | `src/app/api/**` | HTTP 入参校验、认证、响应 |
| 脚本 | `scripts/*.mjs` | seed、用户初始化、smoke 验证 |

页面和 UI 组件不在后端切片内改动。

## 认证模型

业务侧只使用 `username + password`，不做免密登录、magic link、OTP。

Supabase Auth 底层仍需要 email 或 phone 承载 password auth。后端创建用户脚本会自动生成内部占位 email：

```txt
<username>@users.what-to-eat-today.invalid
```

这个 email 是实现细节，不作为产品账号展示，也不写入 `public.profiles`。

Username 规则：

```txt
^[a-z][a-z0-9_]{2,31}$
```

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
| `places` | 店铺 | 基础信息、口味、评价、停车、来源、地图字段、`archived_at` |
| `list_places` | 榜单和店铺关联 | `list_id`、`place_id`、`sort_order` |
| `ratings` | 评分 | `source`、`rater_label`、`score`、`note` |

`profiles.email` 已从业务表移除。Supabase `auth.users.email` 仅由 Supabase Auth 内部使用。

## 服务层接口

### 公开浏览

路径：`src/server/places/service.ts`

| 函数 | 说明 |
| --- | --- |
| `getLists()` | 获取公开榜单列表，包含统计信息 |
| `getList(slug)` | 获取单个公开榜单和统计信息 |
| `getPlacesByList(slug)` | 获取某个公开榜单下的店铺 |
| `getPlace(id)` | 获取公开店铺详情，`id` 可以是 `places.import_key` 或 UUID |
| `getMapPlaces()` | 获取地图页需要的公开店铺数据 |
| `getListStats(slug)` | 获取公开榜单统计 |

### 店铺管理

路径：`src/server/places/service.ts`

| 函数 | 说明 |
| --- | --- |
| `upsertAdminPlace(input)` | owner/member 新增或编辑店铺，并维护榜单关联 |
| `archiveAdminPlace(input)` | owner/member 软归档或恢复店铺 |
| `upsertAdminList(input)` | owner/member 新增或编辑榜单 |

权限：调用用户必须是目标榜单所在小队的 `owner` 或 `member`。

## HTTP 接口

### `POST /api/auth/login`

路径：`src/app/api/auth/login/route.ts`

用途：使用业务账号 `username + password` 登录。

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
- `viewer`：不写 `team_member`；如榜单允许 `public_rate`，按 `external` 处理。
- 数据库 RLS 不直接开放客户端写入；写入由服务端验证 token 后使用 server admin client 完成。

请求体：

```ts
type UpsertRatingRequest = {
  placeId: string;
  score: number;
  note?: string | null;
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

### `POST /api/admin/places`

路径：`src/app/api/admin/places/route.ts`

用途：owner/member 新增或编辑店铺，并挂到指定榜单。

认证：

```txt
Authorization: Bearer <accessToken>
```

请求体：

```ts
type UpsertAdminPlaceRequest = {
  id?: string;
  listSlug: string;
  importKey?: string;
  name: string;
  category?: string | null;
  tasteTags?: string[];
  signatureDishes?: string | null;
  review?: string | null;
  region?: string | null;
  locationLabel?: string | null;
  parkingNote?: string | null;
  sourceLabel?: string | null;
  visited?: boolean;
  longitude?: number | null;
  latitude?: number | null;
};
```

说明：

- `id` 可传 `places.import_key` 或 UUID；存在时更新店铺。
- 新增店铺时如果不传 `importKey`，后端自动生成稳定 key。
- `listSlug` 必须对应已存在榜单。
- 调用用户必须是该榜单所在小队的 `owner` 或 `member`。

成功响应：

```ts
type UpsertAdminPlaceResponse = {
  ok: true;
  place: PublicPlace;
};
```

错误响应：

| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或字段不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner/member |
| 403 | `place_team_mismatch` | 店铺不属于目标榜单所在小队 |
| 404 | `list_not_found` | 榜单不存在 |
| 404 | `place_not_found` | 指定店铺不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `POST /api/admin/lists`

路径：`src/app/api/admin/lists/route.ts`

用途：owner/member 新增或编辑榜单。

认证：

```txt
Authorization: Bearer <accessToken>
```

请求体：

```ts
type UpsertAdminListRequest = {
  slug: string;
  name: string;
  description?: string | null;
  visibility: "private" | "public_view" | "public_rate";
  teamSlug?: string;
};
```

说明：

- `slug` 已存在时更新现有榜单。
- `slug` 不存在时按 `teamSlug` 找小队创建榜单，`teamSlug` 默认 `what-to-eat`。
- 调用用户必须是目标小队的 `owner` 或 `member`。

成功响应：

```ts
type UpsertAdminListResponse = {
  ok: true;
  list: PublicList;
};
```

错误响应：

| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或字段不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner/member |
| 404 | `team_not_found` | 创建榜单时目标小队不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `POST /api/admin/places/archive`

路径：`src/app/api/admin/places/archive/route.ts`

用途：owner/member 软归档或恢复店铺。

认证：

```txt
Authorization: Bearer <accessToken>
```

请求体：

```ts
type ArchiveAdminPlaceRequest = {
  id: string;
  archived?: boolean;
};
```

说明：

- `id` 可传 `places.import_key` 或 UUID。
- `archived` 默认为 `true`。
- 归档会设置 `places.archived_at`；恢复会置空。
- 公开读取会过滤已归档店铺。

成功响应：

```ts
type ArchiveAdminPlaceResponse = {
  ok: true;
  place: {
    id: string;
    archivedAt: string | null;
  };
};
```

错误响应：

| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或字段不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner/member |
| 404 | `place_not_found` | 指定店铺不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

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
| `--no-team` | 否 | 创建外部测试用户，不绑定小队 |

输出不会打印密码。

### `pnpm smoke:auth-ratings`

路径：`scripts/smoke-auth-ratings.mjs`

用途：验证后端登录和评分权限闭环。该脚本会写入/更新远端 Supabase 测试评分。
