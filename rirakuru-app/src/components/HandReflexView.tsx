"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { handReflex, handSections, type HandStep } from "@/data/handReflex";

// ============================================================
// ハンドリフレ画面
// - 手順（通し）：1〜の通し番号でセクションごとに表示
// - 順番一問一答：「◯◯の次は？」を手順から自動生成（タップで答え表示）
// ============================================================

type Mode = "flow" | "order";

export function HandReflexView() {
  const [mode, setMode] = useState<Mode>("flow");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-cream-100 p-1 dark:bg-cocoa-800">
        <button
          onClick={() => setMode("flow")}
          className={`min-h-[44px] rounded-full text-sm font-semibold transition-colors ${
            mode === "flow" ? "bg-cocoa-600 text-white" : "text-cocoa-600 dark:text-sand-200"
          }`}
        >
          手順（全{handReflex.length}）
        </button>
        <button
          onClick={() => setMode("order")}
          className={`min-h-[44px] rounded-full text-sm font-semibold transition-colors ${
            mode === "order" ? "bg-cocoa-600 text-white" : "text-cocoa-600 dark:text-sand-200"
          }`}
        >
          順番 一問一答
        </button>
      </div>

      {mode === "flow" ? <Flow /> : <OrderQuiz />}
    </div>
  );
}

// ---------------- 手順（通し） ----------------
function Flow() {
  return (
    <div className="flex flex-col gap-5">
      {handSections.map((sec) => {
        const steps = handReflex.filter((s) => s.section === sec);
        if (steps.length === 0) return null;
        return (
          <section key={sec}>
            <h2 className="mb-2 rounded-lg bg-sand-100 px-3 py-1 text-sm font-bold text-cocoa-700 dark:bg-cocoa-800 dark:text-sand-200">
              {sec}
            </h2>
            <ol className="flex flex-col gap-2">
              {steps.map((step) => (
                <li
                  key={step.no}
                  className="flex gap-3 rounded-xl2 border border-cream-200 bg-white p-3 dark:border-cocoa-800 dark:bg-cocoa-900"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cocoa-500 text-sm font-bold text-white">
                    {step.no}
                  </span>
                  <div>
                    <p className="text-base font-medium text-cocoa-800 dark:text-cream-50">
                      {step.name}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-cocoa-500 dark:text-sand-200">
                      {step.detail}
                    </p>
                    {step.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={step.image}
                        alt={step.name}
                        className="mt-2 w-full max-w-xs rounded-lg"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

// ---------------- 順番 一問一答 ----------------
// 手順の並びから「Nの次は？」を自動生成する。
type OrderQA = { q: string; a: string };

function buildOrderQA(): OrderQA[] {
  const qa: OrderQA[] = [];
  // 最初は何か
  qa.push({
    q: "ハンドリフレの一番最初は？",
    a: `手順1：${handReflex[0].name}（${handReflex[0].detail}）`,
  });
  // 各手順の「次」
  for (let i = 0; i < handReflex.length - 1; i++) {
    const cur = handReflex[i];
    const next = handReflex[i + 1];
    const sameSection = cur.section === next.section;
    qa.push({
      q: `手順${cur.no}「${cur.name}」の次は？`,
      a: `手順${next.no}：${next.name}${
        sameSection ? "" : `（ここから「${next.section}」）`
      } — ${next.detail}`,
    });
  }
  return qa;
}

function OrderQuiz() {
  const qaList = useMemo(buildOrderQA, []);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-cocoa-500 dark:text-sand-200">
        「◯◯の次は？」で順番を確認できます。タップで答えを表示。
      </p>
      <button
        onClick={() => setAllOpen((v) => !v)}
        className="self-end text-sm font-semibold text-cocoa-600 underline underline-offset-4 dark:text-sand-200"
      >
        {allOpen ? "すべて閉じる" : "すべて開く"}
      </button>
      <ul className="flex flex-col gap-2">
        {qaList.map((item, i) => {
          const open = allOpen || openIdx === i;
          return (
            <li
              key={i}
              className="overflow-hidden rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900"
            >
              <button
                onClick={() => setOpenIdx(open ? null : i)}
                aria-expanded={open}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="text-base font-medium text-cocoa-800 dark:text-cream-50">
                  {item.q}
                </span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-cocoa-400 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open && (
                <p className="border-t border-cream-100 px-4 py-3 text-base leading-relaxed text-cocoa-700 dark:border-cocoa-800 dark:text-cream-100">
                  {item.a}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
