import { TestView } from "@/components/TestView";

// ============================================================
// 自主基準テスト（/test）
// 全29問。1問ずつ回答し、回答後すぐに解答・解説を表示。
// ============================================================
export default function TestPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          自主基準テスト
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          全29問。回答するとすぐに解答・解説が表示されます。
        </p>
      </div>
      <TestView />
    </div>
  );
}
