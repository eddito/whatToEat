"use client";

import Link from "next/link";
import { Send, Star, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";

type SubmitState = "idle" | "loading" | "success" | "error";

const scoreOptions = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

type RatingLookupResponse = {
  error?: string;
  rating?: {
    id: string;
    note: string | null;
    score: number;
  } | null;
};

export function RatingForm({ placeId }: { placeId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getBrowserSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [score, setScore] = useState(5);
  const [note, setNote] = useState("");
  const [hasExistingRating, setHasExistingRating] = useState(false);
  const [isLoadingRating, setIsLoadingRating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  useEffect(() => {
    if (!supabase || !user) {
      setHasExistingRating(false);
      setIsLoadingRating(false);
      setMessage("");
      return;
    }

    let mounted = true;
    const client = supabase;

    async function loadExistingRating() {
      setIsLoadingRating(true);
      setState("idle");
      setMessage("正在读取你的评分...");

      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        if (mounted) {
          setState("error");
          setMessage("登录状态已失效，请重新登录。");
          setIsLoadingRating(false);
        }
        return;
      }

      const response = await fetch(`/api/ratings?placeId=${encodeURIComponent(placeId)}`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const result = (await response.json().catch(() => null)) as RatingLookupResponse | null;

      if (!mounted) {
        return;
      }

      if (!response.ok) {
        setState("error");
        setMessage(result?.error ?? "评分读取失败，请刷新后重试。");
        setIsLoadingRating(false);
        return;
      }

      if (result?.rating) {
        setScore(result.rating.score);
        setNote(result.rating.note ?? "");
        setHasExistingRating(true);
        setMessage("已载入你上次的评分。");
      } else {
        setScore(5);
        setNote("");
        setHasExistingRating(false);
        setMessage("还没有给这家店打过分。");
      }

      setIsLoadingRating(false);
    }

    loadExistingRating().catch(() => {
      if (mounted) {
        setState("error");
        setMessage("评分读取失败，请刷新后重试。");
        setIsLoadingRating(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [placeId, supabase, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user || isLoadingRating) {
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
    setHasExistingRating(true);
    setMessage(result?.message ?? "评分已提交。");
    router.refresh();
  }

  async function handleDelete() {
    if (!supabase || !user || isLoadingRating || isDeleting || !hasExistingRating) {
      return;
    }

    setIsDeleting(true);
    setState("idle");
    setMessage("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setState("error");
      setMessage("登录状态已失效，请重新登录。");
      setIsDeleting(false);
      return;
    }

    let response: Response;
    let result: { error?: string; message?: string } | null = null;

    try {
      response = await fetch(`/api/ratings?placeId=${encodeURIComponent(placeId)}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    } catch {
      setState("error");
      setMessage("评分删除失败，请稍后重试。");
      setIsDeleting(false);
      return;
    }

    if (!response.ok) {
      setState("error");
      setMessage(result?.error ?? "评分删除失败，请稍后重试。");
      setIsDeleting(false);
      return;
    }

    setScore(5);
    setNote("");
    setHasExistingRating(false);
    setState("success");
    setMessage(result?.message ?? "评分已删除。");
    setIsDeleting(false);
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
      <fieldset className="rating-score-field" disabled={isLoadingRating || state === "loading" || isDeleting}>
        <legend>评分</legend>
        <div className="rating-score-options">
          {scoreOptions.map((value) => (
            <button
              aria-pressed={score === value}
              className={score === value ? "rating-score-button active" : "rating-score-button"}
              key={value}
              onClick={() => setScore(value)}
              type="button"
            >
              <Star aria-hidden="true" size={15} />
              {formatScore(value)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="rating-note-field">
        <span>备注</span>
        <textarea
          maxLength={500}
          disabled={isLoadingRating || state === "loading" || isDeleting}
          onChange={(event) => setNote(event.target.value)}
          placeholder="可选，记录这次评分的理由"
          rows={3}
          value={note}
        />
      </label>

      <p
        aria-live="polite"
        className={
          state === "error" ? "rating-form-note error" : state === "success" ? "rating-form-note success" : "rating-form-note"
        }
      >
        {message ||
          (hasExistingRating ? "已保存过评分，可以调整后更新。" : "提交后会保存为你自己的评分记录。")}
      </p>

      <div className="rating-actions">
        <button className="button auth-submit" disabled={isLoadingRating || state === "loading" || isDeleting} type="submit">
          <Send aria-hidden="true" size={15} />
          {state === "loading" ? "提交中..." : hasExistingRating ? "更新评分" : "提交评分"}
        </button>
        {hasExistingRating ? (
          <button
            className="button secondary rating-delete-button"
            disabled={isLoadingRating || state === "loading" || isDeleting}
            onClick={handleDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" size={15} />
            {isDeleting ? "删除中..." : "删除评分"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
