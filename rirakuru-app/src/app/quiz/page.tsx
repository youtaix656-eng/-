import Link from "next/link";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { QuizView } from "@/components/QuizView";
import { standardsTest } from "@/data/standardsTest";

// ============================================================
// クイズ（/quiz）
// 自主基準テストへの導線＋一問一答・○×で確認する。
// ============================================================
export default function QuizPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          問題で確認
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          本番形式の自主基準テストと、一問一答・正誤問題（○×）です。
        </p>
      </div>

      {/* 自主基準テストへの導線 */}
      <Link
        href="/test"
        className="flex min-h-[44px] items-center gap-3 rounded-xl2 border border-cocoa-600 bg-cocoa-600 p-4 text-white active:bg-cocoa-700"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          <ClipboardCheck size={24} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-base font-semibold">
            自主基準テスト（全{standardsTest.length}問）
          </span>
          <span className="text-sm text-cream-100/90">
            回答するとすぐ解答・解説を表示
          </span>
        </span>
        <ChevronRight size={22} className="shrink-0" />
      </Link>

      <QuizView />
    </div>
  );
}
