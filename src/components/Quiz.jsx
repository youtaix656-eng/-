import { useEffect, useMemo, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import ResetInline from './ResetInline.jsx';
import { getSubjects } from '../lib/stats.js';
import { subjectMatches, SUBJECT_TAG_NAMES } from '../data/examScope.js';
import * as storage from '../lib/storage.js';
import { GRADES, normalize } from '../lib/srs.js';
import { effectiveTags } from '../lib/query.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { reviewPoolFor, buildWeaknessSummary } from '../lib/reviewPool.js';
import { loadNextTask, saveNextTask } from '../lib/nextTask.js';
import { loadTodayMood } from '../lib/mood.js';
import { detectBrokenYesterday, loadStreakBreakLog, breakReasonLabel } from '../lib/streakBreak.js';
import { riskOf } from '../lib/reviewOrder.js';
import { roundKey, formatRound, isSameRound } from '../lib/round.js';
import {
  shuffle, spaceById, buildOrder, buildNewOnlyOrder, buildReviewOnlyOrder, buildMixedOrder, buildMixedNoRepeatOrder,
} from '../lib/sessionOrder.js';

const uniqJa = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
const BATCH_OPTIONS = [10, 30, 60, 0]; // 0=すべて

// 指定科目に一致する問題を集める（表記の揺れ・別名も許容）
function poolForSubject(questions, subject) {
  if (subject === 'all') return questions;
  const exact = questions.filter((q) => q.subject === subject);
  if (exact.length > 0) return exact;
  // 完全一致が無ければ別名照合（試験範囲の正式名などから来た場合）
  return questions.filter((q) => subjectMatches(q.subject, { name: subject }));
}

// 一問一答モード
export default function Quiz({ store, initialSubject, initialQuestions, autoResume, onConsumeAutoResume, onConsumed, onOpenKeyword }) {
  const { questions, memos, links, srs, history, recordAnswer, setMemo, setLink, bookmarks, toggleBookmark } = store;
  // 出題基準の科目順（1〜14）で並べる。基準にない科目名（表記ゆれ等）は末尾に追加。
  const subjects = useMemo(() => {
    const present = getSubjects(questions);
    const ordered = SUBJECT_TAG_NAMES.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SUBJECT_TAG_NAMES.includes(s));
    return [...ordered, ...extra];
  }, [questions]);

  const [subject, setSubject] = useState(initialSubject || 'all'); // 'all' or 科目名
  const [genre, setGenre] = useState('');
  const [keyword, setKeyword] = useState('');
  const [round, setRound] = useState('');
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [minRisk, setMinRisk] = useState(0);
  const [minWrong, setMinWrong] = useState(0);
  const [batch, setBatch] = useState(0); // 0=すべて（従来通り）
  const [newPct, setNewPct] = useState(null); // null=すべて（従来通り・新規/復習を区別しない）
  const [mood, setMood] = useState(null);
  // ミニタイムアタックモード（⑨）：1問あたりの制限時間つき軽量版。本番の模試と違い、
  //   日常の一問一答でもペース感覚を鍛えられるようにする任意のオプション。
  const [timeAttack, setTimeAttack] = useState(false);
  const [taSeconds, setTaSeconds] = useState(15);
  const [remain, setRemain] = useState(taSeconds);
  const [answeredThisQ, setAnsweredThisQ] = useState(false);
  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
  const [answerLog, setAnswerLog] = useState([]); // [{ q, correct }] 今回の解答（誤答一覧・ジャンル別集計用）
  // このセッションの母集団（「もう一度」で同じ条件を再現するため保持）
  const [sessionPool, setSessionPool] = useState(null);
  // 前回の途中経過（1問ごとに自動保存 → 続きから）
  const [resume, setResume] = useState(null);
  const [nextTaskInput, setNextTaskInput] = useState('');
  const [nextTaskSavedAt, setNextTaskSavedAt] = useState(0);
  const [streakBreakReasonLabel, setStreakBreakReasonLabel] = useState(null);

  useEffect(() => { loadTodayMood().then(setMood); }, []);
  useEffect(() => { loadNextTask().then((t) => { if (t && t.text) setNextTaskInput(t.text); }); }, []);
  useEffect(() => {
    const broken = detectBrokenYesterday(history);
    if (!broken) return;
    loadStreakBreakLog().then((log) => {
      const entry = log[String(broken)];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (entry && new Date(entry.at).setHours(0, 0, 0, 0) === today.getTime()) {
        setStreakBreakReasonLabel(breakReasonLabel(entry.reason));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveNextTaskDraft = () => {
    const text = nextTaskInput.trim();
    if (!text) return;
    saveNextTask(text);
    setNextTaskSavedAt(Date.now());
  };

  // 検索（科目→ジャンル→キーワード→回 の段階しぼり）
  const afterSubject = useMemo(() => poolForSubject(questions, subject), [questions, subject]);
  const genreOptions = useMemo(() => uniqJa(afterSubject.flatMap((q) => (q.genre ? [q.genre] : []))), [afterSubject]);
  const afterGenre = useMemo(() => (genre ? afterSubject.filter((q) => q.genre === genre) : afterSubject), [afterSubject, genre]);
  const kwOptions = useMemo(() => uniqJa(afterGenre.flatMap((q) => effectiveTags(q, links))), [afterGenre, links]);
  const kwSections = useMemo(() => buildKanaIndex(kwOptions), [kwOptions]);
  const afterKw = useMemo(() => (keyword ? afterGenre.filter((q) => effectiveTags(q, links).includes(keyword)) : afterGenre), [afterGenre, keyword, links]);
  const roundOptions = useMemo(
    () => Array.from(new Set(afterKw.map((q) => roundKey(q.round)).filter((r) => r != null))).sort((a, b) => Number(b) - Number(a)),
    [afterKw]
  );
  const afterRound = useMemo(() => (round ? afterKw.filter((q) => isSameRound(q.round, round)) : afterKw), [afterKw, round]);
  const filteredPool = useMemo(() => {
    let pool = afterRound;
    if (bookmarkOnly) pool = pool.filter((q) => bookmarks[q.id]);
    if (minWrong > 0) pool = pool.filter((q) => (normalize(srs[q.id]).wrongCount || 0) >= minWrong);
    if (minRisk > 0) pool = pool.filter((q) => Math.round(riskOf(q, srs) * 100) >= minRisk);
    return pool;
  }, [afterRound, bookmarkOnly, bookmarks, minWrong, minRisk, srs]);
  const filtering = subject !== 'all' || !!genre || !!keyword || !!round || bookmarkOnly || minWrong > 0 || minRisk > 0;

  useEffect(() => { setGenre(''); setKeyword(''); setRound(''); }, [subject]);
  useEffect(() => { setKeyword(''); setRound(''); }, [genre]);

  const newRemaining = useMemo(
    () => filteredPool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0).length,
    [filteredPool, srs]
  );
  const reviewRemaining = useMemo(() => reviewPoolFor(filteredPool, srs).length, [filteredPool, srs]);

  const beginWith = (pool, doShuffle = true) => {
    if (!pool || pool.length === 0) return;
    setSessionPool(pool);
    if (doShuffle) {
      const byId = new Map(pool.map((q) => [q.id, q]));
      setOrder(spaceById(shuffle(pool).map((q) => q.id)).map((id) => byId.get(id)));
    } else {
      setOrder(pool);
    }
    setIdx(0);
    setSessionStats({ total: 0, correct: 0 });
    setAnswerLog([]);
    setStarted(true);
  };

  // 出題ビルダー等から「この問題群を出す」指定、または科目指定で来たら自動開始
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setSubject('all');
      beginWith(initialQuestions, false); // 順序は呼び出し側で決定済み
      onConsumed?.();
    } else if (initialSubject) {
      const pool = poolForSubject(questions, initialSubject);
      if (pool.length > 0) {
        setSubject(initialSubject);
        beginWith(pool);
      }
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 保存済みの途中経過を読み込む（明示指定で来た時は対象外）
  useEffect(() => {
    if ((initialQuestions && initialQuestions.length) || initialSubject) return;
    if (started || !questions.length) return;
    let alive = true;
    storage.loadQuizProgress().then((p) => {
      if (!alive || !p || !Array.isArray(p.ids) || !p.ids.length) return;
      const byId = new Map(questions.map((q) => [q.id, q]));
      const rebuilt = p.ids.map((id) => byId.get(id)).filter(Boolean);
      if (rebuilt.length === 0 || (p.idx || 0) >= rebuilt.length) return;
      const info = {
        subject: p.subject || 'all',
        order: rebuilt,
        idx: Math.min(p.idx || 0, rebuilt.length - 1),
        stats: p.stats || { total: 0, correct: 0 },
      };
      if (autoResume) {
        // ホームの「前回の続きから」からの遷移：そのまま続きを開始
        setSubject(info.subject);
        setSessionPool(info.order);
        setOrder(info.order);
        setSessionStats(info.stats);
        setIdx(info.idx);
        setStarted(true);
        onConsumeAutoResume?.();
      } else {
        setResume(info);
      }
    });
    return () => {
      alive = false;
    };
  }, [questions, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1問ごとに途中経過を保存（終了したら消す）
  useEffect(() => {
    if (!started) return;
    if (idx >= order.length) {
      storage.clearQuizProgress();
      return;
    }
    storage.saveQuizProgress({
      subject,
      ids: order.map((q) => q.id),
      idx,
      stats: sessionStats,
      at: Date.now(),
    });
  }, [started, idx, order, subject, sessionStats]);

  const doResume = () => {
    if (!resume) return;
    setSubject(resume.subject);
    setSessionPool(resume.order);
    setOrder(resume.order);
    setSessionStats(resume.stats);
    setIdx(resume.idx);
    setStarted(true);
    setResume(null);
  };

  // 科目・絞り込み条件から開始（出題数・新規/復習の割合を反映）
  const start = () => {
    const target = batch > 0 ? batch : filteredPool.length;
    if (newPct == null) {
      // 従来通り：新規/復習を区別せず、条件に合う問題をそのまま（batch指定時は周回して埋める）
      const ids = batch > 0 ? buildOrder(filteredPool, target) : spaceById(shuffle(filteredPool).map((q) => q.id));
      const byId = new Map(filteredPool.map((q) => [q.id, q]));
      beginWith(ids.map((id) => byId.get(id)).filter(Boolean), false);
      return;
    }
    const ratio = newPct / 100;
    let ids;
    if (ratio >= 1) ids = buildNewOnlyOrder(filteredPool, target, srs);
    else if (ratio <= 0) ids = buildReviewOnlyOrder(filteredPool, target, srs);
    else ids = batch > 0 ? buildMixedOrder(filteredPool, target, ratio, srs) : buildMixedNoRepeatOrder(filteredPool, target, ratio, srs);
    if (ids.length === 0) return;
    const byId = new Map(questions.map((q) => [q.id, q]));
    beginWith(ids.map((id) => byId.get(id)).filter(Boolean), false);
  };
  // 「もう一度」＝同じ母集団を再シャッフルして再演習
  const restart = () => {
    if (sessionPool) beginWith(sessionPool);
    else start();
  };

  const handleAnswered = (correct, grade) => {
    const q = order[idx];
    recordAnswer(q, correct, grade);
    setSessionStats((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
    setAnswerLog((prev) => [...prev, { q, correct }]);
    setAnsweredThisQ(true);
  };

  const handleNext = () => {
    if (idx + 1 < order.length) setIdx(idx + 1);
    else setIdx(order.length); // 終了画面へ
  };

  // タイムアタック：問題が変わるたびに残り時間をリセットして1秒ごとにカウントダウン
  useEffect(() => {
    setAnsweredThisQ(false);
    if (!timeAttack || !started || idx >= order.length) return;
    setRemain(taSeconds);
    const timer = setInterval(() => {
      setRemain((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [idx, started, timeAttack, taSeconds, order.length]);

  // 時間切れ：まだ解答していなければ自動で「もう一度」扱いにして次の問題へ
  useEffect(() => {
    if (!timeAttack || !started || idx >= order.length) return;
    if (remain === 0 && !answeredThisQ) {
      handleAnswered(false, GRADES.again);
      handleNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remain]);

  // 一問一答をリセット（途中経過を破棄して科目選択へ戻す）
  const resetQuiz = () => {
    storage.clearQuizProgress();
    setStarted(false);
    setSessionPool(null);
    setOrder([]);
    setIdx(0);
    setResume(null);
  };

  const clearFilters = () => {
    setSubject('all'); setGenre(''); setKeyword(''); setRound('');
    setBookmarkOnly(false); setMinRisk(0); setMinWrong(0);
  };

  // ---- 開始前 ----
  if (!started) {
    return (
      <div className="view">
        <h2 className="view-title">一問一答</h2>
        <p className="view-desc">科目・条件を選んで演習を始めましょう。ランダムに出題されます。</p>

        {streakBreakReasonLabel && (
          <div className="card" style={{ marginBottom: 10 }}>
            きのうは『{streakBreakReasonLabel}』だったんですね。気にせず、今日は無理せず1問からいきましょう。
          </div>
        )}

        {resume && (
          <button className="btn primary block lg" style={{ marginBottom: 12 }} onClick={doResume}>
            ▶ 前回の続きから（{resume.idx + 1}/{resume.order.length}問・
            {resume.subject === 'all' ? '全科目' : resume.subject}）
          </button>
        )}

        <div className="card">
          <label className="section-label" style={{ marginTop: 0 }}>
            科目を選択
          </label>
          <div className="chip-row">
            <button
              className={`chip ${subject === 'all' ? 'active' : ''}`}
              onClick={() => setSubject('all')}
            >
              すべて（{questions.length}）
            </button>
            {subjects.map((s, i) => {
              const n = questions.filter((q) => q.subject === s).length;
              return (
                <button
                  key={s}
                  className={`chip ${subject === s ? 'active' : ''}`}
                  onClick={() => setSubject(s)}
                >
                  {i + 1}. {s}（{n}）
                </button>
              );
            })}
          </div>

          <div className="review-controls" style={{ marginTop: 10 }}>
            <label className="review-order">
              <span>ジャンル</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} disabled={genreOptions.length === 0}>
                <option value="">指定なし</option>
                {genreOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
            <label className="review-order">
              <span>キーワード</span>
              <select value={keyword} onChange={(e) => setKeyword(e.target.value)} disabled={kwOptions.length === 0}>
                <option value="">指定なし</option>
                {kwSections.map((sec) => (
                  <optgroup key={sec.label} label={`- ${sec.label} -`}>
                    {sec.items.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="review-order">
              <span>回（年度）</span>
              <select value={round} onChange={(e) => setRound(e.target.value)} disabled={roundOptions.length === 0}>
                <option value="">指定なし</option>
                {roundOptions.map((r) => (<option key={r} value={r}>{formatRound(r)}</option>))}
              </select>
            </label>
          </div>

          <label className="autokw-row" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={bookmarkOnly} onChange={(e) => setBookmarkOnly(e.target.checked)} />
            <span>★ ブックマークした問題だけ出題</span>
          </label>

          <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
            <label>忘却リスクの下限（{minRisk === 0 ? '指定なし' : `${minRisk}%以上だけ`}）</label>
            <input type="range" min="0" max="90" step="10" value={minRisk} onChange={(e) => setMinRisk(Number(e.target.value))} />
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>誤答回数の下限（{minWrong === 0 ? '指定なし' : `${minWrong}回以上だけ`}）</label>
            <input type="range" min="0" max="10" step="1" value={minWrong} onChange={(e) => setMinWrong(Number(e.target.value))} />
          </div>

          <div className="review-count">
            この条件で <strong>{filteredPool.length}</strong> 問
            {filtering && <button className="btn ghost sm" onClick={clearFilters}>クリア</button>}
          </div>

          <div className="section-label" style={{ marginTop: 10 }}>出題数</div>
          <div className="chip-row">
            {BATCH_OPTIONS.map((n) => (
              <button key={n} className={`chip ${batch === n ? 'active' : ''}`} onClick={() => setBatch(n)}>
                {n === 0 ? 'すべて' : `${n}問`}
              </button>
            ))}
          </div>
          {mood === 'tired' && batch === 0 && (
            <div className="inline-note" style={{ marginTop: 6 }}>
              今日は「しんどい」設定なので、無理せず少なめ（10問）から始めるのもおすすめです。
            </div>
          )}

          <div className="section-label" style={{ marginTop: 10 }}>新規・復習の割合</div>
          <div className="chip-row">
            {[
              { p: null, l: 'すべて（従来通り）' },
              { p: 100, l: 'すべて新規' },
              { p: 70, l: '新規多め' },
              { p: 50, l: '半々' },
              { p: 30, l: '復習多め' },
              { p: 0, l: 'すべて復習' },
            ].map((o) => (
              <button key={String(o.p)} className={`chip ${newPct === o.p ? 'active' : ''}`} onClick={() => setNewPct(o.p)}>
                {o.l}
              </button>
            ))}
          </div>
          {newPct != null && (
            <p className="inline-note" style={{ marginTop: 6 }}>
              新規{newRemaining}問・復習{reviewRemaining}問が対象です。「すべて新規」「すべて復習」では同じ問題を繰り返しません。
            </p>
          )}

          <label className="switch-row" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={timeAttack} onChange={(e) => setTimeAttack(e.target.checked)} />
            <span>
              ⏱ ミニタイムアタックモード
              <small>1問あたりの制限時間つき。本番のペース感覚を日常の一問一答でも鍛えられます。</small>
            </span>
          </label>
          {timeAttack && (
            <div className="chip-row" style={{ marginTop: 6 }}>
              {[10, 15, 20].map((s) => (
                <button key={s} className={`chip ${taSeconds === s ? 'active' : ''}`} onClick={() => setTaSeconds(s)}>
                  {s}秒
                </button>
              ))}
            </div>
          )}

          <button
            className="btn primary block lg"
            style={{ marginTop: 14 }}
            onClick={start}
            disabled={filteredPool.length === 0}
          >
            演習を始める
          </button>
        </div>
      </div>
    );
  }

  // ---- 終了画面 ----
  if (idx >= order.length) {
    const rate =
      sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;
    const wrongQs = answerLog.filter((a) => !a.correct).map((a) => a.q);
    // ジャンル別の正答率（#6）
    const byGenre = {};
    for (const a of answerLog) {
      const g = a.q.genre || a.q.subject || 'その他';
      if (!byGenre[g]) byGenre[g] = { total: 0, correct: 0 };
      byGenre[g].total += 1;
      if (a.correct) byGenre[g].correct += 1;
    }
    const genreRows = Object.entries(byGenre).sort((x, y) => (x[1].correct / x[1].total) - (y[1].correct / y[1].total));
    const weakness = wrongQs.length > 0 ? buildWeaknessSummary(wrongQs, links) : null;
    return (
      <div className="view">
        <h2 className="view-title">お疲れさまでした</h2>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="tile" style={{ boxShadow: 'none', border: 'none' }}>
            <div className="num">{rate}%</div>
            <div className="lbl">今回の正答率</div>
          </div>
          <p className="view-desc" style={{ marginTop: 8 }}>
            {sessionStats.total}問中 {sessionStats.correct}問 正解
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => { setStarted(false); setSessionPool(null); }}>科目を選び直す</button>
            <button className="btn primary" onClick={restart}>もう一度</button>
          </div>
        </div>

        {/* ジャンル別の正答率（#6・正答率の低い順） */}
        {genreRows.length > 1 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>ジャンル別の正答率（苦手順）</div>
            <ul className="genre-stats">
              {genreRows.map(([g, s]) => {
                const p = Math.round((s.correct / s.total) * 100);
                return (
                  <li key={g}>
                    <span className="gs-name">{g}</span>
                    <span className="gs-bar"><i style={{ width: `${p}%`, background: p < 60 ? 'var(--wrong)' : p < 80 ? 'var(--warn)' : 'var(--correct)' }} /></span>
                    <span className="gs-num">{p}%（{s.correct}/{s.total}）</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 今回の弱点分析 */}
        {weakness && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>今回の弱点分析</div>
            <p className="inline-note" style={{ marginTop: 0 }}>
              {weakness.topGenres.length > 0 && (
                <>「{weakness.topGenres.map(([g, c]) => `${g}（${c}問）`).join('」「')}」で誤答が目立ちました。</>
              )}
              {weakness.topTags.length > 0 && (
                <><br />繰り返しつまずいたキーワード：{weakness.topTags.map(([tg, c]) => `${tg}（×${c}）`).join('・')}</>
              )}
            </p>
          </div>
        )}

        {/* 今回の誤答一覧（#1） */}
        {wrongQs.length > 0 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>今回の誤答（{wrongQs.length}問）</div>
            <ul className="wrong-list">
              {wrongQs.map((q) => (
                <li key={q.id}>
                  <span className="wl-ans">{q.type === 'ox' ? (q.answer === 0 ? '○' : '✕') : `正解 ${q.answer + 1}`}</span>
                  <span className="wl-q">{q.question}</span>
                </li>
              ))}
            </ul>
            <button className="btn accent block" style={{ marginTop: 10 }} onClick={() => beginWith(wrongQs)}>
              ✕ 間違えた{wrongQs.length}問だけ、もう一度
            </button>
          </div>
        )}

        {/* 明日の最初の1タスクを決めておく */}
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>📌 明日の最初の1タスクを決めておく</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            次にアプリを開いた時、ホーム画面の一番上に表示されます。
          </p>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {wrongQs.length > 0 && (
              <button className="chip" onClick={() => setNextTaskInput(`苦手を${Math.min(wrongQs.length, 10)}問だけ復習する`)}>
                苦手を{Math.min(wrongQs.length, 10)}問だけ復習する
              </button>
            )}
            <button className="chip" onClick={() => setNextTaskInput('一問一答を10問だけやる')}>一問一答を10問だけやる</button>
          </div>
          <div className="kw-add">
            <input
              type="text"
              value={nextTaskInput}
              onChange={(e) => setNextTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveNextTaskDraft()}
              placeholder="例：苦手を5問だけ復習する"
            />
            <button className="btn sm primary" onClick={saveNextTaskDraft}>保存</button>
          </div>
          {nextTaskSavedAt > 0 && <p className="hint" style={{ marginTop: 6 }}>保存しました。</p>}
        </div>
      </div>
    );
  }

  // ---- 出題中 ----
  const current = order[idx];
  return (
    <div className="view">
      <div className="exam-timer">
        <span className="count">
          {subject === 'all' ? 'すべての科目' : subject}
        </span>
        {timeAttack && (
          <span className={`time ${remain <= 3 ? 'warn' : ''}`}>⏱ {remain}秒</span>
        )}
        <span className="count">
          {idx + 1} / {order.length}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
      </div>

      <QuestionCard
        key={current.id}
        question={current}
        memo={memos[current.id]}
        onSetMemo={setMemo}
        link={links[current.id]}
        onSetLink={setLink}
        onOpenKeyword={onOpenKeyword}
        onAnswered={handleAnswered}
        onNext={handleNext}
        selfGrade
        bookmarked={!!bookmarks[current.id]}
        onToggleBookmark={toggleBookmark}
        GRADES={GRADES}
        isLast={idx + 1 >= order.length}
      />
      <ResetInline label="一問一答をリセット" onReset={resetQuiz} />
    </div>
  );
}
