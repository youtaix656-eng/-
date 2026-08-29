// キーワード検索 — **このファイルが単一の正**。
// 画面（App.jsx / 目次 / お気に入り）は必ずここを通す。検索の判定を画面側に書き足さない。
//
// 設計の約束:
//   1. **正規化は長さを変えない**（全角→半角・大文字→小文字・カタカナ→ひらがな のみ）。
//      文字を削ると、当たった場所を元の文章に戻せなくなり、色付け（ハイライト）がズレる。
//   2. **空白区切りは「かつ」**（AND）。`-語` はその語を含むものを外す。
//      1語も入っていないものは出さない——「たぶん近い」を混ぜると、なぜ出たのか分からなくなる。
//   3. **言い換えを必ず通す**（schema.js の SYNONYMS）。困っている時の言葉（ねむれない）と
//      データの言葉（睡眠）が違うだけで引けない、が検索がいちばん失敗する形。
//   4. **0件で行き止まりにしない**（explainNoHits）。「どの語を外すと何件見つかるか」を必ず返す。
//   5. 点数の付け方は「当たった場所の重み × 語の長さ」。固定点だと、短い語がたまたま
//      当たっただけのものが、題名にそのまま入っているものに勝ってしまう。

import { SYNONYM_INDEX, CATEGORY_MAP } from '../data/schema.js';
import { kataToHira, toHalfWidth } from './yomi.js';

/** 検索用の正規化（長さを変えない） */
export function normalize(text) {
  return kataToHira(toHalfWidth(String(text ?? ''))).toLowerCase();
}

/** 当たった場所ごとの重み。題名に入っている＞説明の中にある。 */
export const FIELD_WEIGHTS = {
  title: 10,
  reading: 8,
  tags: 7,
  situations: 6,
  summary: 4,
  steps: 2,
  why: 2,
  caution: 1,
  category: 3,
};

/**
 * 入力を語に分ける。
 * 「-語」は除外語。空白は半角・全角どちらでもよい。
 * @returns {{terms:string[], excludes:string[], raw:string}}
 */
export function parseQuery(text) {
  const raw = String(text ?? '').trim();
  const parts = toHalfWidth(raw).split(/\s+/).filter(Boolean);
  const terms = [];
  const excludes = [];
  for (const part of parts) {
    if ((part.startsWith('-') || part.startsWith('ー')) && part.length > 1) excludes.push(part.slice(1));
    else terms.push(part);
  }
  return { terms, excludes, raw };
}

/** 語を言い換えごと広げる（自分自身を必ず含む。正規化済みで返す） */
export function expandTerm(term) {
  const base = String(term ?? '').trim();
  if (!base) return [];
  const out = new Set([normalize(base)]);
  const siblings = SYNONYM_INDEX.get(base);
  if (siblings) for (const s of siblings) out.add(normalize(s));
  // 言い換え表は表記（漢字・かな）で引くので、正規化した形でも一度引く
  for (const [key, set] of SYNONYM_INDEX) {
    if (normalize(key) !== normalize(base)) continue;
    for (const s of set) out.add(normalize(s));
  }
  return [...out].filter(Boolean);
}

/** 1件ぶんの探し先（場所ごとに分けて持つ。ハイライトにも使う） */
export function buildHaystack(hack) {
  const category = CATEGORY_MAP[hack.category];
  return {
    title: [hack.title],
    reading: [hack.reading],
    tags: hack.tags || [],
    situations: hack.situations || [],
    summary: [hack.summary],
    steps: hack.steps || [],
    why: [hack.why],
    caution: [hack.caution],
    category: [category ? category.label : '', category ? category.reading : ''],
  };
}

function fieldsHit(haystack, needle) {
  const hits = [];
  for (const [field, values] of Object.entries(haystack)) {
    for (const value of values) {
      if (!value) continue;
      if (normalize(value).includes(needle)) {
        hits.push(field);
        break;
      }
    }
  }
  return hits;
}

/**
 * 1件の点数。**すべての語が どこかに 当たっている時だけ** 0 より大きい値を返す。
 * @returns {{score:number, hitFields:string[], usedSynonym:boolean}}
 */
export function scoreHack(hack, query) {
  const { terms, excludes } = typeof query === 'string' ? parseQuery(query) : query;
  const haystack = buildHaystack(hack);

  for (const ex of excludes) {
    const needles = expandTerm(ex);
    if (needles.some((n) => fieldsHit(haystack, n).length > 0)) return { score: 0, hitFields: [], usedSynonym: false };
  }
  if (terms.length === 0) return { score: 0, hitFields: [], usedSynonym: false };

  let score = 0;
  const hitFields = new Set();
  let usedSynonym = false;
  for (const term of terms) {
    const needles = expandTerm(term);
    const self = normalize(term);
    let best = 0;
    let bestSynonym = false;
    for (const needle of needles) {
      const fields = fieldsHit(haystack, needle);
      if (fields.length === 0) continue;
      // 言い換えで当たったぶんは少し弱く見る（本人が書いた語のほうが確か）
      const factor = needle === self ? 1 : 0.6;
      for (const field of fields) {
        const point = (FIELD_WEIGHTS[field] || 1) * (1 + needle.length / 10) * factor;
        if (point > best) {
          best = point;
          bestSynonym = needle !== self;
        }
        hitFields.add(field);
      }
    }
    if (best === 0) return { score: 0, hitFields: [], usedSynonym: false }; // 1語でも無ければ出さない
    if (bestSynonym) usedSynonym = true;
    score += best;
  }
  return { score, hitFields: [...hitFields], usedSynonym };
}

