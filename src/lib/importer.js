// 問題データのインポート（CSV / JSON）
//
// 対応項目：科目, 問題文, 選択肢, 正解, 解説
//
// CSV 仕様:
//   - 1行目はヘッダー（科目,問題文,選択肢,正解,解説）。日本語・英語どちらの
//     ヘッダー名にもある程度対応する。
//   - 選択肢は「|」（半角パイプ）区切りで複数記述する。
//       例: 手の陽明大腸経|手の太陰肺経|手の少陰心経|手の厥陰心包経
//   - 選択肢が空欄の場合は ○×（正誤）問題として扱い、
//     選択肢は自動的に「○（正しい）／×（誤り）」になる。
//   - 正解の指定方法:
//       四択: 1始まりの番号（1〜4）または 選択肢の文字列そのもの
//       ○×  : ○ / × / 正しい / 誤り / 正 / 誤 / true / false / 1 / 2 など
//
// JSON 仕様:
//   配列。各要素は上記項目のオブジェクト（日本語キー / 英語キーどちらも可）。
//   すでに choices 配列・answer(index) 形式に整形済みのものもそのまま読める。

const OX_CHOICES = ['○（正しい）', '×（誤り）'];

function normalizeKey(obj, candidates) {
  for (const key of candidates) {
    if (obj[key] != null && String(obj[key]).trim() !== '') return String(obj[key]);
    // 前後の空白を除いたキー一致も許容
    const found = Object.keys(obj).find((k) => k.trim() === key);
    if (found && obj[found] != null) return String(obj[found]);
  }
  return '';
}

// ○×の正解表記を index(0=○, 1=×) に変換。判別不能なら -1。
function parseOxAnswer(raw) {
  const v = String(raw).trim().toLowerCase();
  if (['○', 'o', '◯', '正', '正しい', 'true', '1', '○（正しい）', 'まる'].includes(v)) return 0;
  if (['×', 'x', '✕', '誤', '誤り', 'false', '2', '0', '×（誤り）', 'ばつ'].includes(v)) return 1;
  return -1;
}

// 四択の正解表記を index に変換。判別不能なら -1。
function parseChoiceAnswer(raw, choices) {
  const v = String(raw).trim();
  // 番号指定（1始まり）
  const num = Number(v);
  if (v !== '' && Number.isInteger(num) && num >= 1 && num <= choices.length) return num - 1;
  // 文字列一致
  const idx = choices.findIndex((c) => c.trim() === v);
  if (idx >= 0) return idx;
  // ア/イ/ウ/エ, a/b/c/d 表記
  const map = { ア: 0, イ: 1, ウ: 2, エ: 3, a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 };
  if (v in map && map[v] < choices.length) return map[v];
  return -1;
}

let autoId = 0;
function makeId() {
  autoId += 1;
  return `imp-${Date.now().toString(36)}-${autoId}`;
}

