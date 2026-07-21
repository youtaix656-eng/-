import { useEffect, useMemo, useState } from 'react';
import { dateKey, dailyPick } from '../lib/connect.js';
import { effectiveTags } from '../lib/query.js';
import {
  buildTermDict,
  suggestKeywords,
  bulkAutoTagPlan,
  detectVariantPairs,
  isolatedReport,
  keywordHeat,
  heatColor,
  buildConnectQuiz,
} from '../lib/connectlab.js';

// 連結学習法（つなげて一生モノの知識に）— 改善版
//   今日の1問 / 深掘り（1語まとめ＋整理＋ヒートマップ）/ 点検（一括タグ）/ クイズ（復習連動）
//   ・キーワード自動提案は全13科目＋自分辞書に対応
//   ・表記ゆれは「統合・改名」でまとめられる
//   ・クイズとリコールの結果は復習（正答率）に反映される

const NOTE_TEMPLATES = [
  { label: '経穴テンプレ', text: '【経絡】\n【部位】\n【要穴分類】\n【主治】\n【つながり】' },
  { label: '病態テンプレ', text: '【定義】\n【原因】\n【主症状】\n【治療・配穴】\n【つながり】' },
  { label: '比較テンプレ', text: '【A】\n【B】\n【ちがい】\n【共通点】' },
];

const TABS = [
  { id: 'daily', label: '今日の1問' },
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

      {tab === 'daily' && <Daily store={store} onToast={onToast} />}
      {tab === 'depth' && (
        <Depth store={store} onToast={onToast} selectedKw={selectedKw} setSelectedKw={setSelectedKw} />
      )}
      {tab === 'inspect' && <Inspect store={store} onToast={onToast} onOpenKeyword={openKeyword} />}
      {tab === 'quiz' && <ConnectQuiz store={store} onToast={onToast} />}
    </div>
  );
}

// ===== 今日の1問 =====
function Daily({ store, onToast }) {
  const { questions, reviewQuestions, links, setLink, markDeepDive, settings, userDict } = store;
  const today = dateKey();
  const pool = reviewQuestions.length > 0 ? reviewQuestions : questions;
  const q = useMemo(() => dailyPick(pool, today), [pool, today]);
  const dict = useMemo(() => buildTermDict(userDict), [userDict]);

  const link = (q && links[q.id]) || { keywords: [], note: '', related: [] };
  const [kwInput, setKwInput] = useState('');
  const [note, setNote] = useState(link.note || '');
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setNote((q && links[q.id]?.note) || '');
    setShowAnswer(false);
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => {
    if (!q) return [];
    const text = `${q.question || ''} ${(q.choices || []).join(' ')} ${q.explanation || ''}`;
    return suggestKeywords(text, link.keywords, dict);
  }, [q?.id, link.keywords, dict]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {q.explanation && <div style={{ marginTop: 8 }}><span className="label">解説</span>{q.explanation}</div>}
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

        <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={saveNote}>この深掘りを記録する</button>
      </div>
    </>
  );
}

