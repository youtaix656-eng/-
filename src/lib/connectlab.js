// 連結学習法を強化するための純粋ロジック群。
//   - キーワード自動提案（用語辞書ベース）
//   - 関連問題の自動抽出（共有キーワード＋共通用語）
//   - 孤立ノード検出（キーワード無し問題／1問だけの語）
//   - 習熟度（キーワード別正答率）ヒートマップ用データ
//   - 連結マップのグラフ（ノード・エッジ）
//   - 連結クイズ（共通キーワード当て／仲間はずれ）
//
// 実際の表示はコンポーネント側。ここはデータのみ。

import { effectiveTags } from './query.js';
import {
  meridians,
  yuanPoints,
  luoPoints,
  xiPoints,
  fourCommandPoints,
  wuxingElements,
  zangTable,
} from '../data/knowledgeBase.js';
import { keywordAccuracy, clustersMap } from './audioplan.js';

// ---- 用語辞書（キーワード候補になり得る標準用語） ----
export function buildTermDict() {
  const terms = new Set();
  const add = (t) => {
    if (t && String(t).trim()) terms.add(String(t).trim());
  };
  meridians.forEach((m) => {
    add(m.name);
    add(m.short);
    add(m.organ);
  });
  [yuanPoints, luoPoints, xiPoints].forEach((obj) => Object.values(obj).forEach(add));
  fourCommandPoints.forEach((f) => add(f.point));
  wuxingElements.forEach(add);
  zangTable.forEach((z) => {
    add(z.zang);
    add(z.kan);
    add(z.tai);
  });
  [
    '原穴', '絡穴', '郄穴', '四総穴', '五兪穴', '要穴', '募穴', '背部兪穴',
    '八会穴', '八脈交会穴', '五行', '五臓', '六腑', '相生', '相剋',
    '経絡', '経穴', '奇経', '正経十二経',
  ].forEach(add);
  return terms;
}

let _dict = null;
function dict() {
  if (!_dict) _dict = buildTermDict();
  return _dict;
}

// テキストから、辞書に載っている用語を拾って候補に（既存キーワードは除く）
export function suggestKeywords(text, existing = [], termDict = dict()) {
  const hay = String(text || '');
  const ex = new Set(existing);
  const found = [];
  for (const term of termDict) {
    if (ex.has(term)) continue;
    if (hay.includes(term)) found.push(term);
  }
  // 長い語（具体的）を優先し、重複や部分包含を軽く整理
  found.sort((a, b) => b.length - a.length);
  const out = [];
  for (const t of found) {
    if (out.some((o) => o.includes(t))) continue; // すでに上位語に含まれるなら省く
    out.push(t);
  }
  return out.slice(0, 12);
}

// 問題の「用語プロフィール」＝ 実効タグ ∪ 本文中の辞書用語
function termsOf(q, links, termDict = dict()) {
  const set = new Set(effectiveTags(q, links));
  const hay = `${q.question || ''} ${(q.choices || []).join(' ')} ${q.explanation || ''}`;
  for (const term of termDict) if (hay.includes(term)) set.add(term);
  return set;
}

// 関連問題を自動抽出（共有キーワードを重く、共通用語を軽く加点）
export function relatedQuestions(target, questions, links, opts = {}) {
  const limit = opts.limit || 6;
  const already = new Set((links[target.id]?.related) || []);
  const tTags = new Set(effectiveTags(target, links));
  const tTerms = termsOf(target, links);
  const res = [];
  for (const q of questions) {
    if (q.id === target.id) continue;
    const tags = new Set(effectiveTags(q, links));
    const terms = termsOf(q, links);
    let sharedTags = 0;
    for (const t of tags) if (tTags.has(t)) sharedTags += 1;
    let sharedTerms = 0;
    for (const t of terms) if (tTerms.has(t)) sharedTerms += 1;
    const sameSubject = q.subject && q.subject === target.subject ? 1 : 0;
    const score = sharedTags * 5 + sharedTerms * 2 + sameSubject;
    if (score <= 0) continue;
    const reasonTerms = [...tTags].filter((t) => tags.has(t)).slice(0, 3);
    res.push({
      q,
      score,
      alreadyLinked: already.has(q.id),
      reason: reasonTerms.length ? reasonTerms.join('・') : '同じ科目',
    });
  }
  res.sort((a, b) => b.score - a.score);
  return res.slice(0, limit);
}

