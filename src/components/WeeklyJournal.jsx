import { useEffect, useMemo, useState } from 'react';
import { loadMissTypes, missTypeLabel } from '../lib/missTypes.js';
import { weekKeyOf, weekStartOf, buildWeeklyReport, loadWeeklyNotes, saveWeeklyNote } from '../lib/weeklyJournal.js';
import { loadRoundLog } from '../lib/roundLog.js';
import { formatPercent } from '../lib/stats.js';
import { loadContentSeedLog, seedEntriesSince } from '../lib/contentSeedLog.js';
import { zeroDaysSummary } from '../lib/reviewZeroLog.js';
import { resolvedLeechesSince } from '../lib/reviewDwell.js';
import { weakTagClusters, tagTrend } from '../lib/weakClusters.js';

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
  const { history, questions, links, reviewZeroLog } = store;
  const [missTypes, setMissTypes] = useState({});
  const [roundLog, setRoundLog] = useState([]);
  const [notes, setNotes] = useState({});
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [seedLog, setSeedLog] = useState([]); // #30：今週埋めた手薄科目の自動追記候補

  useEffect(() => { loadMissTypes().then(setMissTypes); }, []);
  useEffect(() => { loadRoundLog().then(setRoundLog); }, []);
  useEffect(() => { loadContentSeedLog().then(setSeedLog); }, []);
  useEffect(() => {
    loadWeeklyNotes().then((all) => {
      setNotes(all);
      const key = weekKeyOf();
      if (all[key]) setDraft(all[key].note);
    });
  }, []);

  const report = useMemo(
    () => buildWeeklyReport(history, missTypes, questions, links, Date.now(), roundLog),
    [history, missTypes, questions, links, roundLog]
  );

  // #30：今週追加された問題（contentSeedLog.js）を「今週埋めた手薄科目」として一言候補にする。
  const contentSummary = useMemo(() => {
    const entries = seedEntriesSince(seedLog, weekStartOf());
    const bySubject = new Map();
    for (const e of entries) for (const s of e.bySubject || []) bySubject.set(s.subject, (bySubject.get(s.subject) || 0) + s.count);
    const total = [...bySubject.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    const detail = [...bySubject.entries()].map(([subject, count]) => `${subject}+${count}`).join('・');
    return `今週は${detail}を追加した（計${total}問）。`;
  }, [seedLog]);

  // #5：今週、復習を溜めた（ゼロに戻せなかった）日数
  const reviewStallSummary = useMemo(() => {
    const s = zeroDaysSummary(reviewZeroLog, 7);
    const stalled = s.total - s.achieved;
    if (stalled === 0) return null;
    return `今週は復習を溜めた（ゼロに戻せなかった）日が${stalled}日あった。`;
  }, [reviewZeroLog]);

  // #10：今週、要注意（リーチ）を解消できた件数
  const resolvedLeechSummary = useMemo(() => {
    const n = resolvedLeechesSince(history, weekStartOf());
    if (n === 0) return null;
    return `今週、要注意だった問題を${n}問マスターに導けた。`;
  }, [history]);

  // #25：先週より誤答率が改善した弱点テーマ
  const improvedClusterSummary = useMemo(() => {
    const clusters = weakTagClusters(history, questions, links, { minWrong: 1, limit: 12 });
    const trended = tagTrend(history, questions, links, clusters);
    const better = trended.filter((t) => t.trend === 'better').slice(0, 3);
    if (better.length === 0) return null;
    return `先週より「${better.map((t) => t.tag).join('」「')}」の誤答率が改善した。`;
  }, [history, questions, links]);

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

  const escapeHtml = (s) =>
    String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 印刷（PDF化）：MistakeNote.jsxと同じ「別タブに白背景の印刷用HTMLを開いて自動でwindow.print()」方式。
  // アプリ本体は黒背景×白文字のテーマだが、紙に印刷する時は白背景×黒文字のほうが読みやすく
  // インクの節約にもなるため、CSS変数の反転（index.cssの@media print）とは別に専用HTMLを組み立てる。
  const printJournal = () => {
    const weakTagsHtml = report.weakTags.length
      ? `<div class="sec"><b>今週の弱点テーマ</b><br>${report.weakTags
          .map((t) => `${t.roundCount >= 2 ? '🔥 ' : ''}${escapeHtml(t.tag)}（誤答${t.wrong}）`)
          .join('　')}</div>`
      : '';
    const notesHtml = [{ k: thisWeekKey, n: { note: draft } }, ...pastWeeks.map((k) => ({ k, n: notes[k] }))]
      .filter((e) => e.n && e.n.note)
      .map((e) => `<div class="item"><div class="head">${escapeHtml(formatWeekLabel(e.k))}</div><div>${escapeHtml(e.n.note)}</div></div>`)
      .join('');
    const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>週次の弱点ジャーナル</title>
      <style>
        body{font-family:-apple-system,'Hiragino Kaku Gothic ProN',sans-serif;color:#111;margin:24px;line-height:1.7;}
        h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:6px;}
        .meta{color:#666;font-size:12px;margin-bottom:16px;}
        .sec{margin:10px 0;font-size:13px;}
        .item{border:1px solid #ccc;border-radius:8px;padding:10px 12px;margin-bottom:8px;page-break-inside:avoid;}
        .head{font-size:12px;color:#444;font-weight:700;margin-bottom:4px;}
      </style></head><body>
      <h1>週次の弱点ジャーナル</h1>
      <div class="meta">今週：${escapeHtml(formatWeekLabel(thisWeekKey))} ／ 解答${report.total}問・正答率${formatPercent(report.accuracy)}</div>
      ${weakTagsHtml}
      <div class="sec"><b>方針の記録</b></div>
      ${notesHtml || '<p>まだ記録がありません。</p>'}
      <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
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
            {report.trend && (
              <p className="inline-note" style={{ marginTop: 4 }}>
                最近増えている誤答理由は「{missTypeLabel(report.trend.type)}」です（直近7日で{report.trend.count}件）。
              </p>
            )}
            {report.speedup300 != null && (
              <p className="inline-note" style={{ marginTop: 4, color: report.speedup300 >= 0 ? 'var(--correct)' : undefined }}>
                {report.speedup300 >= 0
                  ? `300問1周の速さが前回より${report.speedup300}%縮んでいます。`
                  : `300問1周の速さが前回より${-report.speedup300}%遅くなっています。`}
              </p>
            )}
            {report.weakTags.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="section-hint">今週の弱点テーマ<span className="section-hint">（🔥＝過去問で複数回出題の頻出テーマ）</span></div>
                <div className="btn-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
                  {report.weakTags.map((t) => (
                    <span className="chip" key={t.tag}>
                      {t.roundCount >= 2 && '🔥 '}{t.tag}（誤答{t.wrong}）
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="section-label">✍️ 来週の方針（一言）</div>
      <div className="card">
        {[contentSummary, reviewStallSummary, resolvedLeechSummary, improvedClusterSummary].filter(Boolean).length > 0 && (
          <div className="chip-row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            {[contentSummary, reviewStallSummary, resolvedLeechSummary, improvedClusterSummary]
              .filter(Boolean)
              .map((summary) => (
                <button
                  key={summary}
                  className="chip"
                  onClick={() => setDraft((d) => (d ? `${d} / ${summary}` : summary))}
                >
                  ＋ {summary}
                </button>
              ))}
          </div>
        )}
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
        <button className="btn ghost sm" onClick={printJournal}>🖨️ 印刷する</button>
      </div>
    </div>
  );
}
