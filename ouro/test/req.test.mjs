// 要件のたな卸し・受け入れ確認（人がやるテスト）・読ませた量、と新しい3役職。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { REQ_FIELDS, THIN_AT, reqReview, reqLine, hitLabel } from '../src/lib/req.js';
import { ACCEPT_VALUES, acceptReview, setAccept, acceptLine, disagreeLine } from '../src/lib/accept.js';
import { LAYER_NAMES, HEAVY_CHARS, weightOf, weightLine } from '../src/lib/weight.js';
import { CHECK_ROLE_IDS, parseChecklist } from '../src/lib/checks.js';
import { ROLES, roleById } from '../src/data/roles.js';
import { EXTRA_NAMES } from '../src/data/employees.js';
import { buildContext, CONTEXT_LIMITS } from '../src/lib/memory.js';
import { notesOf, addNote } from '../src/lib/notes.js';

// ── 新しい3役職 ──
test('要件定義・テスト・保守の役職がある', () => {
  for (const id of ['director', 'tester', 'maintainer']) {
    const r = roleById(id);
    assert.ok(r, id);
    assert.ok(/^[ぁ-んー]+$/.test(r.reading), `${id} の読みがひらがなでない`);
    assert.ok(r.systemHint && r.systemHint.length > 20, `${id} の指示が薄い`);
    assert.ok(r.triggers.length >= 4, `${id} の当たる語が少ない`);
  }
});

test('新しい役職は最初から雇う6役職に入れない（初期構成を変えない）', () => {
  assert.equal(ROLES.filter((r) => r.core).length, 6);
  for (const id of ['director', 'tester', 'maintainer']) assert.equal(roleById(id).core, false);
});

test('役職を足したぶん、共用の名前も足りている', () => {
  const names = EXTRA_NAMES.map((n) => n.name);
  assert.ok(names.length >= ROLES.length * 3, `${names.length} < ${ROLES.length * 3}`);
  assert.equal(new Set(names).size, names.length, '名前が重複している');
  assert.equal(new Set(EXTRA_NAMES.map((n) => n.reading)).size, names.length, '読みが重複している');
});

test('完成の確認はテスター優先・レビュアーへ必ず落ちる', () => {
  assert.deepEqual(CHECK_ROLE_IDS, ['tester', 'reviewer']);
  for (const id of CHECK_ROLE_IDS) assert.ok(roleById(id), id);
  // 最後は必ず最初から居る役職（雇っていなくても確認が消えないように）
  assert.equal(roleById(CHECK_ROLE_IDS[CHECK_ROLE_IDS.length - 1]).core, true);
  // 役職 id を workflow.js に直接書かない
  const src = readFileSync(new URL('../src/lib/workflow.js', import.meta.url), 'utf8');
  assert.ok(!/roleId: 'reviewer'/.test(src));
});

// ── 要件のたな卸し ──
test('何も書かなければ全部足りない', () => {
  const r = reqReview({ request: '記事を書いて' });
  assert.equal(r.count, 0);
  assert.equal(r.level, 'thin');
  assert.equal(r.missing.length, REQ_FIELDS.length);
});

test('受付の欄が埋まっていれば数える', () => {
  const r = reqReview({
    request: '記事を書いて',
    spec: { deliverable: '2000字', doneWhen: '出典3つ', materials: '手元の表', constraints: '他社名なし' },
  });
  assert.equal(r.count, 4);
  assert.equal(r.level, 'ok');
});

test('依頼文の中の語も見る（当たった語を必ず見せる）', () => {
  const r = reqReview({ request: '40代向けに書きたい。問い合わせを減らしたいので。' });
  assert.ok(r.filled.some((f) => f.id === 'who'));
  assert.ok(r.filled.some((f) => f.id === 'why'));
  assert.match(hitLabel(r, 'who'), /40代/);
});

test('当たらなかった項目に、当てずっぽうの理由を書かない', () => {
  const r = reqReview({ request: '記事を書いて' });
  assert.equal(hitLabel(r, 'who'), '');
});

