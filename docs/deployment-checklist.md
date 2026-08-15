# 今天吃什么发布前检查清单

> 本清单只用于上线准备和人工确认，不代表已经部署。

## 1. 代码与运行时

- [ ] 确认待发布分支已合并完整前后端改动。
- [ ] 确认 Node.js 版本为 `>=20.9.0`。
- [ ] 确认 Vercel install command 为 `pnpm install --frozen-lockfile`。
- [ ] 确认 Vercel build command 为 `pnpm build`。
- [ ] 本地执行并通过：

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke:public
pnpm smoke:auth
pnpm smoke:browser
```

## 2. Supabase

- [ ] 执行 [schema.sql](../supabase/schema.sql)。
- [ ] 确认 RLS 已启用且策略创建成功。
- [ ] 创建 public Storage bucket：`place-photos`。
- [ ] 确认 Auth 开启账号密码登录。
- [ ] 创建或确认 owner 账号：`1397854281@qq.com`。
- [ ] 导入种子数据。
- [ ] 确认 `red-list`、`retry-list` 和后台测试数据可读。

## 3. 环境变量

生产环境需要配置：

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_PLACE_PHOTOS_BUCKET=place-photos
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_MAP_PROVIDER=amap
NEXT_PUBLIC_AMAP_KEY=
```

- [ ] `NEXT_PUBLIC_*` 变量只放可公开值。
- [ ] `SUPABASE_SECRET_KEY` 只配置在服务端环境，不写入仓库。
- [ ] 高德地图 key 已配置生产域名白名单。
- [ ] `NEXT_PUBLIC_APP_URL` 指向最终 Vercel 或生产域名。

## 4. 上线后验收

- [ ] 首页可访问。
- [ ] 红榜、再练练可访问。
- [ ] 店铺详情可访问。
- [ ] 地图页可加载。
- [ ] 账号密码登录正常。
- [ ] 成员可评分。
- [ ] 后台可加载成员、榜单、店铺。
- [ ] 榜单排序保存正常。
- [ ] 图片上传和公开封面读取正常。
- [ ] 未授权用户无法访问后台。

## 5. 回滚

- [ ] 记录发布 commit。
- [ ] 记录 Vercel deployment URL。
- [ ] 数据库 schema 变更前已备份。
- [ ] 如线上异常，优先回滚到上一版 Vercel deployment。
- [ ] 如数据异常，停止写入后按 Supabase 备份恢复。
