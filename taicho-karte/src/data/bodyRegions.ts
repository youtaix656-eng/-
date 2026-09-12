// 体の図の部位（単一の正）。1件足せば図・一覧・絞り込みが自動で追従する。
// 図は簡易な SVG（精緻さより動作優先）。座標は viewBox 0 0 200 420 の中。
//
// ⚠ 左右は「本人から見た左右」で持つ。前面図では本人の左が画面の右に来るので、
//    描く側（BodyMap.tsx）は side を見て x を反転せず、ここで x を直接持つ。
//    誤タップを防ぐため、図の中にも「左」「右」の文字を出す。

import type { Side } from '../types/index.js';

export type BodyView = 'front' | 'back';

export interface BodyRegion {
  id: string;
  /** 表示名（左右を含めない。左右は side で持つ） */
  label: string;
  /** 読み（並び替え・検索用。漢字の読みは機械で当てない） */
  reading: string;
  view: BodyView;
  /** 左右がある部位は 'left' | 'right'、正中の部位は null */
  side: Exclude<Side, 'both'>;
  /** 図の形（楕円か長方形。単位は viewBox） */
  shape: { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } | { kind: 'rect'; x: number; y: number; w: number; h: number };
}

// 前面図：画面左が本人の右
const R = 62; // 本人の右側（画面左）の中心 x
const L = 138; // 本人の左側（画面右）の中心 x
const C = 100;

function pair(
  base: string,
  label: string,
  reading: string,
  view: BodyView,
  make: (cx: number) => BodyRegion['shape'],
): BodyRegion[] {
  // 前面図は本人の右が画面左、背面図は本人の右が画面右
  const rightX = view === 'front' ? R : L;
  const leftX = view === 'front' ? L : R;
  return [
    { id: `${base}_r`, label, reading, view, side: 'right', shape: make(rightX) },
    { id: `${base}_l`, label, reading, view, side: 'left', shape: make(leftX) },
  ];
}

