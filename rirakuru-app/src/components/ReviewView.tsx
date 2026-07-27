"use client";

import { useEffect, useMemo, useState } from "react";
import { PartyPopper, Flame, Trophy } from "lucide-react";
import { reviewPool } from "@/lib/reviewPool";
import {
  readReviewMap,
  isDue,
  isMastered,
  hasStruggled,
  gradeItem,
  type ReviewMap,
  type Grade,
} from "@/lib/srs";
import { Flashcard } from "./Flashcard";

// ============================================================
// 復習（間隔反復）画面
// 一問一答・○×問題・自主基準テストのうち、
// 「一度でも学習済み」かつ「マスターしていない」かつ「復習期日が来た」
// 問題だけを、エビングハウスの忘却曲線に沿った間隔で繰り返し出題する。
// 一度でも間違えると、その後正解しても連続正解が既定回数続くまで
// マスター扱いにならず、出題対象に残り続ける。
// ============================================================
export function ReviewView() {
  const [map, setMap] = useState<ReviewMap | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    const m = readReviewMap();
    setMap(m);
    const due = reviewPool.filter((c) => isDue(m, c.id)).map((c) => c.id);
    setQueue(due);
  }, []);

  const stats = useMemo(() => {
    if (!map) return null;
    const attempted = reviewPool.filter((c) => map[c.id]).length;
    const mastered = reviewPool.filter((c) => isMastered(map, c.id)).length;
    const struggling = reviewPool.filter(
      (c) => map[c.id] && hasStruggled(map, c.id) && !isMastered(map, c.id)
    ).length;
    return { attempted, mastered, struggling, total: reviewPool.length };
  }, [map]);

  if (!map) return null;

  const handleGrade = (id: string, grade: Grade) => {
    const next = gradeItem(id, grade);
    setMap(next);
    setDoneCount((c) => c + 1);
    setPos((p) => p + 1);
  };

  const currentId = queue[pos];
  const currentCard = currentId
    ? reviewPool.find((c) => c.id === currentId)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* 進捗サマリー */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl2 border border-cream-200 bg-white p-3 text-center dark:border-cocoa-800 dark:bg-cocoa-900">
            <Trophy size={18} className="mx-auto text-cocoa-500" />
            <p className="mt-1 text-lg font-bold text-cocoa-800 dark:text-cream-50">
              {stats.mastered}
            </p>
            <p className="text-xs text-cocoa-400 dark:text-sand-200">マスター</p>
          </div>
          <div className="rounded-xl2 border border-cream-200 bg-white p-3 text-center dark:border-cocoa-800 dark:bg-cocoa-900">
            <Flame size={18} className="mx-auto text-red-400" />
            <p className="mt-1 text-lg font-bold text-cocoa-800 dark:text-cream-50">
              {stats.struggling}
            </p>
            <p className="text-xs text-cocoa-400 dark:text-sand-200">要復習</p>
          </div>
          <div className="rounded-xl2 border border-cream-200 bg-white p-3 text-center dark:border-cocoa-800 dark:bg-cocoa-900">
            <p className="mt-1 text-lg font-bold text-cocoa-800 dark:text-cream-50">
              {stats.attempted}/{stats.total}
            </p>
            <p className="text-xs text-cocoa-400 dark:text-sand-200">学習済み</p>
          </div>
        </div>
      )}

      {!currentCard ? (
        <div className="flex flex-col items-center gap-3 rounded-xl2 border border-cream-200 bg-white p-8 text-center dark:border-cocoa-800 dark:bg-cocoa-900">
          <PartyPopper size={32} className="text-cocoa-500" />
          <p className="text-base font-semibold text-cocoa-800 dark:text-cream-50">
            {doneCount > 0
              ? `お疲れさまでした！ ${doneCount}問復習しました。`
              : "今日復習すべき問題はありません。"}
          </p>
          <p className="text-sm leading-relaxed text-cocoa-500 dark:text-sand-200">
            一問一答・○×問題・自主基準テストで間違えた問題や「自信なし」と
            評価した問題が、忘却曲線に沿ったタイミングでここに出てきます。
            マスターと判定されるまで繰り返し出題されます。
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-cocoa-500 dark:text-sand-200">
            残り {queue.length - pos} 問
          </p>
          <Flashcard
            key={currentCard.id}
            card={currentCard}
            onGrade={(g) => handleGrade(currentCard.id, g)}
          />
        </>
      )}
    </div>
  );
}
