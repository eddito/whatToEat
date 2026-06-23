# 部署上线工作流

## 当前状态

- 状态：待接收工程交付物
- 负责人：部署上线工作流
- 目标：完成环境配置、上线部署、域名接入、发布验收、监控和回滚方案。
- 默认部署方案：Vercel + Supabase
- 应用暂定名称：今天吃什么
- 初始管理员账号：1397854281@qq.com
- 公开规则：暂定全公开
- 首版地图：启用，地图供应商为高德地图
- 首版域名：暂时使用 Vercel 免费域名

## 已确认部署输入

- 初始 owner / 管理员账号：`1397854281@qq.com`。
- 初始数据文件：`C:\Users\xyc20\Downloads\今天吃什么.xlsx`。
- 首版公开规则：暂定全公开。
- GitHub 仓库：`https://github.com/eddito/whatToEat`。
- 高德地图 key 已提供，部署时写入环境变量，不在文档或仓库中明文保存。
- Supabase publishable key 已提供，部署时写入前端可用环境变量，不在文档或仓库中明文保存。
- Supabase secret key 已提供，部署时仅写入服务端环境变量，不在文档或仓库中明文保存。
- Supabase Project URL 已提供：`https://lickxydbtkyijgjmpnqo.supabase.co`。
- 暂时使用 Vercel 默认免费域名；正式域名后置。
- 本地预览地址：`http://127.0.0.1:3000`
- 当前构建状态：Next.js 生产构建通过。

## 官方入口

- Vercel 官网：`https://vercel.com/`
- Vercel Dashboard：`https://vercel.com/dashboard`
- Supabase 官网：`https://supabase.com/`
- Supabase Dashboard：`https://supabase.com/dashboard`
- 高德开放平台：`https://lbs.amap.com/`
- 高德地图 JS API 2.0 文档：`https://lbs.amap.com/api/javascript-api-v2/summary`
- 高德控制台：`https://console.amap.com/`

## 工作流职责

部署上线工作流负责把已通过产品验收和工程测试的版本发布到线上，并保证线上环境可访问、可回滚、可维护。

核心职责：

- 创建和配置 Vercel 项目。
- 创建和配置 Supabase 项目。
- 配置数据库、Auth、Storage、RLS 和生产环境变量。
- 配置域名、HTTPS、预览环境和生产环境。
- 执行上线前检查和上线后验证。
- 记录发布版本、环境变量和回滚步骤。

## 输入

- 产品统一设计工作流的上线验收标准。
- 代码实现工作流交付的代码、迁移、测试结果和环境变量清单。
- GitHub 仓库：`https://github.com/eddito/whatToEat`。
- Vercel 账号或项目访问权限。
- Supabase 项目配置。
- 域名信息，如有。
- 地图 API Key，如地图功能上线。

## 输出

- 线上访问地址。
- Vercel 项目配置记录。
- Supabase 项目配置记录。
- 生产环境变量清单。
- 数据库迁移执行记录。
- 发布前检查报告。
- 上线后验证报告。
- 回滚方案。

## 环境规划

### Preview

- 用于每次代码变更预览。
- 连接测试 Supabase 项目或测试 schema。
- 可用于产品和 UI 验收。

### Production

- 线上正式环境。
- 连接生产 Supabase 项目。
- 只发布通过验收的版本。
- 环境变量不可暴露在客户端，除明确允许的 public key。

## 部署方案

### Vercel

- 连接 GitHub 仓库。
- 设置 Framework Preset 为 Next.js。
- 配置 build command：`npm run build`。
- 配置 install command：`npm install` 或项目锁文件对应命令。
- 配置环境变量。
- 启用 preview deployments。
- 绑定域名，如有。

### Supabase

- 创建项目。
- 执行 schema migration。
- 启用 Auth。
- 设置登录方式。
- 创建 Storage bucket。
- 配置 Storage policies。
- 配置 RLS policies。
- 创建初始 owner。
- 导入腾讯文档数据。

## 环境变量清单

```txt
NEXT_PUBLIC_SUPABASE_URL=https://lickxydbtkyijgjmpnqo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_MAP_PROVIDER=amap
NEXT_PUBLIC_AMAP_KEY=
```

说明：

- `NEXT_PUBLIC_*` 可用于浏览器端，不能放服务端密钥。
- `SUPABASE_SECRET_KEY` 只能用于服务端环境变量，严禁暴露到前端。
- 如果 SDK 或模板仍使用旧命名，可在实现阶段映射为 `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`，但密钥值仍不得提交到仓库。
- 高德地图 key 根据高德开放平台要求设置域名白名单。

## 阶段拆解

### R0 部署准备

- 确认 GitHub 仓库：`https://github.com/eddito/whatToEat`。
- 确认 Vercel 账号和项目。
- 确认 Supabase 项目。
- 确认管理员邮箱：`1397854281@qq.com`。
- 确认使用 Vercel 免费域名。
- 确认高德地图 key 写入环境变量。

### R1 Supabase 生产配置

