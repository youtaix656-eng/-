import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  DIGEST_SUBJECTS,
  POOL_LABELS,
  allCorrections,
  allUnverified,
  allWithdrawnAndRumors,
  allSources,
  allConflictTopics,
  CONFLICT_TOPICS,
  SCOPE_NOTES,
  CROSS_TOPICS,
  crossTopics,
  crossTopicRows,
  subjectBreakdown,
  digestCounts,
  bodyOf,
  titleOf,
  DIGEST_NOTE,
  CONFLICTS_NOTE,
  CROSS_NOTE,
  SCOPE_NOTE,
  SOURCES_NOTE,
  BREAKDOWN_NOTE,
} from '../src/lib/digest.js';
import { IBS_CORRECTIONS, IBS_UNVERIFIED, IBS_OUT_OF_SCOPE } from '../src/data/ibs.js';
import { PROBIOTIC_CORRECTIONS, SUPPLEMENT_SCOPE_NOTE } from '../src/data/probiotics.js';
import { MAGNESIUM_SCOPE_NOTE } from '../src/data/magnesium.js';
import { WITHDRAWN, BUTYRATE_RUMORS } from '../src/data/butyrate.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

/**
 * 見張りは**アプリ自身が言っていること**だけを見る。
 * 決めていることを書いたコメント（「順位を付けない」「危険度を出さない」）まで
 * 引っかけると、正しく書いてあるほど落ちる（README 決まり26と同じ線）。
 */
const code = (rel) =>
  src(rel)
    .split('\n')
    .filter((line) => !/^(\/\/|\/\*|\*)/.test(line.trim()))
    .join('\n');

// ───────────────────── 元データから毎回導く ─────────────────────

