import { useMemo, useState } from 'react';
import { QUESTION_SOURCES, CHOICE_QUIZ_SUBJECTS, questionSourceId, subjectMatches } from '../data/examScope.js';
import { shuffle } from '../lib/examBuilder.js';

// 4択問題：①ファイル分け（過去問／模試／その他）→ 科目 の2段階で選び、
// 四択（type: 'choice'）だけを出題する一問一答の入り口。
export default function ChoiceQuiz({ store, onStartQuiz }) {
  const { questions } = store;
  const [sourceId, setSourceId] = useState(null);

  const choiceQuestions = useMemo(() => questions.filter((q) => q.type === 'choice'), [questions]);

  const sourceCounts = useMemo(
    () =>
      QUESTION_SOURCES.map((s) => ({
        ...s,
        count: choiceQuestions.filter((q) => questionSourceId(q) === s.id).length,
      })),
    [choiceQuestions]
  );

  const poolBySource = useMemo(() => {
    if (!sourceId) return [];
    return choiceQuestions.filter((q) => questionSourceId(q) === sourceId);
  }, [choiceQuestions, sourceId]);

  const subjectCounts = useMemo(
    () =>
      CHOICE_QUIZ_SUBJECTS.map((s) => {
        let pool = poolBySource.filter((q) => subjectMatches(q.subject, { name: s.name }));
        if (s.excludeTags) pool = pool.filter((q) => !(q.tags || []).some((t) => s.excludeTags.includes(t)));
        return { ...s, count: pool.length, pool };
      }),
    [poolBySource]
  );

  const start = (entry) => {
    if (!entry.count) return;
    onStartQuiz(shuffle(entry.pool));
  };

  // ---- ①ファイル分け ----
  if (!sourceId) {
    return (
      <div className="view">
        <h2 className="view-title">4択問題</h2>
        <p className="view-desc">まずファイルを選んでください。次に科目を選ぶと出題を始められます。</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {sourceCounts.map((s) => (
            <button
              key={s.id}
              className="card tap"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => setSourceId(s.id)}
            >
              <div style={{ fontWeight: 700 }}>{s.label}</div>
              <div className="inline-note" style={{ marginTop: 4 }}>
                {s.count > 0 ? `${s.count}問収録` : '収録なし（今後追加予定）'}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- ②科目 ----
  const sourceLabel = QUESTION_SOURCES.find((s) => s.id === sourceId)?.label || '';
  return (
    <div className="view">
      <button className="btn ghost sm" onClick={() => setSourceId(null)}>← ファイルを選び直す</button>
      <h2 className="view-title">{sourceLabel}</h2>
      <p className="view-desc">科目を選んでください（四択のみを出題します）。</p>
      <div className="card">
        {subjectCounts.map((s) => (
          <div
            className="list-item"
            key={s.name}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
          >
            <div>
              <div className="li-q">{s.label}</div>
              <div className="li-stat">{s.count}問</div>
            </div>
            <button className="btn primary sm" disabled={!s.count} onClick={() => start(s)}>
              {s.count ? '出題する' : '未収録'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
