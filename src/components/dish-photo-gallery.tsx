"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlaceDish } from "@/lib/types";

export function DishPhotoGallery({
  dishes = [],
  variant = "card",
}: {
  dishes?: PlaceDish[];
  variant?: "card" | "detail";
}) {
  const [activeDish, setActiveDish] = useState<PlaceDish | null>(null);

  useEffect(() => {
    if (!activeDish) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveDish(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDish]);

  if (dishes.length === 0) {
    return null;
  }

  return (
    <>
      <div className={variant === "detail" ? "dish-gallery detail" : "dish-gallery"} aria-label="特色菜照片">
        {dishes.slice(0, variant === "detail" ? 12 : 4).map((dish) => (
          <button
            aria-label={`预览${dish.name || "特色菜"}大图`}
            className="dish-thumb"
            key={dish.id}
            onClick={() => setActiveDish(dish)}
            type="button"
          >
            <Image src={dish.photoUrl} alt={dish.name || "特色菜"} width={160} height={120} />
            <span>{dish.name || "特色菜"}</span>
          </button>
        ))}
      </div>

      {activeDish ? (
        <div
          aria-labelledby="dish-lightbox-title"
          aria-modal="true"
          className="dish-lightbox"
          onClick={() => setActiveDish(null)}
          role="dialog"
        >
          <div className="dish-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              aria-label="关闭预览"
              className="dish-lightbox-close"
              onClick={() => setActiveDish(null)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
            <Image
              className="dish-lightbox-image"
              src={activeDish.photoUrl}
              alt={activeDish.name || "特色菜"}
              width={1080}
              height={810}
            />
            <div className="dish-lightbox-copy">
              <strong id="dish-lightbox-title">{activeDish.name || "特色菜"}</strong>
              <p>{activeDish.description || "暂无详情介绍。"}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
