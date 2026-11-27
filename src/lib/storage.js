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

import { mirrorToNative, MIRRORED_KEYS } from './nativeMirror.js';
import { idbGet, idbSet, idbSetMany, idbDelete, idbGetAll, isIdbSupported } from './db.js';
import { loadFlashcardSrs, saveFlashcardSrsRaw } from './flashcardSrs.js';
export { loadFlashcardSrs, saveFlashcardSrsRaw };
import { loadPronunciationReportLog, savePronunciationReportLogRaw } from './pronunciationReportLog.js';
export { loadPronunciationReportLog, savePronunciationReportLogRaw };

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
  pomoMusic: 'shinkyu:pomoMusic', // ポモドーロ開始Music（音声ファイルのBlob、旧・単曲版。プレイリストへ移行済み）
  pomoPlaylist: 'shinkyu:pomoPlaylist', // ポモドーロの曲プレイリスト（複数曲、端末内のみ・バックアップ対象外）
  selfVoiceNotes: 'shinkyu:selfVoiceNotes', // 自分の声で言い直した説明の録音（questionId別、端末内のみ・バックアップ対象外）
  lastView: 'shinkyu:lastView', // 前回開いていた画面（アプリ再開時に復元）
  quizProgress: 'shinkyu:quizProgress', // 一問一答の途中経過（1問ごとに保存・続きから）
  reviewProgress: 'shinkyu:reviewProgress', // 復習の途中経過（1問ごとに保存・続きから）
  examProgress: 'shinkyu:examProgress', // 模試の途中経過（解答・残り時間・続きから）
  audioProgress: 'shinkyu:audioProgress', // 音声学習の再生位置（続きから）
  examResults: 'shinkyu:examResults', // 模試の結果履歴
  activity: 'shinkyu:activity', // 直近の閲覧履歴（画面・タイトル・ジャンル）
  numberOverrides: 'shinkyu:numberOverrides', // 数値ファクトの上書き（毎年変わる数値の一括更新）
  bookmarks: 'shinkyu:bookmarks', // ブックマーク（後で見直す問題・questionId→保存時刻）
  keiketsuLibrary: 'shinkyu:keiketsuLibrary', // 経絡経穴の教科書材料（貼り付けた原文の置き場・検索用）
  keizetsuPageImages: 'shinkyu:keizetsuPageImages', // 経絡経穴の教科書ページ写真（端末内限定・自分で追加。バックアップ対象外）
  voiceCloneSecret: 'shinkyu:voiceCloneSecret', // ボイスクローン用の外部APIキー（BYOK・端末内のみ・バックアップ対象外）
  cloudAuthPaused: 'shinkyu:cloudAuthPaused', // Google自動同期がサイレント再ログインに失敗し一時停止中か（端末のGoogleログイン状態に依存するため端末内のみ・バックアップ対象外）
  migrated: 'shinkyu:migrated',
  syncMeta: 'shinkyu:syncMeta', // クラウド自動同期用：進捗（srs/history/memos/links/examResults/settings）の最終更新時刻
  visitedViews: 'shinkyu:visitedViews', // 一度でも開いたことのある画面（view id）の集合。「まだ使ったことのない機能」の判定用（activityは直近ログで古い訪問が消えるため別管理）
  glossaryExtra: 'shinkyu:glossaryExtra', // 用語集：候補フローで承認され追加された項目（本体データ glossaryTerms.js は静的なので、実行時に増える分だけここに持つ）
  glossaryRemovedIds: 'shinkyu:glossaryRemovedIds', // 用語集：削除候補が承認され非表示になった項目ID（本体データは書き換えられないため、隠すIDだけ持つ）
  tocCandidates: 'shinkyu:tocCandidates', // 用語集：レビュー待ち・却下済みの追加/削除候補
  tocHistory: 'shinkyu:tocHistory', // 用語集：候補の採否履歴（undoLastTocAdditionsの参照元）
  logicalDupDismissed: 'shinkyu:logicalDupDismissed', // 問題ツール「誤りチェック」：論点の被り候補（questionSchema.jsのfindLogicalDuplicates）のうち、目視確認済みとして再表示しないグループキーの配列
};

const useIdb = isIdbSupported();

