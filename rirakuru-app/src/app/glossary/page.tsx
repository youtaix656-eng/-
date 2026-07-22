import { GlossaryView } from "@/components/GlossaryView";

// ============================================================
// 用語集（/glossary）
// ============================================================
export default function GlossaryPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
        用語集
      </h1>
      <GlossaryView />
    </div>
  );
}
