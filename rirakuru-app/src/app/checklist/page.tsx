import { ChecklistView } from "@/components/ChecklistView";

// ============================================================
// チェックリスト（/checklist）
// ============================================================
export default function ChecklistPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
        チェックリスト
      </h1>
      <ChecklistView />
    </div>
  );
}
