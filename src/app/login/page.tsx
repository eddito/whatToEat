import Link from "next/link";
import { ArrowRight, KeyRound, ShieldCheck, Star, UsersRound } from "lucide-react";
import { LoginForm } from "@/components/login-form";

const loginScopes = [
  {
    title: "外部评分",
    detail: "开放打分榜单会允许登录用户提交自己的评分。",
    icon: Star,
  },
  {
    title: "小队成员",
    detail: "成员可维护店铺、补充信息并更新自己的队内评分。",
    icon: UsersRound,
  },
  {
    title: "Owner 管理",
    detail: "管理员可管理榜单权限、成员和导入数据。",
    icon: ShieldCheck,
  },
];

export default function LoginPage() {
  return (
    <>
      <section className="container auth-page">
        <div className="auth-copy">
          <span className="eyebrow">
            <KeyRound aria-hidden="true" size={15} />
            权限入口
          </span>
          <h1 className="page-title">登录后参与评分和管理</h1>
          <p className="page-lede">公开内容可以直接浏览；评分、编辑和后台管理会在接入 Supabase Auth 后开放。</p>
          <div className="auth-actions">
            <Link className="button" href="/lists/red-list">
              继续看红榜
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="button secondary" href="/admin">
              查看后台计划
            </Link>
          </div>
        </div>

        <section className="auth-card" aria-labelledby="login-form-title">
          <div>
            <span className="eyebrow">Magic link</span>
            <h2 id="login-form-title">邮箱登录</h2>
            <p>输入邮箱获取登录链接，完成后就能进入评分和后台权限流程。</p>
          </div>

          <LoginForm />
        </section>
      </section>

      <section className="container section compact-section">
        <div className="auth-scope-grid">
          {loginScopes.map((scope) => {
            const Icon = scope.icon;

            return (
              <article className="auth-scope-card" key={scope.title}>
                <span className="task-icon">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <h3>{scope.title}</h3>
                <p>{scope.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
