import { AmapExplorer } from "@/components/amap-explorer";
import { MapPinned } from "lucide-react";
import { getMapPageData } from "@/lib/public-data";

export default async function MapPage() {
  const { places } = await getMapPageData();

  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">
          <MapPinned aria-hidden="true" size={14} />
          高德地图
        </span>
        <h1 className="page-title">地图探索</h1>
        <p className="page-lede">
          把候选店按地区和类型铺开看，先判断今天往哪个方向走，再点进详情看评分、招牌菜和停车信息。
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
