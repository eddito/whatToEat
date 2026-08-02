import Link from "next/link";
import { ArrowRight, KeyRound, ShieldCheck, Star, UsersRound } from "lucide-react";
import { LoginForm } from "@/components/login-form";

const loginScopes = [
  {
    title: "外部评分",
    detail: "开放评分榜单会允许登录用户提交自己的评分。",
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
          <p className="page-lede">公开内容可以直接浏览；评分、编辑和后台管理会根据登录账号权限开放。</p>
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
            <span className="eyebrow">Password login</span>
            <h2 id="login-form-title">账号密码登录</h2>
            <p>使用已创建的账号登录，登录状态会长期保存在当前浏览器中。</p>
          </div>

          <LoginForm />
          <Link className="auth-card-link" href="/change-password">
            忘记密码？用邮箱或手机号修改
          </Link>
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
