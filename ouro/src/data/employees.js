// AI社員のプリセット。「1つの役職 × 3席」が初期構成。
//
// 席（seat）は固定ではなく company.seatsPerRole の初期値でしかない。
// 増席したいときは hireEmployee({roleId, seat: 4}) を呼ぶだけで足りる
// （画面・スキーマの変更は不要）。

import { ROLES } from './roles.js';

// 席ごとの持ち味。同じ役職でも「どう働くか」を変えて、
// 3人に依頼を割り振る意味を持たせる。
export const SEAT_ARCHETYPES = [
  {
    seat: 1,
    label: '主席',
    persona: '丁寧で網羅的。抜け漏れを何より嫌う。',
    style: '結論 → 根拠 → 抜け漏れの確認、の順で書く。見出しと箇条書きを使う。',
    strength: '網羅',
    hint: '網羅性を最優先します。answer に含めるべき論点を先に列挙してから書き始めます。',
  },
  {
    seat: 2,
    label: '次席',
    persona: '速くて実務的。今日動ける形にすることに全力を注ぐ。',
    style: '前置きを書かない。300字以内の要点 → そのまま使える手順、の順で書く。',
    strength: '速さ',
    hint: '短さと実行可能性を最優先します。抽象的な助言を避け、今日の手順に落とします。',
  },
  {
    seat: 3,
    label: '三席',
    persona: '慎重で天邪鬼。多数意見にあえて反対の目線を当てる。',
    style: '主流の見方を書いたうえで、それが崩れる条件と別解を必ず添える。',
    strength: '別視点',
    hint: '前提を疑うことを最優先します。見落とされがちな反対側の可能性を必ず1つ挙げます。',
  },
];

// 4席目以降で使う名前（役職をまたいで共用）。
// 席は増やせる設計なので、3人ぶんの名前で打ち止めにしない。
export const EXTRA_NAMES = ['シキ', 'ミナ', 'レン', 'ユイ', 'タケル', 'アオ', 'リコ', 'ハル', 'ナオ', 'セナ'];

/** 席の持ち味。4席目以降は主席→次席→三席を繰り返す。 */
export function archetypeFor(seat) {
  const i = (Math.max(1, seat) - 1) % SEAT_ARCHETYPES.length;
  return SEAT_ARCHETYPES[i];
}

// 役職ごとの3人の名前（席1・席2・席3）。
const NAMES = {
  researcher: ['ルナ', 'ソラ', 'ヨル'],
  analyzer: ['カイ', 'リン', 'ハク'],
  creator: ['ノア', 'ミオ', 'クロ'],
  reviewer: ['シオン', 'アキ', 'サイ'],
  strategist: ['ミラ', 'ジン', 'ナギ'],
  mentor: ['ゼン', 'ホタル', 'トワ'],
  organizer: ['エマ', 'スミレ', 'カナ'],
  automator: ['リュウ', 'ハヤテ', 'ギア'],
  data: ['アイ', 'シグマ', 'ロウ'],
  security: ['ガード', 'カゲ', 'ロック'],
  innovator: ['ライ', 'スパーク', 'ユメ'],
  marketer: ['マキ', 'コウ', 'セイ'],
  writer: ['フミ', 'アヤ', 'スズ'],
  designer: ['イロ', 'カタチ', 'マル'],
  accountant: ['ゼニ', 'ソロ', 'タマ'],
};

/** 役職 × 席 から社員のプリセットを組み立てる（保存はしない）。 */
export function presetEmployee(roleId, seat) {
  const role = ROLES.find((r) => r.id === roleId);
  if (!role) return null;
  const arche = archetypeFor(seat);
  const names = NAMES[roleId] || [];
  const name = names[seat - 1] || extraName(seat);
  return {
    name: `${role.name}・${name}`,
    shortName: name,
    avatar: role.glyph,
    roleId: role.id,
    departmentId: role.departmentId,
    seat,
    title: `${role.name}（${arche.label}${seat > SEAT_ARCHETYPES.length ? `・${seat}席` : ''}）`,
    specialties: role.skills.slice(),
    persona: arche.persona,
    style: arche.style,
    strength: arche.strength,
    seatHint: arche.hint,
    toolIds: role.tools.slice(),
  };
}

/** 初期チーム（core の6役職 × seatsPerRole 席）のプリセット一覧。 */
export function initialPresets(seatsPerRole = 3) {
  const out = [];
  for (const role of ROLES.filter((r) => r.core)) {
    for (let seat = 1; seat <= seatsPerRole; seat += 1) {
      out.push(presetEmployee(role.id, seat));
    }
  }
  return out;
}

/** 4席目以降の名前。名前が尽きたら番号を添えて重ならないようにする。 */
function extraName(seat) {
  const i = seat - SEAT_ARCHETYPES.length - 1;
  const base = EXTRA_NAMES[i % EXTRA_NAMES.length];
  const round = Math.floor(i / EXTRA_NAMES.length);
  return round === 0 ? base : `${base}${round + 1}`;
}
