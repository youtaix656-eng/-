import { useEffect, useMemo, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import { GRADES, isInReview } from '../lib/srs.js';
import { getSubjects } from '../lib/stats.js';
import { subjectMatches } from '../data/examScope.js';
import { effectiveTags } from '../lib/query.js';

const uniqJa = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));

// 学習セッション（60/300/900）
//   60問＝1セット（休憩の区切り） / 300問＝1日の基本目標 / 900問＝1周
//   1問ごとに位置を自動保存し、アプリを閉じても「続きから」再開できる。
const SET_SIZE = 60;
const TARGETS = [10, 60, 300, 900];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 原問と派生（同じ過去問由来）を離す（#2）。id末尾の枝記号を除いた基幹idでバケット分割し、
// ラウンドロビンで並べて同一由来が隣り合わないようにする。
const baseId = (id) => String(id).replace(/[a-z]+$/i, '');
function spaceById(ids) {
  if (ids.length < 3) return ids;
  const buckets = new Map();
  for (const id of ids) { const b = baseId(id); if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(id); }
  if (buckets.size < 2) return ids;
  const lists = shuffle([...buckets.values()]);
  const out = [];
  let more = true;
  while (more) {
    more = false;
    for (const l of lists) { if (l.length) { out.push(l.shift()); more = true; } }
  }
  return out;
}
function poolFor(questions, subject) {
  if (subject === 'all') return questions;
  const exact = questions.filter((q) => q.subject === subject);
  if (exact.length) return exact;
  return questions.filter((q) => subjectMatches(q.subject, { name: subject }));
}
// pool を繰り返して target 長の出題順（id 配列）を作る
function buildOrder(pool, target) {
  if (pool.length === 0) return [];
  let ids = [];
  while (ids.length < target) ids = ids.concat(shuffle(pool).map((q) => q.id));
  return spaceById(ids.slice(0, target));
}
// 「すべて新規」用：未着手（未解答）の問題だけを出題順にする。
//   過去に解いた問題は混ぜず、繰り返しもしない（残り新規が尽きたらそこで終了）。
function buildNewOnlyOrder(pool, target, srs) {
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  return spaceById(shuffle(newPool).map((q) => q.id).slice(0, target));
}
// 指定プールを「新規◯割・復習◯割」で混ぜて target 長の出題順を作る。
// newRatio: 0〜1（1=すべて新規）。新規＝未着手、復習＝要復習の問題。
function buildMixedOrder(pool, target, newRatio, srs) {
  if (pool.length === 0) return [];
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  const reviewPool = pool.filter((q) => isInReview(srs[q.id]));
  // どちらかが空なら、その分をもう一方（無ければ全体）で補う
  const fill = (base, count) => {
    if (count <= 0) return [];
    const src = base.length ? base : pool;
    let ids = [];
    while (ids.length < count) ids = ids.concat(shuffle(src).map((q) => q.id));
    return ids.slice(0, count);
  };
  const newCount = Math.round(target * Math.min(1, Math.max(0, newRatio)));
  const reviewCount = target - newCount;
  const combined = [...fill(newPool, newCount), ...fill(reviewPool, reviewCount)];
  return spaceById(shuffle(combined).slice(0, target));
}

