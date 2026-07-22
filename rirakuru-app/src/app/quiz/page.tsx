import { QuizView } from "@/components/QuizView";

// ============================================================
// クイズ（/quiz）
// 自主基準の内容を一問一答・○×で確認する。
// ============================================================
export default function QuizPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          問題で確認
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          自主基準（第1〜4条）の一問一答と正誤問題（○×）です。
        </p>
      </div>
      <QuizView />
    </div>
  );
}
