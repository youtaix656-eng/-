import { HandReflexView } from "@/components/HandReflexView";

// ============================================================
// ハンドリフレ（/hand）
// 手順（通し番号1〜）と、順番の一問一答。
// ============================================================
export default function HandPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          ハンドリフレ
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          手順を通し番号で確認、順番の一問一答で覚えられます。
        </p>
      </div>
      <HandReflexView />
    </div>
  );
}
