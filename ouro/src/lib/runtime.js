// 実行時（1ステップ）の組み立て。
//
// ここが「AI社員 → AI Router → エンジン」の合流点。
// 社員の人格・記憶・道具・権限を1つのリクエストにまとめ、結果を返す。
// **エンジン名で分岐しない**（providers/index.js の登録内容だけで動く）。

import { providerById, estimateCost } from './providers/index.js';
import { route } from './router.js';
import { buildContext } from './memory.js';
import { roleById } from '../data/roles.js';

/** 社員の人格をシステムプロンプトに起こす。 */
export function buildSystemPrompt({ employee, company, contextText }) {
  const role = roleById(employee.roleId);
  const lines = [
    `あなたは「${company?.name || 'Ouro'}」というAI会社に所属する社員です。`,
    `名前：${employee.name}`,
    `役職：${employee.title}`,
    role ? `担当：${role.duties.join('・')}` : '',
    employee.specialties?.length ? `専門：${employee.specialties.join('・')}` : '',
    employee.persona ? `性格：${employee.persona}` : '',
    employee.style ? `書き方：${employee.style}` : '',
    role?.systemHint || '',
    employee.seatHint || '',
    '',
    '## 会社の決まり',
    '- 事実と推測を必ず分けて書く。分からないことは「未確認」と書く。',
    '- 情報を使ったら出典（媒体名・URL・日付）を最後に「出典：」として並べる。',
    '- 最終的な意思決定はオーナー（人間）が行う。あなたは調査・分析・提案までを担う。',
    '- 医療・法律・お金に関わる断定は避け、確認先を添える。',
    '- 日本語で答える。前置きの挨拶は書かない。',
  ].filter(Boolean);

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
  signal,
}) {
  const needs = (step.needs || []).filter((n) => (employee.toolIds || []).includes(n));
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
  const system = buildSystemPrompt({ employee, company, contextText: context.text });

  const userContent = [
    `# オーナーからの依頼`,
    task.request || '',
    '',
    `# あなたへの指示`,
    step.instruction || '担当業務の観点から答えてください。',
  ].join('\n');

  const tools = [];
  for (const need of needs) {
    const t = provider.serverTools && provider.serverTools[need];
    if (t) tools.push({ ...t, max_uses: 5 });
  }

  const res = await provider.run({
    apiKey: secrets[provider.id],
    model: decision.model,
    system,
    messages: [{ role: 'user', content: userContent }],
    tools,
    maxTokens: settings.maxTokens || 8000,
    signal,
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

  return {
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

  // 注意書き（⚠・※）、見出し、箇条書き、括弧だけの補足は要約に混ぜない
  const isNoise = (l) =>
    /^[⚠※]/.test(l) || /^#{1,3}\s/.test(l) || /^[-*・>]/.test(l) || /^[　\s]*[（(]/.test(l);
  const firstBody = lines.find((l) => !isNoise(l) && l.length > 10);
  const summary = (firstBody || lines.find((l) => !isNoise(l)) || lines[0] || '').slice(0, 240);

  return { title, summary };
}

/** 出力に含まれる URL を出典候補として拾う。 */
export function extractUrls(text = '') {
  const found = String(text).match(/https?:\/\/[^\s)）」』】、,]+/g) || [];
  return [...new Set(found)].slice(0, 20);
}
