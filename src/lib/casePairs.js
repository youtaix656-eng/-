// 症例ベースの連問（原問＋「上記症例の続き」で参照する続きの設問）を検出・整列する。
//
// 新しいデータフィールドは持たない。標準変換プロンプトの追加順（原問1 → その派生
// （id末尾が英字＝A核心/B定義/C鑑別/D確認の一問一答）→ 続きの原問2 → その派生…）
// という既存の収録順から、単一の正として導出する。
//   - 続きの設問は必ず「（上記◯◯の続き）」で始まる（既存データで確認済みのパターン）。
//   - 派生（一問一答）のidは必ず末尾が英字（例：tk-koujoutai-kinou-1a）。
//     続きの原問は派生を挟んで少し手前にあるため、遡る時は派生を読み飛ばす
//     （直前の1件だけを見ると、無関係な別問題の派生に当たってしまうバグがあった）。

const CONTINUATION_PATTERN = /^（上記.{0,20}続き）/;
const isDerivativeId = (id) => /[a-z]$/i.test(String(id));
// 遡る上限（この距離を超えて見つからなければ諦める。無関係な遠い問題に誤って
// 結びつけないための安全弁）。
const MAX_LOOKBACK = 12;

export function isCaseContinuation(q) {
  return !!(q && q.question && CONTINUATION_PATTERN.test(q.question));
}

// pool: 元の収録順を保ったままの問題配列（シャッフル前）。
// 戻り値: { linkOf: Map<続きのid, 親のid>, pairOf: Map<親のid, 続きのid> }
export function buildCaseLinkMap(pool) {
  const linkOf = new Map();
  const pairOf = new Map();
  if (!Array.isArray(pool)) return { linkOf, pairOf };
  for (let i = 0; i < pool.length; i++) {
    const cur = pool[i];
    if (!isCaseContinuation(cur)) continue;
    const limit = Math.max(0, i - MAX_LOOKBACK);
    for (let j = i - 1; j >= limit; j--) {
      const cand = pool[j];
      if (!cand || cand.subject !== cur.subject) break; // 科目境界を越えない
      if (isDerivativeId(cand.id)) continue; // 派生（一問一答）は読み飛ばす
      linkOf.set(cur.id, cand.id);
      pairOf.set(cand.id, cur.id);
      break;
    }
  }
  return { linkOf, pairOf };
}

// 与えたidの「相方」（続きなら親、親なら続き）を返す。無ければnull。
export function partnerOf(id, linkOf, pairOf) {
  if (linkOf.has(id)) return linkOf.get(id);
  if (pairOf.has(id)) return pairOf.get(id);
  return null;
}

// idが属する症例チェーンを、根本（最初の原問）から順に並べた配列で返す
// （3問以上つながる症例チェーンにも対応。続きの続き、を辿れるだけ辿る）。
function chainOf(id, linkOf, pairOf) {
  let root = id;
  while (linkOf.has(root)) root = linkOf.get(root);
  const chain = [root];
  let cur = root;
  while (pairOf.has(cur)) {
    cur = pairOf.get(cur);
    chain.push(cur);
  }
  return chain;
}

// 出題順（id配列。シャッフル後・周回で同じidが複数回含まれ得る）に対し、
// 症例の連問を隣接させる後処理。相方が同じ配列に無ければ何もしない。
// チェーンのどのidを先に見つけても、必ず根本からの正しい順（原問→続き→続きの続き…）で
// まとめて並べる（末尾側のidを先に見つけた場合に順序が崩れるバグが実際にあったため）。
export function keepCasePairsAdjacent(order, linkOf, pairOf) {
  if (!order || order.length === 0 || (linkOf.size === 0 && pairOf.size === 0)) return order;
  const queue = [...order];
  const out = [];
  const pullFirst = (id) => {
    const idx = queue.indexOf(id);
    if (idx === -1) return false;
    queue.splice(idx, 1);
    return true;
  };
  while (queue.length) {
    const id = queue.shift();
    if (linkOf.has(id) || pairOf.has(id)) {
      const chain = chainOf(id, linkOf, pairOf);
      for (const member of chain) {
        if (member === id) { out.push(member); continue; }
        if (pullFirst(member)) out.push(member);
      }
    } else {
      out.push(id);
    }
  }
  return out;
}

// 問題オブジェクトの配列（Review.jsxのspaceByOrigin等、idではなくオブジェクトで
// 出題順を持つ画面向け）に対する同じ処理。
export function keepCasePairsAdjacentObjects(qs, linkOf, pairOf) {
  if (!qs || qs.length === 0 || (linkOf.size === 0 && pairOf.size === 0)) return qs;
  const byId = new Map(qs.map((q) => [q.id, q]));
  const orderedIds = keepCasePairsAdjacent(qs.map((q) => q.id), linkOf, pairOf);
  return orderedIds.map((id) => byId.get(id)).filter(Boolean);
}
