// 連結学習法を強化するための純粋ロジック群。
//   - キーワード自動提案（用語辞書ベース・全科目対応＋ユーザー辞書）
//   - 一括自動タグ付けのプラン作成
//   - 表記ゆれ（同義語）の検出 → 統合のためのデータ
//   - 孤立ノード検出
//   - キーワード別正答率（ヒートマップ用）
//   - 連結クイズ（共通キーワード当て／仲間はずれ）＋復習連動用の問題ID
//
// 実際の表示はコンポーネント側。ここはデータのみ。

import { effectiveTags } from './query.js';
import { meridians, yuanPoints, luoPoints, xiPoints, fourCommandPoints, wuxingElements, zangTable } from '../data/knowledgeBase.js';
import { keywordAccuracy, clustersMap } from './audioplan.js';

// 経穴・経絡系（KB由来）
function kbTerms() {
  const t = new Set();
  const add = (x) => { if (x && String(x).trim()) t.add(String(x).trim()); };
  meridians.forEach((m) => { add(m.name); add(m.short); add(m.organ); });
  [yuanPoints, luoPoints, xiPoints].forEach((obj) => Object.values(obj).forEach(add));
  fourCommandPoints.forEach((f) => add(f.point));
  wuxingElements.forEach(add);
  zangTable.forEach((z) => { add(z.zang); add(z.kan); add(z.tai); });
  ['原穴','絡穴','郄穴','四総穴','五兪穴','要穴','募穴','背部兪穴','八会穴','八脈交会穴','五行','五臓','六腑','相生','相剋','経絡','経穴','奇経','正経十二経'].forEach(add);
  return t;
}

// 全13科目をゆるくカバーする頻出用語（自動提案の守備範囲を広げる）
const EXTRA_TERMS = [
  // 解剖学
  '大腿骨','上腕骨','脊柱','椎骨','肋骨','横隔膜','僧帽筋','三角筋','大腿四頭筋','アキレス腱',
  '迷走神経','正中神経','橈骨神経','尺骨神経','坐骨神経','腕神経叢','三叉神経','顔面神経',
  '大動脈','冠状動脈','門脈','心臓','肝臓','腎臓','膵臓','脾臓','小脳','延髄','大脳','脊髄',
  // 生理学
  'ホルモン','インスリン','グルカゴン','アドレナリン','甲状腺','副腎','交感神経','副交感神経','自律神経',
  'ネフロン','糸球体','ヘモグロビン','赤血球','白血球','血小板','活動電位','反射','恒常性','体温調節',
  // 病理学
  '炎症','腫瘍','良性腫瘍','悪性腫瘍','壊死','浮腫','虚血','梗塞','血栓','アレルギー','免疫','感染','変性',
  // 衛生・公衆衛生
  '疫学','予防','感染症','生活習慣病','健康増進','母子保健','食中毒','消毒','滅菌','予防接種',
  // 関係法規
  '免許','守秘義務','施術所','あん摩マッサージ指圧師','はり師','きゅう師','医師法','業務独占',
  // 東洋医学
  '陰陽','気血水','虚実','寒熱','表裏','六淫','七情','証','弁証','望診','聞診','問診','切診','脈診','舌診',
  // 東洋臨床・現代臨床
  '腰痛','肩こり','頭痛','神経痛','関節リウマチ','坐骨神経痛','自律神経失調症','変形性関節症','五十肩',
];

export function buildTermDict(extra = []) {
  const t = kbTerms();
  EXTRA_TERMS.forEach((x) => t.add(x));
  (extra || []).forEach((x) => { if (x && String(x).trim()) t.add(String(x).trim()); });
  return t;
}

let _dict = null;
function baseDict() {
  if (!_dict) _dict = buildTermDict();
  return _dict;
}

// テキストから、辞書に載っている用語を拾って候補に（既存キーワードは除く）
export function suggestKeywords(text, existing = [], termDict) {
  const dict = termDict || baseDict();
  const hay = String(text || '');
  const ex = new Set(existing);
  const found = [];
  for (const term of dict) {
    if (ex.has(term)) continue;
    if (hay.includes(term)) found.push(term);
  }
  // 具体的な語（長い語）を先に。似た語は「表記ゆれ統合」で後からまとめられる。
  found.sort((a, b) => b.length - a.length);
  return found.slice(0, 12);
}

// 一括自動タグ付けのプラン。onlyUntagged=true でキーワード無しだけ対象。
export function bulkAutoTagPlan(questions, links, opts = {}) {
  const perQuestion = opts.perQuestion || 2;
  const onlyUntagged = opts.onlyUntagged !== false; // 既定はキーワード無しのみ
  const dict = opts.termDict || baseDict();
  const plan = [];
  for (const q of questions) {
    const existing = effectiveTags(q, links);
    if (onlyUntagged && existing.length > 0) continue;
    const text = `${q.question || ''} ${(q.choices || []).join(' ')} ${q.explanation || ''}`;
    const add = suggestKeywords(text, existing, dict).slice(0, perQuestion);
    if (add.length) plan.push({ id: q.id, add });
  }
  return plan;
}

// 同義語グループ（経絡の正式名 ↔ 略称）
export function synonymGroups() {
  return meridians.map((m) => ({ canonical: m.short, variants: [m.name, m.short] }));
}

// 既存キーワードの中から「まとめられそうな表記ゆれ」を検出
export function detectVariantPairs(keywords) {
  const set = new Set(keywords);
  const out = [];
  for (const g of synonymGroups()) {
    const present = g.variants.filter((v) => set.has(v));
    if (present.length >= 2) out.push({ canonical: g.canonical, variants: present });
  }
  return out;
}

// 孤立ノード検出：キーワード無しの問題／1問だけの語
export function isolatedReport(questions, links) {
  const untagged = questions.filter((q) => effectiveTags(q, links).length === 0);
  const clusters = clustersMap(questions, links);
  const singletons = [];
  for (const [keyword, qs] of clusters) {
    if (qs.length === 1) singletons.push({ keyword, question: qs[0] });
  }
  return { untagged, singletons, untaggedCount: untagged.length, singletonCount: singletons.length };
}

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

// 連結クイズ（共通キーワード当て／仲間はずれ）。復習連動のため問題IDを含める。
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
  if (clusters.length < 2) return [];

  const items = [];
  for (const c of shuffle(clusters)) {
    if (items.length >= max) break;
    const qs = shuffle(c.qs).slice(0, Math.min(3, c.qs.length));
    const others = clusters.filter((x) => x.keyword !== c.keyword);
    if (others.length < 3) continue;
    const distractors = shuffle(others).slice(0, 3).map((o) => o.keyword);
    const options = shuffle([c.keyword, ...distractors]);
    items.push({
      type: 'common',
      prompt: 'これらの問題に共通するキーワードはどれ？',
      keyword: c.keyword,
      questions: qs.map(stem),
      qids: qs.map((q) => q.id),
      options,
      answer: options.indexOf(c.keyword),
    });
  }
  for (const c of shuffle(clusters)) {
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
      qids: inGroup.map((q) => q.id), // 復習連動は「仲間（同キーワード）」側
      answer: cards.indexOf(outQ),
    });
  }
  return shuffle(items).slice(0, max);
}
