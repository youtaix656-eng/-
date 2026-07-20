import { useMemo, useState } from 'react';
import {
  allSubjects,
  allRounds,
  allTags,
  allDecks,
  filterQuestions,
  searchQuestions,
  buildOrder,
} from '../lib/query.js';

// 出題ビルダー：科目・回次・ジャンル・ファイルや状態で絞り込み、問題数を指定して出題。
// 検索タブでは問題文・選択肢・タグなどを横断検索できる。
export default function Builder({ store, onStartQuiz, onOpenKeyword }) {
  const [tab, setTab] = useState('build');
  return (
    <div className="view">
      <h2 className="view-title">出題を作る</h2>
      <p className="view-desc">
        科目・回次・ジャンル・「間違えた問題」などで絞り込み、問題数を決めて出題できます。
      </p>
      <div className="chip-row">
        <button className={`chip ${tab === 'build' ? 'active' : ''}`} onClick={() => setTab('build')}>
          出題ビルダー
        </button>
        <button className={`chip ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
          検索
        </button>
      </div>
      {tab === 'build' ? (
        <BuildTab store={store} onStartQuiz={onStartQuiz} />
      ) : (
        <SearchTab store={store} onStartQuiz={onStartQuiz} />
      )}
    </div>
  );
}

function Toggle({ items, selected, onToggle, empty }) {
  if (items.length === 0) return <div className="inline-note">{empty}</div>;
  return (
    <div className="chip-row">
      {items.map((it) => (
        <button
          key={it}
          className={`chip ${selected.includes(it) ? 'active' : ''}`}
          onClick={() => onToggle(it)}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

function BuildTab({ store, onStartQuiz }) {
  const { questions, srs, links } = store;
  const subjects = useMemo(() => allSubjects(questions), [questions]);
  const rounds = useMemo(() => allRounds(questions), [questions]);
  const tags = useMemo(() => allTags(questions, links), [questions, links]);
  const decks = useMemo(() => allDecks(questions), [questions]);

  const [selSubjects, setSelSubjects] = useState([]);
  const [selRounds, setSelRounds] = useState([]);
  const [selTags, setSelTags] = useState([]);
  const [selDecks, setSelDecks] = useState([]);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [onlyTagged, setOnlyTagged] = useState(false);
  const [count, setCount] = useState(0); // 0 = すべて
  const [random, setRandom] = useState(true);

  const toggle = (setter) => (v) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const pool = useMemo(
    () =>
      filterQuestions(questions, {
        subjects: selSubjects,
        rounds: selRounds,
        tags: selTags,
        decks: selDecks,
        onlyWrong,
        onlyTagged,
        srs,
        links,
      }),
    [questions, selSubjects, selRounds, selTags, selDecks, onlyWrong, onlyTagged, srs, links]
  );

  const start = () => {
    if (pool.length === 0) return;
    const order = buildOrder(pool, { count, random });
    onStartQuiz(order);
  };

  const countOptions = [
    { label: '10問', v: 10 },
    { label: '20問', v: 20 },
    { label: '50問', v: 50 },
    { label: '100問', v: 100 },
    { label: 'すべて', v: 0 },
  ];
  const effectiveCount = count === 0 ? pool.length : Math.min(count, pool.length);

  return (
    <>
      <div className="card">
        <label className="section-label" style={{ marginTop: 0 }}>科目</label>
        <Toggle items={subjects} selected={selSubjects} onToggle={toggle(setSelSubjects)} empty="科目がありません" />

        <label className="section-label">回次（第何回）</label>
        <Toggle items={rounds} selected={selRounds} onToggle={toggle(setSelRounds)}
          empty="回次データがありません（CSVの「回」列で指定できます）" />

        <label className="section-label">ジャンル / タグ</label>
        <Toggle items={tags} selected={selTags} onToggle={toggle(setSelTags)}
          empty="タグがありません（連結学習やCSVの「ジャンル」列で付けられます）" />

        {decks.length > 0 && (
          <>
            <label className="section-label">ファイル</label>
            <Toggle items={decks} selected={selDecks} onToggle={toggle(setSelDecks)} empty="" />
          </>
        )}

        <label className="switch-row" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
          <span>間違えた問題だけ<small>復習が必要な問題に絞る</small></span>
        </label>
        <label className="switch-row" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={onlyTagged} onChange={(e) => setOnlyTagged(e.target.checked)} />
          <span>タグ付けした問題だけ<small>ジャンル・連結キーワードが付いた問題</small></span>
        </label>
      </div>

      <div className="card">
        <label className="section-label" style={{ marginTop: 0 }}>出題数</label>
        <div className="chip-row">
          {countOptions.map((o) => (
            <button key={o.label} className={`chip ${count === o.v ? 'active' : ''}`} onClick={() => setCount(o.v)}>
              {o.label}
            </button>
          ))}
        </div>
        <label className="switch-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} />
          <span>ランダムに出題<small>オフにすると収録順で出題</small></span>
        </label>

        <div className="builder-summary">
          対象 <strong>{pool.length}</strong> 問中 <strong>{effectiveCount}</strong> 問を出題
        </div>
        <button className="btn primary block lg" onClick={start} disabled={pool.length === 0}>
          この条件で出題する
        </button>
      </div>
    </>
  );
}

function SearchTab({ store, onStartQuiz }) {
  const { questions, links } = store;
  const [term, setTerm] = useState('');
  const results = useMemo(() => searchQuestions(questions, term, links), [questions, term, links]);

  return (
    <>
      <div className="card">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="問題文・選択肢・科目・タグを検索"
          autoFocus
        />
        {term && (
          <div className="builder-summary" style={{ marginBottom: 0 }}>
            {results.length} 件ヒット
            {results.length > 0 && (
              <button className="btn accent sm" style={{ marginLeft: 10 }} onClick={() => onStartQuiz(results)}>
                この{results.length}問を解く
              </button>
            )}
          </div>
        )}
      </div>

      {results.map((q) => (
        <div className="list-item" key={q.id}>
          <div className="li-subject">
            {q.subject}
            {q.round ? ` ・ ${q.round}` : ''}
          </div>
          <div className="li-q">{q.question || '（図の問題）'}</div>
        </div>
      ))}
      {term && results.length === 0 && (
        <div className="empty">
          <div className="ico">🔍</div>
          <p>該当する問題がありません。</p>
        </div>
      )}
    </>
  );
}
