import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CLEANUP_STEPS,
  FERMENTED_FOODS,
  STRESS_RELIEF,
  POSTURE_TIPS,
  CLEANUP_CORRECTIONS,
  CLEANUP_UNVERIFIED,
  CLEANUP_PRECHECKS,
  CLEANUP_PARTIAL_OK,
  CLEANUP_SOURCE,
} from '../src/data/cleanup.js';
import { fermentViews, threeWayConflicts, FERMENT_NOTE } from '../src/lib/conflicts.js';
import { normalizeDay } from '../src/lib/days.js';
import { lifeCounts } from '../src/lib/stats.js';
import { buildVisitNote } from '../src/lib/visitNote.js';
import { SLEEP_STEPS, POSTURE_STEPS } from '../src/data/scales.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

test('5つは記録できる所へつながっている', () => {
  assert.equal(CLEANUP_STEPS.length, 5);
  for (const step of CLEANUP_STEPS) {
    assert.ok(step.record && step.record.view && step.record.targetId, step.id);
    assert.match(step.reading, /^[ぁ-んー]+$/, step.id);
  }
  // 食事を強く制限する話には必ず注意を付ける
  const avoid = CLEANUP_STEPS.find((s) => s.id === 'avoid');
  assert.match(avoid.caution, /摂食障害/);
  assert.match(avoid.caution, /成長期|妊娠/);
  // 発酵食品の項は、低FODMAP とぶつかることを必ず書く
  const pro = CLEANUP_STEPS.find((s) => s.id === 'probiotics');
  assert.match(pro.caution, /低FODMAP/);
  assert.match(pro.caution, /どちらが正しいかは/);
});

test('人を責める言い方を持ち込まない', () => {
  const screen = codeOf('components/Cleanup.jsx');
  const data = codeOf('data/cleanup.js');
  // 「腸が汚い＝見た目も汚い」の言い回しは、訂正の中でしか出てこない
  const looks = CLEANUP_CORRECTIONS.find((c) => c.id === 'looks');
  assert.ok(looks, '「見た目も汚い」への訂正を持つ');
  assert.match(looks.correction, /この言い方を採りません/);
  assert.match(looks.correction, /受診が遅れる/);
  // アプリ自身の文としては出さない。**この言い回しが出てよいのは「採らない」と書いた所だけ**
  // （出典の言い分 claim と、その見出し title を外してから見る）
  const rest = data.split(looks.claim).join('').split(looks.title).join('');
  for (const bad of [/あなたの腸は汚れています/, /腸が汚い人は/, /不健康な人は/]) {
    assert.doesNotMatch(screen, bad, String(bad));
    assert.doesNotMatch(rest, bad, String(bad));
  }
  // 「採らない」と書いてある側には、ちゃんと残っている（黙って消していない）
  assert.match(looks.claim, /腸が汚れている人は/);
});

