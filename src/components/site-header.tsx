"use client";

import Link from "next/link";
import { ClipboardList, Compass, LayoutDashboard, MapPinned, Trophy } from "lucide-react";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";

const navItems = [
  { href: "/", label: "发现", icon: Compass },
  { href: "/lists/red-list", label: "红榜", icon: Trophy },
  { href: "/lists/retry-list", label: "再练练", icon: ClipboardList },
  { href: "/map", label: "地图", icon: MapPinned },
  { href: "/admin", label: "后台", icon: LayoutDashboard },
];

export function SiteHeader() {
  const pathname = usePathname();

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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link className={isActive ? "nav-link active" : "nav-link"} href={item.href} key={item.href}>
                <Icon aria-hidden="true" size={17} strokeWidth={2.1} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
