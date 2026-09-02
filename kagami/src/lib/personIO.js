// 人間分析のデータを、持ち出す／取り込む。
//
// 守ること:
//   1. **取り込みは必ず確認を出す**（画面側の役目）。ここは中身を検めるだけ。
//   2. **知らない形のものを黙って捨てない・黙って入れない。** 何件読めたかを返す。
//   3. **判定を持ち出さない。** 出るのは入力（チェックしたふるまい）と記録だけ。
//   4. ネットワークに触れない。ファイルの読み書きも画面側で行う。

import { normalizeCase } from './cases.js';
import { makeTry } from './tried.js';

export const FORMAT = 'kagami-people-v1';

/** 持ち出す形にする */
export function toExport({ cases = [], tries = [], myHabits = [], personView = {} } = {}) {
  return {
    format: FORMAT,
    at: Date.now(),
    cases,
    tries,
    myHabits,
    // しぼり込みと「隠した手」も持ち出す（取り込み側でも同じものを読む）。
    // さがした語（history）は入れない——人に渡すものに検索履歴を混ぜない。
    personView: {
      scene: personView.scene || '',
      core: personView.core || '',
      sort: personView.sort || 'catalog',
      filters: Array.isArray(personView.filters) ? personView.filters : [],
      hiddenByType: personView.hiddenByType && typeof personView.hiddenByType === 'object'
        ? personView.hiddenByType
        : {},
    },
  };
}

/**
 * 取り込む前に検める。
 * @returns {{ok:boolean, reason?:string, cases:Array, tries:Array, myHabits:Array}}
 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(String(text || ''));
  } catch {
    return {
      ok: false,
      reason: 'ファイルの形が読めませんでした（JSONではないようです）',
      cases: [], tries: [], myHabits: [], personView: null,
    };
  }
  if (!data || data.format !== FORMAT) {
    return {
      ok: false,
      reason: 'このアプリの人間分析の書き出しではないようです',
      cases: [], tries: [], myHabits: [], personView: null,
    };
  }
  // **形の足りないものを、そのまま画面へ渡さない。**
  // checkedIds や note が無いだけで画面が落ちる（実際に踏んだ）。
  const cases = Array.isArray(data.cases)
    ? data.cases.map((c) => normalizeCase(c)).filter(Boolean)
    : [];
  const tries = Array.isArray(data.tries)
    ? data.tries.filter((t) => t && t.id && t.tacticId).map((t) => makeTry(t))
    : [];
  const myHabits = Array.isArray(data.myHabits) ? data.myHabits.filter((h) => typeof h === 'string') : [];
  const pv = data.personView && typeof data.personView === 'object' ? data.personView : {};
  const personView = {
    scene: typeof pv.scene === 'string' ? pv.scene : '',
    core: typeof pv.core === 'string' ? pv.core : '',
    sort: typeof pv.sort === 'string' ? pv.sort : '',
    filters: Array.isArray(pv.filters) ? pv.filters.filter((f) => f && typeof f.name === 'string') : [],
    hiddenByType: pv.hiddenByType && typeof pv.hiddenByType === 'object' && !Array.isArray(pv.hiddenByType)
      ? pv.hiddenByType
      : {},
  };
  return { ok: true, cases, tries, myHabits, personView };
}

/**
 * いまのものと混ぜる。**同じ id は、新しく直したほうを残す。**
 * 消したものが復活しないよう、片方にしか無いものはそのまま足す。
 */
export function mergeCases(mine = [], theirs = []) {
  const map = new Map(mine.map((c) => [c.id, c]));
  for (const c of theirs) {
    const cur = map.get(c.id);
    if (!cur) {
      map.set(c.id, c);
      continue;
    }
    if ((c.updatedAt || 0) <= (cur.updatedAt || 0)) continue;
    // **上書きで版を消さない。** あとから直したほうを採るときも、
    // こちらの「移り変わり」と「いつ見たか」は残す（取り込みで履歴が消えていた）。
    map.set(c.id, {
      ...c,
      snapshots: mergeSnapshots(cur, c),
      seenAt: mergeSeenAt(cur.seenAt, c.seenAt),
    });
  }
  return [...map.values()];
}

/** 両方の版を時刻で並べ、同じ時刻は1つにする。いまの中身も版として残す */
function mergeSnapshots(mine, theirs) {
  const all = [
    ...(mine.snapshots || []),
    { at: mine.updatedAt, checkedIds: mine.checkedIds || [] },
    ...(theirs.snapshots || []),
  ];
  const seen = new Set();
  return all
    .filter((s) => s && Array.isArray(s.checkedIds))
    .filter((s) => (seen.has(s.at) ? false : seen.add(s.at)))
    .sort((a, b) => b.at - a.at)
    .slice(0, 20);
}

/** 「いつ見たか」は**早いほう**を残す（あとから来た日付で上書きしない） */
function mergeSeenAt(mine = {}, theirs = {}) {
  const out = { ...theirs };
  for (const [id, at] of Object.entries(mine)) {
    out[id] = out[id] ? Math.min(out[id], at) : at;
  }
  return out;
}

/**
 * しぼり込みと「隠した手」を混ぜる。**いまのものを消さない**——
 * 隠した手は型ごとに足し合わせ、名前つきのしぼり込みは同じ名前だけ上書きする。
 */
export function mergePersonView(mine = {}, theirs = null) {
  if (!theirs) return mine;
  const hidden = { ...(mine.hiddenByType || {}) };
  for (const [typeId, ids] of Object.entries(theirs.hiddenByType || {})) {
    if (!Array.isArray(ids)) continue;
    hidden[typeId] = [...new Set([...(hidden[typeId] || []), ...ids])];
  }
  const names = new Set((theirs.filters || []).map((f) => f.name));
  return {
    ...mine,
    scene: theirs.scene || mine.scene || '',
    core: theirs.core || mine.core || '',
    sort: theirs.sort || mine.sort || 'catalog',
    filters: [...(mine.filters || []).filter((f) => !names.has(f.name)), ...(theirs.filters || [])].slice(-8),
    hiddenByType: hidden,
  };
}

export function mergeTries(mine = [], theirs = []) {
  const map = new Map(mine.map((t) => [t.id, t]));
  for (const t of theirs) if (!map.has(t.id)) map.set(t.id, t);
  return [...map.values()];
}

/** 相談する時に渡す形（事実だけ・時系列） */
export function toConsultText({ label = '', sceneLabel = '', rows = [] } = {}) {
  const out = [];
  out.push(`【相談したいこと】${label || '（呼び名なし）'}${sceneLabel ? `／${sceneLabel}` : ''}`);
  out.push('');
  out.push('■ 起きたこと（見た順）');
  if (rows.length === 0) out.push('（まだ書いていません）');
  for (const r of rows) out.push(`・${r.when ? `${r.when} ` : ''}${r.text}`);
  out.push('');
  out.push('※ 事実として見たことだけを並べています。相手がどういう人かの判断は入れていません。');
  return out.join('\n');
}
