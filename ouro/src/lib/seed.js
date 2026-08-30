// 初期データ。起動時に1度だけ「会社を設立」する。
//
// 1つの組（役職 × ジャンル）につき3席（seatsPerGenre）が初期値。**定数ではない**ので
// あとから増席できる（hireEmployee({roleId, seat:4}) だけで足りる）。

import { newId } from './id.js';
import { DEPARTMENTS, ROLES } from '../data/roles.js';
import { initialPresets, presetEmployee } from '../data/employees.js';
import { nextSeat } from './seats.js';
import { DEFAULT_SEATS_PER_GENRE } from '../data/genres.js';
import { makeSettings } from './defaults.js';
import { DEFAULT_GENRE_ID } from '../data/genres.js';
import { DEFAULT_PLAN_ID } from '../data/plans.js';
import { DEFAULT_PERMISSIONS } from './permissions.js';
import { SCOPES } from './memory.js';

// 席を数える処理と設定の初期値は、起動時に読まれる画面でも使うので別ファイルにある
// （新項目04）。ここから読めるよう、そのまま出し直す。
export { DEFAULT_SEATS_PER_GENRE, nextSeat, seatsOf, isGenreFull } from './seats.js';
export { makeSettings };

export function makeCompany(name = 'あなたのAI会社') {
  return {
    id: newId('co'),
    name,
    ownerName: 'オーナー',
    foundedAt: Date.now(),
    planId: DEFAULT_PLAN_ID,
    seatsPerGenre: DEFAULT_SEATS_PER_GENRE, // 1組（役職×ジャンル）あたりの席数
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
    kana: preset.kana || '', // カタカナ表記（外国名のキャラクター用）
    origin: preset.origin || '', // 出身の系統（人物像。肖像の絵には持ち込まない）
    portrait: preset.portrait || null, // 線画アバターのパーツ
    character: Boolean(preset.character), // 名前つきのキャラクター設定を持つか
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
  const employees = initialPresets(company.seatsPerGenre).map((p) => makeEmployee(p));
  return {
    company,
    departments: DEPARTMENTS.map((d) => ({ ...d })),
    employees,
    settings: makeSettings(),
  };
}

export function presetForNextSeat(employees, roleId, genreId = DEFAULT_GENRE_ID, customGenres = []) {
  const seat = nextSeat(employees, roleId, genreId);
  return presetEmployee(roleId, seat, genreId, customGenres);
}

export { ROLES };
