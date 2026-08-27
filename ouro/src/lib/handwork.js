// AIがやった仕事と、人がやった仕事の切り分け。
//
// 「AIを使えるようになるほど、AIにできない仕事が自分の仕事になる」——
// 効率化した先で自分の時間がどこへ流れたかが見えないと、
// **稼ぎに向かっているのか、ただ忙しくなっただけなのか**が分からない。
//
// AIを呼ばない。仕事・承認・知識・発信から数えるだけ。

const DAY = 86400000;

/**
 * @param {object} o { tasks, approvals, knowledge, posts, days, now }
 * @returns {{ai:{calls,usd,tasks}, human:{decisions,approvals,holds,writes,posts,shares}, ratio}}
 */
export function handworkSplit({
  tasks = [],
  approvals = [],
  knowledge = [],
  posts = [],
  days = 30,
  now = Date.now(),
} = {}) {
  const since = now - days * DAY;
  const inRange = (t) => (t || 0) >= since;

  const myTasks = tasks.filter((t) => inRange(t.finishedAt || t.startedAt || t.createdAt));
  const steps = myTasks.flatMap((t) => ((t.steps || []).flat ? (t.steps || []).flat(2) : t.steps || []));

  const ai = {
    tasks: myTasks.length,
    // ローカル社員（AI未接続）は数に入れない——AIが動いていないため
    calls: steps.filter((s) => s && s.providerId && s.providerId !== 'local' && s.status === 'done').length,
    usd: steps.reduce((n, s) => n + (Number(s && s.cost) || 0), 0),
  };

  const human = {
    // 出てきたものをどうするか決めた回数
    decisions: myTasks.reduce(
      (n, t) => n + (t.decisions || []).filter((d) => d.decidedAt && inRange(d.decidedAt)).length,
      0
    ),
    // 実行してよいか決めた回数
    approvals: approvals.filter((a) => a.status !== 'pending' && inRange(a.decidedAt || a.updatedAt || a.createdAt)).length,
    // 止めた回数（判断を先送りにした回数ではなく、意識して止めた回数）
    holds: myTasks.filter((t) => t.holdReason).length,
    // 自分で書いたもの
    writes: knowledge.filter((k) => k.origin === 'user' && inRange(k.createdAt)).length,
    // 外へ出したもの
    posts: posts.filter((p) => inRange(p.postedAt)).length,
    // 社内へ共有した回数
    shares: myTasks.filter((t) => t.shared).length,
  };

  const humanTotal = Object.values(human).reduce((a, b) => a + b, 0);
  return {
    days,
    ai,
    human,
    humanTotal,
    // AIの呼び出し1回あたり、人が何回手を動かしたか。
    // **多い＝悪い、ではない**（判断は人の仕事）。増え方を見るための数字。
    ratio: ai.calls ? Number((humanTotal / ai.calls).toFixed(2)) : null,
  };
}

/** 画面に出す1行。断定しない。 */
export function handworkLine(split) {
  if (!split) return '';
  if (!split.ai.calls && !split.humanTotal) return `この${split.days}日は、まだ記録がありません。`;
  if (!split.ai.calls) return `この${split.days}日、AIは動いていません（人の作業${split.humanTotal}件）。`;
  return `この${split.days}日：AIの呼び出し${split.ai.calls}回／あなたが手を動かしたこと${split.humanTotal}件。`;
}
