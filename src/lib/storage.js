// 学習データの永続化レイヤー
//
// 端末を閉じても学習履歴が残るよう、以下を localStorage に保存する:
//   - 取り込んだ問題データ（インポートした問題を含む）
//   - 学習進捗 / 間隔反復（SRS）状態
//   - 解答履歴（弱点分析に利用）
//   - 各問題へのメモ
//   - アプリ設定（音声速度など）
//
// localStorage は容量制限（約5MB）があるため、大量データを扱う場合は
// IndexedDB への移行余地を残しているが、通常の問題数（数千問規模）であれば
// localStorage で十分永続化できる。

const KEYS = {
  questions: 'shinkyu:questions',
  srs: 'shinkyu:srs',
  history: 'shinkyu:history',
  memos: 'shinkyu:memos',
  settings: 'shinkyu:settings',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('storage read failed', key, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('storage write failed', key, e);
    return false;
  }
}

// ---- 問題データ ----
export function loadQuestions() {
  return read(KEYS.questions, null); // null = 未初期化（サンプル投入前）
}
export function saveQuestions(questions) {
  return write(KEYS.questions, questions);
}

// ---- SRS 状態 ----
// srs[questionId] = { box, due, correctStreak, wrongCount, seen, lastResult, lastAnswered }
export function loadSrs() {
  return read(KEYS.srs, {});
}
export function saveSrs(srs) {
  return write(KEYS.srs, srs);
}

// ---- 解答履歴 ----
// history = [{ questionId, subject, correct, at }]
export function loadHistory() {
  return read(KEYS.history, []);
}
export function saveHistory(history) {
  return write(KEYS.history, history);
}

// ---- メモ ----
// memos[questionId] = 'メモ本文'
export function loadMemos() {
  return read(KEYS.memos, {});
}
export function saveMemos(memos) {
  return write(KEYS.memos, memos);
}

// ---- 設定 ----
const DEFAULT_SETTINGS = {
  speechRate: 1.0,      // 音声の再生速度
  speechPitch: 1.0,     // 音声の高さ
  gapSeconds: 3,        // 問題文→解答の間の秒数
  voiceURI: '',         // 使用する音声（空なら既定）
};
export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}
export function saveSettings(settings) {
  return write(KEYS.settings, settings);
}

// ---- 全データリセット（設定画面から利用） ----
export function resetProgress() {
  localStorage.removeItem(KEYS.srs);
  localStorage.removeItem(KEYS.history);
}
export function resetAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
