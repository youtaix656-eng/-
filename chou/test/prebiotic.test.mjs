import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PREBIOTIC_KINDS,
  KIND_BY_ID,
  PREBIOTIC_FOODS,
  OMEGA3,
  APPLE_VINEGAR,
  SOURCE_CONFLICTS,
  PREBIOTIC_CORRECTIONS,
  PREBIOTIC_UNVERIFIED,
  PREBIOTIC_PRECHECKS,
  PREBIOTIC_PRECHECK_WARNING,
  PREBIOTIC_PARTIAL_OK,
  PREBIOTIC_SOURCE,
} from '../src/data/prebiotics.js';
import { prebioticViews, prebioticConflicts, PREBIOTIC_VS_FODMAP_NOTE } from '../src/lib/conflicts.js';
import { FODMAP_FOODS } from '../src/data/fodmap.js';
import { BACTERIA, PRODUCTS } from '../src/data/probiotics.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

test('食べものは種類と読みを持ち、突き合わせ先は手で書く（名前の当てずっぽうな一致で作らない）', () => {
  assert.ok(PREBIOTIC_FOODS.length >= 10);
  const fodmapNames = new Set(FODMAP_FOODS.map((f) => f.name));
  for (const food of PREBIOTIC_FOODS) {
    assert.match(food.reading, /^[ぁ-んー]+$/, food.name);
    assert.ok(KIND_BY_ID[food.kind], `${food.name}: 種類が3つのどれでもない`);
    assert.ok(food.note, food.name);
    // fodmapName は「無い（null）」か「低FODMAP の一覧に実在する見出し」のどちらかだけ
    if (food.fodmapName !== null) {
      assert.ok(fodmapNames.has(food.fodmapName), `${food.name}: ${food.fodmapName} が一覧に無い`);
    }
  }
  // 種類は出典の3つ
  assert.deepEqual(PREBIOTIC_KINDS.map((k) => k.id), ['soluble', 'oligo', 'rs']);
});

