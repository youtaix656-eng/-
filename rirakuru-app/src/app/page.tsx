import Link from "next/link";
import { GraduationCap } from "lucide-react";
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

      {/* 自主基準クイズへの導線 */}
      <Link
        href="/quiz"
        className="flex min-h-[44px] items-center gap-3 rounded-xl2 border border-cocoa-600 bg-cocoa-600 p-4 text-white shadow-sm active:bg-cocoa-700"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          <GraduationCap size={24} />
        </span>
        <span className="flex flex-col">
          <span className="text-base font-semibold">問題で確認（自主基準）</span>
          <span className="text-sm text-cream-100/90">
            一問一答・○×で理解度チェック
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
