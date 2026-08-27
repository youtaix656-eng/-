// 関係する仕事の相互参照（新規）。
//
// **会議を開かずに共有する。** いま社内で動いている関係する仕事を数行だけ
// 社員のプロンプトへ入れる。これだけで「同じことを二度調べる」が減る。
// AIは1回も呼ばない（台帳と同じく tasks から導くだけ）。
//
// 入れるのは**数行だけ**。全部入れると、仕事が増えるほど毎回のトークンが増える。

// 日本語は語の切れ目が無いので、**2文字ずつの重なり**で見る
// （辞書を持たずに済み、外部ライブラリも要らない）。
const DROP = /[はがのにをでとやもへか、。・「」『』（）()\s　]+/g;

function grams(text) {
  const s = String(text || '').toLowerCase().replace(DROP, '');
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
}

/** 2つの依頼文がどれくらい重なっているか（0〜1）。 */
export function overlap(a, b) {
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit += 1;
  return hit / Math.min(A.size, B.size);
}

export const NEAR = 0.34;

/**
 * その仕事と関係のある、他の仕事。
 * ① 同じ案件 ② 同じ担当がいる ③ 依頼文が近い、の順に拾う。
 */
export function relatedTasks(task, tasks = [], { limit = 4, now = Date.now(), days = 30 } = {}) {
  if (!task) return [];
  const since = now - days * 24 * 60 * 60 * 1000;
  const mine = new Set((task.steps || []).map((s) => s.employeeId).filter(Boolean));
  const scored = [];
  for (const t of tasks) {
    if (!t || t.id === task.id) continue;
    if ((t.createdAt || 0) < since) continue;
    if (t.status === 'cancelled') continue;
    let score = 0;
    let why = '';
    if (task.dealId && t.dealId === task.dealId) {
      score = 3;
      why = '同じ案件';
    } else if ((t.steps || []).some((s) => mine.has(s.employeeId))) {
      score = 2;
      why = '同じ担当';
    } else {
      const o = overlap(`${task.title} ${task.request}`, `${t.title} ${t.request}`);
      if (o >= NEAR) {
        score = 1 + o;
        why = '似た依頼';
      }
    }
    if (score > 0) scored.push({ task: t, score, why });
  }
  return scored
    .sort((a, b) => b.score - a.score || (b.task.createdAt || 0) - (a.task.createdAt || 0))
    .slice(0, limit);
}

// 状態の言い方。workflow.js を読み込まずに済ませる（ここは数行の文を作るだけ）。
const STATE_NAME = {
  draft: '下書き',
  queued: '待機中',
  running: '進行中',
  awaiting_approval: '承認待ち',
  on_hold: '保留',
  done: '完了',
  failed: '止まっている',
  cancelled: '中止',
};

/** 社員に読ませる文（数行だけ）。 */
export function relatedPrompt(rows = []) {
  if (!rows.length) return '';
  return [
    '## いま社内で動いている、関係する仕事',
    ...rows.map(({ task, why }) => {
      const state = STATE_NAME[task.status] || task.status;
      const owner = ownerOf(task);
      return `- 「${task.title}」${owner ? `（${owner}）` : ''}／${state}／${why}`;
    }),
    '同じことを二度調べないでください。すでに分かっていることは、そのまま使ってかまいません。',
  ].join('\n');
}

function ownerOf(task) {
  const steps = task.steps || [];
  const s =
    steps.find((x) => x.status === 'running') ||
    steps.find((x) => x.status === 'pending') ||
    [...steps].reverse().find((x) => x.status === 'done');
  return s ? s.employeeName || '' : '';
}
