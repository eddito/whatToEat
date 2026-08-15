"use client";

import Link from "next/link";
import { LocateFixed, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "@/lib/types";

type AmapLocation = [number, number] | { lat: number; lng: number };

type AmapMapInstance = {
  add: (item: unknown) => void;
  destroy?: () => void;
  setFitView?: () => void;
  setZoomAndCenter?: (zoom: number, center: AmapLocation) => void;
};

type AmapMarkerInstance = {
  getPosition?: () => AmapLocation;
  on: (event: "click", callback: () => void) => void;
};

type AmapApi = {
  Map: new (element: HTMLDivElement, options: { center: [number, number]; viewMode: "2D"; zoom: number }) => AmapMapInstance;
  Marker: new (options: { position: AmapLocation; title: string }) => AmapMarkerInstance;
  Pixel: new (x: number, y: number) => unknown;
  InfoWindow: new (options: { content: HTMLElement; offset: unknown }) => { open: (map: AmapMapInstance, position: AmapLocation) => void };
  Scale: new () => unknown;
  ToolBar: new (options: { position: "RT" }) => unknown;
  plugin: (plugins: string[], callback: () => void) => void;
};

declare global {
  interface Window {
    AMap?: AmapApi;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

type AmapExplorerProps = {
  places: Place[];
};

let amapLoaderPromise: Promise<void> | null = null;

const CHONGQING_CENTER: [number, number] = [106.5516, 29.563];
const REGION_CENTERS: Record<string, [number, number]> = {
  九龙坡区: [106.511, 29.501],
  江北区: [106.574, 29.606],
  南岸区: [106.644, 29.501],
  沙坪坝区: [106.457, 29.541],
  渝中区: [106.568, 29.552],
  渝北区: [106.63, 29.718],
  大渡口区: [106.482, 29.485],
  巴南区: [106.54, 29.402],
  北碚区: [106.396, 29.805],
};

function loadAmap(key: string) {
  if (window.AMap) {
    return Promise.resolve();
  }

  if (amapLoaderPromise) {
    return amapLoaderPromise;
  }

  amapLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-amap-loader='true']");

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("AMap script failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.dataset.amapLoader = "true";
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("AMap script failed to load.")), { once: true });
    document.head.appendChild(script);
  });

  return amapLoaderPromise;
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("zh-Hans-CN");
}

function getPlaceScore(place: Place) {
  return place.mixedScore || place.teamScore || place.externalScore || 0;
}

function getPlaceLocation(place: Place): AmapLocation | null {
  if (typeof place.longitude === "number" && typeof place.latitude === "number") {
    return [place.longitude, place.latitude];
  }

  return null;
}

function getHash(value: string) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 7);
}

function getApproximateLocation(place: Place, index: number): AmapLocation {
  const center = REGION_CENTERS[place.region] ?? CHONGQING_CENTER;
  const hash = getHash(`${place.id}-${place.name}-${index}`);
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = 0.004 + (hash % 9) * 0.0016;

  return [Number((center[0] + Math.cos(angle) * radius).toFixed(6)), Number((center[1] + Math.sin(angle) * radius).toFixed(6))];
}

function buildInfoWindowContent(place: Place) {
  const wrapper = document.createElement("div");
  wrapper.className = "map-info-window";

  const title = document.createElement("strong");
  title.textContent = place.name;
  wrapper.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = [place.category, place.region].filter(Boolean).join(" · ");
  wrapper.appendChild(meta);

  const score = document.createElement("span");
  score.textContent = `综合 ${getPlaceScore(place) ? getPlaceScore(place).toFixed(1) : "待评"}`;
  wrapper.appendChild(score);

  return wrapper;
}

