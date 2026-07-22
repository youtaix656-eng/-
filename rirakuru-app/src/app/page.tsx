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
