"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, X, RotateCcw, ChevronDown, ChevronLeft, ChevronRight, BrainCircuit } from "lucide-react";
import { qaList, oxList } from "@/data/quiz";
import { gradeByCorrectness, gradeItem } from "@/lib/srs";
import { Flashcard } from "./Flashcard";

// ============================================================
// クイズ画面
// - 一問一答：暗記カード（表=問題／裏=答え）を1問ずつめくって進む。
//   評価（○△✕）は間隔反復（/review）の記録に使われる。一覧表示も切替可。
// - ○×問題：1問ずつ回答し、正誤と解説を表示。得点を集計。
//   正誤は自動で間隔反復の記録にも使われる。
// ============================================================

type Mode = "qa" | "ox";

export function QuizView() {
  const [mode, setMode] = useState<Mode>("qa");

  return (
    <div className="flex flex-col gap-4">
      {/* モード切り替え */}
      <div className="grid grid-cols-2 gap-2 rounded-full bg-cream-100 p-1 dark:bg-cocoa-800">
        <button
          onClick={() => setMode("qa")}
          className={`min-h-[44px] rounded-full text-sm font-semibold transition-colors ${
            mode === "qa"
              ? "bg-cocoa-600 text-white"
              : "text-cocoa-600 dark:text-sand-200"
          }`}
        >
          一問一答（{qaList.length}問）
        </button>
        <button
          onClick={() => setMode("ox")}
          className={`min-h-[44px] rounded-full text-sm font-semibold transition-colors ${
            mode === "ox"
              ? "bg-cocoa-600 text-white"
              : "text-cocoa-600 dark:text-sand-200"
          }`}
        >
          ○×問題（{oxList.length}問）
        </button>
      </div>

      {mode === "qa" ? <QAFlashcards /> : <OXQuiz />}
    </div>
  );
}

