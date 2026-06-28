import Link from "next/link";
import { ArrowRight, MapPinned, Star, Tags, Trophy } from "lucide-react";
import { ListCard } from "@/components/list-card";
import { PlaceCard } from "@/components/place-card";
import { getCategories, getRegions, getTopPlaces, lists, places } from "@/lib/places";

export default function HomePage() {
  const topPlaces = getTopPlaces(9);
  const regions = getRegions();
  const categories = getCategories();
  const visitedCount = places.filter((place) => place.visited).length;
  const scoredCount = places.filter((place) => place.teamScore > 0).length;

  return (
    <>
      <section className="container home-dashboard">
        <div className="home-title-row">
          <div>
            <span className="eyebrow">重庆探店小队</span>
            <h1 className="page-title">今天吃什么</h1>
          </div>
          <div className="hero-actions">
            <Link className="button" href="/lists/red-list">
              <Trophy aria-hidden="true" size={17} />
              看红榜
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="button secondary" href="/map">
              <MapPinned aria-hidden="true" size={17} />
              地图
            </Link>
          </div>
        </div>

        <div className="stat-grid home-stats">
          <div className="stat-card">
            <span className="stat-value">{places.length}</span>
            <span className="stat-label">店铺总数</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{visitedCount}</span>
            <span className="stat-label">已探店</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{scoredCount}</span>
            <span className="stat-label">已评分</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{regions.length}</span>
            <span className="stat-label">覆盖地区</span>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">探店榜单</h2>
          <Link className="text-link" href="/lists/red-list">
            全部
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
        <div className="list-grid">
          {lists.map((list) => (
            <ListCard key={list.slug} list={list} />
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <div>
            <h2 className="section-title">
              优先试试
              <span className="inline-title-note">
                <Star aria-hidden="true" size={15} />
                4.5+
              </span>
            </h2>
            <p className="section-note">队内高分优先展示，适合快速决定今晚去哪一桌。</p>
          </div>
          <Link className="text-link" href="/lists/red-list">
            查看全部
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
        <div className="grid">
          {topPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </section>

      <section className="container section compact-section">
        <div className="type-strip" aria-label="类型分布">
          <span>
            <Tags aria-hidden="true" size={15} />
            类型分布
          </span>
          {categories.slice(0, 8).map((category) => (
            <Link href={`/lists/red-list?category=${encodeURIComponent(category)}`} key={category}>
              {category}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