// 汎用の1レコード → { question, warnings }。取り込み不能なら { error }。
function recordToQuestion(rec) {
  const warnings = [];
  const subject = normalizeKey(rec, ['科目', 'subject', 'Subject']) || 'その他';
  const question = normalizeKey(rec, ['問題文', 'question', 'Question', '問題']);
  const image = normalizeKey(rec, ['画像', 'image', 'Image', '画像URL', 'imageUrl']);
  if (!question && !image) return { error: '問題文が空です。' };
  const explanation = normalizeKey(rec, ['解説', 'explanation', 'Explanation', '説明']);

  // すでに choices が配列で来ている場合（JSON）
  let choices = null;
  if (Array.isArray(rec.choices)) {
    choices = rec.choices.map((c) => String(c).trim()).filter(Boolean);
  } else {
    const raw = normalizeKey(rec, ['選択肢', 'choices', 'Choices']);
    if (raw.trim()) {
      choices = raw
        .split(/\s*[|｜]\s*/) // 半角/全角パイプ区切り
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }

  const answerRaw = normalizeKey(rec, ['正解', 'answer', 'Answer', '解答']);

  let type, answer;
  if (!choices || choices.length < 2) {
    // ○×問題
    if (choices && choices.length === 1) {
      warnings.push('選択肢が1つだけのため ○× 問題として扱いました。');
    }
    type = 'ox';
    choices = OX_CHOICES;
    if (typeof rec.answer === 'number') {
      answer = rec.answer === 0 ? 0 : 1;
    } else {
      answer = parseOxAnswer(answerRaw);
      if (answer < 0) {
        warnings.push(`正解「${answerRaw}」を判別できず ○（正しい）と仮定しました。`);
        answer = 0;
      }
    }
  } else {
    type = 'choice';
    if (typeof rec.answer === 'number') {
      if (rec.answer >= 0 && rec.answer < choices.length) {
        answer = rec.answer;
      } else {
        warnings.push(`正解番号 ${rec.answer} が選択肢の範囲外です。1番目を仮の正解にしました。`);
        answer = 0;
      }
    } else {
      answer = parseChoiceAnswer(answerRaw, choices);
      if (answer < 0) {
        // 数字だが範囲外なのか、そもそも一致しないのかを区別して警告する
        const asNum = Number(String(answerRaw).trim());
        if (String(answerRaw).trim() !== '' && Number.isInteger(asNum)) {
          warnings.push(
            `正解番号 ${answerRaw} が選択肢の範囲外です（1〜${choices.length}）。1番目を仮の正解にしました。`
          );
        } else {
          warnings.push(`正解「${answerRaw}」が選択肢と一致しません。1番目を仮の正解にしました。`);
        }
        answer = 0;
      }
    }
    if (choices.length > 5) {
      warnings.push(`選択肢が${choices.length}個あります（国試は通常5択まで）。`);
    }
  }

  if (!explanation) warnings.push('解説が空です。');

  // 任意項目：回次（第何回）・ジャンル/タグ・ファイル（デッキ）
  const round = normalizeKey(rec, ['回', '回次', '出題回', 'round', 'Round']);
  const deck = normalizeKey(rec, ['ファイル', 'デッキ', 'deck', 'Deck', 'file']);
  let tags = [];
  if (Array.isArray(rec.tags)) {
    tags = rec.tags.map((t) => String(t).trim()).filter(Boolean);
  } else {
    const rawTags = normalizeKey(rec, ['ジャンル', 'タグ', 'tags', 'Tags', 'genre']);
    if (rawTags.trim()) {
      tags = rawTags.split(/\s*[|｜,、]\s*/).map((t) => t.trim()).filter(Boolean);
    }
  }

  const q = {
    id: rec.id ? String(rec.id) : makeId(),
    subject,
    type,
    question,
    choices,
    answer,
    explanation,
  };
  if (image) q.image = image;
  if (round) q.round = round;
  if (tags.length) q.tags = tags;
  if (deck) q.deck = deck;
  return { question: q, warnings };
}

// ---- CSV パーサ（引用符・改行・カンマのエスケープ対応の簡易実装） ----
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // 先頭の BOM（Excel 等が付与）を除去してから解析する
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // 末尾
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// 取り込んだ問題群の妥当性チェック（ID重複など）
function collectGlobalWarnings(questions) {
  const warnings = [];
  const ids = new Map();
  questions.forEach((q, i) => {
    if (ids.has(q.id)) {
      warnings.push(`ID「${q.id}」が重複しています。`);
    }
    ids.set(q.id, i);
  });
  return warnings;
}

export function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { questions: [], errors: ['データが空です。'], warnings: [] };

  const header = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);
  const errors = [];
  const warnings = [];
  const questions = [];

  dataRows.forEach((cols, idx) => {
    const rec = {};
    header.forEach((h, i) => {
      rec[h] = cols[i] != null ? cols[i] : '';
    });
    const res = recordToQuestion(rec);
    if (res.question) {
      questions.push(res.question);
      res.warnings.forEach((w) => warnings.push(`${idx + 2}行目: ${w}`));
    } else {
      errors.push(`${idx + 2}行目: ${res.error || '取り込めませんでした。'}`);
    }
  });

  return { questions, errors, warnings: [...warnings, ...collectGlobalWarnings(questions)] };
}

export function importJson(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/^﻿/, '')); // 先頭 BOM を除去
  } catch (e) {
    return { questions: [], errors: ['JSONの解析に失敗しました: ' + e.message], warnings: [] };
  }
  const arr = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : null;
  if (!arr) return { questions: [], errors: ['配列形式のJSONを指定してください。'], warnings: [] };

  const errors = [];
  const warnings = [];
  const questions = [];
  arr.forEach((rec, idx) => {
    const res = recordToQuestion(rec);
    if (res.question) {
      questions.push(res.question);
      res.warnings.forEach((w) => warnings.push(`${idx + 1}番目: ${w}`));
    } else {
      errors.push(`${idx + 1}番目: ${res.error || '取り込めませんでした。'}`);
    }
  });
  return { questions, errors, warnings: [...warnings, ...collectGlobalWarnings(questions)] };
}

// ファイル内容と名前からフォーマットを判定して取り込む
export function importFile(text, fileName = '') {
  const name = fileName.toLowerCase();
  if (name.endsWith('.json')) return importJson(text);
  if (name.endsWith('.csv')) return importCsv(text);
  // 拡張子不明の場合は中身から推定
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return importJson(text);
  return importCsv(text);
}

// エクスポート用（バックアップ）: 現在の問題を JSON 文字列に
export function exportJson(questions) {
  return JSON.stringify(questions, null, 2);
}

// エクスポート用: CSV 文字列に
export function exportCsv(questions) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // 使われている任意項目だけ列を追加する
  const hasImage = questions.some((q) => q.image);
  const hasRound = questions.some((q) => q.round);
  const hasTags = questions.some((q) => q.tags && q.tags.length);
  const hasDeck = questions.some((q) => q.deck);
  const headerCols = ['科目', '問題文', '選択肢', '正解', '解説'];
  if (hasImage) headerCols.push('画像');
  if (hasRound) headerCols.push('回');
  if (hasTags) headerCols.push('ジャンル');
  if (hasDeck) headerCols.push('ファイル');
  const lines = [headerCols.join(',')];
  questions.forEach((q) => {
    const choices = q.type === 'ox' ? '' : q.choices.join('|');
    const answer = q.type === 'ox' ? (q.answer === 0 ? '○' : '×') : q.answer + 1;
    const row = [q.subject, q.question, choices, answer, q.explanation];
    if (hasImage) row.push(q.image || '');
    if (hasRound) row.push(q.round || '');
    if (hasTags) row.push((q.tags || []).join('|'));
    if (hasDeck) row.push(q.deck || '');
    lines.push(row.map(esc).join(','));
  });
  return lines.join('\n');
}
