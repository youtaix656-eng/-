import Link from "next/link";
import type { Category } from "@/data/types";
import { Icon } from "./Icon";

// ============================================================
// トップページのカテゴリカード
// glossary だけは専用ページ（/glossary）へ飛ばす。
// ============================================================
export function CategoryCard({ category }: { category: Category }) {
  const href =
    category.slug === "glossary"
      ? "/glossary"
      : category.slug === "hand"
      ? "/hand"
      : `/category/${category.slug}`;

  return (
    <Link
      href={href}
      className="flex min-h-[44px] flex-col gap-2 rounded-xl2 border border-cream-200 bg-white p-4 shadow-sm transition-colors hover:bg-cream-50 active:bg-cream-100 dark:border-cocoa-800 dark:bg-cocoa-900 dark:hover:bg-cocoa-800"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sand-100 text-cocoa-600 dark:bg-cocoa-800 dark:text-sand-200">
        <Icon name={category.icon} size={24} />
      </span>
      <span className="text-base font-semibold text-cocoa-800 dark:text-cream-50">
        {category.title}
      </span>
      <span className="text-sm leading-relaxed text-cocoa-500 dark:text-sand-200">
        {category.description}
      </span>
    </Link>
  );
}
