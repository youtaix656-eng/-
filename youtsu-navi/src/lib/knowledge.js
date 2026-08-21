// 知識ベース（企画書 Phase 3・改善策 #3「二段階チェック」）
//
// YouTube・書籍・研修で学んだことを、施術中に引き出せる形で手元に貯める。
// ただし **見聞きした内容をそのまま提案に混ぜない** ことをこの層で担保する。
//
// ⚠ 3つの前提:
//   1. **逐語のコピーを貯める場所ではない** — 動画の書き起こしや本文の丸写しは
//      著作物の複製にあたる。ここに書くのは「自分の言葉での要約」と「出典」。
//      SUMMARY_MAX で長さに上限を設け、長文の貼り付けを機械的に弾く。
//   2. **二段階チェックを通るまで提案に出さない** — 取り込んだ直後（draft）は
//      結果画面に出ない。第1チェック（自己チェック）→ 第2チェック（裏取り・整合）を
//      通って初めて active になる。
//   3. **レッドフラグを弱める知識を通さない** — 第2チェックの中心はここ。
//      「受診をすすめる判断を鈍らせないか」を必ず確認する。
//
// 端末内にのみ保存する（storage.js 経由）。ネットワークには触れない。

import { SOURCES } from '../data/sources.js';

export const MAX_NOTES = 400;
export const TITLE_MAX = 40;
/** 要約の上限。逐語転載を抑止するための制限でもある（長い＝写している可能性が高い） */
export const SUMMARY_MAX = 600;
export const PRACTICE_MAX = 300;

/** 出典の種別 */
export const SOURCE_KINDS = [
  { id: 'video', label: '動画（YouTube等）', icon: '▶️', locatorLabel: '再生位置・回', locatorHint: '例：12:34 / 第3回', weak: true },
  { id: 'book', label: '書籍・教科書', icon: '📕', locatorLabel: 'ページ・章', locatorHint: '例：p.128 / 第4章' },
  { id: 'seminar', label: '研修・セミナー', icon: '🧑‍🏫', locatorLabel: '日付・講師', locatorHint: '例：2026/05/10 ◯◯先生', weak: true },
  { id: 'article', label: '論文・記事', icon: '📄', locatorLabel: '掲載・DOI', locatorHint: '例：BMJ 2013;347:f7095' },
  { id: 'guideline', label: 'ガイドライン・行政資料', icon: '📘', locatorLabel: '版・該当箇所', locatorHint: '例：2019年版 CQ5' },
  { id: 'other', label: 'その他', icon: '🗒', locatorLabel: '該当箇所', locatorHint: '' },
];

export const SOURCE_KIND_MAP = Object.fromEntries(SOURCE_KINDS.map((k) => [k.id, k]));

/** 取り込みの段階。active になったものだけが結果画面に出る */
export const STAGES = {
  draft: { id: 'draft', label: '下書き', icon: '📝', tone: 'warn', desc: 'まだ提案には出ません。第1チェックへ進んでください。' },
  checked: { id: 'checked', label: '第1チェック済み', icon: '🔍', tone: 'warn', desc: 'まだ提案には出ません。日を改めて第2チェック（裏取り）を行ってください。' },
  active: { id: 'active', label: '運用中', icon: '✅', tone: 'ok', desc: '結果画面に「参考メモ」として表示されます。' },
  rejected: { id: 'rejected', label: '見送り', icon: '🚫', tone: 'danger', desc: '提案には出しません。理由を残して次に活かします。' },
};

export const STAGE_ORDER = ['draft', 'checked', 'active', 'rejected'];

/**
 * 第1チェック（取り込んだ本人が、その場で行う自己チェック）。
 * 「書き写していないか」「言い切っていないか」を自分に確認する段階。
 */
export const FIRST_CHECK_ITEMS = [
  { id: 'source', label: '出典を書いた（誰の・どの動画／本の・どこ）' },
  { id: 'ownWords', label: '書き写しではなく、自分の言葉で要約した' },
  { id: 'noAssert', label: '「必ず治る」「〜と診断できる」のような言い切りをしていない' },
  { id: 'inScope', label: '自分の資格の業務範囲でできる内容である' },
];

/**
 * 第2チェック（日を改めて／別の観点で行う裏取り）。
 * 第1チェックと同じ観点をなぞらないこと自体が、このチェックの目的。
 */
