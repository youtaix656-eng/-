// 初期データ。起動時に1度だけ「会社を設立」する。
//
// 1役職につき3席（seatsPerRole）が初期値。**定数ではない**ので
// あとから増席できる（hireEmployee({roleId, seat:4}) だけで足りる）。

import { newId } from './id.js';
import { DEPARTMENTS, ROLES } from '../data/roles.js';
import { initialPresets, presetEmployee } from '../data/employees.js';
import { DEFAULT_GENRE_ID, DEFAULT_SEATS_PER_GENRE } from '../data/genres.js';
import { DEFAULT_PLAN_ID } from '../data/plans.js';
import { DEFAULT_PERMISSIONS } from './permissions.js';
import { SCOPES } from './memory.js';

// 「1つの組（役職×ジャンル）に3席」の初期値。定数ではない（増席できる）。
export const DEFAULT_SEATS_PER_ROLE = DEFAULT_SEATS_PER_GENRE;

export function makeCompany(name = 'あなたのAI会社') {
  return {
    id: newId('co'),
    name,
    ownerName: 'オーナー',
    foundedAt: Date.now(),
    planId: DEFAULT_PLAN_ID,
    seatsPerRole: DEFAULT_SEATS_PER_ROLE, // 1組（役職×ジャンル）あたりの席数
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
    genreId: preset.genreId || DEFAULT_GENRE_ID,
    departmentId: preset.departmentId,
    seat: preset.seat || 1,
    // 目次の並びに使う読み。漢字を含む名前は必ずここに持たせる（推定しない）。
    reading: preset.reading || '',
    title: preset.title,
    specialties: preset.specialties || [],
    persona: preset.persona || '',
    style: preset.style || '',
    strength: preset.strength || '',
    seatHint: preset.seatHint || '',
    genreHint: preset.genreHint || '',
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

/**
 * 新しく席を増やすときの席番号。**組（役職×ジャンル）の中で**空いている番号を返す。
 * 役職だけで数えると、別ジャンルの席が埋まっているせいで番号が飛んでしまう。
 */
export function nextSeat(employees, roleId, genreId = DEFAULT_GENRE_ID) {
  const used = employees
    .filter((e) => e.roleId === roleId && (e.genreId || DEFAULT_GENRE_ID) === genreId && !e.archivedAt)
    .map((e) => e.seat || 1);
  let seat = 1;
  while (used.includes(seat)) seat += 1;
  return seat;
}

export function presetForNextSeat(employees, roleId, genreId = DEFAULT_GENRE_ID, customGenres = []) {
  const seat = nextSeat(employees, roleId, genreId);
  return presetEmployee(roleId, seat, genreId, customGenres);
}

/** その組（役職×ジャンル）に在籍している社員（席順）。 */
export function seatsOf(employees, roleId, genreId = DEFAULT_GENRE_ID) {
  return employees
    .filter((e) => e.roleId === roleId && (e.genreId || DEFAULT_GENRE_ID) === genreId && !e.archivedAt)
    .sort((a, b) => (a.seat || 1) - (b.seat || 1));
}

/** その組がいっぱいか（既定の3席まで埋まっているか）。 */
export function isGenreFull(employees, roleId, genreId, seatsPerGenre = DEFAULT_SEATS_PER_GENRE) {
  return seatsOf(employees, roleId, genreId).length >= seatsPerGenre;
}

export { ROLES };
