import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password-form";

export default function ChangePasswordPage() {
  return (
    <section className="container auth-page">
      <div className="auth-copy">
        <span className="eyebrow">
          <KeyRound aria-hidden="true" size={15} />
          账号维护
        </span>
        <h1 className="page-title">用邮箱或手机号修改密码</h1>
        <p className="page-lede">不使用邮箱免密登录；只校验账号绑定的邮箱或手机号，然后直接设置新密码。</p>
        <div className="auth-actions">
          <Link className="button secondary" href="/login">
            <ArrowLeft aria-hidden="true" size={16} />
            返回登录
          </Link>
        </div>
      </div>

      <section className="auth-card" aria-labelledby="change-password-form-title">
        <div>
          <span className="eyebrow">
            <ShieldCheck aria-hidden="true" size={14} />
            Password reset
          </span>
          <h2 id="change-password-form-title">修改账号密码</h2>
          <p>账号规则为小写字母和数字，不能包含中文或特殊字符。</p>
        </div>

        <ChangePasswordForm />
        <Link className="auth-card-link" href="/login">
          已有密码，去登录
        </Link>
      </section>
    </section>
  );
}
