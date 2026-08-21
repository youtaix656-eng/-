import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOC_ENTRIES, TOC_CATEGORIES, TOC_CATEGORY_MAP, tocSections, filterToc, duplicateTitles } from '../src/data/toc.js';
import { readingInfo, OTHER_GROUP } from '../src/lib/yomi.js';
import { allRedFlags, allPatterns } from '../src/data/toc.js';
import { PRECAUTIONS } from '../src/data/precautions.js';
import { LICENSES, MODALITY_META } from '../src/data/licenses.js';
import { SOURCES } from '../src/data/sources.js';
import { DISEASES } from '../src/data/diseases.js';

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
  const tabs = new Set(['disease', 'flags', 'patterns', 'care', 'scope', 'source']);
  for (const e of TOC_ENTRIES) {
    const cat = TOC_CATEGORY_MAP[e.category];
    assert.ok(cat, `${e.title}: 未知のカテゴリ ${e.category}`);
    assert.ok(tabs.has(cat.tab), `${e.title}: 資料画面に存在しないタブ ${cat.tab}`);
    assert.ok(e.anchor && e.anchor.startsWith('toc-'), `${e.title}: anchor が不正`);
  }
});

test('目次はすべてのデータ（疾患・レッドフラグ・パターン・要配慮・資格・手段・出典）を漏れなく載せる', () => {
  const count = (id) => TOC_ENTRIES.filter((e) => e.category === id).length;
  assert.equal(count('disease'), DISEASES.length);
  assert.equal(count('flag'), allRedFlags().length);
  assert.equal(count('pattern'), allPatterns().length);
  assert.equal(count('care'), PRECAUTIONS.length);
  assert.equal(count('license'), LICENSES.length);
  assert.equal(count('modality'), Object.keys(MODALITY_META).length);
  assert.equal(count('source'), SOURCES.length);
  assert.equal(
    TOC_ENTRIES.length,
    DISEASES.length + allRedFlags().length + allPatterns().length + PRECAUTIONS.length + LICENSES.length + Object.keys(MODALITY_META).length + SOURCES.length,
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
  assert.equal(filterToc(TOC_ENTRIES, '', 'flag').length, allRedFlags().length);
  assert.equal(filterToc(TOC_ENTRIES, 'ぜったいに存在しない語').length, 0);
  // 読みでも引ける（漢字が読めない時のため）
  assert.ok(filterToc(TOC_ENTRIES, 'ぼうこう').some((e) => e.title === '膀胱直腸障害'));
});

test('カテゴリの一覧は目次の全項目を覆う', () => {
  const known = new Set(TOC_CATEGORIES.map((c) => c.id));
  for (const e of TOC_ENTRIES) assert.ok(known.has(e.category));
});

test('疾患カード129件を含めても、目次のタイトルは全207件が一意', () => {
  assert.equal(TOC_ENTRIES.length, 207);
  const titles = TOC_ENTRIES.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
});

test('「梨状筋症候群」は疾患カードとして1件だけ（推定パターン側は別名）', () => {
  const hits = TOC_ENTRIES.filter((e) => e.title === '梨状筋症候群');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].category, 'disease');
});

test('疾患カードも あ〜ん / A〜Z の該当セクションに入る', () => {
  const sections = tocSections();
  const find = (t) => sections.find((s) => s.items.some((i) => i.title === t));
  assert.equal(find('腰椎椎間板ヘルニア').group, 'や');
  assert.equal(find('馬尾症候群').group, 'は');
  assert.equal(find('急性腰痛症（ぎっくり腰）').group, 'か');
  assert.equal(find('慢性腰痛症').group, 'ま');
  assert.equal(find('坐骨神経痛').group, 'さ');
});

test('疾患名でも読みでも検索できる', () => {
  assert.ok(filterToc(TOC_ENTRIES, 'ヘルニア').some((e) => e.title === '腰椎椎間板ヘルニア'));
  assert.ok(filterToc(TOC_ENTRIES, 'ばび').some((e) => e.title === '馬尾症候群'));
  assert.ok(filterToc(TOC_ENTRIES, '', 'disease').length === 129);
});

test('レッドフラッグ①〜⑤は番号順に並ぶ（読み順で①⑤③②④にならない）', () => {
  const ra = tocSections().find((s) => s.group === 'ら');
  const rf = ra.items.filter((i) => i.title.startsWith('レッドフラッグ')).map((i) => i.title);
  assert.deepEqual(rf, [
    'レッドフラッグ①：馬尾症候群を疑う所見',
    'レッドフラッグ②：悪性腫瘍を疑う所見',
    'レッドフラッグ③：感染を疑う所見',
    'レッドフラッグ④：骨折を疑う所見',
    'レッドフラッグ⑤：大動脈瘤破裂を疑う所見',
    'レッドフラッグ⑥：進行する神経症状を疑う所見',
  ]);
});