export const SECOND_CHECK_ITEMS = [
  { id: 'noConflict', label: '収録済みのガイドライン・出典と矛盾しない' },
  { id: 'keepsRedFlag', label: '受診をすすめる判断（レッドフラグ）を弱めていない', critical: true },
  { id: 'crossChecked', label: '一次情報、または別の情報源でも確認できた' },
  { id: 'notDiagnosis', label: 'お客様に伝える時、診断と受け取られない言い方にできる' },
];

/** 第2チェックは日を改めるのが望ましい（同じ日の見直しは見落としを繰り返しやすい） */
export const REVIEW_GAP_MS = 20 * 60 * 60 * 1000; // 20時間（翌日の同じ時間帯に見直せる幅）

/** 言い切りの検出。エラーではなく警告として出す（書き直す判断は本人がする） */
const ASSERTIVE_PATTERNS = [
  { re: /必ず(治|良くな|よくな|改善|効く)/, label: '「必ず〜」' },
  { re: /絶対(に)?(治|安全|大丈夫|効)/, label: '「絶対に〜」' },
  { re: /完治(する|します|できる)/, label: '「完治する」' },
  { re: /100\s*[%％]/, label: '「100%」' },
  { re: /と診断(でき|する|します|されます)/, label: '「〜と診断できる」' },
  { re: /診断(名|は).{0,6}(です|である)/, label: '診断名の断定' },
  { re: /副作用(は)?(ありません|無い|ない)/, label: '「副作用はない」' },
  { re: /誰でも(治|効)/, label: '「誰でも〜」' },
];

const KANJI = /[㐀-䶿一-鿿]/;
const HIRAGANA_ONLY = /^[ぁ-んー・\s]+$/;
const HAS_NUMBER = /[0-9０-９]/;

function trimTo(text, max) {
  return String(text ?? '').trim().slice(0, max);
}

/** 空の下書きを作る（フォームの初期値） */
export function emptyNote(at = 0) {
  return {
    id: '',
    at,
    updatedAt: at,
    title: '',
    reading: '',
    summary: '',
    practice: '',
    source: { kind: 'video', title: '', author: '', locator: '', sourceIds: [] },
    tags: [],
    patternIds: [],
    symptomIds: [],
    stage: 'draft',
    checks: { first: null, second: null },
    caution: false,
  };
}

/** 入力からノート1件を作る */
export function makeNote(input = {}, { at = 0, seed = 0 } = {}) {
  const base = emptyNote(at);
  const src = input.source || {};
  return {
    ...base,
    id: input.id || `kn-${at}-${String(seed || at).slice(-4)}`,
    title: trimTo(input.title, TITLE_MAX),
    reading: trimTo(input.reading, TITLE_MAX),
    summary: trimTo(input.summary, SUMMARY_MAX),
    practice: trimTo(input.practice, PRACTICE_MAX),
    source: {
      kind: SOURCE_KIND_MAP[src.kind] ? src.kind : 'other',
      title: trimTo(src.title, 120),
      author: trimTo(src.author, 60),
      locator: trimTo(src.locator, 60),
      sourceIds: (src.sourceIds || []).filter((id) => SOURCES.some((s) => s.id === id)),
    },
    tags: [...(input.tags || [])],
    patternIds: [...(input.patternIds || [])],
    symptomIds: [...(input.symptomIds || [])],
    caution: Boolean(input.caution),
  };
}

/**
 * 機械でチェックできる部分だけを検査する。
 * errors がある間は第1チェックへ進めない。warnings は進めるが表示して考えてもらう。
 */
