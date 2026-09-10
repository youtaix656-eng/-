// 用語集（目次・索引）の候補フロー——会話内容から追加・削除の候補を作り、
// 人が承認するまで本体データには一切書き込まない。
//
// 候補の生成は次の3つの合図（トリガー）以外では絶対に発火させない：
//   a) 「■用語追加：〜」という明示的な合図（Claudeが会話中にこの関数を手動で呼ぶ）
//   b) 教材生成時に付与されるtagsフィールド（suggestCandidatesFromTagsを明示的に呼んだ時だけ）
//   c) ユーザーが「これを目次に追加して」と明示的に指示した場合（Toc.jsxのクイック追加UI）
// **このファイル自体は何かを監視して自動発火する仕組みを持たない**——
// どの関数も「呼ばれたら候補オブジェクトを作る／状態を進める」だけの受け身の実装。
//
// 状態はこのモジュールの外（呼び出し側）で保持・永続化する（storage.jsのload/save経由）。
// ここは純粋な状態遷移関数の集まりにして、React・IndexedDBの両方から独立させる
// （lib/はReactに依存させない、という既存の方針と同じ）。

import { GLOSSARY_CATEGORIES } from '../data/glossaryTerms.js';
import { normalizeAlnum } from './yomi.js';

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normAddedFrom(addedFrom) {
  return {
    conversationId: addedFrom?.conversationId || null,
    date: addedFrom?.date || new Date().toISOString(),
    trigger: addedFrom?.trigger || 'unknown',
  };
}

// ---- 候補の生成（トリガーa・c、およびbのループ内から呼ばれる） ----

// term: glossaryTerms.jsと同じ形の項目。会話由来の追加候補は必ずneeds_reviewにする（#18）。
export function proposeAddCandidate(term, addedFrom, candidates = []) {
  const candidate = {
    id: makeId('tc'),
    action: 'add',
    status: 'pending',
    term: { ...term, descriptionStatus: 'needs_review' },
    addedFrom: normAddedFrom(addedFrom),
  };
  return [...candidates, candidate];
}

export function proposeDeleteCandidate(targetId, addedFrom, candidates = []) {
  const candidate = {
    id: makeId('tc'),
    action: 'delete',
    status: 'pending',
    targetId,
    addedFrom: normAddedFrom(addedFrom),
  };
  return [...candidates, candidate];
}

// トリガーb：教材生成時に付与されたtagsフィールドから、まだ用語集に無いものを
// 追加候補として作る。**呼び出すこと自体が候補生成の合図**——自動実行の仕組み
// （useStore.jsの起動時エフェクト等）からは呼ばない。npm scriptか、Toc.jsxの
// 明示的な操作からだけ呼ぶこと。
export function suggestCandidatesFromTags(newQuestions, fullGlossary, addedFrom, candidates = []) {
  const known = new Set();
  for (const g of fullGlossary) {
    known.add(g.title);
    for (const a of g.aliases || []) known.add(a.title);
  }
  const pending = new Set(
    candidates.filter((c) => c.status === 'pending' && c.action === 'add').map((c) => c.term.title)
  );
  const seen = new Set();
  let next = candidates;
  for (const q of newQuestions || []) {
    for (const tag of q.tags || []) {
      if (!tag || known.has(tag) || pending.has(tag) || seen.has(tag)) continue;
      seen.add(tag);
      const term = {
        id: makeId('gt'),
        title: tag,
        reading: '',
        category: null,
        description: '',
        descriptionStatus: 'needs_review',
        aliases: [],
        destinations: [],
      };
      next = proposeAddCandidate(term, { ...addedFrom, trigger: 'tags' }, next);
    }
  }
  return next;
}

// ---- 承認前の4チェック（reading・重複・分類・正規化） ----
export function runTocChecks(term, glossary = []) {
  const errors = [];
  const title = String(term?.title || '').trim();
  if (!term?.reading || !String(term.reading).trim()) {
    errors.push('読み（reading）が入力されていません');
  }
  const dup = glossary.some((g) => g.title === title || (g.aliases || []).some((a) => a.title === title));
  if (dup) errors.push(`「${title}」は既に用語集にあります（重複）`);
  const validCategory = GLOSSARY_CATEGORIES.some((c) => c.id === term?.category);
  if (!validCategory) errors.push(`分類「${term?.category}」は未定義です`);
  const normalizedNew = normalizeAlnum(title).toLowerCase();
  const normDup = glossary.some(
    (g) => g.title !== title && normalizeAlnum(g.title).toLowerCase() === normalizedNew
  );
  if (normDup) errors.push('正規化すると既存の項目と表記ゆれで重複します');
  return { ok: errors.length === 0, errors };
}

