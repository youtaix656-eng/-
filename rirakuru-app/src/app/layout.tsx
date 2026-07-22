import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// ============================================================
// アプリ全体の共通レイアウト（ヘッダー・下部ナビ・テーマ）
// ============================================================

export const metadata: Metadata = {
  title: "りらくる 業務マニュアル",
  description: "りらくる セラピストの業務手順・接客ルール・施術内容の個人用マニュアル",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "業務マニュアル",
  },
};

export const viewport: Viewport = {
  themeColor: "#6f4e37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// ダークモードのチラつき防止：描画前に localStorage の設定を反映
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('rirakuru:theme');
    var m = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (t === 'dark' || (t === null && m)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ServiceWorkerRegister />

        {/* 上部ヘッダー */}
        <header className="sticky top-0 z-20 border-b border-cream-200 bg-cream-50/95 backdrop-blur dark:border-cocoa-800 dark:bg-cocoa-900/95">
          <div className="mx-auto flex h-16 max-w-screen-sm items-center justify-between px-4">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-cocoa-700 dark:text-cream-50"
            >
              りらくる 業務マニュアル
            </Link>
            <ThemeToggle />
          </div>
        </header>

        {/* 本文（下部ナビ分の余白を確保） */}
        <main className="mx-auto max-w-screen-sm px-4 pb-24 pt-4">
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}
