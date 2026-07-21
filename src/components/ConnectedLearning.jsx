import { useEffect, useMemo, useRef, useState } from 'react';
import { dateKey, dailyPick, keywordClusters } from '../lib/connect.js';
import { effectiveTags } from '../lib/query.js';
import {
  suggestKeywords,
  relatedQuestions,
  isolatedReport,
  keywordHeat,
  heatColor,
  graphData,
  circleLayout,
  buildConnectQuiz,
} from '../lib/connectlab.js';
import { fileToDataUrl } from '../lib/image.js';
import PhotoSource from './PhotoSource.jsx';

// 連結学習法（つなげて一生モノの知識に）— 強化版
//   今日 / 地図 / 深掘り / 点検 / クイズ の5つで、知識の地図を育てて試す。

const NOTE_TEMPLATES = [
  { label: '経穴テンプレ', text: '【経絡】\n【部位】\n【要穴分類】\n【主治】\n【つながり】' },
  { label: '病態テンプレ', text: '【定義】\n【原因】\n【主症状】\n【治療・配穴】\n【つながり】' },
  { label: '比較テンプレ', text: '【A】\n【B】\n【ちがい】\n【共通点】' },
];

const TABS = [
  { id: 'daily', label: '今日の1問' },
  { id: 'map', label: '地図' },
  { id: 'depth', label: '深掘り' },
  { id: 'inspect', label: '点検' },
  { id: 'quiz', label: 'クイズ' },
];

