"use client";

import { useState } from "react";
import { Circle, Triangle, X, Check } from "lucide-react";
import { correctChoiceTexts, type ReviewCard } from "@/lib/reviewPool";
import type { Grade } from "@/lib/srs";

// ============================================================
// 暗記カード（表=問題／裏=答え）
// 表面をタップ、または「裏面（答え）を見る」ボタンでめくる。
// めくった後に ○（完璧）／△（解説がわからない）／✕（わからない）で自己評価。
// 評価すると onGrade が呼ばれ、間隔反復（SRS）の記録に使われる。
// ============================================================
export function Flashcard({
  card,
  onGrade,
}: {
  card: ReviewCard;
  onGrade: (grade: Grade) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const correctSet = correctChoiceTexts(card);

  const grade = (g: Grade) => {
    onGrade(g);
    setFlipped(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setFlipped((f) => !f)}
        className="min-h-[160px] w-full rounded-xl2 border border-cream-200 bg-white p-5 text-left dark:border-cocoa-800 dark:bg-cocoa-900"
      >
        {!flipped ? (
          <>
            <p className="mb-2 text-xs font-bold text-cocoa-400 dark:text-sand-200">
              表（問題）
            </p>
            <p className="text-lg leading-relaxed text-cocoa-800 dark:text-cream-50">
              {card.front}
            </p>
            {card.choices && (
              <ul className="mt-3 flex flex-col gap-1">
                {card.choices.map((c, i) => (
                  <li
                    key={i}
                    className="text-sm text-cocoa-500 dark:text-sand-200"
                  >
                    {i + 1}. {c}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-sm font-semibold text-cocoa-400 dark:text-sand-200">
              タップして裏面（答え）を見る →
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs font-bold text-green-600 dark:text-green-400">
              裏（答え）
            </p>
            {card.choices && (
              <ul className="mb-3 flex flex-col gap-1">
                {card.choices.map((c, i) => {
                  const isCorrect = correctSet.has(c);
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm ${
                        isCorrect
                          ? "bg-green-50 font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300"
                          : "text-cocoa-500 dark:text-sand-200"
                      }`}
                    >
                      {isCorrect ? (
                        <Check size={14} className="shrink-0 text-green-600 dark:text-green-300" />
                      ) : (
                        <span className="w-[14px] shrink-0" />
                      )}
                      {i + 1}. {c}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-lg font-semibold leading-relaxed text-cocoa-800 dark:text-cream-50">
              答え：{card.back}
            </p>
            {card.explanation && (
              <p className="mt-3 text-sm leading-relaxed text-cocoa-600 dark:text-sand-200">
                {card.explanation}
              </p>
            )}
            {card.ref && (
              <p className="mt-2 text-xs text-cocoa-400 dark:text-sand-200">
                出典：{card.ref}
              </p>
            )}
          </>
        )}
      </button>

      {flipped && (
        <div>
          <p className="mb-2 text-center text-sm text-cocoa-500 dark:text-sand-200">
            この問題の理解度は？（△・✕は自動で復習リストに入ります）
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => grade("good")}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl2 border-2 border-green-500 bg-green-50 text-base font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300"
            >
              <Circle size={18} />
              完璧！自信あり
            </button>
            <button
              onClick={() => grade("hard")}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl2 border-2 border-amber-400 bg-amber-50 text-base font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
            >
              <Triangle size={16} />
              解説がわからない
            </button>
            <button
              onClick={() => grade("again")}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl2 border-2 border-red-400 bg-red-50 text-base font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-300"
            >
              <X size={18} />
              答えも解説もわからない
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
