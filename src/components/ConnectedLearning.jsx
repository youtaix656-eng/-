import { useMemo, useState } from 'react';
import { dateKey, dailyPick, keywordClusters, relatedPairs } from '../lib/connect.js';

// 連結学習法（つなげて一生モノの知識に）
//  - 今日の1問：日替わりで1問を深掘り。連結ポイント・キーワード・関連問題を記録
//  - 連結マップ：キーワードと問題どうしのつながりを可視化
export default function ConnectedLearning({ store, onToast }) {
  const [tab, setTab] = useState('daily');
  return (
    <div className="view">
      <h2 className="view-title">連結学習</h2>
      <p className="view-desc">
        過去問を「点」で終わらせず、知識どうしを<strong>つなげて</strong>一生モノにする学習法です。
        1日1問の深掘りで、あなただけの知識の地図を育てましょう。
      </p>

      <div className="chip-row">
        <button className={`chip ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
          今日の1問
        </button>
        <button className={`chip ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>
          連結マップ
        </button>
      </div>

      {tab === 'daily' ? (
        <Daily store={store} onToast={onToast} />
      ) : (
        <MapView store={store} />
      )}
    </div>
  );
}

// ===== 今日の1問（深掘り） =====
function Daily({ store, onToast }) {
  const { questions, reviewQuestions, links, setLink, markDeepDive, settings } = store;
  const today = dateKey();

  // 母集団：間違えた問題を優先、無ければ全問
  const pool = reviewQuestions.length > 0 ? reviewQuestions : questions;
  const q = useMemo(() => dailyPick(pool, today), [pool, today]);

  const link = (q && links[q.id]) || { keywords: [], note: '', related: [] };
  const [kwInput, setKwInput] = useState('');
  const [note, setNote] = useState(link.note || '');
  const [showAnswer, setShowAnswer] = useState(false);

  if (!q) {
    return (
      <div className="empty">
        <div className="ico">🧭</div>
        <p>深掘りする問題がありません。</p>
        <p className="inline-note">まずは一問一答や過去問の取り込みから始めましょう。</p>
      </div>
    );
  }

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (!kw) return;
    if (!link.keywords.includes(kw)) {
      setLink(q.id, { keywords: [...link.keywords, kw] });
    }
    setKwInput('');
  };
  const removeKeyword = (kw) =>
    setLink(q.id, { keywords: link.keywords.filter((k) => k !== kw) });

  const saveNote = () => {
    setLink(q.id, { note });
    markDeepDive();
    onToast('今日の深掘りを記録しました');
  };

  const toggleRelated = (rid) => {
    const cur = link.related || [];
    setLink(q.id, {
      related: cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid],
    });
  };

  // 関連候補：同じ科目の他問題（先頭8件）
  const candidates = questions
    .filter((x) => x.id !== q.id && x.subject === q.subject)
    .slice(0, 8);

  const streak = settings.deepDiveStreak || 0;

  return (
    <>
      <div className="streak-banner">
        <span className="streak-fire">🔥</span>
        <div>
          <div className="streak-num">{streak}<span>日連続</span></div>
          <div className="streak-note">
            {settings.lastDeepDive === today ? '今日の深掘りは完了！' : '1日1問、積み重ねよう'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="q-meta">
          <span className={`badge ${q.type === 'ox' ? 'ox' : 'choice'}`}>
            {q.type === 'ox' ? '○×' : '四択'}
          </span>
          <span className="q-subject">今日の1問 ・ {q.subject}</span>
        </div>
        {q.image && <img className="q-image" src={q.image} alt="問題の図" loading="lazy" />}
        <div className="q-text">{q.question || '（図の問題）'}</div>

        {!showAnswer ? (
          <button className="btn primary block" onClick={() => setShowAnswer(true)}>
            答えと解説を見る
          </button>
        ) : (
          <div className="explanation">
            <span className="label">正解</span>
            {q.type === 'ox'
              ? q.choices[q.answer]
              : `${q.answer + 1}. ${q.choices[q.answer]}`}
            {q.explanation && (
              <div style={{ marginTop: 8 }}>
                <span className="label">解説</span>
                {q.explanation}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 連結ポイント */}
      <div className="card">
        <label className="section-label" style={{ marginTop: 0 }}>
          🔗 連結ポイント（この知識は何とつながる？）
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例）合谷＝大腸経の原穴。四総穴の『面口』。歯痛・顔面の症状。→ 経絡の走行や他の四総穴（足三里・委中・列缺）と結びつけて覚える"
          style={{ minHeight: 90 }}
        />

        <label className="section-label">キーワード（タグでつなぐ）</label>
        <div className="chip-row">
          {link.keywords.map((kw) => (
            <button key={kw} className="chip active" onClick={() => removeKeyword(kw)}>
              {kw} ✕
            </button>
          ))}
        </div>
        <div className="kw-add">
          <input
            type="text"
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="例）四総穴、原穴、大腸経"
          />
          <button className="btn sm" onClick={addKeyword}>
            追加
          </button>
        </div>

        {candidates.length > 0 && (
          <>
            <label className="section-label">関連する問題（つなげる）</label>
            {candidates.map((c) => (
              <label key={c.id} className="related-cand">
                <input
                  type="checkbox"
                  checked={(link.related || []).includes(c.id)}
                  onChange={() => toggleRelated(c.id)}
                />
                <span>{c.question || '（図の問題）'}</span>
              </label>
            ))}
          </>
        )}

        <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={saveNote}>
          この深掘りを記録する
        </button>
      </div>

      <p className="inline-note">
        毎日ここを開いて1問を深掘りすると、キーワードで問題どうしがつながり、「連結マップ」に地図が育ちます。
      </p>
    </>
  );
}

// ===== 連結マップ =====
function MapView({ store }) {
  const { questions, links } = store;
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);
  const clusters = useMemo(() => keywordClusters(questions, links), [questions, links]);
  const pairs = useMemo(() => relatedPairs(questions, links), [questions, links]);

  const linkedCount = Object.keys(links).length;

  if (linkedCount === 0) {
    return (
      <div className="empty">
        <div className="ico">🗺️</div>
        <p>まだ地図は空っぽです。</p>
        <p className="inline-note">
          「今日の1問」でキーワードや連結ポイントを記録すると、ここに知識のつながりが育ちます。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="num">{linkedCount}</div>
          <div className="lbl">連結した問題</div>
        </div>
        <div className="tile">
          <div className="num">{clusters.length}</div>
          <div className="lbl">キーワード</div>
        </div>
        <div className="tile">
          <div className="num">{pairs.length}</div>
          <div className="lbl">問題どうしの線</div>
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 0 }}>
        キーワードでつながる知識
      </div>
      {clusters.map((cl) => (
        <div className="card cluster" key={cl.keyword}>
          <div className="cluster-head">
            <span className="cluster-kw">🔗 {cl.keyword}</span>
            <span className="cluster-count">{cl.questionIds.length}問</span>
          </div>
          {cl.questionIds.map((qid) => (
            <div className="cluster-q" key={qid}>
              <span className="cluster-dot" />
              {byId[qid]?.question || '（図の問題）'}
            </div>
          ))}
        </div>
      ))}

      {pairs.length > 0 && (
        <>
          <div className="section-label">直接つないだ問題</div>
          {pairs.map(([a, b], i) => (
            <div className="pair-item" key={i}>
              <div className="pair-q">{byId[a]?.question || '（図）'}</div>
              <div className="pair-link">↔</div>
              <div className="pair-q">{byId[b]?.question || '（図）'}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
