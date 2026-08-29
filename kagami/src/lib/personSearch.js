// 人間分析のさがしもの。
//
// 守ること:
//   1. **読み（ひらがな）でも引ける。** 型に reading を持たせてあるのに検索に使って
//      いなかった（「きげん」で「機嫌で場を動かす」が出なかった）。
//   2. **表記の揺れを吸収する。** カタカナ・全角・大小の違いで落とさない
//      （detect.js と同じ考え方だが、あちらは判定用なのでここは別に持つ）。
//   3. **当たった所を見せる。** どこが引っかかったか分からない検索は、
//      合っているのか外れているのか判断できない（判定と同じ線）。
//   4. **後読み（lookbehind）を使わない**（古い Safari で読み込みごと落ちる）。
//   5. ネットワークにも保存にも触れない。

const KATA_START = 0x30a1;
const KATA_END = 0x30f6;

/** 検索用にそろえる（全角→半角・カタカナ→ひらがな・大文字→小文字・空白を落とす） */
export function fold(input) {
  const src = String(input == null ? '' : input);
  let out = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const code = ch.charCodeAt(0);
    if (/\s/.test(ch)) continue;
    let c = ch;
    if (code >= 0xff01 && code <= 0xff5e) c = String.fromCharCode(code - 0xfee0);
    else if (code >= KATA_START && code <= KATA_END) c = String.fromCharCode(code - 0x60);
    out += c.toLowerCase();
  }
  return out;
}

/** 検索語を語ごとに分ける（スペース区切り＝すべて含むもの） */
export function terms(query) {
  return String(query || '')
    .split(/[\s　]+/)
    .map((t) => fold(t))
    .filter(Boolean);
}

/**
 * ふるまい1件ぶんの、引っかかる文字列をまとめる。
 * 本文だけでなく、型の名前・読み・芯・場面でも引けるようにする。
 */
export function haystackOf(behavior, { type, coreLabels = [], sceneLabels = [] } = {}) {
  return [
    behavior.text,
    type?.name,
    type?.reading,
    ...coreLabels,
    ...sceneLabels,
  ]
    .filter(Boolean)
    .join(' ');
}

/** すべての語を含むか（AND） */
export function matchesAll(haystack, list) {
  if (list.length === 0) return true;
  const h = fold(haystack);
  return list.every((t) => h.includes(t));
}

/**
 * 本文の中で語に当たった範囲（元の文字の位置で返す）。
 * そろえた文字列と元の文字の対応を持ちながら探す。
 */
export function hitRanges(text, list) {
  const src = String(text || '');
  let folded = '';
  const map = [];
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const code = ch.charCodeAt(0);
    if (/\s/.test(ch)) continue;
    let c = ch;
    if (code >= 0xff01 && code <= 0xff5e) c = String.fromCharCode(code - 0xfee0);
    else if (code >= KATA_START && code <= KATA_END) c = String.fromCharCode(code - 0x60);
    folded += c.toLowerCase();
    map.push(i);
  }
  const out = [];
  for (const t of list) {
    if (!t) continue;
    let from = 0;
    for (let guard = 0; guard < 20; guard += 1) {
      const at = folded.indexOf(t, from);
      if (at < 0) break;
      out.push({ start: map[at], end: map[at + t.length - 1] + 1 });
      from = at + t.length;
    }
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/** 当たった所と、そうでない所に切り分ける（画面がそのまま並べられる形） */
export function splitByHit(text, list) {
  const src = String(text || '');
  const ranges = hitRanges(src, list);
  const out = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: src.slice(at, r.start), hit: false });
    out.push({ text: src.slice(r.start, r.end), hit: true });
    at = r.end;
  }
  if (at < src.length) out.push({ text: src.slice(at), hit: false });
  return out.filter((p) => p.text.length > 0);
}

/**
 * 0件だった時の近い候補。
 * **勝手に検索し直さない**——「この語ではどうですか」と出すだけ。
 * @returns {string[]} 多くて3つ
 */
export function suggestTerms(query, corpus = []) {
  const list = terms(query);
  if (list.length === 0) return [];
  const shortest = [...list].sort((a, b) => a.length - b.length)[0];
  if (shortest.length < 2) return [];
  const out = [];
  const seen = new Set();
  // 語を1文字ずつ短くして、当たった項目の「押せる語」を返す
  for (let len = shortest.length; len >= 2 && out.length < 3; len -= 1) {
    const part = shortest.slice(0, len);
    for (const item of corpus) {
      const label = typeof item === 'string' ? item : item.label;
      const hay = fold(typeof item === 'string' ? item : [item.label, item.hay].join(' '));
      if (!hay.includes(part)) continue;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= 3) break;
    }
  }
  return out;
}

/** よく使う入口（固定。手元にない基準ではなく、ただの入口） */
export const QUICK_TERMS = ['機嫌', '約束', '謝', 'お金', '噂', '断', '子ども', '決め'];

/** 検索の履歴（新しい順・重複なし・上限つき） */
export const HISTORY_MAX = 8;

export function pushHistory(history = [], query) {
  const q = String(query || '').trim();
  if (!q) return history;
  return [q, ...history.filter((h) => h !== q)].slice(0, HISTORY_MAX);
}
