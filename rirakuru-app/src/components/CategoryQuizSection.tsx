"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpenCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Flashcard } from "./Flashcard";
import { gradeItem, type Grade } from "@/lib/srs";
import type { SimpleCard } from "@/lib/categoryQA";

// ============================================================
// 目次（カテゴリ）ページの「一問一答」枠
// - 表=問題／裏=答えの暗記カードをこの場でめくって学習できる
// - 自主基準（isStandards）では、○×正誤問題・四択問題（自主基準テスト）
//   への入り口もあわせて表示する
// ============================================================
export function CategoryQuizSection({
  cards,
  isStandards = false,
}: {
  cards: SimpleCard[];
  isStandards?: boolean;
}) {
  const [index, setIndex] = useState(0);

  const handleGrade = (grade: Grade) => {
    gradeItem(cards[index].id, grade);
    setIndex((i) => (i + 1) % cards.length);
  };

  return (
    <section className="rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-cocoa-800 dark:text-cream-50">
        <BookOpenCheck size={18} />
        一問一答
      </h2>
      <p className="mb-3 text-xs text-cocoa-400 dark:text-sand-200">
        表面が問題、タップすると裏面に答えが出ます。
      </p>

      {cards.length === 0 ? (
        <p className="text-sm text-cocoa-500 dark:text-sand-200">
          この目次の一問一答はまだありません。
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-cocoa-500 dark:text-sand-200">
            {index + 1} / {cards.length} 問
          </p>
          <Flashcard
            key={cards[index].id}
            card={{
              id: cards[index].id,
              source: "qa",
              front: cards[index].front,
              back: cards[index].back,
            }}
            onGrade={handleGrade}
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIndex((i) => (i - 1 + cards.length) % cards.length)}
              className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 dark:text-sand-200"
            >
              <ChevronLeft size={18} />
              前へ
            </button>
            <button
              onClick={() => setIndex((i) => (i + 1) % cards.length)}
              className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 dark:text-sand-200"
            >
              次へ
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {isStandards && (
        <div className="mt-4 flex flex-col gap-2 border-t border-cream-100 pt-3 dark:border-cocoa-800">
          <Link
            href="/quiz"
            className="flex min-h-[44px] items-center justify-center rounded-full border-2 border-cocoa-600 text-sm font-semibold text-cocoa-600 dark:text-cream-50"
          >
            ○×正誤問題を解く →
          </Link>
          <Link
            href="/test"
            className="flex min-h-[44px] items-center justify-center rounded-full bg-cocoa-600 text-sm font-semibold text-white"
          >
            四択問題（自主基準テスト）を解く →
          </Link>
        </div>
      )}
    </section>
  );
}