export default function Session({ store, onToast, onOpenKeyword, onGoReview }) {
  const { questions, srs, session, startSession, updateSession, clearSession, memos, setMemo, links, setLink, recordAnswer, settings, updateSettings, bookmarks, toggleBookmark } = store;
  const subjects = useMemo(() => getSubjects(questions), [questions]);
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);

  const [subject, setSubject] = useState('all');
  const [genre, setGenre] = useState('');
  const [keyword, setKeyword] = useState('');
  const [term, setTerm] = useState('');
  const [fast, setFast] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // 新規◯割・復習◯割（0〜100の新規%）。既定は設定値。
  const [newPct, setNewPct] = useState(Math.round((settings.sessionNewRatio ?? 1) * 100));

  // 検索（科目→ジャンル→キーワード の段階しぼり＋フリーワード）
  const afterSubject = useMemo(() => (subject === 'all' ? questions : poolFor(questions, subject)), [questions, subject]);
  const genreOptions = useMemo(() => uniqJa(afterSubject.flatMap((q) => (q.genre ? [q.genre] : []))), [afterSubject]);
  const afterGenre = useMemo(() => (genre ? afterSubject.filter((q) => q.genre === genre) : afterSubject), [afterSubject, genre]);
  const kwOptions = useMemo(() => uniqJa(afterGenre.flatMap((q) => effectiveTags(q, links))), [afterGenre, links]);
  const afterKw = useMemo(() => (keyword ? afterGenre.filter((q) => effectiveTags(q, links).includes(keyword)) : afterGenre), [afterGenre, keyword, links]);
  const filteredPool = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return afterKw;
    return afterKw.filter((q) => {
      const hay = [q.question, q.subject, q.round, ...(q.choices || []), q.explanation, ...effectiveTags(q, links)].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(t);
    });
  }, [afterKw, term, links]);

  // 現在の条件で「まだ解いていない新規問題」が何問残っているか
  //   新規＝未着手（srs.seen が 0 または未登録）。buildMixedOrder の newPool と同じ定義。
  const newRemaining = useMemo(
    () => filteredPool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0).length,
    [filteredPool, srs]
  );

  // 上位を変えたら下位をリセット
  useEffect(() => { setGenre(''); setKeyword(''); }, [subject]);
  useEffect(() => { setKeyword(''); }, [genre]);

  const begin = (target, opts = {}) => {
    const pool = opts.pool || filteredPool;
    const subj = opts.subject != null ? opts.subject : subject;
    const round = opts.round || 1;
    const useFast = opts.fast != null ? opts.fast : fast;
    const ratio = opts.newRatio != null ? opts.newRatio : newPct / 100;
    if (pool.length === 0) {
      onToast?.('条件に合う問題がありません');
      return;
    }
    // 「すべて新規(100%)」は未着手の問題だけを出題（過去に解いた問題は混ぜない・周回しない）。
    // opts.allowSeen（2周目・もう一度）のときは従来通り全体を周回する。
    let ids;
    if (ratio >= 1 && !opts.allowSeen) {
      ids = buildNewOnlyOrder(pool, target, srs);
      if (ids.length === 0) {
        onToast?.('新規問題がありません（この条件はすべて解き終えています）。割合を下げて復習するか、条件を変えてください');
        return;
      }
    } else if (ratio >= 1) {
      ids = buildOrder(pool, target);
    } else {
      ids = buildMixedOrder(pool, target, ratio, srs);
    }
    // 新規が指定問数に満たない場合は、その問数だけで1セッションとする
    const effTarget = Math.min(target, ids.length);
    updateSettings({ sessionNewRatio: ratio });
    startSession({ subject: subj, label: opts.label, ids, pos: 0, target: effTarget, round, fast: useFast, newRatio: ratio, startedAt: Date.now() });
    setShowBreak(false);
  };
  // 続きから（同じ科目でプールを作り直して再開位置は保持）
  const beginFromScratch = () => {
    const pool = poolFor(questions, session.subject);
    if (pool.length === 0) { onToast?.('この科目の問題がありません'); return; }
    const ratio = session.newRatio != null ? session.newRatio : 1;
    let ids;
    if (ratio >= 1) {
      ids = buildNewOnlyOrder(pool, session.target, srs);
      if (ids.length === 0) { onToast?.('新規問題がありません（すべて解き終えています）。復習をご利用ください'); return; }
    } else {
      ids = buildMixedOrder(pool, session.target, ratio, srs);
    }
    const effTarget = Math.min(session.target, ids.length);
    startSession({ ...session, ids, pos: 0, target: effTarget, startedAt: Date.now() });
    setShowBreak(false);
  };

  // 学習のリセット（進行中の学習セッションを破棄して開始画面へ戻す）
  const doReset = () => {
    clearSession();
    setShowBreak(false);
    setConfirmReset(false);
    onToast?.('学習をリセットしました');
  };

  const answered = (correct, grade) => {
    const cur = byId[session.ids[session.pos]];
    if (cur) recordAnswer(cur, correct, grade);
    const newPos = session.pos + 1;
    updateSession({ pos: newPos });
    if (newPos < session.target && newPos % SET_SIZE === 0) setShowBreak(true);
  };

  // ===== 開始・続きから 画面 =====
  const active = session && session.pos < session.target;
  if (!active && !(session && session.pos >= session.target)) {
    return (
      <div className="view">
        <h2 className="view-title">学習（10・60・300・900）</h2>
        <p className="view-desc">
          10問はすきま時間に、60問で1区切り、300問で今日の目標、900問で1周。1問ごとに自動保存され、いつでも続きから再開できます。
        </p>

        {session && (
          <div className="card sess-resume">
            <div className="sess-resume-head">前回の続き</div>
            <div className="sess-resume-main">
              <strong>{session.subject === 'all' ? '全科目' : session.subject}</strong>
              <span className="sess-frac">{session.pos} / {session.target}</span>
            </div>
            <div className="bar" style={{ marginTop: 6 }}>
              <span style={{ width: `${(session.pos / session.target) * 100}%` }} />
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => setShowBreak(false)}>▶ 続きから</button>
              <button className="btn" onClick={beginFromScratch}>▶ 最初から</button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>🔍 出題をしぼる（未選択でOK）</div>
          <div className="search-grid">
            <label className="mini-field">
              <span>科目</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">全科目</option>
                {subjects.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
            <label className="mini-field">
              <span>ジャンル</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">指定なし</option>
                {genreOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
            <label className="mini-field">
              <span>キーワード</span>
              <select value={keyword} onChange={(e) => setKeyword(e.target.value)} disabled={kwOptions.length === 0}>
                <option value="">指定なし</option>
                {kwOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
          </div>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="🔎 語で検索（例：顔面神経・足三里・糖尿病）科目をまたいで探せます"
            style={{ marginTop: 10 }}
          />
          <div className="search-foot" style={{ marginTop: 8 }}>
            <span>この条件で <strong>{filteredPool.length}</strong> 問（残り新規 <strong>{newRemaining}</strong> 問）</span>
            {(genre || keyword || term || subject !== 'all') && (
              <button className="btn ghost sm" onClick={() => { setSubject('all'); setGenre(''); setKeyword(''); setTerm(''); }}>クリア</button>
            )}
          </div>

          <label className="autokw-row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
            <span>⚡ 高速回転モード（問題→3秒想起→答え。サクサク周回）</span>
          </label>

          <div className="section-label">新規と復習の割合</div>
          <div className="chip-row">
            {[
              { p: 100, l: 'すべて新規' },
              { p: 70, l: '新規多め' },
              { p: 50, l: '半々' },
              { p: 30, l: '復習多め' },
              { p: 0, l: 'すべて復習' },
            ].map((o) => (
              <button key={o.p} className={`chip ${newPct === o.p ? 'active' : ''}`} onClick={() => setNewPct(o.p)}>
                {o.l}
              </button>
            ))}
          </div>
          <div className="range-row" style={{ marginTop: 8 }}>
            <input type="range" min="0" max="100" step="10" value={newPct} onChange={(e) => setNewPct(Number(e.target.value))} />
            <span className="range-val">新規{newPct}% / 復習{100 - newPct}%</span>
          </div>
          <div className="hint">新規＝まだ解いていない問題、復習＝間違えた問題。任意の割合で混ぜて出題します。</div>

          <label className="section-label">今日はどれで勉強しますか？</label>
          <div className="sess-targets">
            {TARGETS.map((t) => (
              <button key={t} className="sess-target" onClick={() => begin(t)} disabled={filteredPool.length === 0 || (newPct >= 100 && newRemaining === 0)}>
                <span className="sess-target-n">{t}</span>
                <span className="sess-target-l">
                  {t === 10 ? 'すきま時間' : t === 60 ? '1セット（区切り）' : t === 300 ? '1日の目標' : '1周（周回）'}
                </span>
              </button>
            ))}
          </div>
          {newPct >= 100 && newRemaining === 0 ? (
            <p className="inline-note" style={{ marginTop: 10, color: 'var(--warn, #e0a800)' }}>
              この条件の新規問題はすべて解き終えました。復習するには上のスライダーで割合を下げてください（例：復習多め）。
            </p>
          ) : newPct >= 100 ? (
            <p className="inline-note" style={{ marginTop: 10 }}>
              「すべて新規」では未着手の{newRemaining}問だけを出題します（解いた問題は混ざりません）。
            </p>
          ) : (
            <p className="inline-note" style={{ marginTop: 10 }}>
              収録数が少ない条件では、同じ問題を繰り返して指定問数に到達します（周回）。
            </p>
          )}
        </div>
      </div>
    );
  }

  // ===== 完了画面 =====
  if (session && session.pos >= session.target) {
    const t = session.target;
    return (
      <div className="view">
        <div className="card sess-done">
          <div className="sess-done-ico">{t >= 900 ? '🏆' : t >= 300 ? '🎉' : '✅'}</div>
          <h2>
            {t >= 900 ? '1周（900問）終了！' : t >= 300 ? '今日の目標 300問 達成！' : t >= 60 ? '1セット（60問）完了！' : `すきま学習（${t}問）完了！`}
          </h2>
          <p className="view-desc" style={{ textAlign: 'center' }}>
            {t >= 900
              ? 'おつかれさまでした。苦手を分析して2周目へ進みましょう。'
              : t >= 300
              ? 'すばらしい集中力です。苦手の復習で定着させましょう。'
              : t >= 60
              ? 'いいペースです。続けて次のセットへ。'
              : '短い時間でもコツコツ積み上げ、えらい！もう1回いける？'}
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn accent" onClick={() => onGoReview?.()}>苦手を復習する</button>
            {t >= 900 ? (
              <button className="btn primary" onClick={() => begin(900, { subject: session.subject, round: (session.round || 1) + 1, fast: session.fast, newRatio: session.newRatio, pool: poolFor(questions, session.subject), allowSeen: true })}>2周目を開始</button>
            ) : (
              <button className="btn primary" onClick={() => begin(t, { subject: session.subject, fast: session.fast, newRatio: session.newRatio, pool: poolFor(questions, session.subject), allowSeen: true })}>もう一度</button>
            )}
          </div>
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => clearSession()}>終了する</button>
        </div>
      </div>
    );
  }

  // ===== 休憩画面（60問ごと） =====
  if (showBreak) {
    const isDaily = session.pos === 300;
    return (
      <div className="view">
        <div className="card sess-break">
          <div className="sess-done-ico">{isDaily ? '🎉' : '☕'}</div>
          <h2>{isDaily ? '今日の目標 300問 達成！' : `ひと区切り（${session.pos}問）`}</h2>
          <p className="view-desc" style={{ textAlign: 'center' }}>
            {isDaily ? 'ここまでで今日の基本目標はクリア。休んでもOK、続けてもOK。' : 'よく集中できました。少し休むと定着します。'}
          </p>
          <div className="sess-break-actions">
            <button className="btn primary block lg" onClick={() => setShowBreak(false)}>▶ 続ける（次の60問）</button>
            <BreakTimer minutes={5} onDone={() => setShowBreak(false)} />
            <BreakTimer minutes={10} onDone={() => setShowBreak(false)} />
            <button className="btn ghost block" onClick={() => onToast?.('ここまで保存しました。続きからいつでも再開できます')}>
              終了して後で続ける（自動保存済み）
            </button>
            <ResetControl
              target={session.target}
              confirming={confirmReset}
              onAsk={() => setConfirmReset(true)}
              onConfirm={doReset}
              onCancel={() => setConfirmReset(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ===== 出題画面 =====
  const current = byId[session.ids[session.pos]];
  if (!current) {
    // 収録が変わって id が見つからない場合は次へ
    updateSession({ pos: session.pos + 1 });
    return null;
  }
  const setNo = Math.floor(session.pos / SET_SIZE) + 1;
  const totalSets = Math.ceil(session.target / SET_SIZE);
  return (
    <div className="view">
      <div className="sess-topbar">
        <span className="sess-topbar-sub">{session.subject === 'all' ? '全科目' : session.subject}</span>
        <span className="sess-topbar-frac">{session.pos + 1} / {session.target}　（セット{setNo}/{totalSets}）</span>
      </div>
      <div className="progress">
        <span style={{ width: `${((session.pos + 1) / session.target) * 100}%` }} />
      </div>
      {session.fast ? (
        <FastCard key={current.id + '@' + session.pos} question={current} onGraded={answered} GRADES={GRADES} />
      ) : (
        <QuestionCard
          key={current.id + '@' + session.pos}
          question={current}
          memo={memos[current.id]}
          onSetMemo={setMemo}
          link={links[current.id]}
          onSetLink={setLink}
          onOpenKeyword={onOpenKeyword}
          onAnswered={answered}
          onNext={() => {}}
          selfGrade
          simple
          compact
          bookmarked={!!bookmarks[current.id]}
          onToggleBookmark={toggleBookmark}
          GRADES={GRADES}
        />
      )}
      <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={() => setShowBreak(true)}>
        中断して休憩（自動保存されています）
      </button>
      <ResetControl
        target={session.target}
        confirming={confirmReset}
        onAsk={() => setConfirmReset(true)}
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

// 学習リセットボタン ＋ 確認（はい/いいえ）
//   ①「学習◯◯をリセットする」をタップ → ②「本当にリセットしますか？」はい/いいえ
function ResetControl({ target, confirming, onAsk, onConfirm, onCancel }) {
  const label = target ? `学習${target}をリセットする` : '学習をリセットする';
  if (confirming) {
    return (
      <div className="sess-reset-confirm">
        <span className="sess-reset-q">本当にリセットしますか？</span>
        <div className="btn-row">
          <button className="btn danger" onClick={onConfirm}>はい</button>
          <button className="btn ghost" onClick={onCancel}>いいえ</button>
        </div>
      </div>
    );
  }
  return (
    <button className="btn ghost sm block sess-reset-btn" style={{ marginTop: 10 }} onClick={onAsk}>
      🗑 {label}
    </button>
  );
}

// 高速回転カード（3秒想起）。問題→3秒→答え→○△✕。選択肢は選ばず頭の中で想起。
function FastCard({ question, onGraded, GRADES }) {
  const [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState(3);
  useEffect(() => { setRevealed(false); setCount(3); }, [question.id]);
  useEffect(() => {
    if (revealed) return undefined;
    if (count <= 0) { setRevealed(true); return undefined; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, revealed]);
  const answer = question.choices[question.answer];
  const pick = (kind) => onGraded(kind === 'maru', kind === 'maru' ? (GRADES ? GRADES.easy : 5) : (GRADES ? GRADES.again : 0));
  return (
    <div className="card fast-card">
      <div className="q-meta">
        <span className={`badge ${question.type === 'ox' ? 'ox' : 'choice'}`}>{question.type === 'ox' ? '○×' : '四択'}</span>
        <span className="q-subject">{question.subject}</span>
        <span className="fast-tag">⚡ 高速</span>
      </div>
      {question.image && <img className="q-image" src={question.image} alt="問題の図" loading="lazy" />}
      {question.question && <div className="q-text">{question.question}</div>}
      {!revealed ? (
        <div className="fast-recall">
          <div className="fast-count">{count > 0 ? count : '…'}</div>
          <div className="fast-hint">答えを思い出そう</div>
          <button className="btn ghost sm" onClick={() => setRevealed(true)}>答えを見る →</button>
        </div>
      ) : (
        <>
          <div className="fast-answer">
            <strong>正解：{question.type === 'ox' ? answer : `${question.answer + 1}. ${answer}`}</strong>
            {question.explanation && <div style={{ marginTop: 6 }}>{question.explanation}</div>}
          </div>
          <div className="selfgrade-row" style={{ marginTop: 14 }}>
            <button className="btn self-maru" onClick={() => pick('maru')}><span className="sg-mark">○</span>完璧</button>
            <button className="btn self-sankaku" onClick={() => pick('sankaku')}><span className="sg-mark">△</span>あいまい</button>
            <button className="btn self-batsu" onClick={() => pick('batsu')}><span className="sg-mark">✕</span>わからない</button>
          </div>
        </>
      )}
    </div>
  );
}

// 休憩タイマー（5分/10分）。残り時間を表示し、終わると自動で続行。途中スキップ可。
function BreakTimer({ minutes, onDone }) {
  const [remain, setRemain] = useState(null); // 秒。null=未開始
  const start = () => {
    setRemain(minutes * 60);
    const iv = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(iv);
          onDone?.();
          return null;
        }
        return r - 1;
      });
    }, 1000);
  };
  if (remain == null) {
    return (
      <button className="btn block" onClick={start}>⏱ {minutes}分休憩</button>
    );
  }
  const mm = Math.floor(remain / 60);
  const ss = String(remain % 60).padStart(2, '0');
  return (
    <div className="sess-timer">
      <span>休憩中… あと {mm}:{ss}</span>
      <button className="btn ghost sm" onClick={() => onDone?.()}>スキップして再開</button>
    </div>
  );
}
