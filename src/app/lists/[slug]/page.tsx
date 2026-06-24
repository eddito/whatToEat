import Link from "next/link";
import { ArrowDownWideNarrow, Filter, MapPinned, Search, ShieldCheck, Tags, TrendingUp, X } from "lucide-react";
import { notFound } from "next/navigation";
import { PlaceCard } from "@/components/place-card";
import { getList, getListStats, getPlacesByList } from "@/lib/places";

type ListPageProps = {
  params: {
    slug: string;
  };
  searchParams?: {
    q?: string | string[];
    region?: string | string[];
    category?: string | string[];
  };
};

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function ListPage({ params, searchParams }: ListPageProps) {
  const list = getList(params.slug);

  if (!list) {
    notFound();
  }

  const listPlaces = getPlacesByList(list.slug).sort(
    (a, b) => b.teamScore - a.teamScore || a.name.localeCompare(b.name, "zh-Hans-CN"),
  );
  const stats = getListStats(list.slug);
  const regions = Array.from(new Set(listPlaces.map((place) => place.region).filter(Boolean))).sort();
  const categories = Array.from(new Set(listPlaces.map((place) => place.category).filter(Boolean))).sort();
  const keyword = getSearchValue(searchParams?.q).trim();
  const selectedRegion = getSearchValue(searchParams?.region);
  const selectedCategory = getSearchValue(searchParams?.category);
  const normalizedKeyword = keyword.toLowerCase();
  const filteredPlaces = listPlaces.filter((place) => {
    const matchesRegion = selectedRegion ? place.region === selectedRegion : true;
    const matchesCategory = selectedCategory ? place.category === selectedCategory : true;
    const searchableText = [
      place.name,
      place.category,
      place.region,
      place.locationLabel,
      place.signatureDishes,
      place.review,
      ...place.tasteTags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesKeyword = normalizedKeyword ? searchableText.includes(normalizedKeyword) : true;

    return matchesRegion && matchesCategory && matchesKeyword;
  });
  const hasActiveSearch = Boolean(keyword || selectedRegion || selectedCategory);
  const visitedCount = listPlaces.filter((place) => place.visited).length;
  const topRatedCount = listPlaces.filter((place) => place.teamScore >= 4.5).length;
  const topScore = listPlaces[0]?.teamScore ?? 0;

  return (
    <>
      <section className="container page-head list-page-head">
        <div className="list-title-block">
          <span className="eyebrow">
            <ShieldCheck aria-hidden="true" size={14} />
            {list.visibility === "public_rate" ? "公开查看与打分" : "公开查看"}
          </span>
          <h1 className="page-title">{list.name}</h1>
          <p className="page-lede">{list.description}</p>
        </div>

        <div className="list-head-panel" aria-label={`${list.name}概览`}>
          <div className="list-score-focus">
            <span className="eyebrow">
              <TrendingUp aria-hidden="true" size={14} />
              当前榜首
            </span>
            <strong>{listPlaces[0]?.name || "暂无店铺"}</strong>
            <span>{topScore > 0 ? `队内 ${topScore.toFixed(1)} 分` : "等待评分"}</span>
          </div>
          <div className="stat-grid list-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.count}</span>
              <span className="stat-label">店铺</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{visitedCount}</span>
              <span className="stat-label">已探店</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{topRatedCount}</span>
              <span className="stat-label">4.5 分以上</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.avgScore || "-"}</span>
              <span className="stat-label">队内均分</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="list-toolbar">
          <div>
            <h2 className="section-title">店铺列表</h2>
            <p className="section-note">按队内评分从高到低排列，同分时按店名排序。</p>
          </div>
          <span className="sort-badge">
            <ArrowDownWideNarrow aria-hidden="true" size={16} />
            队内分优先
          </span>
        </div>

        <form className="search-panel" action={`/lists/${list.slug}`} aria-label="店铺搜索条件">
          <div className="search-form">
            <label className="field">
              <span>
                <Search aria-hidden="true" size={15} />
                关键词
              </span>
              <input name="q" placeholder="店名、菜品、评价" type="search" defaultValue={keyword} />
            </label>

            <label className="field">
              <span>
                <Filter aria-hidden="true" size={15} />
                地区
              </span>
              <select name="region" defaultValue={selectedRegion}>
                <option value="">全部地区</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>
                <Tags aria-hidden="true" size={15} />
                类型
              </span>
              <select name="category" defaultValue={selectedCategory}>
                <option value="">全部类型</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <div className="search-actions">
              <button className="button" type="submit">
                <Search aria-hidden="true" size={16} />
                搜索
              </button>
              {hasActiveSearch ? (
                <Link className="button secondary" href={`/lists/${list.slug}`}>
                  <X aria-hidden="true" size={16} />
                  清空
                </Link>
              ) : null}
            </div>
          </div>

          <div className="filter-summary" aria-live="polite">
            <span>
              当前显示 <strong>{filteredPlaces.length}</strong> / {listPlaces.length} 家
            </span>
            <Link className="filter-chip compact" href="/map">
              <MapPinned aria-hidden="true" size={16} />
              <span>地图浏览</span>
            </Link>
          </div>
        </form>

        {filteredPlaces.length > 0 ? (
          <div className="grid">
            {filteredPlaces.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>没有找到符合条件的店</strong>
            <p>换一个地区、类型或关键词再试。</p>
            <Link className="button secondary" href={`/lists/${list.slug}`}>
              清空搜索条件
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
