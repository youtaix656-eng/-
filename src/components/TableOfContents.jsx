import { useMemo, useState } from 'react';
import { effectiveTags } from '../lib/query.js';

// 目次：取り込んだ問題集を「科目 → キーワード」で一覧化。
//   タップでその範囲を出題（連結学習のキーワードとも連動）。
export default function TableOfContents({ store, onStartQuiz, onOpenKeyword }) {
  const { questions, links } = store;
  const [open, setOpen] = useState({});

  const toc = useMemo(() => {
    const bySub = new Map();
    for (const q of questions) {
      const sub = q.subject || 'その他';
      if (!bySub.has(sub)) bySub.set(sub, { subject: sub, questions: [], kw: new Map() });
      const e = bySub.get(sub);
      e.questions.push(q);
      for (const t of new Set(effectiveTags(q, links))) {
        if (!e.kw.has(t)) e.kw.set(t, []);
        e.kw.get(t).push(q);
      }
    }
    return [...bySub.values()]
      .map((e) => ({
        ...e,
        keywords: [...e.kw.entries()].map(([keyword, qs]) => ({ keyword, questions: qs })).sort((a, b) => b.questions.length - a.questions.length),
      }))
      .sort((a, b) => b.questions.length - a.questions.length);
  }, [questions, links]);

  const totalKw = useMemo(() => {
    const s = new Set();
    for (const q of questions) for (const t of effectiveTags(q, links)) s.add(t);
    return s.size;
  }, [questions, links]);

  const study = (list) => {
    if (list.length) onStartQuiz(list);
  };

  return (
    <div className="view">
      <h2 className="view-title">目次</h2>
      <p className="view-desc">
        取り込んだ問題を「科目 → キーワード」で一覧にしました。気になる範囲をタップして、そのまま演習できます。
      </p>

      <div className="tiles">
        <div className="tile"><div className="num">{questions.length}</div><div className="lbl">問題</div></div>
        <div className="tile"><div className="num">{toc.length}</div><div className="lbl">科目</div></div>
        <div className="tile"><div className="num">{totalKw}</div><div className="lbl">キーワード</div></div>
      </div>

      {toc.map((sec) => (
        <div className="card toc-sec" key={sec.subject}>
          <div className="toc-head" onClick={() => setOpen((o) => ({ ...o, [sec.subject]: !o[sec.subject] }))}>
            <span className="toc-sub">📘 {sec.subject}</span>
            <span className="toc-count">{sec.questions.length}問</span>
            <span className="kw-list-chev">{open[sec.subject] ? '﹀' : '›'}</span>
          </div>
          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => study(sec.questions)}>
            この科目をまとめて解く（{sec.questions.length}問）
          </button>
          {open[sec.subject] && (
            <div className="toc-kws">
              {sec.keywords.length === 0 ? (
                <p className="inline-note">キーワード未設定。「点検」で一括タグ付けできます。</p>
              ) : (
                sec.keywords.map((k) => (
                  <div className="toc-kw-row" key={k.keyword}>
                    <button className="toc-kw-study" onClick={() => study(k.questions)}>
                      <span className="toc-kw-name">🔗 {k.keyword}</span>
                      <span className="toc-kw-count">{k.questions.length}問</span>
                    </button>
                    <button className="btn ghost sm" onClick={() => onOpenKeyword?.(k.keyword)}>深掘り</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {questions.length === 0 && (
        <p className="inline-note">まだ問題がありません。「問題を取り込む」から追加しましょう。</p>
      )}
    </div>
  );
}
