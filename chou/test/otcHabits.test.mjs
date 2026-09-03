import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SHORT_CHAIN,
  SPORE,
  BUTYRATE_ROLES,
  WITHDRAWN,
  BUTYRATE_CORRECTIONS,
  BUTYRATE_UNVERIFIED,
  BUTYRATE_PRECHECKS,
  BUTYRATE_PRECHECK_WARNING,
  BUTYRATE_PARTIAL_OK,
  BUTYRATE_SOURCE,
} from '../src/data/butyrate.js';
import {
  OTC_KINDS,
  OTC_CORRECTIONS,
  OTC_UNVERIFIED,
  OTC_PRECHECKS,
  OTC_PRECHECK_WARNING,
  OTC_PARTIAL_OK,
  OTC_SOURCE,
} from '../src/data/otcDrugs.js';
import {
  HARMFUL_HABITS,
  HELPFUL_HABITS,
  WEAK_STOMACH_AVOID,
  HABIT_CORRECTIONS,
  HABIT_UNVERIFIED,
  HABIT_PRECHECKS,
  HABIT_PARTIAL_OK,
  HABIT_SOURCE,
} from '../src/data/gutHabits.js';
import { fiberViews, FIBER_NOTE, withinSourceFiberConflict } from '../src/lib/conflicts.js';
import { SOURCE_CONFLICTS } from '../src/data/prebiotics.js';
import { normalizeDay, hasRecord } from '../src/lib/days.js';
import { otcCounts } from '../src/lib/stats.js';
import { buildVisitNote, NOTE_PARTS, DEFAULT_PARTS } from '../src/lib/visitNote.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

// ───────────────────────── 酪酸菌 ─────────────────────────

test('はたらきは「そう説明されている」までで止める（効き目を断定しない）', () => {
  assert.ok(BUTYRATE_ROLES.length >= 4);
  const text = BUTYRATE_ROLES.map((r) => `${r.title} ${r.body}`).join('\n');
  for (const bad of [/必ず/, /確実に/, /治り(ます|-)/, /予防できます/, /改善します/]) {
    assert.doesNotMatch(text, bad, String(bad));
  }
  // 「とされる／説明されている」のどれかが必ず入る
  for (const role of BUTYRATE_ROLES) {
    assert.match(role.body, /とされ|説明され|という説明|と紹介/, role.id);
    assert.match(role.reading, /^[ぁ-んー]+$/, role.id);
  }
  assert.match(SPORE.caution, /医師|薬剤師/);
});

test('がんを防げるとは書かない（酪酸菌の側でも同じ線を引く）', () => {
  const byId = Object.fromEntries(BUTYRATE_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.cancer, 'がんの訂正が無い');
  assert.match(byId.cancer.correction, /予防できると確かめられたものではありません/);
  assert.match(byId.cancer.correction, /検診/);
  // 元の言い分も消さずに残す
  assert.match(byId.cancer.claim, /大腸がん/);
  // アプリ自身の文には「がんを予防」と書かない
  const screen = codeOf('components/Butyrate.jsx');
  assert.doesNotMatch(screen, /がんを予防|がん予防/);
});

test('出典自身が取り下げた説は、取り下げの経緯ごと残す（痩せ菌・デブ菌）', () => {
  assert.ok(WITHDRAWN.length >= 1);
  const fat = WITHDRAWN.find((w) => w.id === 'fat_thin_bacteria');
  assert.ok(fat);
  assert.ok(fat.claim, '広まった説を消していない');
  assert.match(fat.withdrawn, /出典自身/);
  // アプリは菌を「良い・悪い」「太る・痩せる」で分けない、と書く
  assert.match(fat.note, /分けません/);
  for (const item of WITHDRAWN) assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
});

