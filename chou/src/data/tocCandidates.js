// 目次への追加・削除の「候補」。**本体のデータには一切書き込まない**——
// 候補のあいだはここに置くだけで、目次に出るのは「追加する」を押したあとだけ。
//
// なぜこうするか：会話や教材から拾った言葉をそのまま目次へ流し込むと、
// 読みの入れ忘れ・重なり・呼び名のゆれが黙って混ざる。人が一度見て決める場所を挟む。

/**
 * 候補を作ってよい合図。**この3つ以外では絶対に作らない。**
 *  - marker       … 「■用語追加：〜」の形で明示的に書かれたとき
 *  - tags         … 教材を作ったときに付いた tags から
 *  - user_request … 「これを目次に追加して」と本人が指示したとき
 */
export const TRIGGERS = ['marker', 'tags', 'user_request'];

export const TRIGGER_LABELS = {
  marker: '「■用語追加：」の合図',
  tags: '教材の tags',
  user_request: '本人の指示',
};

export const MARKER = '■用語追加：';

export const CANDIDATE_ACTIONS = ['add', 'delete'];
export const CANDIDATE_STATUSES = ['pending', 'accepted', 'rejected'];

/** 二択の文言（action で変える。ルール19） */
export const CANDIDATE_CHOICES = {
  add: { yes: '追加する', no: '追加しない' },
  delete: { yes: '削除する', no: '削除しない' },
};

let seq = 0;
function newId() {
  seq += 1;
  return `cand${Date.now().toString(36)}${seq.toString(36)}`;
}

/**
 * 候補を1件作る。**合図が3つのどれでもなければ null を返す**（ルール16）。
 * 会話から来たものは、説明の確からしさを必ず `needs_review` にする（ルール18）。
 */
export function makeCandidate(input = {}) {
  const { trigger, action = 'add', title, reading = '', conversationId = '', date = '' } = input;
  if (!TRIGGERS.includes(trigger)) return null;
  if (!CANDIDATE_ACTIONS.includes(action)) return null;
  const name = String(title || '').trim();
  if (!name) return null;
  return {
    id: typeof input.id === 'string' && input.id ? input.id : newId(),
    action,
    status: 'pending',
    title: name,
    reading: String(reading || '').trim(),
    group: input.group || 'term',
    aliases: Array.isArray(input.aliases) ? input.aliases : [],
    description: String(input.description || ''),
    // 会話由来は必ず「※要確認」。**ここを verified にできる道は用意しない**
    descriptionStatus: 'needs_review',
    destinations: Array.isArray(input.destinations) ? input.destinations : [],
    targetId: input.targetId || null, // action:'delete' のときに消す相手
    addedFrom: {
      conversationId: String(conversationId),
      date: String(date),
      trigger,
    },
  };
}

/**
 * 「■用語追加：〜」の行から用語名を取り出す。
 * **合図が無ければ何も返さない**（本文から勝手に用語を拾わない）。
 */
export function detectMarkerTerms(text) {
  if (typeof text !== 'string' || !text.includes(MARKER)) return [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf(MARKER);
    if (at < 0) continue;
    const rest = line.slice(at + MARKER.length).trim();
    if (rest) out.push(rest);
  }
  return out;
}
