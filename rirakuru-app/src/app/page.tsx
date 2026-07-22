import Link from "next/link";
import { GraduationCap, HandHelping } from "lucide-react";
import { categories } from "@/data/categories";
import { CategoryCard } from "@/components/CategoryCard";
import { SearchBar } from "@/components/SearchBar";
import { FavoritesSection } from "@/components/FavoritesSection";

// ============================================================
// ホーム（/）
// 検索バー＋カテゴリカード＋よく見る項目
// ============================================================
export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <SearchBar />

      {/* 自主基準テスト・問題への導線 */}
      <Link
        href="/test"
        className="flex min-h-[44px] items-center gap-3 rounded-xl2 border border-cocoa-600 bg-cocoa-600 p-4 text-white shadow-sm active:bg-cocoa-700"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          <GraduationCap size={24} />
        </span>
        <span className="flex flex-col">
          <span className="text-base font-semibold">自主基準テスト（全29問）</span>
          <span className="text-sm text-cream-100/90">
            回答するとすぐ解答表示／一問一答・○×も
          </span>
        </span>
      </Link>

      {/* ハンドリフレへの導線 */}
      <Link
        href="/hand"
        className="flex min-h-[44px] items-center gap-3 rounded-xl2 border border-cream-200 bg-white p-4 shadow-sm active:bg-cream-100 dark:border-cocoa-800 dark:bg-cocoa-900"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-100 text-cocoa-600 dark:bg-cocoa-800 dark:text-sand-200">
          <HandHelping size={24} />
        </span>
        <span className="flex flex-col">
          <span className="text-base font-semibold text-cocoa-800 dark:text-cream-50">
            ハンドリフレ 手順
          </span>
          <span className="text-sm text-cocoa-500 dark:text-sand-200">
            通し番号1〜／順番の一問一答
          </span>
        </span>
      </Link>

      <FavoritesSection />

      <section aria-labelledby="cat-heading">
        <h2
          id="cat-heading"
          className="mb-3 text-lg font-semibold text-cocoa-800 dark:text-cream-50"
        >
          カテゴリ
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((c) => (
            <CategoryCard key={c.slug} category={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
