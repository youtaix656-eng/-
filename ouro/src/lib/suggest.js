// 依頼を書いたら、おすすめの組み合わせを提案する（新規）。
//
// Ouro には役職25・キャラクター30名・仕事の流れ12・ジャンル9・完成条件・
// 案件の紐づけ…と選べるものが増えすぎた。**選べること自体が負担**になっている。
//
// そこで、依頼文から「この組み合わせでどうですか」を1つだけ出し、
// はい／いいえで進めるようにする。いいえなら今までどおり自分で決められる。
//
// **AIを1回も呼ばない。** 語の一致と、既にある dispatcher の計画を使うだけ。

import { planSteps, detectNeeds } from './dispatcher.js';
import { roleById } from '../data/roles.js';
import { WORKFLOWS, workflowById, flatSteps } from '../data/workflows.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';

// 提案を出すのに必要な最低限の長さ。短すぎると当てずっぽうになる。
export const MIN_REQUEST = 6;

// ── どの分野か ──
// 組み込みジャンルの見分け方。ユーザーが足したジャンルは名前と説明の語で見る。
const GENRE_HINTS = {
  health: ['腰痛', '肩こり', '膝', '施術', '鍼', '灸', '整体', '健康', '体調', '痛み', '症状', 'ストレッチ', '姿勢'],
  study: ['試験', '国家試験', '勉強', '暗記', '過去問', '学習', '合格', 'テスト'],
  money: ['稼', '収入', '副業', '単価', '相場', '報酬', '手取り', '値段', '価格', '売上'],
  writing: ['記事', 'ブログ', '文章', '投稿', 'note', '台本', '書いて', 'コピー', '見出し'],
  design: ['デザイン', '配色', 'レイアウト', '見た目', 'ロゴ', 'バナー'],
  tech: ['アプリ', 'コード', 'プログラム', '自動化', 'ツール', 'エラー', 'API'],
  business: ['集客', 'お客', '顧客', '予約', 'リピート', '広告', 'チラシ', '営業', '販促'],
  life: ['睡眠', '家事', '生活', '献立', '片付', '習慣'],
};

function hitCount(text, words) {
  return words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
}

/** 依頼文から分野を当てる。当たらなければ汎用。 */
export function guessGenre(request, customGenres = []) {
  const text = String(request || '');
  let best = { id: DEFAULT_GENRE_ID, score: 0 };
  for (const [id, words] of Object.entries(GENRE_HINTS)) {
    const score = hitCount(text, words);
    if (score > best.score) best = { id, score };
  }
  // ユーザーが足したジャンルは、名前と説明の語で見る
  for (const g of customGenres || []) {
    if (!g || !g.id) continue;
    const words = `${g.name || ''} ${g.desc || ''}`.split(/[\s、。・]+/).filter((w) => w.length >= 2);
    const score = hitCount(text, words);
    if (score > best.score) best = { id: g.id, score };
  }
  return best;
}

// ── どの進め方か ──
// 仕事の流れの見分け方。data/workflows.js に無い id は無視される。
const WORKFLOW_HINTS = [
  { id: 'sort_work', words: ['棚卸し', '仕分け', '任せられる', '作業一覧'] },
  { id: 'numbers', words: ['数字', '今週の', 'ＫＰＩ', 'kpi', '分析して', '伸びな', '改善案'] },
  { id: 'spread', words: ['横展開', 'sns', 'ｓｎｓ', 'x投稿', 'ツイート', 'インスタ', '投稿を'] },
  { id: 'letter', words: ['line', 'ライン', '配信', 'メール', '1通目', 'ステップ'] },
  { id: 'earn', words: ['稼', '収入', '受注', '単価', '案件を取'] },
  { id: 'decide', words: ['どっち', 'どちら', 'べきか', '賛成', '反対', '選ぶ', '決め'] },
  { id: 'learn', words: ['覚え', '勉強', '学習', '身につけ', '復習'] },
  { id: 'make_content', words: ['記事', 'ブログ', '書いて', '作って', '構成', '台本'] },
  { id: 'deep_research', words: ['調べ', 'リサーチ', '信頼できる', '出典', '最新', '情報'] },
];

