"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, BookA, HelpCircle } from "lucide-react";

// ============================================================
// 画面下部の固定ナビ（スマホで片手操作しやすい位置）
// ============================================================
const links = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/checklist", label: "チェック", icon: CheckSquare },
  { href: "/quiz", label: "問題", icon: HelpCircle },
  { href: "/glossary", label: "用語集", icon: BookA },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-cream-200 bg-white/95 backdrop-blur dark:border-cocoa-800 dark:bg-cocoa-900/95"
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {links.map(({ href, label, icon: Ico }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-xs ${
                  active
                    ? "text-cocoa-600 dark:text-cream-50"
                    : "text-cocoa-400 dark:text-sand-200"
                }`}
              >
                <Ico size={22} className={active ? "fill-sand-100 dark:fill-cocoa-800" : ""} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
