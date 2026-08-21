// カルテ（施術記録）— 企画書 Phase 2
//
// ⚠ プライバシー方針（storage.js と同じく端末内のみ）:
//   - お客様の氏名・連絡先・生年月日などの個人情報は入力させない設計。
//     識別は「表示名」（A様／山田T など、本人が分かる範囲の短い呼び名）だけにする。
//   - 外部送信は行わない。書き出し（exporter.js）は施術者自身の操作でのみ動く。
//
// ここは純粋なデータ操作だけを持つ（Reactに依存しない＝テストできる）。

export const MAX_RECORDS = 500; // 端末の保存容量を圧迫しないための上限
export const CLIENT_LABEL_MAX = 20;

/** 表示名の正規化。長すぎる入力・空白のみは弾く（個人情報を書き込ませない配慮） */
export function normalizeLabel(text) {
  const s = String(text ?? '').trim().replace(/\s+/g, ' ');
  return s.slice(0, CLIENT_LABEL_MAX);
}

/**
 * 評価結果からカルテ1件を作る。
 * @param {object} src { at, symptomId, answers, tags }
 */
export function makeRecord(src, extra = {}) {
  const at = src.at || extra.at || 0;
  return {
    id: `rec-${at}-${String(extra.seed ?? at).slice(-4)}`,
    at,
    updatedAt: at,
    clientLabel: normalizeLabel(extra.clientLabel || ''),
    symptomId: src.symptomId,
    answers: src.answers || {},
    tags: src.tags || [],
    triageLevel: extra.triageLevel || 'clear',
    topPatternId: extra.topPatternId || null,
    topPatternName: extra.topPatternName || '',
    topPercent: typeof extra.topPercent === 'number' ? extra.topPercent : null,
    pain: typeof extra.pain === 'number' ? extra.pain : null,
    memo: '',
    followUp: '',
  };
}

/** 新しい順 */
export function sortRecords(list = []) {
  return [...list].sort((a, b) => b.at - a.at);
}

/** 保存（同じidがあれば更新、無ければ追加）。件数上限を超えたら古いものから捨てる */
export function upsertRecord(list = [], record) {
  const rest = list.filter((r) => r.id !== record.id);
  return sortRecords([record, ...rest]).slice(0, MAX_RECORDS);
}

export function removeRecord(list = [], id) {
  return list.filter((r) => r.id !== id);
}

/** 絞り込み。query は表示名・メモ・候補名を対象にする */
export function filterRecords(list = [], { query = '', level = 'all', label = 'all' } = {}) {
  const q = String(query).trim().toLowerCase();
  return list.filter((r) => {
    if (level !== 'all' && r.triageLevel !== level) return false;
    if (label !== 'all' && (r.clientLabel || '') !== label) return false;
    if (!q) return true;
    return [r.clientLabel, r.memo, r.followUp, r.topPatternName]
      .filter(Boolean)
      .some((t) => String(t).toLowerCase().includes(q));
  });
}

/** 表示名の一覧（絞り込みのプルダウン用。件数の多い順） */
export function clientLabels(list = []) {
  const counts = new Map();
  for (const r of list) {
    const label = r.clientLabel || '';
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([label, count]) => ({ label, count }));
}

/** 同じ表示名の記録だけを新しい順で返す（経過を追うため） */
export function historyOf(list = [], clientLabel) {
  const label = normalizeLabel(clientLabel);
  if (!label) return [];
  return sortRecords(list.filter((r) => r.clientLabel === label));
}

/** 直前の記録（同じ表示名で、その記録より前のもの） */
export function previousOf(list = [], record) {
  if (!record || !record.clientLabel) return null;
  return historyOf(list, record.clientLabel).find((r) => r.at < record.at) || null;
}

/**
 * 前回との比較。ペインスケールの変化とトリアージの変化を文章化する。
 * 数字が無い時は無理に評価しない（憶測で「改善」と言わない）。
 */
export function compareWithPrevious(record, previous) {
  if (!previous) return null;
  const days = Math.max(0, Math.round((record.at - previous.at) / 86400000));
  const out = { days, painDelta: null, painText: '', triageChanged: previous.triageLevel !== record.triageLevel };
  if (typeof record.pain === 'number' && typeof previous.pain === 'number') {
    const delta = record.pain - previous.pain;
    out.painDelta = delta;
    if (delta < 0) out.painText = `ペインスケールが ${previous.pain} → ${record.pain}（${Math.abs(delta)}ポイント低下）`;
    else if (delta > 0) out.painText = `ペインスケールが ${previous.pain} → ${record.pain}（${delta}ポイント上昇）`;
    else out.painText = `ペインスケールは ${record.pain} のまま変わっていません`;
  }
  return out;
}

/** ペインスケールの推移（グラフ用。数値が入っている記録だけを古い順に） */
export function painTrend(list = [], clientLabel) {
  return historyOf(list, clientLabel)
    .filter((r) => typeof r.pain === 'number')
    .sort((a, b) => a.at - b.at)
    .map((r) => ({ at: r.at, pain: r.pain, id: r.id }));
}

/** 一覧の集計（カルテ画面のヘッダー表示用） */
export function summarizeRecords(list = []) {
  const total = list.length;
  const clients = clientLabels(list).length;
  const needsCare = list.filter((r) => r.triageLevel === 'stop' || r.triageLevel === 'refer').length;
  const last = sortRecords(list)[0] || null;
  return { total, clients, needsCare, lastAt: last ? last.at : null };
}
