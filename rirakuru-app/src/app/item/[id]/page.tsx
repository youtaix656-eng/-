import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, AlertTriangle, Ban } from "lucide-react";
import { items, getItem } from "@/data/items";
import { getCategory } from "@/data/categories";
import { FavoriteButton } from "@/components/FavoriteButton";

// ============================================================
// 詳細（/item/[id]）
// 見出し・本文・手順ステップ・注意点（警告スタイル）・関連項目
// ============================================================

// ビルド時に全項目ぶんのページを生成
export function generateStaticParams() {
  return items.map((i) => ({ id: i.id }));
}

export default function ItemPage({ params }: { params: { id: string } }) {
  const item = getItem(params.id);
  if (!item) notFound();

  const category = getCategory(item.categorySlug);
  const related = (item.related ?? [])
    .map((id) => getItem(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <article className="flex flex-col gap-5">
      {category && (
        <Link
          href={`/category/${category.slug}`}
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-cocoa-500 dark:text-sand-200"
        >
          <ChevronLeft size={18} />
          {category.title}
        </Link>
      )}

      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold leading-snug text-cocoa-800 dark:text-cream-50">
          {item.title}
        </h1>
        <FavoriteButton id={item.id} label={item.title} />
      </header>

      {item.summary && (
        <p className="text-base leading-relaxed text-cocoa-600 dark:text-sand-200">
          {item.summary}
        </p>
      )}

      {item.body && (
        <div className="whitespace-pre-line text-base leading-relaxed text-cocoa-700 dark:text-cream-100">
          {item.body}
        </div>
      )}

      {/* 手順ステップ */}
      {item.steps && item.steps.length > 0 && (
        <section aria-label="手順">
          <h2 className="mb-2 text-lg font-semibold text-cocoa-800 dark:text-cream-50">
            手順
          </h2>
          <ol className="flex flex-col gap-2">
            {item.steps.map((step, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl2 border border-cream-200 bg-white p-3 dark:border-cocoa-800 dark:bg-cocoa-900"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cocoa-500 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-base text-cocoa-800 dark:text-cream-50">
                    {step.text}
                  </p>
                  {step.note && (
                    <p className="mt-1 text-sm text-cocoa-400 dark:text-sand-200">
                      {step.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 注意点（警告スタイル） */}
      {item.warnings && item.warnings.length > 0 && (
        <section aria-label="注意点" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-cocoa-800 dark:text-cream-50">
            注意点
          </h2>
          {item.warnings.map((w, i) =>
            w.level === "danger" ? (
              <p
                key={i}
                className="flex items-start gap-2 rounded-xl2 border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
              >
                <Ban size={18} className="mt-0.5 shrink-0" />
                {w.text}
              </p>
            ) : (
              <p
                key={i}
                className="flex items-start gap-2 rounded-xl2 border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                {w.text}
              </p>
            )
          )}
        </section>
      )}

      {/* 関連項目 */}
      {related.length > 0 && (
        <section aria-label="関連項目">
          <h2 className="mb-2 text-lg font-semibold text-cocoa-800 dark:text-cream-50">
            関連項目
          </h2>
          <ul className="flex flex-col gap-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/item/${r.id}`}
                  className="flex min-h-[44px] items-center rounded-xl2 border border-cream-200 bg-white px-4 py-3 text-base text-cocoa-700 hover:bg-cream-50 dark:border-cocoa-800 dark:bg-cocoa-900 dark:text-cream-100 dark:hover:bg-cocoa-800"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* タグ */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {item.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-sand-100 px-3 py-1 text-xs text-cocoa-600 dark:bg-cocoa-800 dark:text-sand-200"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
