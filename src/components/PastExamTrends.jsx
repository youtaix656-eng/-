import { useMemo, useState } from 'react';
import { overview, subjectBreakdown, genreFrequency, tagFrequency, subjectPriority } from '../lib/pastExamTrends.js';
import { formatRound } from '../lib/round.js';

// 鍼灸過去問題の傾向と対策（Home画面から）。
// 収録済みの過去問データ（round・tags・genre）を実際に集計し、頻出テーマ・頻出キーワードを
// データドリブンに可視化する（「感覚」ではなく実データの頻度に基づく）。
export default function PastExamTrends({ store, onStartQuiz, onOpenKeyword }) {
  const { questions, links } = store;
  const ov = useMemo(() => overview(questions), [questions]);
  const bySubject = useMemo(() => subjectBreakdown(questions), [questions]);
  const topGenres = useMemo(() => genreFrequency(questions, { limit: 12 }), [questions]);
  const topTags = useMemo(() => tagFrequency(questions, links, { limit: 20 }), [questions, links]);
  const priority = useMemo(() => subjectPriority(questions, { limit: 6 }), [questions]);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);
  const studyGenre = (g) => {
    const qs = g.questionIds.map((id) => byId[id]).filter(Boolean);
    if (qs.length && onStartQuiz) onStartQuiz(qs);
  };
  const studyTag = (t) => {
    const qs = t.questionIds.map((id) => byId[id]).filter(Boolean);
    if (qs.length && onStartQuiz) onStartQuiz(qs);
  };

  const repeatedGenres = topGenres.filter((g) => g.roundCount >= 2);
  const visibleGenres = showAllGenres ? topGenres : topGenres.slice(0, 6);
  const visibleTags = showAllTags ? topTags : topTags.slice(0, 10);

  if (ov.total === 0) {
    return (
      <div className="view">
        <h2 className="view-title">鍼灸過去問題の傾向と対策</h2>
        <p className="view-desc">
          まだ回（第◯回）付きの過去問データが収録されていません。過去問を教材化して追加すると、
          ここに頻出テーマ・頻出キーワードが自動集計されます。
        </p>
      </div>
    );
  }

  return (
    <div className="view">
      <h2 className="view-title">鍼灸過去問題の傾向と対策</h2>
      <p className="view-desc">
        収録済みの過去問（{ov.rounds.length > 0 ? `${formatRound(ov.rounds[ov.rounds.length - 1])}〜${formatRound(ov.rounds[0])}` : ''}、計{ov.total}問）を実際に集計した頻出テーマ・頻出キーワードです。
        感覚ではなく、収録データそのものに基づく分析です。
      </p>

      <div className="tiles">
        <div className="tile">
          <div className="num">{ov.total}</div>
          <div className="lbl">収録済み過去問（原問）</div>
        </div>
        <div className="tile">
          <div className="num">{ov.rounds.length}</div>
          <div className="lbl">対象回数</div>
        </div>
        <div className="tile">
          <div className="num">{ov.subjectCount}</div>
          <div className="lbl">対象科目数</div>
        </div>
      </div>

      {/* 科目別収録数 */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>科目別の収録数</div>
        <ul className="genre-stats">
          {bySubject.map((s) => {
            const max = bySubject[0]?.count || 1;
            const p = Math.round((s.count / max) * 100);
            return (
              <li key={s.subject}>
                <span className="gs-name">{s.subject}</span>
                <span className="gs-bar"><i style={{ width: `${p}%`, background: 'var(--accent, #4a86d8)' }} /></span>
                <span className="gs-num">{s.count}問</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 頻出ジャンル */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>頻出テーマ（複数回にまたがって出題されているジャンル）</div>
        <p className="inline-note" style={{ marginTop: 0 }}>
          同じジャンル（出題基準の中項目）が何回の試験で出題されているかを集計しています。回数が多いほど「繰り返し狙われるテーマ」です。
        </p>
        {repeatedGenres.length === 0 && (
          <p className="inline-note">まだ複数回にまたがって収録されているジャンルはありません（収録が進むと表示されます）。</p>
        )}
        <ul className="wrong-list">
          {visibleGenres.map((g) => (
            <li key={`${g.subject}|${g.genre}`}>
              <span className="wl-ans">{g.roundCount >= 2 ? `${g.roundCount}回` : `${g.count}問`}</span>
              <span className="wl-q">
                <strong>{g.subject}</strong>｜{g.genre}
                {g.roundCount >= 2 && (
                  <span className="hint" style={{ display: 'block' }}>
                    出題回：{g.rounds.map((r) => formatRound(r)).join('・')}
                  </span>
                )}
              </span>
              <button className="btn ghost sm" onClick={() => studyGenre(g)}>この{g.count}問を解く</button>
            </li>
          ))}
        </ul>
        {topGenres.length > 6 && (
          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => setShowAllGenres((v) => !v)}>
            {showAllGenres ? '折りたたむ' : `もっと見る（残り${topGenres.length - 6}件）`}
          </button>
        )}
      </div>

      {/* 頻出キーワード */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>頻出キーワード</div>
        <p className="inline-note" style={{ marginTop: 0 }}>
          収録済みの過去問に付けたタグ（重要語）を集計。複数回の試験にまたがって登場するキーワードほど優先度が高い目安になります。
        </p>
        <div className="chip-row">
          {visibleTags.map((t) => (
            <button
              key={t.tag}
              className="chip"
              onClick={() => studyTag(t)}
              title={t.roundCount >= 2 ? `出題回：${t.rounds.map((r) => formatRound(r)).join('・')}` : `${t.count}問`}
            >
              {t.tag} <span className="weak-count">{t.roundCount >= 2 ? `${t.roundCount}回` : `×${t.count}`}</span>
            </button>
          ))}
        </div>
        {topTags.length > 10 && (
          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => setShowAllTags((v) => !v)}>
            {showAllTags ? '折りたたむ' : `もっと見る（残り${topTags.length - 10}件）`}
          </button>
        )}
        {onOpenKeyword && visibleTags[0] && (
          <p className="hint" style={{ marginTop: 8 }}>
            キーワードをタップすると、そのキーワードを含む過去問だけを一問一答で解けます。連結学習でさらに深掘りしたい場合は
            <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => onOpenKeyword(visibleTags[0].tag)}>
              「{visibleTags[0].tag}」を連結学習で開く
            </button>
          </p>
        )}
      </div>

      {/* 科目別の優先度 */}
      {priority.length > 0 && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>対策の優先度が高い科目</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            「複数回にまたがって出題されているテーマの数」が多い科目ほど、対策の費用対効果が高い（同じ範囲を繰り返し取られやすい）と考えられます。
          </p>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {priority.map((p) => (
              <li key={p.subject} style={{ marginBottom: 6 }}>
                <strong>{p.subject}</strong>（頻出テーマ{p.repeatedGenreCount}件：{p.topGenres.join('・')} など）
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 学習法への落とし込み */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>この分析をどう学習に活かすか</div>
        <div className="section-label">日々の学習・学習内容</div>
        <ul style={{ margin: '4px 0 10px', paddingLeft: 20 }}>
          <li>上の「頻出テーマ」「頻出キーワード」から優先して一問一答・学習セッションを回す（同じ範囲が繰り返し出ている＝費用対効果が高い）。</li>
          <li>「対策の優先度が高い科目」に学習時間を多めに配分する（3分の2バッファ術の基礎タスクをこの科目に充てるなど）。</li>
          <li>頻出テーマは原問だけでなく、派生の一問一答（角度A〜D）まで解いて周辺知識ごと固める。</li>
        </ul>
        <div className="section-label">音声学習で活かすなら</div>
        <ul style={{ margin: '4px 0 10px', paddingLeft: 20 }}>
          <li>音声学習の検索欄で、上位の頻出キーワードを1つずつ検索して「連結学習モード」で聞き流すと、繰り返し出るテーマを耳から定着させやすい。</li>
          <li>移動時間など「今すぐ手が使えない」場面ほど、1回だけの出題ではなく複数回出ているテーマを優先して聞く。</li>
        </ul>
        <div className="section-label">やるべきこと</div>
        <ul style={{ margin: '4px 0 10px', paddingLeft: 20 }}>
          <li>複数回（2回以上）出ているジャンル・キーワードを最優先で復習する。</li>
          <li>頻出テーマは「原問の正解」だけでなく「なぜ他の選択肢が誤りか」まで説明できるようにする（このアプリの一問一答C鑑別・D確認角度が対応）。</li>
          <li>科目別の収録数・優先度を見て、手薄な科目にも定期的に触れる（網羅マップと併用）。</li>
        </ul>
        <div className="section-label">やってはいけないこと</div>
        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
          <li>1回しか出ていない細かい数値・固有名詞にこだわりすぎて、頻出テーマの復習が後回しになること。</li>
          <li>「感覚的に出そう」で学習範囲を決め、実際の収録データ（このページの集計）を見ずに進めること。</li>
          <li>頻出テーマを1周解いただけで満足し、間隔反復（SRS）による再確認をしないこと。</li>
        </ul>
      </div>
    </div>
  );
}
