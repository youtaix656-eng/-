import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOC_ENTRIES, TOC_CATEGORIES, TOC_CATEGORY_MAP, tocSections, filterToc, duplicateTitles } from '../src/data/toc.js';
import { readingInfo, OTHER_GROUP } from '../src/lib/yomi.js';
import { LOW_BACK_RED_FLAGS } from '../src/data/redFlags.js';
import { LOW_BACK_PATTERNS } from '../src/data/patterns.js';
import { PRECAUTIONS } from '../src/data/precautions.js';
import { LICENSES, MODALITY_META } from '../src/data/licenses.js';
import { SOURCES } from '../src/data/sources.js';

test('目次のタイトルは重複しない', () => {
  assert.deepEqual(duplicateTitles(), [], '同じタイトルの項目があります');
});

test('目次のIDは重複しない', () => {
  const ids = TOC_ENTRIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('目次のタイトルは空でなく、前後に空白を含まない', () => {
  for (const e of TOC_ENTRIES) {
    assert.ok(e.title && e.title.length > 0, `${e.id}: タイトルが空`);
    assert.equal(e.title, e.title.trim(), `${e.id}: 前後に空白`);
  }
});

test('すべての項目が「その他」に落ちず、あ〜ん か A〜Z に振り分けられる（＝読みが用意されている）', () => {
  for (const e of TOC_ENTRIES) {
    const info = readingInfo(e.title, e.reading);
    assert.notEqual(info.group, OTHER_GROUP, `${e.title}: 読み（reading）が未設定です`);
  }
});

test('reading を書く時はひらがな（カタカナ・漢字・英数字を混ぜない）', () => {
  for (const e of TOC_ENTRIES) {
    if (!e.reading) continue;
    assert.match(e.reading, /^[ぁ-ゖー・]+$/u, `${e.title}: reading「${e.reading}」がひらがなではありません`);
  }
});

test('カテゴリはすべて定義済みで、飛び先のタブを持つ', () => {
  const tabs = new Set(['flags', 'patterns', 'care', 'scope', 'source']);
  for (const e of TOC_ENTRIES) {
    const cat = TOC_CATEGORY_MAP[e.category];
    assert.ok(cat, `${e.title}: 未知のカテゴリ ${e.category}`);
    assert.ok(tabs.has(cat.tab), `${e.title}: 資料画面に存在しないタブ ${cat.tab}`);
    assert.ok(e.anchor && e.anchor.startsWith('toc-'), `${e.title}: anchor が不正`);
  }
});

test('目次はすべてのデータ（レッドフラグ・パターン・要配慮・資格・手段・出典）を漏れなく載せる', () => {
  const count = (id) => TOC_ENTRIES.filter((e) => e.category === id).length;
  assert.equal(count('flag'), LOW_BACK_RED_FLAGS.length);
  assert.equal(count('pattern'), LOW_BACK_PATTERNS.length);
  assert.equal(count('care'), PRECAUTIONS.length);
  assert.equal(count('license'), LICENSES.length);
  assert.equal(count('modality'), Object.keys(MODALITY_META).length);
  assert.equal(count('source'), SOURCES.length);
  assert.equal(
    TOC_ENTRIES.length,
    LOW_BACK_RED_FLAGS.length + LOW_BACK_PATTERNS.length + PRECAUTIONS.length + LICENSES.length + Object.keys(MODALITY_META).length + SOURCES.length,
  );
});

test('数字を含む項目は読み方の位置に入る（20歳未満の方 → な行）', () => {
  const sections = tocSections();
  const na = sections.find((s) => s.group === 'な');
  assert.ok(na.items.some((i) => i.title === '20歳未満の方'), '「20歳未満の方」が な行にありません');
  // 数字の見た目で先頭に来ていないこと
  assert.notEqual(sections[0].items[0].title, '20歳未満の方');
});

test('英語の出典は A〜Z の枠に入る', () => {
  const latin = tocSections().find((s) => s.group === 'A〜Z');
  const titles = latin.items.map((i) => i.title);
  assert.ok(titles.some((t) => t.startsWith('NICE')));
  assert.ok(titles.some((t) => t.startsWith('WHO')));
  assert.ok(titles.some((t) => t.startsWith('Downie')));
});

test('セクション内は読み順に並ぶ', () => {
  for (const s of tocSections()) {
    const keys = s.items.map((i) => i.key);
    assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b, 'ja')), `${s.group} の並びが読み順ではありません`);
  }
});

test('filterToc: キーワード・カテゴリで絞り込める', () => {
  assert.ok(filterToc(TOC_ENTRIES, '妊娠').length >= 2);
  assert.equal(filterToc(TOC_ENTRIES, '', 'flag').length, LOW_BACK_RED_FLAGS.length);
  assert.equal(filterToc(TOC_ENTRIES, 'ぜったいに存在しない語').length, 0);
  // 読みでも引ける（漢字が読めない時のため）
  assert.ok(filterToc(TOC_ENTRIES, 'ぼうこう').some((e) => e.title === '膀胱直腸障害'));
});

test('カテゴリの一覧は目次の全項目を覆う', () => {
  const known = new Set(TOC_CATEGORIES.map((c) => c.id));
  for (const e of TOC_ENTRIES) assert.ok(known.has(e.category));
});
