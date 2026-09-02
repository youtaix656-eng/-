import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayFocusSubjects } from '../src/lib/todayFocus.js';

function mk(name, count, answered, accuracy) {
  return { subject: { id: name, name }, count, answered, correct: 0, accuracy };
}

test('todayFocusSubjects: 収録が無い科目は対象外', () => {
  const scope = [mk('A', 0, 0, null), mk('B', 30, 10, 0.5)];
  const out = todayFocusSubjects(scope, 60);
  assert.deepEqual(out.map((s) => s.subject.name), ['B']);
});

test('todayFocusSubjects: 正答率が低い科目を優先', () => {
  const scope = [mk('得意', 50, 50, 0.95), mk('苦手', 50, 50, 0.2)];
  const out = todayFocusSubjects(scope, 60, { limit: 2 });
  assert.equal(out[0].subject.name, '苦手');
});

test('todayFocusSubjects: 試験まで時間がある時ほど手薄さも考慮する', () => {
  // 正答率は同じくらいだが、片方は収録数が極端に少ない（手薄）
  const scope = [mk('厚い', 100, 20, 0.7), mk('薄い', 2, 2, 0.5)];
  const farOut = todayFocusSubjects(scope, 170, { limit: 2 }); // 試験まで遠い
  const nearOut = todayFocusSubjects(scope, 5, { limit: 2 }); // 試験直前
  // 遠い時は手薄さの影響で「薄い」の優先度が相対的に上がる
  const farGap = farOut.find((s) => s.subject.name === '薄い').score - farOut.find((s) => s.subject.name === '厚い').score;
  const nearGap = nearOut.find((s) => s.subject.name === '薄い').score - nearOut.find((s) => s.subject.name === '厚い').score;
  assert.ok(farGap > nearGap);
});

test('todayFocusSubjects: 未着手は中間の危険度として扱う', () => {
  const scope = [mk('未着手', 50, 0, null)];
  const out = todayFocusSubjects(scope, 60, { limit: 1 });
  assert.equal(out[0].reason, 'まだ手つかず');
});

test('todayFocusSubjects: limitで件数を絞れる', () => {
  const scope = [mk('A', 30, 10, 0.9), mk('B', 30, 10, 0.8), mk('C', 30, 10, 0.7)];
  const out = todayFocusSubjects(scope, 60, { limit: 2 });
  assert.equal(out.length, 2);
});

test('todayFocusSubjects: questionsを渡すと過去問の頻出度も加味される', () => {
  // 正答率だけ見ると「頻出科目」の方が得意（優先度は低いはず）だが、過去問で3回にまたがって
  // 出題されている（頻出）ため、頻出度を加味すると逆転して優先されるべきケース。
  const scope = [mk('頻出科目', 50, 50, 0.85), mk('レア科目', 50, 50, 0.72)];
  const questions = [
    { id: 'a', subject: '頻出科目', genre: 'g｜a', round: 30 },
    { id: 'b', subject: '頻出科目', genre: 'g｜a', round: 31 },
    { id: 'c', subject: '頻出科目', genre: 'g｜a', round: 32 },
  ];
  const withoutFreq = todayFocusSubjects(scope, 60, { limit: 2 });
  const withFreq = todayFocusSubjects(scope, 60, { limit: 2, questions });
  // questionsを渡さない場合はレア科目の方がわずかに正答率が低い分だけ優先されるはず
  assert.equal(withoutFreq[0].subject.name, 'レア科目');
  // questionsを渡すと頻出度の分だけ「頻出科目」が押し上げられて逆転する
  assert.equal(withFreq[0].subject.name, '頻出科目');
  assert.equal(withFreq[0].reason, '過去問での頻出テーマが多い');
});

test('todayFocusSubjects: questionsを渡さなければ従来どおり（後方互換）', () => {
  const scope = [mk('得意', 50, 50, 0.95), mk('苦手', 50, 50, 0.2)];
  const out = todayFocusSubjects(scope, 60, { limit: 2 });
  assert.equal(out[0].subject.name, '苦手');
});

test('todayFocusSubjects: examResultsを渡すと模試の伸びしろ分析（失点貢献度）も加味される', () => {
  // 正答率・収録数は同じだが、直近の模試（午前）では「関係法規」を全問落とし、
  // 「解剖学」は全問正解している → 出題数の重み込みの失点貢献度は「関係法規」の方が高い。
  const scope = [mk('解剖学', 50, 50, 0.9), mk('関係法規', 50, 50, 0.9)];
  const examResults = [
    {
      mode: 'am',
      perSubject: {
        解剖学: { total: 9, correct: 9 },
        関係法規: { total: 4, correct: 0 },
      },
    },
  ];
  const withoutExam = todayFocusSubjects(scope, 60, { limit: 2 });
  const withExam = todayFocusSubjects(scope, 60, { limit: 2, examResults });
  // examResultsを渡さない場合はスコアが同点（先着順）
  assert.equal(withoutExam[0].score, withoutExam[1].score);
  // examResultsを渡すと「関係法規」の失点貢献度が押し上げられて優先される
  assert.equal(withExam[0].subject.name, '関係法規');
  assert.equal(withExam[0].reason, '模試で伸ばすと効く科目');
});

test('todayFocusSubjects: examResultsに得意/苦手モード等（正式でない）しか無ければ加味しない', () => {
  const scope = [mk('解剖学', 50, 50, 0.9), mk('関係法規', 50, 50, 0.9)];
  const examResults = [{ mode: 'weak', perSubject: { 関係法規: { total: 4, correct: 0 } } }];
  const out = todayFocusSubjects(scope, 60, { limit: 2, examResults });
  assert.equal(out[0].score, out[1].score);
});