// ---------------- 一問一答（暗記カード） ----------------
function QAFlashcards() {
  const total = qaList.length;
  const [index, setIndex] = useState(0);
  const [listMode, setListMode] = useState(false);

  // 一覧表示（従来のタップ開閉リスト。ざっと見返したいとき用）
  if (listMode) {
    return <QAList onSwitchToCards={() => setListMode(false)} />;
  }

  const item = qaList[index];
  const percent = Math.round((index / total) * 100);

  const handleGrade = (grade: "good" | "hard" | "again") => {
    gradeItem(item.id, grade);
    if (index + 1 < total) setIndex((i) => i + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-cocoa-500 dark:text-sand-200">
        <span>
          {index + 1} / {total} 問
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/review"
            className="flex items-center gap-1 font-semibold text-cocoa-600 underline underline-offset-4 dark:text-sand-200"
          >
            <BrainCircuit size={16} />
            復習
          </Link>
          <button
            onClick={() => setListMode(true)}
            className="font-semibold text-cocoa-600 underline underline-offset-4 dark:text-sand-200"
          >
            一覧表示
          </button>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-cocoa-800">
        <div
          className="h-full rounded-full bg-cocoa-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <Flashcard
        key={item.id}
        card={{ id: item.id, source: "qa", front: item.q, back: item.a, ref: item.ref }}
        onGrade={handleGrade}
      />

      {/* 手動での前後移動（評価せずに見るだけ移動したい場合） */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 disabled:opacity-30 dark:text-sand-200"
        >
          <ChevronLeft size={18} />
          前へ
        </button>
        <button
          onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          disabled={index === total - 1}
          className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 disabled:opacity-30 dark:text-sand-200"
        >
          次へ
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------------- 一問一答：一覧表示（従来のタップ開閉リスト） ----------------
function QAList({ onSwitchToCards }: { onSwitchToCards: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          onClick={onSwitchToCards}
          className="text-sm font-semibold text-cocoa-600 underline underline-offset-4 dark:text-sand-200"
        >
          ← カード表示に戻る
        </button>
        <button
          onClick={() => setAllOpen((v) => !v)}
          className="text-sm font-semibold text-cocoa-600 underline underline-offset-4 dark:text-sand-200"
        >
          {allOpen ? "すべて閉じる" : "すべて開く"}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {qaList.map((item, i) => {
          const open = allOpen || openId === item.id;
          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900"
            >
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                className="flex min-h-[44px] w-full items-start justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="flex gap-2">
                  <span className="shrink-0 font-bold text-cocoa-400">Q{i + 1}.</span>
                  <span className="text-base font-medium text-cocoa-800 dark:text-cream-50">
                    {item.q}
                  </span>
                </span>
                <ChevronDown
                  size={20}
                  className={`mt-0.5 shrink-0 text-cocoa-400 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open && (
                <div className="border-t border-cream-100 px-4 py-3 dark:border-cocoa-800">
                  <p className="flex gap-2 text-base leading-relaxed text-cocoa-700 dark:text-cream-100">
                    <span className="shrink-0 font-bold text-cocoa-500">A.</span>
                    <span>{item.a}</span>
                  </p>
                  {item.ref && (
                    <p className="mt-2 text-xs text-cocoa-400 dark:text-sand-200">
                      出典：{item.ref}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------- ○×問題 ----------------
function OXQuiz() {
  const total = oxList.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = oxList[index];
  const correct = picked !== null && picked === current.answer;

  const percent = useMemo(
    () => Math.round((index / total) * 100),
    [index, total]
  );

  const answer = (choice: boolean) => {
    if (picked !== null) return; // 二重回答を防ぐ
    setPicked(choice);
    const isCorrect = choice === current.answer;
    if (isCorrect) setScore((s) => s + 1);
    gradeByCorrectness(current.id, isCorrect);
  };

  const next = () => {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const rate = Math.round((score / total) * 100);
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl2 border border-cream-200 bg-white p-6 text-center dark:border-cocoa-800 dark:bg-cocoa-900">
        <p className="text-lg font-semibold text-cocoa-800 dark:text-cream-50">
          結果
        </p>
        <p className="text-4xl font-bold text-cocoa-600 dark:text-cream-50">
          {score} / {total}
        </p>
        <p className="text-sm text-cocoa-500 dark:text-sand-200">正答率 {rate}%</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            onClick={restart}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-cocoa-600 px-6 text-base font-semibold text-white"
          >
            <RotateCcw size={18} />
            もう一度
          </button>
          <Link
            href="/review"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-cocoa-600 px-6 text-base font-semibold text-cocoa-600 dark:text-cream-50"
          >
            <BrainCircuit size={18} />
            間違えた問題を復習
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 進捗 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-cocoa-500 dark:text-sand-200">
          <span>
            {index + 1} / {total} 問
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

      {/* 問題文 */}
      <div className="rounded-xl2 border border-cream-200 bg-white p-5 dark:border-cocoa-800 dark:bg-cocoa-900">
        <p className="text-lg leading-relaxed text-cocoa-800 dark:text-cream-50">
          {current.statement}
        </p>
      </div>

      {/* ○× ボタン */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => answer(true)}
          disabled={picked !== null}
          aria-label="○（正しい）"
          className={`flex min-h-[64px] items-center justify-center rounded-xl2 border-2 text-3xl font-bold transition-colors ${
            picked === null
              ? "border-cream-200 bg-white text-cocoa-600 active:bg-cream-100 dark:border-cocoa-800 dark:bg-cocoa-900 dark:text-cream-50"
              : current.answer === true
              ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
              : picked === true
              ? "border-red-400 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
              : "border-cream-200 bg-white text-cocoa-300 dark:border-cocoa-800 dark:bg-cocoa-900"
          }`}
        >
          ○
        </button>
        <button
          onClick={() => answer(false)}
          disabled={picked !== null}
          aria-label="×（誤り）"
          className={`flex min-h-[64px] items-center justify-center rounded-xl2 border-2 text-3xl font-bold transition-colors ${
            picked === null
              ? "border-cream-200 bg-white text-cocoa-600 active:bg-cream-100 dark:border-cocoa-800 dark:bg-cocoa-900 dark:text-cream-50"
              : current.answer === false
              ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
              : picked === false
              ? "border-red-400 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
              : "border-cream-200 bg-white text-cocoa-300 dark:border-cocoa-800 dark:bg-cocoa-900"
          }`}
        >
          ×
        </button>
      </div>

      {/* 判定＋解説 */}
      {picked !== null && (
        <div
          className={`rounded-xl2 border p-4 ${
            correct
              ? "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40"
              : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          }`}
        >
          <p
            className={`flex items-center gap-2 text-base font-bold ${
              correct
                ? "text-green-700 dark:text-green-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            {correct ? <Check size={20} /> : <X size={20} />}
            {correct ? "正解！" : "不正解"}（答え：{current.answer ? "○" : "×"}）
          </p>
          <p className="mt-2 text-sm leading-relaxed text-cocoa-700 dark:text-cream-100">
            {current.explanation}
          </p>
          {current.ref && (
            <p className="mt-1 text-xs text-cocoa-400 dark:text-sand-200">
              出典：{current.ref}
            </p>
          )}
          {!correct && (
            <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-300">
              この問題は復習リストに追加されました（/review）
            </p>
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