test('酪酸菌の裏が取れていない主張は、割合も国の話も並べるだけ', () => {
  assert.ok(BUTYRATE_UNVERIFIED.length >= 4);
  for (const item of BUTYRATE_UNVERIFIED) {
    assert.ok(item.claim && item.note, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  const byId = Object.fromEntries(BUTYRATE_UNVERIFIED.map((c) => [c.id, c]));
  // 7割は主張として持つだけで、計算には使わない
  assert.match(byId.seventy.claim, /7割/);
  assert.match(byId.seventy.note, /計算に使いません/);
  const lib = codeOf('lib/conflicts.js');
  assert.ok(!lib.includes('7割'), 'lib に出典の割合が入っている');
  // 国・民族でひとくくりにしない、と必ず添える
  assert.match(byId.japanese_only.note, /ひとくくり/);
});

// ───────────────────────── 市販薬 ─────────────────────────

test('薬を「猛毒」とも「神」とも呼ばない（必要な人の手を止めない）', () => {
  const byId = Object.fromEntries(OTC_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.poison, '「猛毒」の訂正が無い');
  assert.match(byId.poison.correction, /必要な人には必要/);
  assert.match(byId.poison.correction, /医師|薬剤師/);
  assert.ok(byId.quack, '「ヤブ医者」の訂正が無い');
  assert.match(byId.quack.correction, /医師|薬剤師/);
  // アプリ自身の文には、煽る言い方を持ち込まない
  const screen = codeOf('components/OtcDrugs.jsx');
  for (const bad of [/猛毒/, /ヤブ医者/, /神レベル/, /買ってはいけない/]) {
    assert.doesNotMatch(screen, bad, String(bad));
  }
});

test('どの薬にも「誰に聞けばよいか」を必ず書く・受診へつなげる', () => {
  assert.ok(OTC_KINDS.length >= 4);
  for (const kind of OTC_KINDS) {
    assert.ok(kind.said && kind.why && kind.instead && kind.doctor, kind.id);
    assert.match(kind.reading, /^[ぁ-んー]+$/, kind.id);
  }
  const byId = Object.fromEntries(OTC_KINDS.map((k) => [k.id, k]));
  // 出典が言っている「受診へつなぐ部分」は弱めない
  assert.match(byId.antidiarrheal.instead, /医療機関/);
  assert.match(byId.antiemetic.instead, /医療機関/);
  // 処方されているものを自分でやめない、と書く
  assert.match(byId.antidiarrheal.doctor, /自分でやめないでください/);
  assert.match(byId.antiemetic.doctor, /自分でやめないでください/);
  // 画面のいちばん上に「読んでやめない」を出す
  assert.match(codeOf('components/OtcDrugs.jsx'), /この画面を読んでやめないでください/);
});

test('飲み合わせも用量もこのアプリで判定しない', () => {
  const text = src('data/otcDrugs.js');
  assert.match(text, /飲み合わせ/);
  assert.match(OTC_PARTIAL_OK, /やめないでください/);
  assert.match(OTC_PRECHECK_WARNING, /医師|薬剤師/);
  // 用量・回数の表を持たない
  assert.doesNotMatch(text, /1日\s*[0-9]+\s*(錠|回|包)/);
  const ids = OTC_PRECHECKS.map((p) => p.id);
  for (const id of ['prescribed', 'black_stool', 'dehydrate']) assert.ok(ids.includes(id), id);
});

test('数えられない割合をアプリの言葉にしない（99%）', () => {
  const byId = Object.fromEntries(OTC_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.ninety_nine);
  assert.match(byId.ninety_nine.correction, /たどれていません/);
  assert.match(byId.ninety_nine.correction, /割合を持ちません/);
  for (const item of OTC_UNVERIFIED) {
    assert.ok(item.note && item.note.length > 10, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
});

// ───────────────────────── 胃腸の習慣 ─────────────────────────

test('血液型で病気を分けない（採らない理由を書いたうえで持たない）', () => {
  const byId = Object.fromEntries(HABIT_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.bloodtype, '血液型の訂正が無い');
  assert.match(byId.bloodtype.correction, /血液型を持ちません/);
  assert.match(byId.bloodtype.correction, /受診をあきらめる/);
  // 判定に使う入れ物をどこにも持たない（訂正の id 'bloodtype' は入れ物ではないので除く）
  for (const path of ['data/gutHabits.js', 'lib/conflicts.js', 'components/GutHabits.jsx']) {
    const code = codeOf(path);
    assert.doesNotMatch(code, /BLOOD_TYPES|bloodTypeOf|selectedBloodType/, path);
  }
  // 血液型そのものは、**引用した出典の言い分（claim）の外には出てこない**
  const quoted = HABIT_CORRECTIONS.map((c) => c.claim).join('\n');
  let rest = src('data/gutHabits.js');
  for (const q of HABIT_CORRECTIONS.map((c) => c.claim)) rest = rest.split(q).join('');
  rest = rest
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
  assert.match(quoted, /O型/, '引用のほうから消してしまっている');
  for (const type of ['O型', 'A型', 'B型', 'AB型']) {
    assert.ok(!rest.includes(type), `${type} が引用の外に出ている`);
  }
});

test('倍率を「自分がそうなる確率」と読ませない', () => {
  const byId = Object.fromEntries(HABIT_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.cancer_ratio);
  assert.match(byId.cancer_ratio.correction, /集団/);
  assert.match(byId.cancer_ratio.correction, /計算にも判定にも使いません/);
  // 画面でも必ず先に出す
  assert.match(codeOf('components/GutHabits.jsx'), /あなたがそうなる確率ではありません/);
  // 倍率は主張として持つ側にだけある
  const claims = HABIT_UNVERIFIED.map((c) => c.claim).join('\n');
  assert.match(claims, /17倍/);
  assert.ok(!codeOf('lib/conflicts.js').includes('17倍'));
});

test('国や民族でひとくくりにしない', () => {
  const byId = Object.fromEntries(HABIT_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.ethnic);
  assert.match(byId.ethnic.correction, /人によって違います/);
  assert.match(byId.ethnic.correction, /判定をしません/);
});

test('習慣にはやれた数を数えず、記録できる所へつなぐ', () => {
  assert.ok(HARMFUL_HABITS.length >= 5);
  assert.ok(HELPFUL_HABITS.length >= 3);
  for (const item of [...HARMFUL_HABITS, ...HELPFUL_HABITS]) {
    assert.ok(item.record && item.record.view && item.record.targetId, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
    assert.ok(item.body && item.said, item.id);
  }
  assert.match(HABIT_PARTIAL_OK, /数えません/);
  // 達成率・連続日数を持たない
  const code = codeOf('data/gutHabits.js') + codeOf('components/GutHabits.jsx');
  for (const bad of [/streak/i, /達成率/, /やれた数/]) {
    if (String(bad) === '/やれた数/') continue; // 「数えません」の文にだけ出る
    assert.doesNotMatch(code, bad, String(bad));
  }
  const ids = HABIT_PRECHECKS.map((p) => p.id);
  assert.ok(ids.includes('eating'), '食事の制限がつらかった経験の確認が無い');
});

// ───────────────────────── 食物繊維の食い違い ─────────────────────────

test('食物繊維の言い分は3つ並べるだけで、どれが正しいかを決めない', () => {
  const views = fiberViews();
  assert.equal(views.length, 3);
  for (const v of views) {
    assert.ok(v.side && v.applies && v.says && v.why, v.id);
  }
  assert.deepEqual(views.map((v) => v.id), ['stomach', 'gut', 'fodmap']);
  assert.match(FIBER_NOTE, /決めません/);
  assert.doesNotMatch(FIBER_NOTE, /正しいのは|おすすめは/);
  // 同じ出典の中での割れも、両方そのまま出す
  const within = withinSourceFiberConflict();
  assert.ok(within.a && within.b);
  assert.notEqual(within.a, within.b);
  assert.match(WEAK_STOMACH_AVOID.note, /決めません/);
  assert.ok(WEAK_STOMACH_AVOID.items.length >= 2);
});

test('出典どうしの食い違いに、今回の2本ぶんが足されている', () => {
  const byId = Object.fromEntries(SOURCE_CONFLICTS.map((c) => [c.id, c]));
  // 試す期間は3つめの言い分が増えた
  assert.ok(byId.trial.c, '3つめの言い分が入っていない');
  assert.match(byId.trial.c, /4週間/);
  // 「市販の整腸剤で腸内環境は変わるのか」で正面からぶつかる
  assert.ok(byId.supplement_worth, '整腸剤の効き目の食い違いが無い');
  assert.match(byId.supplement_worth.a, /正常化|よくなる/);
  assert.match(byId.supplement_worth.b, /疑わしい|ごく一部/);
  for (const item of SOURCE_CONFLICTS) {
    for (const text of [item.a, item.b, item.c].filter(Boolean)) {
      assert.doesNotMatch(text, /こちらが正しい|正解は/, item.id);
    }
  }
});

// ───────────────────────── 記録・受診メモ ─────────────────────────

test('使った市販薬は入力だけを残し、良し悪しを判定しない', () => {
  const day = normalizeDay({ date: '2026-09-02', otc: ['nsaids', 'stomach', 'にせもの'] });
  assert.deepEqual(day.otc, ['nsaids', 'stomach'], '知らない id は落とす');
  assert.ok(hasRecord(day), '市販薬だけでも「記録した日」になる');
  const empty = normalizeDay({ date: '2026-09-02' });
  assert.deepEqual(empty.otc, []);
  assert.equal(hasRecord(empty), false);
  // 数えるのは日数だけ（良し悪し・量は持たない）
  const days = { '2026-09-01': day, '2026-09-02': normalizeDay({ date: '2026-09-02', otc: ['nsaids'] }) };
  const counts = otcCounts(days, ['2026-09-01', '2026-09-02']);
  assert.equal(counts.anyDays, 2);
  assert.equal(counts.byKind.nsaids, 2);
  assert.equal(counts.byKind.stomach, 1);
  const code = codeOf('lib/stats.js');
  assert.doesNotMatch(code, /otcScore|otcRisk/i);
});

test('受診メモには既定で市販薬が入り、記録が無ければ行ごと出ない', () => {
  assert.ok(NOTE_PARTS.some((p) => p.id === 'otc'), '受診メモの選択肢に無い');
  assert.ok(DEFAULT_PARTS.includes('otc'), '既定で入っていない');
  const withOtc = { '2026-09-01': normalizeDay({ date: '2026-09-01', otc: ['nsaids'] }) };
  const text = buildVisitNote(withOtc, ['2026-09-01']);
  assert.match(text, /使った市販薬/);
  assert.match(text, /痛み止め/);
  // 記録が無い期間では、見出しごと出さない（空の見出しを並べない）
  const without = { '2026-09-01': normalizeDay({ date: '2026-09-01', belly: 'ok' }) };
  assert.doesNotMatch(buildVisitNote(without, ['2026-09-01']), /使った市販薬/);
  // 解釈を書かない
  assert.doesNotMatch(text, /飲みすぎ|控えるべき|やめたほうが/);
});

// ───────────────────────── 出典・目次 ─────────────────────────

test('出典に URL を書かない・確かめきれていないことを書く', () => {
  for (const path of ['data/butyrate.js', 'data/otcDrugs.js', 'data/gutHabits.js']) {
    assert.doesNotMatch(src(path), /https?:\/\//, path);
  }
  for (const source of [BUTYRATE_SOURCE, OTC_SOURCE, HABIT_SOURCE]) {
    assert.equal(source.check, true);
    assert.match(source.text, /未確認/);
    assert.match(source.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.match(BUTYRATE_PARTIAL_OK, /採点しません/);
  assert.match(BUTYRATE_PRECHECK_WARNING, /医師|薬剤師/);
  assert.ok(BUTYRATE_PRECHECKS.length >= 3);
});

test('目次からも辿れる（画面にある id を指す）', () => {
  const entries = buildTocEntries();
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  for (const item of [...SHORT_CHAIN]) assert.ok(byTitle.has(item.name), item.name);
  for (const item of [...BUTYRATE_ROLES, ...WITHDRAWN, ...BUTYRATE_CORRECTIONS, ...BUTYRATE_UNVERIFIED]) {
    assert.ok(byTitle.has(item.title), item.title);
  }
  for (const item of [...OTC_CORRECTIONS, ...OTC_UNVERIFIED]) assert.ok(byTitle.has(item.title), item.title);
  for (const item of [...HARMFUL_HABITS, ...HELPFUL_HABITS, ...HABIT_CORRECTIONS, ...HABIT_UNVERIFIED]) {
    assert.ok(byTitle.has(item.title), item.title);
  }
  assert.ok(byTitle.has(WEAK_STOMACH_AVOID.title));
  // 芽胞は用語が単一の正（派生側で二重に作らない）
  assert.ok(byTitle.get(SPORE.title), '芽胞が目次に無い');
  assert.equal(byTitle.get(SPORE.title).group, 'term', '芽胞は用語の側で持つ');

  // 飛び先は画面にある id を指す。**テンプレートで組み立てた id は素の文字列で見つからない**
  const screens = {
    butyrate: src('components/Butyrate.jsx'),
    otc: src('components/OtcDrugs.jsx'),
    habits: src('components/GutHabits.jsx'),
  };
  const templates = [
    [/^scfa-/, /id=\{`scfa-\$\{/],
    [/^brole-/, /id=\{`brole-\$\{/],
    [/^withdrawn-/, /id=\{`withdrawn-\$\{/],
    [/^bcorrection-/, /id=\{`bcorrection-\$\{/],
    [/^bunv-/, /id=\{`bunv-\$\{/],
    [/^otc-(?!kinds|stop|precheck|links|source|unverified|corrections)/, /id=\{`otc-\$\{/],
    [/^ocorrection-/, /id=\{`ocorrection-\$\{/],
    [/^ounv-/, /id=\{`ounv-\$\{/],
    [/^harm-/, /id=\{`harm-\$\{/],
    [/^help-/, /id=\{`help-\$\{/],
    [/^hcorrection-/, /id=\{`hcorrection-\$\{/],
    [/^hunv-/, /id=\{`hunv-\$\{/],
  ];
  const targets = entries
    .filter((e) => ['butyrate', 'otc', 'habit'].includes(e.group))
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
