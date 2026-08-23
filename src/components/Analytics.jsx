import { useMemo } from 'react';
import {
  overallStats,
  subjectStats,
  dailyActivity,
  accuracyTrend,
  passReadiness,
  studyStreak,
  masteryStats,
  styleDiagnosis,
  formatPercent,
  subjectBalanceWarning,
} from '../lib/stats.js';
import { scopeCoverage } from '../data/examScope.js';
import { isInReview, MATURE_INTERVAL } from '../lib/srs.js';
import { computeBadges } from '../lib/gamify.js';
import InsightsSection from './InsightsSection.jsx';

// 分析・攻略率・合格者診断（⑯⑱㉑㉒）
// 学習分析グラフ・出題範囲カバー率・合格ラインまで何%・合格者スタイル診断を1画面に。
export default function Analytics({ store, onNavigate }) {
  const { history, questions, srs, examResults } = store;
  const badges = useMemo(
    () => computeBadges(history, srs, questions, examResults, isInReview, MATURE_INTERVAL),
    [history, srs, questions, examResults]
  );

  const overall = overallStats(history);
  const scope = useMemo(() => scopeCoverage(questions, history), [questions, history]);
  const mastery = useMemo(
    () => masteryStats(questions, srs, isInReview, MATURE_INTERVAL, scope),
    [questions, srs, scope]
  );
  const pass = useMemo(() => passReadiness(history), [history]);
  const trend = useMemo(() => accuracyTrend(history, 8), [history]);
  const { activeDays, streak } = useMemo(() => studyStreak(history), [history]);
  const activity = useMemo(() => dailyActivity(history, 14), [history]);
  const maxDaily = Math.max(1, ...activity.map((d) => d.count));
  const subjM = useMemo(
    () => [...mastery.bySubject].filter((s) => s.count > 0).sort((a, b) => b.mastery - a.mastery),
    [mastery]
  );
  const diagnosis = useMemo(
    () => styleDiagnosis(history, questions, srs, isInReview, MATURE_INTERVAL),
    [history, questions, srs]
  );
  const balance = useMemo(() => subjectBalanceWarning(history, questions), [history, questions]);

  if (history.length === 0) {
    return (
      <div className="view">
        <div className="empty">
          <div className="ico">📈</div>
          <p>まだ解答データがありません。</p>
          <p className="inline-note">
            問題を解くと、攻略率・合格ラインまでの距離・あなたの学習スタイル診断がここに表示されます。
          </p>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => onNavigate && onNavigate('session')}>
            学習をはじめる
          </button>
        </div>
      </div>
    );
  }

  const passPct = pass.predicted == null ? 0 : Math.round(pass.predicted * 100);
  const gapPt = pass.gap == null ? null : Math.round(pass.gap * 100);

  return (
    <div className="view">
      <InsightsSection store={store} />

      {/* ===== ㉑ 合格ラインまで何% ===== */}
      <div className="section-label">🎯 合格ライン診断</div>
      <div className="card ana-pass">
        <div className="ana-gauge">
          <div className="ana-gauge-track">
            <span
              className={pass.reached ? 'ana-gauge-fill reached' : 'ana-gauge-fill'}
              style={{ width: `${Math.min(100, passPct)}%` }}
            />
            <span className="ana-gauge-line" style={{ left: `${Math.round(pass.passLine * 100)}%` }} title="合格ライン60%" />
          </div>
          <div className="ana-gauge-scale">
            <span>0%</span>
            <span className="ana-gauge-goal">合格ライン {Math.round(pass.passLine * 100)}%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="ana-pass-body">
          <div className="ana-pass-num">
            予想得点率 <strong>{passPct}%</strong>
          </div>
          {pass.reached ? (
            <div className="ana-pass-msg good">
              🎉 合格ラインに到達！（+{Math.abs(gapPt)}ポイントの余裕）この調子を維持しましょう。
            </div>
          ) : (
            <div className="ana-pass-msg">
              合格ラインまで <strong>あと{gapPt}ポイント</strong>。直近{pass.sample}問の正答率から算出。
            </div>
          )}
          <div className="inline-note">
            ※直近の正答率をもとにした目安です。合格基準は年度により変動します（試験範囲画面参照）。
          </div>
        </div>
      </div>

      {/* ===== 科目バランス警告 ===== */}
      {balance.hasWarning && (
        <div className="card" style={{ borderLeft: '4px solid var(--wrong)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚖️ 科目バランスの偏りに注意</div>
          <p className="inline-note" style={{ margin: '0 0 6px' }}>
            他の科目は平均{formatPercent(balance.avgAccuracy)}前後で解けているのに、次の科目だけ極端に低いままです。
            このまま模試だけ繰り返すと苦手科目が手つかずになりやすいので、優先的に取り組みましょう。
          </p>
          {balance.weakSubjects.map((s) => (
            <div className="stat-row" key={s.subject}>
              <div className="stat-head">
                <span className="stat-subject">{s.subject}</span>
                <span className="stat-pct">{formatPercent(s.accuracy)}<span className="stat-sub">（{s.total}問）</span></span>
              </div>
              <div className="bar ana-bar-mastery">
                <span style={{ width: `${s.accuracy * 100}%`, background: 'var(--wrong)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== ⑱ 出題範囲カバー率・攻略率 ===== */}
      <div className="section-label">🗂️ 出題範囲カバー率・攻略率</div>
      <div className="tiles">
        <div className="tile">
          <div className="num">{formatPercent(mastery.overall.coverage)}</div>
          <div className="lbl">カバー率（着手）</div>
        </div>
        <div className="tile">
          <div className="num" style={{ color: 'var(--correct, #2e7d32)' }}>{formatPercent(mastery.overall.mastery)}</div>
          <div className="lbl">攻略率（定着）</div>
        </div>
        <div className="tile">
          <div className="num">{streak}<span style={{ fontSize: 14 }}>日</span></div>
          <div className="lbl">連続学習</div>
        </div>
      </div>

      <div className="card">
        <div className="ana-stack" title="定着・学習中・要復習・未着手の内訳">
          {mastery.overall.mastered > 0 && (
            <span className="seg seg-mastered" style={{ flex: mastery.overall.mastered }}>{mastery.overall.mastered}</span>
          )}
          {mastery.overall.learning > 0 && (
            <span className="seg seg-learning" style={{ flex: mastery.overall.learning }}>{mastery.overall.learning}</span>
          )}
          {mastery.overall.review > 0 && (
            <span className="seg seg-review" style={{ flex: mastery.overall.review }}>{mastery.overall.review}</span>
          )}
          {mastery.overall.untouched > 0 && (
            <span className="seg seg-untouched" style={{ flex: mastery.overall.untouched }}>{mastery.overall.untouched}</span>
          )}
        </div>
        <div className="ana-legend">
          <span><i className="dot seg-mastered" />定着 {mastery.overall.mastered}</span>
          <span><i className="dot seg-learning" />学習中 {mastery.overall.learning}</span>
          <span><i className="dot seg-review" />要復習 {mastery.overall.review}</span>
          <span><i className="dot seg-untouched" />未着手 {mastery.overall.untouched}</span>
        </div>
      </div>

      {subjM.length > 0 && (
        <>
          <div className="section-label" style={{ fontSize: 13 }}>科目別 攻略率（高い順）</div>
          {subjM.map((s) => (
            <div className="stat-row" key={s.name}>
              <div className="stat-head">
                <span className="stat-subject">{s.name}</span>
                <span className="stat-pct">
                  {formatPercent(s.mastery)}
                  <span className="stat-sub"> （定着{s.mastered}/{s.count}）</span>
                </span>
              </div>
              <div className="bar ana-bar-mastery">
                <span style={{ width: `${s.mastery * 100}%` }} />
                <i className="ana-bar-cover" style={{ width: `${s.coverage * 100}%` }} title={`カバー率 ${formatPercent(s.coverage)}`} />
              </div>
            </div>
          ))}
          <div className="inline-note">濃い部分＝攻略率（定着）、薄い線＝カバー率（着手）。</div>
        </>
      )}

      {/* ===== ⑯ 学習分析グラフ ===== */}
      <div className="section-label">📈 正答率の推移</div>
      <div className="card">
        {trend.length >= 2 ? (
          <>
            <div className="ana-trend">
              {trend.map((t, i) => (
                <div className="ana-trend-col" key={i} title={`${t.n}問：${formatPercent(t.accuracy)}`}>
                  <div className="ana-trend-bar" style={{ height: `${Math.max(4, t.accuracy * 100)}%` }} />
                  <span className="ana-trend-lbl">{Math.round(t.accuracy * 100)}</span>
                </div>
              ))}
            </div>
            <div className="inline-note" style={{ textAlign: 'center' }}>
              左（過去）→右（最近）。上がっていれば実力アップのサイン。
            </div>
          </>
        ) : (
          <p className="inline-note">推移グラフは、もう少し解答がたまると表示されます。</p>
        )}
      </div>

      <div className="section-label">📅 学習量（直近14日）</div>
      <div className="card">
        <div className="activity">
          {activity.map((d, i) => {
            const h = (d.count / maxDaily) * 100;
            const correctH = d.count > 0 ? (d.correct / d.count) * h : 0;
            return (
              <div className="day" key={i} title={`${d.date.getMonth() + 1}/${d.date.getDate()}：${d.count}問`}>
                <div className={`col ${d.count === 0 ? 'empty' : ''}`} style={{ height: `${Math.max(h, d.count > 0 ? 6 : 3)}%` }}>
                  {d.count > 0 && <span style={{ height: `${correctH}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="inline-note" style={{ textAlign: 'center', marginTop: 6 }}>
          のべ{history.length}問・{activeDays}日学習・通算正答率{formatPercent(overall.accuracy)}
        </div>
      </div>

      {/* ===== ㉒ 合格者スタイル診断 ===== */}
      <div className="section-label">🧭 合格者スタイル診断</div>
      <div className="card ana-diag">
        <div className="ana-diag-head">
          <span className="ana-diag-emoji">{diagnosis.emoji}</span>
          <div>
            <div className="ana-diag-type">{diagnosis.type}</div>
            <div className="ana-diag-summary">{diagnosis.summary}</div>
          </div>
        </div>
        {diagnosis.metrics.length > 0 && (
          <div className="ana-diag-metrics">
            {diagnosis.metrics.map((m) => (
              <div className="ana-diag-metric" key={m.label}>
                <span className="k">{m.label}</span>
                <span className="v">{m.value}</span>
              </div>
            ))}
          </div>
        )}
        {diagnosis.strengths.length > 0 && (
          <div className="ana-diag-block">
            <div className="ana-diag-block-title">💪 あなたの強み</div>
            <ul>{diagnosis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {diagnosis.advice.length > 0 && (
          <div className="ana-diag-block advice">
            <div className="ana-diag-block-title">📌 次の一手</div>
            <ul>{diagnosis.advice.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
      </div>

      {/* ===== 継続バッジ ===== */}
      <div className="section-label">🏅 達成バッジ（{badges.filter((b) => b.earned).length}/{badges.length}）</div>
      <div className="badge-grid">
        {badges.map((b) => (
          <div className={`badge-item ${b.earned ? 'earned' : 'locked'}`} key={b.id} title={b.desc}>
            <span className="badge-ico">{b.earned ? b.icon : '🔒'}</span>
            <span className="badge-title">{b.title}</span>
            {!b.earned && b.progress && (
              <span className="badge-prog">{b.progress.cur}/{b.progress.goal}</span>
            )}
          </div>
        ))}
      </div>

      <div className="ana-jump">
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('journal')}>📓 週次の弱点ジャーナル</button>
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('review')}>🔁 間違えた問題へ</button>
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('scope')}>🗂️ 試験範囲へ</button>
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('session')}>📚 学習へ</button>
      </div>
    </div>
  );
}
