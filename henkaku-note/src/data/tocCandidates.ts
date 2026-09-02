// 目次への「追加・削除の候補」の置き場。
//
// ⚠ **ここは本体データではない。** 候補は本体（src/lib/*.ts の元データ、
//    および端末内の追加分）へ一切書き込まない。ユーザーが「追加する」「削除する」を
//    選んだ時に初めて、lib/tocStore.ts が本体へ反映する。
//
// ⚠ **候補は下の3つのきっかけ以外では絶対に作らない**（勝手に増やさない）。
//    会話の流れで思いついたから足す、をやると、本人が頼んでいない言葉が
//    黙って目次に入る。同じリポジトリの鏡アプリで実際にそれをやって削除になった。

import type { DescriptionStatus, Destination } from './toc.js';

/** 候補を作ってよいきっかけ。**この3つだけ** */
export const CANDIDATE_TRIGGERS = ['explicit_marker', 'tags', 'user_request'] as const;
export type CandidateTrigger = (typeof CANDIDATE_TRIGGERS)[number];

export const TRIGGER_LABELS: Record<CandidateTrigger, string> = {
  explicit_marker: '「■用語追加：」の合図',
  tags: '教材づくりで付いたタグ',
  user_request: '「目次に追加して」の指示',
};

/** 「■用語追加：〜」の合図。この行以外からは候補を作らない */
export const TERM_MARKER = '■用語追加：';

export type CandidateAction = 'add' | 'delete';
export type CandidateStatus = 'pending' | 'accepted' | 'rejected';

export interface CandidateOrigin {
  conversationId: string;
  date: string;
  trigger: CandidateTrigger;
}

export interface TocCandidate {
  id: string;
  action: CandidateAction;
  status: CandidateStatus;
  /** 追加する言葉／削除する項目の名前 */
  title: string;
  reading: string;
  category: string;
  description: string;
  /** **会話由来は必ず 'needs_review'。** ここが 'verified' になることはない */
  descriptionStatus: DescriptionStatus;
  aliases: string[];
  destinations: Destination[];
  /** action:'delete' の時に消す対象（目次の entry id） */
  targetEntryId?: string;
  addedFrom: CandidateOrigin;
}

export interface CandidateInput {
  action: CandidateAction;
  title: string;
  reading?: string;
  category?: string;
  description?: string;
  aliases?: string[];
  destinations?: Destination[];
  targetEntryId?: string;
  conversationId: string;
  date: string;
  trigger: string;
}

/** 同じ日・同じ言葉でも中身が違えば別の候補として扱うための短い印 */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function isTrigger(t: string): t is CandidateTrigger {
  return (CANDIDATE_TRIGGERS as readonly string[]).includes(t);
}

/**
 * 候補を1件作る。
 * **きっかけが白名簿に無ければ null を返す**（黙って作らない）。
 */
export function makeCandidate(input: CandidateInput): TocCandidate | null {
  if (!isTrigger(input.trigger)) return null;
  const title = String(input.title || '').trim();
  if (!title) return null;
  return {
    id: `cand-${input.date}-${input.action}-${title}-${shortHash([title, input.reading, input.description, input.targetEntryId].join('|'))}`,
    action: input.action,
    status: 'pending',
    title,
    reading: String(input.reading || '').trim(),
    category: input.category || 'user',
    description: String(input.description || '').trim(),
    // 会話から来たものを「確認済み」にはしない。確認できるのは本人だけ。
    descriptionStatus: 'needs_review',
    aliases: (input.aliases || []).map((a) => String(a).trim()).filter(Boolean),
    destinations: input.destinations ? [...input.destinations] : [],
    targetEntryId: input.targetEntryId,
    addedFrom: { conversationId: input.conversationId, date: input.date, trigger: input.trigger },
  };
}

/**
 * きっかけ(a)：「■用語追加：〜」の行だけを拾う。
 * 書き方は `■用語追加：言葉｜よみ｜説明`（｜より後ろは省略できる）。
 */
export function parseTermMarker(text: string, at: { conversationId: string; date: string }): TocCandidate[] {
  const out: TocCandidate[] = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line.startsWith(TERM_MARKER)) continue;
    const [title, reading, description] = line.slice(TERM_MARKER.length).split(/[|｜]/).map((s) => (s || '').trim());
    const c = makeCandidate({
      action: 'add', title, reading, description,
      conversationId: at.conversationId, date: at.date, trigger: 'explicit_marker',
    });
    if (c) out.push(c);
  }
  return out;
}

/** きっかけ(b)：教材づくりで付いたタグから。タグ以外の言葉は拾わない */
export function fromTags(tags: string[], at: { conversationId: string; date: string }): TocCandidate[] {
  const out: TocCandidate[] = [];
  for (const tag of tags || []) {
    const c = makeCandidate({
      action: 'add', title: String(tag || ''),
      conversationId: at.conversationId, date: at.date, trigger: 'tags',
    });
    if (c) out.push(c);
  }
  return out;
}

/**
 * 会話から出てきた候補の置き場。
 *
 * **ここは本体データではない。** ここに置いただけでは目次に1件も入らず、
 * 画面の「追加・削除の候補」に並ぶだけ。ユーザーが「追加する」「削除する」を
 * 押した時に初めて lib/tocStore.ts が読み・重複・分類・正規化を見て反映する。
 *
 * 足してよいのは上の3つのきっかけがあった時だけで、
 * **会話の流れで思いついた言葉を勝手に足さない**。
 * 足す時は makeCandidate / parseTermMarker / fromTags / fromUserRequest を通す
 * （descriptionStatus が必ず 'needs_review' になる）。
 */
export const CONVERSATION_CANDIDATES: TocCandidate[] = [];

/** きっかけ(c)：「これを目次に追加して」と本人が言った時 */
export function fromUserRequest(
  input: Omit<CandidateInput, 'trigger'>,
): TocCandidate | null {
  return makeCandidate({ ...input, trigger: 'user_request' });
}
