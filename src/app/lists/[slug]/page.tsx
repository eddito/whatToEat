import Link from "next/link";
import { Filter, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { PlaceCard } from "@/components/place-card";
import { normalizeRegion, splitCategory } from "@/lib/display";
import { getList, getListStats, getPlacesByList, lists } from "@/lib/places";

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

function buildFilterHref(slug: string, params: Record<string, string>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `/lists/${slug}?${queryString}` : `/lists/${slug}`;
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
  const regions = Array.from(new Set(listPlaces.map((place) => normalizeRegion(place.region)).filter(Boolean))).sort();
  const categories = Array.from(new Set(listPlaces.flatMap((place) => splitCategory(place.category)).filter(Boolean))).sort();
  const keyword = getSearchValue(searchParams?.q).trim();
  const selectedRegion = getSearchValue(searchParams?.region);
  const selectedCategory = getSearchValue(searchParams?.category);
  const normalizedKeyword = keyword.toLowerCase();
  const filteredPlaces = listPlaces.filter((place) => {
    const matchesRegion = selectedRegion ? normalizeRegion(place.region) === selectedRegion : true;
    const matchesCategory = selectedCategory ? splitCategory(place.category).includes(selectedCategory) : true;
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

  return (
    <>
      <section className="container list-board">
        <div className="list-board-top">
          <nav className="list-switcher" aria-label="榜单切换">
            {lists.map((item) => (
              <Link
                className={item.slug === list.slug ? "list-switch active" : "list-switch"}
                href={`/lists/${item.slug}`}
                key={item.slug}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="list-board-actions">
            <span className="permission-badge">
              <ShieldCheck aria-hidden="true" size={14} />
              {list.visibility === "public_rate" ? "公开查看" : "公开查看"}
            </span>
            <span className="filter-button">
              <Filter aria-hidden="true" size={16} />
              筛选
            </span>
          </div>
        </div>

        <div className="list-metrics" aria-label={`${list.name}概览`}>
          <span>
            <strong>{stats.count}</strong> 家店铺
          </span>
          <span>
            <strong>{stats.scoredCount}</strong> 已评分
          </span>
          <span>
            队内均分 <strong>{stats.avgScore || "-"}</strong>
          </span>
          <span className="muted-metric">{visitedCount} 家已探店</span>
        </div>

        <div className="chip-filter-panel" aria-label="店铺筛选条件">
          <div className="chip-group">
            <span className="chip-label">地区</span>
            <Link
              className={!selectedRegion ? "filter-chip active" : "filter-chip"}
              href={buildFilterHref(list.slug, { q: keyword, category: selectedCategory })}
            >
              全部
            </Link>
            {regions.map((region) => (
              <Link
                className={selectedRegion === region ? "filter-chip active" : "filter-chip"}
                href={buildFilterHref(list.slug, { q: keyword, region, category: selectedCategory })}
                key={region}
              >
                {region}
              </Link>
            ))}
          </div>

          <div className="chip-group">
            <span className="chip-label">类型</span>
            <Link
              className={!selectedCategory ? "filter-chip active dark" : "filter-chip"}
              href={buildFilterHref(list.slug, { q: keyword, region: selectedRegion })}
            >
              全部
            </Link>
            {categories.map((category) => (
              <Link
                className={selectedCategory === category ? "filter-chip active dark" : "filter-chip"}
                href={buildFilterHref(list.slug, { q: keyword, region: selectedRegion, category })}
                key={category}
              >
                {category}
              </Link>
            ))}
          </div>

          <div className="chip-group">
            <span className="chip-label">排序</span>
            <span className="filter-chip active dark">评分↓</span>
            <span className="filter-chip">评分↑</span>
            <span className="filter-chip">名称</span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="list-result-line" aria-live="polite">
          <span>
            当前显示 <strong>{filteredPlaces.length}</strong> / {listPlaces.length} 家
          </span>
          {hasActiveSearch ? <Link href={`/lists/${list.slug}`}>清空筛选</Link> : null}
        </div>

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
