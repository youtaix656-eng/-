// 実行時（1ステップ）の組み立て。
//
// ここが「AI社員 → AI Router → エンジン」の合流点。
// 社員の人格・記憶・道具・権限を1つのリクエストにまとめ、結果を返す。
// **エンジン名で分岐しない**（providers/index.js の登録内容だけで動く）。

import { providerById, estimateCost } from './providers/index.js';
import { route, markBusy, cheaperModel } from './router.js';
import { isBusyError, failureAdvice } from './providers/stream.js';
import { buildContext } from './memory.js';
import { roleById, groupById } from '../data/roles.js';
import { isToolEnabled } from '../data/tools.js';
import { outputFormatPrompt } from './outline.js';
import { rulesPrompt } from './rules.js';
import { SOURCE_RULE } from './untrusted.js';
import { styleText } from './style.js';
import { rivalsBrief } from './rivals.js';

// ── 新項目21：同じ問いの答えを使い回す ──
//
// 同じ社員に同じことを頼み直した時、もう一度AIに投げるのは待ち時間も料金も無駄。
// **端末のメモリにだけ**持ち（保存しない）、アプリを閉じれば消える。
// 道具（Web検索）を使う手順は結果が変わりうるので、対象にしない。
const ANSWER_CACHE_MAX = 20;
const answerCache = new Map(); // key → { res, at }

function cacheKey(providerId, model, system, userContent) {
  return `${providerId}|${model}|${system.length}|${userContent.length}|${system}\u0000${userContent}`;
}

function readCache(key) {
  const hit = answerCache.get(key);
  if (!hit) return null;
  // 使ったものを新しい方へ寄せる（あふれた時に、よく使うものから消さない）
  answerCache.delete(key);
  answerCache.set(key, hit);
  return hit.res;
}

function writeCache(key, res) {
  answerCache.set(key, { res, at: Date.now() });
  while (answerCache.size > ANSWER_CACHE_MAX) {
    const oldest = answerCache.keys().next().value;
    answerCache.delete(oldest);
  }
}

/** テスト用・設定画面用：覚えている答えを捨てる。 */
export function clearAnswerCache() {
  answerCache.clear();
}

/**
 * この手順が「会社としての提出物」を書く最後の手順か。
 * 手順の group 番号が最大なら最後（未雇用の役職を外すと番号が飛ぶので、
 * 位置ではなく番号の大小で見る）。
 */
export function isFinalStep(task, step) {
  const steps = (task && task.steps) || [];
  // 完成の確認（kind:'check'）は提出物を書く手順ではないので、枠を掛けない。
  // 数える側からも外す（外さないと、確認の手順が「最後」になってしまう）。
  if (step && step.kind === 'check') return false;
  const work = steps.filter((x) => x.kind !== 'check');
  if (work.length <= 1) return true;
  const g = (x) => (Number.isInteger(x.group) ? x.group : steps.indexOf(x));
  const max = Math.max(...work.map(g));
  return g(step) === max;
}

/** 社員の人格をシステムプロンプトに起こす。 */
export function buildSystemPrompt({ employee, company, contextText, isFinal = false, hasUntrusted = false }) {
  const role = roleById(employee.roleId);
  const group = role ? groupById(role.group || 'knowledge') : null;
  const lines = [
    `あなたは「${company?.name || 'Ouro'}」というAI会社に所属する社員です。`,
    `名前：${employee.name}`,
    `役職：${employee.title}`,
    role ? `担当：${role.duties.join('・')}` : '',
    employee.specialties?.length ? `専門：${employee.specialties.join('・')}` : '',
    employee.persona ? `性格：${employee.persona}` : '',
    employee.style ? `書き方：${employee.style}` : '',
    // チームの共通ルールは、個別の役割より先に読ませる
    group?.commonPrompt ? `\n## チームの共通ルール\n${group.commonPrompt}` : '',
    role?.systemHint || '',
    employee.seatHint || '',
    // noKpi / proposalOnly は systemHint 側で本文として書いてあるので、ここでは重ねない
    role?.outOfScope?.length ? `\n権限外（あなたが決めてはいけないこと）：${role.outOfScope.join('／')}` : '',
    '',
    // 会社の決まりは lib/rules.js が単一の正。
    // 消せない5行が必ず先に来て、そのあとにオーナーが足したルールが続く。
    rulesPrompt(company && company.rules),
  ].filter(Boolean);

  // 会社としての提出物を書く**最後の手順にだけ**、5項目の枠をかける。
  // 途中の手順にまでかけると、1行で足りる調査結果まで長くなって読みにくい。
  if (isFinal) {
    lines.push('', outputFormatPrompt());
  }

  if (contextText) {
    // **指示の出どころの宣言は、材料より必ず先に置く。**
    // 後ろに置くと、資料の中の「指示」が「あとから来た指示」に見えてしまう。
    if (hasUntrusted) lines.push('', SOURCE_RULE);
    lines.push('', '## 使える材料', contextText);
  }
  return lines.join('\n');
}