test('低FODMAP とぶつかる所は、データから導いて両方見せる（どちらが正しいかを決めない）', () => {
  const views = prebioticViews();
  assert.equal(views.length, PREBIOTIC_FOODS.length);
  for (const v of views) {
    // 必ず2つの言い分が並ぶ（片方だけにしない）
    assert.equal(v.views.length, 2);
    assert.match(v.views[0], /腸活/);
    assert.match(v.views[1], /低FODMAP/);
  }
  const clashes = prebioticConflicts();
  assert.ok(clashes.length > 0, 'ぶつかる食べものが1件も出ていない');
  for (const c of clashes) {
    assert.ok(c.fodmapName, c.name);
    assert.notEqual(c.fodmap, '少なめ');
  }
  // 目的が反対を向いていることを言葉でも書く。**どちらかを勧めない**
  assert.match(PREBIOTIC_VS_FODMAP_NOTE, /反対/);
  assert.doesNotMatch(PREBIOTIC_VS_FODMAP_NOTE, /どちらかといえば|おすすめ|正しいのは/);
  // 判定は元データから毎回導く（手書きの一覧を持たない）
  const code = codeOf('lib/conflicts.js');
  assert.doesNotMatch(code, /const PREBIOTIC_CLASH_NAMES = \[/);
});

test('出典どうしの食い違いは、両方を並べるだけ（結論を書かない）', () => {
  assert.ok(SOURCE_CONFLICTS.length >= 3);
  for (const item of SOURCE_CONFLICTS) {
    assert.ok(item.a && item.b, item.id);
    assert.notEqual(item.a, item.b);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
    // どちらが正しいかを書かない
    for (const text of [item.a, item.b]) {
      assert.doesNotMatch(text, /こちらが正しい|正解は|間違いです/, item.id);
    }
  }
  // リンゴ酢は「勧める側」と「根拠に乏しいと言う側」の両方が載っている
  const vinegar = SOURCE_CONFLICTS.find((c) => c.id === 'vinegar');
  assert.match(vinegar.b, /根拠に乏しい/);
  assert.match(APPLE_VINEGAR.body, /根拠に乏しい/);
});

test('訂正は、原文（出典の言い分）を消さずに残したまま併記する', () => {
  assert.ok(PREBIOTIC_CORRECTIONS.length >= 4);
  for (const item of PREBIOTIC_CORRECTIONS) {
    assert.ok(item.claim, item.id);
    assert.ok(item.correction, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  const byId = Object.fromEntries(PREBIOTIC_CORRECTIONS.map((c) => [c.id, c]));
  // 細胞数10倍説
  assert.match(byId.cell_count.correction, /同じくらい/);
  // 食べもので「がんを防げる」とは書かない
  assert.match(byId.fucoidan.correction, /予防できると確かめられたものではありません/);
  // 抗生物質との飲み合わせは自分で決めない
  assert.match(byId.antibiotics.correction, /医師|薬剤師/);
  assert.match(byId.antibiotics.correction, /飲み合わせを調べません/);
  // 有名人の名前が付いていても根拠にしない
  assert.match(byId.hippocrates.correction, /裏づけは見つかっていません/);
});

test('裏が取れていない主張は、隠さず出したうえで必ず注意を添える', () => {
  assert.ok(PREBIOTIC_UNVERIFIED.length >= 6);
  for (const item of PREBIOTIC_UNVERIFIED) {
    assert.ok(item.claim, item.id);
    assert.ok(item.note && item.note.length > 10, `${item.id}: 注意が短すぎる`);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  const byId = Object.fromEntries(PREBIOTIC_UNVERIFIED.map((c) => [c.id, c]));
  // 受診を遅らせないための行き先を必ず書く
  assert.match(byId.bodyodor.note, /歯科|耳鼻科|医療機関/);
  assert.match(byId.stamina.note, /医療機関/);
  assert.match(byId.memory.note, /医療機関/);
  assert.match(byId.wheat.note, /医師|管理栄養士/);
  // 腸で作られたセロトニンが脳へ入る、という一続きの説明は採らない
  assert.match(byId.neurotransmitter.note, /脳へ入れません/);
  // リーキーガットは確立した病名ではないと書く
  assert.match(byId.wheat.note, /確立した病名ではありません/);
});

test('数字は並べるだけで、判定にも計算にも使わない', () => {
  const lib = codeOf('lib/conflicts.js');
  for (const n of ['1.6', '38.7', '100兆', '1000兆']) {
    assert.ok(!lib.includes(n), `lib/conflicts.js に ${n} が入っている`);
  }
  // 出典の数字は「主張」として持つ側にだけある
  const claims = PREBIOTIC_UNVERIFIED.map((c) => c.claim).join('\n');
  assert.match(claims, /1\.6/);
  assert.match(claims, /38\.7/);
});

test('はじめる前の注意は、止めずに出し続ける（張り・ガスで反対に働くことがある）', () => {
  assert.ok(PREBIOTIC_PRECHECKS.length >= 5);
  const ids = PREBIOTIC_PRECHECKS.map((p) => p.id);
  for (const id of ['bloat', 'ibs', 'fodmap', 'blood', 'teeth']) assert.ok(ids.includes(id), id);
  assert.match(PREBIOTIC_PRECHECK_WARNING, /少しずつ/);
  assert.match(PREBIOTIC_PRECHECK_WARNING, /反対/);
  // 量を数えない（たくさん取るほどよい、にしない）
  assert.match(PREBIOTIC_PARTIAL_OK, /数えません/);
  // オメガ3は薬・手術の注意を必ず添える
  assert.match(OMEGA3.caution, /医師|薬剤師/);
  assert.match(OMEGA3.caution, /手術/);
  // リンゴ酢は歯と逆流の注意を必ず添える
  assert.match(APPLE_VINEGAR.caution, /歯/);
  assert.match(APPLE_VINEGAR.caution, /逆流/);
});

test('出典に URL を書かない・確かめきれていないことを書く', () => {
  const text = src('data/prebiotics.js');
  assert.doesNotMatch(text, /https?:\/\//);
  assert.equal(PREBIOTIC_SOURCE.check, true);
  assert.match(PREBIOTIC_SOURCE.text, /未確認/);
});

test('新しく足した菌・整腸剤は、名前と読みがそろっている（登録漏れを作らない）', () => {
  const kinds = new Set(BACTERIA.map((b) => b.id));
  for (const p of PRODUCTS) {
    for (const id of p.bacteria) assert.ok(kinds.has(id), `${p.name}: ${id} が菌の一覧に無い`);
  }
  for (const b of BACTERIA) assert.match(b.reading, /^[ぁ-んー]+$/, b.id);
  for (const p of PRODUCTS) assert.match(p.reading, /^[ぁ-んー0-9]+$/, p.id);
});

test('目次からも辿れる（食べもの・食い違い・訂正・裏が取れていない主張）', () => {
  const entries = buildTocEntries();
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  // 食べものは低FODMAP の見出しとぶつからない題にする（別名で素の名前も引ける）
  for (const food of PREBIOTIC_FOODS) {
    const entry = byTitle.get(`${food.name}（善玉菌の餌）`);
    assert.ok(entry, food.name);
    assert.ok(entry.aliases.some((a) => a.name === food.name), `${food.name}: 別名が無い`);
    assert.ok(entry.destinations.length > 0, food.name);
  }
  for (const item of SOURCE_CONFLICTS) assert.ok(byTitle.has(item.title), item.title);
  for (const item of PREBIOTIC_CORRECTIONS) assert.ok(byTitle.has(item.title), item.title);
  for (const item of PREBIOTIC_UNVERIFIED) assert.ok(byTitle.has(item.title), item.title);
  assert.ok(byTitle.has(OMEGA3.title));
  assert.ok(byTitle.has(APPLE_VINEGAR.title));
  // 飛び先は画面にある id を指す。
  // **テンプレートで組み立てている id は素の文字列では見つからない**ので、
  // 組み立ての形（`kind-${...}` など）まで見る（実際にここで一度落とした）。
  const screen = src('components/Prebiotics.jsx');
  const templates = [
    ['kind-', /id=\{`kind-\$\{/],
    ['prebiotic-', /id=\{`prebiotic-\$\{/],
    ['sconflict-', /id=\{`sconflict-\$\{/],
    ['pcorrection-', /id=\{`pcorrection-\$\{/],
    ['punv2-', /id=\{`punv2-\$\{/],
  ];
  const targets = entries
    .filter((e) => e.group === 'prebiotic')
    .flatMap((e) => e.destinations)
    .filter((d) => d.view === 'prebiotics')
    .map((d) => d.targetId);
  assert.ok(targets.length > 0);
  for (const target of new Set(targets)) {
    if (screen.includes(`id="${target}"`)) continue;
    const tpl = templates.find(([prefix]) => target.startsWith(prefix));
    assert.ok(tpl, `${target}: 画面に無い`);
    assert.match(screen, tpl[1], target);
  }
});
