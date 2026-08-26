// 目次・索引とカレンダーのテスト。
//
// CLAUDE.md「目次・索引の共通ルール（全アプリ共通）」を機械チェックする。
//   1. 並びは あ〜ん → A〜Z（読みで並べる）
//   2. 数字も読み方で振り分ける
//   3. 読みは明示、自動推定しない
//   4. タイトルは重複させない
// これが落ちたら、目次に誤りが残っているということ。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  numberToKana,
  bucketOf,
  readingInfo,
  compareReading,
  normalizeReading,
  kataToHira,
  groupByBucket,
  BUCKETS,
  KANA_BUCKETS,
  LATIN_BUCKET,
  UNKNOWN_BUCKET,
} from '../src/lib/yomi.js';
import { buildToc, filterToc, tocSections, kindCounts, TOC_KINDS } from '../src/data/toc.js';
import { GENRES, allGenres, genreById, makeGenre, DEFAULT_GENRE_ID, DEFAULT_SEATS_PER_GENRE } from '../src/data/genres.js';
import { ROLES } from '../src/data/roles.js';
import { TOOLS } from '../src/data/tools.js';
import { WORKFLOWS } from '../src/data/workflows.js';
import { JOB_TEMPLATES } from '../src/data/jobTemplates.js';
import { presetEmployee, initialPresets, archetypeFor } from '../src/data/employees.js';
import { seedAll, nextSeat, seatsOf, isGenreFull, makeEmployee } from '../src/lib/seed.js';
import {
  monthMatrix,
  dayDetail,
  monthSummary,
  monthMarks,
  makeEvent,
  suggestStart,
  upcoming,
  startOfDay,
  sameDay,
  ymd,
  DAY_MS,
  EVENT_KINDS,
} from '../src/lib/schedule.js';

// ───────── ルール2：数字は読み方で振り分ける ─────────

test('数字を読み方に変換する', () => {
  assert.equal(numberToKana(0), 'ぜろ');
  assert.equal(numberToKana(3), 'さん');
  assert.equal(numberToKana(20), 'にじゅう');
  assert.equal(numberToKana(100), 'ひゃく');
  assert.equal(numberToKana(300), 'さんびゃく');
  assert.equal(numberToKana(600), 'ろっぴゃく');
  assert.equal(numberToKana(800), 'はっぴゃく');
  assert.equal(numberToKana(1000), 'せん');
  assert.equal(numberToKana(3000), 'さんぜん');
  assert.equal(numberToKana(8000), 'はっせん');
  assert.equal(numberToKana(10000), 'いちまん');
  assert.equal(numberToKana(361), 'さんびゃくろくじゅういち');
});

test('CLAUDE.md の例どおりの行に入る（見た目の数字順で先頭に固めない）', () => {
  assert.equal(readingInfo('20歳未満').bucket, 'な', '「20歳未満」は にじゅう… で な行');
  assert.equal(readingInfo('361穴').bucket, 'さ', '「361穴」は さんびゃく… で さ行');
  assert.equal(readingInfo('3人目の席').bucket, 'さ');
});

// ───────── ルール3：読みは明示、推定しない ─────────

test('漢字の読みは推測しない（読みが無ければ「その他」に出す）', () => {
  const info = readingInfo('経理');
  assert.equal(info.source, 'missing');
  assert.equal(info.bucket, UNKNOWN_BUCKET);
  assert.equal(info.reading, '', '推測した読みを勝手に入れない');
});

test('読みが明示されていればそれに従う', () => {
  const info = readingInfo('経理', 'けいり');
  assert.equal(info.source, 'explicit');
  assert.equal(info.bucket, 'か');
});

test('かな・カタカナだけなら機械変換で足りる（誤読しないため）', () => {
  assert.equal(readingInfo('リサーチャー').bucket, 'ら');
  assert.equal(readingInfo('リサーチャー').source, 'kana');
  assert.equal(kataToHira('ルナ'), 'るな');
});

test('英字始まりは A〜Z の枠', () => {
  assert.equal(readingInfo('Web検索', 'うぇぶけんさく').bucket, 'あ', '読みがあればそちらが優先');
  assert.equal(readingInfo('Notion').bucket, LATIN_BUCKET);
});

// ───────── ルール1：並びは あ〜ん → A〜Z ─────────

