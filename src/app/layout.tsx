import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "今天吃什么",
  description: "探店小队的榜单、地图和评分应用。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <div className="app-shell">
          <SiteHeader />
          <main id="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