// ---- 書き込みのデバウンス＋重複排除＋離脱時フラッシュ ----
//   1問答えるたびにsrs/historyなど複数キーが同時に更新され、そのままだとキーの数だけ
//   即座に個別のIndexedDBトランザクションが走っていた（高速回転モード等で連打すると
//   もたつきの原因になる）。同じキーへの短時間の連続書き込みは最後の値だけを残し
//   （重複排除）、まとめて1回のタイマーで書き込む（デバウンス、Ouroの`ouro/lib/storage.js`
//   で実証済みの間隔と同じ400ms）。ページを離れる・裏に回る時は必ず即座にflushする
//   （デバウンス中のデータを失わないため）。
const DEBOUNCE_MS = 400;
const pending = new Map(); // key -> まだ実際には書き込んでいない最新値
let flushTimer = null;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushTimer = null; flushPending(); }, DEBOUNCE_MS);
}

async function flushPending() {
  if (pending.size === 0) return;
  const entries = [...pending.entries()];
  pending.clear();
  if (useIdb) {
    try {
      await idbSetMany(entries);
      return;
    } catch (e) {
      console.warn('idb batch write failed, fallback to localStorage', e);
    }
  }
  for (const [key, value] of entries) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('storage write failed', key, e); }
  }
}

// 保留中の書き込みを即座に確定させる。バックアップの書き出しなど、直後に最新値を
// 別経路（idbGetAll等）で読み出す処理の前には必ず呼ぶこと（read()自身はpendingを
// 見るので、read/loadXxx経由なら呼ばなくても常に最新値が返る）。
export async function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await flushPending();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flushPending(); });
}

// ---- 低レベル read/write（IDB優先・localStorageフォールバック） ----
async function read(key, fallback) {
  if (pending.has(key)) return pending.get(key);
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
  pending.set(key, value);
  scheduleFlush();
  return true;
}

