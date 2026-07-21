// 自由文（本のOCR・PDF抽出・ネットからコピーした文章）を問題に自動構造化する。
//
// 対応する主な書式:
//   問1 / 問題1 / Q1 / 第1問 / 【1】 …で問題を区切る
//   選択肢: 1. / 1) / 1、 / (1) / ① / ア. / a) など
//   正解:   「正解 3」「答え：③」「解答 ア」など
//   解説:   「解説 …」
//
// あくまで下処理のため、結果はプレビュー画面で人が確認・修正して確定する前提。

// 全角英数・記号を半角へ寄せる（判定を安定させる）
function toHalf(s) {
  return String(s)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[）]/g, ')')
    .replace(/[（]/g, '(')
    .replace(/[：]/g, ':')
    .replace(/[　]/g, ' ');
}

// マーカー文字 → 0始まりインデックス。判別不能は -1。
export function markerToIndex(m) {
  const s = toHalf(String(m).trim()).replace(/[().\)、:\s]/g, '');
  if (/^[1-9]$/.test(s)) return Number(s) - 1;
  const code = s.codePointAt(0);
  if (code >= 0x2460 && code <= 0x2473) return code - 0x2460; // ①..⑳
  const kata = 'アイウエオカキクケコ';
  if (kata.includes(s)) return kata.indexOf(s);
  if (/^[a-j]$/i.test(s)) return s.toLowerCase().charCodeAt(0) - 97;
  return -1;
}

// 選択肢行の判定: 先頭のマーカー(m[1])＋本文(m[2])
// 数字は「1.」「1)」「1、」に加え、「1 火」のようにスペース区切りも許容。
const CHOICE_RE =
  /^\s*(\(?[1-9]\)?[.\)、:]|\(?[1-9]\)?(?=\s)|[①-⑳]|[ア-オ][.\)、:]|[a-eA-E][.\)])\s*(.+)$/;

// 正解行
const ANSWER_RE = /^\s*(?:正解|正答|解答|答え|Answer)\s*[:：]?\s*(.+?)\s*$/i;
// 解説行（以降を解説とみなす）
const EXPL_RE = /^\s*(?:解説|解答解説|Explanation)\s*[:：]?\s*(.*)$/i;
// 問題ヘッダ
const HEADER_SPLIT = /(?=^\s*(?:問題|問|設問|Q|第)\s*[0-9０-９]+)/gm;
const HEADER_STRIP = /^\s*(?:問題|問|設問|Q|第)\s*[0-9０-９]+\s*問?\s*[.:：、)]?\s*/;

function splitBlocks(text) {
  let blocks = text
    .split(HEADER_SPLIT)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length >= 2) return blocks;

  // ヘッダが無い場合: 選択肢番号が「1」に戻ったら新しい問題とみなして分割
  const lines = text.split('\n');
  const out = [];
  let cur = [];
  let seenChoice = false;
  for (const line of lines) {
    const m = line.match(CHOICE_RE);
    const idx = m ? markerToIndex(m[1] || m[2] || m[3] || m[4]) : -1;
    if (m && idx === 0 && seenChoice && cur.some((l) => CHOICE_RE.test(l))) {
      // すでに選択肢を含むブロックの後で「1」が来た → 直前の非選択肢行から新問開始
      // 直近の見出し行（非選択肢）を新ブロックへ移す
      let splitAt = cur.length - 1;
      while (splitAt >= 0 && CHOICE_RE.test(cur[splitAt])) splitAt--;
      const next = cur.splice(splitAt < 0 ? cur.length : splitAt);
      if (cur.length) out.push(cur.join('\n'));
      cur = next;
      seenChoice = false;
    }
    cur.push(line);
    if (m) seenChoice = true;
  }
  if (cur.length) out.push(cur.join('\n'));
  return out.map((b) => b.trim()).filter(Boolean);
}

let seq = 0;
function pid() {
  seq += 1;
  return `ft-${Date.now().toString(36)}-${seq}`;
}

function parseBlock(block) {
  const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  const stem = [];
  const choices = [];
  let answerRaw = null;
  let explanation = '';
  let inExpl = false;

  rawLines.forEach((line0, i) => {
    let line = line0;
    if (i === 0) line = line.replace(HEADER_STRIP, ''); // 先頭の「問1」等を除去
    if (!line) return;

    if (inExpl) {
      explanation += (explanation ? '\n' : '') + line;
      return;
    }
    const em = line.match(EXPL_RE);
    if (em) {
      inExpl = true;
      explanation = em[1] || '';
      return;
    }
    const am = line.match(ANSWER_RE);
    if (am && choices.length > 0) {
      answerRaw = am[1];
      return;
    }
    const cm = line.match(CHOICE_RE);
    if (cm) {
      choices.push(cm[2].trim());
      return;
    }
    if (choices.length === 0) stem.push(line);
    else stem.push(line); // 選択肢の後の非該当行も問題文に含める（表記ゆれ対策）
  });

  const question = stem.join(' ').trim();
  if (!question && choices.length === 0) return null;

  // 正解の解決
  let answer = 0;
  let needsAnswer = true;
  if (answerRaw != null) {
    let idx = markerToIndex(answerRaw);
    if (idx < 0) {
      // 選択肢テキストとの一致で解決
      idx = choices.findIndex((c) => c === answerRaw.trim());
    }
    if (idx >= 0 && idx < Math.max(choices.length, 2)) {
      answer = idx;
      needsAnswer = false;
    }
  }

  const isOx = choices.length < 2;
  return {
    id: pid(),
    subject: '',
    type: isOx ? 'ox' : 'choice',
    question,
    choices: isOx ? ['○（正しい）', '×（誤り）'] : choices,
    answer: isOx ? 0 : answer,
    explanation,
    _needsAnswer: isOx ? true : needsAnswer,
    _fewChoices: !isOx && choices.length < 3,
  };
}

export function parseFreeText(raw) {
  if (!raw || !raw.trim()) return { questions: [], warnings: ['文章が空です。'] };
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = splitBlocks(text);
  const questions = [];
  blocks.forEach((b) => {
    const q = parseBlock(b);
    if (q) questions.push(q);
  });
  const warnings = [];
  const need = questions.filter((q) => q._needsAnswer).length;
  if (need > 0) warnings.push(`${need}問は正解を自動判定できませんでした。プレビューで指定してください。`);
  return { questions, warnings };
}
