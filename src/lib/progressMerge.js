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
export function mergeSettings(local, remote, remoteNewer) {
  return mergeObjectMap(local, remote, remoteNewer);
}

// local/remote: { srs, history, memos, links, examResults, settings }
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
  };
}
