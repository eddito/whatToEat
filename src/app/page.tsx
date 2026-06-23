import Link from "next/link";
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
            把朋友之间的探店记录做成真正的应用：红榜、再练练、地图探索、队内评分和公开打分会在这里慢慢长齐。
          </p>
          <div className="hero-actions">
            <Link className="button" href="/lists/red-list">
              看红榜
            </Link>
            <Link className="button secondary" href="/map">
              打开地图
            </Link>
          </div>
        </div>
        <div className="hero-panel">
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
            <span className="eyebrow">双宠物 Logo 方向</span>
            <p className="section-note">
              品牌围绕小狗和小猫设计，首版先使用圆形饭碗标识，后续可替换为正式双宠物 App 图标。
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
