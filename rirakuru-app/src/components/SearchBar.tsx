"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { search } from "@/lib/search";

// ============================================================
// 全コンテンツ横断のあいまい検索バー
// 入力に応じて結果をその場に表示する。
// ============================================================
export function SearchBar() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => search(query).slice(0, 12), [query]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 shadow-sm focus-within:border-cocoa-400 dark:border-cocoa-800 dark:bg-cocoa-900">
        <Search size={20} className="shrink-0 text-cocoa-400" />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="手順・ルール・用語を検索"
          aria-label="検索"
          className="h-9 w-full bg-transparent text-base text-cocoa-800 outline-none placeholder:text-cocoa-400 dark:text-cream-50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="検索をクリア"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cocoa-400 hover:bg-cream-100 dark:hover:bg-cocoa-800"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {query.trim() && (
        <div className="mt-2 overflow-hidden rounded-xl2 border border-cream-200 bg-white dark:border-cocoa-800 dark:bg-cocoa-900">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-cocoa-500 dark:text-sand-200">
              「{query}」に一致する項目は見つかりませんでした。
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.href + r.title}>
                  <Link
                    href={r.href}
                    className="flex min-h-[44px] items-center justify-between gap-3 border-b border-cream-100 px-4 py-3 last:border-0 hover:bg-cream-50 dark:border-cocoa-800 dark:hover:bg-cocoa-800"
                  >
                    <span className="text-base text-cocoa-800 dark:text-cream-50">
                      {r.title}
                    </span>
                    {r.subtitle && (
                      <span className="shrink-0 text-xs text-cocoa-400 dark:text-sand-200">
                        {r.subtitle}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
