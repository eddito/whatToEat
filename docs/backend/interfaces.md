# 后端接口文档

## 文档状态

- 状态：进行中
- 分支：`codex/backend-dev`
- 当前切片：公开浏览数据读取
- 维护规则：新增或修改后端服务、脚本、Route Handler、Server Action 时，同步更新本文档。

## 后端边界

| 层级 | 路径 | 责任 |
| --- | --- | --- |
| 数据库 | `supabase/schema.sql` | 表结构、枚举、RLS、触发器 |
| 数据访问层 | `src/server/**/repository.ts` | 封装 Supabase 查询，返回数据库记录 |
| 服务层 | `src/server/**/service.ts` | 输出前端/integration 可用的数据契约 |
| 脚本 | `scripts/*.mjs` | seed、初始化等可重复任务 |

页面和 UI 组件不在本切片内改动；integration 分支后续再决定如何从 seed 切到 Supabase，并保留失败回退。

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

### 核心表

| 表 | 用途 | 当前切片字段是否够用 |
| --- | --- | --- |
| `teams` | 小队空间 | 够用：`id`、`slug`、`name`、`description` |
| `profiles` | Auth 用户资料 | 够用：`id`、`email`、`display_name`、`avatar_url` |
| `team_members` | 成员和角色 | 够用：`team_id`、`user_id`、`role` |
| `lists` | 榜单 | 够用：`slug`、`name`、`description`、`visibility` |
| `places` | 店铺 | 够用：基础信息、口味、评价、停车、来源、地图字段 |
| `list_places` | 榜单和店铺关联 | 够用：`list_id`、`place_id`、`sort_order` |
| `ratings` | 评分 | 够用：`source`、`rater_label`、`score`、`note` |

### RLS 最小闭环

当前切片只开放读取，不开放写入。

| 资源 | 未登录用户权限 |
| --- | --- |
| `lists` | 可 `select visibility in ('public_view', 'public_rate')` 的榜单 |
| `places` | 可 `select` 挂在公开榜单下的店铺 |
| `list_places` | 可 `select` 公开榜单的关联记录 |
| `ratings` | 可 `select` 公开店铺的评分，用于统计展示 |
| `photos` | 可 `select` 公开店铺图片 |

私密榜单、写入、成员管理、后台管理策略留到后续切片。

## 公开浏览数据契约

### `PublicList`

```ts
type PublicList = {
  slug: string;
  name: string;
  description: string;
  visibility: "private" | "public_view" | "public_rate";
  stats: {
    count: number;
    scoredCount: number;
    avgScore: number;
  };
};
```

### `PublicPlace`

```ts
type PublicPlace = {
  id: string;
  listSlug: string;
  listName: string;
  name: string;
  category: string;
  tasteTags: string[];
  signatureDishes: string;
  review: string;
  region: string;
  locationLabel: string;
  parkingNote: string;
  sourceLabel: string;
  visited: boolean;
  memberScores: Record<string, number>;
  teamScore: number;
  longitude?: number;
  latitude?: number;
};
```

说明：`id` 优先使用 `places.import_key`，用于兼容当前 `/places/red-list-1` 这类 URL；没有 `import_key` 时回退到数据库 UUID。

### `PublicMapPlace`

```ts
type PublicMapPlace = {
  id: string;
  name: string;
  region: string;
  category: string;
  score: number;
  longitude?: number;
  latitude?: number;
};
```

## 服务层接口

路径：`src/server/places/service.ts`

### `getLists()`

获取公开榜单列表，包含统计信息。

```ts
async function getLists(): Promise<PublicList[]>;
```

### `getList(slug)`

获取单个公开榜单和统计信息。

```ts
async function getList(slug: string): Promise<PublicList | null>;
```

### `getPlacesByList(slug)`

获取某个公开榜单下的店铺。

```ts
async function getPlacesByList(slug: string): Promise<PublicPlace[]>;
```

### `getPlace(id)`

获取公开店铺详情。`id` 可以是 `places.import_key` 或 UUID。

```ts
async function getPlace(id: string): Promise<PublicPlace | null>;
```

### `getMapPlaces()`

获取地图页需要的公开店铺数据。

```ts
async function getMapPlaces(): Promise<PublicMapPlace[]>;
```

### `getListStats(slug)`

获取公开榜单统计。

```ts
async function getListStats(slug: string): Promise<PublicListStats | null>;
```

## 兼容函数

为 integration 分支渐进迁移，服务层暂时保留旧应用模型适配函数：

| 函数 | 说明 |
| --- | --- |
| `getPublicPlaceData()` | 返回旧 `ListSummary[]` 和 `Place[]` |
| `getPublicListPageData(slug)` | 返回旧榜单页数据结构 |
| `getPublicPlacePageData(id)` | 返回旧店铺详情数据结构 |
| `getListStatsFromPlaces(places)` | 旧 `Place[]` 统计函数 |

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

用途：
- 创建或复用默认小队。
- 创建或更新公开榜单。
- 导入 `src/data/seed-places.json` 中的 77 条店铺。
- 创建榜单关联。
- 导入已有评分。

输入：
- `.env.local`
- `src/data/seed-places.json`

输出示例：

```json
{
  "ok": true,
  "teamId": "...",
  "importBatchId": "...",
  "lists": 2,
  "places": 77,
  "ratingsWithScores": 60
}
```

幂等性：
- 店铺按 `team_id + import_key` 复用。
- 榜单按 `team_id + slug` 复用。
- 评分按 `place_id + source + user_id/rater_label` 复用。

### `pnpm smoke:supabase`

路径：`scripts/smoke-supabase-public.mjs`

用途：
- 使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 验证未登录公开读取路径。
- 检查公开榜单、公开榜单关联、公开店铺、公开评分和一条样例店铺能否读取。
- 不读取、不打印 `SUPABASE_SECRET_KEY`。

输入：
- `.env.local`

输出：
- 每个检查项的 `PASS` / `FAIL`。
- 只输出数量和布尔结果，不输出密钥。
