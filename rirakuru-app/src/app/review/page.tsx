import { ReviewView } from "@/components/ReviewView";

// ============================================================
// 復習（/review）
// エビングハウスの忘却曲線に沿った間隔反復で、間違えた問題・
// 自信のない問題を「完全にマスターするまで」繰り返し出題する。
// ============================================================
export default function ReviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          復習
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          間違えた問題・自信のない問題を、間隔をあけながら繰り返し出題します。
        </p>
      </div>
      <ReviewView />
    </div>
  );
}
