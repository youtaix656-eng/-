// 人間分析のデータを、持ち出す／取り込む。
//
// 守ること:
//   1. **取り込みは必ず確認を出す**（画面側の役目）。ここは中身を検めるだけ。
//   2. **知らない形のものを黙って捨てない・黙って入れない。** 何件読めたかを返す。
//   3. **判定を持ち出さない。** 出るのは入力（チェックしたふるまい）と記録だけ。
//   4. ネットワークに触れない。ファイルの読み書きも画面側で行う。

export const FORMAT = 'kagami-people-v1';

/** 持ち出す形にする */
export function toExport({ cases = [], tries = [], myHabits = [], personView = {} } = {}) {
  return {
    format: FORMAT,
    at: Date.now(),
    cases,
    tries,
    myHabits,
    personView: { scene: personView.scene || '', core: personView.core || '' },
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
    return { ok: false, reason: 'ファイルの形が読めませんでした（JSONではないようです）', cases: [], tries: [], myHabits: [] };
  }
  if (!data || data.format !== FORMAT) {
    return {
      ok: false,
      reason: 'このアプリの人間分析の書き出しではないようです',
      cases: [], tries: [], myHabits: [],
    };
  }
  const cases = Array.isArray(data.cases) ? data.cases.filter((c) => c && c.id) : [];
  const tries = Array.isArray(data.tries) ? data.tries.filter((t) => t && t.id && t.tacticId) : [];
  const myHabits = Array.isArray(data.myHabits) ? data.myHabits.filter((h) => typeof h === 'string') : [];
  return { ok: true, cases, tries, myHabits };
}

/**
 * いまのものと混ぜる。**同じ id は、新しく直したほうを残す。**
 * 消したものが復活しないよう、片方にしか無いものはそのまま足す。
 */
export function mergeCases(mine = [], theirs = []) {
  const map = new Map(mine.map((c) => [c.id, c]));
  for (const c of theirs) {
    const cur = map.get(c.id);
    if (!cur || (c.updatedAt || 0) > (cur.updatedAt || 0)) map.set(c.id, c);
  }
  return [...map.values()];
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
