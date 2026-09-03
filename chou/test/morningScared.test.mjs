import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MORNING_TRAITS,
  MORNING_TRAITS_NOTE,
  MORNING_HABITS,
  MORNING_CORRECTIONS,
  MORNING_UNVERIFIED,
  MORNING_PARTIAL_OK,
  MORNING_SOURCE,
} from '../src/data/morning.js';
import {
  NAMED_FOODS,
  SUPER_FOOD,
  SCARED_CORRECTIONS,
  SCARED_UNVERIFIED,
  SCARED_PRECHECKS,
  SCARED_PRECHECK_WARNING,
  SCARED_PARTIAL_OK,
  SCARED_SOURCE,
} from '../src/data/scaredFoods.js';
import {
  ALCOHOL_GUT,
  ALCOHOL_GUIDE,
  ALCOHOL_CORRECTIONS,
  ALCOHOL_UNVERIFIED,
  ALCOHOL_PRECHECKS,
  ALCOHOL_PRECHECK_WARNING,
  ALCOHOL_SOURCE,
} from '../src/data/alcohol.js';
import {
  FASTING_CORRECTIONS,
  FASTING_UNVERIFIED,
  FASTING_ALLOWED,
  FASTING_ALLOWED_NOTE,
} from '../src/data/fasting.js';
import {
  tsukemonoViews,
  TSUKEMONO_NOTE,
  fastingAllowedViews,
  FASTING_ALLOWED_CLASH_NOTE,
} from '../src/lib/conflicts.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

// ───────────────────────── 朝のリズム ─────────────────────────

test('「出なくても責めない」を、画面のいちばん上に出す', () => {
  const dontBlame = MORNING_HABITS.find((h) => h.id === 'dont_blame');
  assert.ok(dontBlame, '責めないの項が無い');
  assert.match(dontBlame.caution, /連続を煽ることをしません/);
  assert.match(dontBlame.caution, /出ない日も「記録した日」/);
  // 画面でも、特徴・やってみることより前に出る
  const screen = src('components/Morning.jsx');
  assert.ok(
    screen.indexOf('id="morning-dont-blame"') < screen.indexOf('id="morning-traits"'),
    '責めないの項が特徴より後ろにある',
  );
  assert.match(MORNING_PARTIAL_OK, /連続も数えません/);
});

