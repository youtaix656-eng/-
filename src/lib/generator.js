// 問題の自動生成
//
// 方式は2系統:
//  (A) 構造化ナレッジベース（KB）× テンプレートによる生成
//      → 正解が KB から一意に定まるため、機械的に正しい問題を量産できる。
//  (B) 既存問題の変形（○×ドリル化など）
//
// いずれも「生成された下書き」であり、出題プールに入れる前に人の承認を前提とする。
// 生成物には meta 情報（generated / source / confidence）を付与する。

import {
  meridians,
  yuanPoints,
  fourCommandPoints,
  wuxingSheng,
  wuxingKe,
  wuxingElements,
  zangTable,
  meridianById,
} from '../data/knowledgeBase.js';

// ---- ユーティリティ ----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n, exclude = []) {
  const pool = arr.filter((x) => !exclude.includes(x));
  return shuffle(pool).slice(0, n);
}
let genSeq = 0;
function genId() {
  genSeq += 1;
  return `gen-${Date.now().toString(36)}-${genSeq}`;
}

// choices（正解を含む配列）から、正解をシャッフル配置した問題を作る
function assemble({ subject, question, correct, distractors, explanation, tags }) {
  const choicesRaw = [correct, ...distractors];
  const shuffled = shuffle(choicesRaw);
  const answer = shuffled.indexOf(correct);
  return {
    id: genId(),
    subject,
    type: 'choice',
    question,
    choices: shuffled,
    answer,
    explanation,
    generated: true,
    source: 'kb-template',
    confidence: 'high',
    tags: tags || [],
  };
}

const SRC_NOTE = '（出典：経絡経穴概論／東洋医学概論。監修前の自動生成問題です）';

// ---- (A) KBテンプレート生成 ----

// 経穴 → 属する経絡
function genPointToMeridian() {
  const m = meridians[Math.floor(Math.random() * meridians.length)];
  const point = yuanPoints[m.id];
  const distractors = sample(
    meridians.map((x) => x.name),
    3,
    [m.name]
  );
  return assemble({
    subject: '経絡経穴概論',
    question: `原穴「${point}」が属する経絡はどれか。`,
    correct: m.name,
    distractors,
    explanation: `${point} は${m.name}の原穴である。${SRC_NOTE}`,
    tags: ['原穴', '経絡'],
  });
}

// 経絡 → 原穴
function genMeridianToYuan() {
  const m = meridians[Math.floor(Math.random() * meridians.length)];
  const correct = yuanPoints[m.id];
  const others = Object.values(yuanPoints);
  const distractors = sample(others, 3, [correct]);
  return assemble({
    subject: '経絡経穴概論',
    question: `${m.name}の原穴はどれか。`,
    correct,
    distractors,
    explanation: `${m.name}の原穴は「${correct}」である。${SRC_NOTE}`,
    tags: ['原穴'],
  });
}

// 四総穴
function genFourCommand() {
  const f = fourCommandPoints[Math.floor(Math.random() * fourCommandPoints.length)];
  const otherPoints = fourCommandPoints.map((x) => x.point);
  const extra = Object.values(yuanPoints);
  const distractors = sample([...otherPoints, ...extra], 3, [f.point]);
  return assemble({
    subject: '経絡経穴概論',
    question: `四総穴において「${f.area}」の症状に用いる経穴はどれか。`,
    correct: f.point,
    distractors,
    explanation: `四総穴では「${f.area}」に${f.point}を用いる（肚腹は三里に留め、腰背は委中に求め、頭項は列缺に尋ね、面口は合谷に収む）。${SRC_NOTE}`,
    tags: ['四総穴'],
  });
}

// 五行 相生
function genSheng() {
  const [a, b] = wuxingSheng[Math.floor(Math.random() * wuxingSheng.length)];
  const distractors = sample(wuxingElements, 3, [b]);
  return assemble({
    subject: '東洋医学概論',
    question: `五行の相生関係で「${a}」が生じる（生む）のはどれか。`,
    correct: b,
    distractors,
    explanation: `相生は「木→火→土→金→水→木」。${a}は${b}を生じる。${SRC_NOTE}`,
    tags: ['五行', '相生'],
  });
}

