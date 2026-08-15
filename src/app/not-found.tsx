import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <section className="container page-head">
      <span className="eyebrow">404</span>
      <h1 className="page-title">这页暂时没有菜</h1>
      <p className="page-lede">换个榜单或回到首页继续找吃的。</p>
      <div>
        <Link className="button secondary" href="/">
          <ArrowLeft aria-hidden="true" size={17} />
          返回首页
        </Link>
      </div>
    </section>
  );
}