export default function ConnectedLearning({ store, onToast, focusKeyword, onConsumeKeyword }) {
  const [tab, setTab] = useState(focusKeyword ? 'depth' : 'daily');
  const [selectedKw, setSelectedKw] = useState(focusKeyword || null);

  useEffect(() => {
    if (focusKeyword) {
      setTab('depth');
      setSelectedKw(focusKeyword);
      const t = setTimeout(() => onConsumeKeyword?.(), 1500);
      return () => clearTimeout(t);
    }
  }, [focusKeyword]); // eslint-disable-line react-hooks/exhaustive-deps

  const openKeyword = (kw) => {
    setSelectedKw(kw);
    setTab('depth');
  };

  return (
    <div className="view">
      <h2 className="view-title">連結学習</h2>
      <p className="view-desc">
        過去問を「点」で終わらせず、知識どうしを<strong>つなげて</strong>一生モノにする学習法です。
        地図を育て、点検し、クイズで試して定着させましょう。
      </p>

      <div className="chip-row">
        {TABS.map((t) => (
          <button key={t.id} className={`chip ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'daily' && <Daily store={store} onToast={onToast} onOpenKeyword={openKeyword} />}
      {tab === 'map' && <GraphMap store={store} onOpenKeyword={openKeyword} />}
      {tab === 'depth' && (
        <Depth store={store} onToast={onToast} selectedKw={selectedKw} setSelectedKw={setSelectedKw} />
      )}
      {tab === 'inspect' && <Inspect store={store} onToast={onToast} onOpenKeyword={openKeyword} />}
      {tab === 'quiz' && <ConnectQuiz store={store} onToast={onToast} />}
    </div>
  );
}

// ===== 今日の1問（深掘り） =====
function Daily({ store, onToast, onOpenKeyword }) {
  const { questions, reviewQuestions, links, setLink, markDeepDive, settings } = store;
  const today = dateKey();
  const pool = reviewQuestions.length > 0 ? reviewQuestions : questions;
  const q = useMemo(() => dailyPick(pool, today), [pool, today]);

  const link = (q && links[q.id]) || { keywords: [], note: '', related: [] };
  const [kwInput, setKwInput] = useState('');
  const [note, setNote] = useState(link.note || '');
  const [showAnswer, setShowAnswer] = useState(false);

  // 深掘り対象が変わったらメモを同期
  useEffect(() => {
    setNote((q && links[q.id]?.note) || '');
    setShowAnswer(false);
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => {
    if (!q) return [];
    const text = `${q.question || ''} ${(q.choices || []).join(' ')} ${q.explanation || ''}`;
    return suggestKeywords(text, link.keywords);
  }, [q?.id, link.keywords]); // eslint-disable-line react-hooks/exhaustive-deps

  const related = useMemo(() => (q ? relatedQuestions(q, questions, links, { limit: 6 }) : []), [q?.id, questions, links]);

  if (!q) {
    return (
      <div className="empty">
        <div className="ico">🧭</div>
        <p>深掘りする問題がありません。</p>
        <p className="inline-note">まずは一問一答や過去問の取り込みから始めましょう。</p>
      </div>
    );
  }

  const addKeyword = (kw) => {
    const k = (kw ?? kwInput).trim();
    if (!k) return;
    if (!link.keywords.includes(k)) setLink(q.id, { keywords: [...link.keywords, k] });
    setKwInput('');
  };
  const removeKeyword = (kw) => setLink(q.id, { keywords: link.keywords.filter((k) => k !== kw) });
  const toggleRelated = (rid) => {
    const cur = link.related || [];
    setLink(q.id, { related: cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid] });
  };
  const insertTemplate = (t) => setNote((n) => (n ? n + '\n' + t : t));
  const saveNote = () => {
    setLink(q.id, { note });
    markDeepDive();
    onToast('今日の深掘りを記録しました');
  };

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
          <span className={`badge ${q.type === 'ox' ? 'ox' : 'choice'}`}>{q.type === 'ox' ? '○×' : '四択'}</span>
          <span className="q-subject">今日の1問 ・ {q.subject}</span>
        </div>
        {q.image && <img className="q-image" src={q.image} alt="問題の図" loading="lazy" />}
        <div className="q-text">{q.question || '（図の問題）'}</div>
        {!showAnswer ? (
          <button className="btn primary block" onClick={() => setShowAnswer(true)}>答えと解説を見る</button>
        ) : (
          <div className="explanation">
            <span className="label">正解</span>
            {q.type === 'ox' ? q.choices[q.answer] : `${q.answer + 1}. ${q.choices[q.answer]}`}
            {q.explanation && (
              <div style={{ marginTop: 8 }}><span className="label">解説</span>{q.explanation}</div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <label className="section-label" style={{ marginTop: 0 }}>🔗 連結ポイント（この知識は何とつながる？）</label>
        <div className="tmpl-row">
          {NOTE_TEMPLATES.map((t) => (
            <button key={t.label} className="btn ghost sm" onClick={() => insertTemplate(t.text)}>＋{t.label}</button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例）合谷＝大腸経の原穴。四総穴の『面口』。→ 他の四総穴（足三里・委中・列缺）と結びつけて覚える"
          style={{ minHeight: 96, marginTop: 8 }}
        />

        <label className="section-label">キーワード（タグでつなぐ）</label>
        <div className="chip-row">
          {link.keywords.map((kw) => (
            <button key={kw} className="chip active" onClick={() => removeKeyword(kw)}>{kw} ✕</button>
          ))}
        </div>
        {suggestions.length > 0 && (
          <div className="suggest-box">
            <span className="suggest-label">候補（タップで追加）：</span>
            <div className="chip-row" style={{ marginBottom: 0 }}>
              {suggestions.map((s) => (
                <button key={s} className="chip suggest" onClick={() => addKeyword(s)}>＋ {s}</button>
              ))}
            </div>
          </div>
        )}
        <div className="kw-add">
          <input
            type="text"
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="自分で入力：四総穴、原穴 など"
          />
          <button className="btn sm" onClick={() => addKeyword()}>追加</button>
        </div>

        {related.length > 0 && (
          <>
            <label className="section-label">関連する問題（自動提案・つなげる）</label>
            {related.map((r) => (
              <label key={r.q.id} className="related-cand">
                <input type="checkbox" checked={(link.related || []).includes(r.q.id)} onChange={() => toggleRelated(r.q.id)} />
                <span>
                  <span className="rel-reason">{r.reason}</span>
                  {r.q.question || '（図の問題）'}
                </span>
              </label>
            ))}
          </>
        )}

        <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={saveNote}>この深掘りを記録する</button>
      </div>
    </>
  );
}

// ===== 地図（ビジュアル・ヒートマップ） =====
function GraphMap({ store, onOpenKeyword }) {
  const { questions, links, history } = store;
  const linkedCount = Object.keys(links).length;
  const { nodes, edges } = useMemo(() => graphData(questions, links, history), [questions, links, history]);
  // 見やすさのため上位24語まで
  const top = useMemo(() => {
    const keep = new Set([...nodes].sort((a, b) => b.count - a.count).slice(0, 24).map((n) => n.id));
    const ns = circleLayout(nodes.filter((n) => keep.has(n.id)));
    const pos = new Map(ns.map((n) => [n.id, n]));
    const es = edges.filter((e) => pos.has(e.source) && pos.has(e.target));
    return { ns, es, pos };
  }, [nodes, edges]);

  if (linkedCount === 0 || nodes.length === 0) {
    return (
      <div className="empty">
        <div className="ico">🗺️</div>
        <p>まだ地図は空っぽです。</p>
        <p className="inline-note">「今日の1問」でキーワードを付けると、ここに知識のつながりが育ちます。</p>
      </div>
    );
  }

  const maxCount = Math.max(...top.ns.map((n) => n.count), 1);

  return (
    <>
      <p className="inline-note">丸をタップすると、その言葉の深掘りページへ。色は正答率（🟢得意・🟡ふつう・🔴苦手・⚪未回答）。</p>
      <div className="graph-wrap">
        <svg viewBox="0 0 100 100" className="graph-svg" preserveAspectRatio="xMidYMid meet">
          {top.es.map((e, i) => {
            const a = top.pos.get(e.source);
            const b = top.pos.get(e.target);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="graph-edge" strokeWidth={Math.min(0.5 + e.weight * 0.3, 1.6)} />;
          })}
          {top.ns.map((n) => {
            const r = 2.4 + (n.count / maxCount) * 3.2;
            return (
              <g key={n.id} className="graph-node" onClick={() => onOpenKeyword(n.id)}>
                <circle cx={n.x} cy={n.y} r={r} fill={heatColor(n.accuracy)} />
                <text x={n.x} y={n.y - r - 0.8} className="graph-label">{n.id}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="inline-note">大きい丸ほど関連問題が多い言葉です。全{nodes.length}語のうち上位{top.ns.length}語を表示。</p>
    </>
  );
}

// ===== 深掘り（キーワード一覧 → 1語まとめ） =====
function Depth({ store, onToast, selectedKw, setSelectedKw }) {
  const { questions, links, history } = store;
  const heat = useMemo(() => keywordHeat(questions, links, history), [questions, links, history]);

  if (selectedKw) {
    return <KeywordDetail store={store} onToast={onToast} keyword={selectedKw} onBack={() => setSelectedKw(null)} />;
  }

  if (heat.length === 0) {
    return (
      <div className="empty">
        <div className="ico">🔍</div>
        <p>まだキーワードがありません。</p>
        <p className="inline-note">「今日の1問」でキーワードを付けると、ここで1語ずつ深掘りできます。</p>
      </div>
    );
  }

  return (
    <>
      <p className="inline-note">言葉をタップすると、関連問題・つながり・語呂合わせをまとめた「1語まとめ」を開けます。</p>
      {heat.map((h) => (
        <button key={h.keyword} className="card kw-list-item" onClick={() => setSelectedKw(h.keyword)}>
          <span className="kw-dot" style={{ background: heatColor(h.accuracy) }} />
          <span className="kw-list-main">
            <span className="kw-list-name">🔗 {h.keyword}</span>
            <span className="kw-list-sub">
              {h.questions.length}問
              {h.accuracy != null && ` ・ 正答率${Math.round(h.accuracy * 100)}%`}
              {h.accuracy == null && ' ・ 未回答'}
            </span>
          </span>
          <span className="kw-list-chev">›</span>
        </button>
      ))}
    </>
  );
}

// 1語まとめ（#4）＋ 語呂合わせ/画像（#9）＋ 連想リコール（#10）
function KeywordDetail({ store, onToast, keyword, onBack }) {
  const { questions, links, history, kwMeta, setKeywordMeta } = store;
  const meta = kwMeta[keyword] || { mnemonic: '', image: '' };
  const [mnemonic, setMnemonic] = useState(meta.mnemonic || '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recall, setRecall] = useState(false); // 連想リコール中は隠す

  useEffect(() => {
    setMnemonic((kwMeta[keyword]?.mnemonic) || '');
    setRecall(false);
  }, [keyword]); // eslint-disable-line react-hooks/exhaustive-deps

  const linked = useMemo(
    () => questions.filter((q) => effectiveTags(q, links).includes(keyword)),
    [questions, links, keyword]
  );
  const relatedKw = useMemo(() => {
    const co = new Map();
    for (const q of linked) {
      for (const t of new Set(effectiveTags(q, links))) {
        if (t !== keyword) co.set(t, (co.get(t) || 0) + 1);
      }
    }
    return [...co.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 8);
  }, [linked, links, keyword]);
  const heat = useMemo(() => keywordHeat(questions, links, history).find((h) => h.keyword === keyword), [questions, links, history, keyword]);

  const saveMnemonic = () => {
    setKeywordMeta(keyword, { mnemonic });
    onToast('語呂合わせを保存しました');
  };
  const addImage = async (files) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const url = await fileToDataUrl(f);
      setKeywordMeta(keyword, { image: url });
      onToast('画像を追加しました');
    } catch (e) {
      onToast('画像の読み込みに失敗しました');
    }
  };
  const removeImage = () => setKeywordMeta(keyword, { image: '' });

  return (
    <>
      <button className="btn ghost sm" onClick={onBack}>‹ 一覧へ</button>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="kwd-head">
          <span className="kwd-title">🔗 {keyword}</span>
          <span className="kwd-stat" style={{ color: heatColor(heat?.accuracy) }}>
            {linked.length}問
            {heat?.accuracy != null ? ` ・ 正答率${Math.round(heat.accuracy * 100)}%` : ' ・ 未回答'}
          </span>
        </div>

        {relatedKw.length > 0 && (
          <div className="kwd-related">
            <span className="suggest-label">つながる言葉：</span>
            {relatedKw.map((k) => (
              <span key={k} className="chip" style={{ marginRight: 6, marginBottom: 6, display: 'inline-block' }}>{k}</span>
            ))}
          </div>
        )}
      </div>

      {/* #10 連想リコール */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>🧠 連想リコール練習</div>
        <p className="inline-note" style={{ marginTop: 0 }}>
          「{keyword}」から思い出せることを、頭の中（または紙）に書き出してから「めくる」で答え合わせ。
        </p>
        {!recall ? (
          <button className="btn primary block" onClick={() => setRecall(true)}>思い出す練習をはじめる</button>
        ) : (
          <button className="btn accent block" onClick={() => setRecall(false)}>めくる（答え合わせ）</button>
        )}
      </div>

      {/* #9 語呂合わせ・イメージ */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>🎴 語呂合わせ・イメージ記憶</div>
        <textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          placeholder="覚え方・語呂合わせを自由に。例）四総穴＝『肚（足三里）・腰（委中）・頭（列缺）・顔（合谷）』"
          style={{ minHeight: 64 }}
        />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn sm" onClick={() => setSheetOpen(true)}>🖼️ 画像を追加</button>
          <button className="btn primary sm" onClick={saveMnemonic}>保存</button>
        </div>
        {meta.image && (
          <div className="kwd-image">
            <img src={meta.image} alt="イメージ記憶" />
            <button className="btn ghost sm" onClick={removeImage}>画像を削除</button>
          </div>
        )}
        <PhotoSource open={sheetOpen} onClose={() => setSheetOpen(false)} onPick={addImage} multiple={false} title="イメージ画像を追加" />
      </div>

      {/* 関連問題（リコール中は隠す） */}
      <div className="section-label">この言葉に関連する問題（{linked.length}）</div>
      {recall ? (
        <div className="card recall-hidden">🙈 思い出せたら「めくる」を押してください。</div>
      ) : (
        linked.map((q) => (
          <div className="card cluster-q-card" key={q.id}>
            <div className="q-subject">{q.subject}</div>
            <div className="cqc-q">{q.question || '（図の問題）'}</div>
            <div className="cqc-a">
              正解：{q.type === 'ox' ? q.choices[q.answer] : `${q.answer + 1}. ${q.choices[q.answer]}`}
            </div>
            {links[q.id]?.note && <div className="cqc-note">🔗 {links[q.id].note}</div>}
          </div>
        ))
      )}
    </>
  );
}

// ===== 点検（孤立ノード検出 #7） =====
function Inspect({ store, onToast, onOpenKeyword }) {
  const { questions, links, setLink } = store;
  const rep = useMemo(() => isolatedReport(questions, links), [questions, links]);
  const [addFor, setAddFor] = useState(null); // 問題ID
  const [kwInput, setKwInput] = useState('');

  const addKw = (q) => {
    const k = kwInput.trim();
    if (!k) return;
    const cur = links[q.id]?.keywords || [];
    if (!cur.includes(k)) setLink(q.id, { keywords: [...cur, k] });
    setKwInput('');
    setAddFor(null);
    onToast(`「${k}」を付けました`);
  };

  const suggestFor = (q) => {
    const text = `${q.question || ''} ${(q.choices || []).join(' ')} ${q.explanation || ''}`;
    return suggestKeywords(text, links[q.id]?.keywords || []).slice(0, 6);
  };

  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="num">{rep.untaggedCount}</div><div className="lbl">キーワード無し</div></div>
        <div className="tile"><div className="num">{rep.singletonCount}</div><div className="lbl">1問だけの語</div></div>
      </div>

      <div className="section-label" style={{ marginTop: 8 }}>キーワードが付いていない問題</div>
      {rep.untagged.length === 0 ? (
        <p className="inline-note">すべての問題にキーワードが付いています。すばらしい！</p>
      ) : (
        rep.untagged.slice(0, 30).map((q) => (
          <div className="card inspect-item" key={q.id}>
            <div className="q-subject">{q.subject}</div>
            <div className="cqc-q">{q.question || '（図の問題）'}</div>
            {addFor === q.id ? (
              <>
                <div className="chip-row" style={{ marginTop: 8, marginBottom: 6 }}>
                  {suggestFor(q).map((s) => (
                    <button key={s} className="chip suggest" onClick={() => { setKwInput(s); }}>＋ {s}</button>
                  ))}
                </div>
                <div className="kw-add">
                  <input type="text" value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addKw(q)} placeholder="キーワード" />
                  <button className="btn sm primary" onClick={() => addKw(q)}>付ける</button>
                </div>
              </>
            ) : (
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { setAddFor(q.id); setKwInput(''); }}>🔗 キーワードを付ける</button>
            )}
          </div>
        ))
      )}

      {rep.singletons.length > 0 && (
        <>
          <div className="section-label">1問だけの言葉（もっとつなげよう）</div>
          <div className="chip-row">
            {rep.singletons.slice(0, 30).map((s) => (
              <button key={s.keyword} className="chip" onClick={() => onOpenKeyword(s.keyword)}>{s.keyword}</button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ===== 連結クイズ（#5） =====
function ConnectQuiz({ store, onToast }) {
  const { questions, links } = store;
  const [items, setItems] = useState(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);

  const start = () => {
    const qz = buildConnectQuiz(questions, links, { max: 8 });
    if (qz.length === 0) {
      onToast('クイズを作るには、同じキーワードの問題を増やしてください');
      return;
    }
    setItems(qz);
    setI(0);
    setPicked(null);
    setScore(0);
  };

  if (!items) {
    return (
      <>
        <p className="inline-note">
          作った知識の地図から、逆にクイズを出題します。「共通するキーワードは？」「仲間はずれは？」で
          <strong>つながり自体</strong>を確認できます。
        </p>
        <button className="btn primary block lg" onClick={start}>連結クイズをはじめる</button>
      </>
    );
  }

  const item = items[i];
  const done = i >= items.length;
  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="q-text">結果：{score} / {items.length} 正解</div>
        <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={start}>もう一度</button>
      </div>
    );
  }

  const choose = (idx) => {
    if (picked != null) return;
    setPicked(idx);
    if (idx === item.answer) setScore((s) => s + 1);
  };
  const next = () => { setPicked(null); setI((x) => x + 1); };

  return (
    <>
      <div className="builder-summary" style={{ margin: '4px 0 10px' }}>{i + 1} / {items.length}</div>
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>{item.prompt}</div>
        {item.type === 'common' && (
          <div className="quiz-qs">
            {item.questions.map((s, k) => (
              <div className="quiz-q" key={k}><span className="cluster-dot" />{s}</div>
            ))}
          </div>
        )}
        <div className="choices" style={{ marginTop: 12 }}>
          {item.options.map((opt, idx) => {
            let cls = 'choice-btn';
            if (picked != null) {
              if (idx === item.answer) cls += ' correct';
              else if (idx === picked) cls += ' wrong';
            }
            return (
              <button key={idx} className={cls} onClick={() => choose(idx)} disabled={picked != null}>
                <span className="mark">{idx + 1}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        {picked != null && (
          <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={next}>
            {i + 1 >= items.length ? '結果を見る' : '次へ'}
          </button>
        )}
      </div>
    </>
  );
}