// 孤立ノード検出：キーワード無しの問題／1問だけの語
export function isolatedReport(questions, links) {
  const untagged = questions.filter((q) => effectiveTags(q, links).length === 0);
  const clusters = clustersMap(questions, links);
  const singletons = [];
  for (const [keyword, qs] of clusters) {
    if (qs.length === 1) singletons.push({ keyword, question: qs[0] });
  }
  return {
    untagged,
    singletons,
    untaggedCount: untagged.length,
    singletonCount: singletons.length,
  };
}

// キーワード別の正答率（ヒートマップ用）。audioplan を再利用。
export function keywordHeat(questions, links, history) {
  return keywordAccuracy(questions, links, history);
}

// 正答率 → 色（赤=苦手 / 黄 / 緑=得意 / グレー=未回答）
export function heatColor(accuracy) {
  if (accuracy == null) return '#5b6b7c';
  if (accuracy < 0.5) return '#e26a5e';
  if (accuracy < 0.8) return '#e6b64f';
  return '#3aa878';
}

// 連結マップのグラフ（キーワードをノード、共起をエッジに）
export function graphData(questions, links, history) {
  const heat = keywordHeat(questions, links, history);
  const nodes = heat.map((h) => ({
    id: h.keyword,
    count: h.questions.length,
    accuracy: h.accuracy,
  }));
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  // 共起エッジ
  const edgeMap = new Map();
  for (const q of questions) {
    const tags = [...new Set(effectiveTags(q, links))].filter((t) => idx.has(t));
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i], tags[j]].sort().join('');
        edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      }
    }
  }
  const edges = [...edgeMap.entries()].map(([k, w]) => {
    const [a, b] = k.split('');
    return { source: a, target: b, weight: w };
  });
  return { nodes, edges };
}

// 円周レイアウト（決定的）。半径 R の円周上にノードを等間隔配置。
export function circleLayout(nodes, R = 46, cx = 50, cy = 50) {
  const n = nodes.length || 1;
  return nodes.map((node, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { ...node, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
}

// 連結クイズを作る（共通キーワード当て / 仲間はずれ）
export function buildConnectQuiz(questions, links, opts = {}) {
  const rng = opts.rng || Math.random;
  const max = opts.max || 8;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const stem = (q) => {
    const t = (q.question || '（図の問題）').replace(/\s+/g, ' ').trim();
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  };

  const clusters = [...clustersMap(questions, links).entries()]
    .map(([keyword, qs]) => ({ keyword, qs }))
    .filter((c) => c.qs.length >= 2);
  const items = [];
  if (clusters.length < 2) return items; // クイズを作るには最低2クラスタ必要

  const bigEnough = clusters.filter((c) => c.qs.length >= 2);

  // 1) 共通キーワード当て
  for (const c of shuffle(bigEnough)) {
    if (items.length >= max) break;
    const qs = shuffle(c.qs).slice(0, Math.min(3, c.qs.length));
    const others = clusters.filter((x) => x.keyword !== c.keyword);
    if (others.length < 3) continue;
    const distractors = shuffle(others).slice(0, 3).map((o) => o.keyword);
    const options = shuffle([c.keyword, ...distractors]);
    items.push({
      type: 'common',
      prompt: 'これらの問題に共通するキーワードはどれ？',
      questions: qs.map(stem),
      options,
      answer: options.indexOf(c.keyword),
    });
  }

  // 2) 仲間はずれ（3問は同じ語、1問だけ別）
  for (const c of shuffle(bigEnough)) {
    if (items.length >= max) break;
    if (c.qs.length < 3) continue;
    const others = clusters.filter((x) => x.keyword !== c.keyword);
    if (others.length === 0) continue;
    const inGroup = shuffle(c.qs).slice(0, 3);
    const outQ = pick(pick(others).qs);
    if (!outQ) continue;
    const cards = shuffle([...inGroup, outQ]);
    items.push({
      type: 'odd',
      prompt: `「${c.keyword}」の仲間はずれはどれ？`,
      keyword: c.keyword,
      options: cards.map(stem),
      answer: cards.indexOf(outQ),
    });
  }

  return shuffle(items).slice(0, max);
}