test('心の不調を腸で片づけない', () => {
  const dep = CLEANUP_CORRECTIONS.find((c) => c.id === 'depression');
  assert.ok(dep);
  assert.match(dep.correction, /見直されています/);
  assert.match(dep.correction, /医療機関へ相談/);
  // セロトニンの脳と腸は別、と必ず書く
  const pool = CLEANUP_CORRECTIONS.find((c) => c.id === 'serotonin_pool');
  assert.match(pool.correction, /脳へは入れません/);
  // 受診の目安へ行ける
  assert.match(codeOf('components/Cleanup.jsx'), /onGo\('redflags'/);
});

test('出典の誤り4件を、元の言い分も残して並べる', () => {
  assert.equal(CLEANUP_CORRECTIONS.length, 4);
  for (const item of CLEANUP_CORRECTIONS) {
    assert.ok(item.claim, `${item.id} に元の言い分がない`);
    assert.ok(item.correction, `${item.id} に訂正がない`);
    assert.ok(item.title && item.reading, item.id);
  }
  assert.match(codeOf('components/Cleanup.jsx'), /出典：\{item\.claim\}/);
});

test('裏が取れていない主張を隠さず持つ', () => {
  assert.ok(CLEANUP_UNVERIFIED.length >= 5);
  for (const item of CLEANUP_UNVERIFIED) {
    assert.ok(item.claim && item.note && item.title, item.id);
    assert.match(item.note, /たどれて|確かめ|言い切れ|言葉のあや|言い切りすぎ|さまざま/, item.id);
  }
  // 数字をアプリの言葉として画面に書かない
  const screen = codeOf('components/Cleanup.jsx');
  for (const bad of [/90%/, /60〜70%/, /9割の/]) assert.doesNotMatch(screen, bad, String(bad));
});

test('発酵食品を3つの考え方から並べ、どれが正しいかを決めない', () => {
  const views = fermentViews();
  assert.equal(views.length, FERMENTED_FOODS.length);
  for (const v of views) {
    assert.equal(v.views.length, 3, `${v.name} は3つの見方をそろえる`);
    assert.match(v.views[0], /腸活/);
    assert.match(v.views[1], /低FODMAP/);
    assert.match(v.views[2], /アダムスキー/);
  }
  const yogurt = views.find((v) => v.name === 'ヨーグルト');
  assert.equal(yogurt.conflict, true);
  assert.equal(yogurt.fodmap, '多め');
  assert.equal(yogurt.speed, '速い');
  // 当てはめただけのものを名指しと同じ顔で見せない
  const natto = views.find((v) => v.name === '納豆');
  assert.match(natto.views[2], /当てはめました/);
  // 3つとも意見があってぶつかるのは、名指しされているものだけ数える
  assert.deepEqual(threeWayConflicts().map((v) => v.name), ['ヨーグルト']);
  assert.match(FERMENT_NOTE, /どれが正しいかを決めません/);
});

test('眠れたか・姿勢は段だけを残す（時間を数えない・採点しない）', () => {
  assert.equal(SLEEP_STEPS.length, 3);
  assert.equal(POSTURE_STEPS.length, 3);
  const data = codeOf('data/scales.js');
  assert.doesNotMatch(data, /sleepHours|睡眠時間を数え/);
  const day = normalizeDay({ date: '2026-09-02', sleep: 'good', posture: 'noticed' });
  assert.equal(day.sleep, 'good');
  assert.equal(day.posture, 'noticed');
  // 知らない値は捨てる
  assert.equal(normalizeDay({ date: '2026-09-02', sleep: 'なぞ', posture: 7 }).sleep, null);
});

test('ふりかえり・受診メモにも日数で出せる（平均を出さない）', () => {
  const days = {
    '2026-09-01': normalizeDay({ date: '2026-09-01', sleep: 'bad', posture: 'slouched' }),
    '2026-09-02': normalizeDay({ date: '2026-09-02', sleep: 'good', posture: 'noticed' }),
  };
  const keys = ['2026-09-01', '2026-09-02'];
  const life = lifeCounts(days, keys);
  assert.equal(life.sleepDays, 2);
  assert.equal(life.postureDays, 2);
  assert.equal(life.sleep.good, 1);
  assert.equal(life.posture.noticed, 1);
  const note = buildVisitNote(days, keys, ['life']);
  assert.match(note, /眠れたか：/);
  assert.match(note, /姿勢：/);
  assert.doesNotMatch(note, /平均/);
});

test('全部やらなくてよい・出典に URL を書かない', () => {
  assert.match(CLEANUP_PARTIAL_OK, /全部いっぺんに/);
  assert.match(CLEANUP_PARTIAL_OK, /採点しません/);
  assert.match(codeOf('components/Cleanup.jsx'), /CLEANUP_PARTIAL_OK/);
  assert.doesNotMatch(CLEANUP_SOURCE.text, /https?:|www\./);
  assert.doesNotMatch(src('data/cleanup.js'), /https?:\/\//);
  assert.match(CLEANUP_SOURCE.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  // ストレス解消法に効き目の大きさを書かない
  for (const item of STRESS_RELIEF) {
    assert.doesNotMatch(item.body, /\d+%|必ず|絶対に/);
  }
  assert.equal(STRESS_RELIEF.length, 4);
  assert.equal(POSTURE_TIPS.length, 3);
  assert.ok(CLEANUP_PRECHECKS.some((p) => p.id === 'mental'));
});

test('目次から腸のお掃除のすべてに辿り着ける', () => {
  const entries = buildTocEntries();
  const titles = new Set(entries.map((e) => e.title));
  for (const step of CLEANUP_STEPS) assert.ok(titles.has(step.title), step.title);
  for (const item of STRESS_RELIEF) assert.ok(titles.has(item.title), item.title);
  for (const item of POSTURE_TIPS) assert.ok(titles.has(item.title), item.title);
  for (const item of CLEANUP_CORRECTIONS) assert.ok(titles.has(item.title), item.title);
  for (const item of CLEANUP_UNVERIFIED) assert.ok(titles.has(item.title), item.title);
  for (const term of ['腸脳相関', 'セロトニン', '活性酸素', '発酵食品', '自律神経', '眠れたかの記録', '姿勢の記録']) {
    assert.ok(titles.has(term), term);
  }
  assert.ok(entries.filter((e) => e.group === 'cleanup').length >= 22);
});

test('画面に出す文にマークダウンを書かない', () => {
  // `**強調**` がそのまま表示される（鏡・間合いで実際に出した）
  for (const entry of buildTocEntries()) {
    assert.doesNotMatch(entry.description || '', /\*\*/, entry.title);
  }
  for (const item of [...CLEANUP_UNVERIFIED, ...STRESS_RELIEF, ...POSTURE_TIPS]) {
    assert.doesNotMatch(item.note || item.body || '', /\*\*/, item.id);
  }
});
