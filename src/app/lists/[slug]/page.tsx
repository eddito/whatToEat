import Link from "next/link";
import { Filter, Search, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { PlaceCard } from "@/components/place-card";
import { normalizeRegion, splitCategory } from "@/lib/display";
import { getListPageData } from "@/lib/public-data";

type ListPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    q?: string | string[];
    region?: string | string[];
    category?: string | string[];
    sort?: string | string[];
  }>;
};

type SortKey = "score-desc" | "score-asc" | "name";

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

function getRankingScore(place: { mixedScore?: number; teamScore: number }) {
  return place.mixedScore || place.teamScore;
}

function getSortValue(value: string | string[] | undefined): SortKey {
  const sort = getSearchValue(value);

  return sort === "score-asc" || sort === "name" ? sort : "score-desc";
}

export default async function ListPage({ params, searchParams }: ListPageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const pageData = await getListPageData(slug);

  if (!pageData) {
    notFound();
  }

  const { list, lists, places, stats } = pageData;
  const listPlaces = places.sort(
    (a, b) => getRankingScore(b) - getRankingScore(a) || a.name.localeCompare(b.name, "zh-Hans-CN"),
  );
  const regions = Array.from(new Set(listPlaces.map((place) => normalizeRegion(place.region)).filter(Boolean))).sort();
  const categories = Array.from(new Set(listPlaces.flatMap((place) => splitCategory(place.category)).filter(Boolean))).sort();
  const keyword = getSearchValue(resolvedSearchParams?.q).trim();
  const selectedRegion = getSearchValue(resolvedSearchParams?.region);
  const selectedCategory = getSearchValue(resolvedSearchParams?.category);
  const selectedSort = getSortValue(resolvedSearchParams?.sort);
  const normalizedKeyword = keyword.toLowerCase();
  const filteredPlaces = listPlaces
    .filter((place) => {
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
    })
    .sort((a, b) => {
      if (selectedSort === "score-asc") {
        return getRankingScore(a) - getRankingScore(b) || a.name.localeCompare(b.name, "zh-Hans-CN");
      }

      if (selectedSort === "name") {
        return a.name.localeCompare(b.name, "zh-Hans-CN") || getRankingScore(b) - getRankingScore(a);
      }

      return getRankingScore(b) - getRankingScore(a) || a.name.localeCompare(b.name, "zh-Hans-CN");
    });
  const hasActiveSearch = Boolean(keyword || selectedRegion || selectedCategory || selectedSort !== "score-desc");
  const baseFilterParams = {
    q: keyword,
    region: selectedRegion,
    category: selectedCategory,
    sort: selectedSort === "score-desc" ? "" : selectedSort,
  };
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
            <span className="filter-button" aria-label="筛选区域">
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
          <form action={`/lists/${list.slug}`} className="list-search-form">
            <label className="list-search-field">
              <span>搜索店铺</span>
              <Search aria-hidden="true" size={16} />
              <input defaultValue={keyword} name="q" placeholder="店名、特色菜、位置或评价" type="search" />
            </label>
            {selectedRegion ? <input name="region" type="hidden" value={selectedRegion} /> : null}
            {selectedCategory ? <input name="category" type="hidden" value={selectedCategory} /> : null}
            {selectedSort !== "score-desc" ? <input name="sort" type="hidden" value={selectedSort} /> : null}
            <button className="button secondary" type="submit">
              <Search aria-hidden="true" size={15} />
              搜索
            </button>
          </form>

          <div className="chip-group">
            <span className="chip-label">地区</span>
            <Link
              className={!selectedRegion ? "filter-chip active" : "filter-chip"}
              href={buildFilterHref(list.slug, { ...baseFilterParams, region: "" })}
            >
              全部
            </Link>
            {regions.map((region) => (
              <Link
                className={selectedRegion === region ? "filter-chip active" : "filter-chip"}
                href={buildFilterHref(list.slug, { ...baseFilterParams, region })}
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
              href={buildFilterHref(list.slug, { ...baseFilterParams, category: "" })}
            >
              全部
            </Link>
            {categories.map((category) => (
              <Link
                className={selectedCategory === category ? "filter-chip active dark" : "filter-chip"}
                href={buildFilterHref(list.slug, { ...baseFilterParams, category })}
                key={category}
              >
                {category}
              </Link>
            ))}
          </div>

          <div className="chip-group">
            <span className="chip-label">排序</span>
            <Link
              className={selectedSort === "score-desc" ? "filter-chip active dark" : "filter-chip"}
              href={buildFilterHref(list.slug, { ...baseFilterParams, sort: "" })}
            >
              评分↓
            </Link>
            <Link
              className={selectedSort === "score-asc" ? "filter-chip active dark" : "filter-chip"}
              href={buildFilterHref(list.slug, { ...baseFilterParams, sort: "score-asc" })}
            >
              评分↑
            </Link>
            <Link
              className={selectedSort === "name" ? "filter-chip active dark" : "filter-chip"}
              href={buildFilterHref(list.slug, { ...baseFilterParams, sort: "name" })}
            >
              名称
            </Link>
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
