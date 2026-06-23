"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "@/lib/types";

declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

type AmapExplorerProps = {
  places: Place[];
};

export function AmapExplorer({ places }: AmapExplorerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"missing-key" | "loading" | "ready" | "error">("loading");
  const key = process.env.NEXT_PUBLIC_AMAP_KEY;

  const visiblePlaces = useMemo(
    () => places.filter((place) => place.locationLabel || place.region).slice(0, 36),
    [places],
  );

  useEffect(() => {
    if (!key) {
      setStatus("missing-key");
      return;
    }

    if (!mapRef.current) {
      return;
    }

    let cancelled = false;

    const createMap = () => {
      if (!mapRef.current || !window.AMap || cancelled) {
        return;
      }

      const map = new window.AMap.Map(mapRef.current, {
        zoom: 11,
        center: [106.5516, 29.563],
        viewMode: "2D",
      });

      window.AMap.plugin(["AMap.Scale", "AMap.ToolBar", "AMap.Geocoder"], () => {
        map.addControl(new window.AMap.Scale());
        map.addControl(new window.AMap.ToolBar({ position: "RT" }));

        const geocoder = new window.AMap.Geocoder({
          city: "重庆",
        });

        visiblePlaces.forEach((place) => {
          const query = [place.locationLabel, place.region, "重庆"].filter(Boolean).join(" ");
          geocoder.getLocation(query, (resultStatus: string, result: any) => {
            if (cancelled || resultStatus !== "complete" || !result?.geocodes?.[0]) {
              return;
            }

            const location = result.geocodes[0].location;
            const marker = new window.AMap.Marker({
              position: location,
              title: place.name,
            });

            marker.on("click", () => {
              const info = new window.AMap.InfoWindow({
                content: `<div style="font-size:13px;line-height:1.5;padding:2px 0"><strong>${place.name}</strong><br/>${place.category || ""} ${place.region || ""}<br/>队内评分 ${place.teamScore || "待评"}</div>`,
                offset: new window.AMap.Pixel(0, -28),
              });
              info.open(map, location);
            });

            map.add(marker);
          });
        });
      });

      setStatus("ready");
    };

    if (window.AMap) {
      createMap();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
    script.async = true;
    script.onload = createMap;
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [key, visiblePlaces]);

  if (status === "missing-key") {
    return (
      <div className="map-fallback">
        <div>
          <h2>地图待启用</h2>
          <p>填入 `NEXT_PUBLIC_AMAP_KEY` 后，这里会加载高德地图并标记店铺位置。</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="map-fallback">
        <div>
          <h2>地图加载失败</h2>
          <p>请检查高德地图 key、域名白名单和网络状态。</p>
        </div>
      </div>
    );
  }

  return <div aria-label="探店地图" className="map-canvas" ref={mapRef} />;
}
