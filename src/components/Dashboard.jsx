import {
  subjectStats,
  overallStats,
  dailyActivity,
  formatPercent,
} from '../lib/stats.js';

// 弱点分析ダッシュボード
// 科目別正答率をグラフ表示し、苦手科目が一目でわかるようにする。
export default function Dashboard({ store }) {
  const { history, questions } = store;
  const overall = overallStats(history);
  const stats = subjectStats(history, questions);
  const answeredStats = stats.filter((s) => s.total > 0);
  const activity = dailyActivity(history, 14);
  const maxDaily = Math.max(1, ...activity.map((d) => d.count));

  if (history.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">弱点分析</h2>
        <div className="empty">
          <div className="ico">📊</div>
          <p>まだ解答データがありません。</p>
          <p className="inline-note">
            一問一答や模擬試験を解くと、科目別の正答率がここに表示されます。
          </p>
        </div>
      </div>
    );
  }

  const barClass = (acc) => (acc >= 0.7 ? 'bar-good' : acc >= 0.5 ? 'bar-mid' : 'bar-bad');
  const weakest = answeredStats[0];

  return (
    <div className="view">
      <h2 className="view-title">弱点分析</h2>
      <p className="view-desc">科目別の正答率です。数値の低い科目から復習しましょう。</p>

      <div className="tiles">
        <div className="tile">
          <div className="num">{history.length}</div>
          <div className="lbl">のべ解答数</div>
        </div>
        <div className="tile">
          <div className="num">{formatPercent(overall.accuracy)}</div>
          <div className="lbl">通算正答率</div>
        </div>
        <div className="tile">
          <div className="num">{answeredStats.length}</div>
          <div className="lbl">学習した科目</div>
        </div>
      </div>

      {weakest && weakest.accuracy != null && weakest.accuracy < 0.7 && (
        <div className="card" style={{ borderColor: '#e7c3bd', background: 'var(--wrong-bg)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--wrong)' }}>
            ⚠️ 特に苦手な科目
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
            {weakest.subject}（{formatPercent(weakest.accuracy)}）
          </div>
          <div className="inline-note">
            この科目を重点的に「間違えた問題」モードや音声学習で復習すると効果的です。
          </div>
        </div>
      )}

      <div className="section-label">科目別 正答率</div>
      {stats.map((s) => (
        <div className="stat-row" key={s.subject}>
          <div className="stat-head">
            <span className="stat-subject">{s.subject}</span>
            <span className="stat-pct" style={{ color: s.total === 0 ? 'var(--text-mute)' : undefined }}>
              {formatPercent(s.accuracy)}
              {s.total > 0 && <span className="stat-sub"> （{s.correct}/{s.total}）</span>}
              {s.total === 0 && <span className="stat-sub"> 未解答</span>}
            </span>
          </div>
          <div className={`bar ${s.accuracy != null ? barClass(s.accuracy) : ''}`}>
            <span style={{ width: `${(s.accuracy || 0) * 100}%` }} />
          </div>
        </div>
      ))}

      <div className="section-label">学習量（直近14日）</div>
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
          棒の高さ＝解答数、濃い部分＝正解数
        </div>
      </div>
    </div>
  );
}
