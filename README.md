# 今天吃什么

探店小队应用首版。当前实现优先让真实数据可浏览：卡片流、榜单、店铺详情、地图页和后台入口。

## Tech Stack

- Next.js App Router
- TypeScript
- Supabase / PostgreSQL
- 高德地图 JS API 2.0

## Local Setup

Next.js 16 requires Node.js `>=20.9.0`. Use `pnpm` for this project.

```bash
pnpm install
pnpm dev:safe
```

复制 `.env.example` 为 `.env.local`，填入 Supabase 和高德地图环境变量。

如果启动时提示 Node 版本过低，请先切换到 Node.js 20.9.0 或更高版本，再重新运行 `pnpm dev:safe`。

`SUPABASE_SECRET_KEY` 只能用于服务端环境变量，不能提交到 GitHub。

## Current Data

`src/data/seed-places.json` 来自腾讯文档导出的 Excel：

- 红榜：74 条
- 再练练：3 条

后续接入 Supabase 后，种子数据将迁移到 PostgreSQL。

## Project Structure

- `src/`: Next.js app source.
- `supabase/`: database schema and RLS draft.
- `scripts/`: import notes and future data tooling.
- `docs/workflows/`: product, UI, engineering, and deployment workflows.

## Official Project Path

`D:\yjl\what-to-eat-today`
