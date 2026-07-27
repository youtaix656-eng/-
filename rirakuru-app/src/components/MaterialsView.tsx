"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, PlayCircle, FileText, ExternalLink } from "lucide-react";
import { materialGenres } from "@/data/materials";
import { readJSON, writeJSON } from "@/lib/storage";

// ============================================================
// 研修教材一覧（大項目1〜9 × 項目1〜）
// - チェック状態は端末に保存（日付リセットなし＝学習の進捗記録）
// - アプリ内に収録済みの項目（自主基準・ハンドリフレ）はリンクボタンを表示
// ============================================================

const STORAGE_KEY = "rirakuru:materials-checked";

export function MaterialsView() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openGenre, setOpenGenre] = useState<number | null>(1);

  useEffect(() => {
    setChecked(readJSON<Record<string, boolean>>(STORAGE_KEY, {}));
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeJSON(STORAGE_KEY, next);
      return next;
    });
  };

  const totalItems = useMemo(
    () => materialGenres.reduce((n, g) => n + g.items.length, 0),
    []
  );
  const totalChecked = useMemo(
    () =>
      materialGenres.reduce(
        (n, g) => n + g.items.filter((it) => checked[it.id]).length,
        0
      ),
    [checked]
  );
  const percent = totalItems === 0 ? 0 : Math.round((totalChecked / totalItems) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* 全体進捗 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-cocoa-600 dark:text-sand-200">
          <span>全体の確認状況</span>
          <span>
            {totalChecked} / {totalItems}（{percent}%）
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-cream-200 dark:bg-cocoa-800">
          <div
            className="h-full rounded-full bg-cocoa-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 大項目ごとのアコーディオン */}
      <ul className="flex flex-col gap-2">
        {materialGenres.map((genre) => {
          const genreChecked = genre.items.filter((it) => checked[it.id]).length;
          const open = openGenre === genre.no;
          return (
            <li
              key={genre.no}
              className="overflow-hidden rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900"
            >
              <button
                onClick={() => setOpenGenre(open ? null : genre.no)}
                aria-expanded={open}
                className="flex min-h-[52px] w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cocoa-500 text-sm font-bold text-white">
                    {genre.no}
                  </span>
                  <span className="text-base font-semibold text-cocoa-800 dark:text-cream-50">
                    {genre.title}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-cocoa-400 dark:text-sand-200">
                    {genreChecked}/{genre.items.length}
                  </span>
                  <ChevronDown
                    size={20}
                    className={`text-cocoa-400 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </button>

              {open && (
                <ul className="border-t border-cream-100 dark:border-cocoa-800">
                  {genre.items.map((item) => {
                    const isChecked = !!checked[item.id];
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 border-b border-cream-100 px-4 py-2.5 last:border-0 dark:border-cocoa-800"
                      >
                        <button
                          onClick={() => toggle(item.id)}
                          aria-pressed={isChecked}
                          className="flex min-h-[44px] flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                              isChecked
                                ? "border-cocoa-500 bg-cocoa-500 text-white"
                                : "border-sand-300 bg-transparent"
                            }`}
                          >
                            {isChecked && <Check size={16} strokeWidth={3} />}
                          </span>
                          <span className="text-xs font-semibold text-cocoa-400">
                            {genre.no}-{item.no}
                          </span>
                          {item.kind === "video" ? (
                            <PlayCircle size={16} className="shrink-0 text-cocoa-400" />
                          ) : (
                            <FileText size={16} className="shrink-0 text-cocoa-400" />
                          )}
                          <span
                            className={`text-sm ${
                              isChecked
                                ? "text-cocoa-400 line-through dark:text-sand-200"
                                : "text-cocoa-800 dark:text-cream-50"
                            }`}
                          >
                            {item.title}
                          </span>
                        </button>
                        {item.covered && item.link && (
                          <Link
                            href={item.link}
                            className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-sand-100 px-3 text-xs font-semibold text-cocoa-700 dark:bg-cocoa-800 dark:text-sand-200"
                          >
                            収録済み
                            <ExternalLink size={12} />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