/**
 * 1ステップを実行する。
 * @returns {{text, providerId, model, usage, cost, citations, offline, reason}}
 */
export async function runStep({
  employee,
  company,
  task,
  step,
  knowledgeList = [],
  inherited = '',
  secrets = {},
  settings = {},
  connections = [],
  boardText = '',
  relatedText = '',
  pitfallText = '',
  briefText = '',
  styleSamples = [],
  rivals = [],
  signal,
  onDelta,
}) {
  // 道具を使ってよいかは2段構え：社員が持っているか（toolIds）と、
  // 会社として切っていないか（connections）。会社が切ったものは誰も使わない。
  const needs = (step.needs || [])
    .filter((n) => (employee.toolIds || []).includes(n))
    .filter((n) => isToolEnabled(connections, n));
  const decision = route({
    employee,
    secrets,
    settings,
    request: `${task.request || ''} ${step.instruction || ''}`,
    mode: settings.routerMode || 'auto',
    // 仕事ごとの指定を、全体の既定より優先する
    // （「この依頼は安いモデルでいい」を人が言えるようにするため）。
    costMode: task.costMode || settings.costMode || 'auto',
    needs,
  });

  const provider = providerById(decision.providerId);
  if (!provider) throw new Error(`エンジン ${decision.providerId} が見つかりません`);

  // 書き方の見本は**書く役の社員にだけ**渡す（`style.js` が役職で絞る）。
  // 全員に渡すと、調べるだけの社員の毎回の料金にも上乗せされる。
  const styleBlock = styleText(styleSamples, employee.roleId);
  // 競合の観測は**市場を見る役にだけ**渡す（`roles.js` の readsMarket が単一の正）。
  // 全員に渡すと、書くだけの社員の毎回の料金にも上乗せされる。
  const rivalsBlock = rivalsBrief(rivals, employee.roleId, { ventureId: task.ventureId || null });
  const context = buildContext({
    employee, task, knowledgeList, inherited, boardText, relatedText, pitfallText, briefText,
    styleText: styleBlock,
    rivalsText: rivalsBlock,
  });
  const system = buildSystemPrompt({
    employee,
    company,
    contextText: context.text,
    isFinal: isFinalStep(task, step),
    hasUntrusted: context.hasUntrusted,
  });

  // 受付のときに決めた条件（成果物の形・完成条件・使う材料・触れないこと）。
  // 空なら何も足さないので、これまでどおり1行の依頼でも動く。
  const spec = task.spec || {};
  const specLines = [
    spec.deliverable ? `- 成果物の形：${spec.deliverable}` : '',
    spec.doneWhen ? `- これが満たせたら完成：${spec.doneWhen}` : '',
    spec.materials ? `- 使ってよい材料：${spec.materials}` : '',
    spec.constraints ? `- 触れてはいけないこと：${spec.constraints}` : '',
  ].filter(Boolean);

  const userContent = [
    `# オーナーからの依頼`,
    task.request || '',
    specLines.length ? `\n# 依頼の条件\n${specLines.join('\n')}` : '',
    '',
    `# あなたへの指示`,
    step.instruction || '担当業務の観点から答えてください。',
  ]
    .filter((x) => x !== '')
    .join('\n');

  const tools = [];
  for (const need of needs) {
    const t = provider.serverTools && provider.serverTools[need];
    if (t) tools.push({ ...t, max_uses: 5 });
  }

  // 道具を使わない手順に限り、同じ問いなら前の答えを返す（新項目21）
  const key = tools.length ? null : cacheKey(provider.id, decision.model, system, userContent);
  const cached = key ? readCache(key) : null;
  if (cached) {
    // 途中経過を出す約束になっているので、覚えている本文を1回で流す
    if (onDelta) onDelta(cached.text || '');
    return {
      ...cached,
      cached: true,
      // 実際には投げていないので、費用は二重に数えない
      usage: { input: 0, output: 0 },
      cost: 0,
    };
  }

  const res = await callWithRetry(provider, {
    apiKey: secrets[provider.id],
    model: decision.model,
    // ローカルAI（compat）は宛先とモデル名を設定から読む
    settings,
    system,
    messages: [{ role: 'user', content: userContent }],
    tools,
    maxTokens: settings.maxTokens || 8000,
    signal,
    onDelta,
    meta: {
      roleId: employee.roleId,
      employeeName: employee.name,
      // ローカル社員（AI未接続）が読みやすい形で返せるよう、
      // 依頼と指示を分けて渡す（プロンプト全体を貼り返させない）。
      request: task.request || '',
      instruction: step.instruction || '',
      inheritedFrom: inherited ? '前の担当' : '',
    },
  });

  const out = {
    text: res.text || '',
    providerId: provider.id,
    providerName: provider.name,
    // **実際に投げたモデルを記録する。** 下のモデルへ落ちた時に
    // 決めた側の名前を残すと、費用の記録が実物とズレる。
    model: res.model || decision.model,
    reason: res.downgradedFrom
      ? `${decision.reason}／${res.downgradedFrom} が使えなかったので下のモデルへ`
      : decision.reason,
    offline: Boolean(res.offline),
    usage: res.usage || { input: 0, output: 0 },
    cost: estimateCost(provider.id, res.model || decision.model, res.usage),
    citations: res.citations || [],
    usedKnowledgeIds: context.knowledgeIds,
    layers: context.layers,
    // 社員が読んだ量（層ごと＋合計）。多いほど答えがぼやけるので、後から見られるようにする。
    contextChars: context.chars || 0,
  };
  // 空の答えは覚えない（次も空を返してしまうため）
  if (key && out.text.trim()) writeCache(key, out);
  return out;
}

