// 実行時（1ステップ）の組み立て。
//
// ここが「AI社員 → AI Router → エンジン」の合流点。
// 社員の人格・記憶・道具・権限を1つのリクエストにまとめ、結果を返す。
// **エンジン名で分岐しない**（providers/index.js の登録内容だけで動く）。

import { providerById, estimateCost } from './providers/index.js';
import { route, markBusy } from './router.js';
import { isBusyError, failureAdvice } from './providers/stream.js';
import { buildContext } from './memory.js';
import { roleById, groupById } from '../data/roles.js';
import { isToolEnabled } from '../data/tools.js';
import { outputFormatPrompt } from './outline.js';

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
  if (steps.length <= 1) return true;
  const g = (x) => (Number.isInteger(x.group) ? x.group : steps.indexOf(x));
  const max = Math.max(...steps.map(g));
  return g(step) === max;
}

/** 社員の人格をシステムプロンプトに起こす。 */
export function buildSystemPrompt({ employee, company, contextText, isFinal = false }) {
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
    '## 会社の決まり',
    '- 事実と推測を必ず分けて書く。分からないことは「未確認」と書く。',
    '- 情報を使ったら出典（媒体名・URL・日付）を最後に「出典：」として並べる。',
    '- 最終的な意思決定はオーナー（人間）が行う。あなたは調査・分析・提案までを担う。',
    '- 医療・法律・お金に関わる断定は避け、確認先を添える。',
    '- 日本語で答える。前置きの挨拶は書かない。',
  ].filter(Boolean);

  // 会社としての提出物を書く**最後の手順にだけ**、5項目の枠をかける。
  // 途中の手順にまでかけると、1行で足りる調査結果まで長くなって読みにくい。
  if (isFinal) {
    lines.push('', outputFormatPrompt());
  }

  if (contextText) {
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
    request: `${task.request || ''} ${step.instruction || ''}`,
    mode: settings.routerMode || 'auto',
    needs,
  });

  const provider = providerById(decision.providerId);
  if (!provider) throw new Error(`エンジン ${decision.providerId} が見つかりません`);

  const context = buildContext({ employee, task, knowledgeList, inherited });
  const system = buildSystemPrompt({ employee, company, contextText: context.text, isFinal: isFinalStep(task, step) });

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
    model: decision.model,
    reason: decision.reason,
    offline: Boolean(res.offline),
    usage: res.usage || { input: 0, output: 0 },
    cost: estimateCost(provider.id, decision.model, res.usage),
    citations: res.citations || [],
    usedKnowledgeIds: context.knowledgeIds,
    layers: context.layers,
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
async function callWithRetry(provider, args) {
  try {
    return await provider.run(args);
  } catch (e) {
    // fetch そのものが失敗した時（圏外・機内モード）は状態番号が無い。
    // 生の "Failed to fetch" を出さず、何をすればよいかに置き換える。
    if (e && !e.status && /fetch|network|Load failed/i.test(e.message || '')) {
      const wrapped = new Error(`${provider.name}：${failureAdvice(0)}`);
      wrapped.offlineLike = true;
      throw wrapped;
    }
    if (!isBusyError(e)) throw e;
    markBusy(provider.id, e.retryAfterMs);
    // 中止されているならやり直さない
    if (args.signal && args.signal.aborted) throw e;
    const wait = Math.min(e.retryAfterMs || 1500, 20000);
    await new Promise((r) => setTimeout(r, wait));
    if (args.signal && args.signal.aborted) throw e;
    // やり直しは1度だけ。ここで失敗したら、そのまま失敗として返す。
    return provider.run(args);
  }
}

/**
 * 成果テキストから、知識にするタイトルと要約を取り出す。
 *
 * preferredTitle（＝ユーザー自身の依頼文から作ったタイトル）があれば必ずそれを使う。
 * 成果本文の先頭は `## リサーチャー・ルナ` のような担当者名の見出しなので、
 * それをタイトルにすると「リサーチャー・ルナ」という検索できない知識ができてしまう。
 */
export function distill(text = '', preferredTitle = '') {
  const clean = String(text).replace(/\r/g, '');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  const heading = lines.find((l) => /^#{1,3}\s+/.test(l));
  const title =
    (preferredTitle && preferredTitle.slice(0, 60)) ||
    (heading ? heading.replace(/^#{1,3}\s+/, '').slice(0, 60) : '') ||
    '成果';

  // 一覧に出る1行の要約なので、**文になっていない行は拾わない**。
  // 注意書き（⚠・※）、見出し、箇条書き（記号・番号つきの両方）、
  // 表の行、引用、括弧だけの補足を外す。
  // ※ 番号つき（「1. 一次情報が…」）を外していなかったため、
  //   箇条書きの途中が知識カードの要約になっていた。
  const isNoise = (l) =>
    /^[⚠※]/.test(l) ||
    /^#{1,3}\s/.test(l) ||
    /^[-*・>＞|｜]/.test(l) ||
    /^[0-9０-９]+\s*[.．)）、]/.test(l) ||
    /^[（(]/.test(l) ||
    /^[　\s]*[（(]/.test(l);
  const firstBody = lines.find((l) => !isNoise(l) && l.length > 10);
  const summary = (firstBody || lines.find((l) => !isNoise(l)) || lines[0] || '').slice(0, 240);

  return { title, summary };
}

/** 出力に含まれる URL を出典候補として拾う。 */
export function extractUrls(text = '') {
  const found = String(text).match(/https?:\/\/[^\s)）」』】、,]+/g) || [];
  return [...new Set(found)].slice(0, 20);
}