// ---- 承認・却下・取り消し ----

// 「追加する」/「削除する」が選ばれた時点で初めて本体（glossaryExtra／glossaryRemovedIds）へ反映する。
// state: { candidates, glossaryExtra, removedIds, history, fullGlossary }
//   fullGlossary は glossaryTerms.js の effectiveGlossary(glossaryExtra, removedIds) を渡す
//   （重複チェックの対象を呼び出し側と食い違わせないため）。
// 戻り値は次のstateの各フィールド（okがfalseの時はcandidates以外は変更しない）。
export function acceptCandidate(candidateId, state) {
  const { candidates, glossaryExtra, removedIds, history, fullGlossary } = state;
  const candidate = candidates.find((c) => c.id === candidateId && c.status === 'pending');
  if (!candidate) {
    return { ok: false, errors: ['候補が見つかりません'], candidates, glossaryExtra, removedIds, history };
  }

  if (candidate.action === 'add') {
    const check = runTocChecks(candidate.term, fullGlossary);
    if (!check.ok) {
      return { ok: false, errors: check.errors, candidates, glossaryExtra, removedIds, history };
    }
    const nextExtra = [...glossaryExtra, candidate.term];
    const nextCandidates = candidates.map((c) => (c.id === candidateId ? { ...c, status: 'accepted' } : c));
    const nextHistory = [
      ...history,
      { id: candidate.id, action: 'add', term: candidate.term, decision: 'accepted', at: Date.now(), addedFrom: candidate.addedFrom },
    ];
    return { ok: true, errors: [], candidates: nextCandidates, glossaryExtra: nextExtra, removedIds, history: nextHistory };
  }

  // delete：対象自体の存在チェックだけ行う（それ以外は無条件で除去してよい）。
  const exists = fullGlossary.some((g) => g.id === candidate.targetId);
  if (!exists) {
    return { ok: false, errors: ['削除対象が見つかりません（既に削除済みの可能性）'], candidates, glossaryExtra, removedIds, history };
  }
  const nextRemoved = [...removedIds, candidate.targetId];
  const nextCandidates = candidates.map((c) => (c.id === candidateId ? { ...c, status: 'accepted' } : c));
  const nextHistory = [
    ...history,
    { id: candidate.id, action: 'delete', targetId: candidate.targetId, decision: 'accepted', at: Date.now(), addedFrom: candidate.addedFrom },
  ];
  return { ok: true, errors: [], candidates: nextCandidates, glossaryExtra, removedIds: nextRemoved, history: nextHistory };
}

// 「しない」が選ばれた候補：本体（glossaryExtra／removedIds）には一切触れず、
// 候補自体をrejected状態にして履歴へ「見送り」として残すだけ（#22・#23）。
export function rejectCandidate(candidateId, state) {
  const { candidates, history } = state;
  const candidate = candidates.find((c) => c.id === candidateId && c.status === 'pending');
  if (!candidate) return { ok: false, candidates, history };
  const nextCandidates = candidates.map((c) => (c.id === candidateId ? { ...c, status: 'rejected' } : c));
  const nextHistory = [
    ...history,
    {
      id: candidate.id,
      action: candidate.action,
      term: candidate.term,
      targetId: candidate.targetId,
      decision: 'rejected',
      at: Date.now(),
      addedFrom: candidate.addedFrom,
    },
  ];
  return { ok: true, candidates: nextCandidates, history: nextHistory };
}

// 直近の自動反映（候補の承認によってglossaryExtraへ入った項目）だけをn件取り消す。
// 手で書いた本体データ（glossaryTerms.jsのGLOSSARY_TERMS）は対象にならない
// （historyのaddレコードはextraへの追加時にしか作られないため、自然にそうなる）。
export function undoLastTocAdditions(n, state) {
  const { glossaryExtra, history } = state;
  const acceptedAdds = history
    .filter((h) => h.action === 'add' && h.decision === 'accepted')
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, n);
  const idsToRemove = new Set(acceptedAdds.map((h) => h.term.id));
  const nextExtra = glossaryExtra.filter((t) => !idsToRemove.has(t.id));
  const nextHistory = [
    ...history,
    ...acceptedAdds.map((h) => ({ id: h.id, action: 'undo_add', term: h.term, decision: 'undone', at: Date.now() })),
  ];
  return { glossaryExtra: nextExtra, history: nextHistory, removedCount: idsToRemove.size };
}
