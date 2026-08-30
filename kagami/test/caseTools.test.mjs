import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SNAPSHOT_MAX, UNDO_MS, pushSnapshot, timelineOf, compare, isStale, daysSince,
  seenAtOf, withSeenAt, makeUndo, undoAlive,
} from '../src/lib/caseTools.js';
import { STALE_DAYS, STAGES, CASE_STATUSES, NOTE_TEMPLATE, SCENE_HELPLINES, SCENES } from '../src/data/people.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const DAY = 24 * 60 * 60 * 1000;

test('直す前の中身を版として積む（上書きで消さない）', () => {
  const c = { checkedIds: ['a:1'], createdAt: 100, updatedAt: 200 };
  const snaps = pushSnapshot(c, ['a:1', 'a:2']);
  assert.equal(snaps.length, 1);
  assert.deepEqual(snaps[0], { at: 200, checkedIds: ['a:1'] });
});

test('中身が変わっていなければ版を積まない（同じものを並べない）', () => {
  const c = { checkedIds: ['a:1', 'a:2'], updatedAt: 200, snapshots: [] };
  assert.equal(pushSnapshot(c, ['a:2', 'a:1']).length, 0);
});

test('版は上限で打ち切る（端末の中を膨らませない）', () => {
  let c = { checkedIds: [], updatedAt: 0, snapshots: [] };
  for (let i = 1; i <= SNAPSHOT_MAX + 5; i += 1) {
    const next = Array.from({ length: i }, (_, n) => `a:${n}`);
    c = { checkedIds: next, updatedAt: i, snapshots: pushSnapshot(c, next) };
  }
  assert.equal(c.snapshots.length, SNAPSHOT_MAX);
});

test('移り変わりは、いまの中身を先頭に置く', () => {
  const t = timelineOf({ updatedAt: 300, checkedIds: ['a:2'], snapshots: [{ at: 200, checkedIds: ['a:1'] }] });
  assert.equal(t[0].now, true);
  assert.equal(t[0].at, 300);
  assert.equal(t[1].now, false);
});

test('比べても採点しない（出るのは共通・片方だけの3つだけ）', () => {
  const d = compare(['a', 'b'], ['b', 'c']);
  assert.deepEqual(d, { both: ['b'], onlyA: ['a'], onlyB: ['c'] });
  assert.deepEqual(Object.keys(d).sort(), ['both', 'onlyA', 'onlyB']);
  // コメント（「採点しない」と書いてある）を除いた、実際の処理だけを見る
  const code = read('src/lib/caseTools.js')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
  assert.doesNotMatch(code, /score|rank|順位|ランク|点数/, '採点・順位づけが入っています');
});

test('古い見立てには印を付けるだけ（消さない・直さない）', () => {
  const now = Date.now();
  assert.equal(isStale({ updatedAt: now - (STALE_DAYS + 1) * DAY }, now), true);
  assert.equal(isStale({ updatedAt: now - 1 * DAY }, now), false);
  assert.equal(daysSince(now - 3 * DAY, now), 3);
  const src = read('src/lib/caseTools.js');
  assert.doesNotMatch(src, /\bdelete\b|splice/, '古いものを消す処理が入っています');
});

test('チェックした時刻は、最初に入れた時のものを持ち越す', () => {
  const prev = { 'a:1': 100 };
  const next = withSeenAt(prev, ['a:1', 'a:2'], 500);
  assert.equal(next['a:1'], 100, '最初に見た日を上書きしない');
  assert.equal(next['a:2'], 500);
});

test('チェックを外したふるまいの時刻は残さない', () => {
  const next = withSeenAt({ 'a:1': 100, 'a:2': 200 }, ['a:1'], 500);
  assert.deepEqual(Object.keys(next), ['a:1']);
  assert.equal(seenAtOf({ seenAt: next }, 'a:2'), 0);
});

test('消したものは1件だけ、決まった時間だけ戻せる', () => {
  const u = makeUndo({ id: 'c1' });
  assert.equal(undoAlive(u, u.at + 1000), true);
  assert.equal(undoAlive(u, u.at + UNDO_MS + 1), false);
  assert.equal(undoAlive(null), false);
  assert.equal(makeUndo(null), null);
});

test('距離の段は「上ほど正しい」と書かない', () => {
  assert.ok(STAGES.length >= 3);
  assert.equal(STAGES[0].id, 0);
  for (const st of STAGES) {
    assert.doesNotMatch(st.label, /正しい|良い|悪い|べき|失格|勝ち|負け/, `${st.label}: 良し悪しが入っています`);
  }
});

test('見立ての状態は3つまで（曖昧な段を増やさない）', () => {
  assert.ok(CASE_STATUSES.length <= 3);
  assert.ok(CASE_STATUSES.some((s) => s.id === 'open'));
});

test('記録のひな形は「言われたこと（そのまま）」を必ず持つ', () => {
  assert.match(NOTE_TEMPLATE, /そのまま/);
  // ひな形に相手を評価する欄を作らない（そこに必ず決めつけが入る）
  assert.doesNotMatch(NOTE_TEMPLATE, /相手の性格|どんな人|評価|点数/);
});

test('相談先は場面ごとにあり、番号を断定しない', () => {
  for (const sc of SCENES) {
    assert.ok(Array.isArray(SCENE_HELPLINES[sc.id]), `${sc.id}: 相談先がありません`);
    assert.ok(SCENE_HELPLINES[sc.id].length > 0);
  }
  // 変わりうるものなので、画面側に「確かめてから」を必ず出す
  assert.match(read('src/components/People.jsx'), /名称・番号は変わることがあります/);
});

test('ネットワークにも保存にも触れない', () => {
  const src = read('src/lib/caseTools.js');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|indexedDB/);
  assert.doesNotMatch(src, /\(\?<[=!]/, '後読みは古い Safari で落ちるので使わない');
});
