"use client";

import { Mail } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

type LoginState = "idle" | "loading" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("1397854281@qq.com");
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");
  const supabase = getBrowserSupabase();
  const isDisabled = state === "loading" || !email.trim();
  const helperText = useMemo(() => {
    if (!supabase) {
      return "缺少 Supabase 前端环境变量，暂时不能发送登录链接。";
    }

    if (state === "sent") {
      return "登录链接已发送，请打开邮箱完成登录。";
    }

    if (state === "error") {
      return message || "发送失败，请稍后重试。";
    }

    return "输入邮箱后会收到一封 magic link 登录邮件。";
  }, [message, state, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || isDisabled) {
      return;
    }

    setState("loading");
    setMessage("");

    const next = new URLSearchParams(window.location.search).get("next") || "/";
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo.toString(),
      },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    setState("sent");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
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
      <p className={state === "error" ? "auth-helper auth-helper-error" : "auth-helper"}>{helperText}</p>
      <button className="button auth-submit" disabled={isDisabled || !supabase} type="submit">
        {state === "loading" ? "发送中..." : state === "sent" ? "已发送" : "发送登录链接"}
      </button>
    </form>
  );
}
