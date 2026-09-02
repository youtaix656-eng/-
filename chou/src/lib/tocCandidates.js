// 候補の受け入れ・見送り・取り消し。**純粋な関数**（React にも保存にも依存しない）。
//
// 決めていること
//  1. **「追加する」を押すまで本体のデータに一切書かない**（候補は候補のまま）。
//  2. 押した時に初めて **読み・重複・分類・表記の4つ**を確かめてから入れる。
//     どれかで落ちたら入れずに理由を返す（黙って入れない・黙って直さない）。
//  3. **「しない」を選んだものは本体に何も残さない**（履歴には「見送り」として残す）。
//  4. 直近の追加は `undoLastTocAdditions(state, n)` で取り消せる。**取り消すのは対象だけ。**
//  5. `descriptionStatus` を `verified` にできるのは、**人が明示的に確かめた時だけ**
//     （`setVerified` に `byUser: true` を渡した時だけ通る）。

import { buildTocEntries, TOC_GROUPS, DESTINATION_TYPES } from '../data/toc.js';
import { CANDIDATE_ACTIONS, CANDIDATE_STATUSES } from '../data/tocCandidates.js';
import { kanaRow, normalizeAlnum, OTHER_ROW } from './yomi.js';

export const HISTORY_MAX = 200;

const GROUP_IDS = TOC_GROUPS.map((g) => g.id);

export function emptyTocState() {
  return { tocCandidates: [], userTerms: [], removedIds: [], tocHistory: [] };
}

/** 表記をそろえる（前後の空白・全角英数・別名の重なり）。**中身は書き換えない** */
export function normalizeCandidate(candidate) {
  if (!candidate) return null;
  const title = String(candidate.title || '').trim();
  const seen = new Set();
  const aliases = [];
  for (const alias of candidate.aliases || []) {
    const name = String((alias && alias.name) || '').trim();
    if (!name || name === title || seen.has(name)) continue;
    seen.add(name);
    aliases.push({ name, reading: String((alias && alias.reading) || '').trim() });
  }
  return {
    ...candidate,
    title,
    reading: String(candidate.reading || '').trim(),
    aliases,
    destinations: (candidate.destinations || []).filter((d) => d && DESTINATION_TYPES.includes(d.type) && d.view),
    descriptionStatus: 'needs_review',
  };
}

/**
 * 入れる前の4つの確かめ。**「追加する」を押した時にだけ走らせる。**
 * @returns {{ ok: boolean, checks: object, reasons: string[] }}
 */
export function checkCandidate(candidate, entries) {
  const c = normalizeCandidate(candidate);
  const list = Array.isArray(entries) ? entries : buildTocEntries();
  const reasons = [];

  // ① 読み：無い・かなでも英字でもない → 入れない（推定して埋めない）
  const reading = kanaRow(c.reading) !== OTHER_ROW.id;
  if (!reading) reasons.push('読み（ひらがな）が要ります。目次の行を決められません。');

  // ② 重複：同じタイトルが既にある／既存の別名とぶつかる
  const titles = new Set(list.map((e) => e.title));
  const aliasNames = new Set(list.flatMap((e) => (e.aliases || []).map((a) => a.name)));
  const duplicate = !titles.has(c.title) && !aliasNames.has(c.title);
  if (!duplicate) reasons.push('同じ名前が目次にすでにあります。');

  // ③ 分類：知らないまとまりには入れない
  const classification = GROUP_IDS.includes(c.group || 'term');
  if (!classification) reasons.push('どのまとまりに入るか決まっていません。');

  // ④ 表記：前後の空白・全角英数がそろっているか
  const normalization =
    c.title === String(candidate.title || '').trim() &&
    c.title.length > 0 &&
    normalizeAlnum(c.title) === normalizeAlnum(c.title.trim());
  if (!normalization) reasons.push('表記がそろっていません。');

  const checks = { reading, duplicate, classification, normalization };
  return { ok: Object.values(checks).every(Boolean), checks, reasons, candidate: c };
}

function pushHistory(history, row) {
  const next = [...(history || []), row];
  return next.length > HISTORY_MAX ? next.slice(next.length - HISTORY_MAX) : next;
}

function findCandidate(state, id) {
  return (state.tocCandidates || []).find((c) => c.id === id) || null;
}

function setStatus(state, id, status) {
  return (state.tocCandidates || []).map((c) => (c.id === id ? { ...c, status } : c));
}

/**
 * 「追加する」「削除する」を押した時の反映。
 * @returns {{ ok: boolean, state: object, reasons: string[], checks?: object }}
 */
