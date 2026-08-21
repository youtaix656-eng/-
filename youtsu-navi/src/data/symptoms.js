// 症状レジストリ — 他症状へ拡張する時はここに追加するだけでよい（企画書 Phase 4）
import { LOW_BACK } from './lowBack.js';
import { NECK } from './neck.js';
import { KNEE } from './knee.js';

/** 対応している症状（評価画面で選べる） */
export const SYMPTOMS = [LOW_BACK, NECK, KNEE];

// さらに追加を検討している症状（UIでは「準備中」として見せ、拡張の意図を残す）
export const PLANNED_SYMPTOMS = [
  { id: 'shoulder', name: '肩関節痛（腱板障害など）' },
  { id: 'elbow', name: '肘の痛み' },
  { id: 'ankle', name: '足首・足部の痛み' },
];

export const SYMPTOM_MAP = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s]));

export function symptomById(id) {
  return SYMPTOM_MAP[id] || SYMPTOMS[0];
}
