import Link from "next/link";
import { ArrowRight, LockKeyhole, MessageCircle, Trophy } from "lucide-react";
import { getListStats } from "@/lib/places";
import type { ListSummary } from "@/lib/types";

export function ListCard({ list }: { list: ListSummary }) {
  const stats = getListStats(list.slug);
  const isOpenRate = list.visibility === "public_rate";
  const isPrimaryList = list.slug === "red-list";

  return (
    <article className={isPrimaryList ? "list-card primary-list-card" : "list-card"}>
      <div>
        <span className="eyebrow list-eyebrow">
          {isOpenRate ? <MessageCircle aria-hidden="true" size={14} /> : <LockKeyhole aria-hidden="true" size={14} />}
          {isOpenRate ? "公开打分" : "公开查看"}
        </span>
        <h3>{list.name}</h3>
      </div>
      <p>{list.description}</p>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.count}</span>
          <span className="stat-label">店铺</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.scoredCount}</span>
          <span className="stat-label">已评分</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.avgScore || "-"}</span>
          <span className="stat-label">均分</span>
        </div>
      </div>
      <Link className="button secondary" href={`/lists/${list.slug}`}>
        <Trophy aria-hidden="true" size={17} />
        打开榜单
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </article>
  );
}