export const BODY_REGIONS: readonly BodyRegion[] = [
  // ── 前面 ──
  { id: 'head', label: '頭', reading: 'あたま', view: 'front', side: null, shape: { kind: 'ellipse', cx: C, cy: 34, rx: 22, ry: 26 } },
  { id: 'neck', label: '首（前）', reading: 'くび', view: 'front', side: null, shape: { kind: 'rect', x: 88, y: 60, w: 24, h: 18 } },
  ...pair('shoulder_front', '肩', 'かた', 'front', (cx) => ({ kind: 'ellipse', cx: cx + (cx < C ? 6 : -6), cy: 90, rx: 20, ry: 12 })),
  { id: 'chest', label: '胸', reading: 'むね', view: 'front', side: null, shape: { kind: 'rect', x: 70, y: 96, w: 60, h: 40 } },
  { id: 'abdomen', label: '腹', reading: 'はら', view: 'front', side: null, shape: { kind: 'rect', x: 72, y: 138, w: 56, h: 44 } },
  ...pair('upper_arm', '上腕', 'じょうわん', 'front', (cx) => ({ kind: 'rect', x: cx < C ? 30 : 152, y: 100, w: 18, h: 50 })),
  ...pair('elbow', '肘', 'ひじ', 'front', (cx) => ({ kind: 'ellipse', cx: cx < C ? 39 : 161, cy: 156, rx: 10, ry: 8 })),
  ...pair('forearm', '前腕', 'ぜんわん', 'front', (cx) => ({ kind: 'rect', x: cx < C ? 28 : 154, y: 166, w: 18, h: 46 })),
  ...pair('hand', '手', 'て', 'front', (cx) => ({ kind: 'ellipse', cx: cx < C ? 36 : 164, cy: 226, rx: 10, ry: 13 })),
  { id: 'pelvis_front', label: '骨盤・股関節', reading: 'こつばん', view: 'front', side: null, shape: { kind: 'rect', x: 70, y: 184, w: 60, h: 22 } },
  ...pair('thigh_front', '大腿（前）', 'だいたい', 'front', (cx) => ({ kind: 'rect', x: cx < C ? 70 : 104, y: 208, w: 26, h: 68 })),
  ...pair('knee', '膝', 'ひざ', 'front', (cx) => ({ kind: 'ellipse', cx: cx < C ? 83 : 117, cy: 288, rx: 13, ry: 11 })),
  ...pair('shin', '下腿（前）', 'かたい', 'front', (cx) => ({ kind: 'rect', x: cx < C ? 71 : 105, y: 302, w: 24, h: 66 })),
  ...pair('foot', '足', 'あし', 'front', (cx) => ({ kind: 'ellipse', cx: cx < C ? 82 : 118, cy: 388, rx: 14, ry: 10 })),

  // ── 背面（画面左が本人の左） ──
  { id: 'head_back', label: '後頭部', reading: 'こうとうぶ', view: 'back', side: null, shape: { kind: 'ellipse', cx: C, cy: 34, rx: 22, ry: 26 } },
  { id: 'neck_back', label: '首（後ろ）', reading: 'くび', view: 'back', side: null, shape: { kind: 'rect', x: 88, y: 60, w: 24, h: 18 } },
  ...pair('shoulder_back', '肩（後ろ）', 'かた', 'back', (cx) => ({ kind: 'ellipse', cx: cx + (cx < C ? 6 : -6), cy: 90, rx: 20, ry: 12 })),
  ...pair('scapula', '肩甲骨周り', 'けんこうこつ', 'back', (cx) => ({ kind: 'rect', x: cx < C ? 70 : 102, y: 100, w: 28, h: 34 })),
  { id: 'upper_back', label: '背中（胸椎）', reading: 'せなか', view: 'back', side: null, shape: { kind: 'rect', x: 92, y: 100, w: 16, h: 44 } },
  { id: 'lower_back', label: '腰', reading: 'こし', view: 'back', side: null, shape: { kind: 'rect', x: 72, y: 146, w: 56, h: 36 } },
  ...pair('upper_arm_back', '上腕（後ろ）', 'じょうわん', 'back', (cx) => ({ kind: 'rect', x: cx < C ? 30 : 152, y: 100, w: 18, h: 50 })),
  ...pair('forearm_back', '前腕（後ろ）', 'ぜんわん', 'back', (cx) => ({ kind: 'rect', x: cx < C ? 28 : 154, y: 158, w: 18, h: 54 })),
  ...pair('buttock', '殿部', 'でんぶ', 'back', (cx) => ({ kind: 'ellipse', cx: cx < C ? 84 : 116, cy: 198, rx: 16, ry: 14 })),
  ...pair('thigh_back', '大腿（後ろ）', 'だいたい', 'back', (cx) => ({ kind: 'rect', x: cx < C ? 70 : 104, y: 214, w: 26, h: 62 })),
  ...pair('knee_back', '膝裏', 'ひざうら', 'back', (cx) => ({ kind: 'ellipse', cx: cx < C ? 83 : 117, cy: 288, rx: 13, ry: 11 })),
  ...pair('calf', 'ふくらはぎ', 'ふくらはぎ', 'back', (cx) => ({ kind: 'rect', x: cx < C ? 71 : 105, y: 302, w: 24, h: 60 })),
  ...pair('achilles', 'アキレス腱・かかと', 'あきれすけん', 'back', (cx) => ({ kind: 'ellipse', cx: cx < C ? 83 : 117, cy: 384, rx: 12, ry: 12 })),
];

export function regionById(id: string): BodyRegion | undefined {
  return BODY_REGIONS.find((r) => r.id === id);
}

export function regionLabel(id: string): string {
  return regionById(id)?.label ?? id;
}

export const SIDE_LABELS: Record<Exclude<Side, null>, string> = {
  left: '左',
  right: '右',
  both: '両側',
};

export function sideLabel(side: Side): string {
  return side ? SIDE_LABELS[side] : '';
}

/** 「左 肩」のように、左右を含めた表示名 */
export function regionFullLabel(id: string, side: Side): string {
  const s = sideLabel(side);
  const l = regionLabel(id);
  return s ? `${s} ${l}` : l;
}

/** 部位の一覧（絞り込み用。左右をまとめ、表示名の重複を除く） */
export function regionGroups(): { key: string; label: string; ids: string[] }[] {
  const groups: { key: string; label: string; ids: string[] }[] = [];
  for (const r of BODY_REGIONS) {
    const key = r.side ? r.id.replace(/_(l|r)$/, '') : r.id;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: r.label, ids: [] };
      groups.push(g);
    }
    g.ids.push(r.id);
  }
  return groups;
}
