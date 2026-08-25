// 初期データ。起動時に1度だけ「会社を設立」する。
//
// 1役職につき3席（seatsPerRole）が初期値。**定数ではない**ので
// あとから増席できる（hireEmployee({roleId, seat:4}) だけで足りる）。

import { newId } from './id.js';
import { DEPARTMENTS, ROLES } from '../data/roles.js';
import { initialPresets, presetEmployee } from '../data/employees.js';
import { DEFAULT_PLAN_ID } from '../data/plans.js';
import { DEFAULT_PERMISSIONS } from './permissions.js';
import { SCOPES } from './memory.js';

export const DEFAULT_SEATS_PER_ROLE = 3;

export function makeCompany(name = 'あなたのAI会社') {
  return {
    id: newId('co'),
    name,
    ownerName: 'オーナー',
    foundedAt: Date.now(),
    planId: DEFAULT_PLAN_ID,
    seatsPerRole: DEFAULT_SEATS_PER_ROLE,
    limitOverrides: {},
    motto: 'AIを使うのではなく、AIを雇う。',
  };
}

export function makeEmployee(preset, extra = {}) {
  const now = Date.now();
  return {
    id: newId('emp'),
    name: preset.name,
    shortName: preset.shortName || preset.name,
    avatar: preset.avatar || '◉',
    roleId: preset.roleId,
    departmentId: preset.departmentId,
    seat: preset.seat || 1,
    title: preset.title,
    specialties: preset.specialties || [],
    persona: preset.persona || '',
    style: preset.style || '',
    strength: preset.strength || '',
    seatHint: preset.seatHint || '',
    providerPref: 'auto',
    modelPref: 'auto',
    toolIds: preset.toolIds || ['knowledge'],
    // 既定は「会社共通 + 自分の記憶」。部署限定にしたいときは scopes を絞る。
    knowledgeScopes: [SCOPES.company, SCOPES.self],
    permissions: { ...DEFAULT_PERMISSIONS },
    autoRun: false,
    memory: { notes: [] },
    stats: { tasks: 0, knowledge: 0, tokens: 0, costUsd: 0, lastActiveAt: null },
    rating: 0,
    hiredAt: now,
    archivedAt: null,
    ...extra,
  };
}

/** 起動時の一式。 */
export function seedAll(companyName) {
  const company = makeCompany(companyName);
  const employees = initialPresets(company.seatsPerRole).map((p) => makeEmployee(p));
  return {
    company,
    departments: DEPARTMENTS.map((d) => ({ ...d })),
    employees,
    settings: makeSettings(),
  };
}

export function makeSettings() {
  return {
    routerMode: 'auto', // 'auto' | 'manual'
    autoApproveCost: false, // コストのかかる実行を毎回確認するか
    maxTokens: 8000,
    usdJpy: 155, // 円換算の目安（設定で変えられる）
    splashSeen: false,
    theme: 'ouro',
  };
}

/** 新しく席を増やすときのプリセット（既存の席と重ならない番号を返す）。 */
export function nextSeat(employees, roleId) {
  const used = employees.filter((e) => e.roleId === roleId && !e.archivedAt).map((e) => e.seat || 1);
  let seat = 1;
  while (used.includes(seat)) seat += 1;
  return seat;
}

export function presetForNextSeat(employees, roleId) {
  const seat = nextSeat(employees, roleId);
  return presetEmployee(roleId, seat);
}

export { ROLES };
