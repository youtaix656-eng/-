// AI社員のプリセット。
//
//   役職（何ができるか） × ジャンル（どの分野で） × 席（3人）
//
// 「1つの役職 × 3席」が初期構成（ジャンルは汎用）。同じ役職でも分野が違えば
// 別の組として3席ずつ雇える（例：リサーチャー×医療で3人、リサーチャー×副業で3人）。
// 席数は company.seatsPerGenre の初期値でしかなく、増席できる。

import { ROLES } from './roles.js';
import { DEFAULT_GENRE_ID, DEFAULT_SEATS_PER_GENRE, genreById, allGenres } from './genres.js';
import { characterAt, characterDetail } from './characters.js';
import { kataToHira } from '../lib/yomi.js';

// 席ごとの持ち味。同じ役職・同じジャンルでも「どう働くか」を変えて、
// 3人に依頼を割り振る意味を持たせる。
export const SEAT_ARCHETYPES = [
  {
    seat: 1,
    label: '主席',
    reading: 'しゅせき',
    persona: '丁寧で網羅的。抜け漏れを何より嫌う。',
    style: '結論 → 根拠 → 抜け漏れの確認、の順で書く。見出しと箇条書きを使う。',
    strength: '網羅',
    hint: '網羅性を最優先します。答えに含めるべき論点を先に列挙してから書き始めます。',
  },
  {
    seat: 2,
    label: '次席',
    reading: 'じせき',
    persona: '速くて実務的。今日動ける形にすることに全力を注ぐ。',
    style: '前置きを書かない。300字以内の要点 → そのまま使える手順、の順で書く。',
    strength: '速さ',
    hint: '短さと実行可能性を最優先します。抽象的な助言を避け、今日の手順に落とします。',
  },
  {
    seat: 3,
    label: '三席',
    reading: 'さんせき',
    persona: '慎重で天邪鬼。多数意見にあえて反対の目線を当てる。',
    style: '主流の見方を書いたうえで、それが崩れる条件と別解を必ず添える。',
    strength: '別視点',
    hint: '前提を疑うことを最優先します。見落とされがちな反対側の可能性を必ず1つ挙げます。',
  },
];

// 汎用ジャンル以外で使う名前（役職・ジャンルをまたいで共用）。
//
// **役職の数 × 席数 より多く持つこと。** 少ないと、同じジャンルの別の役職に
// 同じ名前が回ってしまう（30役職 × 3席 ＝ 90 なので、90名ぶん用意してある）。
export const EXTRA_NAMES = [
  { name: 'シキ', reading: 'しき' },
  { name: 'ミナ', reading: 'みな' },
  { name: 'レン', reading: 'れん' },
  { name: 'ユイ', reading: 'ゆい' },
  { name: 'タケル', reading: 'たける' },
  { name: 'アオ', reading: 'あお' },
  { name: 'リコ', reading: 'りこ' },
  { name: 'ハル', reading: 'はる' },
  { name: 'ナオ', reading: 'なお' },
  { name: 'セナ', reading: 'せな' },
  { name: 'イズミ', reading: 'いずみ' },
  { name: 'カエデ', reading: 'かえで' },
  { name: 'ソウ', reading: 'そう' },
  { name: 'トウカ', reading: 'とうか' },
  { name: 'ハクア', reading: 'はくあ' },
  { name: 'マヒロ', reading: 'まひろ' },
  { name: 'ユウ', reading: 'ゆう' },
  { name: 'リョウ', reading: 'りょう' },
  { name: 'アカリ', reading: 'あかり' },
  { name: 'クレハ', reading: 'くれは' },
  { name: 'シノ', reading: 'しの' },
  { name: 'ツバサ', reading: 'つばさ' },
  { name: 'ネム', reading: 'ねむ' },
  { name: 'ヒナ', reading: 'ひな' },
  { name: 'マコト', reading: 'まこと' },
  { name: 'ミツキ', reading: 'みつき' },
  { name: 'ヤヨイ', reading: 'やよい' },
  { name: 'ルイ', reading: 'るい' },
  { name: 'ワカ', reading: 'わか' },
  { name: 'ノゾミ', reading: 'のぞみ' },
  { name: 'アキラ', reading: 'あきら' },
  { name: 'イオリ', reading: 'いおり' },
  { name: 'ウタ', reading: 'うた' },
  { name: 'ノドカ', reading: 'のどか' },
  { name: 'オト', reading: 'おと' },
  { name: 'カナタ', reading: 'かなた' },
  { name: 'キリ', reading: 'きり' },
  { name: 'クオン', reading: 'くおん' },
  { name: 'ケイ', reading: 'けい' },
  { name: 'コハク', reading: 'こはく' },
  { name: 'サキ', reading: 'さき' },
  { name: 'シオリ', reading: 'しおり' },
  { name: 'ミサキ', reading: 'みさき' },
  { name: 'エリカ', reading: 'えりか' },
  { name: 'スバル', reading: 'すばる' },
  { name: 'タヅル', reading: 'たづる' },
  { name: 'チアキ', reading: 'ちあき' },
  { name: 'ツカサ', reading: 'つかさ' },
  { name: 'テル', reading: 'てる' },
  { name: 'トモエ', reading: 'ともえ' },
  { name: 'セイラ', reading: 'せいら' },
  { name: 'ニコ', reading: 'にこ' },
  { name: 'ヌイ', reading: 'ぬい' },
  { name: 'ネネ', reading: 'ねね' },
  { name: 'ソウマ', reading: 'そうま' },
  { name: 'ハナ', reading: 'はな' },
  { name: 'ヒカリ', reading: 'ひかり' },
  { name: 'フウカ', reading: 'ふうか' },
  { name: 'ヘイジ', reading: 'へいじ' },
  { name: 'ホマレ', reading: 'ほまれ' },
  { name: 'マイ', reading: 'まい' },
  { name: 'ナギサ', reading: 'なぎさ' },
  { name: 'ムツキ', reading: 'むつき' },
  { name: 'メイ', reading: 'めい' },
  { name: 'モモ', reading: 'もも' },
  { name: 'ヤマト', reading: 'やまと' },
  { name: 'ユキ', reading: 'ゆき' },
  { name: 'ヨウ', reading: 'よう' },
  { name: 'ラン', reading: 'らん' },
  { name: 'リオ', reading: 'りお' },
  { name: 'ルカ', reading: 'るか' },
  { name: 'レイ', reading: 'れい' },
  { name: 'ロク', reading: 'ろく' },
  { name: 'ワタル', reading: 'わたる' },
  { name: 'アヤメ', reading: 'あやめ' },
  { name: 'イチカ', reading: 'いちか' },
  { name: 'ウミ', reading: 'うみ' },
  { name: 'エイジ', reading: 'えいじ' },
  { name: 'オウガ', reading: 'おうが' },
  { name: 'カレン', reading: 'かれん' },
  { name: 'キョウ', reading: 'きょう' },
  { name: 'クルミ', reading: 'くるみ' },
  { name: 'ケント', reading: 'けんと' },
  { name: 'コトネ', reading: 'ことね' },
  { name: 'サトル', reading: 'さとる' },
  { name: 'シュン', reading: 'しゅん' },
  { name: 'スミカ', reading: 'すみか' },
  { name: 'セリカ', reading: 'せりか' },
  { name: 'ソノカ', reading: 'そのか' },
  { name: 'タイガ', reading: 'たいが' },
];

