import Link from "next/link";
import { getListStats } from "@/lib/places";
import type { ListSummary } from "@/lib/types";

export function ListCard({ list }: { list: ListSummary }) {
  const stats = getListStats(list.slug);

  return (
    <article className="list-card">
      <div>
        <span className="eyebrow">{list.visibility === "public_rate" ? "公开打分" : "公开查看"}</span>
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
        打开榜单
      </Link>
    </article>
  );
}