export function validateNote(note, { others = [] } = {}) {
  const errors = [];
  const warnings = [];
  const title = String(note.title || '').trim();
  const summary = String(note.summary || '').trim();
  const source = note.source || {};

  if (!title) errors.push('見出しを入れてください。');
  if (title.length > TITLE_MAX) errors.push(`見出しは${TITLE_MAX}文字までにしてください。`);
  if (title && others.some((o) => o.id !== note.id && String(o.title || '').trim() === title)) {
    errors.push('同じ見出しのメモがすでにあります（探せなくなるため、別の言い方にしてください）。');
  }
  // 目次・索引の共通ルール：漢字を含む項目は読みを明示する（自動推定しない＝誤読防止）
  if (KANJI.test(title)) {
    const reading = String(note.reading || '').trim();
    if (!reading) errors.push('漢字を含む見出しには、読み（ひらがな）を入れてください。');
    else if (!HIRAGANA_ONLY.test(reading)) errors.push('読みはひらがなで入れてください。');
  }
  if (!summary) errors.push('要約を入れてください。');
  if (summary.length > SUMMARY_MAX) {
    errors.push(`要約は${SUMMARY_MAX}文字までです。書き写しではなく、要点を自分の言葉でまとめてください。`);
  }
  if (!source.title) errors.push('出典（動画名・書名など）を入れてください。根拠のない知識は提案に出しません。');

  if (!source.locator) warnings.push('出典の該当箇所（再生位置・ページ）があると、後から確認し直せます。');
  const kind = SOURCE_KIND_MAP[source.kind];
  if (kind && kind.weak && HAS_NUMBER.test(summary) && !note.caution) {
    warnings.push('数字を含む内容です。動画・研修だけを根拠にする場合は「※要確認」を付けることをおすすめします。');
  }
  for (const p of ASSERTIVE_PATTERNS) {
    if (p.re.test(summary) || p.re.test(String(note.practice || ''))) {
      warnings.push(`${p.label} のような言い切りがあります。施術の効果・診断は言い切らない書き方にしてください。`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** チェック記録を作る */
function makeCheck(items, answers = {}, at = 0, extra = {}) {
  const checked = items.filter((i) => answers[i.id]).map((i) => i.id);
  return { at, checked, all: checked.length === items.length, ...extra };
}

/** すべての項目にチェックが付いているか */
export function isCheckComplete(items, answers = {}) {
  return items.every((i) => Boolean(answers[i.id]));
}

/** 第2チェックのうち、外すと運用に進めない項目（レッドフラグを弱めない） */
export function criticalUnchecked(answers = {}) {
  return SECOND_CHECK_ITEMS.filter((i) => i.critical && !answers[i.id]);
}

/**
 * 第1チェックを記録する（draft → checked）。
 * 機械チェックのエラーが残っている、または未チェック項目があれば進めない。
 */
export function applyFirstCheck(note, answers = {}, { at = 0, others = [] } = {}) {
  const v = validateNote(note, { others });
  if (!v.ok) return { ok: false, reason: v.errors[0], note };
  if (!isCheckComplete(FIRST_CHECK_ITEMS, answers)) {
    return { ok: false, reason: 'すべての項目を確認してからチェックを完了してください。', note };
  }
  return {
    ok: true,
    note: { ...note, stage: 'checked', updatedAt: at, checks: { ...note.checks, first: makeCheck(FIRST_CHECK_ITEMS, answers, at) } },
  };
}

/**
 * 第2チェックを記録する（checked → active / rejected）。
 * 「受診をすすめる判断を弱めていない」が外れている場合は運用に進めない（見送りにする）。
 */
export function applySecondCheck(note, answers = {}, { at = 0, memo = '' } = {}) {
  if (note.stage !== 'checked' && note.stage !== 'active' && note.stage !== 'rejected') {
    return { ok: false, reason: '先に第1チェックを済ませてください。', note };
  }
  const critical = criticalUnchecked(answers);
  const firstAt = note.checks && note.checks.first ? note.checks.first.at : 0;
  const sameDay = firstAt > 0 && at - firstAt < REVIEW_GAP_MS;
  const check = makeCheck(SECOND_CHECK_ITEMS, answers, at, { sameDay, memo: String(memo || '').trim() });

  if (critical.length > 0) {
    return {
      ok: true,
      rejected: true,
      note: { ...note, stage: 'rejected', updatedAt: at, checks: { ...note.checks, second: check } },
      reason: `「${critical[0].label}」が確認できないため、見送りにしました。`,
    };
  }
  if (!isCheckComplete(SECOND_CHECK_ITEMS, answers)) {
    return { ok: false, reason: 'すべての項目を確認するか、確認できない項目があれば見送りにしてください。', note };
  }
  return {
    ok: true,
    note: { ...note, stage: 'active', updatedAt: at, checks: { ...note.checks, second: check } },
    sameDay,
  };
}

/** 手動で見送りにする（理由を残す。消さずに残すのは同じ誤りを繰り返さないため） */
export function rejectNote(note, { at = 0, memo = '' } = {}) {
  return {
    ...note,
    stage: 'rejected',
    updatedAt: at,
    checks: { ...note.checks, second: { at, checked: [], all: false, sameDay: false, memo: String(memo || '').trim() } },
  };
}

/** 見送り・運用中から下書きに戻して直す */
export function reopenNote(note, { at = 0 } = {}) {
  return { ...note, stage: 'draft', updatedAt: at, checks: { first: null, second: null } };
}

/** 第2チェック待ちのうち、日を改めた（＝いま見直すのに適した）もの */
export function dueForSecondCheck(notes = [], now = 0) {
  return notes.filter((n) => {
    if (n.stage !== 'checked') return false;
    const firstAt = n.checks && n.checks.first ? n.checks.first.at : 0;
    return firstAt > 0 && now - firstAt >= REVIEW_GAP_MS;
  });
}

export function sortNotes(list = []) {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt || b.at - a.at);
}

export function upsertNote(list = [], note) {
  const rest = list.filter((n) => n.id !== note.id);
  return sortNotes([note, ...rest]).slice(0, MAX_NOTES);
}

export function removeNote(list = [], id) {
  return list.filter((n) => n.id !== id);
}

/** 絞り込み（一覧画面）。見出し・要約・出典・使いどころを対象にする */
export function filterNotes(list = [], { query = '', stage = 'all', kind = 'all' } = {}) {
  const q = String(query).trim().toLowerCase();
  return list.filter((n) => {
    if (stage !== 'all' && n.stage !== stage) return false;
    if (kind !== 'all' && (n.source || {}).kind !== kind) return false;
    if (!q) return true;
    const src = n.source || {};
    return [n.title, n.reading, n.summary, n.practice, src.title, src.author]
      .filter(Boolean)
      .some((t) => String(t).toLowerCase().includes(q));
  });
}

/**
 * 結果画面に出すメモ。
 * **active のものだけ**を、推定パターン・タグ・症状のいずれかが重なる順に返す。
 */
export function activeNotesFor(list = [], { patternIds = [], tags = [], symptomId = null, limit = 5 } = {}) {
  const patternSet = new Set(patternIds);
  const tagSet = new Set(tags);
  const scored = [];
  for (const n of list) {
    if (n.stage !== 'active') continue;
    let score = 0;
    const hitPatterns = (n.patternIds || []).filter((id) => patternSet.has(id));
    const hitTags = (n.tags || []).filter((t) => tagSet.has(t));
    score += hitPatterns.length * 3;
    score += hitTags.length;
    if (symptomId && (n.symptomIds || []).includes(symptomId)) score += 1;
    if (score === 0) continue; // 関係のないメモは出さない（結果画面を薄めない）
    scored.push({ note: n, score, hitPatterns, hitTags });
  }
  return scored.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt).slice(0, limit);
}

/** 索引（あ〜ん / A〜Z）に渡す形へ。読みはデータに入っているものだけを使う */
export function toIndexItems(list = []) {
  return list.map((n) => ({ id: n.id, title: n.title, reading: n.reading || '', stage: n.stage }));
}

/** 件数の集計（ホーム・設定の表示用） */
export function summarizeKnowledge(list = [], now = 0) {
  const byStage = { draft: 0, checked: 0, active: 0, rejected: 0 };
  for (const n of list) if (byStage[n.stage] !== undefined) byStage[n.stage] += 1;
  return {
    total: list.length,
    ...byStage,
    due: dueForSecondCheck(list, now).length,
    lastAt: sortNotes(list)[0]?.updatedAt || null,
  };
}

/** 書き出し用のJSON（カルテとは別ファイル） */
export function notesToJson(list = []) {
  return JSON.stringify({ app: 'youtsu-navi', kind: 'knowledge', version: 1, exportedAt: 0, notes: list }, null, 2);
}

/** 取り込み。他アプリのファイル・壊れたファイルは弾く */
export function parseNotesJson(text) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch {
    return { ok: false, error: 'ファイルの形式が読み取れませんでした。' };
  }
  if (!data || data.app !== 'youtsu-navi' || data.kind !== 'knowledge') {
    return { ok: false, error: '腰痛ナビの知識ベースのファイルではありません。' };
  }
  if (!Array.isArray(data.notes)) return { ok: false, error: 'メモが入っていません。' };
  const notes = [];
  let skipped = 0;
  for (const n of data.notes) {
    if (!n || typeof n.id !== 'string' || typeof n.title !== 'string' || !n.title) {
      skipped += 1;
      continue;
    }
    notes.push({
      ...emptyNote(n.at || 0),
      ...n,
      source: { ...emptyNote(0).source, ...(n.source || {}) },
      checks: { first: null, second: null, ...(n.checks || {}) },
      stage: STAGES[n.stage] ? n.stage : 'draft',
    });
  }
  return { ok: true, notes, error: skipped ? `${skipped}件は形式が合わないため読み飛ばしました。` : '' };
}
