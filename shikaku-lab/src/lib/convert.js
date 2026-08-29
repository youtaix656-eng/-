// 過去問 → AI変換。このアプリの芯。
//
// ■ このアプリは AI を呼ばない ──────────────────────────
// 出すのは「AIに貼るプロンプト」と「返ってきたものを受け取る口」だけ。理由は3つ。
//   ① APIキーを持たなくても、無料のチャットで今日から使える
//   ② 端末内保存の方針（storage.js がネットワークに触れない）を崩さずに済む
//   ③ 出てきたものを人が一度必ず読む工程が残る（医療・法令は誤りが致命的なので、
//      自動で取り込んで終わりにしない）
//
// ■ プロンプトに必ず入れること ────────────────────────
//   ・**検索できない時に出典（URL）を書かせない**。「※要確認」と印を付けさせる。
//     もっともらしいURLを作らせるのが、この手のプロンプトで一番危ない事故。
//   ・毎年変わる数値・法改正は「※要確認」を必ず付けさせる。
//   ・原問の選択肢（正・誤とも）と解説の要点を、派生問題のどこかで必ずカバーさせる。
//   ・答えと論点が互いに重ならないようにさせる（言い換えの重複を禁止する）。

import { examById, FORMAT_VOCABULARY } from '../data/exams.js';

/** 生成する角度。1つの過去問から、違う角度で複数の派生問題を作る */
export const ANGLES = [
  {
    id: 'core',
    label: 'A 核心',
    reading: 'えーかくしん',
    desc: '原問が問うている事実そのものを、端的な問いに直す',
    instruction: '原問の核心にある事実を、そのまま端的に問う。原問と同じ答えでよいが、問い方は短くする。',
  },
  {
    id: 'define',
    label: 'B 定義・逆引き',
    reading: 'びーていぎぎゃくびき',
    desc: '正解の語の意味・役割を問う（語→説明、または説明→語）',
    instruction: '正解になった語について、その意味・役割・定義を問う。語から説明を選ばせるか、説明から語を選ばせるかは、どちらかに決める。',
  },
  {
    id: 'distract',
    label: 'C 鑑別（誤答つぶし）',
    reading: 'しーかんべつ',
    desc: '誤答選択肢の「正しい内容」を問う＝ひっかけ対策',
    instruction: '原問の誤答選択肢を1つ選び、その語の“正しい内容”を問う。誤答をただ否定するのではなく、その語が本来何なのかが分かる問いにする。',
  },
  {
    id: 'check',
    label: 'D 確認（○×・数値）',
    reading: 'でぃーかくにん',
    desc: '○×で正誤を問う。数字・年齢区分・年号があればそこを問う',
    instruction: '○×形式で正誤を問う。原問に数字・年齢区分・年号・期限があれば、必ずその数値を問う問題にする。',
  },
  {
    id: 'apply',
    label: 'E 事例・応用',
    reading: 'いーじれいおうよう',
    desc: '短い場面を示し、知識を使わせる',
    instruction: '2〜3行の具体的な場面を示し、その場面で正しい判断・処置・扱いを選ばせる。知識をそのまま聞かず、使わせる。',
  },
  {
    id: 'compare',
    label: 'F 対比',
    reading: 'えふたいひ',
    desc: '紛らわしい2つを並べて見分けさせる',
    instruction: '原問の内容と紛らわしい別の概念を1つ挙げ、両者の違いが答えになる問いにする。どこが違うのかを解説に必ず書く。',
  },
];

export const ANGLE_MAP = Object.fromEntries(ANGLES.map((a) => [a.id, a]));

/** 出題形式ごとの、既定で選ばれる角度（人が変えられる） */
export const DEFAULT_ANGLES_BY_FORMAT = {
  choice: ['core', 'define', 'distract', 'check'],
  multi: ['core', 'distract', 'check', 'compare'],
  ox: ['core', 'define', 'check'],
  essay: ['core', 'define', 'apply'],
  practical: ['core', 'apply', 'check'],
  oral: ['core', 'apply', 'define'],
};