export function acceptCandidate(state, id, options = {}) {
  const now = options.now || Date.now();
  const candidate = findCandidate(state, id);
  if (!candidate || candidate.status !== 'pending') {
    return { ok: false, state, reasons: ['その候補はもうありません。'] };
  }
  if (!CANDIDATE_ACTIONS.includes(candidate.action)) {
    return { ok: false, state, reasons: ['候補の形が壊れています。'] };
  }

  if (candidate.action === 'delete') {
    const entries = buildTocEntries(state);
    const target = entries.find((e) => e.id === candidate.targetId || e.title === candidate.title);
    if (!target) return { ok: false, state, reasons: ['消す相手が目次に見つかりません。'] };
    // 自分で追加したものは userTerms から抜き、元データのものは removedIds で伏せる
    const userTerms = (state.userTerms || []).filter((t) => t.id !== target.id);
    const removedIds =
      userTerms.length === (state.userTerms || []).length
        ? [...new Set([...(state.removedIds || []), target.id])]
        : state.removedIds || [];
    return {
      ok: true,
      state: {
        ...state,
        userTerms,
        removedIds,
        tocCandidates: setStatus(state, id, 'accepted'),
        tocHistory: pushHistory(state.tocHistory, {
          id: `h-${id}`,
          at: now,
          action: 'delete',
          status: 'accepted',
          entryId: target.id,
          title: target.title,
          trigger: (candidate.addedFrom || {}).trigger || '',
        }),
      },
      reasons: [],
    };
  }

  const result = checkCandidate(candidate, buildTocEntries(state));
  if (!result.ok) {
    return { ok: false, state, reasons: result.reasons, checks: result.checks };
  }
  const entry = {
    id: `user-${candidate.id}`,
    title: result.candidate.title,
    reading: result.candidate.reading,
    aliases: result.candidate.aliases,
    description: result.candidate.description,
    descriptionStatus: 'needs_review', // 会話由来は必ず「※要確認」
    destinations: result.candidate.destinations,
    addedFrom: candidate.addedFrom,
  };
  return {
    ok: true,
    checks: result.checks,
    reasons: [],
    state: {
      ...state,
      userTerms: [...(state.userTerms || []), entry],
      tocCandidates: setStatus(state, id, 'accepted'),
      tocHistory: pushHistory(state.tocHistory, {
        id: `h-${id}`,
        at: now,
        action: 'add',
        status: 'accepted',
        entryId: entry.id,
        title: entry.title,
        trigger: (candidate.addedFrom || {}).trigger || '',
      }),
    },
  };
}

/** 「しない」を選んだ時。**本体には何も残さない**（履歴にだけ「見送り」として残る） */
export function rejectCandidate(state, id, options = {}) {
  const now = options.now || Date.now();
  const candidate = findCandidate(state, id);
  if (!candidate || candidate.status !== 'pending') return { ok: false, state, reasons: ['その候補はもうありません。'] };
  return {
    ok: true,
    reasons: [],
    state: {
      ...state,
      tocCandidates: setStatus(state, id, 'rejected'),
      tocHistory: pushHistory(state.tocHistory, {
        id: `h-${id}`,
        at: now,
        action: candidate.action,
        status: 'rejected',
        entryId: null,
        title: candidate.title,
        trigger: (candidate.addedFrom || {}).trigger || '',
      }),
    },
  };
}

/**
 * 直近の追加を取り消す。**取り消すのは対象の項目だけ**で、
 * 同じ時に入った他のものや、元データの項目には触らない。
 */
export function undoLastTocAdditions(state, n = 1) {
  const count = Math.max(0, Math.trunc(n));
  if (!count) return { ok: false, state, undone: [] };
  const history = state.tocHistory || [];
  const targets = [];
  for (let i = history.length - 1; i >= 0 && targets.length < count; i -= 1) {
    const row = history[i];
    if (row.action === 'add' && row.status === 'accepted' && !row.undone) targets.push(row);
  }
  if (!targets.length) return { ok: false, state, undone: [] };
  const ids = new Set(targets.map((r) => r.entryId));
  return {
    ok: true,
    undone: targets.map((r) => r.title),
    state: {
      ...state,
      userTerms: (state.userTerms || []).filter((t) => !ids.has(t.id)),
      tocHistory: history.map((row) => (ids.has(row.entryId) && row.status === 'accepted' && row.action === 'add' ? { ...row, undone: true } : row)),
    },
  };
}

/**
 * 説明を「確かめた」にする。**人が明示的に押した時だけ通す**（ルール：会話由来は必ず要確認）。
 * `byUser` が真でなければ何も変えない。
 */
export function setVerified(state, entryId, options = {}) {
  if (options.byUser !== true) return { ok: false, state, reasons: ['確かめたのが人であることが要ります。'] };
  const userTerms = (state.userTerms || []).map((t) =>
    t.id === entryId ? { ...t, descriptionStatus: 'verified', verifiedAt: options.now || Date.now() } : t,
  );
  return { ok: true, state: { ...state, userTerms }, reasons: [] };
}

/** 取り込んだ候補をそろえる（壊れた形で画面が落ちないように） */
export function normalizeCandidates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (!c || typeof c !== 'object' || !c.id || !c.title) return null;
      const action = CANDIDATE_ACTIONS.includes(c.action) ? c.action : 'add';
      const status = CANDIDATE_STATUSES.includes(c.status) ? c.status : 'pending';
      return { ...normalizeCandidate(c), action, status };
    })
    .filter(Boolean);
}
