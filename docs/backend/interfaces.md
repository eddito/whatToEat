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
^[a-z][a-z0-9]{2,31}$
```
改为只允许小写英文字母和数字：账号名必须以小写英文字母开头，不允许下划线、中文或其他特殊字符。

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
| `profiles` | 业务用户资料 | `id`、`username`、`display_name`、`avatar_url`、`contact_email`、`contact_phone`、`created_at` |
| `teams` | 小队空间 | `id`、`slug`、`name`、`description` |
| `team_members` | 成员和角色 | `team_id`、`user_id`、`role` |
| `lists` | 榜单 | `slug`、`name`、`description`、`visibility` |
| `places` | 店铺 | 基础信息、口味、评价、停车、来源、地图字段、`archived_at` |
| `list_places` | 榜单和店铺关联 | `list_id`、`place_id`、`sort_order` |
| `ratings` | 评分 | `source`、`rater_label`、`score`、`note` |
| `photos` | 店铺图片 | `place_id`、`url`、`storage_path`、`is_cover`、`sort_order` |
| `import_batches` | 导入批次 | `team_id`、`source_name`、`operation`、`status`、`summary`、`finished_at`、`rolled_back_at` |

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

`PublicPlace` 通用照片字段：
```ts
type PublicPlacePhotoFields = {
  coverPhotoUrl?: string;
  photoCount: number;
};
```

### 店铺管理

路径：`src/server/places/service.ts`

| 函数 | 说明 |
| --- | --- |
| `upsertAdminPlace(input)` | owner/member 新增或编辑店铺，并维护榜单关联 |
| `archiveAdminPlace(input)` | owner/member 软归档或恢复店铺 |
| `getAdminPlaces(input)` | owner/member/viewer 按团队读取后台店铺列表，支持关键词/分类/区域/归档筛选 |
| `getAdminSummary(input)` | owner/member/viewer 读取后台汇总计数 |
| `getAdminArchivedPlaces(input)` | owner/member/viewer 读取已归档店铺列表 |
| `getAdminPlace(input)` | owner/member/viewer 读取店铺后台详情 |
| `getAdminPlacesByList(input)` | owner/member/viewer 读取榜单内店铺管理视图 |
| `getAdminLists(input)` | owner/member/viewer 读取后台榜单列表，包含 private 榜单 |
| `reorderAdminListPlaces(input)` | owner/member 调整榜单内店铺排序 |
| `upsertAdminList(input)` | owner/member 新增或编辑榜单 |

权限：后台内容读取允许目标小队 `owner`、`member`、`viewer`；后台内容写入、归档、排序和图片管理要求 `owner` 或 `member`。

### 成员管理

路径：`src/server/teams/service.ts`

| 函数 | 说明 |
| --- | --- |
| `getAdminMembers(input)` | owner 读取小队成员列表 |
| `upsertAdminMember(input)` | owner 添加成员或修改成员角色 |
| `removeAdminMember(input)` | owner 移除成员 |

权限：调用用户必须是目标小队的 `owner`。为避免误操作，owner 不能移除自己，也不能把自己的角色改成非 owner。

### 导入批次

路径：`src/server/imports/service.ts`

| 函数 | 说明 |
| --- | --- |
| `getAdminImportPlan(input)` | owner 读取 seed 导入预检 dry-run 计划 |
| `getAdminImportBatches(input)` | owner 读取导入批次列表和关联数据计数 |
| `getAdminImportBatch(input)` | owner 读取单个导入批次详情、关联数据计数和审计预览 |
| `getAdminImportBatchRollbackPlan(input)` | owner 读取单个导入批次的只读回滚计划 |
| `rollbackAdminImportBatch(input)` | owner 显式确认后回滚单个导入批次 |

权限：调用用户必须是目标小队的 `owner`。

### 评分管理

路径：`src/server/ratings/service.ts`

| 函数 | 说明 |
| --- | --- |
| `getAdminPlaceRatings(input)` | owner/member/viewer 读取店铺评分明细 |

权限：评分明细读取允许目标小队 `owner`、`member`、`viewer`；删除评分要求 `owner` 或 `member`。

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

### `POST /api/auth/change-password`

路径：`src/app/api/auth/change-password/route.ts`

用途：通过业务账号和已绑定的邮箱或手机号校验身份，校验通过后修改账号密码。该接口不使用免密登录、magic link 或 OTP。

请求体：

```ts
type ChangePasswordRequest = {
  username: string;
  contact: string;
  newPassword: string;
};
```

说明：
- `username` 必须符合账号规则：首位小写英文字母，后续仅允许小写英文字母或数字，3-32 位。
- `contact` 可以是邮箱或手机号，必须匹配 `profiles.contact_email` 或 `profiles.contact_phone`。
- `newPassword` 至少 8 位。

成功响应：
```ts
type ChangePasswordResponse = {
  ok: true;
  user: {
    username: string;
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或缺少 username/contact/newPassword |
| 400 | `contact_mismatch` | contact 不是合法邮箱/手机号，或与账号不匹配 |
| 400 | `weak_password` | 新密码少于 8 位 |
| 401 | `invalid_username` | username 格式不合法 |
| 401 | `profile_not_found` | username 不存在 |
| 401 | `contact_not_configured` | 账号未绑定可校验的邮箱或手机号 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/auth/me`

路径：`src/app/api/auth/me/route.ts`

用途：读取当前登录用户资料和小队角色，用于前端恢复登录态和判断后台权限。

认证：
```txt
Authorization: Bearer <accessToken>
```

成功响应：
```ts
type CurrentUserResponse = {
  ok: true;
  session: {
    user: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    };
    memberships: Array<{
      role: "owner" | "member" | "viewer";
      team: {
        id: string;
        slug: string | null;
        name: string;
        description: string | null;
      };
    }>;
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 404 | `profile_not_found` | Auth 用户缺少业务 profile |
| 500 | `internal_error` | 未预期服务端错误 |

### `POST /api/auth/refresh`

路径：`src/app/api/auth/refresh/route.ts`

用途：使用 refresh token 换取新的 access token 和 refresh token。

请求体：
```ts
type RefreshRequest = {
  refreshToken: string;
};
```

成功响应：
```ts
type RefreshResponse = {
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
| 400 | `invalid_request` | 请求体不是 JSON，或缺少 refreshToken |
| 401 | `invalid_credentials` | refresh token 无效或已过期 |
| 401 | `profile_not_found` | Auth 用户缺少业务 profile |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/ratings`

路径：`src/app/api/ratings/route.ts`

用途：读取当前登录用户对某家公开店铺的自己的评分。会自动按团队成员身份返回 `team_member` 评分，否则在 `public_rate` 榜单下返回 `external` 评分。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `placeId` | 是 | 店铺 `places.import_key` 或 UUID |

成功响应：
```ts
type GetMyRatingResponse = {
  ok: true;
  rating: {
    id: string;
    source: "team_member" | "external";
    score: number;
    note: string | null;
    updated_at: string;
  } | null;
  source: "team_member" | "external";
  role: "owner" | "member" | "viewer" | null;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 缺少或无效 `placeId` |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `place_not_public` | 店铺不在公开榜单中 |
| 403 | `rating_not_allowed` | 当前用户无权读取自己的评分上下文 |
| 404 | `place_not_found` | 店铺不存在 |
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

### `DELETE /api/ratings`

路径：`src/app/api/ratings/route.ts`

用途：删除当前登录用户对某家公开店铺的自己的评分。没有已保存评分时也返回 200，`deleted` 为 `false`。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `placeId` | 是 | 店铺 `places.import_key` 或 UUID |

成功响应：
```ts
type DeleteMyRatingResponse = {
  ok: true;
  rating: {
    id: string;
    source: "team_member" | "external";
    score: number;
    note: string | null;
    updated_at: string;
  } | null;
  deleted: boolean;
  source: "team_member" | "external";
  role: "owner" | "member" | "viewer" | null;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 缺少或无效 `placeId` |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `place_not_public` | 店铺不在公开榜单中 |
| 403 | `rating_not_allowed` | 当前用户无权删除该评分上下文 |
| 404 | `place_not_found` | 店铺不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/summary`

路径：`src/app/api/admin/summary/route.ts`

用途：owner/member/viewer 读取后台首页或管理入口需要的小队汇总计数。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |

成功响应：
```ts
type GetAdminSummaryResponse = {
  ok: true;
  summary: {
    team: {
      id: string;
      slug: string;
      name: string;
      role: "owner" | "member" | "viewer";
    };
    counts: {
      lists: number;
      activePlaces: number;
      archivedPlaces: number;
      ratings: number;
      members: number;
    };
    generatedAt: string;
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner/member/viewer |
| 404 | `team_not_found` | 目标小队不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/places`

路径：`src/app/api/admin/places/route.ts`

用途：owner/member/viewer 按小队读取后台店铺列表，供后台店铺管理、选店和搜索使用。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |
| `query` | 否 | 关键词，匹配店铺 `id/import_key/name/category/region/location/taste_tags` 等字段 |
| `category` | 否 | 精确匹配店铺分类 |
| `region` | 否 | 精确匹配区域 |
| `includeArchived` | 否 | 是否包含已归档店铺，仅支持 `true`/`false`，默认 `false` |
| `limit` | 否 | 返回数量，1-200，默认 50 |

成功响应：
```ts
type GetAdminPlacesResponse = {
  ok: true;
  places: Array<PublicPlace & {
    teamId: string;
    listSlugs: string[];
    listNames: string[];
    archivedAt: string | null;
  }>;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner/member/viewer |
| 404 | `team_not_found` | 目标小队不存在 |
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

### `GET /api/admin/lists`

路径：`src/app/api/admin/lists/route.ts`

用途：owner/member/viewer 读取小队全部榜单列表，包含 private/public_view/public_rate，并附带未归档店铺统计。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |

成功响应：
```ts
type GetAdminListsResponse = {
  ok: true;
  lists: Array<PublicList & {
    teamSlug: string;
  }>;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner/member/viewer |
| 404 | `team_not_found` | 目标小队不存在 |
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

### `GET /api/admin/members`

路径：`src/app/api/admin/members/route.ts`

用途：owner 读取小队成员列表。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |

成功响应：
```ts
type GetAdminMembersResponse = {
  ok: true;
  members: Array<{
    username: string;
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: "owner" | "member" | "viewer";
    joinedAt: string;
  }>;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 404 | `team_not_found` | 目标小队不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `POST /api/admin/members`

路径：`src/app/api/admin/members/route.ts`

用途：owner 添加小队成员或修改成员角色。

认证：
```txt
Authorization: Bearer <accessToken>
```

请求体：

```ts
type UpsertAdminMemberRequest = {
  username?: string;
  account?: string;
  role: "owner" | "member" | "viewer";
  teamSlug?: string;
};
```

说明：
- `username` 必须已存在于 `profiles`；前端后台也可传 `account`，支持邮箱、手机号，或 3-32 位小写字母/数字用户名。
- 用户名不能包含中文或其它特殊字符。
- `teamSlug` 默认 `what-to-eat`。
- 调用用户必须是目标小队 `owner`。
- owner 不能把自己的角色改成非 owner。

成功响应：
```ts
type UpsertAdminMemberResponse = {
  ok: true;
  member: {
    username: string;
    userId: string;
    role: "owner" | "member" | "viewer";
    teamSlug: string;
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或字段不合法 |
| 400 | `invalid_username` | username 格式不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 403 | `self_role_change_not_allowed` | owner 试图把自己的角色改成非 owner |
| 404 | `team_not_found` | 目标小队不存在 |
| 404 | `profile_not_found` | 目标 username 不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `DELETE /api/admin/members`

路径：`src/app/api/admin/members/route.ts`

用途：owner 移除小队成员。

认证：
```txt
Authorization: Bearer <accessToken>
```

请求体：

```ts
type RemoveAdminMemberRequest = {
  username: string;
  teamSlug?: string;
};
```

说明：
- `teamSlug` 默认 `what-to-eat`。
- 调用用户必须是目标小队 `owner`。
- owner 不能移除自己。

成功响应：
```ts
type RemoveAdminMemberResponse = {
  ok: true;
  member: {
    username: string;
    userId: string;
    role: null;
    teamSlug: string;
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或字段不合法 |
| 400 | `invalid_username` | username 格式不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 403 | `self_remove_not_allowed` | owner 试图移除自己 |
| 404 | `team_not_found` | 目标小队不存在 |
| 404 | `profile_not_found` | 目标 username 不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/import-plan`

路径：`src/app/api/admin/import-plan/route.ts`

用途：owner 读取 seed 导入前的只读 dry-run 预检计划，用于确认导入会创建、更新、跳过或归档多少数据。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |
| `sourceName` | 否 | 计划来源名，默认 `seed-places.json` |
| `archiveMissing` | 否 | 是否计算缺失项软归档影响，仅支持 `true/false`，默认 `false` |

成功响应：
```ts
type GetAdminImportPlanResponse = {
  ok: true;
  importPlan: {
    dryRun: true;
    sourceName: string;
    teamSlug: string;
    archiveMissing: boolean;
    summary: {
      listsCreated: number;
      listsUpdated: number;
      placesCreated: number;
      placesUpdated: number;
      listLinksCreated: number;
      listLinksUpdated: number;
      ratingsCreated: number;
      ratingsUpdated: number;
      ratingsSkipped: number;
      placesArchivedMissing: number;
    };
    counts: {
      seedPlaces: number;
      seedLists: number;
      importedRatings: number;
    };
  };
};
```

说明：
- 该接口不创建 `import_batches`，不写入任何表。
- 计划基于当前 `src/data/seed-places.json` 和默认导入榜单配置计算。
- `archiveMissing=true` 只计算会被软归档的缺失店铺数量，不执行归档。

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 404 | `team_not_found` | 目标小队不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/import-batches`

路径：`src/app/api/admin/import-batches/route.ts`

用途：owner 读取导入批次列表，用于后台查看 seed/import 历史和选择回滚目标批次。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |
| `limit` | 否 | 返回条数，范围 1-100，默认 20 |
| `includeLegacy` | 否 | 是否包含旧版无 `team_id` 批次，默认 `true` |

成功响应：
```ts
type GetAdminImportBatchesResponse = {
  ok: true;
  importBatches: Array<{
    id: string;
    teamId: string | null;
    sourceName: string;
    operation: string;
    status: string;
    summary: Record<string, unknown>;
    counts: {
      places: number;
      listPlaces: number;
      ratings: number;
    };
    createdAt: string;
    finishedAt: string | null;
    rolledBackAt: string | null;
  }>;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 404 | `team_not_found` | 目标小队不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/import-batches/[id]`

路径：`src/app/api/admin/import-batches/[id]/route.ts`

用途：owner 读取单个导入批次详情，用于后台审计 seed/import 影响范围。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `id` | `import_batches.id` |

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |
| `previewLimit` | 否 | 每类预览数量，范围 1-50，默认 20 |

成功响应：
```ts
type GetAdminImportBatchResponse = {
  ok: true;
  importBatch: {
    id: string;
    teamId: string | null;
    sourceName: string;
    operation: string;
    status: string;
    summary: Record<string, unknown>;
    counts: {
      places: number;
      listPlaces: number;
      ratings: number;
    };
    createdAt: string;
    finishedAt: string | null;
    rolledBackAt: string | null;
    preview: {
      places: Array<{
        id: string;
        importKey: string | null;
        name: string;
        category: string | null;
        region: string | null;
        archivedAt: string | null;
      }>;
      listPlaces: Array<{
        listId: string;
        placeId: string;
        listSlug: string | null;
        listName: string | null;
        placeImportKey: string | null;
        placeName: string | null;
        sortOrder: number;
      }>;
      ratings: Array<{
        id: string;
        placeId: string;
        placeImportKey: string | null;
        placeName: string | null;
        source: string;
        raterLabel: string | null;
        score: number;
      }>;
    };
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | path 或 query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 404 | `team_not_found` | 目标小队不存在 |
| 404 | `batch_not_found` | 批次不存在，或批次属于其他小队 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/import-batches/[id]/rollback-plan`

路径：`src/app/api/admin/import-batches/[id]/rollback-plan/route.ts`

用途：owner 在真正执行回滚前读取只读 dry-run 计划，确认会被删除或归档的数据范围。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `id` | `import_batches.id` |

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |

成功响应：
```ts
type GetAdminImportBatchRollbackPlanResponse = {
  ok: true;
  rollbackPlan: {
    batch: {
      id: string;
      teamId: string | null;
      sourceName: string;
      operation: string;
      status: string;
      summary: Record<string, unknown>;
      counts: {
        places: number;
        listPlaces: number;
        ratings: number;
      };
      createdAt: string;
      finishedAt: string | null;
      rolledBackAt: string | null;
    };
    dryRun: true;
    impact: {
      ratingsToDelete: number;
      listPlacesToDelete: number;
      placesToArchive: number;
    };
    warnings: string[];
  };
};
```

说明：
- 该接口不执行任何写入。
- 回滚计划与 `scripts/seed-supabase.mjs --rollback-batch <id> --dry-run` 的操作语义保持一致：删除该批次评分和榜单关联，软归档该批次店铺。
- 回滚不会恢复被导入覆盖前的旧字段值。

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | path 或 query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 404 | `team_not_found` | 目标小队不存在 |
| 404 | `batch_not_found` | 批次不存在，或批次属于其他小队 |
| 500 | `internal_error` | 未预期服务端错误 |

### `POST /api/admin/import-batches/[id]/rollback`

路径：`src/app/api/admin/import-batches/[id]/rollback/route.ts`

用途：owner 显式确认后执行导入批次回滚。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `id` | `import_batches.id` |

请求体：
```ts
type RollbackAdminImportBatchRequest = {
  confirm: true;
  teamSlug?: string;
};
```

说明：
- `confirm` 必须严格为 `true`，否则返回 400 且不执行写入。
- 仅目标小队 `owner` 可执行。
- 执行语义与回滚计划一致：删除该批次评分和榜单关联，软归档该批次未归档店铺。
- 执行后会更新 `import_batches.status = "rolled_back"`、`rolled_back_at` 和 `summary.rollback`。
- 该操作不会恢复导入覆盖前的旧字段值。

成功响应：
```ts
type RollbackAdminImportBatchResponse = {
  ok: true;
  rollback: {
    batchId: string;
    status: "rolled_back";
    rolledBackAt: string;
    summary: {
      ratingsDeleted: number;
      listLinksDeleted: number;
      placesArchived: number;
    };
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或缺少 `confirm: true` |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner |
| 404 | `team_not_found` | 目标小队不存在 |
| 404 | `batch_not_found` | 批次不存在，或批次属于其他小队 |
| 409 | `batch_already_rolled_back` | 批次已经回滚 |
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

### `GET /api/admin/places/[id]`

路径：`src/app/api/admin/places/[id]/route.ts`

用途：owner/member/viewer 读取店铺后台详情，包含基础字段、归档状态、所属榜单和团队评分汇总。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `id` | 店铺 `places.import_key` 或 UUID |

成功响应：
```ts
type GetAdminPlaceResponse = {
  ok: true;
  place: PublicPlace & {
    teamId: string;
    archivedAt: string | null;
    photos: Array<{
      id: string;
      url: string;
      isCover: boolean;
      sortOrder: number;
    }>;
    lists: Array<{
      slug: string;
      name: string;
      visibility: "private" | "public_view" | "public_rate";
    }>;
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标店铺所在小队 owner/member/viewer |
| 404 | `place_not_found` | 店铺不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/places/archived`

路径：`src/app/api/admin/places/archived/route.ts`

用途：owner/member/viewer 读取已归档店铺列表，用于后台恢复或检查归档数据。

认证：
```txt
Authorization: Bearer <accessToken>
```

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `teamSlug` | 否 | 目标小队，默认 `what-to-eat` |
| `limit` | 否 | 返回条数，范围 1-200，默认 50 |

成功响应：
```ts
type GetAdminArchivedPlacesResponse = {
  ok: true;
  places: Array<{
    id: string;
    name: string;
    category: string;
    region: string;
    locationLabel: string;
    listSlugs: string[];
    listNames: string[];
    archivedAt: string;
  }>;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标小队 owner/member/viewer |
| 404 | `team_not_found` | 目标小队不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `POST /api/admin/places/[id]/photos`

路径：`src/app/api/admin/places/[id]/photos/route.ts`

用途：owner/member 给店铺上传图片到公开 Storage bucket `place-photos`，单张最大 10MB，支持 jpeg/png/webp/gif。

认证：
```txt
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

FormData：
| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `file` | 是 | 图片文件，最大 10MB |
| `isCover` | 否 | `true/false`，设为封面时会清除同店铺其它封面 |
| `sortOrder` | 否 | 0-10000 的整数 |

成功响应：
```ts
type UploadAdminPlacePhotoResponse = {
  ok: true;
  photo: {
    id: string;
    url: string;
    isCover: boolean;
    sortOrder: number;
  };
};
```

### `PATCH /api/admin/places/[id]/photos`

用途：owner/member 修改店铺图片封面状态或排序。

请求体：
```ts
type UpdateAdminPlacePhotoRequest = {
  photoId: string;
  isCover?: boolean;
  sortOrder?: number;
};
```

成功响应：
```ts
type UpdateAdminPlacePhotoResponse = UploadAdminPlacePhotoResponse;
```

### `DELETE /api/admin/places/[id]/photos`

用途：owner/member 删除店铺图片。删除时会先真实删除 `place-photos` 里的 Storage object，再删除 `photos` 记录。

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `photoId` | 是 | `photos.id` |

成功响应：
```ts
type DeleteAdminPlacePhotoResponse = {
  ok: true;
  photo: {
    id: string;
    url: string;
    isCover: boolean;
    sortOrder: number;
  } | null;
  deleted: boolean;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体、form-data 或 photoId 不合法 |
| 400 | `invalid_file` | 文件为空或不是允许的图片类型 |
| 400 | `file_too_large` | 文件超过 10MB |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标店铺所在小队 owner/member |
| 404 | `place_not_found` | 店铺不存在 |
| 404 | `photo_not_found` | 图片不存在或不属于目标店铺 |
| 502 | `storage_error` | Supabase Storage 上传或删除失败 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/places/[id]/ratings`

路径：`src/app/api/admin/places/[id]/ratings/route.ts`

用途：owner/member/viewer 读取店铺评分明细，用于后台查看团队评分、外部评分和备注。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `id` | 店铺 `places.import_key` 或 UUID |

成功响应：
```ts
type GetAdminPlaceRatingsResponse = {
  ok: true;
  ratings: Array<{
    id: string;
    userId: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    source: "team_member" | "external";
    raterLabel: string | null;
    score: number;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `rating_not_allowed` | 当前用户不是目标店铺所在小队 owner/member/viewer |
| 404 | `place_not_found` | 店铺不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `DELETE /api/admin/places/[id]/ratings`

路径：`src/app/api/admin/places/[id]/ratings/route.ts`

用途：owner/member 删除店铺下的某条评分，用于后台清理误评分或无效外部评分。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `id` | 店铺 `places.import_key` 或 UUID |

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `ratingId` | 是 | `ratings.id` |

成功响应：
```ts
type DeleteAdminPlaceRatingResponse = {
  ok: true;
  rating: {
    id: string;
    userId: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    source: "team_member" | "external";
    raterLabel: string | null;
    score: number;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  };
  deleted: true;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 缺少合法 `ratingId` |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `rating_not_allowed` | 当前用户不是目标店铺所在小队 owner/member |
| 404 | `place_not_found` | 店铺不存在 |
| 404 | `rating_not_found` | 评分不存在或不属于目标店铺 |
| 500 | `internal_error` | 未预期服务端错误 |

### `GET /api/admin/lists/[slug]/places`

路径：`src/app/api/admin/lists/[slug]/places/route.ts`

用途：owner/member/viewer 读取某个榜单下的店铺管理视图，用于后台表格、编辑入口和排序展示。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `slug` | 榜单 slug |

Query 参数：
| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `includeArchived` | 否 | 是否包含已归档店铺，默认 `false` |

成功响应：
```ts
type GetAdminListPlacesResponse = {
  ok: true;
  places: Array<PublicPlace & {
    sortOrder: number;
    archivedAt: string | null;
  }>;
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | query 参数不合法 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标榜单所在小队 owner/member/viewer |
| 404 | `list_not_found` | 榜单不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

### `POST /api/admin/lists/[slug]/places/order`

路径：`src/app/api/admin/lists/[slug]/places/order/route.ts`

用途：owner/member 调整某个榜单内已有店铺的排序。该接口只更新 `list_places.sort_order`，不会新增榜单关联。

认证：
```txt
Authorization: Bearer <accessToken>
```

Path 参数：
| 参数 | 说明 |
| --- | --- |
| `slug` | 榜单 slug |

请求体：
```ts
type ReorderAdminListPlacesRequest = {
  placeIds: string[];
};
```

说明：
- `placeIds` 按目标展示顺序传入。
- 每个 id 可为 `places.import_key` 或 UUID。
- 所有店铺必须已经属于目标榜单。

成功响应：
```ts
type ReorderAdminListPlacesResponse = {
  ok: true;
  result: {
    listSlug: string;
    updated: number;
  };
};
```

错误响应：
| HTTP | `error` | 场景 |
| ---: | --- | --- |
| 400 | `invalid_request` | 请求体不是 JSON，或字段不合法 |
| 400 | `duplicate_place_id` | `placeIds` 内有重复 id |
| 400 | `place_not_in_list` | 店铺不存在、跨小队，或不属于目标榜单 |
| 401 | `unauthorized` | 缺少或无效 bearer token |
| 403 | `not_allowed` | 当前用户不是目标榜单所在小队 owner/member |
| 404 | `list_not_found` | 榜单不存在 |
| 500 | `internal_error` | 未预期服务端错误 |

## 脚本接口

### `pnpm db:seed`

路径：`scripts/seed-supabase.mjs`

用途：创建默认小队、公开榜单、增量导入初始店铺、榜单关联和已有评分。

常用命令：
```powershell
pnpm db:seed
pnpm db:seed:dry-run
pnpm db:seed -- --archive-missing
pnpm db:rollback-import -- <importBatchId> --dry-run
pnpm db:rollback-import -- <importBatchId> --confirm
```

参数：
| 参数 | 说明 |
| --- | --- |
| `--dry-run` | 只计算导入计划，不写入远端 Supabase |
| `--archive-missing` | 将当前 seed 文件中不存在、但远端仍未归档的同队 `import_key` 店铺软归档 |
| `--rollback-batch <id>` | 回滚指定导入批次：删除该批次评分和榜单关联，并软归档该批次店铺 |
| `--confirm` | 执行真实回滚时必须显式传入 |
| `--source-name <name>` | 自定义导入来源名，默认 `seed-places.json` |
| `--team-slug <slug>` | 自定义目标小队，默认 `what-to-eat` |

批次追踪：
- `import_batches.operation/status/summary/finished_at/rolled_back_at` 记录导入或回滚状态。
- `places.import_batch_id`、`list_places.import_batch_id`、`ratings.import_batch_id` 记录最近一次导入来源批次。
- 回滚是运维操作，不自动恢复被覆盖前的旧字段值；适合撤销测试导入或整批 seed 导入。

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
| `--contact-email` | 否 | 账号找回/修改密码校验邮箱 |
| `--contact-phone` | 否 | 账号找回/修改密码校验手机号 |
| `--role` | 否 | `owner`、`member`、`viewer`，默认 `member` |
| `--team-slug` | 否 | 默认 `what-to-eat` |
| `--no-team` | 否 | 创建外部测试用户，不绑定小队 |

输出不会打印密码。

### `pnpm smoke:auth-ratings`

路径：`scripts/smoke-auth-ratings.mjs`

用途：验证后端登录和评分权限闭环。该脚本会写入/更新远端 Supabase 测试评分。

覆盖：
- `POST /api/auth/login`
- `POST /api/ratings`
- `GET /api/ratings`
- `DELETE /api/ratings`
- `GET /api/admin/places/[id]/ratings`
- `DELETE /api/admin/places/[id]/ratings`
- member 写入/读取/删除/恢复 team_member 评分
- external 写入/读取 external 评分
- owner 后台读取并删除指定评分
- external 给 public_view-only 榜单评分返回 403

### `pnpm smoke:change-password`

路径：`scripts/smoke-change-password.mjs`

用途：验证账号联系方式校验修改密码闭环。脚本会把 `testuser` 临时改为新密码，确认旧密码失效、新密码可登录，最后恢复原密码。

默认测试账号：
```txt
username: testuser
contactEmail: testuser@example.com
originalPassword: TestUser_2026
temporaryPassword: TempUser_2026
```

覆盖：
- `POST /api/auth/change-password`
- `POST /api/auth/login`
- 错误联系方式返回 `contact_mismatch`
- 正确联系方式可修改密码
- 测试结束恢复原密码

### `pnpm smoke:admin-read`

路径：`scripts/smoke-admin-read.mjs`

用途：验证后端后台只读接口和认证接口闭环。该脚本只读取数据，不写入远端 Supabase。

覆盖：
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `GET /api/admin/summary`
- `GET /api/admin/lists`
- `GET /api/admin/places`
- `GET /api/admin/lists/[slug]/places`
- `GET /api/admin/places/[id]`
- `GET /api/admin/places/[id]/ratings`
- `GET /api/admin/members`
- `GET /api/admin/import-plan`
- `GET /api/admin/import-batches`
- `GET /api/admin/import-batches/[id]`
- `GET /api/admin/import-batches/[id]/rollback-plan`
- `POST /api/admin/import-batches/[id]/rollback`
- owner/member/external/未登录权限路径
- 导入预检 dry-run 计划读取权限和 seed place 计数
- 后台汇总计数读取权限与 active place 计数
- 导入批次详情计数和 preview 结构
- 导入批次只读回滚计划 impact
- 导入批次真实回滚保护栏：缺少 `confirm: true` 返回 400，member 即使确认也返回 403

### `pnpm smoke:admin-write`

路径：`scripts/smoke-admin-write.mjs`

用途：验证后台写入接口闭环。该脚本会写入/更新固定测试榜单和测试店铺，临时归档后恢复测试店铺，临时调整榜单前两项排序后恢复，并临时添加再移除测试成员。

运行前置：
- 本地 Next.js 服务默认运行在 `http://127.0.0.1:3000`，也可设置 `BACKEND_SMOKE_URL`、`NEXT_PUBLIC_APP_URL` 或 `APP_URL`
- 测试账号 `testowner/testuser/testexternal/testmembertarget` 已存在

覆盖：
- `POST /api/auth/login`
- `POST /api/admin/lists`
- `PATCH /api/admin/places`
- `POST /api/admin/places/archive`
- `GET /api/admin/places`
- `GET /api/admin/places/[id]`
- `GET /api/admin/places/[id]/ratings`
- `GET /api/admin/lists/[slug]/places`
- `POST /api/admin/lists/[slug]/places/order`
- `POST /api/admin/members`
- `DELETE /api/admin/members`
- external 写榜单返回 403
- viewer 可读后台榜单、店铺、榜单内店铺、店铺详情和评分明细，但写榜单返回 403
- member 可写店铺、归档/恢复店铺、调整榜单排序；member 创建榜单返回 403
- 重复排序 id 返回 400
- member 管理成员返回 403
- owner 可添加并移除测试成员

### `pnpm smoke:admin-photos`

路径：`scripts/smoke-admin-photos.mjs`

用途：验证后台店铺照片上传、元数据更新和真删除闭环。该脚本会向公开 Storage bucket `place-photos` 上传一张 1x1 PNG，测试结束后删除 Storage object 和 `photos` 记录。

运行前置：
- 本地 Next.js 服务默认运行在 `http://127.0.0.1:3000`，也可设置 `BACKEND_SMOKE_URL`、`NEXT_PUBLIC_APP_URL` 或 `APP_URL`
- 远端 Supabase 已执行包含 `photos.storage_path` 和 `place-photos` bucket 配置的最新 `supabase/schema.sql`
- 测试账号 `testowner/testuser/testexternal` 已存在

覆盖：
- `POST /api/auth/login`
- `POST /api/admin/places/[id]/photos`
- `PATCH /api/admin/places/[id]/photos`
- `DELETE /api/admin/places/[id]/photos`
- `GET /api/admin/places/[id]`
- 未登录上传返回 401
- external 上传返回 403
- owner 上传照片并成为封面
- member 更新照片 `isCover/sortOrder`
- owner 删除照片并确认详情中不再返回该照片
