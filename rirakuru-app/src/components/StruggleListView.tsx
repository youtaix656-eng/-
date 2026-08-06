"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { reviewPool } from "@/lib/reviewPool";
import { readReviewMap, hasStruggled, isMastered, gradeItem, type ReviewMap, type Grade } from "@/lib/srs";
import { QuizAudioPlayer } from "./QuizAudioPlayer";
import { Flashcard } from "./Flashcard";

// ============================================================
// 苦手リスト（間違えた・自信がない問題を、期日に関係なくいつでも一覧表示）
// - 復習期日を待たず、間違えた問題をすぐに見返せる
// - タップで問題だけ表示 → もう一度タップで答え（Flashcardと同じ流れ）
//   問題と答えを同時に出さない
// - 音声も「問題を再生」→「正解を聞く」の2ステップ（QuizAudioPlayer）
// ============================================================
export function StruggleListView() {
  const [map, setMap] = useState<ReviewMap | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setMap(readReviewMap());
  }, []);

  const items = useMemo(() => {
    if (!map) return [];
    return reviewPool.filter((c) => hasStruggled(map, c.id) && !isMastered(map, c.id));
  }, [map]);

  if (!map) return null;

  const grade = (id: string, g: Grade) => {
    const next = gradeItem(id, g);
    setMap(next);
    setOpenId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-cocoa-500 dark:text-sand-200">
        今まで間違えた・自信がないと答えた問題を、復習期日に関係なくいつでも見返せます。
        マスターと判定されるまでここに残り続けます。
      </p>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl2 border border-cream-200 bg-white p-6 text-center dark:border-cocoa-800 dark:bg-cocoa-900">
          <ListChecks size={28} className="text-cocoa-400" />
          <p className="text-sm text-cocoa-500 dark:text-sand-200">
            今のところ苦手な問題はありません。
          </p>
        </div>
      ) : (
        <>
          <QuizAudioPlayer cards={items} />

          <ul className="flex flex-col gap-2">
            {items.map((card) => {
              const open = openId === card.id;
              return (
                <li
                  key={card.id}
                  className="overflow-hidden rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900"
                >
                  <button
                    onClick={() => setOpenId(open ? null : card.id)}
                    aria-expanded={open}
                    className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span className="text-base font-medium text-cocoa-800 dark:text-cream-50">
                      {card.front}
                    </span>
                    <ChevronDown
                      size={20}
                      className={`shrink-0 text-cocoa-400 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-cream-100 px-4 py-3 dark:border-cocoa-800">
                      <Flashcard card={card} onGrade={(g) => grade(card.id, g)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
