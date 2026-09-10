// 目次の候補を「本体データ」へ反映する所。
//
// このアプリの本体データはコード（src/lib/*.ts）なので、動いているアプリは
// そこへ書けない。そこで **端末内の追加分 additions と 削除分 removals** を持ち、
// buildTocEntries(additions, removals) が返すものを「統合後の目次＝本体」とする。
// 画面・検索・重複チェックはすべてこの統合後の目次を見る。
//
// 約束（toc.spec.ts が機械チェックする）:
//   - 候補は「追加する」を押すまで本体に一切影響しない。
//   - 「追加する」を押した時に初めて 読み・重複・分類・正規化 の4つを見る。
//   - 「削除する」は対象の1件だけを消す。
//   - 「しない」を選んだ候補は本体に痕跡を残さない。
//   - 確定した結果（追加／削除／見送り）は履歴に残す。
//   - 直近の追加は undoLastTocAdditions(n) で取り消せる。

import { buildTocEntries, TOC_CATEGORY_MAP, type TocEntry } from '../data/toc.js';
import type { TocCandidate } from '../data/tocCandidates.js';
import { foldKana, normalizeAlnum, readingInfo, OTHER_GROUP } from './yomi.js';

export type HistoryKind = 'added' | 'deleted' | 'rejected' | 'undone';

export interface TocHistoryEvent {
  at: number;
  kind: HistoryKind;
  candidateId: string;
  title: string;
  /** 追加なら作った目次項目の id、削除なら消した項目の id */
  entryId: string;
  trigger: string;
}

export interface TocUserData {
  candidates: TocCandidate[];
  /** 端末内で足した項目 */
  additions: TocEntry[];
  /** 端末内で消した項目の目次 id */
  removals: string[];
  history: TocHistoryEvent[];
}

export function emptyTocData(): TocUserData {
  return { candidates: [], additions: [], removals: [], history: [] };
}

/** 保存から読んだものを整える（形が違っても落ちない） */
export function normalizeTocData(raw: unknown): TocUserData {
  const d = (raw || {}) as Partial<TocUserData>;
  return {
    candidates: Array.isArray(d.candidates) ? d.candidates : [],
    additions: Array.isArray(d.additions) ? d.additions : [],
    removals: Array.isArray(d.removals) ? d.removals : [],
    history: Array.isArray(d.history) ? d.history : [],
  };
}

/** いまの統合後の目次（元データ ＋ 端末内の追加 − 端末内の削除） */
export function mergedEntries(data: TocUserData): TocEntry[] {
  return buildTocEntries(data.additions, data.removals);
}

// ── 「追加する」を押した時にだけ走る4つのチェック ────────────────

export interface CheckResult {
  ok: boolean;
  problems: string[];
}

const HAS_KANJI = /[一-龥]/;

/**
 * 読み・重複・分類・正規化の4つ。
 * **候補を作る時ではなく、受け入れる時に走らせる**
 * （作った後に本体が変わっていることがあるため）。
 */
export function checkCandidate(candidate: TocCandidate, entries: TocEntry[]): CheckResult {
  const problems: string[] = [];

  // 1. 読み：漢字を含むなら読みが要る（**推定しない**）
  if (HAS_KANJI.test(candidate.title) && !candidate.reading.trim()) {
    problems.push('漢字を含むので、読み（ひらがな）が要ります。自動では推定しません。');
  } else if (candidate.reading && !/^[ぁ-んァ-ヶーA-Za-z0-9]+$/.test(candidate.reading.trim())) {
    problems.push('読みは、ひらがな（またはA〜Z・数字）で書いてください。');
  }

  // 2. 重複：統合後の目次でタイトルがぶつかっていないか（別名ともぶつけない）
  const key = (s: string) => foldKana(normalizeAlnum(s)).toLowerCase();
  const k = key(candidate.title);
  for (const e of entries) {
    if (key(e.title) === k) { problems.push(`「${e.title}」がすでに目次にあります。`); break; }
    if (e.aliases.some((a) => key(a) === k)) {
      problems.push(`「${e.title}」の別の呼び名として、すでに引けます。`);
      break;
    }
  }

  // 3. 分類：知らないまとまりに入れない
  if (!TOC_CATEGORY_MAP[candidate.category]) {
    problems.push(`「${candidate.category}」というまとまりは目次にありません。`);
  }

  // 4. 正規化：あ〜ん／A〜Z のどこかに入るか（その他へ落ちるなら読みが足りない）
  const normalized = normalizeAlnum(candidate.title);
  if (!normalized) {
    problems.push('記号だけの言葉は目次に置けません。');
  } else if (readingInfo(candidate.title, candidate.reading).group === OTHER_GROUP) {
    problems.push('読みから あ〜ん／A〜Z のどこに入るか決められませんでした。読みを見直してください。');
  }

  return { ok: problems.length === 0, problems };
}

// ── 受け入れ・見送り ────────────────────────────────

