"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase";

type AuthMode = "sign-in" | "sign-up";
type LoginState = "idle" | "loading" | "success" | "error";

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("1397854281@qq.com");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");
  const supabase = getBrowserSupabase();
  const isDisabled = state === "loading" || !email.trim() || password.length < 6;
  const helperText = useMemo(() => {
    if (!supabase) {
      return "缺少 Supabase 前端环境变量，暂时不能登录。";
    }

    if (state === "success") {
      return mode === "sign-in" ? "登录成功，正在跳转..." : message || "账号已创建，可以继续使用。";
    }

    if (state === "error") {
      return message || "操作失败，请稍后重试。";
    }

    return mode === "sign-in" ? "使用邮箱和密码登录，登录后可参与评分。" : "创建账号后，可用于评分和后续权限流程。";
  }, [message, mode, state, supabase]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setState("idle");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || isDisabled) {
      return;
    }

    setState("loading");
    setMessage("");

    const credentials = {
      email: email.trim(),
      password,
    };

    const { data, error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    setState("success");

    if (mode === "sign-up" && !data.session) {
      setMessage("账号已创建，请按 Supabase 当前配置完成邮箱确认后再登录。");
      return;
    }

    window.setTimeout(() => router.replace(getSafeNextPath()), 500);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-mode-tabs" role="tablist" aria-label="登录方式">
        <button
          aria-selected={mode === "sign-in"}
          className={mode === "sign-in" ? "auth-mode-tab active" : "auth-mode-tab"}
          onClick={() => switchMode("sign-in")}
          role="tab"
          type="button"
        >
          登录
        </button>
        <button
          aria-selected={mode === "sign-up"}
          className={mode === "sign-up" ? "auth-mode-tab active" : "auth-mode-tab"}
          onClick={() => switchMode("sign-up")}
          role="tab"
          type="button"
        >
          创建账号
        </button>
      </div>

      <label className="field">
        <span>
          <Mail aria-hidden="true" size={15} />
          邮箱
        </span>
        <input
          autoComplete="email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span>
          <LockKeyhole aria-hidden="true" size={15} />
          密码
        </span>
        <input
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
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
        {state === "loading" ? "处理中..." : mode === "sign-in" ? "登录" : "创建账号"}
      </button>
    </form>
  );
}