test('枠の並びは あ行〜わ行 → A-Z → その他', () => {
  assert.deepEqual(KANA_BUCKETS, ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']);
  assert.equal(BUCKETS[BUCKETS.length - 2], LATIN_BUCKET, 'A-Z は かな の後');
  assert.equal(BUCKETS[BUCKETS.length - 1], UNKNOWN_BUCKET, 'その他 は最後');
});

test('濁点・半濁点・小書きは元の音の行に寄せる', () => {
  assert.equal(bucketOf('がくしゅう'), 'か');
  assert.equal(bucketOf('ばんごう'), 'は');
  assert.equal(bucketOf('ぱんだ'), 'は');
  assert.equal(bucketOf('ゃ'), 'や');
  assert.equal(bucketOf('っこう'), 'た');
});

test('長音で始まる読みは次の字で行を決める', () => {
  assert.equal(bucketOf('ーめん'), 'ま');
});

test('読みの辞書順で並べ替えられる', () => {
  const words = ['さくら', 'あさ', 'かき', 'あい', 'ん', 'わたし'];
  const sorted = [...words].sort(compareReading);
  assert.deepEqual(sorted, ['あい', 'あさ', 'かき', 'さくら', 'わたし', 'ん']);
});

test('短い読みが先に来る（前方一致のとき）', () => {
  assert.ok(compareReading('かき', 'かきくけこ') < 0);
});

test('groupByBucket は枠の順に並べ、空の枠は出さない', () => {
  const items = [
    { title: 'ら', reading: 'らん', bucket: 'ら' },
    { title: 'あ', reading: 'あい', bucket: 'あ' },
    { title: 'あ2', reading: 'あう', bucket: 'あ' },
  ];
  const groups = groupByBucket(items);
  assert.deepEqual(groups.map((g) => g.bucket), ['あ', 'ら']);
  assert.deepEqual(groups[0].items.map((i) => i.reading), ['あい', 'あう']);
});

// ───────── ルール3・4：データ側の読みと重複 ─────────

test('目次に載る全データに読みが明示されている', () => {
  const missing = [];
  for (const [label, list] of [
    ['役職', ROLES],
    ['ジャンル', GENRES],
    ['道具', TOOLS],
    ['仕事の流れ', WORKFLOWS],
    ['案件の型', JOB_TEMPLATES],
  ]) {
    for (const item of list) {
      if (!item.reading) missing.push(`${label}:${item.name}`);
      else if (!/^[ぁ-んー]+$/.test(item.reading)) missing.push(`${label}:${item.name}（ひらがな以外）`);
    }
  }
  assert.deepEqual(missing, [], '読みが無い／ひらがなでない項目がある');
});

test('目次の項目が「その他」に落ちない（＝読みの入れ忘れが無い）', () => {
  const { employees } = seedAll();
  const entries = buildToc({ employees });
  const fallen = entries.filter((e) => e.bucket === UNKNOWN_BUCKET);
  assert.deepEqual(fallen.map((e) => e.title), [], '読みが無く「その他」に落ちた項目がある');
});

test('目次のタイトルが重複しない', () => {
  const { employees } = seedAll();
  const entries = buildToc({ employees });
  const seen = new Map();
  const dups = [];
  for (const e of entries) {
    if (seen.has(e.title)) dups.push(`${e.title}（${seen.get(e.title)} と ${e.kind}）`);
    seen.set(e.title, e.kind);
  }
  assert.deepEqual(dups, [], 'タイトルが重複している');
});

test('目次の項目IDが重複しない', () => {
  const { employees } = seedAll();
  const ids = buildToc({ employees }).map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('目次の飛び先はすべて実在する画面', () => {
  // App.jsx が扱う画面名
  const VIEWS = new Set(['home', 'employees', 'employee', 'compose', 'knowledge', 'company', 'deals', 'connect', 'toc', 'calendar', 'genre']);
  const { employees } = seedAll();
  for (const e of buildToc({ employees })) {
    assert.ok(VIEWS.has(e.view), `${e.title} の飛び先 ${e.view} が存在しない`);
  }
});

test('目次は全データを網羅する（書き写しではなく自動生成）', () => {
  const { employees } = seedAll();
  const entries = buildToc({ employees });
  const counts = kindCounts(entries);
  const by = Object.fromEntries(counts.map((c) => [c.id, c.count]));
  assert.equal(by.role, ROLES.length);
  assert.equal(by.genre, GENRES.length);
  assert.equal(by.tool, TOOLS.length);
  assert.equal(by.workflow, WORKFLOWS.length);
  assert.equal(by.job, JOB_TEMPLATES.length);
  assert.equal(by.employee, employees.length);
  assert.equal(TOC_KINDS.length, counts.length);
});

test('休職した社員は目次に出ない', () => {
  const { employees } = seedAll();
  const archived = employees.map((e, i) => (i === 0 ? { ...e, archivedAt: Date.now() } : e));
  const entries = buildToc({ employees: archived });
  assert.ok(!entries.some((e) => e.id === `emp:${employees[0].id}`));
});

test('目次の検索は名前でも読みでも当たる', () => {
  const { employees } = seedAll();
  const entries = buildToc({ employees });
  assert.ok(filterToc(entries, { query: 'リサーチャー' }).length > 0);
  assert.ok(filterToc(entries, { query: 'りさーちゃー' }).length > 0, '読み（ひらがな）で引けない');
  assert.equal(filterToc(entries, { kind: 'genre' }).length, GENRES.length);
});

test('目次の並びは枠ごとに読み順（先頭は必ず あ行 側）', () => {
  const { employees } = seedAll();
  const sections = tocSections(buildToc({ employees }));
  const order = sections.map((s) => s.bucket);
  const expected = BUCKETS.filter((b) => order.includes(b));
  assert.deepEqual(order, expected, '枠が あ〜ん → A〜Z の順に並んでいない');
});

// ───────── ジャンル × 役職 × 3席 ─────────

test('ジャンルは重複せず、読みが明示されている', () => {
  const ids = GENRES.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  const names = GENRES.map((g) => g.name);
  assert.equal(new Set(names).size, names.length);
  for (const g of GENRES) assert.ok(/^[ぁ-んー]+$/.test(g.reading), `${g.name} の読みがひらがなでない`);
  assert.ok(genreById(DEFAULT_GENRE_ID), '既定のジャンルが無い');
});

test('1つの組（役職×ジャンル）に3席まで登録できる', () => {
  const { employees } = seedAll();
  assert.equal(DEFAULT_SEATS_PER_GENRE, 3);
  assert.equal(seatsOf(employees, 'researcher', 'general').length, 3);
  assert.equal(isGenreFull(employees, 'researcher', 'general'), true);
  // 別ジャンルはまだ空いている＝そこにも3人雇える
  assert.equal(seatsOf(employees, 'researcher', 'health').length, 0);
  assert.equal(isGenreFull(employees, 'researcher', 'health'), false);
});

test('席番号はジャンルごとに数える（別ジャンルの席で番号が飛ばない）', () => {
  const { employees } = seedAll();
  assert.equal(nextSeat(employees, 'researcher', 'general'), 4, '汎用は3席埋まっている');
  assert.equal(nextSeat(employees, 'researcher', 'health'), 1, '医療は1席目から');
  assert.equal(nextSeat(employees, 'researcher', 'money'), 1);
});

test('ジャンルが違えば名前が重ならない', () => {
  const names = new Set();
  const dups = [];
  for (const g of GENRES) {
    for (const r of ROLES) {
      for (let seat = 1; seat <= 3; seat += 1) {
        const e = presetEmployee(r.id, seat, g.id);
        if (names.has(e.name)) dups.push(e.name);
        names.add(e.name);
      }
    }
  }
  assert.deepEqual(dups, [], '別ジャンルの社員と名前が重複している');
});

test('社員には読みが入っていて、目次で正しい行に入る', () => {
  const { employees } = seedAll();
  for (const e of employees) {
    assert.ok(e.reading, `${e.name} に読みが無い`);
    assert.notEqual(readingInfo(e.name, e.reading).bucket, UNKNOWN_BUCKET);
  }
});

test('ジャンルを指定するとその分野の指示が社員に入る', () => {
  const general = presetEmployee('researcher', 1, 'general');
  const health = presetEmployee('researcher', 1, 'health');
  assert.equal(general.genreHint, '', '汎用にはよけいな分野指示を足さない');
  assert.ok(health.genreHint.includes('医療・健康'));
  assert.ok(health.genreHint.includes('診断ではありません'), '医療ジャンルの注意が入っていない');
  assert.ok(health.specialties.includes('医療・健康'));
});

test('初期チームは汎用ジャンルの 6役職 × 3席', () => {
  const presets = initialPresets();
  assert.equal(presets.length, 18);
  assert.ok(presets.every((p) => p.genreId === DEFAULT_GENRE_ID));
});

test('ユーザーが足すジャンルは読みが必須（推定しないため）', () => {
  assert.throws(() => makeGenre({ name: '鍼灸' }), /読み/);
  assert.throws(() => makeGenre({ name: '鍼灸', reading: 'シンキュウ漢字' }), /ひらがな/);
  assert.throws(() => makeGenre({ name: '', reading: 'しんきゅう' }), /ジャンル名/);
  const g = makeGenre({ name: '鍼灸・東洋医学', reading: 'しんきゅうとうよういがく' });
  assert.equal(g.custom, true);
  assert.equal(bucketOf(g.reading), 'さ');
});

test('足したジャンルは目次にも並ぶ', () => {
  const custom = [makeGenre({ name: '鍼灸・東洋医学', reading: 'しんきゅうとうよういがく' })];
  const entries = buildToc({ employees: [], customGenres: custom });
  const found = entries.find((e) => e.title === '鍼灸・東洋医学');
  assert.ok(found, '足したジャンルが目次に出ない');
  assert.equal(found.bucket, 'さ');
  assert.equal(allGenres(custom).length, GENRES.length + 1);
});

test('4席目以降も持ち味が循環する', () => {
  assert.equal(archetypeFor(1).strength, '網羅');
  assert.equal(archetypeFor(4).strength, '網羅');
  assert.equal(archetypeFor(6).strength, '別視点');
});

// ───────── カレンダー ─────────

test('月のマス目は日曜始まりで、必ず7の倍数', () => {
  for (let m = 0; m < 12; m += 1) {
    const weeks = monthMatrix(2026, m);
    assert.ok(weeks.every((w) => w.length === 7), `${m + 1}月の行が7日でない`);
    assert.equal(weeks[0][0].weekday, 0, '週の始まりが日曜でない');
    const inMonth = weeks.flat().filter((c) => c.inMonth);
    assert.equal(inMonth.length, new Date(2026, m + 1, 0).getDate(), `${m + 1}月の日数が合わない`);
  }
});

test('月のマス目に前後の月の日も入る（曜日の列がずれないため）', () => {
  const weeks = monthMatrix(2026, 7); // 2026年8月1日は土曜
  assert.equal(weeks[0].filter((c) => !c.inMonth).length, 6);
  assert.equal(weeks[0][6].date, 1);
});

test('丸ごと翌月の週は出さない', () => {
  for (let m = 0; m < 12; m += 1) {
    const weeks = monthMatrix(2026, m);
    const last = weeks[weeks.length - 1];
    assert.ok(last.some((c) => c.inMonth), `${m + 1}月に不要な週がある`);
  }
});

test('その日の中身に、完了した仕事・知識・締切・予定が集まる', () => {
  const now = Date.now();
  const d = dayDetail(now, {
    tasks: [
      { id: 't1', status: 'done', finishedAt: now },
      { id: 't2', status: 'done', finishedAt: now - 3 * DAY_MS },
      { id: 't3', status: 'running', finishedAt: null },
    ],
    knowledge: [{ id: 'k1', createdAt: now }],
    meetings: [{ id: 'm1', createdAt: now }],
    deals: [
      { id: 'd1', dueAt: now, status: 'active' },
      { id: 'd2', dueAt: now, status: 'paid' },
    ],
    events: [makeEvent({ title: '納品する', at: now })],
  });
  assert.equal(d.tasks.length, 1, '別の日の仕事まで数えている');
  assert.equal(d.knowledge.length, 1);
  assert.equal(d.meetings.length, 1);
  assert.equal(d.deadlines.length, 1, '入金済みの案件を締切に出している');
  assert.equal(d.events.length, 1);
  assert.equal(d.total, 5);
});

test('締切は deals から導く（予定に複製しない）', () => {
  const now = Date.now();
  const deal = { id: 'd1', dueAt: now, status: 'active', title: 'A' };
  const before = dayDetail(now, { deals: [deal] });
  assert.equal(before.deadlines.length, 1);
  // 締切を翌日にずらすと、カレンダー側も自動でついてくる
  const moved = dayDetail(now, { deals: [{ ...deal, dueAt: now + DAY_MS }] });
  assert.equal(moved.deadlines.length, 0, '締切を直したのにカレンダーが古いまま');
});

test('月のマスの印をまとめて計算できる', () => {
  const now = Date.now();
  const weeks = monthMatrix(new Date(now).getFullYear(), new Date(now).getMonth());
  const marks = monthMarks(weeks, {
    tasks: [{ status: 'done', finishedAt: now }],
    knowledge: [{ createdAt: now }],
  });
  const m = marks.get(startOfDay(now));
  assert.ok(m, '今日の印が無い');
  assert.equal(m.tasks, 1);
  assert.equal(m.knowledge, 1);
});

test('月の集計は、その月のぶんだけ数える', () => {
  const base = new Date(2026, 7, 15).getTime();
  const prev = new Date(2026, 6, 15).getTime();
  const s = monthSummary(2026, 7, {
    tasks: [
      { status: 'done', finishedAt: base, totalCost: 0.5 },
      { status: 'done', finishedAt: prev, totalCost: 9 },
    ],
    knowledge: [{ createdAt: base }, { createdAt: prev }],
    deals: [
      { status: 'paid', fee: 10000, paidAt: base },
      { status: 'paid', fee: 99999, paidAt: prev },
    ],
  });
  assert.equal(s.tasks, 1);
  assert.equal(s.knowledge, 1);
  assert.equal(s.earned, 10000);
  assert.equal(s.cost, 0.5);
});

test('予定は内容が必須で、日付は0時にそろえる', () => {
  assert.throws(() => makeEvent({ title: '   ' }), /内容/);
  const ev = makeEvent({ title: '納品', at: Date.now(), kind: 'deliver' });
  assert.equal(ev.at, startOfDay(ev.at));
  assert.equal(ev.kind, 'deliver');
  assert.equal(ev.done, false);
  // 知らない種類は既定に倒す
  assert.equal(makeEvent({ title: 'x', kind: 'なにか' }).kind, 'plan');
  assert.ok(EVENT_KINDS.every((k) => k.reading && /^[ぁ-んー]+$/.test(k.reading)));
});

test('締切から着手日を逆算する（締切日にいきなり始めさせない）', () => {
  const now = Date.now();
  assert.equal(suggestStart({ dueAt: now + 20 * DAY_MS }, now).lead, 7);
  assert.equal(suggestStart({ dueAt: now + 10 * DAY_MS }, now).lead, 3);
  assert.equal(suggestStart({ dueAt: now + 5 * DAY_MS }, now).lead, 1);
  assert.equal(suggestStart({ dueAt: now + 1 * DAY_MS }, now).lead, 0);
  assert.equal(suggestStart({ dueAt: now + 10 * DAY_MS }, now).daysLeft, 10, '日数が1日ずれている');
  assert.equal(suggestStart({ dueAt: now - 2 * DAY_MS }, now).overdue, true);
  assert.equal(suggestStart({}, now), null);
});

test('直近の予定は近い順で、終わったもの・入金済みは出さない', () => {
  const now = startOfDay(Date.now());
  const list = upcoming(
    {
      events: [
        makeEvent({ title: '遠い', at: now + 5 * DAY_MS }),
        { ...makeEvent({ title: '済み', at: now + 1 * DAY_MS }), done: true },
        makeEvent({ title: '近い', at: now + 1 * DAY_MS }),
      ],
      deals: [
        { id: 'd1', title: '締切', dueAt: now + 2 * DAY_MS, status: 'active', fee: 5000 },
        { id: 'd2', title: '入金済み', dueAt: now + 2 * DAY_MS, status: 'paid' },
      ],
    },
    now
  );
  assert.deepEqual(list.map((x) => x.title), ['近い', '締切', '遠い']);
  assert.equal(list[0].daysLeft, 1);
  assert.equal(list[1].kind, 'deadline');
});

test('日付のヘルパー', () => {
  const now = Date.now();
  assert.equal(startOfDay(now), startOfDay(startOfDay(now)));
  assert.ok(sameDay(now, startOfDay(now)));
  assert.ok(!sameDay(now, now + DAY_MS));
  assert.match(ymd(new Date(2026, 7, 5).getTime()), /^2026-08-05$/);
});

// ───────── 既存の仕組みとの整合 ─────────

test('社員データはジャンルを持つが、エンジンの実体は持たない（分離は維持）', () => {
  const emp = makeEmployee(presetEmployee('researcher', 1, 'health'));
  assert.equal(emp.genreId, 'health');
  assert.ok(emp.reading);
  assert.equal(emp.providerPref, 'auto');
  assert.equal(emp.provider, undefined);
  assert.equal(emp.apiKey, undefined);
});
