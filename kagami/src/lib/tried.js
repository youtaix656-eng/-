// 「やってみた」記録 — どの対応策を試して、どうだったか。
//
// 守ること:
//   1. **判定しない。** 残すのは ◯（やりやすかった）／△（どちらとも）／✕（合わなかった）だけで、
//      効き目の点数も、相手がどう変わったかも記録しない。
//      分かるのは「自分がそれをやれたかどうか」までで、そこから先は分からない。
//   2. **手元にない基準を持たない。** 並べ替えは**自分の記録の中の相対**だけ。
//      「この手は◯％効く」のような数字を作らない。
//   3. **少ない記録で順番を変えない**（1回の◯で「効く手」にしない）。
//   4. ネットワークに触れない。

export const RESULTS = [
  { id: 'ok', label: 'やりやすかった', mark: '○' },
  { id: 'mid', label: 'どちらとも', mark: '△' },
  { id: 'ng', label: '合わなかった', mark: '✕' },
];

export const RESULT_MAP = Object.fromEntries(RESULTS.map((r) => [r.id, r]));

/** これだけ試して初めて、並べ替えに使う */
export const MIN_TRIES = 2;

let seq = 0;

/**
 * @param {{tacticId:string, typeId?:string, caseId?:string, result?:string, note?:string, at?:number}} input
 */
export function makeTry(input = {}) {
  const at = Number(input.at) || Date.now();
  seq += 1;
  return {
    id: input.id || `t${at}-${seq}`,
    tacticId: String(input.tacticId || ''),
    typeId: String(input.typeId || ''),
    caseId: String(input.caseId || ''),
    result: RESULT_MAP[input.result] ? input.result : 'mid',
    note: String(input.note || '').slice(0, 200),
    at,
  };
}

/** その対応策の記録（新しい順） */
export function triesOf(tries = [], tacticId, caseId) {
  return tries
    .filter((t) => t.tacticId === tacticId && (caseId === undefined || t.caseId === caseId))
    .sort((a, b) => b.at - a.at);
}

/**
 * 対応策ごとの、自分の記録のまとめ。
 * **点数を返さない**——返すのは回数と、やりやすかった回数だけ。
 */
export function summarize(tries = []) {
  const map = new Map();
  for (const t of tries) {
    const cur = map.get(t.tacticId) || { tacticId: t.tacticId, total: 0, ok: 0, ng: 0, last: 0 };
    cur.total += 1;
    if (t.result === 'ok') cur.ok += 1;
    if (t.result === 'ng') cur.ng += 1;
    cur.last = Math.max(cur.last, t.at);
    map.set(t.tacticId, cur);
  }
  return map;
}

/**
 * 対応策を並べ替える。
 * ①この場面に合う手 ②自分がやりやすかった手（記録が MIN_TRIES 以上ある時だけ）
 * ③それ以外、の順。**同じ条件なら元の並びを崩さない。**
 */
export function orderCounters(counters = [], { tries = [], scene = '', bestScenes = {} } = {}) {
  const sum = summarize(tries);
  const rank = (c) => {
    const s = sum.get(c.tacticId);
    const fitsScene = scene && (bestScenes[c.tacticId] || []).includes(scene) ? 1 : 0;
    const easy = s && s.total >= MIN_TRIES && s.ok > s.ng ? 1 : 0;
    const hard = s && s.total >= MIN_TRIES && s.ng > s.ok ? 1 : 0;
    return -(fitsScene * 2 + easy) + hard; // 小さいほど前
  };
  return counters
    .map((c, i) => ({ c, i, r: rank(c) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}

/**
 * このタイプにおすすめの3つ（番号を付けて出すもの）。
 *
 * **順番は「後戻りのしにくさ」が先**（`steps`＝まず／それでも続くなら／それも効かないなら）。
 * 自分の記録や場面の合い方は**同じ段の中だけ**で効かせる——記録が2回付いただけの手が
 * ①に来ると、いきなり後戻りしにくい手から始めることになる。
 * `steps` を渡さなければ、これまでどおり `orderCounters` の順のまま。
 *
 * @param {Array} counters 型が持つ対応策
 * @param {{tries?:Array, scene?:string, bestScenes?:object, steps?:object, limit?:number}} opts
 */
export function recommendThree(counters = [], opts = {}) {
  const { steps = null, limit = 3 } = opts;
  const ordered = orderCounters(counters, opts);
  if (!steps) return ordered.slice(0, limit);
  return ordered
    .map((c, i) => ({ c, i, s: steps[c.tacticId] || 99 }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.c)
    .slice(0, limit);
}

/** まだ一度も試していない手 */
export function untried(counters = [], tries = []) {
  const done = new Set(tries.map((t) => t.tacticId));
  return counters.filter((c) => !done.has(c.tacticId));
}

/**
 * 「まず1つ」——当たった型すべての対応策のうち、いちばん多くの型に出てくるもの。
 * 重なりが無ければ、先頭の型の1つめを返す。**点数ではなく重なりの数で選ぶ。**
 */
export function firstMove(matches = []) {
  const count = new Map();
  for (const m of matches) {
    for (const c of m.type.counters || []) {
      const cur = count.get(c.tacticId) || { counter: c, types: 0 };
      cur.types += 1;
      count.set(c.tacticId, cur);
    }
  }
  let best = null;
  for (const v of count.values()) {
    if (!best || v.types > best.types) best = v;
  }
  return best ? { ...best.counter, sharedBy: best.types } : null;
}