async function remove(key) {
  pending.delete(key);
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

// ---- ブックマーク（後で見直す問題） ----
// bookmarks = { [questionId]: 保存時刻(ms) }
export const loadBookmarks = () => read(KEYS.bookmarks, {});
export const saveBookmarks = (b) => write(KEYS.bookmarks, b);

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

// ---- 用語集（目次・索引）の実行時追加分・削除・候補・履歴 ----
// glossaryExtra = 承認され本体データ（glossaryTerms.js）に相当するものとして扱う項目の配列
export const loadGlossaryExtra = () => read(KEYS.glossaryExtra, []);
export const saveGlossaryExtra = (v) => write(KEYS.glossaryExtra, v);
// glossaryRemovedIds = 削除が承認され、以後は表示しない項目IDの配列
export const loadGlossaryRemovedIds = () => read(KEYS.glossaryRemovedIds, []);
export const saveGlossaryRemovedIds = (v) => write(KEYS.glossaryRemovedIds, v);
// tocCandidates = レビュー待ち・却下済みの追加/削除候補
export const loadTocCandidates = () => read(KEYS.tocCandidates, []);
export const saveTocCandidates = (v) => write(KEYS.tocCandidates, v);
// tocHistory = 候補の採否履歴（新しい順に積む想定はしない。時刻でソートして使う）
export const loadTocHistory = () => read(KEYS.tocHistory, []);
export const saveTocHistory = (v) => write(KEYS.tocHistory, v);

// ---- 問題ツール「誤りチェック」：論点の被り候補の確認済みグループ ----
// logicalDupDismissed = string[]（findLogicalDuplicatesが返すgroup.keyの配列）
export const loadLogicalDupDismissed = () => read(KEYS.logicalDupDismissed, []);
export const saveLogicalDupDismissed = (v) => write(KEYS.logicalDupDismissed, v);

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

// ---- 復習の途中経過（1問ごとに保存・続きから） ----
// reviewProgress = { ids:[qid], idx, stats:{total,correct}, at }
export const loadReviewProgress = () => read(KEYS.reviewProgress, null);
export const saveReviewProgress = (p) => write(KEYS.reviewProgress, p);
export const clearReviewProgress = () => remove(KEYS.reviewProgress);

// ---- 模試の途中経過（解答・残り時間・続きから） ----
// examProgress = { ids:[qid], answers:[idx|null], idx, remain, presetLabel, at }
export const loadExamProgress = () => read(KEYS.examProgress, null);
export const saveExamProgress = (p) => write(KEYS.examProgress, p);
export const clearExamProgress = () => remove(KEYS.examProgress);

// ---- 音声学習の再生位置（続きから） ----
// audioProgress = { sig, index, at, graded? }（gradedは二重記録防止のid配列、省略可・後方互換）
export const loadAudioProgress = () => read(KEYS.audioProgress, null);
export const saveAudioProgress = (p) => write(KEYS.audioProgress, p);
export const clearAudioProgress = () => remove(KEYS.audioProgress);

// ---- 模試の結果履歴 ----
// examResults = [{ id, at, count, correct, scorePct, passed, perSubject }]
export const loadExamResults = () => read(KEYS.examResults, []);
export const saveExamResults = (r) => write(KEYS.examResults, r);

// ---- 経絡経穴の教科書材料（貼り付けた原文の置き場） ----
// keiketsuLibrary = [{ id, title, text, addedAt }]
// ここに置くのは検索・後で問題化するための「原文の下書き置き場」であり、
// 実際の経穴データ（keiketsuCards.js）はこの原文をもとに出典つきで手動整備する
// （画面から直接、経穴の医療的事実を編集させる作りにはしない）。
export const loadKeiketsuLibrary = () => read(KEYS.keiketsuLibrary, []);
export const saveKeiketsuLibrary = (v) => write(KEYS.keiketsuLibrary, v);

// ---- 経絡経穴の教科書ページ写真（端末内限定） ----
// keizetsuPageImages = [{ id, pageNumber, label, blob, addedAt }]
// 教科書のページをスキャン画像としてこのアプリ（公開リポジトリ・公開サイト）に
// 同梱すると著作権上の問題になるため、この画像は「ユーザーが自分の端末にだけ」保存する。
// exportAll/importAll（バックアップ・QR・クラウド自動同期）には意図的に含めない
// （画像はサイズが大きくQR/クラウド同期に不向きなことに加え、voiceCloneSecretと同様、
// 端末をまたいで勝手に運ばれてほしくないデータのため）。
export const loadKeizetsuPageImages = () => read(KEYS.keizetsuPageImages, []);
export const saveKeizetsuPageImages = (v) => write(KEYS.keizetsuPageImages, v);

// ---- ボイスクローン用の外部APIキー（BYOK） ----
// voiceCloneSecret = { apiKey }
// APIキーは「バックアップ・QR・WebRTC・クラウド自動同期のいずれにも含めない」
// （exportAll/importAll から意図的に除外）。他の設定と違い、漏れると第三者に
// 課金・なりすまし音声生成をされ得る生きた認証情報のため、この端末にのみ置く。
export const loadVoiceCloneSecret = () => read(KEYS.voiceCloneSecret, { apiKey: '' });
export const saveVoiceCloneSecret = (v) => write(KEYS.voiceCloneSecret, v);

// ---- Google自動同期の一時停止フラグ（端末内のみ） ----
// サイレント再ログインに一度失敗したら true にし、以後の自動トリガー（起動時・タブ復帰・
// オンライン復帰・5分間隔等）は再ログイン画面を出さずに黙って諦める。ユーザーが手動で
// 「今すぐ同期」「保存」「復元」「ログインし直す」のいずれかに成功したら false に戻す
// （2026-08-28、失敗するたびに毎回ログインポップアップが出る不具合の修正で追加）。
export const loadCloudAuthPaused = () => read(KEYS.cloudAuthPaused, false);
export const saveCloudAuthPaused = (v) => write(KEYS.cloudAuthPaused, v);

// ---- クラウド自動同期用メタ（進捗の最終更新時刻。lib/progressMerge.jsのマージ判定に使う） ----
// syncMeta = { updatedAt }（ミリ秒epoch）
export const loadSyncMeta = () => read(KEYS.syncMeta, { updatedAt: 0 });
export const saveSyncMeta = (m) => write(KEYS.syncMeta, m);

// ---- 直近の閲覧履歴（ホーム右上からスライドで確認） ----
// activity = [{ id, at, view, title, genre, subject, keyword }]（新しい順）
export const loadActivity = () => read(KEYS.activity, []);
export const saveActivity = (a) => write(KEYS.activity, a);
export const loadNumberOverrides = () => read(KEYS.numberOverrides, {});
export const saveNumberOverrides = (o) => write(KEYS.numberOverrides, o);
export const clearActivity = () => remove(KEYS.activity);

// ---- 一度でも開いたことのある画面（featureDiscovery.jsの「まだ使ったことのない機能」判定用） ----
// activityは直近ログ（件数上限あり）なので古い訪問が消える。こちらは消さない集合。
export const loadVisitedViews = () => read(KEYS.visitedViews, []);
export const saveVisitedViews = (v) => write(KEYS.visitedViews, v);

// ---- ログイン鍵（端末内のみ・サーバー送信なし） ----
// auth = { email, salt, passHash, question, ansSalt, ansHash, updatedAt }
export const loadAuth = () => read(KEYS.auth, null);
export const saveAuth = (a) => write(KEYS.auth, a);
export const clearAuth = () => remove(KEYS.auth);

// ---- ポモドーロ開始Music（音声ファイルの Blob、旧・単曲版） ----
export const loadPomoMusic = () => read(KEYS.pomoMusic, null);
export const savePomoMusic = (blob) => write(KEYS.pomoMusic, blob);
export const clearPomoMusic = () => remove(KEYS.pomoMusic);

// ---- ポモドーロの曲プレイリスト（複数曲） ----
// 2026-11-14、ユーザー指定で「曲選択のところにプレイリストを作りたい。選択したら
// 音楽が表示されるようにしたい」のため、単曲（pomoMusic）から複数曲へ拡張したもの。
// 2026-11-15、ユーザー指定で「YouTubeか、端末内の音楽を取り込む・また接続して選択
// できるようにしたい」のため、1曲ごとに3種類の入力元（kind）を持てるよう拡張した：
//   'file'       取り込む。File/Blobの実体をIndexedDBへコピーして持つ（既存の方式）。
//   'filehandle' 接続する。File System Access API（対応ブラウザのみ）で選んだ
//                FileSystemFileHandleだけを持ち、ファイル本体はコピーしない
//                （再生時に毎回`handle.getFile()`で読む。許可が切れていたら
//                再度「選び直す」操作（ユーザー操作＝ジェスチャー）で許可を取り直す）。
//   'youtube'    YouTubeの動画（音声ファイルは一切保存せず、動画IDとURLだけを持つ。
//                再生時にYouTube側から読み込む——このアプリの「`src/lib`は
//                ネットワークに触れない」という既定方針の、ユーザーが自分でYouTubeの
//                URLを貼った時だけ発生する明示的な例外）。
// playlist = [{id, kind, name, blob?, handle?, videoId?, url?}]（追加順）。
// この中から選んだ1曲（settings.pomodoro.activeSongId）だけを勉強中にループ再生する
// ——複数曲を自動で順に流す仕組みは持たない（2026-11-08の「シャッフルは持たない」と
// 同じ考え方で、常に「今選んでいる1曲」だけが流れる。オートアドバンスを足すとその
// 考え方と矛盾するため、あえて増やさなかった）。
// 古いデータ（kindを持たない）はnormalizePomoSongがkind:'file'として読む。
export const POMO_PLAYLIST_CAP = 30;
function genPomoId() {
  return 'pm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function normalizePomoSong(s) {
  return s.kind ? s : { ...s, kind: 'file' };
}
export async function loadPomoPlaylist() {
  const list = await read(KEYS.pomoPlaylist, []);
  return list.map(normalizePomoSong);
}
async function appendPomoPlaylist(entries) {
  const list = await loadPomoPlaylist();
  const next = [...list, ...entries].slice(-POMO_PLAYLIST_CAP);
  await write(KEYS.pomoPlaylist, next);
  return next;
}
export async function addPomoPlaylistFiles(files) {
  return appendPomoPlaylist(files.map((f) => ({
    id: genPomoId(),
    kind: 'file',
    name: f.name || '（名前未取得の曲）',
    blob: f,
  })));
}
// FileSystemFileHandle（File System Access API）は構造化複製できるためIndexedDBへ
// そのまま保存できる。対応していないブラウザでは呼び出し側がそもそもボタンを出さない。
export async function addPomoPlaylistFileHandles(handles) {
  return appendPomoPlaylist(handles.map((h) => ({
    id: genPomoId(),
    kind: 'filehandle',
    name: h.name || '（名前未取得の曲）',
    handle: h,
  })));
}
export async function addPomoPlaylistYoutube(videoId, name, url) {
  return appendPomoPlaylist([{
    id: genPomoId(),
    kind: 'youtube',
    name: name || url,
    videoId,
    url,
  }]);
}
export async function removePomoPlaylistSong(id) {
  const list = (await loadPomoPlaylist()).filter((s) => s.id !== id);
  await write(KEYS.pomoPlaylist, list);
  return list;
}
export const clearPomoPlaylist = () => remove(KEYS.pomoPlaylist);
// activeIdが一覧に無ければ先頭を返す（削除された曲が選ばれていた場合のフォールバック）。
// 一覧が空ならnull。
export async function loadActivePomoSong(activeId) {
  const list = await loadPomoPlaylist();
  if (!list.length) return null;
  return list.find((s) => s.id === activeId) || list[0];
}
// 旧・単曲版（pomoMusic）からの一度だけの移行。プレイリストが既に1曲以上あれば何もしない。
export async function migratePomoMusicToPlaylist() {
  const existing = await loadPomoPlaylist();
  if (existing.length > 0) return existing;
  const legacyBlob = await loadPomoMusic();
  if (!legacyBlob) return existing;
  return addPomoPlaylistFiles([legacyBlob]);
}

// ---- 自分の声で言い直した説明の録音（questionId別、Blob）----
// 「自分の言葉で言い直す」記憶術向け。端末の容量を使うため直近20件だけ保持する
// （古いものから自動で消える。pomoMusicと同じくBlobはJSONバックアップに乗らないため対象外）。
const SELF_VOICE_NOTES_CAP = 20;
export const loadSelfVoiceNotes = () => read(KEYS.selfVoiceNotes, []);
export async function saveSelfVoiceNote(questionId, blob) {
  const list = (await loadSelfVoiceNotes()).filter((n) => n.questionId !== questionId);
  list.unshift({ questionId, blob, at: Date.now() });
  const capped = list.slice(0, SELF_VOICE_NOTES_CAP);
  await write(KEYS.selfVoiceNotes, capped);
  return capped;
}
export async function deleteSelfVoiceNote(questionId) {
  const list = (await loadSelfVoiceNotes()).filter((n) => n.questionId !== questionId);
  await write(KEYS.selfVoiceNotes, list);
  return list;
}

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
  srsPaceMultiplier: 1, // 復習間隔の倍率（0.5〜2。1=標準、大きいほど間隔を伸ばしてゆっくり回す）
  dailyGoal: 300, // 1日の目標問題数（ハリオ先生の「今日の進捗」表示に使用）
  coverageThinThreshold: null, // 網羅マップ「手薄」の全科目共通しきい値（null=科目ごとの自動目安/既定値）
  coverageRichThreshold: null, // 網羅マップ「充実」の全科目共通しきい値（null=科目ごとの自動目安/既定値）
  reminder: { enabled: false, time: '07:00', lastNotified: '' }, // 毎日の学習リマインド通知
  a11y: { fontScale: 1, reduceMotion: false, highContrast: false }, // アクセシビリティ（文字の大きさ・低モーション・高コントラスト）
  // ボイスクローン（音声学習の読み上げ声）。APIキー本体は含まない（voiceCloneSecretへ別保存）。
  voiceClone: { enabled: false, voiceId: '', voiceName: '' },
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
// 「学習の進捗をリセット」で消すもの。解答の記録と、それをもとにした記録・続きの位置だけ。
// 問題・メモ・ブックマーク・語呂合わせ・模試の結果・設定は残す（画面の確認文と一致させる）。
export const PROGRESS_KEYS = [
  KEYS.srs, KEYS.history, KEYS.session, KEYS.quizProgress, KEYS.reviewProgress,
  KEYS.examProgress, KEYS.audioProgress,
  'shinkyu:missTypes', 'shinkyu:selfKindCounts', 'shinkyu:snoozeLog', 'shinkyu:reviewZeroLog',
  'shinkyu:roundLog', 'shinkyu:roundStartLog', 'shinkyu:audioReviewLog', 'shinkyu:rephraseLog',
  'shinkyu:voiceAnswerLog', 'shinkyu:streakBreakLog',
  // 経穴カードの復習の予定も「学習の進捗」なので一緒に消す（以前は残っていて、リセットしても期限のカードが出続けた）
  'shinkyu:flashcardSrs',
];
const PROGRESS_LS_KEYS = ['shinkyu:audioPlayHistory', 'shinkyu:audioProgressSync'];
export async function resetProgress() {
  for (const k of PROGRESS_KEYS) await remove(k);
  for (const k of PROGRESS_LS_KEYS) {
    try { localStorage.removeItem(k); } catch (e) { /* noop */ }
    mirrorToNative(k, null); // アプリ版の端末の控えも消す（残すと次に開いた時に戻ってくる）
  }
  await flushNow();
}
export async function resetAll() {
  for (const k of Object.values(KEYS)) await remove(k);
}

// ---- 全データのバックアップ / 復元 ----
// ---- 名前つきの項目に入っていない記録もまとめて持ち出す ----
// 誤答理由・復習ゼロの記録・先送り・週次ジャーナル・今日の調子・音声学習の実施ログ・
// 再生履歴など、各 lib が直接 idbGet/idbSet（または localStorage）で持っている記録は、
// 上の名前つきの項目に入っておらず、バックアップから復元しても戻らなかった
// （2026-11-23、アプリ版への引き継ぎで見つけた）。'shinkyu:' で始まるキーを丸ごと拾う。
// 入れないもの：大きい・端末にしか意味がない・秘密のもの。
const EXTRA_EXCLUDE = new Set([
  KEYS.pomoMusic, KEYS.pomoPlaylist, KEYS.selfVoiceNotes, KEYS.keizetsuPageImages, // 音声・写真（大きい）
  KEYS.voiceCloneSecret, // APIキー
  KEYS.cloudAuthPaused, KEYS.syncMeta, KEYS.migrated, KEYS.lastView, // この端末だけの状態
  'shinkyu:unlocked', 'shinkyu:pomoRun', 'shinkyu:errorLog',
  // 世代バックアップは exportAll 自身から作るので、入れると世代ごとに前の世代を抱えて膨らみ続ける
  'shinkyu:snapshots',
]);
const isExtraKey = (k) => typeof k === 'string' && k.startsWith('shinkyu:') && !EXTRA_EXCLUDE.has(k);

async function collectExtras(namedKeys) {
  const idb = {};
  const ls = {};
  try {
    await flushNow();
    if (useIdb) {
      const all = await idbGetAll();
      for (const [k, v] of Object.entries(all)) {
        if (!isExtraKey(k) || namedKeys.has(k)) continue;
        if (typeof Blob !== 'undefined' && v instanceof Blob) continue;
        idb[k] = v;
      }
    }
  } catch (e) { /* 拾えなくても名前つきの項目は出す */ }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!isExtraKey(k) || namedKeys.has(k) || k in idb) continue;
      ls[k] = localStorage.getItem(k);
    }
  } catch (e) { /* noop */ }
  return { idb, ls };
}