/** 席の持ち味。4席目以降は主席→次席→三席を繰り返す。 */
export function archetypeFor(seat) {
  const i = (Math.max(1, seat) - 1) % SEAT_ARCHETYPES.length;
  return SEAT_ARCHETYPES[i];
}

// 役職ごとの3人の名前（席1・席2・席3）。カタカナなので読みは機械変換で足りる。
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

/**
 * ジャンルごとに、名前プールのどこから使い始めるかの起点。
 *
 * **ジャンルの並び順を使う**（名前から作る数ではなく）。
 * 数から作ると、たまたま同じ位置に落ちた2つのジャンルで、同じ役職に同じ名前が付く。
 * 並び順なら必ず1つずつずれるので、それが起きない。
 * ジャンルは末尾に足されていくので、あとから足しても既にあるジャンルの起点は動かない。
 * ジャンルが30を超えると一周して先頭のジャンルと同じ名前に戻る
 * （プール90名 ÷ 3席）。その時は EXTRA_NAMES を増やす。
 */
function genreOffset(genreId, customGenres) {
  const i = allGenres(customGenres).findIndex((g) => g.id === genreId);
  // **席数ぶんずらすこと。** 1つずつだと、隣のジャンルの1席目と
  // このジャンルの2席目が同じ名前になる（区画が重なる）。
  return (i < 0 ? 0 : i) * DEFAULT_SEATS_PER_GENRE;
}

/**
 * 役職 × ジャンル × 席 から社員のプリセットを組み立てる（保存はしない）。
 */
