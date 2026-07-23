"use client";

import Link from "next/link";
import { Database, ListChecks, LockKeyhole, ShieldCheck, Star, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

type AdminSummary = {
  team: {
    name: string;
    slug: string;
  };
  currentUser: {
    role: "owner" | "member" | "viewer";
    name: string;
  };
  stats: {
    places: number;
    lists: number;
    ratings: number;
    members: number;
  };
  members: Array<{
    name: string;
    role: "owner" | "member" | "viewer";
    joinedAt: string;
  }>;
};

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "error";

const roleLabels = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function AdminDashboard() {
  const supabase = getBrowserSupabase();
  const [state, setState] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      if (!supabase) {
        setState("error");
        setMessage("缺少 Supabase 前端环境变量。");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setState("signed-out");
        return;
      }

      const response = await fetch("/api/admin/summary", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const result = (await response.json().catch(() => null)) as AdminSummary | { error?: string } | null;

      if (!mounted) {
        return;
      }

      if (!response.ok) {
        setState(response.status === 403 ? "forbidden" : "error");
        setMessage(result && "error" in result ? result.error ?? "后台数据加载失败。" : "后台数据加载失败。");
        return;
      }

      setSummary(result as AdminSummary);
      setState("ready");
    }

    void loadSummary();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (state === "loading") {
    return (
      <section className="container section">
        <div className="admin-panel admin-state-panel">
          <strong>正在加载后台数据...</strong>
          <p className="section-note">会先确认登录状态和小队成员身份。</p>
        </div>
      </section>
    );
  }

  if (state === "signed-out") {
    return (
      <section className="container section">
        <div className="admin-panel admin-state-panel">
          <LockKeyhole aria-hidden="true" size={24} />
          <strong>需要登录</strong>
          <p className="section-note">后台只对小队成员开放。登录后会自动读取你的角色。</p>
          <Link className="button secondary" href="/login?next=/admin">
            去登录
          </Link>
        </div>
      </section>
    );
  }

  if (state === "forbidden" || state === "error" || !summary) {
    return (
      <section className="container section">
        <div className="admin-panel admin-state-panel">
          <ShieldCheck aria-hidden="true" size={24} />
          <strong>{state === "forbidden" ? "没有后台权限" : "后台暂时不可用"}</strong>
          <p className="section-note">{message || "请稍后重试。"}</p>
        </div>
      </section>
    );
  }

  const metrics = [
    { label: "店铺", value: summary.stats.places, icon: Database },
    { label: "榜单", value: summary.stats.lists, icon: ListChecks },
    { label: "评分", value: summary.stats.ratings, icon: Star },
    { label: "成员", value: summary.stats.members, icon: UsersRound },
  ];

  return (
    <>
      <section className="container section">
        <div className="admin-overview">
          <div>
            <span className="eyebrow">{summary.team.slug}</span>
            <h2 className="section-title">{summary.team.name}</h2>
            <p className="section-note">
              当前账号 {summary.currentUser.name}，角色 {roleLabels[summary.currentUser.role]}。
            </p>
          </div>
          <span className={`admin-role-badge role-${summary.currentUser.role}`}>
            <ShieldCheck aria-hidden="true" size={14} />
            {roleLabels[summary.currentUser.role]}
          </span>
        </div>
      </section>

      <section className="container section compact-section">
        <div className="admin-grid four">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div className="admin-panel admin-metric" key={metric.label}>
                <span className="task-icon">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span className="stat-value">{metric.value}</span>
                <span className="stat-label">{metric.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="container section">
        <div className="admin-panel">
          <div className="section-header tight">
            <div>
              <h2 className="section-title">成员</h2>
              <p className="section-note">当前先开放只读成员列表，角色管理会在下一切片补上。</p>
            </div>
          </div>
          <div className="member-table" role="table" aria-label="小队成员">
            <div className="member-row header" role="row">
              <span role="columnheader">成员</span>
              <span role="columnheader">角色</span>
              <span role="columnheader">加入</span>
            </div>
            {summary.members.map((member) => (
              <div className="member-row" key={`${member.name}-${member.joinedAt}`} role="row">
                <span role="cell">
                  <strong>{member.name}</strong>
                </span>
                <span role="cell">{roleLabels[member.role]}</span>
                <span role="cell">{formatDate(member.joinedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