/** 依頼文から進め方を当てる。当たらなければ null（＝おまかせ）。 */
export function guessWorkflow(request) {
  const text = String(request || '').toLowerCase();
  for (const w of WORKFLOW_HINTS) {
    if (!workflowById(w.id)) continue;
    if (w.words.some((x) => text.includes(x))) return w.id;
  }
  return null;
}

// ── 完成条件の下書き ──
const DONE_BY_WORKFLOW = {
  deep_research: '出典が3つ以上ある、確認できなかったことは「未確認」と書いてある',
  make_content: '読み手が誰か書いてある、注意点も書いてある、出典がある',
  numbers: '次に試すことが3つ以内、どの数字がどうなったら成功かが書いてある',
  spread: '同じ書き出しを使い回していない、それぞれ切り口が違う',
  letter: '送る相手と目的が書いてある、効果を保証していない',
  earn: '初期費用と、最短で成果が出るまでの日数が書いてある',
  decide: '選択肢が3つ以内、それぞれ失うものが書いてある',
  learn: '1回15分の単位に分かれている、できたかの判定方法がある',
  sort_work: 'A/B/C に仕分けてある、最初に任せる1つが選んである',
};

const DONE_BY_GENRE = {
  health: '断定していない、受診の目安が書いてある',
  money: '税や法律の判断は専門家に確認するよう書いてある',
};

/** 完成条件の下書き（そのまま使ってもよいし、消してもよい）。 */
export function suggestDoneWhen(workflowId, genreId) {
  const parts = [DONE_BY_WORKFLOW[workflowId] || '', DONE_BY_GENRE[genreId] || ''].filter(Boolean);
  return parts.join('、');
}

// ── 案件の紐づけ ──
const DROP = /[はがのにをでとやもへか、。・「」『』（）()\s　]+/g;

function grams(text) {
  const s = String(text || '').toLowerCase().replace(DROP, '');
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
}

export const DEAL_NEAR = 0.3;

/** 依頼文に近い、進行中の案件。無ければ null。 */
export function guessDeal(request, deals = []) {
  const A = grams(request);
  if (!A.size) return null;
  let best = null;
  for (const d of deals) {
    if (!d || ['paid', 'lost'].includes(d.status)) continue;
    const B = grams(`${d.title} ${d.notes || ''}`);
    if (!B.size) continue;
    let hit = 0;
    for (const g of A) if (B.has(g)) hit += 1;
    const score = hit / Math.min(A.size, B.size);
    if (score >= DEAL_NEAR && (!best || score > best.score)) best = { deal: d, score };
  }
  return best ? best.deal : null;
}

/**
 * おすすめの組み合わせを1つ作る。
 *
 * @param {object} o
 * @param {string} o.request  依頼文
 * @param {function} o.assign (roleId, genreId) => employee|null
 * @param {object[]} [o.customGenres]
 * @param {object[]} [o.deals]
 * @param {object} [o.fixed] 呼び出し元が既に決めているもの（案件から依頼した等）。
 *   **推測で上書きしないこと。** 案件から開いたのに紐づけが外れると、
 *   その案件の仕事が0件・AI費用¥0のままになる（結びつきは task.dealId だけ）。
 * @returns {{ok:boolean, ...}}
 */