- 创建生产数据库。
- 执行 migration。
- 配置 Auth。
- 配置 Storage。
- 配置 RLS。
- 创建初始 owner：`1397854281@qq.com`。
- 导入初始数据。

### R2 Vercel 生产配置

- 连接 GitHub 仓库。
- 配置项目环境变量。
- 执行首次部署。
- 检查 build logs。
- 生成 preview 和 production URL。

### R3 发布前检查

- 检查首页可访问。
- 检查公开榜单可访问。
- 检查私密榜单未授权不可访问。
- 检查登录流程。
- 检查外部登录用户评分。
- 检查 owner 后台编辑。
- 检查图片上传和读取。
- 检查移动端展示。

### R4 正式上线

- 切换生产域名。
- 执行线上 smoke test。
- 记录版本号和发布时间。
- 通知产品工作流验收。

### R5 回滚和维护

- 如发布失败，回滚到 Vercel 上一个稳定 deployment。
- 如 migration 有风险，先备份数据库。
- 记录故障、影响范围、恢复步骤。
- 汇总下次发布改进项。

## 任务清单

- [x] 获取 GitHub 仓库地址。
- [ ] 获取 Vercel 项目权限。
- [x] 获取 Supabase Project URL。
- [x] 获取 Supabase publishable key。
- [x] 获取 Supabase secret key。
- [x] 获取高德地图 API Key。
- [x] 确认首版使用 Vercel 免费域名。
- [ ] 配置生产环境变量。
- [ ] 执行数据库 migration。
- [ ] 配置 Auth 和 Storage。
- [ ] 配置 RLS。
- [ ] 创建初始 owner。
- [ ] 导入初始数据。
- [ ] 执行首次部署。
- [x] 完成本地构建和核心路由检查。
- [ ] 绑定域名。
- [ ] 完成上线后验证。
- [ ] 记录回滚方案。

## 验收标准

- 生产 URL 可访问。
- 首页、榜单页、店铺详情页正常加载。
- 未登录用户无法访问私密榜单和后台。
- 外部登录用户能在开放打分榜单评分。
- 小队成员能编辑店铺和评分。
- owner 能管理榜单权限。
- 图片上传、读取和权限正常。
- 数据库迁移和导入有记录。
- 回滚路径明确。

## 需要用户提供的信息

- GitHub 仓库已提供：`https://github.com/eddito/whatToEat`。
- Vercel 账号或项目邀请。
- Supabase Project URL 已提供：`https://lickxydbtkyijgjmpnqo.supabase.co`。
- Supabase publishable / anon key 已提供，需部署时写入环境变量。
- Supabase secret / service role key 已提供，需部署时写入服务端环境变量。
- 管理员邮箱已提供：`1397854281@qq.com`。
- 腾讯文档导出的 `.xlsx` 已提供。
- 高德地图 API Key 已提供，需部署时写入环境变量。
- 暂不需要域名和 DNS 管理权限，首版使用 Vercel 免费域名。

## 需要用户手动确认的操作

- 授权 Vercel 访问 GitHub 仓库。
- 创建或确认 Supabase 生产项目。
- 在 Vercel 环境变量中写入 Supabase publishable key 和 secret key。
- 在 Vercel 环境变量中写入高德地图 key。
- 确认生产数据导入。
- 如后续购买域名，再确认正式域名切换。
- 如全公开规则变化，重新确认首版公开榜单和公开字段。

## 阻塞项

- 未提供 Vercel/GitHub 授权时，无法自动部署。
- Supabase secret key 若泄露或误提交，需要在 Supabase 后台轮换。
- 如高德地图 key 失效、域名白名单未配置或免费额度不足，地图功能可能无法正常加载。
- 如全公开规则后续变化，需要重新执行公开访问验收。

## 发布记录模板

```md
# Release Record

## Version

## Date

## Deployment URL

## Git Commit

## Database Migration

## Data Import Batch

## Checks

## Known Issues

## Rollback Target
```

## 变更记录

| 日期 | 变更 | 来源 | 影响 |
| --- | --- | --- | --- |
| 2026-06-21 | 创建部署上线工作流 | Codex | Vercel、Supabase、上线验收 |
| 2026-06-21 | 写入管理员账号、公开规则和初始数据文件 | 用户 / Codex | Supabase 初始化、数据导入、验收 |
| 2026-06-21 | 写入 GitHub 仓库地址 `eddito/whatToEat` | 用户 / Codex | Vercel 连接、代码交付 |
| 2026-06-21 | 写入官方入口、高德地图、免费域名和地图 key 状态 | 用户 / Codex | 部署准备、环境变量、地图验收 |
| 2026-06-21 | 写入 Supabase key 提供状态，Project URL 待补 | 用户 / Codex | 环境变量、生产连接 |
| 2026-06-21 | 写入 Supabase Project URL | 用户 / Codex | Vercel 环境变量、生产连接 |
| 2026-06-21 | 记录本地预览地址和构建通过状态 | Codex | 部署前检查 |