async function restoreExtras(extras) {
  if (!extras || typeof extras !== 'object') return;
  const idb = extras.idb && typeof extras.idb === 'object' ? extras.idb : {};
  const ls = extras.ls && typeof extras.ls === 'object' ? extras.ls : {};
  // 書き込み待ちの列（pending）を通して書く。直接 IndexedDB に書くと、復元の直前に
  // この端末で書き込み待ちになっていた同じキー（閲覧履歴など）があとから上書きしていた。
  for (const [k, v] of Object.entries(idb)) {
    if (isExtraKey(k)) await write(k, v);
  }
  for (const [k, v] of Object.entries(ls)) {
    if (!isExtraKey(k) || typeof v !== 'string') continue;
    try { localStorage.setItem(k, v); } catch (e) { /* noop */ }
    if (MIRRORED_KEYS.includes(k)) mirrorToNative(k, v);
  }
}

async function removeExtrasMissingFrom(extras) {
  const inIdb = extras.idb && typeof extras.idb === 'object' ? extras.idb : {};
  const inLs = extras.ls && typeof extras.ls === 'object' ? extras.ls : {};
  const keep = (k) => !isExtraKey(k) || NAMED_EXPORT_KEYS.has(k) || k in inIdb || k in inLs;
  try {
    if (useIdb) {
      const all = await idbGetAll();
      for (const k of Object.keys(all)) {
        if (keep(k)) continue;
        if (typeof Blob !== 'undefined' && all[k] instanceof Blob) continue;
        await remove(k);
      }
    }
  } catch (e) { /* 消せなくても復元は続ける */ }
  try {
    const lsKeys = [];
    for (let i = 0; i < localStorage.length; i++) lsKeys.push(localStorage.key(i));
    for (const k of lsKeys) {
      if (keep(k)) continue;
      localStorage.removeItem(k);
      if (MIRRORED_KEYS.includes(k)) mirrorToNative(k, null);
    }
  } catch (e) { /* noop */ }
}

