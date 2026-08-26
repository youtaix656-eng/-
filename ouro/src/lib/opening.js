// 「書き出しが毎回そっくり」を見つける（新規）。
//
// AIに投稿や記事を作らせ続けると、冒頭の型が固定してくる
//（「みなさん、〜で悩んでいませんか？」ばかりになる、など）。
// 中身は違うのに入口が同じだと、読み手には同じものに見える。
//
// 判定は**機械だけ**でやる（AIを呼ばない＝費用ゼロ）。
// 文字の並びの重なりを見るだけなので、言い回しが違えば当たらない。

const STRIP = /[\s　。、,.!！?？「」『』（）()・:：;；\-–—…"'`*#>\n]/g;

/** 比べるための頭出し（記号と空白を落とす）。 */
export function openingOf(text, len = 40) {
  // **見出しを先に落としてから**記号を剥がす。順番が逆だと、
  // 「# 見出し」の # が消えたあとでは見出しだと分からなくなる。
  // 見出しを混ぜると、5項目の枠（###①結論…）だけで全部そっくりに見えてしまう。
  const body = String(text || '')
    .split('\n')
    .filter((l) => !/^\s*[#＃]/.test(l))
    .map((l) => l.replace(/^[\s>#*_・\-–—]*[①-⑳0-9０-９]*[.．)）]?\s*/, '').trim())
    .filter(Boolean)
    .join('');
  return body.replace(STRIP, '').slice(0, len);
}

/** 2つの頭出しがどれくらい重なっているか（0〜1）。 */
export function similarity(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (!x || !y) return 0;
  const grams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const gx = grams(x);
  const gy = grams(y);
  if (!gx.size || !gy.size) return 0;
  let hit = 0;
  for (const g of gx) if (gy.has(g)) hit += 1;
  return hit / Math.min(gx.size, gy.size);
}

export const SIMILAR_AT = 0.6;

/**
 * 過去の成果物の中に、書き出しがそっくりなものがあるか。
 * @param {string} text いま出来た成果物
 * @param {{id:string, title:string, text:string}[]} past 過去のもの（新しい順）
 * @returns {{id, title, score}[]} 似ているもの（多くても3件）
 */
export function similarOpenings(text, past = [], limit = 3) {
  const head = openingOf(text);
  if (head.length < 12) return []; // 短すぎるものは比べない
  const out = [];
  for (const p of past) {
    const score = similarity(head, openingOf(p.text));
    if (score >= SIMILAR_AT) out.push({ id: p.id, title: p.title, score });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => b.score - a.score);
}
