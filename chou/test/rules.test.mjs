import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GUT_LINES } from '../src/lib/gutLine.js';
import { ADAMSKI_UNVERIFIED } from '../src/data/adamski.js';
import { PROBIOTIC_UNVERIFIED, PROBIOTIC_CORRECTIONS } from '../src/data/probiotics.js';
import { CLEANUP_UNVERIFIED, CLEANUP_CORRECTIONS } from '../src/data/cleanup.js';
import { PREBIOTIC_UNVERIFIED, PREBIOTIC_CORRECTIONS, SOURCE_CONFLICTS } from '../src/data/prebiotics.js';
import { BUTYRATE_UNVERIFIED, BUTYRATE_CORRECTIONS, WITHDRAWN } from '../src/data/butyrate.js';
import { OTC_UNVERIFIED, OTC_CORRECTIONS } from '../src/data/otcDrugs.js';
import { HABIT_UNVERIFIED, HABIT_CORRECTIONS } from '../src/data/gutHabits.js';
import { PROTEIN_UNVERIFIED, PROTEIN_CORRECTIONS, PROTEIN_GUIDES } from '../src/data/protein.js';
import { FASTING_UNVERIFIED, FASTING_CORRECTIONS } from '../src/data/fasting.js';
import { MAGNESIUM_UNVERIFIED, MAGNESIUM_CORRECTIONS } from '../src/data/magnesium.js';
import { MORNING_UNVERIFIED, MORNING_CORRECTIONS } from '../src/data/morning.js';
import { SCARED_UNVERIFIED, SCARED_CORRECTIONS } from '../src/data/scaredFoods.js';
import { ALCOHOL_UNVERIFIED, ALCOHOL_CORRECTIONS, ALCOHOL_GUIDE } from '../src/data/alcohol.js';
import { IBS_UNVERIFIED, IBS_CORRECTIONS, IBS_EXCLUSION, SELF_CARE } from '../src/data/ibs.js';

/**
 * **引用して否定している出典の言い分**は、見張りの対象から外す。
 * このアプリは「出典はこう言っているが、そのままにできない」を並べる作りなので、
 * 引用した文まで弾くと、**間違いを指摘した所だけが落ちる**（黙って消すことになり本末転倒）。
 * 見張るのは「アプリ自身が言っていること」。
 */
const QUOTED = [
  ...ADAMSKI_UNVERIFIED.map((i) => i.claim),
  ...PROBIOTIC_UNVERIFIED.map((i) => i.claim),
  ...PROBIOTIC_CORRECTIONS.map((i) => i.claim),
  ...CLEANUP_UNVERIFIED.map((i) => i.claim),
  ...CLEANUP_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...PREBIOTIC_UNVERIFIED.map((i) => i.claim),
  ...PREBIOTIC_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...SOURCE_CONFLICTS.flatMap((i) => [i.a, i.b, i.c]),
  ...BUTYRATE_UNVERIFIED.map((i) => i.claim),
  ...BUTYRATE_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...WITHDRAWN.flatMap((i) => [i.claim, i.title]),
  ...OTC_UNVERIFIED.map((i) => i.claim),
  ...OTC_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...HABIT_UNVERIFIED.map((i) => i.claim),
  ...HABIT_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...PROTEIN_UNVERIFIED.map((i) => i.claim),
  ...PROTEIN_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...PROTEIN_GUIDES.map((i) => i.said),
  ...FASTING_UNVERIFIED.map((i) => i.claim),
  ...FASTING_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...MAGNESIUM_UNVERIFIED.map((i) => i.claim),
  ...MAGNESIUM_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...MORNING_UNVERIFIED.flatMap((i) => [i.claim, i.title]),
  ...MORNING_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...SCARED_UNVERIFIED.flatMap((i) => [i.claim, i.title]),
  ...SCARED_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...ALCOHOL_UNVERIFIED.flatMap((i) => [i.claim, i.title]),
  ...ALCOHOL_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ALCOHOL_GUIDE.said,
  ...IBS_UNVERIFIED.flatMap((i) => [i.claim, i.title]),
  ...IBS_CORRECTIONS.flatMap((i) => [i.claim, i.title]),
  ...SELF_CARE.map((i) => i.said),
  IBS_EXCLUSION.said,
].filter(Boolean);

function stripQuoted(text) {
  let out = text;
  for (const quote of QUOTED) out = out.split(quote).join('');
  return out;
}

