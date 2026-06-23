import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceCard } from "@/components/place-card";
import { getCategories, getList, getListStats, getPlacesByList, getRegions } from "@/lib/places";

type ListPageProps = {
  params: {
    slug: string;
  };
};

export default function ListPage({ params }: ListPageProps) {
  const list = getList(params.slug);

  if (!list) {
    notFound();
  }

  const listPlaces = getPlacesByList(list.slug).sort(
    (a, b) => b.teamScore - a.teamScore || a.name.localeCompare(b.name, "zh-Hans-CN"),
  );
  const stats = getListStats(list.slug);
  const regions = getRegions();
  const categories = getCategories();

  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">{list.visibility === "public_rate" ? "公开查看与打分" : "公开查看"}</span>
        <h1 className="page-title">{list.name}</h1>
        <p className="page-lede">{list.description}</p>
      </section>

      <section className="container section">
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
            <span className="stat-label">队内均分</span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="filters">
          <button className="filter-chip">地区 {regions.length}</button>
          <button className="filter-chip">类型 {categories.length}</button>
          <button className="filter-chip">已探店</button>
          <Link className="filter-chip" href="/map">
            地图浏览
          </Link>
        </div>
        <div className="grid">
          {listPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </section>
    </>
  );
}
