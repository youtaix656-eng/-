// 会社のルール（新規）。
//
// これまで社員に読ませる「会社の決まり」は runtime.js に5行そのまま書いてあり、
// ユーザーは1行も足せなかった。自分の商売に合わせたルール——
// 「実体験を捏造しない」「商品情報は公式を優先」「1見出しは〇字まで」——を
// 置く場所が無いと、同じ直しを毎回依頼文に書き足すことになる。
//
// **消せない決まり（FIXED_RULES）は残す。** ここを編集できてしまうと、
// 「出典を書く」「断定を避ける」「最終判断は人間」という Ouro の前提を
// ユーザーが（意図せず）外せてしまう。足すことはできるが、外すことはできない。

/** どのルールより先に読ませる、消せない決まり。 */
export const FIXED_RULES = [
  '事実と推測を必ず分けて書く。分からないことは「未確認」と書く。',
  '情報を使ったら出典（媒体名・URL・日付）を最後に「出典：」として並べる。',
  '最終的な意思決定はオーナー（人間）が行う。あなたは調査・分析・提案までを担う。',
  '医療・法律・お金に関わる断定は避け、確認先を添える。',
  '日本語で答える。前置きの挨拶は書かない。',
  // 直すのは人ではなく成果物、という前提。差し戻し・反論・レビューの全部に効かせる。
  '人ではなく成果物を指す。直すべき箇所と直し方を必ず書き、書いた人の能力や人格には触れない。',
  // 端末内にしか置かないとはいえ、書き出しや CSV は外へ出る。
  'お客さんの氏名・電話・住所・メールなど、個人を特定できるものは書かない。呼び名だけを使う。',
];

export const RULE_FIELDS = [
  { key: 'purpose', label: '目的', hint: '例：鍼灸の知識で、腰痛に悩む人の役に立ちながら収入を作る' },
  { key: 'audience', label: '読み手・お客さん', hint: '例：40〜60代・腰痛歴が長い・病院で異常なしと言われた人' },
  { key: 'product', label: '扱うもの', hint: '例：施術／セルフケアのnote／記事作成の受注' },
  { key: 'tone', label: '書き方', hint: '例：難しい言葉を避ける。一般論で終わらせず、生活の場面を入れる' },
];

export function makeRules() {
  return {
    purpose: '',
    audience: '',
    product: '',
    tone: '',
    // 自分で足したルール（守らせたいこと）。使う→失敗→足す、で育てる。
    added: [],
    updatedAt: 0,
  };
}

/** 保存されている形が古くても落ちないようにそろえる。 */
export function normalizeRules(rules) {
  const base = makeRules();
  if (!rules || typeof rules !== 'object') return base;
  return {
    ...base,
    ...rules,
    added: Array.isArray(rules.added) ? rules.added.filter((x) => typeof x === 'string' && x.trim()) : [],
  };
}

export const MAX_ADDED = 40;
export const MAX_RULE_LEN = 120;

export function addRule(rules, text) {
  const r = normalizeRules(rules);
  const line = String(text || '').trim().slice(0, MAX_RULE_LEN);
  if (!line || r.added.includes(line)) return r;
  return { ...r, added: [...r.added, line].slice(-MAX_ADDED), updatedAt: Date.now() };
}

export function removeRule(rules, text) {
  const r = normalizeRules(rules);
  return { ...r, added: r.added.filter((x) => x !== text), updatedAt: Date.now() };
}

/**
 * 社員のプロンプトに入れる文。
 * **消せない決まりが必ず先**（あとから足したルールで上書きさせない）。
 */
export function rulesPrompt(rules) {
  const r = normalizeRules(rules);
  const lines = ['## 会社の決まり', ...FIXED_RULES.map((x) => `- ${x}`)];
  if (r.added.length) {
    lines.push('', '## この会社で必ず守ること（オーナーが決めたもの）', ...r.added.map((x) => `- ${x}`));
  }
  const about = [
    r.purpose ? `- 目的：${r.purpose}` : '',
    r.audience ? `- 読み手・お客さん：${r.audience}` : '',
    r.product ? `- 扱うもの：${r.product}` : '',
    r.tone ? `- 書き方：${r.tone}` : '',
  ].filter(Boolean);
  if (about.length) lines.push('', '## この会社について', ...about);
  return lines.join('\n');
}

/** ルールがどれくらい書けているか（最初の7日の道しるべで使う）。 */
export function rulesFilled(rules) {
  const r = normalizeRules(rules);
  return RULE_FIELDS.filter((f) => String(r[f.key] || '').trim()).length + (r.added.length ? 1 : 0);
}
