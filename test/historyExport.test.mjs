import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportHistoryCsv } from '../src/lib/historyExport.js';

test('exportHistoryCsv: ヘッダー行と件数分の行が出力される', () => {
  const questions = [{ id: 'q1', subject: '医療概論', question: 'テスト問題' }];
  const history = [
    { questionId: 'q1', correct: true, at: 1700000000000, source: 'session' },
    { questionId: 'q1', correct: false, at: 1700000001000, source: 'review' },
  ];
  const csv = exportHistoryCsv(history, questions);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3); // header + 2 rows
  assert.match(lines[0], /日時,科目,問題文,正誤,出題元/);
  assert.match(lines[1], /医療概論/);
  assert.match(lines[1], /正解/);
  assert.match(lines[2], /不正解/);
});

test('exportHistoryCsv: 問題文にカンマ・改行があってもCSVとして壊れない', () => {
  const questions = [{ id: 'q1', subject: 'A', question: 'これは,カンマと\n改行を含む' }];
  const history = [{ questionId: 'q1', correct: true, at: 1, source: 's' }];
  const csv = exportHistoryCsv(history, questions);
  const lines = csv.split('\n');
  // 引用符でエスケープされているため、改行を含んでいても行数は増えない実質1データ行（引用符内の改行はCSV上は許容）
  assert.match(csv, /"これは,カンマと\n改行を含む"/);
});

test('exportHistoryCsv: 対応する問題が見つからない場合も落ちない', () => {
  const csv = exportHistoryCsv([{ questionId: 'missing', correct: true, at: 1 }], []);
  assert.ok(csv.split('\n').length === 2);
});

test('exportHistoryCsv: 空履歴でもヘッダーだけ出力される', () => {
  const csv = exportHistoryCsv([], []);
  assert.equal(csv.split('\n').length, 1);
});
