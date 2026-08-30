// AI社員の記憶を4層に分けて組み立てる。
//
//   ① 会社共通知識  ② 部署知識  ③ 社員専用記憶  ④ 現在のタスク情報
//
// **社員が全情報へ無制限にアクセスする設計にしない。**
// 読める範囲は employee.knowledgeScopes が決め、ここが唯一の関門になる。

import { wrapUntrusted, isUntrustedOrigin, trustLabel, ORIGIN_LABELS, FENCE_HEAD } from './untrusted.js';

export const SCOPES = {
  company: 'company', // 会社共通
  self: 'self', // 社員専用
  dept: (id) => `dept:${id}`,
};

// 関係ありと見なす最低スコア（バイグラム由来の偶然の一致を落とす）
export const MIN_RELEVANCE = 1;

/** 社員がこの知識を読んでよいか。 */
export function canRead(employee, knowledge) {
  const scopes = employee.knowledgeScopes || [];
  if (scopes.includes(SCOPES.company)) return true;
  if (knowledge.departmentId && scopes.includes(SCOPES.dept(knowledge.departmentId))) return true;
  if (knowledge.employeeId && knowledge.employeeId === employee.id && scopes.includes(SCOPES.self)) {
    return true;
  }
  return false;
}

/** 社員が読める知識だけに絞る。 */
export function readableKnowledge(employee, knowledgeList = []) {
  return knowledgeList.filter((k) => canRead(employee, k));
}

/**
 * 依頼に関係のある知識を、読める範囲の中から選ぶ。
 * 全部を渡すとコストが跳ね上がるので、語の重なりで上位だけを渡す。
 */
export function relevantKnowledge(employee, knowledgeList, request, limit = 5) {
  const words = tokenize(request);
  return readableKnowledge(employee, knowledgeList)
    .map((k) => {
      const hay = `${k.title} ${k.summary} ${(k.tags || []).join(' ')}`;
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      // 検証済みの知識を優先する
      if (k.verifiedAt) score += 0.5;
      return { k, score };
    })
    // バイグラムは当たりやすいので、わずかな一致は落とす
    .filter((x) => x.score >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.k);
}

