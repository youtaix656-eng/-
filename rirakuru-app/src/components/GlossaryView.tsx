"use client";

import { useMemo } from "react";
import { glossary } from "@/data/glossary";

// ============================================================
// 用語集（五十音順・頭文字ジャンプナビ付き）
// reading（ひらがな）の先頭文字を「あ〜わ」の行にまとめる。
// ============================================================

// 五十音の行と、その行に含まれる先頭文字
const ROWS: { label: string; chars: string[] }[] = [
  { label: "あ", chars: ["あ", "い", "う", "え", "お"] },
  { label: "か", chars: ["か", "き", "く", "け", "こ", "が", "ぎ", "ぐ", "げ", "ご"] },
  { label: "さ", chars: ["さ", "し", "す", "せ", "そ", "ざ", "じ", "ず", "ぜ", "ぞ"] },
  { label: "た", chars: ["た", "ち", "つ", "て", "と", "だ", "ぢ", "づ", "で", "ど"] },
  { label: "な", chars: ["な", "に", "ぬ", "ね", "の"] },
  { label: "は", chars: ["は", "ひ", "ふ", "へ", "ほ", "ば", "び", "ぶ", "べ", "ぼ", "ぱ", "ぴ", "ぷ", "ぺ", "ぽ"] },
  { label: "ま", chars: ["ま", "み", "む", "め", "も"] },
  { label: "や", chars: ["や", "ゆ", "よ"] },
  { label: "ら", chars: ["ら", "り", "る", "れ", "ろ"] },
  { label: "わ", chars: ["わ", "を", "ん"] },
];

function rowLabelOf(reading: string): string {
  const head = reading.charAt(0);
  const row = ROWS.find((r) => r.chars.includes(head));
  return row ? row.label : "その他";
}

export function GlossaryView() {
  // 行ごとにグループ化し、各グループ内も五十音順に並べる
  const groups = useMemo(() => {
    const sorted = [...glossary].sort((a, b) =>
      a.reading.localeCompare(b.reading, "ja")
    );
    const map = new Map<string, typeof glossary>();
    for (const term of sorted) {
      const key = rowLabelOf(term.reading);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(term);
    }
    // ROWS の順番で並べる
    return ROWS.map((r) => ({ label: r.label, terms: map.get(r.label) ?? [] }))
      .filter((g) => g.terms.length > 0);
  }, []);

  const availableLabels = new Set(groups.map((g) => g.label));

  return (
    <div>
      {/* 頭文字ジャンプナビ */}
      <nav
        aria-label="頭文字で移動"
        className="sticky top-[64px] z-10 -mx-4 mb-4 flex flex-wrap gap-1 bg-cream-50/90 px-4 py-2 backdrop-blur dark:bg-cocoa-900/90"
      >
        {ROWS.map((r) => {
          const enabled = availableLabels.has(r.label);
          return enabled ? (
            <a
              key={r.label}
              href={`#row-${r.label}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-sand-100 text-sm font-semibold text-cocoa-700 dark:bg-cocoa-800 dark:text-sand-200"
            >
              {r.label}
            </a>
          ) : (
            <span
              key={r.label}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-cocoa-300 dark:text-cocoa-700"
            >
              {r.label}
            </span>
          );
        })}
      </nav>

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.label} id={`row-${g.label}`} className="scroll-mt-28">
            <h2 className="mb-2 text-lg font-bold text-cocoa-600 dark:text-sand-200">
              {g.label}
            </h2>
            <dl className="flex flex-col gap-2">
              {g.terms.map((t) => (
                <div
                  key={t.id}
                  id={t.id}
                  className="scroll-mt-28 rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900"
                >
                  <dt className="text-base font-semibold text-cocoa-800 dark:text-cream-50">
                    {t.term}
                    <span className="ml-2 text-xs font-normal text-cocoa-400 dark:text-sand-200">
                      {t.reading}
                    </span>
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-cocoa-600 dark:text-sand-200">
                    {t.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
