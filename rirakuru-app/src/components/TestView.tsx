"use client";

import { useMemo, useState } from "react";
import { Check, X, RotateCcw, Circle } from "lucide-react";
import { standardsTest } from "@/data/standardsTest";

// ============================================================
// 自主基準テスト（全29問）
// - 単一選択：選んだ瞬間に正誤と解答・解説を表示
// - 複数選択：必要数を選び「回答する」で正誤と解答・解説を表示
// - 回答後に「次へ」。最後に得点を表示。
// ============================================================
export function TestView() {
  const total = standardsTest.length;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = standardsTest[index];
  const isMulti = q.correct.length > 1;
  const correctSet = useMemo(() => new Set(q.correct), [q]);

  // 選択が正解と完全一致か
  const isCorrect = useMemo(() => {
    if (selected.length !== q.correct.length) return false;
    return selected.every((s) => correctSet.has(s));
  }, [selected, q, correctSet]);

  const percent = Math.round((index / total) * 100);

  const pick = (i: number) => {
    if (locked) return;
    if (isMulti) {
      // 複数選択：トグル（必要数を超えたら選べない）
      setSelected((prev) => {
        if (prev.includes(i)) return prev.filter((x) => x !== i);
        if (prev.length >= q.correct.length) return prev; // 必要数まで
        return [...prev, i];
      });
    } else {
      // 単一選択：即確定
      setSelected([i]);
      setLocked(true);
      if (correctSet.has(i)) setScore((s) => s + 1);
    }
  };

  const submitMulti = () => {
    if (locked || selected.length !== q.correct.length) return;
    setLocked(true);
    if (isCorrect) setScore((s) => s + 1);
  };

  const next = () => {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected([]);
    setLocked(false);
  };

  const restart = () => {
    setIndex(0);
    setSelected([]);
    setLocked(false);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const rate = Math.round((score / total) * 100);
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl2 border border-cream-200 bg-white p-6 text-center dark:border-cocoa-800 dark:bg-cocoa-900">
        <p className="text-lg font-semibold text-cocoa-800 dark:text-cream-50">
          テスト結果
        </p>
        <p className="text-4xl font-bold text-cocoa-600 dark:text-cream-50">
          {score} / {total}
        </p>
        <p className="text-sm text-cocoa-500 dark:text-sand-200">正答率 {rate}%</p>
        <button
          onClick={restart}
          className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-cocoa-600 px-6 text-base font-semibold text-white"
        >
          <RotateCcw size={18} />
          もう一度挑戦
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 進捗 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-cocoa-500 dark:text-sand-200">
          <span>
            問 {q.no} / {total}
          </span>
          <span>正解 {score}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-cocoa-800">
          <div
            className="h-full rounded-full bg-cocoa-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 設問 */}
      <div className="rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900">
        <p className="text-base leading-relaxed text-cocoa-800 dark:text-cream-50">
          {q.question}
        </p>
        {isMulti && (
          <p className="mt-2 text-sm font-semibold text-cocoa-500 dark:text-sand-200">
            ※ {q.correct.length}つ選択してください
          </p>
        )}
      </div>

      {/* 選択肢 */}
      <ul className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const chosen = selected.includes(i);
          const answer = correctSet.has(i);
          // 回答後の配色
          let cls =
            "border-cream-200 bg-white text-cocoa-800 dark:border-cocoa-800 dark:bg-cocoa-900 dark:text-cream-50";
          if (locked) {
            if (answer)
              cls =
                "border-green-500 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200";
            else if (chosen)
              cls =
                "border-red-400 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
            else cls = "border-cream-200 bg-white text-cocoa-400 dark:border-cocoa-800 dark:bg-cocoa-900 dark:text-sand-200";
          } else if (chosen) {
            cls =
              "border-cocoa-500 bg-cream-100 text-cocoa-800 dark:border-cocoa-400 dark:bg-cocoa-800 dark:text-cream-50";
          }
          return (
            <li key={i}>
              <button
                onClick={() => pick(i)}
                disabled={locked}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl2 border-2 px-4 py-3 text-left text-base transition-colors ${cls}`}
              >
                <span className="shrink-0">
                  {locked && answer ? (
                    <Check size={20} className="text-green-600 dark:text-green-300" />
                  ) : locked && chosen ? (
                    <X size={20} className="text-red-500 dark:text-red-300" />
                  ) : isMulti ? (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                        chosen ? "border-cocoa-500 bg-cocoa-500 text-white" : "border-sand-300"
                      }`}
                    >
                      {chosen && <Check size={14} strokeWidth={3} />}
                    </span>
                  ) : (
                    <Circle size={18} className="text-sand-300" />
                  )}
                </span>
                <span>{opt}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 複数選択の回答ボタン */}
      {isMulti && !locked && (
        <button
          onClick={submitMulti}
          disabled={selected.length !== q.correct.length}
          className={`min-h-[48px] rounded-full text-base font-semibold ${
            selected.length === q.correct.length
              ? "bg-cocoa-600 text-white"
              : "bg-cream-200 text-cocoa-400 dark:bg-cocoa-800 dark:text-sand-200"
          }`}
        >
          回答する（{selected.length}/{q.correct.length}）
        </button>
      )}

      {/* 判定＋解答・解説 */}
      {locked && (
        <div
          className={`rounded-xl2 border p-4 ${
            isCorrect
              ? "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
              : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          }`}
        >
          <p
            className={`flex items-center gap-2 text-base font-bold ${
              isCorrect
                ? "text-green-700 dark:text-green-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            {isCorrect ? <Check size={20} /> : <X size={20} />}
            {isCorrect ? "正解！" : "不正解"}
          </p>
          <p className="mt-2 text-sm font-semibold text-cocoa-700 dark:text-cream-100">
            解答：{q.correct.map((c) => q.options[c]).join("・")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-cocoa-700 dark:text-cream-100">
            {q.explanation}
          </p>
          {q.note && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{q.note}</p>
          )}
          <button
            onClick={next}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-cocoa-600 px-6 text-base font-semibold text-white"
          >
            {index + 1 >= total ? "結果を見る" : "次の問題へ"}
          </button>
        </div>
      )}
    </div>
  );
}
