import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORMAT, toExport, parseImport, mergeCases, mergeTries, toConsultText } from '../src/lib/personIO.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('持ち出すのは入力と記録だけ（判定は入れない）', () => {
  const out = toExport({
    cases: [{ id: 'c1', checkedIds: ['a:1'] }],
    tries: [{ id: 't1', tacticId: 'stare' }],
    myHabits: ['no_no'],
    personView: { scene: 'work', core: 'x', history: ['ひみつ'], hidden: ['stare'] },
  });
  assert.equal(out.format, FORMAT);
  assert.equal(out.cases.length, 1);
  // 判定（どういう人か）を持ち出さない
  assert.equal(JSON.stringify(out).includes('verdict'), false);
  assert.equal(JSON.stringify(out).includes('score'), false);
  // さがした語は持ち出さない（人に渡すものに検索履歴を混ぜない）
  assert.equal(JSON.stringify(out).includes('ひみつ'), false);
});

test('読めない形は、黙って捨てずに理由を返す', () => {
  const bad = parseImport('これはJSONではない');
  assert.equal(bad.ok, false);
  assert.ok(bad.reason);
  assert.deepEqual(bad.cases, []);
});

test('別のアプリの書き出しは取り込まない', () => {
  const other = parseImport(JSON.stringify({ format: 'something-else', cases: [{ id: 'c1' }] }));
  assert.equal(other.ok, false);
  assert.deepEqual(other.cases, []);
});

test('id の無いものは入れない（あとから開けなくなるため）', () => {
  const r = parseImport(JSON.stringify({ format: FORMAT, cases: [{ id: 'c1' }, {}], tries: [{ id: 't1' }] }));
  assert.equal(r.ok, true);
  assert.equal(r.cases.length, 1);
  assert.equal(r.tries.length, 0, 'tacticId の無い記録は入れない');
});

test('取り込みで、いまあるものを消さない', () => {
  const mine = [{ id: 'a', updatedAt: 100 }, { id: 'b', updatedAt: 100 }];
  const merged = mergeCases(mine, [{ id: 'c', updatedAt: 50 }]);
  assert.equal(merged.length, 3);
});

test('同じ見立ては、あとから直したほうを残す', () => {
  const merged = mergeCases([{ id: 'a', updatedAt: 300, note: 'いま' }], [{ id: 'a', updatedAt: 100, note: 'むかし' }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].note, 'いま');

  const back = mergeCases([{ id: 'a', updatedAt: 100, note: 'むかし' }], [{ id: 'a', updatedAt: 300, note: 'いま' }]);
  assert.equal(back[0].note, 'いま');
});

test('やってみた記録は、同じ id を二重に入れない', () => {
  const merged = mergeTries([{ id: 't1' }], [{ id: 't1' }, { id: 't2' }]);
  assert.equal(merged.length, 2);
});

test('相談用の文は、事実だけを見た順に並べる', () => {
  const text = toConsultText({
    label: '職場のAさん',
    sceneLabel: '職場',
    rows: [
      { when: '2026/01/02 10:00', text: '言うことが日によって変わる' },
      { when: '2026/02/03 10:00', text: '約束を守らない' },
    ],
  });
  assert.ok(text.indexOf('言うことが日によって変わる') < text.indexOf('約束を守らない'), '見た順に並んでいない');
  assert.match(text, /相手がどういう人かの判断は入れていません/);
  // 型名・判定を入れない
  assert.doesNotMatch(text, /型|見立て結果|該当/);
});

test('中身が空でも、行き止まりにしない', () => {
  const text = toConsultText({});
  assert.match(text, /まだ書いていません/);
});

test('ネットワークにも保存にも触れない', () => {
  const src = read('src/lib/personIO.js');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|indexedDB/);
  assert.doesNotMatch(src, /\(\?<[=!]/, '後読みは古い Safari で落ちるので使わない');
});

test('取り込みの前に、画面が必ず確認を出す', () => {
  const src = read('src/components/People.jsx');
  assert.match(src, /setImportAsk\(parseImport\(/, '検めずに取り込んでいます');
  assert.match(src, /取り込んだあとは元に戻せません/, '取り込みの確認文がありません');
});

test('人間分析だけを消す時も、必ず確認を出す', () => {
  const src = read('src/components/People.jsx');
  assert.match(src, /confirmClear \? \(/, '確認なしで消せてしまいます');
  assert.match(src, /型・癖・状態の記録は残ります/, '何が消えるかを書いていません');
});