/** AIに守らせる決まり。**足せるが外せない**（外すと事故る所だけを置く） */
export const FIXED_PROMPT_RULES = [
  '確認できないことは書かない。あいまいなもの・古い可能性のあるものには必ず「※要確認」と付ける。',
  '**URLや出典を推測で書かない。** 検索していないなら「出典：未確認（要出典）」と書く。もっともらしいURLを作らない。',
  '毎年変わる数値（統計・金額・人数・合格基準）と、法改正が絡む内容には必ず「※要確認」を付ける。',
  '原問の各選択肢（正しいものも誤っているものも）と解説の要点を、作った問題のどこかで必ず1回はカバーする。',
  '作った問題どうしで、答えと論点を重複させない（言い換えただけの問題を作らない）。',
  '解説は出版社の文をそのまま写さず、要点を自分の言葉で書く。',
  '四択は選択肢4つで正解1つ。○×は選択肢2つ。指定した形式を崩さない。',
];

/**
 * 変換プロンプトを組み立てる。**AIを1回も呼ばない**（文字を並べるだけ）。
 *
 * @param {Object} opt
 *   examId       試験のid（省略可）
 *   examName     試験名（examId が無いときはこちらを使う）
 *   subject      科目名
 *   genre        ジャンル（大項目｜中項目 など。空でよい）
 *   format       出題形式（choice/multi/ox/essay/practical/oral）
 *   angles       生成する角度の id 配列
 *   choiceCount  選択肢の数（既定4）
 *   round        「第◯回」など。空でよい
 *   extraNotes   自由記述の追加指示
 *   withSourceCheck 出典の書き方の指示を入れるか（既定 true）
 */
export function buildConvertPrompt(opt = {}) {
  const exam = examById(opt.examId);
  const examName = exam?.name || opt.examName || '（試験名を入れてください）';
  const subject = opt.subject || '（科目名を入れてください）';
  const format = FORMAT_VOCABULARY[opt.format] ? opt.format : 'choice';
  const choiceCount = Math.max(2, Number(opt.choiceCount) || 4);
  const angleIds = (opt.angles && opt.angles.length ? opt.angles : DEFAULT_ANGLES_BY_FORMAT[format] || ['core']).filter(
    (id) => ANGLE_MAP[id],
  );
  const angles = angleIds.map((id) => ANGLE_MAP[id]);

  const lines = [];
  lines.push(`あなたは「${examName}」の受験対策の教材を作る担当です。`);
  lines.push('');
  lines.push('これから私が過去問（または教材の1問）を貼ります。それを次のとおり教材に変えてください。');
  lines.push('');
  lines.push('## 守ること（外さないでください）');
  for (const r of FIXED_PROMPT_RULES) lines.push(`- ${r}`);
  if (opt.withSourceCheck !== false) {
    lines.push('- 出典を書ける場合だけ書く。書けない場合は「出典：未確認（要出典）」とだけ書く。');
  }
  lines.push('');
  lines.push('## 前提');
  lines.push(`- 試験：${examName}`);
  lines.push(`- 科目：${subject}`);
  if (opt.genre) lines.push(`- ジャンル：${opt.genre}`);
  if (opt.round) lines.push(`- 回：${opt.round}`);
  lines.push(`- 出題形式：${FORMAT_VOCABULARY[format].label}（${FORMAT_VOCABULARY[format].hint}）`);
  if (exam?.traits?.length) {
    lines.push(`- この試験の性格：${exam.traits.join(' / ')}（この性格に効く問いを優先してください）`);
  }
  lines.push('');
  lines.push('## 作るもの（貼った過去問1問につき）');
  lines.push('1. **原問**：選択肢と正解は貼ったものに忠実に。解説だけを要点で書き直す。');
  lines.push(`2. **派生問題 ${angles.length}問**：下の角度でそれぞれ1問。答えと論点は互いに違うこと。`);
  for (const a of angles) lines.push(`   - **${a.label}**：${a.instruction}`);
  lines.push('');
  lines.push('角度で網羅しきれない要点が残った場合だけ、問題を足してかまいません（重複は作らないこと）。');
  lines.push('');
  lines.push('## キーワード');
  lines.push('- 各問に tags を2〜4個。**正式名称に統一**すること（略称や通称で書かない）。');
  lines.push('');
  lines.push('## 出力の形（この JSON だけを、コードブロックで返してください）');
  lines.push('```json');
  lines.push(sampleJson(subject, opt.genre || '', format, choiceCount));
  lines.push('```');
  lines.push('');
  lines.push('### 各項目の決まり');
  lines.push('- `type`：`choice`（選択式）か `ox`（○×）のどちらか。');
  lines.push(`- \`choices\`：choice なら${choiceCount}個、ox なら ["正しい","誤り"] の2個。`);
  lines.push('- `answer`：**0から数える**（1つ目の選択肢が正解なら 0）。');
  lines.push('- `explanation`：なぜそれが正解かと、誤答が誤りである理由を短く。');
  lines.push('- `angle`：`original`（原問）か、上の角度の記号（`core`/`define`/`distract`/`check`/`apply`/`compare`）。');
  lines.push('- `needsCheck`：内容に「※要確認」が付くものは true。');
  lines.push('');
  if (opt.extraNotes) {
    lines.push('## 追加の指示');
    lines.push(String(opt.extraNotes));
    lines.push('');
  }
  lines.push('準備ができたら「どうぞ」とだけ返してください。次の返信で過去問を貼ります。');
  return lines.join('\n');
}

