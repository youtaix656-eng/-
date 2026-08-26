// Ouro Knowledge — 会社の最重要資産。
//
// 原則：**出典のない知識を作らせない。**
// AI が生成した内容と外部から取った内容は origin で必ず区別する
// （後から「これは誰が言ったのか」を辿れなくなるのを防ぐため）。

import { newId } from './id.js';

export const CATEGORIES = [
  '調査',
  '分析',
  '制作物',
  '検証',
  '戦略',
  '学習',
  '案件',
  'メモ',
  'その他',
];

export const SOURCE_TYPES = {
  web: 'Webページ',
  youtube: 'YouTube',
  pdf: 'PDF',
  note: 'メモ',
  audio: '音声',
  ai: 'AI生成',
  user: 'ユーザーの指示',
  // 社内会議で出た結論。外から取ったものでも、AIが1人で書いたものでもない。
  meeting: '社内会議',
};

export const ORIGINS = {
  external: '外部ソース',
  ai: 'AI生成',
  // AIエンジンを1つも接続していない時に、ローカル社員（規則ベース・AIではない）が
  // 組み立てた「仕事の型」。**これを 'ai' にしない。**
  // 来歴を必ず区別するのがこのアプリの土台なので、AIが動いていないものを
  // AI生成として残すと、その土台に穴があく。
  template: '仕事の型（AI未使用）',
  user: '自分で書いた',
  // 複数の社員が意見と反論を出し合ったうえでの結論。
  // AI1人の生成と同じ扱いにすると、どう作られたものか分からなくなる。
  meeting: '社内会議の結論',
};

export function makeSource({ type = 'note', title = '', url = '', excerpt = '', addedBy = 'user', trust = 50 }) {
  return {
    id: newId('src'),
    type,
    title: title || url || SOURCE_TYPES[type] || '出典',
    url,
    excerpt: String(excerpt).slice(0, 4000),
    addedAt: Date.now(),
    addedBy,
    trust,
  };
}

/**
 * 知識を作る。sourceIds が空のままにはできない。
 * @returns {{knowledge, extraSources}} extraSources は自動で作った出典
 */
export function createKnowledge(data = {}) {
  const now = Date.now();
  const extraSources = [];
  let sourceIds = [...(data.sourceIds || [])];

  if (!sourceIds.length) {
    // 出典なしの知識は作らせない。自動で立てる擬似ソースは来歴ごとに変える。
    // template（AI未接続）を「AI生成」と名乗らせないこと。
    const auto = makeSource({
      type: data.origin === 'user' ? 'note' : data.origin === 'template' ? 'note' : 'ai',
      title:
        data.origin === 'user'
          ? '自分で書いたメモ'
          : data.origin === 'template'
            ? '仕事の型（AIエンジン未接続のため、AIは動いていません）'
            : `AI生成（未検証）${data.providerName ? ` / ${data.providerName}` : ''}`,
      excerpt: data.summary || '',
      addedBy: data.employeeId || 'user',
      trust: data.origin === 'user' ? 60 : 30,
    });
    extraSources.push(auto);
    sourceIds = [auto.id];
  }

  const knowledge = {
    id: newId('kn'),
    title: String(data.title || '無題の知識').slice(0, 120),
    summary: String(data.summary || '').slice(0, 600),
    body: String(data.body || ''),
    category: CATEGORIES.includes(data.category) ? data.category : 'その他',
    tags: normalizeTags(data.tags),
    origin: ORIGINS[data.origin] ? data.origin : 'ai',
    sourceIds,
    relatedIds: data.relatedIds || [],
    trust: clamp(data.trust ?? (data.origin === 'external' ? 50 : 30), 0, 100),
    verifiedAt: data.verifiedAt || null,
    verifiedBy: data.verifiedBy || null,
    createdAt: now,
    updatedAt: now,
    usedCount: 0,
    lastUsedAt: null,
    taskId: data.taskId || null,
    employeeId: data.employeeId || null,
    departmentId: data.departmentId || null,
  };

  return { knowledge, extraSources };
}

export function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(/[,、\s]+/);
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const t = String(raw).trim().replace(/^#/, '');
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, Number(n) || 0));
}

/** 検索。タイトル・要約・本文・タグ・カテゴリを見る。 */
export function searchKnowledge(list = [], query = '', opts = {}) {
  const { category = null, tag = null, origin = null, verifiedOnly = false } = opts;
  const q = String(query).trim().toLowerCase();

  return list
    .filter((k) => {
      if (category && k.category !== category) return false;
      if (tag && !(k.tags || []).includes(tag)) return false;
      if (origin && k.origin !== origin) return false;
      if (verifiedOnly && !k.verifiedAt) return false;
      if (!q) return true;
      const hay = `${k.title} ${k.summary} ${k.body} ${(k.tags || []).join(' ')} ${k.category}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * その知識を消したときに、どの出典が行き場を失うかを返す（新規）。
 *
 * 出典は1回の仕事で最大13件できる。知識を消しても残していたため、
 * どの画面にも出ないまま増え続けていた。
 * **他の知識がまだ参照しているものは残す**（共有している出典を巻き添えにしない）。
 */
export function orphanSourceIds(removed, remaining = []) {
  const mine = (removed && removed.sourceIds) || [];
  if (!mine.length) return [];
  const stillUsed = new Set();
  for (const k of remaining) for (const id of k.sourceIds || []) stillUsed.add(id);
  return mine.filter((id) => !stillUsed.has(id));
}

/** 使われた記録（知識の循環を数えるため）。 */
export function markUsed(knowledge) {
  return { ...knowledge, usedCount: (knowledge.usedCount || 0) + 1, lastUsedAt: Date.now() };
}

/** レビュアーが検証した結果を反映する。 */
export function markVerified(knowledge, { by, trust }) {
  return {
    ...knowledge,
    verifiedAt: Date.now(),
    verifiedBy: by || null,
    trust: clamp(trust ?? Math.max(knowledge.trust || 0, 70), 0, 100),
    updatedAt: Date.now(),
  };
}

/** タグの出現数（知識ベースの偏りを見る）。 */
export function tagCounts(list = []) {
  const map = new Map();
  for (const k of list) {
    for (const t of k.tags || []) map.set(t, (map.get(t) || 0) + 1);
  }
  return [...map.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/** 検証済みの割合（ダッシュボード用）。 */
export function verifiedRate(list = []) {
  if (!list.length) return 0;
  return Math.round((list.filter((k) => k.verifiedAt).length / list.length) * 100);
}