// ===== 深掘り（一覧＝ヒートマップ ＋ 整理 ＋ 1語まとめ） =====
function Depth({ store, onToast, selectedKw, setSelectedKw }) {
  const { questions, links, history, renameKeyword } = store;
  const heat = useMemo(() => keywordHeat(questions, links, history), [questions, links, history]);
  const allKw = useMemo(() => heat.map((h) => h.keyword), [heat]);
  const variants = useMemo(() => detectVariantPairs(allKw), [allKw]);
  const [showTidy, setShowTidy] = useState(false);

  if (selectedKw) {
    return (
      <KeywordDetail
        store={store}
        onToast={onToast}
        keyword={selectedKw}
        allKw={allKw}
        onBack={() => setSelectedKw(null)}
        onGoKeyword={(k) => setSelectedKw(k)}
      />
    );
  }

  if (heat.length === 0) {
    return (
      <div className="empty">
        <div className="ico">🔍</div>
        <p>まだキーワードがありません。</p>
        <p className="inline-note">「今日の1問」でキーワードを付けるか、「点検」で一括タグ付けから始めましょう。</p>
      </div>
    );
  }

  const mergeVariant = (v) => {
    v.variants.forEach((name) => {
      if (name !== v.canonical) renameKeyword(name, v.canonical);
    });
    onToast(`「${v.canonical}」にまとめました`);
  };

  return (
    <>
      {/* 表記ゆれの自動検出 → まとめる */}
      {variants.length > 0 && (
        <div className="card tidy-suggest">
          <div className="section-label" style={{ marginTop: 0 }}>🧹 表記ゆれが見つかりました</div>
          {variants.map((v) => (
            <div key={v.canonical} className="tidy-row">
              <span className="tidy-vars">{v.variants.join(' ・ ')}</span>
              <button className="btn accent sm" onClick={() => mergeVariant(v)}>「{v.canonical}」にまとめる</button>
            </div>
          ))}
        </div>
      )}

      <div className="section-label" style={{ marginTop: 0 }}>
        キーワード（{heat.length}）
        <button className="btn ghost sm" style={{ float: 'right' }} onClick={() => setShowTidy((v) => !v)}>
          {showTidy ? '整理を閉じる' : '🧹 整理'}
        </button>
      </div>
      {showTidy && (
        <p className="inline-note">各キーワードを開くと、名前の変更や他の語への統合ができます。</p>
      )}

      {heat.map((h) => (
        <button key={h.keyword} className="card kw-list-item" onClick={() => setSelectedKw(h.keyword)}>
          <span className="kw-dot" style={{ background: heatColor(h.accuracy) }} />
          <span className="kw-list-main">
            <span className="kw-list-name">🔗 {h.keyword}</span>
            <span className="kw-list-sub">
              {h.questions.length}問
              {h.accuracy != null ? ` ・ 正答率${Math.round(h.accuracy * 100)}%` : ' ・ 未回答'}
            </span>
          </span>
          <span className="kw-list-chev">›</span>
        </button>
      ))}
    </>
  );
}

