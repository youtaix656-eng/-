import { FootReflexView } from "@/components/FootReflexView";
import { AudioLearning } from "@/components/AudioLearning";
import { buildFootAudioSegments } from "@/lib/audioSegments";
import { footReflex } from "@/data/footReflex";

// ============================================================
// 足つぼ（/footcare）
// 手順（通し番号1〜）と、順番の一問一答。音声学習も追加。
// ============================================================
export default function FootcarePage() {
  const audioSegments = buildFootAudioSegments(footReflex);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-cocoa-800 dark:text-cream-50">
          足つぼ
        </h1>
        <p className="mt-1 text-sm text-cocoa-500 dark:text-sand-200">
          手順を通し番号で確認、順番の一問一答で覚えられます。
        </p>
      </div>
      <AudioLearning segments={audioSegments} />
      <FootReflexView />
    </div>
  );
}
