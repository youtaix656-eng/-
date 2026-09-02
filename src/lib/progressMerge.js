// 複数端末の進捗（srs/history/memos/links/examResults/settings）を単純上書きせずマージする。
// クラウド自動同期（CloudBackup.jsx／useStore.js）専用。単純に「新しい方で全部上書き」だと、
// 例えば端末Aで解いた直後に端末Bを開いた場合にAの進捗が消えることがあるため、
// 種類ごとに適したマージ規則を使う。

// srs: 問題ID単位。lastAnswered（無ければdue）がより新しい方のエントリを採用する。
export function mergeSrs(local, remote) {
  const out = { ...(local || {}) };
  for (const [id, r] of Object.entries(remote || {})) {
    const l = out[id];
    if (!l) { out[id] = r; continue; }
    const lt = l.lastAnswered ?? l.due ?? 0;
    const rt = r.lastAnswered ?? r.due ?? 0;
    if (rt > lt) out[id] = r;
  }
  return out;
}

// history: 追記型なのでUNION（同一の解答記録は重複除去）。時刻順に並べ直す。
export function mergeHistory(local, remote) {
  const seen = new Set();
  const out = [];
  for (const e of [...(local || []), ...(remote || [])]) {
    if (!e) continue;
    const key = `${e.questionId}|${e.at}|${e.correct}|${e.source || ''}|${e.selfKind || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  out.sort((a, b) => (a.at || 0) - (b.at || 0));
  return out;
}

// examResults: idでUNION（模試の結果は追記型）
export function mergeExamResults(local, remote) {
  const byId = new Map();
  for (const e of [...(local || []), ...(remote || [])]) {
    if (e && e.id) byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
}

// memos/links等のオブジェクトマップ: キー単位でUNIONし、競合したキーは
// 全体として新しい側（remoteNewer）の値を優先する（片方にしかないキーは残す）。
export function mergeObjectMap(local, remote, remoteNewer) {
  return remoteNewer ? { ...(local || {}), ...(remote || {}) } : { ...(remote || {}), ...(local || {}) };
}

// settings: 個々のフィールドの新旧を判定する手段が無いため、全体として新しい側を優先しつつ、
// 古い側にしかないキー（新しい側のアプリバージョンでは無いフィールド等）は残す。
//
// ただしpomodoro（ポモドーロタイマーの設定）だけは例外で、自分自身の更新時刻
// （settings.pomodoro.updatedAt、Pomodoro.jsx/PomodoroConfigFields.jsxのsetCfgが
// 毎回更新する）で新旧を判定する。settings全体のnewer判定は「他のどれか1つの設定を
// 変えた時刻」でしかないため、それだけを基準にpomodoroごと丸ごと入れ替えると、
// 無関係な設定を別端末で変えただけでポモドーロの設定が古い値に巻き戻ってしまう
// （実際に起こりうる「ポモドーロがリセットされたように見える」原因の1つ）。
export function mergeSettings(local, remote, remoteNewer) {
  const merged = mergeObjectMap(local, remote, remoteNewer);
  merged.pomodoro = pickNewerByOwnTimestamp(local?.pomodoro, remote?.pomodoro, 'updatedAt');
  return merged;
}

// 一問一答・模試・復習・音声・学習セッションの「続きから」（1つの活動を表す単一オブジェクト）。
// memos/linksのようなキー単位マージはできない（idの並びやidxなど、オブジェクト全体で
// 一貫していないと壊れる）ため、各オブジェクト自身が持つ時刻（at、sessionだけstartedAt）を見て、
// より新しい方をまるごと採用する（ユーザー指定により、あえて対象外にしていたものを含める）。
function pickNewerByOwnTimestamp(local, remote, timeKey = 'at') {
  if (!local) return remote || null;
  if (!remote) return local;
  const lt = typeof local[timeKey] === 'number' ? local[timeKey] : 0;
  const rt = typeof remote[timeKey] === 'number' ? remote[timeKey] : 0;
  return rt > lt ? remote : local;
}

export function mergeResumeState(local, remote) {
  const l = local || {};
  const r = remote || {};
  return {
    quizProgress: pickNewerByOwnTimestamp(l.quizProgress, r.quizProgress),
    examProgress: pickNewerByOwnTimestamp(l.examProgress, r.examProgress),
    reviewProgress: pickNewerByOwnTimestamp(l.reviewProgress, r.reviewProgress),
    audioProgress: pickNewerByOwnTimestamp(l.audioProgress, r.audioProgress),
    session: pickNewerByOwnTimestamp(l.session, r.session, 'startedAt'),
  };
}

// マージ結果が元のlocalと実質的に異なるか（＝端末の状態へ反映する価値があるか）を判定する。
// 単純な件数比較（Object.keys(...).length）だと、既存の問題IDのlastAnswered/dueだけが
// 新しく更新されたケース（件数は変わらず値だけ変わる、実運用で最も多いパターン）を
// 「変化なし」と誤判定してしまう（useStore.jsのクラウド自動同期で実際に発生していたバグ）。
// 中身まで比較することで、件数が同じでも値が更新されていれば正しく「変化あり」を返す。
export function progressChanged(local, merged) {
  const l = local || {};
  const m = merged || {};
  return (
    JSON.stringify(m.srs) !== JSON.stringify(l.srs) ||
    JSON.stringify(m.history) !== JSON.stringify(l.history) ||
    JSON.stringify(m.memos) !== JSON.stringify(l.memos) ||
    JSON.stringify(m.links) !== JSON.stringify(l.links) ||
    JSON.stringify(m.examResults) !== JSON.stringify(l.examResults) ||
    JSON.stringify(m.bookmarks) !== JSON.stringify(l.bookmarks) ||
    JSON.stringify(m.quizProgress) !== JSON.stringify(l.quizProgress) ||
    JSON.stringify(m.examProgress) !== JSON.stringify(l.examProgress) ||
    JSON.stringify(m.reviewProgress) !== JSON.stringify(l.reviewProgress) ||
    JSON.stringify(m.audioProgress) !== JSON.stringify(l.audioProgress) ||
    JSON.stringify(m.session) !== JSON.stringify(l.session)
  );
}

// local/remote: { srs, history, memos, links, examResults, settings, bookmarks,
//                 quizProgress, examProgress, reviewProgress, audioProgress, session }
// localUpdatedAt/remoteUpdatedAt: lib/storage.jsのsyncMeta.updatedAt（ミリ秒epoch）
export function mergeProgress(local, remote, { localUpdatedAt = 0, remoteUpdatedAt = 0 } = {}) {
  const remoteNewer = remoteUpdatedAt > localUpdatedAt;
  return {
    srs: mergeSrs(local?.srs, remote?.srs),
    history: mergeHistory(local?.history, remote?.history),
    memos: mergeObjectMap(local?.memos, remote?.memos, remoteNewer),
    links: mergeObjectMap(local?.links, remote?.links, remoteNewer),
    examResults: mergeExamResults(local?.examResults, remote?.examResults),
    settings: mergeSettings(local?.settings, remote?.settings, remoteNewer),
    // ブックマークはメモ・リンクと同じくキー単位のUNION（片方の端末だけで付けた印を消さない）。
    // QR／バックアップファイル／WebRTC経由の移行では既に引き継がれていたが、
    // クラウド自動同期の対象からは漏れていたため合わせる。
    bookmarks: mergeObjectMap(local?.bookmarks, remote?.bookmarks, remoteNewer),
    // 一問一答・模試・復習・音声・学習セッションの「続きから」。ユーザー指定により
    // クラウド自動同期の対象に含める（各自身のタイムスタンプで新しい方をまるごと採用）。
    ...mergeResumeState(local, remote),
  };
}
