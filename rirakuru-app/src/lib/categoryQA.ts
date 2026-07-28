// ============================================================
// 目次（カテゴリ）ページの「一問一答」枠に出すカードを組み立てる。
// 既存の項目データ（items.ts）から機械的に生成するため、新しい事実は
// 追加していない（title/summary/body/steps/warnings をQ&A形式に整形）。
// ============================================================
import type { Item } from "@/data/types";

export type SimpleCard = {
  id: string;
  front: string;
  back: string;
};

export function deriveItemFlashcards(items: Item[]): SimpleCard[] {
  const cards: SimpleCard[] = [];

  for (const item of items) {
    if (item.steps && item.steps.length > 0) {
      cards.push({
        id: `derived-${item.id}-steps`,
        front: `${item.title}の手順は？`,
        back: item.steps
          .map((s, i) => `${i + 1}. ${s.text}${s.note ? "（" + s.note + "）" : ""}`)
          .join("\n"),
      });
    } else if (item.body || item.summary) {
      cards.push({
        id: `derived-${item.id}-body`,
        front: `${item.title}とは？`,
        back: item.body ?? item.summary ?? "",
      });
    }

    if (item.warnings && item.warnings.length > 0) {
      cards.push({
        id: `derived-${item.id}-warn`,
        front: `${item.title}で注意することは？`,
        back: item.warnings
          .map((w) => (w.level === "danger" ? "【禁忌】" : "【注意】") + w.text)
          .join("\n"),
      });
    }
  }

  return cards;
}