// 名前つきで書き出しているキー（extras に二重に入れない）
const NAMED_EXPORT_KEYS = new Set([
  KEYS.questions, KEYS.srs, KEYS.history, KEYS.memos, KEYS.links, KEYS.schedule, KEYS.venues,
  KEYS.examContent, KEYS.selfNotes, KEYS.kwMeta, KEYS.userDict, KEYS.unread, KEYS.auth,
  KEYS.examResults, KEYS.settings, KEYS.bookmarks, KEYS.keiketsuLibrary, KEYS.quizProgress,
  KEYS.reviewProgress, KEYS.examProgress, KEYS.audioProgress, KEYS.session, KEYS.glossaryExtra,
  KEYS.glossaryRemovedIds, KEYS.tocCandidates, KEYS.tocHistory,
  'shinkyu:flashcardSrs', 'shinkyu:pronunciationReportLog',
]);

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
    // ログイン（パスワードのハッシュ・秘密の質問）は書き出さない。端末ごとの鍵で、
    // 復元でも持ち込まない（importAll）。ファイルはLINE・ドライブ等へ送られるので入れない方が安全。
    examResults: await loadExamResults(),
    settings: await read(KEYS.settings, {}),
    bookmarks: await loadBookmarks(),
    keiketsuLibrary: await loadKeiketsuLibrary(),
    // 「前回の続きから」（一問一答・復習・模試・音声・学習セッション）も別端末へ引き継ぐ
    quizProgress: await loadQuizProgress(),
    reviewProgress: await loadReviewProgress(),
    examProgress: await loadExamProgress(),
    audioProgress: await loadAudioProgress(),
    session: await loadSession(),
    // 用語集（目次・索引）：候補フローで承認された実行時追加分・削除・候補・履歴。
    // 使い込むほど増える実データ（本体データglossaryTerms.jsの再生成では復元できない）なので、
    // 問題バンクとは違いバックアップ・QR・クラウド同期の対象に含める。
    glossaryExtra: await loadGlossaryExtra(),
    glossaryRemovedIds: await loadGlossaryRemovedIds(),
    tocCandidates: await loadTocCandidates(),
    tocHistory: await loadTocHistory(),
    // 経穴カードのSRS（lib/flashcardSrs.js）。一問一答の本体SRS（KEYS.srs）とは別データ。
    // 元々idbGet/idbSetを直接使う独立実装のため、バックアップ・QR・クラウド自動同期の
    // どこにも含まれていなかった（実際に確認して見つかったバグ、2026-09-03修正）。
    flashcardSrs: await loadFlashcardSrs(),
    // 読み方の手動補正・誤読報告の履歴（lib/pronunciationReportLog.js）。用語集4キーを
    // 同期対象に入れ忘れて機種変更で消えていた過去の実例と同じミスを防ぐため、
    // 新設時から最初にバックアップ・QR・クラウド自動同期の対象に含める（2026-11-15）。
    pronunciationReportLog: await loadPronunciationReportLog(),
    // 上の名前に入っていない記録（誤答理由・復習ゼロの記録・週次ジャーナル・再生履歴など）
    extras: await collectExtras(NAMED_EXPORT_KEYS),
  };
}

