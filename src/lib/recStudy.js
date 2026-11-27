// 録音学習の型（2026-11-27、ユーザー提供の「録音学習 総まとめ」より）。
// React に依存しない純関数と、端末内の小さな記録（localStorage）だけを持つ。
// 画面は AudioMode.jsx（読み上げの組み立て）と RecStudyCard.jsx（今日の再生リスト）が使う。
//
// ・箱方式の復習日程（当日→翌日→3日後→1週間後→2週間後→1か月後の6回）
//   ○＝次の段へ／△＝同じ間隔でもう一度／✕＝翌日に戻す。段ごとに速さと無音の長さを変える。
//   既存の SRS（srs.js）とは別の、音声だけの日程（SRSの間隔は変えない）。
// ・苦手トラック：△✕で入り、3回続けて○で外す（要注意＝5回連続とは別の基準）。
// ・今日の再生リスト：新しい／復習／苦手の3枠（各10問＝1トラック）。新しい問題は1日3回聞いたかを数える。
// 数字（速さ・秒数・日数・3回・2割）はすべて元の資料の目安で、アプリが確かめた基準ではない。

export const DAY_MS = 24 * 60 * 60 * 1000;

// 段（0〜5）。rate＝読む速さ、gap＝問題のあとの無音（秒）。6＝6回聞き終えた（卒業）。
export const BOX_STAGES = [
  { label: '当日', rate: 1.0, gap: 5 },
  { label: '翌日', rate: 1.0, gap: 4 },
  { label: '3日後', rate: 1.25, gap: 3 },
  { label: '1週間後', rate: 1.25, gap: 3 },
  { label: '2週間後', rate: 1.5, gap: 2 },
  { label: '1か月後', rate: 1.5, gap: 2 },
];
export const BOX_DONE = BOX_STAGES.length;
// 段 s から s+1 へ進む時の日数（当日→翌日1日、翌日→3日後2日、→1週間後4日、→2週間後7日、→1か月後16日）
const DAYS_TO_NEXT = [1, 2, 4, 7, 16];

export const WEAK_EXIT = 3; // 苦手トラックは3回続けて○で外す
export const TRACK_SIZE = 10; // 1トラック＝10問前後
export const NEW_LISTENS_PER_DAY = 3; // 新しい内容は1日3回

const KEY_BOX = 'shinkyu:audioBox';
const KEY_WEAK = 'shinkyu:audioWeak';
const KEY_DAY = 'shinkyu:audioDay';

function readLs(key, fallback) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeLs(key, value) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 書けない端末では記録しないだけ */ }
}

export const loadBox = () => readLs(KEY_BOX, {});
export const saveBox = (box) => writeLs(KEY_BOX, box);
export const loadWeak = () => readLs(KEY_WEAK, {});
export const saveWeak = (weak) => writeLs(KEY_WEAK, weak);
export const loadDay = () => readLs(KEY_DAY, null);
export const saveDay = (day) => writeLs(KEY_DAY, day);

// 自己採点（maru/sankaku/batsu）で箱の段を動かす
export function gradeBox(box, qid, kind, now) {
  const cur = box[qid];
  const stage = cur ? cur.stage : 0;
  let next;
  if (kind === 'maru') {
    const s = stage + 1;
    next = s >= BOX_DONE ? { stage: BOX_DONE, due: null, at: now } : { stage: s, due: now + DAYS_TO_NEXT[s - 1] * DAY_MS, at: now };
  } else if (kind === 'sankaku') {
    // 同じ段のまま、その段に来た時と同じ間隔でもう一度（当日の段は翌日）
    const days = stage > 0 ? DAYS_TO_NEXT[Math.min(stage, DAYS_TO_NEXT.length) - 1] : 1;
    next = { stage: Math.min(stage, BOX_DONE - 1), due: now + days * DAY_MS, at: now };
  } else {
    next = { stage: 1, due: now + DAY_MS, at: now }; // 翌日に戻す
  }
  return { ...box, [qid]: next };
}

export function boxStageOf(box, qid) {
  const e = box[qid];
  if (!e) return 0;
  return Math.min(e.stage, BOX_DONE - 1);
}

