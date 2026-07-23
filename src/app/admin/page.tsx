import { AdminDashboard } from "@/components/admin-dashboard";

export default function AdminPage() {
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">小队后台</span>
        <h1 className="page-title">管理工作台</h1>
        <p className="page-lede">查看小队数据健康状态、成员角色和后续管理任务。后台数据只对小队成员开放。</p>
      </section>

      <AdminDashboard />
    </>
  );
}
