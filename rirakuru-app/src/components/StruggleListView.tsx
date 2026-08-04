"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Circle, Triangle, X, ListChecks } from "lucide-react";
import { reviewPool } from "@/lib/reviewPool";
import { readReviewMap, hasStruggled, isMastered, gradeItem, type ReviewMap, type Grade } from "@/lib/srs";
import { AudioLearning } from "./AudioLearning";
import { buildReviewAudioSegments } from "@/lib/audioSegments";

// ============================================================
// 苦手リスト（間違えた・自信がない問題を、期日に関係なくいつでも一覧表示）
// - 復習期日を待たず、間違えた問題をすぐに見返せる
// - タップで開いて答え・解説を確認、その場で理解度を再評価できる
// - まとめて音声で聞ける（端末の読み上げ機能）
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

  const audioSegments = useMemo(() => buildReviewAudioSegments(items), [items]);

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
          <AudioLearning segments={audioSegments} />

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
                      {card.choices && (
                        <ul className="mb-2 flex flex-col gap-1">
                          {card.choices.map((c, i) => (
                            <li key={i} className="text-sm text-cocoa-500 dark:text-sand-200">
                              {i + 1}. {c}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-base font-semibold leading-relaxed text-cocoa-800 dark:text-cream-50">
                        答え：{card.back}
                      </p>
                      {card.explanation && (
                        <p className="mt-2 text-sm leading-relaxed text-cocoa-600 dark:text-sand-200">
                          {card.explanation}
                        </p>
                      )}
                      {card.ref && (
                        <p className="mt-2 text-xs text-cocoa-400 dark:text-sand-200">
                          出典：{card.ref}
                        </p>
                      )}

                      <p className="mb-2 mt-4 text-sm text-cocoa-500 dark:text-sand-200">
                        理解度を再評価する：
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => grade(card.id, "good")}
                          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl2 border-2 border-green-500 bg-green-50 text-sm font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300"
                        >
                          <Circle size={16} />
                          完璧！自信あり
                        </button>
                        <button
                          onClick={() => grade(card.id, "hard")}
                          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl2 border-2 border-amber-400 bg-amber-50 text-sm font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                        >
                          <Triangle size={14} />
                          解説がわからない
                        </button>
                        <button
                          onClick={() => grade(card.id, "again")}
                          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl2 border-2 border-red-400 bg-red-50 text-sm font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-300"
                        >
                          <X size={16} />
                          答えも解説もわからない
                        </button>
                      </div>
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
