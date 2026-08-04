import { TestView } from "@/components/TestView";
import { serviceSeminarTest } from "@/data/serviceSeminarTest";

// ============================================================
// 接客セミナー 振り返りテスト（/service-seminar-test）
// 全16問。お客様の大事な3つの段階（①アプローチ／②施術時／③クロージング）。
// 1問ずつ回答し、回答後すぐに解答・解説を表示。
// ============================================================
export default function ServiceSeminarTestPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          接客セミナー 振り返りテスト
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          全16問。お客様の大事な3つの段階（①アプローチ／②施術時／③クロージング）。回答するとすぐに解答・解説が表示されます。
        </p>
      </div>
      <TestView questions={serviceSeminarTest} />
    </div>
  );
}
