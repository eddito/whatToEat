import Link from "next/link";
import { ChevronRight, MapPin, Star } from "lucide-react";
import type { Place } from "@/lib/types";

export function PlaceCard({ place }: { place: Place }) {
  const tags = [place.category, place.region, ...place.tasteTags].filter(Boolean).slice(0, 4);
  const scoreLabel = place.teamScore > 0 ? place.teamScore.toFixed(1) : "待评";

  return (
    <article className="place-card">
      <div className="place-card-top">
        <div>
          <h3 className="place-title">{place.name}</h3>
          <div className="meta-row" style={{ marginTop: 10 }}>
            <span className="meta-pill">{place.listName}</span>
            {place.visited ? <span className="meta-pill">已探店</span> : null}
          </div>
        </div>
        <span className="score-pill" aria-label={`队内评分 ${scoreLabel}`}>
          <Star aria-hidden="true" size={15} />
          {scoreLabel}
        </span>
      </div>

      <div className="tag-row">
        {tags.map((tag) => (
          <span className="tag" key={`${place.id}-${tag}`}>
            {tag}
          </span>
        ))}
      </div>

      <p className="review">{place.review || "还没有留下评价，等下一次探店补上。"}</p>

      <div className="card-footer">
        <span className="meta-pill location-pill">
          <MapPin aria-hidden="true" size={13} />
          {place.locationLabel || place.region || "位置待补"}
        </span>
        <Link className="text-link" href={`/places/${place.id}`}>
          看详情
          <ChevronRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </article>
  );
}
