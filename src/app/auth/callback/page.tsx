"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase";

type CallbackState = "loading" | "success" | "error";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("正在完成登录...");

  useEffect(() => {
    async function completeLogin() {
      const supabase = getBrowserSupabase();

      if (!supabase) {
        setState("error");
        setMessage("Supabase 前端环境变量未配置，无法完成登录。");
        return;
      }

      const url = new URL(window.location.href);
      const next = url.searchParams.get("next") || "/";
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setState("error");
          setMessage(error.message);
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          setState("error");
          setMessage("没有检测到有效登录会话，请重新发送登录链接。");
          return;
        }
      }

      setState("success");
      setMessage("登录成功，正在跳转...");
      window.setTimeout(() => router.replace(next), 650);
    }

    void completeLogin();
  }, [router]);

  const Icon = state === "loading" ? Loader2 : state === "success" ? CheckCircle2 : XCircle;

  return (
    <section className="container auth-callback">
      <div className="auth-card auth-callback-card">
        <span className={state === "error" ? "auth-callback-icon error" : "auth-callback-icon"}>
          <Icon aria-hidden="true" size={24} />
        </span>
        <h1>{state === "error" ? "登录未完成" : state === "success" ? "登录成功" : "正在登录"}</h1>
        <p>{message}</p>
        {state === "error" ? (
          <Link className="button secondary" href="/login">
            返回登录页
          </Link>
        ) : null}
      </div>
    </section>
  );
}
