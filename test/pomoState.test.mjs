import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPomoState, savePomoState, loadPomoUi, savePomoUi, clearPomoState } from '../src/lib/pomoState.js';

// node --test の環境にはIndexedDBもlocalStorageも無いため、実際のブラウザでの
// 「両方使えて正常に保存できる」経路は検証できない。ここでは「両方とも
// 使えない異常系でどうなるか」（フォールバックが尽きた時の契約）を固定化する。

test('loadPomoState: IndexedDB・localStorageの両方が使えない環境では例外を投げる（何も保存していない、とは区別する）', async () => {
  await assert.rejects(() => loadPomoState());
});

test('savePomoState: 両方失敗してもfalseを返すだけで例外は投げない（呼び出し側が再試行を判断できるように）', async () => {
  const ok = await savePomoState({ phase: 'study', running: true, remaining: 10, phaseEndAt: 0, done: 0 });
  assert.equal(ok, false);
});

test('loadPomoUi: 両方失敗してもnullを返す（表示状態の復元失敗はユーザーに知らせるほどの異常ではない）', async () => {
  const ui = await loadPomoUi();
  assert.equal(ui, null);
});

test('savePomoUi/clearPomoState: 両方失敗しても例外を投げずに解決する', async () => {
  await assert.doesNotReject(() => savePomoUi({ min: true }));
  await assert.doesNotReject(() => clearPomoState());
});
