"use client";

import { LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase";

type LoginState = "idle" | "loading" | "success" | "error";
const USERNAME_EMAIL_DOMAIN = "users.what-to-eat-today.invalid";

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function getLoginCredentials(account: string, password: string) {
  const loginAccount = account.trim();

  if (loginAccount.includes("@")) {
    return { email: loginAccount, password };
  }

  if (/^\+?\d{6,15}$/.test(loginAccount)) {
    return { phone: loginAccount, password };
  }

  return { email: `${loginAccount}@${USERNAME_EMAIL_DOMAIN}`, password };
}

export function LoginForm() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");
  const supabase = getBrowserSupabase();
  const isDisabled = state === "loading" || !account.trim() || password.length < 6;
  const helperText = useMemo(() => {
    if (!supabase) {
      return "缺少 Supabase 前端环境变量，暂时不能登录。";
    }

    if (state === "success") {
      return "登录成功，正在跳转...";
    }

    if (state === "error") {
      return message || "登录失败，请检查账号密码后重试。";
    }

    return "使用账号密码登录。账号可以是用户名、邮箱或手机号，登录状态会保存在当前浏览器中。";
  }, [message, state, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || isDisabled) {
      return;
    }

    setState("loading");
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword(getLoginCredentials(account, password));

    if (error) {
      setState("error");
      setMessage(
        error.message === "Phone logins are disabled"
          ? "当前 Supabase 未开启手机号登录，请开启 Phone 登录或改用用户名/邮箱账号。"
          : error.message === "Invalid login credentials"
            ? "账号或密码不正确，请检查后重试。"
            : error.message,
      );
      return;
    }

    setState("success");
    window.setTimeout(() => router.replace(getSafeNextPath()), 500);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>
          <UserRound aria-hidden="true" size={15} />
          账号
        </span>
        <input
          autoComplete="username"
          inputMode="text"
          name="account"
          onChange={(event) => setAccount(event.target.value)}
          placeholder="用户名、邮箱或手机号"
          type="text"
          value={account}
        />
      </label>

      <label className="field">
        <span>
          <LockKeyhole aria-hidden="true" size={15} />
          密码
        </span>
        <input
          autoComplete="current-password"
          minLength={6}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 6 位"
          type="password"
          value={password}
        />
      </label>

      <p className={state === "error" ? "auth-helper auth-helper-error" : "auth-helper"}>{helperText}</p>
      <button className="button auth-submit" disabled={isDisabled || !supabase} type="submit">
        {state === "loading" ? "登录中..." : "登录"}
      </button>
    </form>
  );
}
