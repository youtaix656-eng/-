// 自動社員選択とタスク分割。
//
// ユーザーが毎回「誰に頼むか」を考えなくて済むように、依頼文から
// 必要な役職・順番を推定する。判定に使う語は data/roles.js の triggers が
// 単一の正（役職を足せば自動で判定対象になる。ここに if を足さない）。

import { ROLES, roleById } from '../data/roles.js';

/** 依頼文にどの役職が向いているかを点数化する。 */
export function scoreRoles(request = '') {
  const text = String(request);
  return ROLES.map((role) => {
    let score = 0;
    for (const t of role.triggers) {
      if (text.includes(t)) score += 2;
    }
    for (const d of role.duties) {
      if (text.includes(d)) score += 1;
    }
    return { roleId: role.id, score };
  }).sort((a, b) => b.score - a.score || orderOf(a.roleId) - orderOf(b.roleId));
}

function orderOf(roleId) {
  const r = roleById(roleId);
  return r ? r.order : 99;
}

/** 依頼文に最も向いている役職（該当なしはアナライザー）。 */
export function pickRole(request = '') {
  const top = scoreRoles(request)[0];
  return top && top.score > 0 ? top.roleId : 'analyzer';
}

// 依頼の中に「調べて → まとめて → 確かめて」のような複数の動きがあるとき、
// 会社としての標準の流れに載せる。
const CHAIN_ORDER = ['researcher', 'analyzer', 'reviewer', 'strategist', 'creator', 'mentor'];

/**
 * 依頼文から実行計画（誰が・何をするか）を作る。
 * @returns {{roleId, instruction}[]}
 */
export function planSteps(request = '', options = {}) {
  const { maxSteps = 4, forceRoles = null } = options;
  const text = String(request).trim();

  if (Array.isArray(forceRoles) && forceRoles.length) {
    return forceRoles.slice(0, maxSteps).map((roleId, i) => ({
      roleId,
      instruction: instructionFor(roleId, text, i === 0),
    }));
  }

  const scored = scoreRoles(text).filter((s) => s.score > 0);
  if (!scored.length) {
    return [{ roleId: 'analyzer', instruction: instructionFor('analyzer', text, true) }];
  }

  // 上位の役職だけを拾い、会社の標準の流れの順に並べ直す
  const top = scored.slice(0, maxSteps).map((s) => s.roleId);
  const ordered = CHAIN_ORDER.filter((r) => top.includes(r)).concat(
    top.filter((r) => !CHAIN_ORDER.includes(r))
  );

  // 「調べて」で始まる依頼は、検証を挟んで信頼できる形にする
  if (ordered[0] === 'researcher' && ordered.length > 1 && !ordered.includes('reviewer')) {
    ordered.splice(Math.min(2, ordered.length), 0, 'reviewer');
  }

  return ordered.slice(0, maxSteps).map((roleId, i) => ({
    roleId,
    instruction: instructionFor(roleId, text, i === 0),
  }));
}

const STEP_INSTRUCTIONS = {
  researcher:
    '依頼に答えるために必要な情報を集め、出典（媒体名・URL・日付）付きで並べてください。' +
    '一次情報と二次情報を区別し、確認できなかった点は「未確認」と明記してください。',
  analyzer:
    '受け取った情報を構造化してください。事実と推測を分け、共通点・相違点・因果関係を整理し、' +
    '結論を先に書いてください。',
  reviewer:
    '受け取った内容を検証してください。根拠の弱い主張・古い数字・断定しすぎている箇所を指摘し、' +
    '取り返しのつかない誤り（安全・お金・健康）を最優先で挙げてください。',
  strategist:
    '受け取った内容を実行できる提案に変えてください。選択肢は3つまで、それぞれの費用・所要日数・' +
    '失うものを書き、最後に「今日やる1つ」を示してください。',
  creator:
    '受け取った内容をもとに、そのまま使える完成物を作ってください。説明ではなく成果物本体を書いてください。',
  mentor:
    '受け取った内容を身につけるための計画を作ってください。1回15分の単位に分け、' +
    'できたかの判定方法と次の復習日を添えてください。',
};

function instructionFor(roleId, request, isFirst) {
  const base = STEP_INSTRUCTIONS[roleId];
  if (base) return base;
  const role = roleById(roleId);
  const duties = role ? role.duties.slice(0, 3).join('・') : '担当業務';
  return `${duties}の観点から依頼に答えてください。`;
}

/** 依頼文から、この仕事に必要な道具を推定する。 */
export function detectNeeds(request = '') {
  const text = String(request);
  const needs = [];
  if (/検索|調べ|最新|相場|事例|ニュース|統計/.test(text)) needs.push('web');
  if (/https?:\/\//.test(text)) needs.push('webfetch');
  return needs;
}

/** 依頼文から短いタイトルを作る。 */
export function titleFor(request = '') {
  const t = String(request).replace(/\s+/g, ' ').trim();
  if (!t) return '無題の依頼';
  const cut = t.split(/[。．\n]/)[0];
  return (cut.length > 28 ? `${cut.slice(0, 28)}…` : cut) || '無題の依頼';
}
