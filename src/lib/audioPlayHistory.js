import { mirrorToNative } from './nativeMirror.js';
// 音声学習の「再生履歴」（2026-11-15・ユーザー指定）。下部のミニプレーヤーが使う。
// 科目・ジャンル・キーワード・回の組み合わせごとに1件だけ持ち、「どこまで聞いたか」を上書きしていく
// （同じ科目を聞くたびに行が増えないように）。新しい順、最大12件。端末内（localStorage）だけ。
// ※ 残すのは「科目などを選んで読む」「すべて読む」の通常の読み上げだけ。連結学習モード(1〜10)・
//   間違えた問題・キーワード単位の読み上げは、同じ並びを再現できないので履歴に残さない
//   （押しても飛べない履歴を作らない）。
export const AUDIO_HISTORY_KEY = 'shinkyu:audioPlayHistory';
export const AUDIO_HISTORY_MAX = 12;
// 下部バーの「💾 ここを保存」で本人が意図的に残したもの。自動の履歴に押し出されず、消すまで残る。
export const AUDIO_PINNED_MAX = 20;

// 誤答・△✕などの読み上げ（kind:'review'）は、絞り込みではなく「聞いていた問題の並びそのもの」
// （ids）で持つ（2026-11-15・ユーザー指定）。並びが毎回変わる復習プールでも、閉じる前と同じ問題・
// 同じ順番から再開できるように。heard＝その中で解答まで聞き終えた問題（未聴だけ再開するのに使う）。
export const REVIEW_IDS_MAX = 2000;

export function historyKeyOf(e) {
  if (e?.kind === 'review') return `review|${e?.title || ''}`;
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
    // 聞いていた問題そのもののid。並びが変わっても（シャッフル・問題の追加・絞り込みの違い）、
    // 番号ではなくこの問題を探して飛べるようにする。
    qid: e.qid != null && e.qid !== '' ? String(e.qid) : '',
    // 最後まで聞き終えた印。次は最初から始める（最後の1問だけ再生して終わらないように）。
    done: !!e.done,
  };
  // 件数しぼり込み（10・60・300・900）と「もう一度」の位置。以前は持っていなかったため、
  // 今の件数が記録と違うと（例：記録は全123問・今は10問）聞いていた問題が束に入らず、別の位置へ着いていた。
  // 古い履歴（持っていないもの）は「分からない」として今の設定を変えない。
  if (e.kind !== 'review' && e.target !== undefined) {
    const t = Number(e.target);
    entry.target = Number.isFinite(t) && t > 0 ? Math.floor(t) : null;
    const o = Number(e.offset);
    entry.offset = Number.isFinite(o) && o > 0 ? Math.floor(o) : 0;
  }
  if (e.kind === 'review') {
    const ids = (Array.isArray(e.ids) ? e.ids : []).map(String).filter(Boolean);
    const uniq = [...new Set(ids)].slice(0, REVIEW_IDS_MAX);
    if (uniq.length === 0) return null;
    const idSet = new Set(uniq);
    const heard = [...new Set((Array.isArray(e.heard) ? e.heard : []).map(String))].filter((id) => idSet.has(id));
    entry.kind = 'review';
    entry.title = str(e.title).slice(0, 40) || '誤答・△✕';
    entry.sessionKind = str(e.sessionKind);
    entry.ids = uniq;
    entry.heard = heard;
    entry.total = uniq.length;
    entry.done = heard.length >= uniq.length;
    // 表示の位置＝いま聞いている（次に聞く）問題の番号。並びの中のqidの場所を優先する。
    const at = entry.qid ? uniq.indexOf(entry.qid) : -1;
    entry.index = entry.done ? 0 : Math.min(uniq.length - 1, at >= 0 ? at : heard.length);
  }
  entry.key = historyKeyOf(entry);
  if (e.pinned) {
    entry.pinned = true;
    // 保存したものの名前「日付_テーマ_回数」（録音学習の型のファイル名の決まり）
    if (e.pinName) entry.pinName = str(e.pinName).slice(0, 60);
    entry.pinId = String(e.pinId || entry.at || Date.now());
    entry.key = `pin|${entry.pinId}`;
  }
  return entry;
}

// 誤答・△✕の履歴から、次に流す問題idを決める（純関数）。
// 聞き終えていれば最初から全部、そうでなければ「まだ聞いていない問題だけ」を元の順番のまま。
export function reviewReplayIds(entry) {
  const ids = Array.isArray(entry?.ids) ? entry.ids : [];
  if (ids.length === 0) return [];
  const heard = new Set(Array.isArray(entry?.heard) ? entry.heard : []);
  const rest = ids.filter((id) => !heard.has(id));
  return rest.length === 0 ? [...ids] : rest;
}

export function heardCount(e) {
  return e?.kind === 'review' && Array.isArray(e.heard) ? e.heard.length : 0;
}