// 端末ごとの設定は、復元・受け渡しで上書きしない（今の端末の値を残す）。
//   ログイン設定のスキップ／Googleドライブ連携（クライアントIDは開いている場所ごとに違う・
//   ログインも端末ごと）／ボイスクローン（APIキーは端末にしか無い）／選んでいる曲（曲は
//   バックアップに入らない）／イヤホンの確認／自動バックアップとその回数（ファイルはこの端末に書く）。
export const DEVICE_SETTING_KEYS = [
  'authSkipped', 'googleDriveAutoSync', 'googleDriveClientId', 'googleDriveLastSync',
  'voiceClone', 'audioHeadphoneConfirmedDate',
  'autoBackupOnStart', 'lastAutoBackup', 'answersSinceBackup',
];
export function keepDeviceSettings(incoming, current) {
  const out = { ...(incoming || {}) };
  const cur = current || {};
  for (const k of DEVICE_SETTING_KEYS) {
    if (k in cur) out[k] = cur[k];
    else delete out[k];
  }
  if (out.pomodoro && typeof out.pomodoro === 'object') {
    out.pomodoro = { ...out.pomodoro, activeSongId: cur.pomodoro ? cur.pomodoro.activeSongId : undefined };
  }
  return out;
}

// 同梱の問題を「どこまで追加したか」の印（eiseiVersion など・iryouSeeded）は、この端末の問題データの状態。
// 問題そのものを持ってこない受け渡し（QR・クラウド自動同期）で別の端末の印を持ち込むと、
// 「もう追加した」ことになって、この端末には新しい問題が二度と入らなかった（2026-11-26）。
// 問題も一緒に入っている丸ごとのバックアップでは、問題と印がそろっているのでそのまま使う。
// 語呂合わせの印（mnemonicsVersion）は語呂合わせ（kwMeta）と一緒に動くので対象外。
export const isSeedFlagKey = (k) => k === 'iryouSeeded' || (/^[a-z]+Version$/.test(k) && k !== 'mnemonicsVersion');
export function keepSeedFlags(incoming, current) {
  const out = { ...(incoming || {}) };
  const cur = current || {};
  for (const k of Object.keys(out)) if (isSeedFlagKey(k)) delete out[k];
  for (const k of Object.keys(cur)) if (isSeedFlagKey(k)) out[k] = cur[k];
  return out;
}

