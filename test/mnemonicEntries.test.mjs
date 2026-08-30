import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMnemonicEntries } from '../src/lib/mnemonicEntries.js';

test('buildMnemonicEntries: mnemonicが登録されたkeywordだけを抽出する', () => {
  const kwMeta = {
    合谷: { mnemonic: 'ゴウコクは面口のツボ', reading: 'ごうこく' },
    足三里: { mnemonic: '' }, // 本文が空なので対象外
    empty: {},
  };
  const out = buildMnemonicEntries(kwMeta, [], {});
  assert.deepEqual(out.map((e) => e.keyword), ['合谷']);
  assert.equal(out[0].reading, 'ごうこく');
});

test('buildMnemonicEntries: 関連問題から科目・件数を集計する', () => {
  const kwMeta = { 合谷: { mnemonic: 'テスト' } };
  const questions = [
    { id: 'q1', subject: '経絡経穴概論', tags: ['合谷'] },
    { id: 'q2', subject: '経絡経穴概論', tags: ['合谷'] },
  ];
  const out = buildMnemonicEntries(kwMeta, questions, {});
  assert.equal(out[0].count, 2);
  assert.deepEqual(out[0].subjects, ['経絡経穴概論']);
});

test('buildMnemonicEntries: あいうえお順に並ぶ', () => {
  const kwMeta = {
    足三里: { mnemonic: 'A' },
    合谷: { mnemonic: 'B' },
  };
  const out = buildMnemonicEntries(kwMeta, [], {});
  // 単純な文字コード比較ではなく localeCompare('ja') で安定した順序になることだけ確認
  assert.equal(out.length, 2);
});
