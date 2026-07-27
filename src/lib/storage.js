// 学習データの永続化レイヤー（IndexedDB バックエンド）
//
// 端末を閉じても学習履歴が残るよう、以下を IndexedDB に保存する:
//   - 取り込んだ問題データ（インポートした問題・画像を含む）
//   - 学習進捗 / 間隔反復（SM-2）状態
//   - 解答履歴（弱点分析に利用）
//   - 各問題へのメモ
//   - アプリ設定
//
// 以前のバージョンで localStorage に保存されたデータは、初回アクセス時に
// 自動で IndexedDB へ移行する。IndexedDB が使えない環境では localStorage に
// フォールバックする。

import { idbGet, idbSet, idbDelete, idbGetAll, isIdbSupported } from './db.js';

export const KEYS = {
  questions: 'shinkyu:questions',
  srs: 'shinkyu:srs',
  history: 'shinkyu:history',
  memos: 'shinkyu:memos',
  links: 'shinkyu:links',
  settings: 'shinkyu:settings',
  schedule: 'shinkyu:schedule', // カレンダーの予定
  venues: 'shinkyu:venues', // 試験会場・近くのホテル
  examContent: 'shinkyu:examContent', // 国家試験の内容メモ（枠）
  selfNotes: 'shinkyu:selfNotes', // セルフケア・体調メモ（端末内のみ）
  kwMeta: 'shinkyu:kwMeta', // キーワード別のメタ（語呂合わせ）
  userDict: 'shinkyu:userDict', // 自動提案に使うユーザー辞書
  session: 'shinkyu:session', // 学習セッション（60/300/900）の続き位置
  unread: 'shinkyu:unread', // 読み取れなかったページ・問題の控え
  auth: 'shinkyu:auth', // 端末内のログイン鍵（ID・パスワードハッシュ・秘密の質問）
  pomoMusic: 'shinkyu:pomoMusic', // ポモドーロ開始Music（音声ファイルのBlob）
  lastView: 'shinkyu:lastView', // 前回開いていた画面（アプリ再開時に復元）
  quizProgress: 'shinkyu:quizProgress', // 一問一答の途中経過（1問ごとに保存・続きから）
  examResults: 'shinkyu:examResults', // 模試の結果履歴
  migrated: 'shinkyu:migrated',
};

const useIdb = isIdbSupported();

// ---- 低レベル read/write（IDB優先・localStorageフォールバック） ----
async function read(key, fallback) {
  try {
    if (useIdb) {
      const v = await idbGet(key);
      return v === undefined ? fallback : v;
    }
  } catch (e) {
    console.warn('idb read failed, fallback to localStorage', key, e);
  }
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) {
    console.warn('storage read failed', key, e);
    return fallback;
  }
}

async function write(key, value) {
  try {
    if (useIdb) {
      await idbSet(key, value);
      return true;
    }
  } catch (e) {
    console.warn('idb write failed, fallback to localStorage', key, e);
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('storage write failed', key, e);
    return false;
  }
}

async function remove(key) {
  try {
    if (useIdb) await idbDelete(key);
  } catch (e) {
    /* noop */
  }
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* noop */
  }
}

// ---- localStorage からの一度きりの移行 ----
export async function migrateFromLocalStorage() {
  if (!useIdb) return;
  try {
    const already = await idbGet(KEYS.migrated);
    if (already) return;
    const legacyKeys = [
      KEYS.questions, KEYS.srs, KEYS.history, KEYS.memos, KEYS.links, KEYS.settings,
      KEYS.schedule, KEYS.venues, KEYS.examContent, KEYS.selfNotes, KEYS.kwMeta, KEYS.userDict,
    ];
    for (const k of legacyKeys) {
      const raw = localStorage.getItem(k);
      if (raw != null) {
        try {
          await idbSet(k, JSON.parse(raw));
        } catch (e) {
          /* 壊れた値はスキップ */
        }
      }
    }
    await idbSet(KEYS.migrated, true);
  } catch (e) {
    console.warn('migration failed', e);
  }
}

// ---- 問題データ ----
export const loadQuestions = () => read(KEYS.questions, null);
export const saveQuestions = (q) => write(KEYS.questions, q);

