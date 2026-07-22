"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Item } from "@/data/types";
import { FavoriteButton } from "./FavoriteButton";

// ============================================================
// カテゴリ一覧のアコーディオン
// タップで開閉し、詳細ページへのリンクと★トグルを持つ。
// ============================================================
export function Accordion({ items }: { items: Item[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-xl2 border border-cream-200 bg-white p-4 text-sm text-cocoa-500 dark:border-cocoa-800 dark:bg-cocoa-900 dark:text-sand-200">
        このカテゴリにはまだ項目がありません。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <li
            key={item.id}
            className="overflow-hidden rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900"
          >
            <div className="flex items-center">
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                className="flex min-h-[44px] flex-1 items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="text-base font-medium text-cocoa-800 dark:text-cream-50">
                  {item.title}
                </span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-cocoa-400 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              <FavoriteButton id={item.id} label={item.title} />
            </div>

            {open && (
              <div className="border-t border-cream-100 px-4 py-3 dark:border-cocoa-800">
                {item.summary && (
                  <p className="text-sm leading-relaxed text-cocoa-600 dark:text-sand-200">
                    {item.summary}
                  </p>
                )}
                <Link
                  href={`/item/${item.id}`}
                  className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-cocoa-600 underline underline-offset-4 dark:text-sand-200"
                >
                  詳しく見る →
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
