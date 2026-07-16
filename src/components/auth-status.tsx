"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";

export function AuthStatus({ active }: { active?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const supabase = getBrowserSupabase();
  const displayName =
    typeof user?.user_metadata?.username === "string"
      ? user.user_metadata.username
      : typeof user?.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : user?.email;

  useEffect(() => {
    if (!supabase) {
      setIsReady(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user ?? null);
        setIsReady(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!isReady || !user) {
    return (
      <Link className={active ? "auth-link active" : "auth-link"} href="/login">
        <LogIn aria-hidden="true" size={16} strokeWidth={2.1} />
        登录
      </Link>
    );
  }

  return (
    <div className="auth-session" aria-label="当前登录状态">
      <span className="auth-email" title={user.email ?? "已登录"}>
        {displayName ?? "已登录"}
      </span>
      <button className="auth-signout" onClick={() => supabase?.auth.signOut()} type="button">
        <LogOut aria-hidden="true" size={15} strokeWidth={2.1} />
        退出
      </button>
    </div>
  );
}
