import test from 'node:test';
import assert from 'node:assert/strict';

import { HACKS, HACK_MAP, countByCategory, popularTags, allSituations, hackOfTheDay } from '../src/data/hacks.js';
import { CATEGORY_MAP, BASIS_KINDS, EFFORT_LABELS, SYNONYMS, OVERPROMISE_WORDS } from '../src/data/schema.js';
import { auditHacks } from '../src/lib/guard.js';

test('id は重複しない', () => {
  const ids = HACKS.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('タイトルは重複しない（目次で見分けがつかなくなるため）', () => {
  const titles = HACKS.map((h) => h.title);
  const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
  assert.deepEqual(dup, []);
});

test('必要な項目がそろっている', () => {
  for (const hack of HACKS) {
    assert.ok(hack.title, `${hack.id}: title`);
    assert.ok(hack.reading, `${hack.id}: reading`);
    assert.ok(hack.summary, `${hack.id}: summary`);
    assert.ok(Array.isArray(hack.steps) && hack.steps.length > 0, `${hack.id}: steps`);
    assert.ok(hack.why, `${hack.id}: why`);
    assert.ok(CATEGORY_MAP[hack.category], `${hack.id}: category`);
    assert.ok(Array.isArray(hack.tags) && hack.tags.length > 0, `${hack.id}: tags`);
    assert.ok(Array.isArray(hack.situations) && hack.situations.length > 0, `${hack.id}: situations`);
    assert.ok(EFFORT_LABELS[hack.effort], `${hack.id}: effort は 1〜3`);
  }
});

test('読みはひらがな（漢字・カタカナを残さない。残すと目次の「その他」に落ちる）', () => {
  for (const hack of HACKS) {
    assert.match(hack.reading, /^[ぁ-んー]+$/u, `${hack.id} の読み: ${hack.reading}`);
  }
});

test('出典（basis）は種類が決まっていて、説明がある', () => {
  for (const hack of HACKS) {
    assert.ok(hack.basis, `${hack.id}: basis`);
    assert.ok(BASIS_KINDS[hack.basis.kind], `${hack.id}: basis.kind=${hack.basis && hack.basis.kind}`);
    assert.ok(hack.basis.label, `${hack.id}: basis.label`);
  }
});

test('研究があるとされるものは「※要確認」と書く（もっともらしい数字を作らないため）', () => {
  for (const hack of HACKS) {
    if (hack.basis.kind !== 'research') continue;
    assert.match(hack.basis.label, /※要確認/, `${hack.id}`);
  }
});

test('からだ・不調の項目には気をつけることが必ずある（工夫で我慢を続けさせない）', () => {
  for (const hack of HACKS) {
    if (hack.category !== 'body') continue;
    assert.ok(hack.caution, `${hack.id}: caution`);
  }
});

test('けがのおそれがある工夫（risk）は、確かめること・やってはいけないこと・気をつけることが必ずある', () => {
  const risky = HACKS.filter((h) => h.risk);
  assert.ok(risky.length > 0);
  for (const hack of risky) {
    assert.ok(Array.isArray(hack.prep) && hack.prep.length > 0, `${hack.id}: prep`);
    assert.ok(Array.isArray(hack.donts) && hack.donts.length > 0, `${hack.id}: donts`);
    assert.ok(hack.caution, `${hack.id}: caution`);
  }
});

test('やってはいけないことは「危険です」で終わらせず、何が起きるかまで書く', () => {
  for (const hack of HACKS) {
    for (const line of hack.donts || []) {
      assert.ok(line.length >= 12, `${hack.id}: 短すぎる「${line}」`);
      assert.doesNotMatch(line, /^危険/u, `${hack.id}: ${line}`);
    }
  }
});

test('力・熱を使う工夫には、やめて切り替える先がある（開くまで続ける形にしない）', () => {
  for (const hack of HACKS) {
    if (!hack.risk) continue;
    const text = [...(hack.steps || []), ...(hack.donts || []), hack.caution].filter(Boolean).join('\n');
    assert.match(text, /やめ|切り替え|休/u, `${hack.id}: 途中でやめる案内が無い`);
  }
});

test('関連（related）は実在する id を指す', () => {
  for (const hack of HACKS) {
    for (const id of hack.related || []) {
      assert.ok(HACK_MAP[id], `${hack.id} → ${id} が無い`);
      assert.notEqual(id, hack.id, `${hack.id} が自分自身を指している`);
    }
  }
});

test('言い切り（必ず・絶対・誰でも…）を本文に書かない', () => {
  const rows = auditHacks(HACKS);
  assert.deepEqual(
    rows.map((r) => `${r.hack.id}: ${r.findings.map((f) => f.word).join(',')}`),
    [],
  );
  assert.ok(OVERPROMISE_WORDS.length > 0);
});

test('効果の割合・人数のような手元に無い数字を書かない', () => {
  for (const hack of HACKS) {
    const text = [hack.summary, hack.why, ...(hack.steps || [])].join('\n');
    assert.doesNotMatch(text, /\d+\s*[%％]/u, `${hack.id}`);
    assert.doesNotMatch(text, /\d+\s*人中/u, `${hack.id}`);
  }
});

test('すべてのカテゴリに項目がある（手薄なカテゴリを作らない）', () => {
  const counts = countByCategory();
  for (const [id, count] of Object.entries(counts)) {
    assert.ok(count > 0, `カテゴリ ${id} が0件`);
  }
});

test('言い換え辞書に同じ語を二度書かない', () => {
  const seen = new Map();
  for (const [canonical, others] of SYNONYMS) {
    assert.ok(!seen.has(canonical), `${canonical} が2回出ている`);
    seen.set(canonical, true);
    assert.equal(new Set(others).size, others.length, `${canonical} の言い換えに重複`);
    assert.ok(!others.includes(canonical), `${canonical} が自分自身を含んでいる`);
  }
});

test('タグ・困りごと・今日の1つが取り出せる', () => {
  assert.ok(popularTags().length > 0);
  assert.ok(allSituations().length > 0);
  // 日付は端末の時刻で見る（'2026-08-29' のような文字列で作ると UTC として読まれて前日になる）
  const day = hackOfTheDay(HACKS, new Date(2026, 7, 29, 0, 5));
  assert.ok(day && day.id);
  // 同じ日なら同じものが出る（毎回変わると見比べられない）
  assert.equal(hackOfTheDay(HACKS, new Date(2026, 7, 29, 23, 30)).id, day.id);
  assert.notEqual(hackOfTheDay(HACKS, new Date(2026, 7, 30, 9, 0)).id, day.id);
});

test('「今日の1つ」に、試す工夫ではない項目（受診をすすめる項目）を出さない', () => {
  const picks = new Set();
  for (let d = 1; d <= 28; d += 1) picks.add(hackOfTheDay(HACKS, new Date(2026, 7, d)).id);
  for (const id of picks) assert.notEqual(HACK_MAP[id].dailyPick, false);
});