function sampleJson(subject, genre, format, choiceCount) {
  const choices = Array.from({ length: choiceCount }, (_, i) => `"選択肢${i + 1}"`).join(', ');
  return [
    '[',
    '  {',
    `    "subject": ${JSON.stringify(subject)},`,
    `    "genre": ${JSON.stringify(genre)},`,
    '    "type": "choice",',
    '    "question": "問題文",',
    `    "choices": [${choices}],`,
    '    "answer": 0,',
    '    "explanation": "解説（要点を自分の言葉で）",',
    '    "tags": ["正式名称1", "正式名称2"],',
    '    "angle": "original",',
    '    "needsCheck": false',
    '  }',
    ']',
  ].join('\n');
}

/** 著作権まわりの注意（画面と設計書で同じ文を使う） */
export const COPYRIGHT_NOTE = [
  '過去問の問題文そのものは著作物です。**素の問題文を大量に公開の場所に置かない**でください。',
  'このアプリの保存先は端末の中だけなので、自分用に持つぶんには外へ出ません。',
  '書き出したものを配ったり公開したりする時は、原問を外して、自作の派生問題と自分の言葉の解説だけにしてください。',
];

// ── 受け取り（AIの返答を取り込む）──────────────────────

/** 取り込みで受け付ける最大の文字数（貼り付け事故で固まらないように） */
export const MAX_IMPORT_CHARS = 2 * 1024 * 1024;

