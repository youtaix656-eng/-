import { useMemo } from 'react';
import {
  EXAM_SUBJECTS,
  EXAM_SESSIONS,
  EXAM_INFO,
  scopeCoverage,
} from '../data/examScope.js';
import { formatPercent } from '../lib/stats.js';

// 試験範囲（出題科目）画面
// 公式13科目を午前/午後に分け、各科目に自分の収録数・正答率を並べる。
// 収録がある科目は「解く」で一問一答へ、無い科目は取り込みを促す。
export default function ExamScope({ store, onStartSubject, onOpenSettings }) {
  const { questions, history } = store;
  const coverage = useMemo(() => scopeCoverage(questions, history), [questions, history]);
  const covById = useMemo(
    () => Object.fromEntries(coverage.map((c) => [c.subject.id, c])),
    [coverage]
  );

  const covered = coverage.filter((c) => c.count > 0).length;

  const barClass = (acc) => (acc == null ? '' : acc >= 0.7 ? 'bar-good' : acc >= 0.5 ? 'bar-mid' : 'bar-bad');

  const renderSubject = (subj) => {
    const c = covById[subj.id];
    return (
      <div className="scope-item" key={subj.id}>
        <div className="scope-main">
          <div className="scope-name">
            {subj.name}
            {subj.note && <span className="scope-note">（{subj.note}）</span>}
          </div>
          <div className="scope-stat">
            {c.count > 0 ? (
              <>
                収録 {c.count}問
                {c.answered > 0 && (
                  <> ・ 正答率 <strong>{formatPercent(c.accuracy)}</strong></>
                )}
              </>
            ) : (
              <span className="scope-empty">未収録</span>
            )}
          </div>
          {c.count > 0 && c.answered > 0 && (
            <div className={`bar ${barClass(c.accuracy)}`} style={{ marginTop: 6 }}>
              <span style={{ width: `${(c.accuracy || 0) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="scope-action">
          {c.count > 0 ? (
            <button className="btn sm primary" onClick={() => onStartSubject(subj.name)}>
              解く
            </button>
          ) : (
            <button className="btn sm ghost" onClick={onOpenSettings}>
              追加
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="view">
      <h2 className="view-title">試験範囲（全13科目）</h2>
      <p className="view-desc">
        はり師・きゅう師 国家試験の出題科目です。各科目の収録状況と正答率を確認できます。
      </p>

      {/* 合格ライン */}
      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>
              {Math.round(EXAM_INFO.passRate * 100)}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sub)', fontWeight: 600 }}>合格ライン</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
            {EXAM_INFO.passNote}
          </div>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="num">{EXAM_INFO.totalSubjects}</div>
          <div className="lbl">試験科目</div>
        </div>
        <div className="tile">
          <div className="num">{covered}</div>
          <div className="lbl">収録済み科目</div>
        </div>
        <div className="tile">
          <div className="num">{questions.length}</div>
          <div className="lbl">総問題数</div>
        </div>
      </div>

      {['am', 'pm'].map((sid) => (
        <div key={sid}>
          <div className="scope-session">
            <span className="scope-session-label">{EXAM_SESSIONS[sid].label}</span>
            <span className="scope-session-note">{EXAM_SESSIONS[sid].note}</span>
          </div>
          {EXAM_SUBJECTS.filter((s) => s.session === sid).map(renderSubject)}
        </div>
      ))}

      <p className="inline-note" style={{ marginTop: 14 }}>
        出典：{EXAM_INFO.source}。問題数・配点・合格点・時間割は年度により変わるため、
        最新情報は東洋療法研修試験財団の公式発表でご確認ください。
      </p>
    </div>
  );
}
