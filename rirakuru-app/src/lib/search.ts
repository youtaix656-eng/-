import { items } from "@/data/items";
import { categories } from "@/data/categories";
import { glossary } from "@/data/glossary";
import { handReflex } from "@/data/handReflex";

// ============================================================
// 全コンテンツ横断のあいまい検索
// 詳細項目・カテゴリ・用語をまとめて対象にする。
// ============================================================

export type SearchResult = {
  kind: "item" | "category" | "glossary";
  /** 遷移先のパス */
  href: string;
  title: string;
  /** 補足（カテゴリ名や要約など） */
  subtitle?: string;
};

/** 検索対象を1つの配列にまとめる（キーワードも連結して持つ） */
type Indexed = SearchResult & { haystack: string };

const index: Indexed[] = [
  ...categories.map((c) => ({
    kind: "category" as const,
    href:
      c.slug === "glossary"
        ? "/glossary"
        : c.slug === "hand"
        ? "/hand"
        : `/category/${c.slug}`,
    title: c.title,
    subtitle: "カテゴリ",
    haystack: [c.title, c.description].join(" ").toLowerCase(),
  })),
  ...items.map((i) => {
    const cat = categories.find((c) => c.slug === i.categorySlug);
    return {
      kind: "item" as const,
      href: `/item/${i.id}`,
      title: i.title,
      subtitle: cat?.title,
      haystack: [
        i.title,
        i.summary ?? "",
        i.body ?? "",
        ...(i.tags ?? []),
        ...(i.steps ?? []).map((s) => s.text),
      ]
        .join(" ")
        .toLowerCase(),
    };
  }),
  ...glossary.map((g) => ({
    kind: "glossary" as const,
    href: `/glossary#${g.id}`,
    title: g.term,
    subtitle: "用語集",
    haystack: [g.term, g.reading, g.definition].join(" ").toLowerCase(),
  })),
  ...handReflex.map((s) => ({
    kind: "item" as const,
    href: "/hand",
    title: `手順${s.no}：${s.name}`,
    subtitle: `ハンドリフレ・${s.section}`,
    haystack: [s.name, s.detail, s.section, "ハンドリフレ"].join(" ").toLowerCase(),
  })),
];

/**
 * あいまい検索。
 * スペース区切りの語をすべて含むもの（AND）にマッチさせる簡易実装。
 */
export function search(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return index
    .filter((row) => terms.every((t) => row.haystack.includes(t)))
    .map(({ haystack, ...rest }) => rest);
}
