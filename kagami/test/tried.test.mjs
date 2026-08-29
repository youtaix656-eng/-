import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  makeTry, triesOf, summarize, orderCounters, untried, firstMove, RESULTS, RESULT_MAP, MIN_TRIES,
} from '../src/lib/tried.js';
import { PERSON_TYPES, COUNTER_BEST_SCENES, SELF_DEFENSE_TACTIC_IDS } from '../src/data/people.js';
import { TACTIC_MAP } from '../src/data/tactics.js';

const crosses = PERSON_TYPES.find((t) => t.id === 'crosses_line');

test('残すのは ○△✕ だけ（効き目の点数を持たない）', () => {
  assert.deepEqual(RESULTS.map((r) => r.id), ['ok', 'mid', 'ng']);
  const t = makeTry({ tacticId: 'deadline', result: 'ok', score: 10, worked: true });
  for (const bad of ['score', 'worked', 'effect', 'rating', 'level']) {
    assert.ok(!(bad in t), `${bad} を残しています`);
  }
  assert.equal(makeTry({ tacticId: 'x', result: 'そんな結果はない' }).result, 'mid');
});

test('ひとことは残せるが、長い本文は切る', () => {
  assert.equal(makeTry({ tacticId: 'x', note: 'あ'.repeat(500) }).note.length, 200);
});

test('記録は新しい順、見立てごとにも引ける', () => {
  const a = makeTry({ tacticId: 'deadline', caseId: 'c1', at: 1000 });
  const b = makeTry({ tacticId: 'deadline', caseId: 'c2', at: 2000 });
  assert.deepEqual(triesOf([a, b], 'deadline').map((t) => t.at), [2000, 1000]);
  assert.deepEqual(triesOf([a, b], 'deadline', 'c1').map((t) => t.at), [1000]);
});

test('まとめは回数だけを返す（割合や点数を作らない）', () => {
  const s = summarize([
    makeTry({ tacticId: 'deadline', result: 'ok' }),
    makeTry({ tacticId: 'deadline', result: 'ng' }),
  ]).get('deadline');
  assert.deepEqual(Object.keys(s).sort(), ['last', 'ng', 'ok', 'tacticId', 'total']);
  assert.equal(s.total, 2);
});

test('1回の記録では順番を変えない（少ない記録で決めつけない）', () => {
  const before = crosses.counters.map((c) => c.tacticId);
  const one = orderCounters(crosses.counters, { tries: [makeTry({ tacticId: 'deadline', result: 'ok' })] });
  assert.deepEqual(one.map((c) => c.tacticId), before, '1回で並びが変わっています');
  assert.ok(MIN_TRIES >= 2);
});

test('やりやすかった手が前に来る（自分の記録の中の相対だけ）', () => {
  const tries = [
    makeTry({ tacticId: 'deadline', result: 'ok' }),
    makeTry({ tacticId: 'deadline', result: 'ok' }),
  ];
  assert.equal(orderCounters(crosses.counters, { tries })[0].tacticId, 'deadline');
});

test('場面に合う手が前に来る', () => {
  const out = orderCounters(crosses.counters, { scene: 'kids', bestScenes: COUNTER_BEST_SCENES });
  assert.ok(COUNTER_BEST_SCENES[out[0].tacticId].includes('kids'));
});

test('同じ条件なら、もとの並びを崩さない', () => {
  const before = crosses.counters.map((c) => c.tacticId);
  assert.deepEqual(orderCounters(crosses.counters, {}).map((c) => c.tacticId), before);
});

test('まだ試していない手を返す', () => {
  const tries = [makeTry({ tacticId: 'deadline' })];
  const rest = untried(crosses.counters, tries).map((c) => c.tacticId);
  assert.ok(!rest.includes('deadline'));
  assert.equal(rest.length, crosses.counters.length - 1);
});

test('「まず1つ」は、いちばん多くの型に共通する手を選ぶ', () => {
  const m = [
    { type: crosses },
    { type: PERSON_TYPES.find((t) => t.id === 'unaware') },
  ];
  const f = firstMove(m);
  assert.ok(f && f.sharedBy >= 2, '共通の手が選ばれていません');
  assert.ok(f.script, '言い方の例がありません');
  assert.equal(firstMove([]), null, '当たっていなければ何も出さない');
});

test('すべての対応策に言い方の例があり、許可した型から選ばれている', () => {
  for (const t of PERSON_TYPES) {
    for (const c of t.counters) {
      assert.ok(c.script && c.script.length > 0, `${t.name}／${c.tacticId}: 言い方の例がありません`);
      assert.ok(SELF_DEFENSE_TACTIC_IDS.includes(c.tacticId), `${t.name}: 許可の一覧にありません`);
      assert.ok(TACTIC_MAP[c.tacticId], `${c.tacticId}: 存在しない型`);
    }
  }
});

test('言い方の例に、相手の同意が要る言い方を入れない', () => {
  const needsOther = /分からせ|納得させ|反省させ|謝らせ|改めさせ|やめさせる|言い負か|論破/;
  for (const t of PERSON_TYPES) {
    for (const c of t.counters) {
      const m = c.script.match(needsOther);
      assert.ok(!m, `${t.name}／${c.tacticId}: 「${m && m[0]}」が入っています`);
    }
  }
});

test('その手が合う場面の表は、許可した型をすべて覆う', () => {
  for (const id of SELF_DEFENSE_TACTIC_IDS) {
    assert.ok(COUNTER_BEST_SCENES[id], `${id}: 合う場面が書かれていません`);
  }
});

test('記録はネットワークに触れない', () => {
  const src = readFileSync(new URL('../src/lib/tried.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/);
});