export async function importAll(data) {
  if (!data || typeof data !== 'object') throw new Error('不正なバックアップデータです');
  // この端末で書き込み待ちのものを先に確定させる（あとから復元した値を上書きさせない）
  await flushNow();
  // 先に名前の無い記録を戻し、名前つきの項目があとから上書きする（名前つきが正）
  await restoreExtras(data.extras);
  // 丸ごとのバックアップ（extras つき）なのに入っていない、この端末だけの記録は消す
  // （復元は「上書き」）。以前は音声の続き・再生履歴だけ消していて、今日の調子・誤答理由の傾向・
  // 周回ログなど、この端末にしか無かった記録が残り、復元した記録と混ざっていた（2026-11-25、2台で動かして見つけた）。
  // 消したものも、importBackup が復元前に取る世代バックアップから戻せる。
  if (data.extras && typeof data.extras === 'object') {
    await removeExtrasMissingFrom(data.extras);
  }
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
  // ログイン（端末内の鍵）は端末ごとのものなので、復元・受け渡しでは上書きしない。
  // 以前はバックアップ元のログインを持ち込んでいたため、ブラウザ版でログインを設定していると
  // 復元した瞬間に画面がログイン設定に切り替わり、読み込み直すと元の端末のIDとパスワードを
  // 求められて「復元できない」ように見えていた（data.auth は読まない）。
  if (Array.isArray(data.examResults)) await saveExamResults(data.examResults);
  if (data.settings && typeof data.settings === 'object') {
    const cur = await loadSettings();
    let next = keepDeviceSettings(data.settings, cur);
    if (!Array.isArray(data.questions)) next = keepSeedFlags(next, cur);
    await saveSettings(next);
  }
  if (data.bookmarks && typeof data.bookmarks === 'object') await saveBookmarks(data.bookmarks);
  if (Array.isArray(data.keiketsuLibrary)) await saveKeiketsuLibrary(data.keiketsuLibrary);
  if (data.quizProgress && typeof data.quizProgress === 'object') await saveQuizProgress(data.quizProgress);
  if (data.reviewProgress && typeof data.reviewProgress === 'object') await saveReviewProgress(data.reviewProgress);
  if (data.examProgress && typeof data.examProgress === 'object') await saveExamProgress(data.examProgress);
  if (data.audioProgress && typeof data.audioProgress === 'object') await saveAudioProgress(data.audioProgress);
  if (data.session && typeof data.session === 'object') await saveSession(data.session);
  // 丸ごとのバックアップ（extras つき）で「続きから」が空だった項目は、この端末に残った古い続きも消す。
  // 残すと、復元した記録と食い違う古い位置から「前回の続きから」が始まっていた。
  if (data.extras && typeof data.extras === 'object') {
    if ('quizProgress' in data && !data.quizProgress) await clearQuizProgress();
    if ('reviewProgress' in data && !data.reviewProgress) await clearReviewProgress();
    if ('examProgress' in data && !data.examProgress) await clearExamProgress();
    if ('audioProgress' in data && !data.audioProgress) await clearAudioProgress();
    if ('session' in data && !data.session) await clearSession();
  }
  if (Array.isArray(data.glossaryExtra)) await saveGlossaryExtra(data.glossaryExtra);
  if (Array.isArray(data.glossaryRemovedIds)) await saveGlossaryRemovedIds(data.glossaryRemovedIds);
  if (Array.isArray(data.tocCandidates)) await saveTocCandidates(data.tocCandidates);
  if (Array.isArray(data.tocHistory)) await saveTocHistory(data.tocHistory);
  if (data.flashcardSrs && typeof data.flashcardSrs === 'object') await saveFlashcardSrsRaw(data.flashcardSrs);
  if (Array.isArray(data.pronunciationReportLog)) await savePronunciationReportLogRaw(data.pronunciationReportLog);
}

// ---- 「前回の続きから」（一問一答・復習・模試・音声）のまとめ読み込み ----
// QR受け渡し（sync.js）は store の React state に無いこれらの値を個別に取得する必要があるため、
// SyncQR.jsx / MigrationGuide.jsx から共用する。
export async function loadResumeState() {
  return {
    quizProgress: await loadQuizProgress(),
    reviewProgress: await loadReviewProgress(),
    examProgress: await loadExamProgress(),
    audioProgress: await loadAudioProgress(),
  };
}