/** コードブロックの囲みを外して JSON 本体を取り出す */
export function stripFence(text) {
  const s = String(text || '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fenced) return fenced[1].trim();
  return s;
}

/** 重複判定のための正規化（空白・記号・全角半角の揺れを吸収する） */
export function normalizeText(text) {
  return String(text || '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, '')
    .replace(/[、。，．・「」『』（）()【】\[\]:：;；?？!！~〜\-ー―—_]/g, '')
    .toLowerCase();
}

/** 1問の検査。**問題があれば理由を日本語で返す**（黙って捨てない） */
export function validateQuestion(q, index = 0) {
  const where = `${index + 1}問目`;
  const errors = [];
  if (!q || typeof q !== 'object') return [`${where}：オブジェクトではありません`];
  const type = q.type === 'ox' ? 'ox' : q.type === 'choice' ? 'choice' : null;
  if (!type) errors.push(`${where}：type が choice でも ox でもありません（${q.type}）`);
  if (!String(q.question || '').trim()) errors.push(`${where}：question が空です`);
  if (!Array.isArray(q.choices)) {
    errors.push(`${where}：choices が配列ではありません`);
  } else {
    if (type === 'ox' && q.choices.length !== 2) errors.push(`${where}：○×なのに選択肢が${q.choices.length}個です`);
    if (type === 'choice' && q.choices.length < 2) errors.push(`${where}：選択肢が${q.choices.length}個しかありません`);
    if (q.choices.some((c) => !String(c ?? '').trim())) errors.push(`${where}：空の選択肢があります`);
  }
  const answer = Number(q.answer);
  if (!Number.isInteger(answer)) {
    errors.push(`${where}：answer が整数ではありません（${q.answer}）`);
  } else if (Array.isArray(q.choices) && (answer < 0 || answer >= q.choices.length)) {
    // 1始まりで書かれた事故がいちばん多いので、そう見えるときは理由に書く
    const hint = answer === q.choices.length ? '（1から数えていませんか。0から数えます）' : '';
    errors.push(`${where}：answer が選択肢の範囲外です（${answer}）${hint}`);
  }
  if (!String(q.explanation || '').trim()) errors.push(`${where}：explanation が空です`);
  return errors;
}

/**
 * 取り込みの本体。
 * @returns {{ ok:boolean, items:Array, errors:string[], skipped:number }}
 *   errors があっても、通った問題は items に入る（全部を捨てない）。
 */
export function parseImported(text, context = {}) {
  const raw = String(text || '');
  if (raw.length > MAX_IMPORT_CHARS) {
    return { ok: false, items: [], errors: [`長すぎます（${MAX_IMPORT_CHARS}文字まで）`], skipped: 0 };
  }
  const body = stripFence(raw);
  if (!body) return { ok: false, items: [], errors: ['何も貼られていません'], skipped: 0 };

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    return {
      ok: false,
      items: [],
      errors: ['JSON として読めませんでした。AIの返答のうち、[ で始まり ] で終わる部分だけを貼ってください。'],
      skipped: 0,
    };
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const items = [];
  const errors = [];
  let skipped = 0;
  list.forEach((q, i) => {
    const errs = validateQuestion(q, i);
    if (errs.length > 0) {
      errors.push(...errs);
      skipped += 1;
      return;
    }
    items.push(makeQuestion(q, context));
  });
  return { ok: items.length > 0, items, errors, skipped };
}

let seq = 0;

/** 保存する形に整える。id はここでだけ作る */
export function makeQuestion(q, context = {}) {
  seq += 1;
  return {
    id: `q_${Date.now().toString(36)}_${seq.toString(36)}`,
    examId: context.examId || q.examId || null,
    subject: String(q.subject || context.subject || '').trim(),
    genre: String(q.genre || context.genre || '').trim(),
    type: q.type === 'ox' ? 'ox' : 'choice',
    question: String(q.question).trim(),
    choices: q.choices.map((c) => String(c).trim()),
    answer: Number(q.answer),
    explanation: String(q.explanation).trim(),
    tags: Array.isArray(q.tags) ? q.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    angle: String(q.angle || 'original'),
    needsCheck: q.needsCheck === true,
    round: q.round != null ? String(q.round) : context.round || '',
    createdAt: Date.now(),
  };
}

/**
 * すでにある問題と重複しないものだけを返す。
 * 判定は問題文の正規化一致（鍼灸アプリの dedupeAgainst と同じ考え方）。
 * @returns {{ fresh:Array, duplicates:Array }}
 */
export function dedupeAgainst(existing = [], incoming = []) {
  const seen = new Set(existing.map((q) => normalizeText(q.question)));
  const fresh = [];
  const duplicates = [];
  for (const q of incoming) {
    const key = normalizeText(q.question);
    if (seen.has(key)) {
      duplicates.push(q);
      continue;
    }
    seen.add(key);
    fresh.push(q);
  }
  return { fresh, duplicates };
}

/**
 * 取り込んだあとの必須チェック（鍼灸アプリの「問題作成後の必須チェック」と同じ観点）。
 * **合格・不合格を出すのではなく、人が見る場所を指す。**
 */
export function reviewChecklist(items = []) {
  const needsCheck = items.filter((q) => q.needsCheck);
  const noTags = items.filter((q) => (q.tags || []).length === 0);
  const shortExp = items.filter((q) => (q.explanation || '').length < 20);
  const answerAtEnd = items.filter((q) => q.answer === q.choices.length - 1);
  const rows = [
    { id: 'needsCheck', label: '「※要確認」が付いた問題', count: needsCheck.length, note: '数値・法改正は公式で確かめてから使う' },
    { id: 'noTags', label: 'キーワードが空の問題', count: noTags.length, note: '検索・目次から見つけられなくなる' },
    { id: 'shortExp', label: '解説が20字未満の問題', count: shortExp.length, note: '間違えた時に戻る場所が無い' },
    {
      id: 'answerLast',
      label: '正解が最後の選択肢の問題',
      count: answerAtEnd.length,
      note: `全${items.length}問中。偏っていたら 0/1 始まりの取り違えを疑う`,
    },
  ];
  return rows;
}

/** 書き出し（自分で作ったアプリに食べさせる形） */
export function exportJson(items = []) {
  return JSON.stringify(items, null, 2);
}
