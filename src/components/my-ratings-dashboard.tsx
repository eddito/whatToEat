"use client";

import Link from "next/link";
import { ClipboardList, Clock3, LogIn, MapPin, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";

type RatingHistoryItem = {
  id: string;
  score: number;
  note: string | null;
  source: "team_member" | "external";
  updatedAt: string;
  place: {
    id: string;
    name: string;
    category: string;
    region: string;
  };
  list: {
    slug: string;
    name: string;
    visibility: "private" | "public_view" | "public_rate";
  };
};

type RatingHistoryResponse = {
  error?: string;
  ratings?: RatingHistoryItem[];
};

type LoadState = "idle" | "loading" | "success" | "error";

const sourceLabels = {
  team_member: "队内评分",
  external: "公开评分",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatScore(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

export function MyRatingsDashboard() {
  const supabase = getBrowserSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [ratings, setRatings] = useState<RatingHistoryItem[]>([]);

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
      setRatings([]);
      setState("idle");
      return;
    }

    let mounted = true;
    const client = supabase;

    async function loadRatings() {
      setState("loading");
      setMessage("正在读取评分历史...");

      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        if (mounted) {
          setState("error");
          setMessage("登录状态已失效，请重新登录。");
        }
        return;
      }

      const response = await fetch("/api/ratings/me", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const result = (await response.json().catch(() => null)) as RatingHistoryResponse | null;

      if (!mounted) {
        return;
      }

      if (!response.ok) {
        setState("error");
        setMessage(result?.error ?? "评分历史读取失败。");
        return;
      }

      setRatings(result?.ratings ?? []);
      setState("success");
      setMessage("");
    }

    loadRatings().catch(() => {
      if (mounted) {
        setState("error");
        setMessage("评分历史读取失败。");
      }
    });

    return () => {
      mounted = false;
    };
  }, [supabase, user]);

  if (!isReady) {
    return <p className="section-note">正在检查登录状态...</p>;
  }

  if (!user) {
    return (
      <section className="empty-state">
        <strong>登录后查看自己的评分</strong>
        <p>评分历史只展示当前账号提交过的记录。</p>
        <Link className="button" href="/login?next=/ratings">
          <LogIn aria-hidden="true" size={16} />
          登录
        </Link>
      </section>
    );
  }

  return (
    <section className="my-ratings-panel">
      <div className="section-header">
        <div>
          <span className="eyebrow">
            <Star aria-hidden="true" size={15} />
            最近记录
          </span>
          <h2 className="section-title">我的评分</h2>
        </div>
        <p className="section-note">{state === "loading" ? "同步中..." : `${ratings.length} 条记录`}</p>
      </div>

      {state === "error" ? <p className="rating-form-note error">{message}</p> : null}

      {state === "success" && ratings.length === 0 ? (
        <div className="empty-state">
          <strong>还没有评分记录</strong>
          <p>打开任意店铺详情页，就可以给它留下自己的分数。</p>
          <Link className="button secondary" href="/lists/red-list">
            <ClipboardList aria-hidden="true" size={16} />
            去榜单看看
          </Link>
        </div>
      ) : null}

      <div className="my-ratings-list">
        {ratings.map((rating) => (
          <article className="my-rating-card" key={rating.id}>
            <div className="my-rating-score">
              <Star aria-hidden="true" size={18} />
              <strong>{formatScore(rating.score)}</strong>
            </div>
            <div className="my-rating-main">
              <div>
                <h3>{rating.place.name}</h3>
                <p>{rating.note || "没有备注。"}</p>
              </div>
              <div className="my-rating-meta">
                <span>{sourceLabels[rating.source]}</span>
                <span>{rating.list.name}</span>
                {rating.place.category ? <span>{rating.place.category}</span> : null}
                {rating.place.region ? (
                  <span>
                    <MapPin aria-hidden="true" size={13} />
                    {rating.place.region}
                  </span>
                ) : null}
                <span>
                  <Clock3 aria-hidden="true" size={13} />
                  {formatDate(rating.updatedAt)}
                </span>
              </div>
            </div>
            <Link className="button secondary my-rating-link" href={`/places/${rating.place.id}`}>
              详情
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