// 1件を記録する（同じ組み合わせは置き換えて先頭へ）。純関数。
export function upsertHistory(list, entry) {
  const e = normalizeEntry(entry);
  const base = (Array.isArray(list) ? list : []).map(normalizeEntry).filter(Boolean);
  if (!e) return base;
  const rest = base.filter((x) => x.key !== e.key);
  // 自動の履歴（最大12件）と、本人が保存したもの（最大20件）は別々に数える
  const autos = [e, ...rest].filter((x) => !x.pinned).slice(0, AUDIO_HISTORY_MAX);
  const pins = [e, ...rest].filter((x) => x.pinned).slice(0, AUDIO_PINNED_MAX);
  const keep = new Set([...autos, ...pins].map((x) => x.key));
  return [e, ...rest].filter((x) => keep.has(x.key));
}

export function removeFromHistory(list, key) {
  return (Array.isArray(list) ? list : []).filter((x) => x && x.key !== key);
}

// 履歴の1行の見出し（「病理学概論」「すべての問題」など）
export function historyTitle(e) {
  if (e?.pinName) return e.pinName;
  if (e?.kind === 'review') return e.title || '誤答・△✕';
  const parts = [e?.subject, e?.genre, e?.keyword, e?.round ? `${String(e.round).replace(/^第|回$/g, '')}回` : ''].filter(Boolean);
  return parts.length ? parts.join('・') : 'すべての問題';
}

export function positionText(e) {
  if (!e || !(e.total > 0)) return '';
  if (e.done) return `全${e.total}問・聞き終えた`;
  if (e.kind === 'review') return `${e.index + 1} / ${e.total}（聞いた${heardCount(e)}問）`;
  return `${e.index + 1} / ${e.total}`;
}

// 飛び先を決める（純関数）。planIdsは今の並びの問題id（問題でない項目はnull）。
// ①聞き終えた履歴は最初から ②同じ問題が今の並びにあればそこ ③無ければ番号を範囲内へ寄せる。
// 戻り値 { index, moved }：movedは「記録と同じ問題へは行けず、近い番号へ寄せた」時だけtrue。
export function resolveJumpIndex(entry, planIds) {
  const ids = Array.isArray(planIds) ? planIds : [];
  if (ids.length === 0) return { index: 0, moved: false };
  if (entry?.done) return { index: 0, moved: false };
  if (entry?.qid) {
    const at = ids.findIndex((id) => id != null && String(id) === String(entry.qid));
    if (at >= 0) return { index: at, moved: false };
  }
  const raw = Number(entry?.index) || 0;
  const index = Math.max(0, Math.min(ids.length - 1, raw));
  const moved = !!entry?.qid || index !== raw || (entry?.total > 0 && entry.total !== ids.length);
  return { index, moved };
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
  const raw = JSON.stringify(list);
  try { localStorage.setItem(AUDIO_HISTORY_KEY, raw); } catch { /* 保存できなくても再生は続ける */ }
  mirrorToNative(AUDIO_HISTORY_KEY, raw); // アプリ版：急に閉じても残るよう端末にも書く
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
// いま聞いているところを「保存」するための口。音声学習の画面（AudioMode）が、
// 今の状態を履歴1件の形にして返す関数を登録する（下部バーは画面の絞り込みを知らないため）。
let currentContextProvider = null;
export function setCurrentAudioContext(fn) { currentContextProvider = typeof fn === 'function' ? fn : null; }
// 下部バーの題名用：誤答・△✕などの束を聞いている時だけ、その題（「誤答・△✕ 解剖学」など）を返す。
// 以前は再生中の下部バーに科目名しか出ず、ふつうの読み上げと見分けがつかなかった。
export function currentReviewTitle() {
  let ctx = null;
  try { ctx = currentContextProvider ? currentContextProvider() : null; } catch { ctx = null; }
  return ctx && ctx.kind === 'review' ? historyTitle(ctx) : '';
}
// 戻り値：保存した1件（保存できない読み上げ方なら null）
export function saveCurrentAsPinned(now = Date.now()) {
  let ctx = null;
  try { ctx = currentContextProvider ? currentContextProvider() : null; } catch { ctx = null; }
  if (!ctx) return null;
  const list = loadAudioHistory();
  const theme = historyTitle(normalizeEntry({ ...ctx, pinName: '' }) || ctx).replace(/\s+/g, '・').replace(/_/g, '・');
  const d = new Date(now);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const n = list.filter((x) => x && x.pinned && typeof x.pinName === 'string' && x.pinName.split('_')[1] === theme).length + 1;
  const entry = normalizeEntry({ ...ctx, pinned: true, pinId: String(now), at: now, pinName: `${ymd}_${theme}_${n}回目` });
  if (!entry) return null;
  saveAudioHistory(upsertHistory(list, entry));
  return entry;
}
export function subscribeAudioHistory(fn) { listeners.add(fn); return () => listeners.delete(fn); }
