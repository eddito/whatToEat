import { MyRatingsDashboard } from "@/components/my-ratings-dashboard";

export default function RatingsPage() {
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">个人记录</span>
        <h1 className="page-title">评分历史</h1>
        <p className="page-lede">查看自己最近提交或更新过的店铺评分。</p>
      </section>

      <section className="container ratings-page">
        <MyRatingsDashboard />
      </section>
    </>
  );
}