// 五行 相剋
function genKe() {
  const [a, b] = wuxingKe[Math.floor(Math.random() * wuxingKe.length)];
  const distractors = sample(wuxingElements, 3, [b]);
  return assemble({
    subject: '東洋医学概論',
    question: `五行の相剋関係で「${a}」が剋す（抑える）のはどれか。`,
    correct: b,
    distractors,
    explanation: `相剋は「木剋土・土剋水・水剋火・火剋金・金剋木」。${a}は${b}を剋す。${SRC_NOTE}`,
    tags: ['五行', '相剋'],
  });
}

// 五臓 → 五行
function genZangElement() {
  const z = zangTable[Math.floor(Math.random() * zangTable.length)];
  const distractors = sample(wuxingElements, 3, [z.element]);
  return assemble({
    subject: '東洋医学概論',
    question: `五臓のうち「${z.zang}」が配当される五行はどれか。`,
    correct: z.element,
    distractors,
    explanation: `${z.zang}は五行の「${z.element}」に属する。${SRC_NOTE}`,
    tags: ['五行', '五臓'],
  });
}

// 五臓色体表（五主・五官・五志・五色）
function genZangTable() {
  const z = zangTable[Math.floor(Math.random() * zangTable.length)];
  const fields = [
    { key: 'tai', label: '五主（五体）', all: zangTable.map((x) => x.tai) },
    { key: 'kan', label: '五官', all: zangTable.map((x) => x.kan) },
    { key: 'shi', label: '五志', all: zangTable.map((x) => x.shi) },
    { key: 'shiki', label: '五色', all: zangTable.map((x) => x.shiki) },
  ];
  const f = fields[Math.floor(Math.random() * fields.length)];
  const correct = z[f.key];
  const distractors = sample(f.all, 3, [correct]);
  return assemble({
    subject: '東洋医学概論',
    question: `五臓色体表で「${z.zang}」に配当される${f.label}はどれか。`,
    correct,
    distractors,
    explanation: `${z.zang}の${f.label}は「${correct}」である。${SRC_NOTE}`,
    tags: ['五臓色体表'],
  });
}

export const GENERATORS = {
  pointToMeridian: { label: '経穴→経絡', fn: genPointToMeridian },
  meridianToYuan: { label: '経絡→原穴', fn: genMeridianToYuan },
  fourCommand: { label: '四総穴', fn: genFourCommand },
  sheng: { label: '五行・相生', fn: genSheng },
  ke: { label: '五行・相剋', fn: genKe },
  zangElement: { label: '五臓→五行', fn: genZangElement },
  zangTable: { label: '五臓色体表', fn: genZangTable },
};

// 指定タイプから count 問を生成し、重複問題文を避ける
export function generateQuestions({ types, count = 10 } = {}) {
  const active = (types && types.length ? types : Object.keys(GENERATORS)).filter(
    (t) => GENERATORS[t]
  );
  if (active.length === 0) return [];
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < count && guard < count * 30) {
    guard += 1;
    const t = active[Math.floor(Math.random() * active.length)];
    const q = GENERATORS[t].fn();
    const key = q.question + '::' + q.choices[q.answer];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

// ---- (B) 既存問題の変形（○×ドリル化） ----
// 四択問題から「答えは〜である」という ○×問題を作る（正誤どちらも生成しうる）。
export function makeOxVariant(q, makeTrue = Math.random() < 0.5) {
  if (!q || !Array.isArray(q.choices) || q.type !== 'choice') return null;
  const correct = q.choices[q.answer];
  const wrongs = q.choices.filter((_, i) => i !== q.answer);
  if (wrongs.length === 0) return null;
  const shown = makeTrue ? correct : wrongs[Math.floor(Math.random() * wrongs.length)];
  const base = q.question.replace(/(はどれか|のはどれか)。?$/, '');
  return {
    id: genId(),
    subject: q.subject,
    type: 'ox',
    question: `${q.question}\n→「${shown}」は正しい。`,
    choices: ['○（正しい）', '×（誤り）'],
    answer: makeTrue ? 0 : 1,
    explanation:
      (makeTrue ? `正しい。` : `誤り。正解は「${correct}」。`) +
      (q.explanation ? ` ${q.explanation}` : ''),
    generated: true,
    source: 'variant-ox',
    confidence: 'derived',
    tags: ['変形', '○×'],
    _base: base,
  };
}

export function generateVariants(questions, { perQuestion = 1 } = {}) {
  const out = [];
  questions
    .filter((q) => q.type === 'choice')
    .forEach((q) => {
      for (let i = 0; i < perQuestion; i++) {
        const v = makeOxVariant(q, i % 2 === 0);
        if (v) out.push(v);
      }
    });
  return out;
}
