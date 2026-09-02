// 目次への追加・削除の「候補」。
//
// 会話の中で出てきた言葉を目次へ入れたくなるが、**勝手に入れない。**
// 候補はここ（`ouro:tocCandidates`）にだけ溜まり、**「追加する」を押した時に初めて**
// 本体データ（`data/terms.js` ＋ `ouro:terms` の上書き）へ反映する。
//
// 決まりごと：
//  ・**候補が生まれるのは3つの合図のときだけ**（`CANDIDATE_TRIGGERS`）。
//    それ以外は `makeCandidate` が null を返す——勝手に増える目次にしない。
//  ・**会話から来たものの説明は必ず `needs_review`。**
//    `verified` にしてよいのは、人が画面で明示的に確かめた時だけ。
//  ・**「しない」を選んだ候補は本体データに一切残さない。**
//  ・**追加を押した時に4つの確かめを通す**（読み・重複・分類・正規化）。
//    通らなければ**書き込まず**、理由を返す（黙って入れない・黙って捨てない）。
//  ・確定した結果は履歴に残す（追加/削除/見送りのどれも）。
//  ・直近の追加は `undoLastTocAdditions(n)` で取り消せる（**その追加ぶんだけ**）。

import { readingInfo, normalizeAlnum, foldKana } from './yomi.js';
import { TERMS, DESTINATION_TYPES } from '../data/terms.js';

/** 候補を作ってよい合図。**この3つ以外では絶対に発火させない。** */
export const CANDIDATE_TRIGGERS = {
  // ①「■用語追加：〜」の形の、はっきりした合図
  marker: '「■用語追加：」の合図',
  // ②教材・成果物を作った時に付く tags
  tags: '成果物の tags',
  // ③ユーザーが「これを目次に追加して」と明示した時
  user: 'あなたの指示',
};

export const CANDIDATE_ACTIONS = { add: '追加', delete: '削除' };
export const CANDIDATE_STATUS = { pending: '未確認', accepted: '反映済み', rejected: '見送り' };

export const MAX_CANDIDATES = 60;
export const MAX_HISTORY = 200;

/** 「その他」行がこの件数を超えたら、開発時に読みの入れ忘れを警告する。 */
export const OTHER_ROW_WARN_AT = 3;

const str = (v, n) => String(v || '').trim().slice(0, n);

/**
 * 候補を1件作る。**合図が3つのどれでもなければ null**（作らない）。
 * @param {object} input { title, reading, description, aliases, destinations, action, trigger, conversationId }
 */
