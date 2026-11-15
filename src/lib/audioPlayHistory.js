// 音声学習の「再生履歴」（2026-11-15・ユーザー指定）。下部のミニプレーヤーが使う。
// 科目・ジャンル・キーワード・回の組み合わせごとに1件だけ持ち、「どこまで聞いたか」を上書きしていく
// （同じ科目を聞くたびに行が増えないように）。新しい順、最大12件。端末内（localStorage）だけ。
// ※ 残すのは「科目などを選んで読む」「すべて読む」の通常の読み上げだけ。連結学習モード(1〜10)・
//   間違えた問題・キーワード単位の読み上げは、同じ並びを再現できないので履歴に残さない
//   （押しても飛べない履歴を作らない）。
export const AUDIO_HISTORY_KEY = 'shinkyu:audioPlayHistory';
export const AUDIO_HISTORY_MAX = 12;

export function historyKeyOf(e) {
  return [e?.subject || '', e?.genre || '', e?.keyword || '', e?.round || ''].join('|');
}

export function normalizeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const index = Number(e.index);
  const total = Number(e.total);
  if (!Number.isFinite(index) || index < 0 || !Number.isFinite(total) || total <= 0) return null;
  const str = (v) => (typeof v === 'string' ? v : '');
  const entry = {
    subject: str(e.subject), genre: str(e.genre), keyword: str(e.keyword), round: e.round ? String(e.round) : '',
    index: Math.min(Math.floor(index), Math.floor(total) - 1),
    total: Math.floor(total),
    label: str(e.label).slice(0, 40),
    text: str(e.text).slice(0, 60),
    at: Number.isFinite(Number(e.at)) ? Number(e.at) : 0,
  };
  entry.key = historyKeyOf(entry);
  return entry;
}

// 1件を記録する（同じ組み合わせは置き換えて先頭へ）。純関数。
export function upsertHistory(list, entry) {
  const e = normalizeEntry(entry);
  const base = (Array.isArray(list) ? list : []).map(normalizeEntry).filter(Boolean);
  if (!e) return base;
  return [e, ...base.filter((x) => x.key !== e.key)].slice(0, AUDIO_HISTORY_MAX);
}

export function removeFromHistory(list, key) {
  return (Array.isArray(list) ? list : []).filter((x) => x && x.key !== key);
}

// 履歴の1行の見出し（「病理学概論」「すべての問題」など）
export function historyTitle(e) {
  const parts = [e?.subject, e?.genre, e?.keyword, e?.round ? `${String(e.round).replace(/^第|回$/g, '')}回` : ''].filter(Boolean);
  return parts.length ? parts.join('・') : 'すべての問題';
}

export function positionText(e) {
  return e && e.total > 0 ? `${e.index + 1} / ${e.total}` : '';
}

const pad2 = (n) => String(n).padStart(2, '0');
export function historyTimeText(at) {
  if (!at) return '';
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---- 端末への読み書き（失敗しても落とさない） ----
const listeners = new Set();
export function loadAudioHistory() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUDIO_HISTORY_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return (Array.isArray(arr) ? arr : []).map(normalizeEntry).filter(Boolean);
  } catch { return []; }
}
function saveAudioHistory(list) {
  try { localStorage.setItem(AUDIO_HISTORY_KEY, JSON.stringify(list)); } catch { /* 保存できなくても再生は続ける */ }
  listeners.forEach((fn) => { try { fn(list); } catch { /* noop */ } });
}
export function recordAudioHistory(entry) {
  const next = upsertHistory(loadAudioHistory(), entry);
  saveAudioHistory(next);
  return next;
}
export function deleteAudioHistory(key) {
  const next = removeFromHistory(loadAudioHistory(), key);
  saveAudioHistory(next);
  return next;
}
export function clearAudioHistory() { saveAudioHistory([]); return []; }
export function subscribeAudioHistory(fn) { listeners.add(fn); return () => listeners.delete(fn); }
