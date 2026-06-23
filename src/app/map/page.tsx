import { AmapExplorer } from "@/components/amap-explorer";
import { places } from "@/lib/places";

export default function MapPage() {
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">高德地图</span>
        <h1 className="page-title">地图探索</h1>
        <p className="page-lede">
          首版会用店铺名称、地区和具体位置尝试定位。无法自动定位的店，会在后台标记为待补全经纬度。
        </p>
      </section>

      <section className="container section">
        <div className="map-panel">
          <AmapExplorer places={places} />
        </div>
      </section>
    </>
  );
}