export function makeCandidate(input = {}) {
  const trigger = input.trigger;
  if (!CANDIDATE_TRIGGERS[trigger]) return null; // ← ここが白名簿
  const title = str(input.title, 60);
  if (!title) return null;
  const action = CANDIDATE_ACTIONS[input.action] ? input.action : 'add';
  const now = Date.now();
  return {
    id: input.id || `cand_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    action,
    status: 'pending',
    // 対象。追加なら新しい用語、削除なら既存の用語の id
    termId: str(input.termId, 60) || null,
    title,
    reading: foldKana(input.reading || ''),
    description: str(input.description, 600),
    // **会話から来たものは必ず要確認**。ここを渡された値で上書きしない。
    descriptionStatus: 'needs_review',
    aliases: (Array.isArray(input.aliases) ? input.aliases : [])
      .map((a) => str(a, 40)).filter(Boolean).slice(0, 8),
    destinations: (Array.isArray(input.destinations) ? input.destinations : [])
      .filter((d) => d && DESTINATION_TYPES[d.type])
      .map((d) => ({ type: d.type, label: str(d.label, 60), view: d.view || null, anchor: d.anchor || null }))
      .slice(0, 6),
    addedFrom: {
      conversationId: str(input.conversationId, 80) || null,
      date: now,
      trigger,
    },
  };
}

export function normalizeCandidates(list) {
  return (Array.isArray(list) ? list : [])
    .filter((c) => c && c.id && c.title && CANDIDATE_ACTIONS[c.action])
    .map((c) => ({
      ...c,
      status: CANDIDATE_STATUS[c.status] ? c.status : 'pending',
      descriptionStatus: 'needs_review',
      aliases: Array.isArray(c.aliases) ? c.aliases : [],
      destinations: Array.isArray(c.destinations) ? c.destinations : [],
    }))
    .slice(0, MAX_CANDIDATES);
}

export function pendingCandidates(list) {
  return normalizeCandidates(list).filter((c) => c.status === 'pending');
}

// ── 追加を押した時に通す4つの確かめ ─────────────────────────────

/**
 * ①読み ②重複 ③分類 ④正規化。
 * @returns {{ok:boolean, checks:{id,name,ok,detail}[]}}
 */
export function checkCandidate(cand, { terms = TERMS } = {}) {
  const checks = [];
  const title = str(cand && cand.title, 60);

  // ① 読み——**推定しない**ので、無ければ「その他」行に落ちることを警告する
  const info = readingInfo(title, (cand && cand.reading) || '');
  checks.push({
    id: 'reading',
    name: '読みがあるか',
    ok: info.source !== 'missing',
    detail: info.source === 'missing'
      ? '読みがありません。漢字の読みは推定しないので、このままだと「その他」行に落ちます。'
      : `読み「${info.reading}」／${info.bucket}行`,
  });

  // ② 重複——題名でも別名でもぶつからないこと
  const norm = (v) => normalizeAlnum(String(v || '')).toLowerCase();
  const hit = terms.find(
    (t) => norm(t.title) === norm(title) || (t.aliases || []).some((a) => norm(a) === norm(title))
  );
  checks.push({
    id: 'duplicate',
    name: '題名が重複しないか',
    ok: !hit,
    detail: hit ? `「${hit.title}」と同じ言葉です。` : '重複はありません。',
  });

  // ③ 分類——飛び先の種類が決まった4つのどれかであること
  const bad = (cand.destinations || []).filter((d) => !DESTINATION_TYPES[d.type]);
  checks.push({
    id: 'kind',
    name: '飛び先の種類が正しいか',
    ok: bad.length === 0,
    detail: bad.length
      ? `知らない種類があります：${bad.map((d) => d.type).join('・')}`
      : `飛び先 ${(cand.destinations || []).length} 件`,
  });

  // ④ 正規化——題名がそろえたあとも空にならないこと（記号だけの題名を入れない）
  const alnum = normalizeAlnum(title);
  checks.push({
    id: 'normalize',
    name: '題名が字としてそろうか',
    ok: alnum.length > 0,
    detail: alnum ? `そろえると「${alnum}」` : '記号だけの題名は入れられません。',
  });

  return { ok: checks.every((c) => c.ok), checks };
}

/** 候補を用語の形に直す（**承認したあとだけ**呼ぶ）。 */
export function candidateToTerm(cand) {
  const info = readingInfo(cand.title, cand.reading || '');
  return {
    id: cand.termId || `term_${String(cand.id).slice(-8)}`,
    title: cand.title,
    // 読みは推定しない。無ければ空のまま（「その他」行に出て入れ忘れが見える）
    reading: info.source === 'explicit' || info.source === 'kana' ? info.reading : (cand.reading || ''),
    description: cand.description || '',
    // **会話から入ったものは要確認のまま。** 人が画面で確かめた時だけ verified にする。
    descriptionStatus: 'needs_review',
    aliases: cand.aliases || [],
    destinations: cand.destinations || [],
    addedFrom: cand.addedFrom || null,
  };
}

// ── 反映（追加・削除・見送り）───────────────────────────────

const emptyTerms = () => ({ added: [], removed: [] });

export function normalizeCustomTerms(v) {
  if (!v || typeof v !== 'object') return emptyTerms();
  return {
    added: Array.isArray(v.added) ? v.added.filter((t) => t && t.id && t.title) : [],
    removed: Array.isArray(v.removed) ? v.removed.filter(Boolean) : [],
  };
}

function historyEntry(cand, result, detail) {
  return {
    id: `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    candidateId: cand.id,
    action: cand.action,
    title: cand.title,
    termId: cand.termId || null,
    result, // 'added' | 'removed' | 'rejected' | 'blocked'
    detail: detail || '',
    at: Date.now(),
    trigger: (cand.addedFrom && cand.addedFrom.trigger) || null,
  };
}

/**
 * 「追加する」。**ここで初めて**4つの確かめを通し、通ったら本体データへ書く。
 * @returns {{ok, terms, candidates, history, checks, reason}}
 */
