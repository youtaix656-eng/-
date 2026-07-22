"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { checklists } from "@/data/checklists";
import { readJSON, writeJSON, STORAGE_KEYS } from "@/lib/storage";

// ============================================================
// チェックリスト本体
// - タップでチェック / 解除
// - 日付が変わったら自動リセット（保存データに日付を持たせて判定）
// - 進捗バーを表示
// ============================================================

type Saved = {
  date: string; // "YYYY-MM-DD"（この日付のチェックだけ有効）
  checked: Record<string, boolean>;
};

/** 端末のローカル日付を "YYYY-MM-DD" で返す */
function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function ChecklistView() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  // 初期読み込み：保存日が今日でなければリセット
  useEffect(() => {
    const saved = readJSON<Saved | null>(STORAGE_KEYS.checklist, null);
    if (saved && saved.date === today()) {
      setChecked(saved.checked);
    } else {
      setChecked({});
      writeJSON<Saved>(STORAGE_KEYS.checklist, { date: today(), checked: {} });
    }
    setReady(true);
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeJSON<Saved>(STORAGE_KEYS.checklist, { date: today(), checked: next });
      return next;
    });
  };

  // 全体の進捗
  const total = useMemo(
    () => checklists.reduce((n, c) => n + c.items.length, 0),
    []
  );
  const done = useMemo(
    () =>
      checklists.reduce(
        (n, c) => n + c.items.filter((it) => checked[it.id]).length,
        0
      ),
    [checked]
  );
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  if (!ready) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* 全体進捗バー */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-cocoa-600 dark:text-sand-200">
          <span>本日の進捗</span>
          <span>
            {done} / {total}（{percent}%）
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-cocoa-800">
          <div
            className="h-full rounded-full bg-cocoa-500 transition-all"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-1 text-xs text-cocoa-400 dark:text-sand-200">
          日付が変わると自動でリセットされます。
        </p>
      </div>

      {checklists.map((list) => {
        const listDone = list.items.filter((it) => checked[it.id]).length;
        return (
          <section
            key={list.id}
            className="rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900"
          >
            <h2 className="flex items-center justify-between border-b border-cream-100 px-4 py-3 text-base font-semibold text-cocoa-800 dark:border-cocoa-800 dark:text-cream-50">
              {list.title}
              <span className="text-sm font-normal text-cocoa-400 dark:text-sand-200">
                {listDone}/{list.items.length}
              </span>
            </h2>
            <ul>
              {list.items.map((it) => {
                const on = !!checked[it.id];
                return (
                  <li key={it.id} className="border-b border-cream-100 last:border-0 dark:border-cocoa-800">
                    <button
                      onClick={() => toggle(it.id)}
                      aria-pressed={on}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                          on
                            ? "border-cocoa-500 bg-cocoa-500 text-white"
                            : "border-sand-300 bg-transparent"
                        }`}
                      >
                        {on && <Check size={16} strokeWidth={3} />}
                      </span>
                      <span
                        className={`text-base ${
                          on
                            ? "text-cocoa-400 line-through dark:text-sand-200"
                            : "text-cocoa-800 dark:text-cream-50"
                        }`}
                      >
                        {it.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
