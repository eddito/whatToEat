import { CheckCircle2, Database, MapPinned, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { lists, places } from "@/lib/places";

const adminTasks = [
  { name: "Supabase", detail: "执行 schema migration，开启 RLS", icon: Database },
  { name: "导入", detail: "把 77 条 Excel 记录导入 places / ratings", icon: UploadCloud },
  { name: "地图", detail: "补全无法自动解析的经纬度", icon: MapPinned },
  { name: "权限", detail: "创建 owner 账号并校验全公开规则", icon: ShieldCheck },
  { name: "品牌", detail: "生成双宠物正式 logo", icon: Sparkles },
];

export default function AdminPage() {
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">小队后台</span>
        <h1 className="page-title">管理工作台</h1>
        <p className="page-lede">
          这里先作为实现路线和数据健康检查入口。接入 Supabase Auth 后会限制为管理员和小队成员访问。
        </p>
      </section>

      <section className="container section">
        <div className="admin-grid">
          <div className="admin-panel">
            <span className="stat-value">{places.length}</span>
            <span className="stat-label">待导入店铺</span>
          </div>
          <div className="admin-panel">
            <span className="stat-value">{lists.length}</span>
            <span className="stat-label">榜单</span>
          </div>
          <div className="admin-panel">
            <span className="stat-value">全公开</span>
            <span className="stat-label">当前公开规则</span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="admin-panel">
          <div>
            <h2 className="section-title">下一步</h2>
            <p className="section-note">这些事项完成后，后台就能从计划板变成真正的编辑系统。</p>
          </div>
          <ul className="task-list">
            {adminTasks.map((task) => {
              const Icon = task.icon;

              return (
                <li key={task.name}>
                  <span className="task-icon">
                    <Icon aria-hidden="true" size={17} />
                  </span>
                  <strong>{task.name}</strong>
                  <span>{task.detail}</span>
                  <CheckCircle2 aria-hidden="true" className="task-status" size={18} />
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
