// 「気になったやりとり」の記録。
//
// 守ること:
//   1. **相手の氏名・連絡先を持たない。** 場面（メッセージ・デート中・交際中…）だけを持つ。
//      名前を書ける欄を作ると、そこに必ず名前が入り、端末を見られたときに
//      いちばん危ないものになる。争うためではなく、自分が迷わないための記録。
//   2. 本文は **既定で伏せてから**保存する（privacy.mask）。
//      伏せずに残す選択もできるが、既定は伏せる側。
//   3. **記録に「相手が悪い」という判定を持たせない。** 残すのは
//      いつ・どこで・どの型の言い回しに当たったか、だけ。

import { mask } from './privacy.js';
import { GLYPHS } from '../data/glyphs.js';

/** 場面（自由記述にしない＝氏名が書き込まれる欄を作らない） */
export const PLACES = [
  { id: 'message', label: 'メッセージ・通話', icon: GLYPHS.squareSmall },
  { id: 'app', label: 'マッチングアプリ・SNS', icon: GLYPHS.diamondInset },
  { id: 'date', label: '会っているとき', icon: GLYPHS.diamond },
  { id: 'partner', label: '付き合っている相手', icon: GLYPHS.infinity },
  { id: 'ending', label: '別れ話・別れたあと', icon: GLYPHS.moonWane },
  { id: 'other', label: 'その他', icon: GLYPHS.squareFilled },
];

export const PLACE_MAP = Object.fromEntries(PLACES.map((p) => [p.id, p]));

let seq = 0;
function newId(now) {
  seq += 1;
  return `r${now}-${seq}`;
}

/**
 * 記録を1件作る。
 * @param {{text?:string, placeId?:string, tacticIds?:string[],
 *          note?:string, keepRaw?:boolean, at?:number, id?:string}} input
 */
export function makeRecord(input = {}) {
  const at = Number(input.at) || Date.now();
  const raw = String(input.text || '');
  const placeId = PLACE_MAP[input.placeId] ? input.placeId : 'other';
  return {
    id: input.id || newId(at),
    at,
    placeId,
    // 既定は伏せる。keepRaw を明示したときだけそのまま残す。
    text: input.keepRaw ? raw : mask(raw),
    masked: !input.keepRaw,
    tacticIds: [...new Set((input.tacticIds || []).filter(Boolean))],
    // メモも伏せる（ここに名前が書かれやすい）
    note: mask(String(input.note || '')),
  };
}

/** 新しい順 */
export function sortRecords(records = []) {
  return [...records].sort((a, b) => b.at - a.at);
}

/**
 * どの型に何回当たったかを数える。**「相手は◯◯な人」と書かない**——
 * 出すのは自分が残した記録の中の回数だけで、性格の判定ではない。
 * @returns {Array<{tacticId:string, count:number}>} 多い順
 */
export function countByTactic(records = []) {
  const counts = new Map();
  for (const r of records) for (const id of r.tacticIds || []) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts.entries()]
    .map(([tacticId, count]) => ({ tacticId, count }))
    .sort((a, b) => b.count - a.count || a.tacticId.localeCompare(b.tacticId));
}

/** 場面ごとの件数（多い順） */
export function countByPlace(records = []) {
  const counts = new Map();
  for (const r of records) counts.set(r.placeId, (counts.get(r.placeId) || 0) + 1);
  return PLACES.map((p) => ({ place: p, count: counts.get(p.id) || 0 })).filter((x) => x.count > 0);
}