// ---- SRS 状態 ----
export const loadSrs = () => read(KEYS.srs, {});
export const saveSrs = (s) => write(KEYS.srs, s);

// ---- 解答履歴 ----
export const loadHistory = () => read(KEYS.history, []);
export const saveHistory = (h) => write(KEYS.history, h);

// ---- メモ ----
export const loadMemos = () => read(KEYS.memos, {});
export const saveMemos = (m) => write(KEYS.memos, m);

// ---- 連結リンク（連結学習法） ----
// links[questionId] = { keywords: string[], note: string, related: string[] }
export const loadLinks = () => read(KEYS.links, {});
export const saveLinks = (l) => write(KEYS.links, l);

// ---- カレンダーの予定 ----
// schedule = [{ id, date:'YYYY-MM-DD', time:'HH:MM'|'', title, memo, kind }]
export const loadSchedule = () => read(KEYS.schedule, []);
export const saveSchedule = (s) => write(KEYS.schedule, s);

// ---- 試験会場・ホテル ----
// venues = [{ id, name, address, memo, hotels:[{ id, name, memo, url }] }]
export const loadVenues = () => read(KEYS.venues, []);
export const saveVenues = (v) => write(KEYS.venues, v);

// ---- 国家試験の内容（枠） ----
// examContent = [{ id, title, body }]
export const loadExamContent = () => read(KEYS.examContent, null);
export const saveExamContent = (c) => write(KEYS.examContent, c);

// ---- セルフケア・体調メモ（端末内のみ・非公開） ----
// selfNotes = [{ id, category, title, body, at }]
export const loadSelfNotes = () => read(KEYS.selfNotes, []);
export const saveSelfNotes = (n) => write(KEYS.selfNotes, n);

// ---- キーワード別メタ（語呂合わせ） ----
// kwMeta = { [keyword]: { mnemonic } }
export const loadKwMeta = () => read(KEYS.kwMeta, {});
export const saveKwMeta = (m) => write(KEYS.kwMeta, m);

// ---- ユーザー辞書（自動提案に足す自作用語） ----
export const loadUserDict = () => read(KEYS.userDict, []);
export const saveUserDict = (d) => write(KEYS.userDict, d);

// ---- 読み取れなかったページ・問題の控え ----
// unread = [{ id, source, page, detail, at }]
export const loadUnread = () => read(KEYS.unread, []);
export const saveUnread = (u) => write(KEYS.unread, u);

// ---- 前回開いていた画面（アプリ再開時に復元） ----
export const loadLastView = () => read(KEYS.lastView, null);
export const saveLastView = (v) => write(KEYS.lastView, v);

// ---- 一問一答の途中経過（1問ごとに保存・続きから） ----
// quizProgress = { subject, ids:[qid], idx, stats:{total,correct}, at }
export const loadQuizProgress = () => read(KEYS.quizProgress, null);
export const saveQuizProgress = (p) => write(KEYS.quizProgress, p);
export const clearQuizProgress = () => remove(KEYS.quizProgress);

// ---- 模試の結果履歴 ----
// examResults = [{ id, at, count, correct, scorePct, passed, perSubject }]
export const loadExamResults = () => read(KEYS.examResults, []);
export const saveExamResults = (r) => write(KEYS.examResults, r);

// ---- ログイン鍵（端末内のみ・サーバー送信なし） ----
// auth = { email, salt, passHash, question, ansSalt, ansHash, updatedAt }
export const loadAuth = () => read(KEYS.auth, null);
export const saveAuth = (a) => write(KEYS.auth, a);
export const clearAuth = () => remove(KEYS.auth);

// ---- ポモドーロ開始Music（音声ファイルの Blob） ----
export const loadPomoMusic = () => read(KEYS.pomoMusic, null);
export const savePomoMusic = (blob) => write(KEYS.pomoMusic, blob);
export const clearPomoMusic = () => remove(KEYS.pomoMusic);

// ---- 学習セッション（60/300/900 の続き位置） ----
// session = { subject, ids:[qid], pos, target, round, startedAt, times:{qid:ms} }
export const loadSession = () => read(KEYS.session, null);
export const saveSession = (s) => write(KEYS.session, s);
export const clearSession = () => remove(KEYS.session);

