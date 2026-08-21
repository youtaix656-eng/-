// 症状レジストリ — 他症状へ拡張する時はここに追加するだけでよい（企画書 Phase 4）
import { LOW_BACK } from './lowBack.js';

export const SYMPTOMS = [LOW_BACK];

// Phase 4 で追加予定の症状（UIでは「準備中」として見せ、拡張の意図を残す）
export const PLANNED_SYMPTOMS = [
  { id: 'neck', name: '肩こり・頸部痛' },
  { id: 'knee', name: '膝痛' },
  { id: 'shoulder', name: '肩関節痛' },
];

export const SYMPTOM_MAP = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s]));

export function symptomById(id) {
  return SYMPTOM_MAP[id] || SYMPTOMS[0];
}
