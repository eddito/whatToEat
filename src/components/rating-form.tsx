"use client";

import Link from "next/link";
import { Send, Star } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";

type SubmitState = "idle" | "loading" | "success" | "error";

const scoreOptions = [1, 2, 3, 4, 5];

export function RatingForm({ placeId }: { placeId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getBrowserSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [score, setScore] = useState(5);
  const [note, setNote] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    setState("loading");
    setMessage("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setState("error");
      setMessage("登录状态已失效，请重新登录。");
      return;
    }

    const response = await fetch("/api/ratings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        placeId,
        score,
        note,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setState("error");
      setMessage(result?.error ?? "评分提交失败，请稍后重试。");
      return;
    }

    setState("success");
    setMessage(result?.message ?? "评分已提交。");
    router.refresh();
  }

  if (!isReady) {
    return <p className="rating-form-note">正在检查登录状态...</p>;
  }

  if (!user) {
    return (
      <div className="rating-login-box">
        <p>登录后可以给这家店打分。</p>
        <Link className="button secondary" href={`/login?next=${encodeURIComponent(pathname)}`}>
          去登录
        </Link>
      </div>
    );
  }

  return (
    <form className="rating-form" onSubmit={handleSubmit}>
      <div className="rating-score-options" aria-label="选择评分">
        {scoreOptions.map((value) => (
          <button
            aria-pressed={score === value}
            className={score === value ? "rating-score-button active" : "rating-score-button"}
            key={value}
            onClick={() => setScore(value)}
            type="button"
          >
            <Star aria-hidden="true" size={15} />
            {value}
          </button>
        ))}
      </div>

      <label className="rating-note-field">
        <span>备注</span>
        <textarea
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder="可选，记录这次评分的理由"
          rows={3}
          value={note}
        />
      </label>

      <p className={state === "error" ? "rating-form-note error" : "rating-form-note"}>
        {message || "提交后会更新你自己的评分记录。"}
      </p>

      <button className="button auth-submit" disabled={state === "loading"} type="submit">
        <Send aria-hidden="true" size={15} />
        {state === "loading" ? "提交中..." : "提交评分"}
      </button>
    </form>
  );
}
