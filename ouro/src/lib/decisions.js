// 「あなたの判断が要ること」（新規）。
//
// これまでの承認（lib/permissions.js）は **実行する前** の危険操作と費用だけだった。
// 実際に判断が要るのはもう一段あとで、**出てきた成果物の中身**についてのこと——
// この見積で出すか、この文面で送るか、この価格を約束してよいか。
//
// 成果物の ③ の節（outline.js）を機械的に拾って、1行ずつ「判断待ち」にする。
// AIをもう一度呼ばないので費用はかからない。
//
// **なぜ本文から毎回導かずに task へ持つのか**：
// 決めた／却下したという状態は保存しないと残らない。状態を持つ以上、
// 対応する文も一緒に持たないと結び付けられない。持つのは1行ずつの短い文で、
// 提出物の本文（assembleResult で組み立てる）を二重に持つわけではない。

import { newId } from './id.js';
import { parseSections } from './outline.js';

const NONE = ['なし', 'ありません', '特になし', '無し', '該当なし', 'none', '-', '—'];
const BULLET = /^[\s>#*_・\-–—]*[①-⑳0-9０-９]*[.．、)）]?\s*/;

/** ③の節から、判断が要ることを1行ずつ取り出す。 */
export function extractDecisions(text) {
  const { sections } = parseSections(text);
  const body = sections.decision;
  if (!body) return [];
  const out = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(BULLET, '').trim();
    if (!line) continue;
    if (NONE.includes(line.toLowerCase().replace(/[。.]$/, ''))) continue;
    if (line.length > 300) continue; // 本文が紛れ込んだとみなす
    if (out.includes(line)) continue;
    out.push(line);
    if (out.length >= 12) break;
  }
  return out;
}

export function makeDecisions(texts = []) {
  return texts.map((text) => ({
    id: newId('dec'),
    text: String(text).slice(0, 300),
    state: 'open', // open / approved / rejected
    note: '',
    decidedAt: null,
  }));
}

/** 仕事の成果から判断待ちを作る（完了した時に1度だけ呼ぶ）。 */
export function decisionsFrom(text) {
  return makeDecisions(extractDecisions(text));
}

export function openDecisions(task) {
  return (task.decisions || []).filter((d) => d.state === 'open');
}

export function decideDecision(task, decisionId, state, note = '') {
  const decisions = (task.decisions || []).map((d) =>
    d.id === decisionId ? { ...d, state, note: String(note || '').slice(0, 200), decidedAt: Date.now() } : d
  );
  return { ...task, decisions };
}
