import Link from "next/link";
import { ArrowRight, MapPinned, Sparkles, Trophy, Utensils } from "lucide-react";
import { ListCard } from "@/components/list-card";
import { PlaceCard } from "@/components/place-card";
import { getCategories, getRegions, getTopPlaces, lists, places } from "@/lib/places";

export default function HomePage() {
  const topPlaces = getTopPlaces(9);
  const regions = getRegions();
  const categories = getCategories();

  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <span className="eyebrow">重庆探店小队</span>
          <h1>今天吃什么</h1>
          <p>
            红榜、二刷候选、停车提示和队内评分都收在一起，打开就能决定今晚去哪一桌。
          </p>
          <div className="hero-actions">
            <Link className="button" href="/lists/red-list">
              <Trophy aria-hidden="true" size={17} />
              看红榜
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="button secondary" href="/map">
              <MapPinned aria-hidden="true" size={17} />
              打开地图
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <div className="spotlight-card">
            <span className="eyebrow">
              <Sparkles aria-hidden="true" size={14} />
              今日优先
            </span>
            <strong>{topPlaces[0]?.name}</strong>
            <span>{topPlaces[0]?.region || "重庆"} · 队内 {topPlaces[0]?.teamScore.toFixed(1) || "待评"} 分</span>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{places.length}</span>
              <span className="stat-label">店铺记录</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{regions.length}</span>
              <span className="stat-label">覆盖地区</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{categories.length}</span>
              <span className="stat-label">类型标签</span>
            </div>
          </div>
          <div className="info-card">
            <span className="eyebrow">
              <Utensils aria-hidden="true" size={14} />
              探店资料
            </span>
            <p className="section-note">
              已导入红榜和再练练共 {places.length} 条记录，后续会接入 Supabase 后台编辑。
            </p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <div>
            <h2 className="section-title">榜单</h2>
            <p className="section-note">榜单是权限和评分的核心单位，首版暂定全公开。</p>
          </div>
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
            <h2 className="section-title">优先试试</h2>
            <p className="section-note">按队内评分优先展示，后续会加入外部评分和混合总分。</p>
          </div>
          <Link className="text-link" href="/lists/red-list">
            查看全部
          </Link>
        </div>
        <div className="grid">
          {topPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </section>
    </>
  );
}
