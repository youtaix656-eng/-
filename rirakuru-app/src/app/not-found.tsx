import Link from "next/link";

// ============================================================
// 404 ページ
// ============================================================
export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-4xl">🔍</p>
      <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
        ページが見つかりません
      </h1>
      <p className="text-sm text-cocoa-500 dark:text-sand-200">
        お探しの項目は移動または削除された可能性があります。
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-[44px] items-center rounded-full bg-cocoa-600 px-6 text-base font-semibold text-white"
      >
        ホームへ戻る
      </Link>
    </div>
  );
}
