import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { normalizeCategory, normalizeRegion } from "@/lib/display";
import type { Place } from "@/lib/types";

function getTagTone(tag: string) {
  if (tag === "红榜") return "red";
  if (tag === "再练练") return "retry";
  if (tag.endsWith("区")) return "blue";
  if (tag === "已探店") return "green";
  return "neutral";
}

export function PlaceCard({ place }: { place: Place }) {
  const displayRegion = normalizeRegion(place.region);
  const displayCategory = normalizeCategory(place.category);
  const tags = [place.listName, displayCategory, displayRegion, place.visited ? "已探店" : "", ...place.tasteTags]
    .filter(Boolean)
    .slice(0, 6);
  const scoreLabel = place.teamScore > 0 ? place.teamScore.toFixed(1) : "待评";
  const yangScore = place.memberScores.yang ? place.memberScores.yang.toFixed(1) : "待评";
  const chenScore = place.memberScores.chen ? place.memberScores.chen.toFixed(1) : "待评";

  return (
    <article className="place-card">
      <div className="place-card-top">
        <h3 className="place-title">{place.name}</h3>
        <span className="score-pill" aria-label={`队内评分 ${scoreLabel}`}>
          {scoreLabel}
        </span>
      </div>

      <div className="tag-row">
        {tags.map((tag) => (
          <span className={`tag tag-${getTagTone(tag)}`} key={`${place.id}-${tag}`}>
            {tag}
          </span>
        ))}
      </div>

      <p className="review">{place.review || "还没有留下评价，等下一次探店补上。"}</p>

      <div className="rating-line" aria-label="成员评分">
        <span className="rating-stars" aria-hidden="true">
          ★★★★★
        </span>
        <span>杨 {yangScore}</span>
        <span>陈 {chenScore}</span>
      </div>

      <div className="card-footer">
        <span className="location-pill">
          <MapPin aria-hidden="true" size={13} />
          {displayRegion || "位置待补"}
        </span>
        <Link className="text-link" href={`/places/${place.id}`}>
          看详情
          <ChevronRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </article>
  );
}