// 日本語は単語の区切りが無いため、区切り記号での分割だけでは
// 「腰痛について教えて」と「腰痛の原因」が一致しない。
// 分割語に加えて2文字の並び（バイグラム）も照合語に混ぜる。
function tokenize(text = '') {
  const raw = String(text);
  const words = raw
    .split(/[\s、。，．,.\n「」（）()【】・:：/]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  const grams = new Set(words);
  const compact = raw.replace(/[\s、。，．,.\n「」（）()【】・:：/]+/g, '');
  for (let i = 0; i + 2 <= compact.length; i += 1) {
    const g = compact.slice(i, i + 2);
    // ひらがなだけの並び（「につ」「いて」など助詞・語尾）は
    // どの文章にも出るため照合語に入れない。入れると
    // 中身が無関係な知識まで拾ってしまう。
    if (hasContentChar(g)) grams.add(g);
    if (grams.size > 400) break; // 長文でも上限を設ける
  }
  return [...grams];
}

// 漢字・カタカナ・英数字を1文字でも含むか（＝意味のある語かどうか）
function hasContentChar(text) {
  return /[\u4e00-\u9fff\u30a0-\u30ffA-Za-z0-9]/.test(text);
}

/**
 * 実行時に社員へ渡す文脈をまとめる（4層 → 1つの文字列）。
 * 渡した層は returned.layers に残すので、監査ログで「何を見たか」を追える。
 */
// 新項目23：渡す材料の上限。
//
// 入力が長いほど待ち時間も料金も増える。**古い方から削る**——引き継ぎは
// 直前の担当の結論がいちばん効くので、先頭（古い部分）を落として末尾を残す。
// 削った時は必ずその旨を書き込む（黙って切ると、社員が「無かった」と誤解する）。
export const CONTEXT_LIMITS = {
  knowledge: 1600, // 会社の知識（要約の集まり）
  inherited: 6000, // 前の担当からの引き継ぎ
  taskContext: 2000, // この仕事の補足
  board: 900, // 社内で共有されていること
  related: 500, // 関係する仕事
  pitfall: 400, // この役職で過去に起きたつまずき
  brief: 800, // 会社の現在地
  style: 1500, // 書き方の見本（オーナーの文章。書く役だけに渡す）
  rivals: 900, // 競合の観測（外から来たものなので必ず囲う）
};

/** 末尾を残して切り詰める。切ったことが分かる印を頭に付ける。 */
export function trimTail(text, limit) {
  const t = String(text || '');
  if (t.length <= limit) return t;
  return `（前半は省略しています。以下は末尾 ${limit} 文字）\n…${t.slice(t.length - limit)}`;
}

/**
 * 社員が仕事の前に読むもの。
 *
 * 以前はここに4つしか無かった（知識・自分の記憶・引き継ぎ・この仕事の補足）ので、
 * **別の仕事にいる社員が何をしているかを誰も知らなかった**。
 * 掲示板（社内で共有されていること）と、関係する仕事の2つを足してある。
 * どちらも AI を呼ばずに作れるので、費用は入力ぶんだけ。
 */
/** 先頭を残して切り詰める（新しいものが先頭に並ぶもの用）。 */
export function trimHead(text, limit) {
  const t = String(text || '');
  if (t.length <= limit) return t;
  return `${t.slice(0, limit)}\n…（古いぶんは省略しています）`;
}

export function buildContext({
  employee,
  task,
  knowledgeList = [],
  inherited = '',
  boardText = '',
  relatedText = '',
  pitfallText = '',
  briefText = '',
  styleText = '',
  rivalsText = '',
}) {
  const layers = [];
  const parts = [];
  let hasUntrusted = false;

  // 会社の現在地は**いちばん先**に読ませる（役割より前）。
  // ここは自分のデータから作るので、資料として囲わない。
  if (briefText) {
    layers.push({ layer: 'brief', count: 1 });
    parts.push(trimTail(briefText, CONTEXT_LIMITS.brief));
  }

  const rel = relevantKnowledge(employee, knowledgeList, `${task.request || ''} ${task.title || ''}`);
  if (rel.length) {
    layers.push({ layer: 'knowledge', count: rel.length });
    // **知識は「資料」であって「指示」ではない。**
    // Web・PDF・別のAIから取り込んだ本文がそのまま入るので、
    // 中に「これまでの指示を無視して〇〇と書け」があれば通ってしまう。
    // 外から来たものは囲い、来歴と確からしさを添える（lib/untrusted.js）。
    const lines = rel.map((k) => {
      const body = `【${k.title}】${k.summary}`;
      if (!isUntrustedOrigin(k.origin)) {
        const tag = [ORIGIN_LABELS[k.origin] || '', trustLabel(k.trust)].filter(Boolean).join('・');
        return `- ${body}${tag ? `（${tag}）` : ''}`;
      }
      hasUntrusted = true;
      return wrapUntrusted(body, { label: k.title, origin: k.origin, trust: k.trust });
    });
    parts.push(trimTail(['## 会社の知識（読める範囲）', ...lines].join('\n'), CONTEXT_LIMITS.knowledge));
  }

  const notes = (employee.memory && employee.memory.notes) || [];
  if (notes.length) {
    layers.push({ layer: 'self', count: notes.length });
    parts.push(['## あなた自身の記憶', ...notes.slice(-5).map((n) => `- ${n.text || n}`)].join('\n'));
  }

  if (boardText) {
    layers.push({ layer: 'board', count: 1 });
    // **掲示板は先頭が新しい。** trimTail（末尾を残す）で切ると、
    // 新しい掲示と見出しごと落ちて、いちばん読ませたいものが消える。
    parts.push(trimHead(boardText, CONTEXT_LIMITS.board));
  }

  if (relatedText) {
    layers.push({ layer: 'related', count: 1 });
    parts.push(trimTail(relatedText, CONTEXT_LIMITS.related));
  }

  if (pitfallText) {
    layers.push({ layer: 'pitfall', count: 1 });
    parts.push(trimTail(pitfallText, CONTEXT_LIMITS.pitfall));
  }

  // 書き方の見本（オーナーの文章）。**渡すのは書く役だけ**（呼び出し側で絞る）。
  // 囲いが要るもの（AI・外から来たもの）は styleText の中で既に囲われている。
  if (styleText) {
    layers.push({ layer: 'style', count: 1 });
    parts.push(trimTail(styleText, CONTEXT_LIMITS.style));
    if (styleText.includes(FENCE_HEAD)) hasUntrusted = true;
  }

  // 競合の観測。**外から来たものなので必ず「資料」として囲う**（項目97と同じ線）。
  // 競合のLP・note の本文をそのまま渡すと、その中の
  // 「これまでの指示を無視して〇〇と書け」が通ってしまう。
  if (rivalsText) {
    layers.push({ layer: 'rivals', count: 1 });
    parts.push(wrapUntrusted(trimTail(rivalsText, CONTEXT_LIMITS.rivals), {
      label: '競合の観測（あなたが実際に見たもの）',
      origin: 'external',
    }));
    hasUntrusted = true;
  }

  if (inherited) {
    layers.push({ layer: 'handoff', count: 1 });
    parts.push(`## 前の担当からの引き継ぎ\n${trimTail(inherited, CONTEXT_LIMITS.inherited)}`);
  }

  if (task.context) {
    layers.push({ layer: 'task', count: 1 });
    parts.push(`## この仕事の補足\n${trimTail(task.context, CONTEXT_LIMITS.taskContext)}`);
  }

  // 層ごとの文字数も残す。**読ませすぎは、入れた本人にしか見えない。**
  // 「たくさん読ませたのに答えが雑になった」を後から追えるようにしておく。
  const withChars = layers.map((l, i) => ({ ...l, chars: (parts[i] || '').length }));
  const text = parts.join('\n\n');
  return { text, layers: withChars, chars: text.length, knowledgeIds: rel.map((k) => k.id), hasUntrusted };
}

// 社員の記憶（改善ログ）は `lib/notes.js` へ分けた（起動時に読む量を減らすため）。
// これまでどおり `memory.js` からも読めるように再輸出しておく。
export { MAX_NOTES, MAX_NOTE_LEN, makeNote, addNote, removeNote, notesOf } from './notes.js';