/**
 * 混んでいる時だけ1度だけやり直す（新項目24）。
 *
 * **繰り返してよいのは「混んでいるだけ」の時に限る。**
 * キーが違う・内容が不正、といった失敗は何度投げても同じで、
 * そのぶん待たせて料金だけがかかる。
 * やり直す時は、そのエンジンを混雑中として記録し（新項目25）、
 * 次の手順から別のエンジンへ回るようにする。
 */
/**
 * そのモデルでは通らない失敗か。
 *   404 …… モデルが廃止された／このキーでは使えない
 *   429 …… 呼びすぎ、または**そのモデルが無料枠に無い**
 *   503 / 529 …… 混んでいる（上位モデルほど混みやすい）
 */
function isModelProblem(e) {
  const s = e && e.status;
  return s === 404 || s === 429 || s === 503 || s === 529;
}

/** 待ってからもう一度投げても意味がある失敗か（混んでいるだけ）。 */
function worthWaiting(e) {
  return isBusyError(e);
}

/**
 * 1回の呼び出し。**行き止まりを作らない**ための順番になっている。
 *
 *   ① そのまま投げる
 *   ② 404 / 429 …… 待っても変わらないので、**すぐ1つ下のモデル**へ
 *   ③ 503 / 529 …… 混んでいるだけなので、少し待って**同じモデル**でもう一度
 *   ④ それでもダメなら、1つ下のモデルへ（下が無ければ失敗として返す）
 *
 * ②が要るのは、「重い仕事だから上位モデル」と決めた結果が
 * 「そのモデルは無料枠に無い（429）」で終わることが実際にあるため。
 * 落とした時は、どのモデルで通ったかを必ず呼び出し元へ返す
 * （決めた側の名前を記録すると、費用の記録が実物とズレる）。
 */
async function callWithRetry(provider, args) {
  let model = args.model;
  let downgradedFrom = null;
  // 「混んでいるだけ」の待ち直しは、**モデル1つにつき1回**。
  // 下へ落ちたらまた1回だけ待てる（落ちた先も混んでいることがあるため）。
  let waited = false;

  for (;;) {
    try {
      const res = await provider.run({ ...args, model });
      return downgradedFrom ? { ...res, model, downgradedFrom } : res;
    } catch (e) {
      // fetch そのものが失敗した時（圏外・機内モード）は状態番号が無い。
      // 生の "Failed to fetch" を出さず、何をすればよいかに置き換える。
      if (e && !e.status && /fetch|network|Load failed/i.test(e.message || '')) {
        const wrapped = new Error(`${provider.name}：${failureAdvice(0)}`);
        wrapped.offlineLike = true;
        throw wrapped;
      }
      if (args.signal && args.signal.aborted) throw e;
      if (!isModelProblem(e)) throw e;

      // ③ 混んでいるだけなら、少し待って同じモデルでもう一度
      if (worthWaiting(e) && !waited) {
        waited = true;
        markBusy(provider.id, e.retryAfterMs);
        const wait = Math.min(e.retryAfterMs || 1500, 20000);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, wait));
        if (args.signal && args.signal.aborted) throw e;
        continue;
      }

      // ②④ 下のモデルへ。**落とした先も行き止まりにしない**
      // （1段落として終わりにすると、落ちた先が混んでいた時にそのまま失敗する）。
      const lower = cheaperModel(provider, model);
      if (!lower) throw e;
      downgradedFrom = downgradedFrom || model;
      model = lower;
      waited = false;
    }
  }
}