test('薄い時も「やめろ」とは言わない', () => {
  const line = reqLine(reqReview({ request: '書いて' }));
  assert.ok(!/やめ|中止|できません|禁止/.test(line));
  assert.match(line, /進めても動きます/);
});

test('ほぼ埋まっていれば、そのまま進めてよいと言う', () => {
  const r = reqReview({
    request: '40代向けに、問い合わせを減らしたい',
    spec: { deliverable: 'a', doneWhen: 'b', materials: 'c', constraints: 'd' },
  });
  assert.equal(r.level, 'good');
  assert.match(reqLine(r), /大丈夫/);
});

test('薄いの境目は定数で持つ', () => {
  assert.ok(THIN_AT >= 1 && THIN_AT < REQ_FIELDS.length);
});

test('要件の判定にAIを呼ばない', () => {
  const src = readFileSync(new URL('../src/lib/req.js', import.meta.url), 'utf8');
  assert.ok(!/runStep|provider|fetch\(/.test(src));
  assert.ok(!src.includes('(?<'), '後読みを使わない（古いSafariで落ちる）');
});

// ── 受け入れ確認（人がやるテスト）──
const withCheck = (output) => ({
  spec: { doneWhen: '出典が3つ以上ある。受診の目安が入っている' },
  steps: [{ kind: 'check', status: 'done', output }],
});

test('完成条件が無ければ出さない', () => {
  assert.equal(acceptReview({ spec: {} }).state, 'none');
  assert.equal(acceptLine(acceptReview({ spec: {} })), '');
});

test('AIの答えで人の欄を埋めない', () => {
  const t = withCheck('- [YES] 出典が3つ以上ある\n- [YES] 受診の目安が入っている');
  const r = acceptReview(t);
  assert.deepEqual(r.items.map((x) => x.ai), [true, true]);
  assert.deepEqual(r.items.map((x) => x.human), [null, null]);
  assert.equal(r.state, 'todo');
  assert.equal(r.done, 0);
});

test('人が付けると進み、全部付けると結論が出る', () => {
  const t = withCheck('- [YES] 出典が3つ以上ある\n- [YES] 受診の目安が入っている');
  t.accept = setAccept(t, 0, 'ok');
  assert.equal(acceptReview(t).state, 'doing');
  t.accept = setAccept(t, 1, 'ok');
  assert.equal(acceptReview(t).state, 'passed');
});

test('人が×を付けたら failed になり、件数が出る', () => {
  const t = withCheck('- [YES] 出典が3つ以上ある\n- [YES] 受診の目安が入っている');
  t.accept = { ...setAccept(t, 0, 'ok'), ...setAccept(t, 1, 'ng', '抜けている') };
  const r = acceptReview(t);
  assert.equal(r.state, 'failed');
  assert.equal(r.ng, 1);
  assert.equal(r.items[1].note, '抜けている');
});

test('AIと人の食い違いを隠さない', () => {
  const t = withCheck('- [YES] 出典が3つ以上ある\n- [NO] 受診の目安が入っている');
  t.accept = { ...setAccept(t, 0, 'ng'), ...setAccept(t, 1, 'ok') };
  const r = acceptReview(t);
  assert.equal(r.disagree.length, 2);
  assert.match(disagreeLine(r), /食い違/);
});

test('食い違いが無ければ黙る', () => {
  const t = withCheck('- [YES] 出典が3つ以上ある\n- [YES] 受診の目安が入っている');
  t.accept = { ...setAccept(t, 0, 'ok'), ...setAccept(t, 1, 'ok') };
  assert.equal(disagreeLine(acceptReview(t)), '');
});

test('AIの答えが読み取れなくても、人は付けられる', () => {
  const t = withCheck('よくできていると思います');
  const r0 = acceptReview(t);
  assert.deepEqual(r0.items.map((x) => x.ai), [null, null]);
  t.accept = setAccept(t, 0, 'ok');
  assert.equal(acceptReview(t).done, 1);
  assert.equal(acceptReview(t).disagree.length, 0, '読み取れないものを食い違いにしない');
});

test('同じ答えをもう一度押すと外れる', () => {
  const t = withCheck('- [YES] a');
  t.accept = setAccept(t, 0, 'ok');
  assert.equal(Object.keys(setAccept(t, 0, 'ok')).length, 0);
});

test('答えは2つだけ（曖昧な3つ目を置かない）', () => {
  assert.deepEqual(Object.keys(ACCEPT_VALUES), ['ok', 'ng']);
});

test('メモは長すぎたら切る', () => {
  const t = withCheck('- [YES] a');
  const a = setAccept(t, 0, 'ng', 'あ'.repeat(500));
  assert.equal(a['0'].note.length, 200);
});

test('受け入れ確認にAIを呼ばない', () => {
  const src = readFileSync(new URL('../src/lib/accept.js', import.meta.url), 'utf8');
  assert.ok(!/runStep|provider|fetch\(/.test(src));
});

test('条件は完成条件から毎回導く（別の表を持たない）', () => {
  const t = withCheck('- [YES] a');
  assert.equal(acceptReview(t).total, parseChecklist(t.spec.doneWhen).length);
});

// ── 読ませた量 ──
test('層ごとの文字数を残す', () => {
  const c = buildContext({
    employee: { roleId: 'creator' },
    task: { request: 'x' },
    briefText: 'あ'.repeat(40),
    styleText: 'い'.repeat(60),
  });
  assert.equal(c.chars, c.text.length);
  assert.deepEqual(c.layers.map((l) => l.chars), [40, 60]);
  assert.ok(CONTEXT_LIMITS.style > 0);
});

test('実行していない手順を0字と書かない', () => {
  const w = weightOf({ steps: [{ id: 'a', status: 'done', employeeName: '古い仕事' }] });
  assert.equal(w.steps[0].chars, null);
  assert.equal(w.max, 0);
  assert.match(weightLine(w), /記録されていません/);
});

test('多い層から並べ、いちばん多い手順で判定する', () => {
  const w = weightOf({
    steps: [
      { id: 'a', status: 'done', contextChars: HEAVY_CHARS + 1, layers: [{ layer: 'knowledge', chars: 9000 }, { layer: 'style', chars: 100 }] },
      { id: 'b', status: 'done', contextChars: 500, layers: [{ layer: 'handoff', chars: 400 }] },
    ],
  });
  assert.equal(w.heavy, true);
  assert.equal(w.byLayer[0].layer, 'knowledge');
  assert.equal(w.byLayer[0].name, LAYER_NAMES.knowledge);
  assert.equal(w.max, HEAVY_CHARS + 1);
});

test('勝手に削らない・削れとも言わない', () => {
  const src = readFileSync(new URL('../src/lib/weight.js', import.meta.url), 'utf8');
  assert.ok(!/slice\(0,\s*(?:HEAVY|LIMIT)/.test(src));
  const w = weightOf({ steps: [{ id: 'a', status: 'done', contextChars: 99999, layers: [] }] });
  assert.ok(!/削っ(?:た|ておき)|短くしました/.test(weightLine(w)));
});

test('層の呼び名は memory.js の層と対応している', () => {
  const src = readFileSync(new URL('../src/lib/memory.js', import.meta.url), 'utf8');
  for (const key of Object.keys(LAYER_NAMES)) {
    assert.ok(src.includes(`layer: '${key}'`), `${key} が memory.js に無い`);
  }
});

// ── 記憶の切り出し（起動を軽くするため）──
test('社員の記憶は memory.js からも読める（読み込み方を変えない）', () => {
  const emp = { memory: { notes: [] } };
  const notes = addNote(emp, 'つぎからは短く書く');
  assert.equal(notes.length, 1);
  assert.equal(notesOf({ memory: { notes } })[0].text, 'つぎからは短く書く');
});

test('古い形（ただの文字列）でも毎回同じ id を返す', () => {
  const emp = { memory: { notes: ['むかしの記憶'] } };
  assert.equal(notesOf(emp)[0].id, notesOf(emp)[0].id);
});
