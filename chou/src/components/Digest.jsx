import React, { useMemo } from 'react';
import {
  DIGEST_NOTE,
  digestCounts,
  allCorrections,
  allUnverified,
  allWithdrawnAndRumors,
  allConflictTopics,
  CONFLICTS_NOTE,
  SCOPE_NOTES,
  SCOPE_NOTE,
  allSources,
  SOURCES_NOTE,
  crossTopics,
  CROSS_NOTE,
  subjectBreakdown,
  BREAKDOWN_NOTE,
} from '../lib/digest.js';
import useFocusJump from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 横断のまとめ（ユーザー指定・2026-09-03）。
// **この画面は数えて並べるだけ**——中身はそれぞれの画面が単一の正のまま。
// 順位も採点も付けない（README 決まり1・2）。

export default function Digest({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const counts = useMemo(() => digestCounts(), []);
  const corrections = useMemo(() => allCorrections(), []);
  const unverified = useMemo(() => allUnverified(), []);
  const others = useMemo(() => allWithdrawnAndRumors(), []);
  const conflicts = useMemo(() => allConflictTopics(), []);
  const sources = useMemo(() => allSources(), []);
  const topics = useMemo(() => crossTopics(), []);
  const breakdown = useMemo(() => subjectBreakdown(), []);

  const row = (item) => (
    <li key={item.key} id={`digest-${item.kind}-${item.subjectId}-${item.id}`}>
      <strong>{item.title}</strong>
      <span className="muted small">
        {item.subject}／{item.kindLabel}
      </span>
      {item.claim && <span className="muted small">出典：{item.claim}</span>}
      <span className="small">{item.body}</span>
      {item.targetId && (
        <button type="button" className="ghost" onClick={() => onGo(item.view, item.targetId)}>
          元の画面で読む
        </button>
      )}
    </li>
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>まとめて見る</h1>
        <p className="muted">{DIGEST_NOTE}</p>
      </div>

      <div className="notice">
        <p>
          いま集めているもの：訂正 {counts.corrections} 件／裏が取れていない主張 {counts.unverified} 件／
          出典が取り下げた説・出回っているうわさ {counts.withdrawnAndRumors} 件／
          食い違い {counts.conflicts} か所／扱わないこと {counts.scope} 件／出典 {counts.sources} 本。
        </p>
        <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
          受診の目安を見る
        </button>
      </div>

      <section className="block" id="digest-cross">
        <div className="block-head">
          <h2>素材をまたいで出てくる話</h2>
        </div>
        <p className="muted small">{CROSS_NOTE}</p>
        {topics.map((topic) => (
          <div key={topic.id} className="cand" id={`digest-topic-${topic.id}`}>
            <strong>{topic.title}</strong>
            <p className="muted small">{topic.lead}</p>
            <ul className="flags">
              {topic.rows.map((item) => (
                <li key={item.key} id={`digest-topic-${topic.id}-${item.subjectId}-${item.id}`}>
                  <strong>{item.title}</strong>
                  <span className="muted small">
                    {item.subject}／{item.kindLabel}
                  </span>
                  {item.claim && <span className="muted small">出典：{item.claim}</span>}
                  <span className="small">{item.body}</span>
                  {item.targetId && (
                    <button type="button" className="ghost" onClick={() => onGo(item.view, item.targetId)}>
                      元の画面で読む
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="small">{topic.note}</p>
            <button type="button" className="ghost" onClick={() => onGo(topic.link.view, topic.link.targetId)}>
              {topic.link.label}
            </button>
          </div>
        ))}
      </section>

      <section className="block" id="digest-conflicts">
        <div className="block-head">
          <h2>両方そのまま見せているところ</h2>
        </div>
        <p className="muted small">{CONFLICTS_NOTE}</p>
        <ul className="flags">
          {conflicts.map((item) => (
            <li key={item.id} id={`digest-conflict-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">いま {item.count} 件ぶん並べています</span>
              <span className="small">{item.note}</span>
              <button type="button" className="ghost" onClick={() => onGo(item.view, item.targetId)}>
                元の画面で読む
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="digest-corrections">
        <div className="block-head">
          <h2>このアプリが訂正しているところ</h2>
        </div>
        <p className="muted small">
          出典の言い分は消さずに並べたうえで、そのままにできないところに訂正を添えています。
        </p>
        <ul className="flags">{corrections.map(row)}</ul>
      </section>

      <section className="block" id="digest-others">
        <div className="block-head">
          <h2>出典が取り下げた説・出回っているうわさ</h2>
        </div>
        <p className="muted small">
          アプリが訂正したものとは層が違います。取り下げたのは出典自身で、うわさは出典が「そうではない」と説明しているものです。
        </p>
        <ul className="flags">{others.map(row)}</ul>
      </section>

      <section className="block" id="digest-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          隠さずに並べたうえで、1件ずつ「確かめられていない」と添えてあります。数えるだけで、計算にも判定にも使いません。
        </p>
        <ul className="flags">{unverified.map(row)}</ul>
      </section>

      <section className="block" id="digest-scope">
        <div className="block-head">
          <h2>このアプリが扱わないこと</h2>
        </div>
        <p className="muted small">{SCOPE_NOTE}</p>
        <ul className="flags">
          {SCOPE_NOTES.map((item) => (
            <li key={item.id} id={`digest-scope-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="small">{item.body}</span>
              <button type="button" className="ghost" onClick={() => onGo(item.view, item.targetId)}>
                元の画面で読む
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="digest-breakdown">
        <div className="block-head">
          <h2>素材ごとの内訳</h2>
        </div>
        <p className="muted small">{BREAKDOWN_NOTE}</p>
        <ul className="flags">
          {breakdown.map((item) => (
            <li key={item.id} id={`digest-breakdown-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">
                訂正 {item.corrections} 件／裏が取れていない主張 {item.unverified} 件
              </span>
              <button type="button" className="ghost" onClick={() => onGo(item.view)}>
                この画面をひらく
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="digest-sources">
        <div className="block-head">
          <h2>出典の一覧</h2>
        </div>
        <p className="muted small">{SOURCES_NOTE}</p>
        <ul className="flags">
          {sources.map((item) => (
            <li key={item.id} id={`digest-source-${item.id}`}>
              <strong>{item.subject}</strong>
              <span className="small">
                {item.text}
                {item.check && ' ※要確認'}
              </span>
              <span className="muted small">最終確認日：{item.checkedOn}</span>
              <button type="button" className="ghost" onClick={() => onGo(item.view, item.targetId)}>
                元の画面で読む
              </button>
            </li>
          ))}
        </ul>
      </section>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