// 1語まとめ ＋ 語呂合わせ ＋ 連想リコール(復習連動) ＋ 改名/統合
function KeywordDetail({ store, onToast, keyword, allKw, onBack, onGoKeyword }) {
  const { questions, links, history, kwMeta, setKeywordMeta, renameKeyword, recordAnswer } = store;
  const meta = kwMeta[keyword] || { mnemonic: '' };
  const [mnemonic, setMnemonic] = useState(meta.mnemonic || '');
  const [recall, setRecall] = useState(false);
  const [renameTo, setRenameTo] = useState('');
  const [mergeInto, setMergeInto] = useState('');

  useEffect(() => {
    setMnemonic((kwMeta[keyword]?.mnemonic) || '');
    setRecall(false);
    setRenameTo('');
    setMergeInto('');
  }, [keyword]); // eslint-disable-line react-hooks/exhaustive-deps

  const linked = useMemo(
    () => questions.filter((q) => effectiveTags(q, links).includes(keyword)),
    [questions, links, keyword]
  );
  const relatedKw = useMemo(() => {
    const co = new Map();
    for (const q of linked) {
      for (const t of new Set(effectiveTags(q, links))) if (t !== keyword) co.set(t, (co.get(t) || 0) + 1);
    }
    return [...co.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 8);
  }, [linked, links, keyword]);
  const heat = useMemo(
    () => keywordHeat(questions, links, history).find((h) => h.keyword === keyword),
    [questions, links, history, keyword]
  );

  const saveMnemonic = () => {
    setKeywordMeta(keyword, { mnemonic });
    onToast('語呂合わせを保存しました');
  };
  const doRename = () => {
    const to = renameTo.trim();
    if (!to || to === keyword) return;
    renameKeyword(keyword, to);
    onToast(`「${to}」に名前を変更しました`);
    onGoKeyword(to);
  };
  const doMerge = () => {
    if (!mergeInto || mergeInto === keyword) return;
    renameKeyword(keyword, mergeInto);
    onToast(`「${mergeInto}」に統合しました`);
    onGoKeyword(mergeInto);
  };
  // #10 リコールの自己採点 → 復習(正答率)に反映
  const rateRecall = (ok) => {
    linked.forEach((q) => recordAnswer(q, ok));
    setRecall(false);
    onToast(ok ? '「覚えていた」を記録（復習に反映）' : '「あやふや」を記録（復習に追加）');
  };

  return (
    <>
      <button className="btn ghost sm" onClick={onBack}>‹ 一覧へ</button>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="kwd-head">
          <span className="kwd-title">🔗 {keyword}</span>
          <span className="kwd-stat" style={{ color: heatColor(heat?.accuracy) }}>
            {linked.length}問{heat?.accuracy != null ? ` ・ 正答率${Math.round(heat.accuracy * 100)}%` : ' ・ 未回答'}
          </span>
        </div>
        {relatedKw.length > 0 && (
          <div className="kwd-related">
            <span className="suggest-label">つながる言葉：</span>
            {relatedKw.map((k) => (
              <button key={k} className="chip" style={{ marginRight: 6, marginBottom: 6 }} onClick={() => onGoKeyword(k)}>{k}</button>
            ))}
          </div>
        )}
      </div>

      {/* 連想リコール（復習連動） */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>🧠 連想リコール練習</div>
        <p className="inline-note" style={{ marginTop: 0 }}>
          「{keyword}」から思い出せることを書き出してから「めくる」。自己採点は復習（正答率）に反映されます。
        </p>
        {!recall ? (
          <button className="btn primary block" onClick={() => setRecall(true)}>思い出す練習をはじめる</button>
        ) : (
          <div className="btn-row">
            <button className="btn ok-btn" onClick={() => rateRecall(true)}>⭕ 覚えていた</button>
            <button className="btn ng-btn" onClick={() => rateRecall(false)}>❌ あやふや</button>
          </div>
        )}
      </div>

      {/* 語呂合わせ */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>🎴 語呂合わせ・覚え方</div>
        <textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          placeholder="覚え方・語呂合わせを自由に。例）四総穴＝『肚（足三里）・腰（委中）・頭（列缺）・顔（合谷）』"
          style={{ minHeight: 64 }}
        />
        <button className="btn primary sm" style={{ marginTop: 8 }} onClick={saveMnemonic}>保存</button>
      </div>

      {/* 整理：改名・統合 */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>🧹 整理（名前の変更・統合）</div>
        <div className="kw-add">
          <input type="text" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} placeholder="新しい名前に変更" />
          <button className="btn sm" onClick={doRename}>改名</button>
        </div>
        {allKw.length > 1 && (
          <div className="kw-add" style={{ marginTop: 8 }}>
            <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              <option value="">別の語に統合…</option>
              {allKw.filter((k) => k !== keyword).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <button className="btn sm" onClick={doMerge}>統合</button>
          </div>
        )}
      </div>

      {/* 関連問題 */}
      <div className="section-label">この言葉に関連する問題（{linked.length}）</div>
      {recall ? (
        <div className="card recall-hidden">🙈 思い出せたら「覚えていた／あやふや」で自己採点してください。</div>
      ) : (
        linked.map((q) => (
          <div className="card cluster-q-card" key={q.id}>
            <div className="q-subject">{q.subject}</div>
            <div className="cqc-q">{q.question || '（図の問題）'}</div>
            <div className="cqc-a">正解：{q.type === 'ox' ? q.choices[q.answer] : `${q.answer + 1}. ${q.choices[q.answer]}`}</div>
            {links[q.id]?.note && <div className="cqc-note">🔗 {links[q.id].note}</div>}
          </div>
        ))
      )}
    </>
  );
}

// ===== 点検（孤立検出 ＋ 一括自動タグ ＋ 自分辞書） =====
function Inspect({ store, onToast, onOpenKeyword }) {
  const { questions, links, setLink, bulkTag, userDict, addUserTerm } = store;
  const dict = useMemo(() => buildTermDict(userDict), [userDict]);
  const rep = useMemo(() => isolatedReport(questions, links), [questions, links]);
  const autoPlan = useMemo(
    () => bulkAutoTagPlan(questions, links, { onlyUntagged: true, perQuestion: 2, termDict: dict }),
    [questions, links, dict]
  );
  const [addFor, setAddFor] = useState(null);
  const [kwInput, setKwInput] = useState('');
  const [termInput, setTermInput] = useState('');

  const addKw = (q) => {
    const k = kwInput.trim();
    if (!k) return;
    const cur = links[q.id]?.keywords || [];
    if (!cur.includes(k)) setLink(q.id, { keywords: [...cur, k] });
    setKwInput('');
    setAddFor(null);
    onToast(`「${k}」を付けました`);
  };
  const suggestFor = (q) =>
    suggestKeywords(`${q.question || ''} ${(q.choices || []).join(' ')} ${q.explanation || ''}`, links[q.id]?.keywords || [], dict).slice(0, 6);
  const runBulk = () => {
    if (autoPlan.length === 0) return;
    bulkTag(autoPlan);
    onToast(`${autoPlan.length}問に候補キーワードを付けました`);
  };
  const addTerm = () => {
    const t = termInput.trim();
    if (!t) return;
    addUserTerm(t);
    setTermInput('');
    onToast(`「${t}」を候補辞書に追加しました`);
  };

  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="num">{rep.untaggedCount}</div><div className="lbl">キーワード無し</div></div>
        <div className="tile"><div className="num">{rep.singletonCount}</div><div className="lbl">1問だけの語</div></div>
      </div>

      {autoPlan.length > 0 && (
        <div className="card" style={{ background: 'rgba(63,157,176,0.12)', borderColor: 'var(--accent)' }}>
          <div className="section-label" style={{ marginTop: 0 }}>🏷 一括で自動タグ付け</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            キーワードが無い <strong>{autoPlan.length}問</strong> に、本文から拾った候補を自動で付けます（あとで各問で編集できます）。
          </p>
          <button className="btn primary block" onClick={runBulk}>{autoPlan.length}問にまとめて付ける</button>
        </div>
      )}

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>📚 候補辞書に用語を追加</div>
        <p className="inline-note" style={{ marginTop: 0 }}>自動提案に出したい自分の用語を登録できます（現在 {userDict.length} 語）。</p>
        <div className="kw-add">
          <input type="text" value={termInput} onChange={(e) => setTermInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTerm()} placeholder="例）募穴、井穴 など" />
          <button className="btn sm" onClick={addTerm}>追加</button>
        </div>
      </div>

      <div className="section-label">キーワードが付いていない問題</div>
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
                    <button key={s} className="chip suggest" onClick={() => setKwInput(s)}>＋ {s}</button>
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

// ===== 連結クイズ（復習連動） =====
function ConnectQuiz({ store, onToast }) {
  const { questions, links, recordAnswer } = store;
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);
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
          <strong>つながり自体</strong>を確認。<strong>回答は復習（正答率）に反映</strong>されます。
        </p>
        <button className="btn primary block lg" onClick={start}>連結クイズをはじめる</button>
      </>
    );
  }

  const item = items[i];
  if (i >= items.length) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="q-text">結果：{score} / {items.length} 正解</div>
        <p className="inline-note">結果は各キーワードの正答率に反映されました。</p>
        <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={start}>もう一度</button>
      </div>
    );
  }

  const choose = (idx) => {
    if (picked != null) return;
    setPicked(idx);
    const correct = idx === item.answer;
    if (correct) setScore((s) => s + 1);
    // 復習連動：関係する問題を正誤として記録
    (item.qids || []).forEach((qid) => {
      if (byId[qid]) recordAnswer(byId[qid], correct);
    });
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