// README「決めていること」を、文章ではなくコードの側から見張る。
// ここが落ちたら、決まりのほうを変えるか、コードを直すかを**必ずどちらか選ぶ**
// （テストだけ消さない）。

const SRC = new URL('../src/', import.meta.url).pathname;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(js|jsx|css)$/.test(name)) out.push(path);
  }
  return out;
}

/**
 * 見張るのは**コードと、画面に出る文**。コメントは外す——
 * 「『緊急度』と呼ばない」のような、決まりを書いたコメント自体で落ちてしまうため。
 * 行ごと落とすだけにしてあるのは、行の途中にある文字列（'https://…' など）を
 * 壊さないようにするため。
 */
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

const files = walk(SRC).map((path) => ({
  path,
  text: stripQuoted(stripCommentLines(readFileSync(path, 'utf8'))),
}));
const code = files.filter((f) => /\.jsx?$/.test(f.path));

function forbid(pattern, why, targets = code) {
  for (const file of targets) {
    assert.doesNotMatch(file.text, pattern, `${file.path}: ${why}`);
  }
}

test('決まり1 判定・診断を言い切らない', () => {
  forbid(/緊急度|危険度|重症度/, '緊急度・危険度で決めつけない');
  forbid(/の疑いが|と診断され|可能性が高いです/, '診断名を言い切らない');
});

test('決まり2 点数を付けない', () => {
  forbid(/スコア/, 'お腹の調子を点にしない');
  forbid(/[0-9]+点/, '点数を画面に出さない');
});

test('決まり3 手元に無い基準を数値で持たない', () => {
  forbid(/1日\s*[0-9]+\s*(g|ｇ|グラム|L|リットル|杯)/, '1日◯gのような基準を書かない');
  forbid(/[0-9]+\s*[%％]の(人|方|かた)/, '割合の断定を書かない');
  forbid(/理想の?(バランス|割合)/, '理想の割合を決めない');
});

test('決まり5 連続日数を煽らない', () => {
  forbid(/連続\s*[0-9]+\s*日|連続日数[：:]/, '連続日数を数えて見せない');
  forbid(/\bstreak\b/i, '連続日数を数える仕組みを持たない');
});

test('決まり6 位置情報・氏名・連絡先を持たない', () => {
  forbid(/geolocation|getCurrentPosition|watchPosition/i, '現在地を取らない');
  forbid(/氏名|お名前|電話番号|メールアドレス/, '本人を特定するものを入力させない');
});

test('決まり7 AIをアプリから呼ばない', () => {
  forbid(/openai|anthropic|apiKey|api_key/i, 'AIの呼び出しを持たない');
});

test('決まり9 キャラクターは責めない（実際に画面へ出る文で見る）', () => {
  const lines = Object.values(GUT_LINES).join('\n');
  for (const bad of [/だめ/, /さぼ/, /怠け/, /悪い/, /がんばりましょう/, /もっと/, /続けましょう/]) {
    assert.doesNotMatch(lines, bad, `キャラクターの一言: ${bad}`);
  }
  // つらい日の一言は、記録できたことで終える（次の宿題を出さない）
  assert.match(GUT_LINES.hard, /大丈夫/);
  assert.match(GUT_LINES.very_hard, /大丈夫/);
});

test('決まり10 出典に URL を書かない', () => {
  const dataFiles = files.filter((f) => f.path.includes('/data/'));
  forbid(/https?:\/\//, 'データに URL を書かない', dataFiles);
});

test('決まり11 便を汚いものとして扱う言い回しを置かない', () => {
  forbid(/汚い|きたない|恥ずかし|くさい|臭い/, 'ここを崩すと、いちばん記録してほしい人が記録しなくなる');
});

test('決まり（見た目）絵文字を使わない', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  for (const file of files) {
    assert.doesNotMatch(file.text, emoji, `${file.path}: 絵文字は環境によって色が付く`);
  }
});

test('日付を UTC で組み立てない', () => {
  forbid(/toISOString\(\)/, 'UTCへ直ると日本時間の午前0時が前日になる');
  forbid(/new Date\(\s*['"`]\d{4}-\d{2}-\d{2}/, '文字列を Date に渡すと UTC として読まれる');
});

test('後読み（lookbehind）を使わない（古い Safari で読み込みごと落ちる）', () => {
  forbid(/\(\?<[=!]/, '後読みを使わない');
});
