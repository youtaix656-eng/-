import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { categories, getCategory } from "@/data/categories";
import { getItemsByCategory } from "@/data/items";
import { Accordion } from "@/components/Accordion";
import { Icon } from "@/components/Icon";

// ============================================================
// カテゴリ一覧（/category/[slug]）
// 該当カテゴリの項目をアコーディオンで表示。
// ============================================================

// ビルド時にカテゴリぶんのページを生成（用語集は専用ページのため除外）
export function generateStaticParams() {
  return categories
    .filter((c) => c.slug !== "glossary" && c.slug !== "hand")
    .map((c) => ({ slug: c.slug }));
}

export default function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const category = getCategory(params.slug);
  if (!category) notFound();

  const items = getItemsByCategory(category.slug);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm text-cocoa-500 dark:text-sand-200"
      >
        <ChevronLeft size={18} />
        ホームへ戻る
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-100 text-cocoa-600 dark:bg-cocoa-800 dark:text-sand-200">
          <Icon name={category.icon} size={26} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
            {category.title}
          </h1>
          <p className="text-sm text-cocoa-500 dark:text-sand-200">
            {category.description}
          </p>
        </div>
      </div>

      <Accordion items={items} />
    </div>
  );
}
