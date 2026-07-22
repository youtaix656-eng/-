"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/lib/useFavorites";

// ============================================================
// お気に入り（★）トグルボタン
// タップ領域は 44px 以上を確保。
// ============================================================
export function FavoriteButton({ id, label }: { id: string; label?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(id);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-pressed={active}
      aria-label={`${label ?? "この項目"}をお気に入り${active ? "から外す" : "に追加"}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-cream-100 dark:hover:bg-cocoa-800"
    >
      <Star
        size={22}
        className={
          active
            ? "fill-amber-400 text-amber-400"
            : "text-cocoa-400 dark:text-sand-200"
        }
      />
    </button>
  );
}
