import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  probioticHome,
  PROBIOTIC_HOME_NOTE,
  butyrateSummary,
  BUTYRATE_SUMMARY_NOTE,
  GUT_CARE_TOPICS,
  GUT_CARE_NOTE,
} from '../src/lib/homeTopics.js';
import {
  BACTERIA,
  PRODUCTS,
  PROBIOTIC_CORRECTIONS,
  PROBIOTIC_UNVERIFIED,
  PROBIOTIC_FAQ,
  PROBIOTIC_PRECHECKS,
} from '../src/data/probiotics.js';
import {
  SHORT_CHAIN,
  BUTYRATE_ROLES,
  WITHDRAWN,
  BUTYRATE_CORRECTIONS,
  BUTYRATE_UNVERIFIED,
} from '../src/data/butyrate.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

const empty = { name: '', productId: '', startedOn: '', note: '' };

// ───────────────────────── ホームの整腸剤 ─────────────────────────

test('整腸剤の内訳は元データから毎回数える（手書きの一覧を持たない）', () => {
  const home = probioticHome(empty, {});
  assert.equal(home.counts.bacteria, BACTERIA.length);
  assert.equal(home.counts.products, PRODUCTS.length);
  assert.equal(home.counts.corrections, PROBIOTIC_CORRECTIONS.length);
  assert.equal(home.counts.unverified, PROBIOTIC_UNVERIFIED.length);
  assert.equal(home.counts.faq, PROBIOTIC_FAQ.length);
  assert.equal(home.counts.prechecks, PROBIOTIC_PRECHECKS.length);
  // ホーム専用の手書きの一覧を作らない
  const code = codeOf('lib/homeTopics.js');
  assert.doesNotMatch(code, /const PROBIOTIC_HOME_LIST = \[/);
  assert.match(code, /from '\.\.\/data\/probiotics\.js'/);
});

test('整腸剤の項目は、勧めない・順位を付けない・飲み合わせを調べない', () => {
  assert.match(PROBIOTIC_HOME_NOTE, /商品を勧めません/);
  assert.match(PROBIOTIC_HOME_NOTE, /順位も付けません/);
  assert.match(PROBIOTIC_HOME_NOTE, /薬剤師/);
  const home = probioticHome(empty, {});
  assert.match(home.interactionNote, /飲み合わせを調べません/);
  const code = codeOf('lib/homeTopics.js') + codeOf('components/Home.jsx');
  assert.doesNotMatch(code, /おすすめ順|ランキング|1位/);
});

test('飲めなかった日を数えない・連続日数を持たない', () => {
  const days = { '2026-09-01': { probiotic: true }, '2026-09-03': { probiotic: true } };
  const home = probioticHome(
    { name: 'テスト', productId: '', startedOn: '2026-09-01', note: '' },
    days,
    '2026-09-03',
  );
  assert.equal(home.registered, true);
  assert.equal(home.takenToday, true);
  // 通算だけで、連続は数えない
  const code = codeOf('lib/homeTopics.js') + codeOf('components/Home.jsx');
  assert.doesNotMatch(code, /\bstreak\b/i);
  assert.doesNotMatch(codeOf('lib/homeTopics.js'), /連続/);
  // ホームで「連続」が出てよいのは、数えていないと断っている行だけ（行で数える）
  const hits = codeOf('components/Home.jsx')
    .split('\n')
    .filter((line) => line.includes('連続'));
  assert.equal(hits.length, 1, hits.join('\n'));
  assert.match(hits[0], /数えていません/);
});

test('登録していないときも黙らない', () => {
  const home = probioticHome(empty, {});
  assert.equal(home.registered, false);
  assert.match(home.line, /登録すると/);
  assert.equal(home.name, '');
});

// ───────────────────── あなたに向いた腸活 ─────────────────────

test('「あなたに向いた」でも、向き不向きをアプリが決めない', () => {
  assert.match(GUT_CARE_NOTE, /アプリが決めることはしません/);
  assert.match(GUT_CARE_NOTE, /自分で選ぶための材料/);
  assert.match(GUT_CARE_NOTE, /自分の記録で見つけて/);
  // 判定・診断する仕組みを持たない
  const code = codeOf('lib/homeTopics.js') + codeOf('components/Home.jsx');
  assert.doesNotMatch(code, /function\s+(judge|diagnose|recommendFor|suitFor)\b/i);
  assert.doesNotMatch(code, /あなたには.*が合/);
  assert.doesNotMatch(code, /スコア|[0-9]+点/);
});

test('まとまりを1件足せば、ホームも目次も自動で増える（画面に if を書き足さない）', () => {
  assert.ok(GUT_CARE_TOPICS.length >= 1);
  for (const topic of GUT_CARE_TOPICS) {
    for (const key of ['id', 'title', 'reading', 'lead', 'view', 'targetId', 'label']) {
      assert.ok(topic[key], `${topic.id}: ${key} が無い`);
    }
    assert.equal(typeof topic.rows, 'function', `${topic.id}: rows が関数でない`);
    assert.equal(typeof topic.source, 'function', `${topic.id}: source が関数でない`);
    assert.ok(topic.note, `${topic.id}: note が無い`);
    const rows = topic.rows();
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.ok(row.id && row.title && Array.isArray(row.lines) && row.lines.length > 0, row.id);
    }
  }
  // ホームはまとまりごとの分岐を持たない
  const screen = codeOf('components/Home.jsx');
  assert.doesNotMatch(screen, /topic\.id === '/);
  assert.match(screen, /GUT_CARE_TOPICS\.map/);
});

// ───────────────────────── 酪酸菌まとめ ─────────────────────────

test('酪酸菌まとめは元データから毎回導く', () => {
  const s = butyrateSummary();
  assert.equal(s.counts.shortChain, SHORT_CHAIN.length);
  assert.equal(s.counts.roles, BUTYRATE_ROLES.length);
  assert.equal(s.counts.withdrawn, WITHDRAWN.length);
  assert.equal(s.counts.corrections, BUTYRATE_CORRECTIONS.length);
  assert.equal(s.counts.unverified, BUTYRATE_UNVERIFIED.length);
  assert.ok(s.spore.title && s.spore.body && s.spore.caution);
  assert.match(s.source.text, /未確認/);
  const code = codeOf('lib/homeTopics.js');
  assert.doesNotMatch(code, /const BUTYRATE_HOME_LIST = \[/);
  assert.match(code, /from '\.\.\/data\/butyrate\.js'/);
});

test('酪酸菌まとめは、出典が取り下げた説を消さない', () => {
  const butyrate = GUT_CARE_TOPICS.find((t) => t.id === 'butyrate');
  assert.ok(butyrate, '酪酸菌まとめが無い');
  const titles = butyrate.rows().map((r) => r.title);
  for (const w of WITHDRAWN) assert.ok(titles.includes(w.title), w.title);
  assert.match(BUTYRATE_SUMMARY_NOTE, /取り下げた説/);
  // 「そう説明されている」までで止める
  assert.match(BUTYRATE_SUMMARY_NOTE, /説明している/);
  assert.match(BUTYRATE_SUMMARY_NOTE, /積み上がります/);
});

// ───────────────────────── 目次 ─────────────────────────

test('目次からも辿れる（ホームにある id を指す）', () => {
  const entries = buildTocEntries();
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  assert.ok(byTitle.has('ホームの整腸剤'));
  assert.ok(byTitle.has('あなたに向いた腸活'));
  for (const topic of GUT_CARE_TOPICS) assert.ok(byTitle.has(topic.title), topic.title);

  const screen = src('components/Home.jsx');
  const targets = entries
    .filter((e) => ['ホームの整腸剤', 'あなたに向いた腸活', ...GUT_CARE_TOPICS.map((t) => t.title)].includes(e.title))
    .flatMap((e) => e.destinations)
    .filter((d) => d.view === 'home')
    .map((d) => d.targetId);
  assert.ok(targets.includes('home-probiotic'));
  assert.ok(targets.includes('home-gutcare'));
  for (const target of targets) {
    // まとまりの id はテンプレートで組み立てているので、組み立ての形で見る
    if (/^home-(probiotic|gutcare)$/.test(target)) {
      assert.match(screen, new RegExp(`id="${target}"`), target);
    } else {
      assert.match(screen, /id=\{`home-\$\{topic\.id\}`\}/, target);
    }
  }
});
