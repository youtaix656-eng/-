// 貼られた文面から、型カタログ（data/tactics.js）の言い回しに当たるものを探す。
//
// 守ること:
//   1. **ネットワークに触れない。AIを呼ばない。** 貼った文面は端末から出ない。
//      判定は語の一致だけ。だからこそ、当たった語を必ずそのまま見せる
//      （どこが当たったか見せないと、当てずっぽうを断定しているのと同じになる）。
//   2. **点数・危険度・順位を付けない。** 出せるのは「どの型の言い回しに、どの語で
//      当たったか」だけ。何件当たったかは並び順に使うが、点数として画面には出さない。
//   3. **後読み（lookbehind）を使わない。** 古い Safari が構文エラーになり、
//      読み込みごと落ちる（他アプリで実際に踏んだ）。ここは indexOf だけで足りる。
//   4. **当たらなかった時も黙らない。** status を必ず返し、画面が
//      「短すぎて調べられなかった」「当たらなかった」を言い分ける。

/** これより短い文面では判定しない（短いほど、たまたま当たるだけになる） */
export const MIN_TEXT = 8;

/** 1つの語について拾う最大の箇所（同じ語が何十回も出る文面で表示が壊れないように） */
const MAX_HITS_PER_CUE = 3;

const KATA_START = 0x30a1; // ァ
const KATA_END = 0x30f6; // ヶ

/**
 * 判定用にそろえた文字列と、元の文字への対応表を作る。
 *   - 全角英数 → 半角、大文字 → 小文字
 *   - カタカナ → ひらがな
 *   - 空白・改行 → 取り除く
 * 1文字は「0文字か1文字」になるので、対応表は元の添字をそのまま並べるだけでよい。
 * @returns {{text: string, map: number[]}}
 */
export function normalize(input) {
  const src = String(input == null ? '' : input);
  let out = '';
  const map = [];
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const code = ch.charCodeAt(0);
    if (/\s/.test(ch)) continue; // 空白は落とす（「今日 中」も「今日中」に当たる）
    let c = ch;
    if (code >= 0xff01 && code <= 0xff5e) c = String.fromCharCode(code - 0xfee0); // 全角英数記号
    else if (code >= KATA_START && code <= KATA_END) c = String.fromCharCode(code - 0x60); // カタカナ
    c = c.toLowerCase();
    out += c;
    map.push(i);
  }
  return { text: out, map };
}

/** 語も本文と同じそろえ方をする（カタログ側は自然な表記のまま書けるように） */
export function normalizeCue(cue) {
  return normalize(cue).text;
}

/**
 * そろえた本文の中から語をすべて探し、**元の文面での範囲**で返す。
 * @returns {Array<{start:number, end:number}>}
 */
export function findCue(norm, cue) {
  const needle = normalizeCue(cue);
  const out = [];
  if (!needle) return out;
  let from = 0;
  while (out.length < MAX_HITS_PER_CUE) {
    const at = norm.text.indexOf(needle, from);
    if (at < 0) break;
    const start = norm.map[at];
    const last = norm.map[at + needle.length - 1];
    // 元の文面では空白をまたぐことがあるので、終わりは「最後の文字の次」
    out.push({ start, end: last + 1 });
    from = at + needle.length;
  }
  return out;
}

/**
 * 文面を型カタログに当てる。
 * @param {string} text 貼られた文面
 * @param {Array} tactics 型カタログ（data/tactics.js の TACTICS）
 * @returns {{status:'short'|'none'|'ok', length:number, matches:Array}}
 *   matches は [{ tactic, cues:[string], hits:[{cue,start,end}] }]。
 *   当たった語の数の多い順、同じなら**カタログの並び順**（点数ではない）。
 */
export function detectTactics(text, tactics = []) {
  const raw = String(text == null ? '' : text);
  const norm = normalize(raw);
  if (norm.text.length < MIN_TEXT) {
    return { status: 'short', length: norm.text.length, matches: [] };
  }

  const matches = [];
  tactics.forEach((tactic, order) => {
    const hits = [];
    const cues = [];
    for (const cue of tactic.cues || []) {
      const found = findCue(norm, cue);
      if (found.length === 0) continue;
      cues.push(cue);
      for (const f of found) hits.push({ cue, start: f.start, end: f.end });
    }
    if (hits.length === 0) return;
    hits.sort((a, b) => a.start - b.start);
    matches.push({ tactic, cues, hits, order });
  });

  matches.sort((a, b) => b.cues.length - a.cues.length || a.order - b.order);
  return {
    status: matches.length ? 'ok' : 'none',
    length: norm.text.length,
    matches: matches.map(({ order, ...m }) => m),
  };
}

/**
 * 当たった箇所を重ならない範囲にまとめる（本文のハイライト用）。
 * @param {Array} matches detectTactics の matches
 * @returns {Array<{start:number, end:number}>} 開始位置の順
 */
export function highlightRanges(matches = []) {
  const all = [];
  for (const m of matches) for (const h of m.hits) all.push({ start: h.start, end: h.end });
  all.sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const r of all) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/**
 * 本文を「ふつうの部分」と「当たった部分」に切り分ける（画面がそのまま並べられる形）。
 * @returns {Array<{text:string, hit:boolean}>}
 */
export function splitByHighlight(text, matches = []) {
  const raw = String(text == null ? '' : text);
  const ranges = highlightRanges(matches);
  const out = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push({ text: raw.slice(at, r.start), hit: false });
    out.push({ text: raw.slice(r.start, r.end), hit: true });
    at = r.end;
  }
  if (at < raw.length) out.push({ text: raw.slice(at), hit: false });
  return out.filter((p) => p.text.length > 0);
}
