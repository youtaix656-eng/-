"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { reviewPool } from "@/lib/reviewPool";
import { readReviewMap, isDue } from "@/lib/srs";

// ============================================================
// ホームに出す「今日の復習」カード
// 間隔反復で復習期日が来ている問題の件数をひと目で表示する。
// ============================================================
export function ReviewDueCard() {
  const [dueCount, setDueCount] = useState<number | null>(null);

  useEffect(() => {
    const map = readReviewMap();
    const count = reviewPool.filter((c) => isDue(map, c.id)).length;
    setDueCount(count);
  }, []);

  // 初回読み込み前、または復習対象0件のときは控えめに（非表示ではなく0件も伝える）
  if (dueCount === null) return null;

  return (
    <Link
      href="/review"
      className={`flex min-h-[44px] items-center gap-3 rounded-xl2 border p-4 shadow-sm ${
        dueCount > 0
          ? "border-red-300 bg-red-50 active:bg-red-100 dark:border-red-900 dark:bg-red-950/30"
          : "border-cream-200 bg-white active:bg-cream-100 dark:border-cocoa-800 dark:bg-cocoa-900"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          dueCount > 0
            ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300"
            : "bg-sand-100 text-cocoa-600 dark:bg-cocoa-800 dark:text-sand-200"
        }`}
      >
        <BrainCircuit size={24} />
      </span>
      <span className="flex flex-col">
        <span
          className={`text-base font-semibold ${
            dueCount > 0
              ? "text-red-700 dark:text-red-300"
              : "text-cocoa-800 dark:text-cream-50"
          }`}
        >
          {dueCount > 0 ? `今日の復習：${dueCount}問` : "今日の復習はありません"}
        </span>
        <span className="text-sm text-cocoa-500 dark:text-sand-200">
          間違えた問題を忘却曲線に沿って徹底復習
        </span>
      </span>
    </Link>
  );
}
