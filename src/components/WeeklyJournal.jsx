import { useEffect, useMemo, useState } from 'react';
import { loadMissTypes, missTypeLabel } from '../lib/missTypes.js';
import { weekKeyOf, buildWeeklyReport, loadWeeklyNotes, saveWeeklyNote } from '../lib/weeklyJournal.js';
import { formatPercent } from '../lib/stats.js';

function formatWeekLabel(weekKeyStr) {
  const start = new Date(Number(weekKeyStr));
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const f = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${f(start)}〜${f(end)}`;
}

// 週次の弱点ジャーナル：直近7日間の解答から自動で週報を作り、来週の方針を一言書き込める。
//   3分の2バッファ術のマネージャービューと同じく「うまくいかなかったのは実行役ではなく
//   計画の立て方」という前向きな前提でまとめる（自己否定を招く表現は使わない）。
export default function WeeklyJournal({ store, onNavigate }) {
  const { history, questions, links } = store;
  const [missTypes, setMissTypes] = useState({});
  const [notes, setNotes] = useState({});
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadMissTypes().then(setMissTypes); }, []);
  useEffect(() => {
    loadWeeklyNotes().then((all) => {
      setNotes(all);
      const key = weekKeyOf();
      if (all[key]) setDraft(all[key].note);
    });
  }, []);

  const report = useMemo(
    () => buildWeeklyReport(history, missTypes, questions, links),
    [history, missTypes, questions, links]
  );

  const thisWeekKey = weekKeyOf();
  const pastWeeks = useMemo(
    () => Object.keys(notes).filter((k) => k !== thisWeekKey).sort((a, b) => Number(b) - Number(a)),
    [notes, thisWeekKey]
  );

  const save = async () => {
    const all = await saveWeeklyNote(thisWeekKey, draft);
    setNotes(all);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="view">
      <h2 className="view-title">週次の弱点ジャーナル</h2>
      <p className="view-desc">
        直近7日間の解答から自動で週報を作ります。うまくいかなかった週があっても、それは実行役の
        せいではなく計画の立て方の問題です。来週の方針だけ一言決めて、また今週から進めましょう。
      </p>

      <div className="section-label">📅 今週（{formatWeekLabel(thisWeekKey)}）</div>
      <div className="card">
        {report.total === 0 ? (
          <p className="inline-note">今週はまだ解答記録がありません。まずは1問から始めてみましょう。</p>
        ) : (
          <>
            <div className="tiles">
              <div className="tile">
                <div className="num">{report.total}</div>
                <div className="lbl">解答数</div>
              </div>
              <div className="tile">
                <div className="num" style={{ color: 'var(--correct, #2e7d32)' }}>{formatPercent(report.accuracy)}</div>
                <div className="lbl">正答率</div>
              </div>
              <div className="tile">
                <div className="num">{report.wrongCount}</div>
                <div className="lbl">誤答した問題数</div>
              </div>
            </div>
            {report.topType && (
              <p className="inline-note" style={{ marginTop: 8 }}>
                今週いちばん多かった誤答理由は「{missTypeLabel(report.topType)}」でした。
              </p>
            )}
            {report.weakTags.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="section-hint">今週の弱点テーマ</div>
                <div className="btn-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
                  {report.weakTags.map((t) => (
                    <span className="chip" key={t.tag}>{t.tag}（誤答{t.wrong}）</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="section-label">✍️ 来週の方針（一言）</div>
      <div className="card">
        <textarea
          className="journal-textarea"
          rows={3}
          placeholder="例：ケアレスミスが多かったので、来週は解答前に選択肢を2回読む"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn primary sm" onClick={save}>保存</button>
          {saved && <span className="inline-note">保存しました</span>}
        </div>
      </div>

      {pastWeeks.length > 0 && (
        <>
          <div className="section-label">🗂️ 過去の週の方針</div>
          {pastWeeks.map((k) => (
            <div className="card" key={k} style={{ marginBottom: 8 }}>
              <div className="stat-subject">{formatWeekLabel(k)}</div>
              <p style={{ margin: '4px 0 0' }}>{notes[k].note || '（未記入）'}</p>
            </div>
          ))}
        </>
      )}

      <div className="ana-jump">
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('analytics')}>📈 分析へ戻る</button>
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('review')}>🔁 間違えた問題へ</button>
      </div>
    </div>
  );
}