// 今日聞く分（期限が来ている・卒業していない）。期限の古い順
export function boxDueIds(box, now) {
  return Object.entries(box)
    .filter(([, e]) => e && e.stage < BOX_DONE && e.due != null && e.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function gradeWeak(weak, qid, kind) {
  const next = { ...weak };
  if (kind !== 'maru') next[qid] = { streak: 0 };
  else if (next[qid]) {
    const streak = (next[qid].streak || 0) + 1;
    if (streak >= WEAK_EXIT) delete next[qid];
    else next[qid] = { streak };
  }
  return next;
}
export const weakIds = (weak) => Object.keys(weak);

// 今日の記録（日付が変わったら作り直す）
export function ensureDay(day, todayKey) {
  if (day && day.date === todayKey) return day;
  return { date: todayKey, newIds: [], newListens: 0, reviewOnly: false };
}

// 時間帯ごとのおすすめ（元の資料の表を、時刻だけで当てはめた目安。勤務に合わせて選べばよい）
export function slotForHour(h) {
  if (h >= 4 && h < 8) return { slot: 'weak', label: '起きてすぐは苦手から' };
  if (h >= 8 && h < 11) return { slot: 'review', label: '移動中は復習の分（翌日〜3日後）' };
  if (h >= 11 && h < 17) return { slot: 'new', label: '昼〜午後は新しい問題（1回目・2回目）' };
  if (h >= 17 && h < 21) return { slot: 'review', label: '帰りは復習の分（1週間〜1か月後）' };
  return { slot: 'new', label: '寝る前は新しい問題の3回目' };
}

// まだ一度も解いていない問題から1トラック分を選ぶ（科目があればその科目から、収録順）
export function pickNewIds(questions, answeredIds, subject, n = TRACK_SIZE) {
  const pool = questions.filter((q) => !answeredIds.has(q.id) && (!subject || q.subject === subject));
  return pool.slice(0, n).map((q) => q.id);
}

// 「日付_テーマ_回数」の名前（元の資料のファイル名の決まり）
export const trackName = (dateKey, theme, n) => `${dateKey}_${theme}_${n}回目`;

const isQ = (it) => it && (it.kind === 'question' || it.kind === 'choices' || it.kind === 'cloze') && it.q;

// 耳用の四択：選択肢を2回読む問題を、四択のうち5問に1問（全体の2割まで）に絞る
export function flagEarChoices(items, isFourChoice) {
  let k = 0;
  return items.map((it) => {
    if (!(it && it.kind === 'question' && it.q && isFourChoice(it.q))) return it;
    const flag = k % 5 === 0;
    k += 1;
    return flag ? { ...it, earChoices: true } : it;
  });
}

// 同じ論点を別の形式でもう一度：問題のあと3問おいて、同じ問題を穴埋めで出す
// （穴埋めにできる問題＝正解の語が解説に出てくる問題だけ。○×は穴埋めにならないので出さない）
export function mixFormats(items, canCloze) {
  const out = [];
  const pending = [];
  items.forEach((it) => {
    out.push(it);
    if (it && it.kind === 'question' && it.q && canCloze(it.q)) pending.push({ at: out.length + 3, item: { kind: 'cloze', q: it.q, mixed: true } });
    while (pending.length && pending[0].at <= out.length) out.push(pending.shift().item);
  });
  pending.forEach((p) => out.push(p.item));
  return out;
}

// 1回の中で2周：1周目のあとに「2周目です」を挟み、問題だけをもう一度（2周目は速く・間を短く）
export function twoPass(items) {
  const second = items.filter((it) => it && it.kind !== 'progress' && it.kind !== 'intro').map((it) => ({ ...it, pass: 2, intro: undefined }));
  if (!second.length) return items;
  return [...items, { kind: 'passNote' }, ...second];
}

export const questionCount = (items) => items.filter(isQ).length;

// 自信の度合い。たぶん・勘は「間違い扱い」（たぶん＝△、勘＝✕として記録する）
export const CONFIDENCE = [
  { id: 'sure', label: '確実', kind: 'maru' },
  { id: 'maybe', label: 'たぶん', kind: 'sankaku' },
  { id: 'guess', label: '勘', kind: 'batsu' },
];
// 選んで答えた時の記録の種類：合っていても、たぶん・勘なら○にしない
export function kindForPick(correct, conf) {
  if (!correct) return 'batsu';
  if (conf === 'maybe') return 'sankaku';
  if (conf === 'guess') return 'batsu';
  return 'maru';
}
