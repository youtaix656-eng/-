import { MaterialsView } from "@/components/MaterialsView";

// ============================================================
// 研修教材一覧（/materials）
// 教材確認STEP1の全項目を大項目1〜9・項目1〜に整理して表示。
// ============================================================
export default function MaterialsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          研修教材一覧
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          研修ポータルの教材を大項目ごとに整理。確認したらチェックできます。
          「収録済み」はこのアプリ内で内容を確認できます。
        </p>
      </div>
      <MaterialsView />
    </div>
  );
}