export function AmapExplorer({ places }: AmapExplorerProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const amapRef = useRef<AmapMapInstance | null>(null);
  const markersRef = useRef(new Map<string, { marker: AmapMarkerInstance; position: AmapLocation }>());
  const [status, setStatus] = useState<"missing-key" | "loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("全部");
  const [category, setCategory] = useState("全部");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locatedCount, setLocatedCount] = useState(0);
  const key = process.env.NEXT_PUBLIC_AMAP_KEY;

  const candidatePlaces = useMemo(
    () => places.filter((place) => place.locationLabel || place.region || getPlaceLocation(place)).slice(0, 80),
    [places],
  );

  const regions = useMemo(
    () => ["全部", ...Array.from(new Set(candidatePlaces.map((place) => place.region).filter(Boolean))).sort()],
    [candidatePlaces],
  );

  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(candidatePlaces.map((place) => place.category).filter(Boolean))).sort()],
    [candidatePlaces],
  );

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return candidatePlaces.filter((place) => {
      const matchesRegion = region === "全部" || place.region === region;
      const matchesCategory = category === "全部" || place.category === category;
      const matchesQuery =
        !normalizedQuery ||
        [place.name, place.category, place.region, place.locationLabel, place.signatureDishes, place.review]
          .filter(Boolean)
          .some((value) => normalizeText(value).includes(normalizedQuery));

      return matchesRegion && matchesCategory && matchesQuery;
    });
  }, [candidatePlaces, category, query, region]);

  const selectedPlace = filteredPlaces.find((place) => place.id === selectedId) ?? filteredPlaces[0] ?? null;

  useEffect(() => {
    if (!key) {
      setStatus("missing-key");
      return;
    }

    if (!mapElementRef.current) {
      return;
    }

    let cancelled = false;
    const markerStore = new Map<string, { marker: AmapMarkerInstance; position: AmapLocation }>();

    setStatus("loading");
    setLocatedCount(0);
    markersRef.current = markerStore;

    loadAmap(key)
      .then(() => {
        if (!mapElementRef.current || !window.AMap || cancelled) {
          return;
        }

        const AMap = window.AMap;
        const map = new AMap.Map(mapElementRef.current, {
          zoom: 11,
          center: CHONGQING_CENTER,
          viewMode: "2D",
        });

        amapRef.current = map;
        markerStore.clear();

        AMap.plugin(["AMap.Scale", "AMap.ToolBar"], () => {
          if (cancelled) {
            return;
          }

          map.add(new AMap.Scale());
          map.add(new AMap.ToolBar({ position: "RT" }));

          const addMarker = (place: Place, position: AmapLocation) => {
            if (cancelled) {
              return;
            }

            const marker = new AMap.Marker({
              position,
              title: place.name,
            });

            marker.on("click", () => {
              setSelectedId(place.id);
              new AMap.InfoWindow({
                content: buildInfoWindowContent(place),
                offset: new AMap.Pixel(0, -28),
              }).open(map, position);
            });

            map.add(marker);
            markerStore.set(place.id, { marker, position });
            setLocatedCount((count) => count + 1);
          };

          filteredPlaces.slice(0, 40).forEach((place, index) => {
            addMarker(place, getPlaceLocation(place) ?? getApproximateLocation(place, index));
          });

          setStatus("ready");
          window.setTimeout(() => {
            if (!cancelled) {
              map.setFitView?.();
            }
          }, 600);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      markerStore.clear();
      amapRef.current?.destroy?.();
      amapRef.current = null;
    };
  }, [filteredPlaces, key]);

  function focusPlace(place: Place) {
    setSelectedId(place.id);
    const markerEntry = markersRef.current.get(place.id);

    if (markerEntry) {
      amapRef.current?.setZoomAndCenter?.(15, markerEntry.position);
    }
  }

  return (
    <div className="map-explorer">
      <div className="map-stage">
        {status === "missing-key" ? (
          <div className="map-fallback">
            <div>
              <MapPin aria-hidden="true" size={28} />
              <h2>地图待启用</h2>
              <p>配置 `NEXT_PUBLIC_AMAP_KEY` 后会显示高德地图；当前位置清单仍可用于筛选店铺。</p>
            </div>
          </div>
        ) : (
          <>
            <div aria-label="探店地图" className="map-canvas" ref={mapElementRef} />
            <div className="map-status">
              {status === "loading" ? "地图加载中" : status === "error" ? "地图加载失败" : `已标记 ${locatedCount} 家`}
            </div>
          </>
        )}
      </div>

      <aside className="map-sidebar" aria-label="地图店铺筛选">
        <div className="map-tools">
          <label className="field">
            <span>
              <Search aria-hidden="true" size={14} />
              搜索
            </span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="店名、菜系、地区"
              type="search"
              value={query}
            />
          </label>

          <div className="map-filter-grid">
            <label className="field">
              <span>
                <MapPin aria-hidden="true" size={14} />
                地区
              </span>
              <select onChange={(event) => setRegion(event.target.value)} value={region}>
                {regions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>
                <SlidersHorizontal aria-hidden="true" size={14} />
                类型
              </span>
              <select onChange={(event) => setCategory(event.target.value)} value={category}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="map-count-line">
          <strong>{filteredPlaces.length}</strong>
          <span>家候选店铺</span>
        </div>

        <div className="map-place-list">
          {filteredPlaces.length === 0 ? (
            <div className="map-empty">没有匹配的店铺</div>
          ) : (
            filteredPlaces.slice(0, 24).map((place) => {
              const active = selectedPlace?.id === place.id;

              return (
                <article className={`map-place-row${active ? " active" : ""}`} key={place.id}>
                  <div>
                    <strong>{place.name}</strong>
                    <span>{[place.category, place.region].filter(Boolean).join(" · ") || "资料待补"}</span>
                  </div>
                  <div className="map-place-actions">
                    <button onClick={() => focusPlace(place)} title="定位店铺" type="button">
                      <LocateFixed aria-hidden="true" size={15} />
                    </button>
                    <Link href={`/places/${place.id}`}>详情</Link>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