export function acceptAdd(cand, { customTerms, candidates = [], history = [], terms = TERMS } = {}) {
  const cur = normalizeCustomTerms(customTerms);
  const merged = [...terms.filter((t) => !cur.removed.includes(t.id)), ...cur.added];
  const { ok, checks } = checkCandidate(cand, { terms: merged });
  if (!ok) {
    const reason = checks.filter((c) => !c.ok).map((c) => c.detail).join(' ');
    return {
      ok: false,
      terms: cur, // **通らなければ1文字も書かない**
      candidates: normalizeCandidates(candidates),
      history: [historyEntry(cand, 'blocked', reason), ...history].slice(0, MAX_HISTORY),
      checks,
      reason,
    };
  }
  const term = candidateToTerm(cand);
  return {
    ok: true,
    terms: { ...cur, added: [...cur.added, term], removed: cur.removed.filter((id) => id !== term.id) },
    candidates: normalizeCandidates(candidates).map((c) => (c.id === cand.id ? { ...c, status: 'accepted', termId: term.id } : c)),
    history: [historyEntry({ ...cand, termId: term.id }, 'added'), ...history].slice(0, MAX_HISTORY),
    checks,
    reason: '',
  };
}

/** 「削除する」。**対象の1件だけ**を本体データから外す。 */
export function acceptDelete(cand, { customTerms, candidates = [], history = [] } = {}) {
  const cur = normalizeCustomTerms(customTerms);
  const id = cand.termId;
  if (!id) {
    return { ok: false, terms: cur, candidates: normalizeCandidates(candidates), history, reason: '対象が決まっていません' };
  }
  return {
    ok: true,
    terms: {
      added: cur.added.filter((t) => t.id !== id),
      removed: cur.removed.includes(id) ? cur.removed : [...cur.removed, id],
    },
    candidates: normalizeCandidates(candidates).map((c) => (c.id === cand.id ? { ...c, status: 'accepted' } : c)),
    history: [historyEntry(cand, 'removed'), ...history].slice(0, MAX_HISTORY),
    reason: '',
  };
}

/** 「しない」。**本体データには一切触らない。** */
export function rejectCandidate(cand, { customTerms, candidates = [], history = [] } = {}) {
  return {
    ok: true,
    terms: normalizeCustomTerms(customTerms), // そのまま
    candidates: normalizeCandidates(candidates).map((c) => (c.id === cand.id ? { ...c, status: 'rejected' } : c)),
    history: [historyEntry(cand, 'rejected'), ...history].slice(0, MAX_HISTORY),
  };
}

/**
 * 直近の追加を n 件だけ取り消す。
 * **取り消すのは「追加」だけ**——削除まで巻き戻すと、消したはずのものが黙って戻る。
 * @returns {{terms, history, undone:string[]}}
 */
export function undoLastTocAdditions(n = 1, { customTerms, history = [] } = {}) {
  const cur = normalizeCustomTerms(customTerms);
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (!count) return { terms: cur, history, undone: [] };
  const adds = history.filter((h) => h.result === 'added').slice(0, count);
  const ids = new Set(adds.map((h) => h.termId).filter(Boolean));
  if (!ids.size) return { terms: cur, history, undone: [] };
  return {
    terms: { ...cur, added: cur.added.filter((t) => !ids.has(t.id)) },
    history: [
      ...adds.map((h) => ({ ...h, id: `${h.id}:undo`, result: 'undone', at: Date.now() })),
      ...history,
    ].slice(0, MAX_HISTORY),
    undone: [...ids],
  };
}

/**
 * 人が画面で確かめた時だけ、用語の説明を「確認済み」にする。
 *
 * **`markVerified` という名前にしないこと**——`lib/knowledge.js` に既に
 * `markVerified`（知識の裏取り）があり、層が違う（`paid.priceLine` と
 * `rivals.pricePositionLine` を分けたのと同じ理由）。
 */
export function markTermVerified(termId, { customTerms } = {}) {
  const cur = normalizeCustomTerms(customTerms);
  return {
    ...cur,
    added: cur.added.map((t) => (t.id === termId ? { ...t, descriptionStatus: 'verified' } : t)),
  };
}
