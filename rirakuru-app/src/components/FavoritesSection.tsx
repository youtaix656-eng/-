"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useFavorites } from "@/lib/useFavorites";
import { items } from "@/data/items";
import { FavoriteButton } from "./FavoriteButton";

// ============================================================
// ホームの「よく見る項目」セクション
// お気に入り登録した詳細項目を表示する。
// ============================================================
export function FavoritesSection() {
  const { favorites } = useFavorites();
  const favItems = items.filter((i) => favorites.includes(i.id));

  return (
    <section aria-labelledby="fav-heading">
      <h2
        id="fav-heading"
        className="mb-2 flex items-center gap-2 text-lg font-semibold text-cocoa-800 dark:text-cream-50"
      >
        <Star size={20} className="fill-amber-400 text-amber-400" />
        よく見る項目
      </h2>

      {favItems.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-cream-200 bg-white/60 p-4 text-sm text-cocoa-500 dark:border-cocoa-800 dark:bg-cocoa-900/60 dark:text-sand-200">
          各項目の★を押すと、ここによく見る項目が並びます。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {favItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900"
            >
              <Link
                href={`/item/${item.id}`}
                className="flex min-h-[44px] flex-1 items-center px-4 py-3 text-base font-medium text-cocoa-800 dark:text-cream-50"
              >
                {item.title}
              </Link>
              <FavoriteButton id={item.id} label={item.title} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