test('まとめは元データから毎回導く（まとめ専用の手書きの一覧を作らない）', () => {
  const s = src('lib/digest.js');
  // 訂正・主張の本文をこのファイルに書き写していないこと
  assert.doesNotMatch(s, /const CORRECTION_LIST = \[/);
  assert.doesNotMatch(s, /const UNVERIFIED_LIST = \[/);
  // 中身は必ず import してくる
  assert.match(s, /IBS_CORRECTIONS,[\s\S]*?from '\.\.\/data\/ibs\.js'/);
  // 元データを増やせばまとめも増える
  const before = allCorrections().length;
  assert.equal(before, DIGEST_SUBJECTS.reduce((n, x) => n + x.pools.correction.items.length, 0));
  for (const item of IBS_CORRECTIONS) {
    assert.ok(allCorrections().some((r) => r.title === item.title), item.title);
  }
  for (const item of IBS_UNVERIFIED) {
    assert.ok(allUnverified().some((r) => r.title === item.title), item.title);
  }
  for (const item of PROBIOTIC_CORRECTIONS) {
    assert.ok(allCorrections().some((r) => r.title === item.title), item.title);
  }
});

test('層を混ぜない（訂正・取り下げ・うわさ・裏が取れていない主張）', () => {
  const corrections = allCorrections();
  const others = allWithdrawnAndRumors();
  const unverified = allUnverified();
  // 取り下げ・うわさは訂正にも主張にも入らない
  for (const item of [...WITHDRAWN, ...BUTYRATE_RUMORS]) {
    assert.ok(others.some((r) => r.title === item.title), item.title);
    assert.ok(!corrections.some((r) => r.title === item.title), `訂正に混ざっている: ${item.title}`);
    assert.ok(!unverified.some((r) => r.title === item.title), `主張に混ざっている: ${item.title}`);
  }
  // 行の呼び名は層ごとに別
  assert.notEqual(POOL_LABELS.correction, POOL_LABELS.withdrawn);
  assert.notEqual(POOL_LABELS.withdrawn, POOL_LABELS.rumor);
});

test('本文はその項目の言い方のまま取り出す（言い換えない）', () => {
  const one = IBS_CORRECTIONS[0];
  assert.equal(bodyOf(one), one.correction.replace(/\*\*/g, ''));
  const claim = IBS_UNVERIFIED[0];
  assert.equal(bodyOf(claim), claim.note.replace(/\*\*/g, ''));
  // 市販薬の種類だけ name を使っている
  assert.equal(titleOf({ name: '下痢止め' }), '下痢止め');
  assert.equal(titleOf({ title: 'あ', name: 'い' }), 'あ');
  // 指定した欄だけを出せる（言い足さない）
  assert.equal(bodyOf({ said: 'A', instead: 'B' }, 'instead'), 'B');
});

test('画面に出す文にマークダウンを書かない（決まり49・75と同じ線）', () => {
  const texts = [
    DIGEST_NOTE, CONFLICTS_NOTE, CROSS_NOTE, SCOPE_NOTE, SOURCES_NOTE, BREAKDOWN_NOTE,
    ...allCorrections().flatMap((r) => [r.title, r.claim, r.body]),
    ...allUnverified().flatMap((r) => [r.title, r.claim, r.body]),
    ...allWithdrawnAndRumors().flatMap((r) => [r.title, r.claim, r.body]),
    ...allConflictTopics().map((r) => r.note),
    ...SCOPE_NOTES.map((r) => r.body),
    ...crossTopics().flatMap((t) => [t.lead, t.note, ...t.rows.map((r) => r.body)]),
  ];
  for (const t of texts) assert.ok(!String(t).includes('**'), String(t).slice(0, 60));
});

// ───────────────────── 採点しない・順位を付けない ─────────────────────

test('数えるだけで、採点も順位付けもしない', () => {
  const s = code('lib/digest.js');
  assert.doesNotMatch(s, /sort\(/);
  assert.doesNotMatch(s, /score|ランキング|順位|点数/);
  // 素材の並びは登録順のまま（多い順に並べ替えない）
  const ids = subjectBreakdown().map((x) => x.id);
  assert.deepEqual(ids, DIGEST_SUBJECTS.map((x) => x.id));
  // 「訂正が多い＝悪い」と読ませない一文がある
  assert.match(BREAKDOWN_NOTE, /悪い/);
});

test('どの素材が正しいかを決めない（食い違いのまとめ）', () => {
  assert.match(CONFLICTS_NOTE, /決めません/);
  const s = code('lib/digest.js');
  assert.doesNotMatch(s, /正しいのは|こちらが正解/);
});

// ───────────────────── 食い違い ─────────────────────

test('食い違いは件数まで元データから数える（書き写さない）', () => {
  const topics = allConflictTopics();
  assert.equal(topics.length, CONFLICT_TOPICS.length);
  for (const t of topics) {
    assert.ok(Number.isInteger(t.count), t.id);
    assert.ok(t.count > 0, `${t.id}: 0件のまとまりを並べている`);
    assert.ok(t.view && t.targetId, t.id);
  }
  // 数字をこのファイルに書き写していない
  const s = code('lib/digest.js');
  assert.doesNotMatch(s, /count: \d+/);
});

// ───────────────────── 出典 ─────────────────────

test('出典の一覧に URL を書かない・確かめきれていないものに印を出す', () => {
  const sources = allSources();
  assert.equal(sources.length, DIGEST_SUBJECTS.length);
  for (const s of sources) {
    assert.ok(!/https?:\/\//.test(s.text), s.subject);
    assert.ok(s.checkedOn, `${s.subject}: 最終確認日が無い`);
    if (s.check) assert.ok(true);
  }
  assert.match(SOURCES_NOTE, /要確認/);
  assert.match(SOURCES_NOTE, /リンク/);
});

// ───────────────────── 扱わないこと ─────────────────────

test('扱わないことは3か所とも元データから取る', () => {
  assert.equal(SCOPE_NOTES.length, 3);
  const byId = Object.fromEntries(SCOPE_NOTES.map((s) => [s.id, s]));
  assert.ok(byId.ibs.body.includes(IBS_OUT_OF_SCOPE.body.replace(/\*\*/g, '').slice(0, 20)));
  assert.equal(byId.supplement.body, SUPPLEMENT_SCOPE_NOTE.replace(/\*\*/g, ''));
  assert.equal(byId.magnesium.body, MAGNESIUM_SCOPE_NOTE.replace(/\*\*/g, ''));
  // 「そんなものは無い」とは書かない
  assert.match(SCOPE_NOTE, /無いという意味|ではなく/);
});

// ───────────────────── 横断のまとまり ─────────────────────

test('横断のまとまりは、集める項目を手で書く（語の一致で拾わない）', () => {
  const s = code('lib/digest.js');
  // 語で拾う作りになっていないこと
  assert.doesNotMatch(s, /includes\('ストレス'\)/);
  assert.doesNotMatch(s, /\.filter\(\(x\) => x\.body\.includes/);
  for (const topic of CROSS_TOPICS) {
    assert.ok(Array.isArray(topic.refs) && topic.refs.length > 0, topic.id);
    for (const ref of topic.refs) assert.ok(ref.subject && ref.kind && ref.id, topic.id);
  }
});

test('空箱を作らない・見つからない参照は黙って落とす', () => {
  for (const topic of crossTopics()) assert.ok(topic.rows.length > 0, topic.id);
  // 参照が全部そろっている（いま落ちているものが無い）
  for (const topic of CROSS_TOPICS) {
    assert.equal(crossTopicRows(topic).length, topic.refs.length, topic.id);
  }
  // 存在しない参照は落ちるだけで、落ちない
  assert.equal(crossTopicRows({ id: 'x', refs: [{ subject: 'nope', kind: 'correction', id: 'z' }] }).length, 0);
});

test('横断のまとまりは、判定にも基準にもしない', () => {
  const byId = Object.fromEntries(CROSS_TOPICS.map((t) => [t.id, t]));
  // 体重は記録しないと書いてある
  assert.match(byId.weight.note, /記録しません/);
  // 水分は「1日◯リットル」という手元に無い基準を持たない
  assert.doesNotMatch(byId.water.note, /\d+\s*(リットル|ミリリットル|ml|L)/);
  assert.match(byId.water.note, /持ちません|医師/);
  // 検査は勧めない
  assert.match(byId.testing.note, /勧めません/);
  // ストレスを原因と決めない・気持ちの問題にしない
  assert.match(byId.stress.note, /決める|しません/);
  assert.match(byId.stress.note, /医療機関/);
});

// ───────────────────── 目次 ─────────────────────

test('まとめは目次からも辿れる（重複したタイトルを作らない）', () => {
  const entries = buildTocEntries();
  const digest = entries.filter((e) => e.group === 'digest');
  assert.equal(digest.length, 8 + crossTopics().length + CONFLICT_TOPICS.length + (SCOPE_NOTES.length - 1));
  for (const e of digest) {
    assert.ok(e.reading, e.title);
    assert.ok(!/[一-龠]/.test(e.reading), `${e.title}: 読みに漢字が残っている`);
    assert.ok(e.destinations.length > 0, e.title);
  }
  const titles = entries.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
});

// ───────────────────── 受診の目安への導線（決まり19） ─────────────────────

test('どの画面からも受診の目安へ行ける', () => {
  const dir = new URL('../src/components/', import.meta.url);
  const skip = new Set([
    'RedFlags.jsx', // 自分自身へは飛ばさない
    'RedFlagLink.jsx',
    'Know.jsx', // 一覧の先頭が受診の目安そのもの
    'Gut.jsx', 'Bristol.jsx', 'DayEditor.jsx', 'TermPanel.jsx', 'TocCandidates.jsx', // 画面の中の部品
    // 画面ではない共通部品（`view` を持たないので、ここに導線を置く相手がいない）
    'Finder.jsx', 'ScrollArrows.jsx',
    // 落ちた時の受け皿。**押せるボタンを増やさない**——ここで別画面へ飛ばすと、
    // 落ちた原因の画面に戻れなくなる。戻るボタンだけを出す
    'ErrorBoundary.jsx',
    'useFocusJump.js',
  ]);
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsx') && !skip.has(f));
  assert.ok(files.length >= 20, `画面が少なすぎる: ${files.length}`);
  for (const f of files) {
    const s = readFileSync(new URL(f, dir), 'utf8');
    assert.match(s, /<RedFlagLink onGo=\{onGo\} \/>/, `${f}: 受診の目安への導線が無い`);
  }
  // Know は一覧の先頭で受診の目安へ行ける
  assert.match(src('components/Know.jsx'), /onGo\('redflags'\)/);
});

test('受診の目安の導線は、色でも件数でも判定しない', () => {
  const s = code('components/RedFlagLink.jsx');
  assert.doesNotMatch(s, /danger|color:|危険度/);
  assert.doesNotMatch(s, /\.length/);
});

// ───────────────────── 数 ─────────────────────

test('まとめの数は、いま入っている元データと一致する', () => {
  const counts = digestCounts();
  assert.equal(counts.subjects, DIGEST_SUBJECTS.length);
  assert.equal(counts.corrections, allCorrections().length);
  assert.equal(counts.unverified, allUnverified().length);
  assert.equal(counts.sources, allSources().length);
  assert.equal(counts.conflicts, CONFLICT_TOPICS.length);
  assert.equal(counts.scope, SCOPE_NOTES.length);
  assert.equal(counts.crossTopics, crossTopics().length);
  // 素材のデータファイルを足したら、この登録にも足す（漏れると静かにまとめから消える）
  assert.ok(counts.corrections > 60);
  assert.ok(counts.unverified > 100);
});
