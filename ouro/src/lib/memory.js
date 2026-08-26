// AI社員の記憶を4層に分けて組み立てる。
//
//   ① 会社共通知識  ② 部署知識  ③ 社員専用記憶  ④ 現在のタスク情報
//
// **社員が全情報へ無制限にアクセスする設計にしない。**
// 読める範囲は employee.knowledgeScopes が決め、ここが唯一の関門になる。

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
};

/** 末尾を残して切り詰める。切ったことが分かる印を頭に付ける。 */
export function trimTail(text, limit) {
  const t = String(text || '');
  if (t.length <= limit) return t;
  return `（前半は省略しています。以下は末尾 ${limit} 文字）\n…${t.slice(t.length - limit)}`;
}

export function buildContext({ employee, task, knowledgeList = [], inherited = '' }) {
  const layers = [];
  const parts = [];

  const rel = relevantKnowledge(employee, knowledgeList, `${task.request || ''} ${task.title || ''}`);
  if (rel.length) {
    layers.push({ layer: 'knowledge', count: rel.length });
    parts.push(
      trimTail(
        ['## 会社の知識（読める範囲）', ...rel.map((k) => `- 【${k.title}】${k.summary}`)].join('\n'),
        CONTEXT_LIMITS.knowledge
      )
    );
  }

  const notes = (employee.memory && employee.memory.notes) || [];
  if (notes.length) {
    layers.push({ layer: 'self', count: notes.length });
    parts.push(['## あなた自身の記憶', ...notes.slice(-5).map((n) => `- ${n.text || n}`)].join('\n'));
  }

  if (inherited) {
    layers.push({ layer: 'handoff', count: 1 });
    parts.push(`## 前の担当からの引き継ぎ\n${trimTail(inherited, CONTEXT_LIMITS.inherited)}`);
  }

  if (task.context) {
    layers.push({ layer: 'task', count: 1 });
    parts.push(`## この仕事の補足\n${trimTail(task.context, CONTEXT_LIMITS.taskContext)}`);
  }

  return { text: parts.join('\n\n'), layers, knowledgeIds: rel.map((k) => k.id) };
}

// ── 社員を育てる（改善ログ）──
//
// **ここは長いあいだ「読むだけ」だった。** buildContext は memory.notes を
// 読んでいるのに、書き込む場所がコードのどこにも無く、いつも空のままだった。
// 「①ミス → ②ルール化 → ③次回改善」を回すには、書く側が要る。
//
// 会社全体の決まりは lib/rules.js（company.rules）、
// **この社員にだけ効かせたいこと**はここ、と分ける。

export const MAX_NOTES = 20;
export const MAX_NOTE_LEN = 120;

export function makeNote(text, taskId = null) {
  return {
    id: `note_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    text: String(text || '').trim().slice(0, MAX_NOTE_LEN),
    at: Date.now(),
    taskId,
  };
}

/** 社員の記憶に1行足した結果を返す（社員そのものは変えない）。 */
export function addNote(employee, text, taskId = null) {
  const note = makeNote(text, taskId);
  if (!note.text) return notesOf(employee);
  const cur = notesOf(employee).filter((n) => (n.text || n) !== note.text);
  // 古いものから落とす。プロンプトに入るのは末尾5件（buildContext）。
  return [...cur, note].slice(-MAX_NOTES);
}

export function removeNote(employee, noteId) {
  return notesOf(employee).filter((n) => n.id !== noteId);
}

export function notesOf(employee) {
  const notes = (employee && employee.memory && employee.memory.notes) || [];
  // 古い形（ただの文字列）にも id を付けて返すが、**呼ぶたびに変えてはいけない**。
  // 変わると「忘れさせる」が一致せず何も起きないし、画面も毎回描き直しになる。
  // 位置と中身から決まる id にする。
  return notes.filter(Boolean).map((n, i) => (typeof n === 'string' ? { id: `legacy_${i}`, text: n, at: 0, taskId: null } : n));
}