test('朝に出ないことを、良し悪しにしない', () => {
  const byId = Object.fromEntries(MORNING_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.barometer, '「朝一番がいちばん健康」への訂正が無い');
  assert.match(byId.barometer.correction, /夜勤|交代勤務/);
  assert.match(byId.barometer.correction, /出た時刻で良し悪しを付けません/);
  assert.ok(byId.bad_flora, '出ない＝腸内環境が悪い、への訂正が無い');
  assert.match(byId.bad_flora.correction, /判定しません/);
  // 当てはまった数を数えない
  assert.match(MORNING_TRAITS_NOTE, /数えず/);
  const code = codeOf('data/morning.js') + codeOf('components/Morning.jsx');
  assert.doesNotMatch(code, /\bstreak\b/i);
  assert.doesNotMatch(code, /連続\s*[0-9]/);
  for (const item of [...MORNING_TRAITS, ...MORNING_HABITS]) {
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
});

test('長くいきむことを勧めない', () => {
  const byId = Object.fromEntries(MORNING_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.push, 'いきむことへの訂正が無い');
  assert.match(byId.push.correction, /痔|脱肛/);
  assert.match(byId.push.correction, /医療機関/);
  const sit = MORNING_HABITS.find((h) => h.id === 'sit');
  assert.match(sit.caution, /長くいきまないでください/);
  // 画面にも「いきむ練習」を置かない
  assert.doesNotMatch(codeOf('components/Morning.jsx'), /いきむ練習をしましょう|しっかりいきみ/);
});

test('朝のリズムの数字は並べるだけで、時間も回数も計らない', () => {
  assert.ok(MORNING_UNVERIFIED.length >= 5);
  for (const item of MORNING_UNVERIFIED) {
    assert.ok(item.claim && item.note, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  const byId = Object.fromEntries(MORNING_UNVERIFIED.map((c) => [c.id, c]));
  // 同じ数字が別々の方法に付いていることを、そのまま指摘する
  assert.match(byId.week2to5.note, /白湯の話にも出てきます/);
  // 噛んだ回数を記録しない
  assert.match(byId.chew50.note, /記録しません/);
  // 夜勤の人に守りようがない目安は、そう書く
  assert.match(byId.three_hours.note, /夜勤/);
  const code = codeOf('data/morning.js') + codeOf('components/Morning.jsx');
  assert.doesNotMatch(code, /setInterval|chewCount|countChews/);
});

// ───────────────────── 名指しされた食べもの ─────────────────────

test('食べものを「猛毒」と呼ばない（薬と同じ線を引く）', () => {
  const byId = Object.fromEntries(SCARED_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.poison_food, '「猛毒」への訂正が無い');
  assert.match(byId.poison_food.correction, /食べられなくします/);
  assert.match(byId.poison_food.correction, /札を貼りません/);
  assert.match(byId.poison_food.claim, /猛毒/, '元の言い方を消していない');
  // アプリ自身の文には、煽る言い方を持ち込まない
  const screen = codeOf('components/ScaredFoods.jsx');
  for (const bad of [/死んでも食うな/, /寝たきり一直線/, /神食品/]) {
    assert.doesNotMatch(screen, bad, String(bad));
  }
  // 訂正が食べものの一覧より前に出る
  const raw = src('components/ScaredFoods.jsx');
  assert.ok(
    raw.indexOf('id="scared-corrections"') < raw.indexOf('id="scared-foods"'),
    '訂正が一覧より後ろにある',
  );
});

test('高齢の人にとって、こわいのは食べすぎより低栄養だと書く', () => {
  const byId = Object.fromEntries(SCARED_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.undernutrition);
  assert.match(byId.undernutrition.correction, /食べないことのほうが危険/);
  assert.match(byId.undernutrition.correction, /足せるものを足す/);
  // 自炊できることを前提にしない
  const bento = NAMED_FOODS.find((f) => f.id === 'bento');
  assert.match(bento.note, /自炊できることを前提にしないでください/);
  const cup = NAMED_FOODS.find((f) => f.id === 'cupnoodle');
  assert.match(cup.note, /食べたほうがよいことがあります/);
  // 画面のいちばん上にも出す
  assert.match(codeOf('components/ScaredFoods.jsx'), /食べられるものを減らさないでください/);
  const ids = SCARED_PRECHECKS.map((p) => p.id);
  for (const id of ['eating', 'weight', 'cook']) assert.ok(ids.includes(id), id);
  assert.match(SCARED_PRECHECK_WARNING, /医師|管理栄養士/);
});

test('1つの食べもので病気は決まらない・防げない', () => {
  const byId = Object.fromEntries(SCARED_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.one_food, '「一口で2倍」への訂正が無い');
  assert.match(byId.one_food.correction, /1回の食事の話ではありません/);
  assert.ok(byId.one_cure, '「これひとつで全部」への訂正が無い');
  assert.match(byId.one_cure.correction, /これだけ食べれば防げるものはありません/);
  assert.match(SUPER_FOOD.note, /とは言えません/);
  // 「ほぼ全員食べていた」を、原因として読ませない
  assert.ok(byId.blame);
  assert.match(byId.blame.correction, /それだけでは何も示しません/);
  assert.match(byId.blame.correction, /自分のせいだ/);
  assert.match(SCARED_PARTIAL_OK, /札も貼りません/);
});

test('名指しされた食べものにも、選ぶときに見るところを必ず書く', () => {
  assert.ok(NAMED_FOODS.length >= 4);
  for (const food of NAMED_FOODS) {
    assert.ok(food.said && food.look && food.note, food.id);
    assert.match(food.reading, /^[ぁ-んー]+$/, food.id);
    // 「食べるな」と書かない
    assert.doesNotMatch(food.look, /食べるな|やめなさい/, food.id);
  }
  for (const item of SCARED_UNVERIFIED) {
    assert.ok(item.claim && item.note, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  // 順位を持たない
  const byId = Object.fromEntries(SCARED_UNVERIFIED.map((c) => [c.id, c]));
  assert.match(byId.stroke_first.note, /順位を持ちません/);
});

// ───────────────────────── お酒 ─────────────────────────

test('「酒は百薬の長」を訂正しつつ、飲む人を責めない', () => {
  const byId = Object.fromEntries(ALCOHOL_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.hyakuyaku);
  assert.match(byId.hyakuyaku.correction, /少量なら体によい」とは書きません/);
  assert.ok(byId.no_blame, '責めない、という項が無い');
  assert.match(byId.no_blame.correction, /この画面を閉じるだけ/);
  assert.match(byId.no_blame.claim, /史上最悪/, '元の言い方を消していない');
  // 依存を判定しない・チェックリストを作らない
  assert.ok(byId.dependence);
  assert.match(byId.dependence.correction, /意志の問題ではなく/);
  assert.match(byId.dependence.correction, /判定をしません/);
  const code = codeOf('data/alcohol.js');
  assert.doesNotMatch(code, /audit|dependenceScore|依存度/i);
});

test('飲んだ量を計算しない（目安は引用として持つだけ）', () => {
  assert.match(ALCOHOL_GUIDE.note, /計算しません/);
  assert.match(ALCOHOL_GUIDE.said, /20グラム/, '公的な目安は引用として残す');
  const code = codeOf('data/alcohol.js') + codeOf('components/GutHabits.jsx');
  assert.doesNotMatch(code, /totalAlcohol|gramsOf|unitsPerDay/i);
  for (const item of ALCOHOL_GUT) {
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
    assert.match(item.body, /とされ|説明され|という説明|と紹介/, item.id);
  }
  for (const item of ALCOHOL_UNVERIFIED) {
    assert.ok(item.claim && item.note, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  const ids = ALCOHOL_PRECHECKS.map((p) => p.id);
  for (const id of ['medicine', 'cannot_stop', 'blood_stool']) assert.ok(ids.includes(id), id);
  assert.match(ALCOHOL_PRECHECK_WARNING, /薬剤師/);
});

// ───────────────────── 断食（2本目の出典） ─────────────────────

test('「一日三食が全ての不調の原因」と決めない・人を貶めない', () => {
  const byId = Object.fromEntries(FASTING_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.three_meals_blame, '一日三食への訂正が無い');
  assert.match(byId.three_meals_blame.correction, /「すべての原因」と言える食べ方はありません/);
  assert.match(byId.three_meals_blame.correction, /三食食べたほうがよい人がいます/);
  // 「情弱」のような貶める言い方は、**引用と、それを断る一文の中だけ**に出てくる
  assert.match(byId.three_meals_blame.claim, /情弱/, '元の言い方を消していない');
  assert.match(byId.three_meals_blame.correction, /「情弱」/, '断る側では必ずかぎかっこで囲む');
  // **元の文が複数行に分けて書かれていると、値で差し引く方法では消えない**
  // （`'…' + '…'` の連結なので、実行時の値とソースの文字列が一致しない）。
  // なので行で見る——出てよいのは「引用した1行」と「かぎかっこで囲んで断る1行」だけ。
  const lines = src('data/fasting.js')
    .split('\n')
    .filter((line) => line.includes('情弱') && !/^\s*(\/\/|\/\*|\*)/.test(line));
  assert.equal(lines.length, 2, `情弱が${lines.length}行に出ている`);
  assert.ok(lines.some((l) => l.includes('claim:')), '引用の行が無い');
  assert.ok(lines.some((l) => l.includes('「情弱」')), 'かぎかっこで囲んで断る行が無い');
});

test('同じ出典の中の食い違いと、賞の名前を裏づけにしないことを書く', () => {
  const byId = Object.fromEntries(FASTING_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.eat_anything, '「好きなだけ食べてよい」への訂正が無い');
  assert.match(byId.eat_anything.correction, /同じ話の中で言うことが変わっている/);
  assert.ok(byId.nobel, 'ノーベル賞への訂正が無い');
  assert.match(byId.nobel.correction, /賞の名前は、あとから付いた数字の裏づけになりません/);
  // 60兆・170グラム・江戸時代も並べる
  const uid = Object.fromEntries(FASTING_UNVERIFIED.map((c) => [c.id, c]));
  for (const id of ['cells60', 'sugar170', 'edo']) assert.ok(uid[id], id);
  assert.match(uid.edo.note, /いまの自分に合うかどうかの根拠になりません/);
});

test('空腹中に食べてよいとされるものが、除去の側とぶつかることを出す', () => {
  const views = fastingAllowedViews();
  assert.equal(views.length, FASTING_ALLOWED.length);
  const clash = views.filter((v) => v.clash);
  assert.deepEqual(clash.map((v) => v.id), ['cheese', 'yogurt']);
  for (const v of views) assert.equal(v.views.length, 2, v.id);
  assert.match(FASTING_ALLOWED_NOTE, /一度やめてみる/);
  assert.match(FASTING_ALLOWED_CLASH_NOTE, /決めません/);
  for (const item of FASTING_ALLOWED) assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
});

// ───────────────────── 漬物：同じ出典の中で割れる ─────────────────────

test('漬物は、同じ出典の中の食い違いとして並べる', () => {
  const views = tsukemonoViews();
  assert.equal(views.length, 3);
  assert.deepEqual(views.map((v) => v.id), ['scared', 'recommended', 'cleanup']);
  for (const v of views) assert.ok(v.side && v.says, v.id);
  assert.match(TSUKEMONO_NOTE, /決めません/);
  // 強い言葉が先に来て残りやすい、という理由まで書く
  assert.match(TSUKEMONO_NOTE, /読まれにくい/);
  // 手書きの一覧を持たず、元データから導く
  assert.doesNotMatch(codeOf('lib/conflicts.js'), /const TSUKEMONO_LIST = \[/);
});

// ───────────────────────── 出典・目次 ─────────────────────────

test('出典に URL を書かない・確かめきれていないことを書く', () => {
  for (const path of ['data/morning.js', 'data/scaredFoods.js', 'data/alcohol.js']) {
    assert.doesNotMatch(src(path), /https?:\/\//, path);
  }
  for (const source of [MORNING_SOURCE, SCARED_SOURCE, ALCOHOL_SOURCE]) {
    assert.equal(source.check, true);
    assert.match(source.text, /未確認/);
    assert.match(source.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('目次からも辿れる（画面にある id を指す）', () => {
  const entries = buildTocEntries();
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  for (const item of [...MORNING_TRAITS, ...MORNING_HABITS, ...MORNING_CORRECTIONS, ...MORNING_UNVERIFIED]) {
    assert.ok(byTitle.has(item.title), item.title);
  }
  for (const food of NAMED_FOODS) assert.ok(byTitle.has(food.name), food.name);
  assert.ok(byTitle.has(SUPER_FOOD.name));
  for (const item of [...SCARED_CORRECTIONS, ...SCARED_UNVERIFIED]) assert.ok(byTitle.has(item.title), item.title);
  for (const item of [...ALCOHOL_GUT, ...ALCOHOL_CORRECTIONS, ...ALCOHOL_UNVERIFIED]) {
    assert.ok(byTitle.has(item.title), item.title);
  }
  assert.ok(byTitle.has(ALCOHOL_GUIDE.title));
  assert.ok(byTitle.has('空腹の時間中でも食べてよいとされるもの'));

  const screens = {
    morning: src('components/Morning.jsx'),
    scared: src('components/ScaredFoods.jsx'),
  };
  const templates = [
    [/^trait-/, /id=\{`trait-\$\{/],
    [/^mhabit-/, /id=\{`mhabit-\$\{/],
    [/^mcorrection-/, /id=\{`mcorrection-\$\{/],
    [/^munv-/, /id=\{`munv-\$\{/],
    [/^named-/, /id=\{`named-\$\{/],
    [/^scorrection-/, /id=\{`scorrection-\$\{/],
    [/^sunv-/, /id=\{`sunv-\$\{/],
  ];
  const targets = entries
    .filter((e) => ['morning', 'scared'].includes(e.group))
    .flatMap((e) => e.destinations)
    .filter((d) => screens[d.view]);
  assert.ok(targets.length > 0);
  for (const dest of targets) {
    const screen = screens[dest.view];
    if (screen.includes(`id="${dest.targetId}"`)) continue;
    const tpl = templates.find(([prefix]) => prefix.test(dest.targetId));
    assert.ok(tpl, `${dest.targetId}: 画面に無い`);
    assert.match(screen, tpl[1], dest.targetId);
  }
});
