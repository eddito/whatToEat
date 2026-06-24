import Link from "next/link";
import { MapPinned, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { getMixedScore } from "@/lib/score";
import { getPlace } from "@/lib/places";

type PlacePageProps = {
  params: {
    id: string;
  };
};

export default function PlacePage({ params }: PlacePageProps) {
  const place = getPlace(params.id);

  if (!place) {
    notFound();
  }

  const mixedScore = getMixedScore(place.teamScore, 0, 0);

  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">{place.listName}</span>
        <h1 className="page-title">{place.name}</h1>
        <p className="page-lede">{place.review || "这家店还缺一段认真评价。"}</p>
      </section>

      <section className="container detail-layout">
        <div className="detail-main">
          <article className="info-card">
            <h2>店铺信息</h2>
            <dl className="info-list">
              <div>
                <dt>类型</dt>
                <dd>{place.category || "待补"}</dd>
              </div>
              <div>
                <dt>口味</dt>
                <dd>{place.tasteTags.length ? place.tasteTags.join(" / ") : "待补"}</dd>
              </div>
              <div>
                <dt>特色菜</dt>
                <dd>{place.signatureDishes || "待补"}</dd>
              </div>
              <div>
                <dt>地区</dt>
                <dd>{place.region || "待补"}</dd>
              </div>
              <div>
                <dt>具体位置</dt>
                <dd>{place.locationLabel || "待补"}</dd>
              </div>
              <div>
                <dt>停车</dt>
                <dd>{place.parkingNote || "待补"}</dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{place.sourceLabel || "待补"}</dd>
              </div>
            </dl>
          </article>

          <article className="info-card">
            <h2>评价</h2>
            <p className="section-note">{place.review || "暂无评价。"}</p>
          </article>
        </div>

        <aside className="detail-side">
          <article className="info-card rating-card">
            <h3>
              <Star aria-hidden="true" size={18} />
              评分
            </h3>
            <dl className="info-list">
              <div>
                <dt>杨</dt>
                <dd>{place.memberScores.yang || "未评"}</dd>
              </div>
              <div>
                <dt>陈</dt>
                <dd>{place.memberScores.chen || "未评"}</dd>
              </div>
              <div>
                <dt>队内分</dt>
                <dd>{place.teamScore || "待评"}</dd>
              </div>
              <div>
                <dt>混合分</dt>
                <dd>{mixedScore || "待评"}</dd>
              </div>
            </dl>
          </article>

          <article className="info-card">
            <h3>
              <MapPinned aria-hidden="true" size={18} />
              地图
            </h3>
            <p className="section-note">地图页会用高德地图按店名和地区尝试定位。</p>
            <div style={{ marginTop: 14 }}>
              <Link className="button secondary" href="/map">
                <MapPinned aria-hidden="true" size={17} />
                打开地图
              </Link>
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
