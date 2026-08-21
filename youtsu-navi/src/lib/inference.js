// 原因パターンの推定 — 企画書 第4部①
//
// タグと data/patterns.js の evidence / against を突き合わせ、
// スコア → 相対％（目安）に変換して上位候補を返す。
//
// ⚠ ここで出す％は「診断確率」ではない。入力内容がどのパターンの典型像に
//    どれだけ近いかを相対化した目安であり、UIでも必ずその旨を明示する。

export const MIN_SCORE = 1.5; // これ未満の候補は表示しない
export const MIN_SHARE = 5; // ％。これ未満の候補は表示しない
export const MAX_CANDIDATES = 4;

/** ルール（tags は any-of）が該当するか */
function ruleHits(rule, tagSet) {
  return (rule.tags || []).some((t) => tagSet.has(t));
}

/** 1パターンの素点を計算する */
export function scorePattern(pattern, tagSet) {
  if (pattern.requireTags && pattern.requireTags.length) {
    if (!pattern.requireTags.some((t) => tagSet.has(t))) {
      return { pattern, score: 0, excluded: true, matched: [], counter: [] };
    }
  }
  const matched = [];
  const counter = [];
  let score = pattern.prior || 0;
  for (const rule of pattern.evidence || []) {
    if (ruleHits(rule, tagSet)) {
      score += rule.weight;
      matched.push({ label: rule.label, weight: rule.weight });
    }
  }
  for (const rule of pattern.against || []) {
    if (ruleHits(rule, tagSet)) {
      score -= rule.weight;
      counter.push({ label: rule.label, weight: rule.weight });
    }
  }
  return { pattern, score: Math.max(0, Number(score.toFixed(2))), excluded: false, matched, counter };
}

/** 合計100になるよう％へ丸める（最大剰余法） */
function toPercents(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map((v) => Math.floor(v));
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (const { i } of order) {
    if (rest <= 0) break;
    out[i] += 1;
    rest -= 1;
  }
  return out;
}

/**
 * @param {string[]} tags
 * @param {object[]} patterns data/patterns.js の定義
 * @returns {{ candidates, others, confidence, confidenceNote }}
 */
export function inferPatterns(tags = [], patterns = []) {
  const tagSet = new Set(tags);
  const scored = patterns
    .map((p) => scorePattern(p, tagSet))
    // 根拠（evidence）が1つも当たっていない候補は出さない。
    // prior（基礎点）だけで上位に来ると「理由を説明できない提案」になるため。
    .filter((s) => !s.excluded && s.matched.length > 0 && s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, MAX_CANDIDATES);
  const percents = toPercents(top.map((s) => s.score));
  const candidates = top
    .map((s, i) => ({ ...s, percent: percents[i] }))
    .filter((c) => c.percent >= MIN_SHARE);

  // 表示から漏れた候補（「他に考えられるもの」として名前だけ出す）
  const shown = new Set(candidates.map((c) => c.pattern.id));
  const others = scored.filter((s) => !shown.has(s.pattern.id)).map((s) => s.pattern);

  const { confidence, confidenceNote } = assessConfidence(candidates, tags);
  return { candidates, others, confidence, confidenceNote };
}

/** 候補の割れ具合・入力量から「どれくらい絞れているか」を判定する */
export function assessConfidence(candidates, tags = []) {
  if (candidates.length === 0) {
    return { confidence: 'none', confidenceNote: '入力からは典型的なパターンに絞り込めませんでした。所見を追加で確認してください。' };
  }
  const [first, second] = candidates;
  const gap = first.percent - (second ? second.percent : 0);
  if (tags.length < 6) {
    return { confidence: 'low', confidenceNote: '入力項目が少ないため参考程度です。動作との関連・神経症状を追加で確認してください。' };
  }
  if (candidates.length >= 3 && gap < 10) {
    return { confidence: 'low', confidenceNote: '候補が拮抗しています。徒手検査で絞り込んでから方針を決めてください。' };
  }
  if (gap >= 20) {
    return { confidence: 'high', confidenceNote: '入力内容は特定のパターンの典型像に近い状態です。ただし確定判断ではありません。' };
  }
  return { confidence: 'mid', confidenceNote: '複数のパターンが混在している可能性があります。経過での再評価をおすすめします。' };
}

export const CONFIDENCE_LABEL = {
  high: '絞り込めている',
  mid: '中程度',
  low: '情報が不足',
  none: '判定不能',
};