export function presetEmployee(roleId, seat, genreId = DEFAULT_GENRE_ID, customGenres = []) {
  const role = ROLES.find((r) => r.id === roleId);
  if (!role) return null;
  const genre = genreById(genreId, customGenres) || genreById(DEFAULT_GENRE_ID);
  const isDefaultGenre = genre.id === DEFAULT_GENRE_ID;

  // 会社チーム（①〜⑩）の汎用ジャンル1〜3席には、名前つきのキャラクター設定がある。
  // 他のジャンルへ雇うときは、名前が重ならないよう共用の名前プールに落とす。
  const character = isDefaultGenre ? characterAt(roleId, seat) : null;
  if (character) return fromCharacter(role, genre, character);

  const arche = archetypeFor(seat);
  const picked = pickName(roleId, seat, genre.id, customGenres);
  const title = `${role.name}（${arche.label}${seat > SEAT_ARCHETYPES.length ? `・${seat}席` : ''}）`;

  return {
    name: `${role.name}・${picked.name}`,
    shortName: picked.name,
    // 読みは明示して持たせる（目次で誤読しないため）。
    reading: `${role.reading}${picked.reading}`,
    avatar: role.glyph,
    roleId: role.id,
    genreId: genre.id,
    departmentId: role.departmentId,
    seat,
    title,
    // 専門分野は「役職の技能 ＋ ジャンル」。汎用のときはジャンル名を足さない。
    specialties: isDefaultGenre ? role.skills.slice() : [genre.name, ...role.skills.slice(0, 3)],
    persona: arche.persona,
    style: arche.style,
    strength: arche.strength,
    seatHint: arche.hint,
    genreHint: isDefaultGenre
      ? ''
      : `あなたの担当分野は「${genre.name}」です。${genre.desc}${genre.caution ? ` ${genre.caution}` : ''}`,
    toolIds: role.tools.slice(),
  };
}

/**
 * キャラクター設定から社員のプリセットを作る。
 *
 * 人物像・書き方・出身は別ファイルなので（新項目03）、まだ読み込めていない時は
 * 席の持ち味で代用する。**空の人物像で雇わせない**ため。
 * 呼ぶ側（useStore の hire 系）は loadCharacterDetails() を待ってから呼ぶので、
 * 通常はここで代用にはならない。
 */
function fromCharacter(role, genre, c) {
  const d = characterDetail(c.roleId, c.seat);
  const arche = archetypeFor(c.seat);
  return {
    name: c.name,
    shortName: c.name.split(' ')[0].replace(/^Dr\.$/, c.name.split(' ')[1] || c.name),
    kana: c.kana,
    reading: c.reading,
    origin: (d && d.origin) || '',
    avatar: role.glyph,
    roleId: role.id,
    genreId: genre.id,
    departmentId: role.departmentId,
    seat: c.seat,
    title: `${role.name}（${c.strength}）`,
    specialties: role.skills.slice(),
    persona: (d && d.persona) || arche.persona,
    style: (d && d.style) || arche.style,
    strength: c.strength,
    // 席の持ち味はキャラクター本人の個性で置き換える（主席/次席/三席は使わない）。
    // persona / style は buildSystemPrompt が「性格」「書き方」として既に出すので、
    // ここで同じ文を持たせない（同じ内容が2回プロンプトに乗り、そのぶん課金される）。
    seatHint: '',
    genreHint: '',
    portrait: c.portrait,
    toolIds: role.tools.slice(),
    character: true,
  };
}

function pickName(roleId, seat, genreId, customGenres) {
  const names = NAMES[roleId] || [];
  const idx = seat - 1;

  // 汎用ジャンルの1〜3席目は、役職ごとの固有名をそのまま使う
  if (genreId === DEFAULT_GENRE_ID && idx < names.length) {
    return { name: names[idx], reading: kataToHira(names[idx]) };
  }

  // それ以外は共用の名前プールから取る。位置は3つの足し算で決める。
  //   ① ジャンルの並び順 …… 同じ役職でも、分野が違えば別の名前になる
  //   ② 役職ごとの区画   …… 同じ分野の中で、役職どうしがぶつからない
  //   ③ 席番号           …… 区画の中で1人ずつずれる
  // プールは「役職の数 × 席数」より多く持ってあるので、①が無くても
  // 同じ分野の中では重ならない（①は分野をまたいだ重複を防ぐためのもの）。
  const pool = EXTRA_NAMES;
  const seats = DEFAULT_SEATS_PER_GENRE;
  const within = idx % seats;
  const round = Math.floor(idx / seats); // 4席目以降は区画を一周したとみなす
  const at = (genreOffset(genreId, customGenres) + roleIndex(roleId) * seats + within) % pool.length;
  const base = pool[at];
  return round === 0
    ? { name: base.name, reading: base.reading }
    : { name: `${base.name}${round + 1}`, reading: `${base.reading}${round + 1}` };
}

/** 役職の並び順。区画の割り当てに使う。 */
function roleIndex(roleId) {
  const i = ROLES.findIndex((r) => r.id === roleId);
  return i < 0 ? 0 : i;
}

/** 初期チーム（core の6役職 × 汎用ジャンル × seats 席）のプリセット一覧。 */
export function initialPresets(seats = DEFAULT_SEATS_PER_GENRE) {
  const out = [];
  for (const role of ROLES.filter((r) => r.core)) {
    for (let seat = 1; seat <= seats; seat += 1) {
      out.push(presetEmployee(role.id, seat, DEFAULT_GENRE_ID));
    }
  }
  return out;
}
