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

// ---- 設定 ----
const DEFAULT_SETTINGS = {
  speechRate: 1.0,
  speechPitch: 1.0,
  gapSeconds: 3,
  voiceURI: '',
  backupReminderEvery: 50, // この解答数ごとにバックアップを促す
  answersSinceBackup: 0, // 前回バックアップからの解答数
  autoBackupOnStart: false, // 起動時に自動でバックアップを書き出す
  lastAutoBackup: 0, // 最終自動バックアップ日時
  lastDeepDive: '', // 最後に「今日の1問」を深掘りした日（YYYY-MM-DD）
  deepDiveStreak: 0, // 連結学習の連続日数
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
  if (data.settings && typeof data.settings === 'object') await saveSettings(data.settings);
}
