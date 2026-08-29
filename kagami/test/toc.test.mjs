import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOC_ENTRIES, TOC_CATEGORY_MAP, tocSections, filterToc, duplicateTitles } from '../src/data/toc.js';
import { readingInfo, OTHER_GROUP, GROUP_ORDER } from '../src/lib/yomi.js';
import { TACTICS, CATEGORIES } from '../src/data/tactics.js';
import { REPLIES } from '../src/data/replies.js';
import { SOURCES } from '../src/data/sources.js';

test('目次のタイトルは重複しない', () => {
  assert.deepEqual(duplicateTitles(), [], '同じタイトルの項目があります');
});

test('目次のIDは重複しない', () => {
  const ids = TOC_ENTRIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('タイトルは空でなく、前後に空白を含まない', () => {
  for (const e of TOC_ENTRIES) {
    assert.ok(e.title && e.title.length > 0, `${e.id}: タイトルが空`);
    assert.equal(e.title, e.title.trim(), `${e.id}: 前後に空白`);
  }
});

test('すべての項目が あ〜ん / A〜Z に振り分けられる（＝読みの入れ忘れが無い）', () => {
  for (const e of TOC_ENTRIES) {
    const info = readingInfo(e.title, e.reading);
    assert.notEqual(info.group, OTHER_GROUP, `${e.title}: 読み（reading）が未設定です`);
  }
});

test('reading はひらがなだけ（カタカナ・漢字・英数字を混ぜない）', () => {
  for (const e of TOC_ENTRIES) {
    if (!e.reading) continue;
    assert.match(e.reading, /^[ぁ-ゖー・]+$/u, `${e.title}: reading「${e.reading}」がひらがなではありません`);
  }
});

test('カテゴリは定義済みで、飛び先の画面と anchor を持つ', () => {
  const views = new Set(['tactics', 'replies', 'sources']);
  for (const e of TOC_ENTRIES) {
    const cat = TOC_CATEGORY_MAP[e.category];
    assert.ok(cat, `${e.title}: 未知のカテゴリ ${e.category}`);
    assert.ok(views.has(e.view), `${e.title}: 存在しない画面 ${e.view}`);
    assert.ok(e.anchor && e.anchor.startsWith('toc-'), `${e.title}: anchor が不正`);
  }
});

test('目次はすべてのデータ（型・別名・まとまり・返し方・出典）を漏れなく載せる', () => {
  const count = (id) => TOC_ENTRIES.filter((e) => e.category === id).length;
  const aliases = TACTICS.reduce((n, t) => n + (t.aka || []).length, 0);
  assert.equal(count('tactic'), TACTICS.length);
  assert.equal(count('alias'), aliases);
  assert.equal(count('group'), CATEGORIES.length);
  assert.equal(count('reply'), REPLIES.length);
  assert.equal(count('source'), SOURCES.length);
  assert.equal(
    TOC_ENTRIES.length,
    TACTICS.length + aliases + CATEGORIES.length + REPLIES.length + SOURCES.length,
  );
});

test('別名の項目は、実在する型へ飛ぶ', () => {
  const ids = new Set(TACTICS.map((t) => t.id));
  for (const e of TOC_ENTRIES.filter((x) => x.category === 'alias')) {
    assert.ok(ids.has(e.targetId), `${e.title}: 飛び先の型 ${e.targetId} がありません`);
    assert.match(e.sub, /^→ /, `${e.title}: 「→ 型名」の形になっていません`);
  }
});

test('世に出回っている呼び名を目次から引ける', () => {
  const titles = new Set(TOC_ENTRIES.map((e) => e.title));
  for (const w of ['間欠強化', '希少性の原理', 'ツァイガルニク効果', '感情ジェットコースター効果', '安全基地効果', 'サード・アイ', '沈黙の圧力', '捕食者のテンポ']) {
    assert.ok(titles.has(w), `目次から「${w}」を引けません`);
  }
});

test('セクションの並びは あ〜ん → A〜Z → その他 の順', () => {
  const groups = tocSections().map((s) => s.group);
  const want = GROUP_ORDER.filter((g) => groups.includes(g));
  assert.deepEqual(groups, want);
});

test('数字は読みで振り分ける（見た目の数字順に先頭へ固めない）', () => {
  // 読みを書いていない数字始まりの項目は、数字を読みに直してから行を決める。
  // 「188番」→ ひゃくはちじゅうはち → は行（「1」で始まるから先頭、にはしない）
  assert.equal(readingInfo('188番', '').group, 'は');
  // 「9110へ電話」→ きゅうせんひゃくじゅう… → か行
  assert.equal(readingInfo('9110へ電話', '').group, 'か');
});

test('reading を書いた項目は、数字の見た目ではなく読みの行に入る', () => {
  // 「消費者ホットライン188」は しょうひしゃ… なので さ行（数字に引きずられない）
  const hotline = TOC_ENTRIES.find((e) => e.id === 'source-shohisha_hotline');
  assert.ok(hotline, '消費者ホットラインの項目が見つかりません');
  assert.equal(readingInfo(hotline.title, hotline.reading).group, 'さ');
});

test('検索とカテゴリ絞り込みが効く', () => {
  assert.ok(filterToc(TOC_ENTRIES, { category: 'reply' }).every((e) => e.category === 'reply'));
  const hit = filterToc(TOC_ENTRIES, { query: '期限' });
  assert.ok(hit.length > 0);
  assert.equal(filterToc(TOC_ENTRIES, { query: 'そんな語はどこにもない' }).length, 0);
});