// ---- 設定 ----
const DEFAULT_SETTINGS = {
  speechRate: 1.0,
  speechPitch: 1.0,
  gapSeconds: 3,
  voiceURI: '',
  voicePreset: '', // 声のプリセット（女性3・男性3）id
  backupReminderEvery: 50, // この解答数ごとにバックアップを促す
  answersSinceBackup: 0, // 前回バックアップからの解答数
  autoBackupOnStart: false, // 起動時に自動でバックアップを書き出す
  lastAutoBackup: 0, // 最終自動バックアップ日時
  lastDeepDive: '', // 最後に「今日の1問」を深掘りした日（YYYY-MM-DD）
  deepDiveStreak: 0, // 連結学習の連続日数
  iryouSeeded: false, // 同梱の医療概論一問一答を初回取り込み済みか
  eiseiVersion: 0, // 同梱の衛生学・公衆衛生学を取り込んだバージョン（増分反映）
  subjectTagsCleaned: false, // 以前自動付与した科目タグを除去済みか
  genreFolded: false, // genre（出題基準カテゴリ）を tags へ折り込み済みか
  authSkipped: false, // 初回のログイン設定案内をスキップ済みか
  examDate: '', // 試験日（YYYY-MM-DD）カウントダウン用
  sessionNewRatio: 1, // 学習セッションの新規割合（0〜1、1=すべて新規）
  reminder: { enabled: false, time: '07:00', lastNotified: '' }, // 毎日の学習リマインド通知
  // ポモドーロタイマー（全画面上部）
  pomodoro: {
    enabled: false, // 上部バーを表示するか
    study: 25, // 勉強（分）
    shortBreak: 5, // 短い休憩（分）
    longBreak: 15, // 長い休憩（分）
    cycles: 4, // 何回勉強したら長い休憩
    notifyEvery: 0, // 勉強中この分ごとに通知（0=なし）
    startMusic: false, // 勉強開始Musicを鳴らすか
  },
};
export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await read(KEYS.settings, {})) });
export const saveSettings = (s) => write(KEYS.settings, s);
export { DEFAULT_SETTINGS };

// ---- リセット ----
export async function resetProgress() {
  await remove(KEYS.srs);
  await remove(KEYS.history);
}
export async function resetAll() {
  for (const k of Object.values(KEYS)) await remove(k);
}

// ---- 全データのバックアップ / 復元 ----
export async function exportAll() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    questions: await loadQuestions(),
    srs: await loadSrs(),
    history: await loadHistory(),
    memos: await loadMemos(),
    links: await loadLinks(),
    schedule: await loadSchedule(),
    venues: await loadVenues(),
    examContent: await loadExamContent(),
    selfNotes: await loadSelfNotes(),
    kwMeta: await loadKwMeta(),
    userDict: await loadUserDict(),
    unread: await loadUnread(),
    auth: await loadAuth(),
    examResults: await loadExamResults(),
    settings: await read(KEYS.settings, {}),
  };
}

export async function importAll(data) {
  if (!data || typeof data !== 'object') throw new Error('不正なバックアップデータです');
  if (Array.isArray(data.questions)) await saveQuestions(data.questions);
  if (data.srs && typeof data.srs === 'object') await saveSrs(data.srs);
  if (Array.isArray(data.history)) await saveHistory(data.history);
  if (data.memos && typeof data.memos === 'object') await saveMemos(data.memos);
  if (data.links && typeof data.links === 'object') await saveLinks(data.links);
  if (Array.isArray(data.schedule)) await saveSchedule(data.schedule);
  if (Array.isArray(data.venues)) await saveVenues(data.venues);
  if (Array.isArray(data.examContent)) await saveExamContent(data.examContent);
  if (Array.isArray(data.selfNotes)) await saveSelfNotes(data.selfNotes);
  if (data.kwMeta && typeof data.kwMeta === 'object') await saveKwMeta(data.kwMeta);
  if (Array.isArray(data.userDict)) await saveUserDict(data.userDict);
  if (Array.isArray(data.unread)) await saveUnread(data.unread);
  if (data.auth && typeof data.auth === 'object') await saveAuth(data.auth);
  if (Array.isArray(data.examResults)) await saveExamResults(data.examResults);
  if (data.settings && typeof data.settings === 'object') await saveSettings(data.settings);
}