function withCandidate(data: TocUserData, id: string, patch: Partial<TocCandidate>): TocCandidate[] {
  return data.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

export interface ApplyResult {
  data: TocUserData;
  ok: boolean;
  problems: string[];
}

/** 「追加する」。ここで初めて4つのチェックを通し、通ったものだけ本体へ入れる */
export function acceptAdd(data: TocUserData, candidateId: string, at: number): ApplyResult {
  const c = data.candidates.find((x) => x.id === candidateId);
  if (!c || c.action !== 'add' || c.status !== 'pending') {
    return { data, ok: false, problems: ['その候補は見つかりませんでした。'] };
  }
  const check = checkCandidate(c, mergedEntries(data));
  if (!check.ok) return { data, ok: false, problems: check.problems };

  const entryId = `user-${c.id}`;
  const entry: TocEntry = {
    id: entryId,
    category: c.category,
    title: c.title,
    reading: c.reading,
    sub: c.description.slice(0, 64),
    description: c.description,
    // **会話から来たものを勝手に「確認済み」にしない**
    descriptionStatus: 'needs_review',
    aliases: [...c.aliases],
    destinations: [...c.destinations],
    targetId: c.id,
    userAdded: true,
  };
  return {
    ok: true,
    problems: [],
    data: {
      ...data,
      candidates: withCandidate(data, candidateId, { status: 'accepted' }),
      additions: [...data.additions, entry],
      history: [...data.history, { at, kind: 'added', candidateId, title: c.title, entryId, trigger: c.addedFrom.trigger }],
    },
  };
}

/** 「削除する」。**対象の1件だけ**を統合後の目次から外す */
export function acceptDelete(data: TocUserData, candidateId: string, at: number): ApplyResult {
  const c = data.candidates.find((x) => x.id === candidateId);
  if (!c || c.action !== 'delete' || c.status !== 'pending') {
    return { data, ok: false, problems: ['その候補は見つかりませんでした。'] };
  }
  const target = c.targetEntryId;
  if (!target || !mergedEntries(data).some((e) => e.id === target)) {
    return { data, ok: false, problems: ['消す対象が目次に見つかりませんでした。'] };
  }
  // 端末内で足したものなら additions から外し、元データ由来なら removals に積む
  const wasAdded = data.additions.some((e) => e.id === target);
  return {
    ok: true,
    problems: [],
    data: {
      ...data,
      candidates: withCandidate(data, candidateId, { status: 'accepted' }),
      additions: wasAdded ? data.additions.filter((e) => e.id !== target) : data.additions,
      removals: wasAdded ? data.removals : [...data.removals, target],
      history: [...data.history, { at, kind: 'deleted', candidateId, title: c.title, entryId: target, trigger: c.addedFrom.trigger }],
    },
  };
}

/** 「追加しない」「削除しない」。**本体には一切触れない**（履歴にだけ残す） */
export function rejectCandidate(data: TocUserData, candidateId: string, at: number): ApplyResult {
  const c = data.candidates.find((x) => x.id === candidateId);
  if (!c || c.status !== 'pending') return { data, ok: false, problems: ['その候補は見つかりませんでした。'] };
  return {
    ok: true,
    problems: [],
    data: {
      ...data,
      candidates: withCandidate(data, candidateId, { status: 'rejected' }),
      history: [...data.history, { at, kind: 'rejected', candidateId, title: c.title, entryId: '', trigger: c.addedFrom.trigger }],
    },
  };
}

/** 候補を積む（同じ id は積み直さない）。**本体には触れない** */
export function addCandidates(data: TocUserData, candidates: TocCandidate[]): TocUserData {
  const known = new Set(data.candidates.map((c) => c.id));
  const fresh = candidates.filter((c) => !known.has(c.id));
  if (fresh.length === 0) return data;
  return { ...data, candidates: [...data.candidates, ...fresh] };
}

/**
 * 直近 n 件の「追加」を取り消す。
 * **取り消すのはその n 件だけ**で、削除の履歴や他の追加には触れない。
 */
export function undoLastTocAdditions(data: TocUserData, n = 1, at: number = Date.now()): TocUserData {
  if (n <= 0) return data;
  const adds = data.history.filter((h) => h.kind === 'added');
  const targets = adds.slice(-n);
  if (targets.length === 0) return data;
  const ids = new Set(targets.map((h) => h.entryId));
  const candIds = new Set(targets.map((h) => h.candidateId));
  return {
    ...data,
    additions: data.additions.filter((e) => !ids.has(e.id)),
    candidates: data.candidates.map((c) => (candIds.has(c.id) ? { ...c, status: 'pending' as const } : c)),
    history: [
      ...data.history,
      ...targets.map((h) => ({ at, kind: 'undone' as const, candidateId: h.candidateId, title: h.title, entryId: h.entryId, trigger: h.trigger })),
    ],
  };
}

export function pendingCandidates(data: TocUserData): TocCandidate[] {
  return data.candidates.filter((c) => c.status === 'pending');
}

/**
 * 「確認済み」にできるのは**本人が押した時だけ**。
 * 会話由来・候補の受け入れ・元データの導出のどれからもここへは来ない。
 */
export function markVerified(data: TocUserData, entryId: string): TocUserData {
  return {
    ...data,
    additions: data.additions.map((e) => (e.id === entryId ? { ...e, descriptionStatus: 'verified' as const } : e)),
  };
}
