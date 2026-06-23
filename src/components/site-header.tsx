import Link from "next/link";
import { BrandMark } from "./brand-mark";

const navItems = [
  { href: "/", label: "发现" },
  { href: "/lists/red-list", label: "红榜" },
  { href: "/lists/retry-list", label: "再练练" },
  { href: "/map", label: "地图" },
  { href: "/admin", label: "后台" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="brand" href="/">
          <BrandMark />
          <span className="brand-text">
            <span className="brand-title">今天吃什么</span>
            <span className="brand-subtitle">探店小队</span>
          </span>
        </Link>
        <nav className="nav" aria-label="主导航">
          {navItems.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