/**
 * 検索本体。
 * @param {Array} hacks 全件
 * @param {string} text  入力
 * @param {{categories?:string[], effortMax?:number, ids?:string[]}} filters 絞り込み（検索語が空でも効く）
 * @returns {Array} 点数の高い順。入力が空なら絞り込みだけを掛けた全件（もとの並び）。
 */
export function searchHacks(hacks = [], text = '', filters = {}) {
  const pool = hacks.filter((h) => {
    if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(h.category)) return false;
    if (filters.effortMax && (h.effort || 1) > filters.effortMax) return false;
    if (filters.ids && !filters.ids.includes(h.id)) return false;
    return true;
  });
  const query = parseQuery(text);
  if (query.terms.length === 0 && query.excludes.length === 0) {
    return pool.map((hack) => ({ hack, score: 0, hitFields: [], usedSynonym: false }));
  }
  const out = [];
  for (const hack of pool) {
    const result = scoreHack(hack, query);
    if (result.score > 0) out.push({ hack, ...result });
  }
  out.sort((a, b) => b.score - a.score || a.hack.title.localeCompare(b.hack.title, 'ja'));
  return out;
}

/**
 * 0件だった時に返すもの（行き止まりにしない）。
 *   - dropOne: その語を外すと何件見つかるか（多い順）
 *   - alone:   その語だけで探すと何件か
 * 何も返せない時は空配列。**「たぶんこれ」を勝手に検索し直さない**（決めるのは人）。
 */
export function explainNoHits(hacks = [], text = '', filters = {}) {
  const query = parseQuery(text);
  if (query.terms.length === 0) return { dropOne: [], alone: [] };
  const alone = query.terms.map((term) => ({
    term,
    count: searchHacks(hacks, term, filters).length,
  }));
  const dropOne =
    query.terms.length < 2
      ? []
      : query.terms
          .map((term) => {
            const rest = query.terms.filter((t) => t !== term);
            const excl = query.excludes.map((e) => `-${e}`);
            return { term, count: searchHacks(hacks, [...rest, ...excl].join(' '), filters).length };
          })
          .filter((x) => x.count > 0)
          .sort((a, b) => b.count - a.count);
  return { dropOne, alone: alone.sort((a, b) => b.count - a.count) };
}

/**
 * 入力中の候補。題名・タグ・言い換えから、前方一致→部分一致の順に集める。
 * **件数が0のものは出さない**（押しても0件になる候補を見せない）。
 */
export function suggestTerms(hacks = [], input = '', limit = 8) {
  const needle = normalize(input).trim();
  if (!needle) return [];
  const counts = new Map();
  const bump = (word) => {
    if (!word) return;
    const key = String(word);
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (const hack of hacks) {
    for (const tag of hack.tags || []) bump(tag);
    for (const situation of hack.situations || []) bump(situation);
  }
  for (const [canonical, others] of SYNONYM_INDEX) {
    if (others.size > 0) bump(canonical);
  }
  const scored = [];
  for (const [word, count] of counts) {
    const n = normalize(word);
    if (n === needle) continue;
    const at = n.indexOf(needle);
    if (at < 0) continue;
    scored.push({ word, count, head: at === 0 ? 0 : 1 });
  }
  scored.sort((a, b) => a.head - b.head || b.count - a.count || a.word.localeCompare(b.word, 'ja'));
  return scored.slice(0, limit).map((s) => s.word);
}

/**
 * 色付け（ハイライト）用に文章を切り分ける。
 * 正規化が長さを変えないので、正規化した文字列で見つけた位置をそのまま元の文章に当てられる。
 * @returns {Array<{text:string, hit:boolean}>}
 */
export function highlightParts(text, termsInput) {
  const source = String(text ?? '');
  const terms = (Array.isArray(termsInput) ? termsInput : parseQuery(termsInput).terms)
    .flatMap((t) => expandTerm(t))
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length);
  if (terms.length === 0 || !source) return [{ text: source, hit: false }];
  const lower = normalize(source);
  const marks = new Array(source.length).fill(false);
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(term, from);
      if (at < 0) break;
      for (let i = at; i < at + term.length; i += 1) marks[i] = true;
      from = at + term.length;
    }
  }
  const parts = [];
  let buffer = '';
  let current = marks[0];
  for (let i = 0; i < source.length; i += 1) {
    if (marks[i] !== current) {
      parts.push({ text: buffer, hit: current });
      buffer = '';
      current = marks[i];
    }
    buffer += source[i];
  }
  if (buffer) parts.push({ text: buffer, hit: current });
  return parts;
}
