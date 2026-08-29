"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlaceDishPhoto } from "@/lib/types";

export function DishPhotoGallery({
  photos = [],
  variant = "card",
}: {
  photos?: PlaceDishPhoto[];
  variant?: "card" | "detail";
}) {
  const [activePhoto, setActivePhoto] = useState<PlaceDishPhoto | null>(null);

  useEffect(() => {
    if (!activePhoto) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePhoto(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePhoto]);

  if (photos.length === 0) {
    return null;
  }

  return (
    <>
      <div className={variant === "detail" ? "dish-gallery detail" : "dish-gallery"} aria-label="特色菜照片">
        {photos.slice(0, variant === "detail" ? 12 : 4).map((photo) => (
          <button
            aria-label={`预览${photo.dishName || "特色菜"}大图`}
            className="dish-thumb"
            key={photo.id}
            onClick={() => setActivePhoto(photo)}
            type="button"
          >
            <Image src={photo.url} alt={photo.dishName || "特色菜"} width={160} height={120} />
            <span>{photo.dishName || "特色菜"}</span>
          </button>
        ))}
      </div>

      {activePhoto ? (
        <div
          aria-labelledby="dish-lightbox-title"
          aria-modal="true"
          className="dish-lightbox"
          onClick={() => setActivePhoto(null)}
          role="dialog"
        >
          <div className="dish-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              aria-label="关闭预览"
              className="dish-lightbox-close"
              onClick={() => setActivePhoto(null)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
            <Image
              className="dish-lightbox-image"
              src={activePhoto.url}
              alt={activePhoto.dishName || "特色菜"}
              width={1080}
              height={810}
            />
            <div className="dish-lightbox-copy">
              <strong id="dish-lightbox-title">{activePhoto.dishName || "特色菜"}</strong>
              <p>{activePhoto.dishDescription || "暂无详情介绍。"}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