export function suggestPlan({ request, assign, customGenres = [], deals = [], fixed = {} }) {
  const text = String(request || '').trim();
  if (text.length < MIN_REQUEST) return { ok: false, reason: 'もう少し詳しく書くと、組み合わせを提案できます' };

  const g = guessGenre(text, customGenres);
  const genreFixed = Boolean(fixed.genreId && fixed.genreId !== DEFAULT_GENRE_ID);
  const genreId = genreFixed ? fixed.genreId : g.id;
  const genre = allGenres(customGenres).find((x) => x.id === genreId) || null;

  // 呼び出し元が進め方を決めている時は、推測で置き換えない
  const workflowFixed = fixed.workflowId != null && Boolean(workflowById(fixed.workflowId));
  const workflowId = workflowFixed ? fixed.workflowId : guessWorkflow(text);
  const wf = workflowId ? workflowById(workflowId) : null;

  const forceRoles = wf && wf.steps.length ? wf.steps : null;
  const planned = planSteps(text, { forceRoles });
  const steps = planned.map((s) => {
    const employee = assign ? assign(s.roleId, genreId) : null;
    return {
      roleId: s.roleId,
      roleName: roleById(s.roleId)?.name || s.roleId,
      group: s.group,
      employee,
    };
  });

  const unstaffedRoles = steps.filter((s) => !s.employee).map((s) => s.roleId);
  const staffed = steps.filter((s) => s.employee);
  const approver = steps.find((s) => roleById(s.roleId)?.isApprover) || null;
  const doneWhen = suggestDoneWhen(workflowId, genreId);
  // 案件も同じ。指定されていればそれを使う（外すと結びつきが切れる）
  const fixedDeal = fixed.dealId ? deals.find((d) => d.id === fixed.dealId) : null;
  const deal = fixedDeal || guessDeal(text, deals);
  const needs = detectNeeds(text);

  // AIを何回呼ぶか（完成条件を付けると確認の手順が1つ増える）
  const calls = staffed.length + (doneWhen && staffed.length ? 1 : 0);

  // なぜこの組み合わせなのか。**当てずっぽうを断定で書かない**——
  // 当たった語がある時だけ理由を出し、無ければ「おまかせ」と正直に書く。
  const reasons = [];
  if (genreFixed && genre) {
    reasons.push(`分野は「${genre.name}」（ここへ来た時に決まっていました）`);
  } else if (genre && genreId !== DEFAULT_GENRE_ID && g.score > 0) {
    reasons.push(`「${genre.name}」の言葉があったので、その分野の社員を優先します`);
  } else {
    reasons.push('分野を絞る言葉が無かったので、汎用の社員が受けます');
  }
  if (wf && workflowFixed) reasons.push(`進め方は「${wf.name}」（ここへ来た時に決まっていました）`);
  else if (wf) reasons.push(`進め方は「${wf.name}」（${wf.desc}）`);
  else reasons.push('進め方はおまかせ（依頼文から担当を自動で決めます）');
  if (approver) reasons.push(`公開前の確認役（${approver.roleName}）が最後に入ります`);
  if (needs.includes('web')) reasons.push('Web検索を使います');
  if (deal && fixedDeal) reasons.push(`案件「${deal.title}」の仕事として登録します`);
  else if (deal) reasons.push(`案件「${deal.title}」に近い内容なので、紐づけます`);
  if (doneWhen) reasons.push('完成条件を付けるので、最後に1つずつ確認します');

  return {
    ok: true,
    genreId,
    genreName: genre ? genre.name : '汎用',
    workflowId,
    workflowName: wf ? wf.name : 'おまかせ',
    steps,
    staffedCount: staffed.length,
    unstaffedRoles,
    approverRoleId: approver ? approver.roleId : null,
    needs,
    doneWhen,
    dealId: deal ? deal.id : null,
    dealTitle: deal ? deal.title : '',
    calls,
    reasons,
  };
}

/** 提案をそのまま依頼の形にする。 */
export function planToTask(plan, { request, context = '' }) {
  return {
    request,
    context,
    workflowId: plan.workflowId,
    genreId: plan.genreId,
    dealId: plan.dealId,
    doneWhen: plan.doneWhen,
  };
}

export { WORKFLOWS, flatSteps };
