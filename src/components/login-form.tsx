"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase";

type LoginState = "idle" | "loading" | "success" | "error";

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm() {
  const router = useRouter();
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
      return "登录成功，正在跳转...";
    }

    if (state === "error") {
      return message || "登录失败，请检查账号密码后重试。";
    }

    return "使用账号密码登录。登录状态会保存在当前浏览器中，除非主动退出或会话过期。";
  }, [message, state, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || isDisabled) {
      return;
    }

    setState("loading");
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    setState("success");
    window.setTimeout(() => router.replace(getSafeNextPath()), 500);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>
          <Mail aria-hidden="true" size={15} />
          邮箱
        </span>
        <input
          autoComplete="username"
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
