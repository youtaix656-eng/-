import { useEffect, useMemo, useRef, useState } from 'react';
import ResetInline from './ResetInline.jsx';
import * as storage from '../lib/storage.js';
import { effectiveTags } from '../lib/query.js';
import { genreAccuracy, keywordAccuracy, topByAccuracy, relatedKeywordMap } from '../lib/audioplan.js';
import { buildBlueprintExam, blueprintAvailability, shuffle } from '../lib/examBuilder.js';
import { EXAM_BLUEPRINT_AM, EXAM_BLUEPRINT_PM } from '../data/examBlueprint.js';

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 合格基準は総得点の60%（鍼灸国試の目安）
const PASS_RATE = 0.6;
// 得意／苦手／選択式モードの1回あたりの出題数上限
const PRACTICE_COUNT = 90;

const MODES = [
  { id: 'am', label: '午前', emoji: '🌅', desc: '専門基礎科目 90問（本番同形式・時間制限あり）' },
  { id: 'pm', label: '午後', emoji: '🌇', desc: '専門科目 90問（本番同形式・時間制限あり）' },
  { id: 'strong', label: '得意な問題', emoji: '💪', desc: '得意なジャンル・キーワードを中心に最大90問' },
  { id: 'weak', label: '苦手な問題', emoji: '🎯', desc: '苦手なジャンル・キーワードを中心に最大90問' },
  { id: 'pick', label: '選択式', emoji: '🔍', desc: '科目・ジャンル・キーワードを選んで最大90問' },
];
const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m]));

// 模擬試験モード
// 午前／午後は本番同形式の科目配分・時間制限で通し演習。
// 得意／苦手／選択式は正答率の自動提案や検索条件から出題数を組み立てる演習モード。
// いずれも終了後に正答率・科目別内訳を表示し、解答はSRS・復習リストへ自動反映される。
export default function Exam({ store }) {
  const { questions, links, history, recordAnswer, examResults, addExamResult } = store;

  const [stage, setStage] = useState('select'); // select | setup | running | result
  const [modeId, setModeId] = useState(null);
  const [order, setOrder] = useState([]);
  const [answers, setAnswers] = useState([]); // index による解答（null=未解答）
  const [idx, setIdx] = useState(0);
  const [remain, setRemain] = useState(0);
  const [timed, setTimed] = useState(false);
  const [shortfalls, setShortfalls] = useState([]);
  const [resume, setResume] = useState(null); // 前回の途中経過（続きから）
  const timerRef = useRef(null);
  const remainRef = useRef(0);
  useEffect(() => { remainRef.current = remain; }, [remain]);

  // ---- 得意／苦手モード：正答率から自動提案 ----
  const genreRanked = useMemo(() => genreAccuracy(questions, history), [questions, history]);
  const kwRanked = useMemo(() => keywordAccuracy(questions, links, history), [questions, links, history]);
  const direction = modeId === 'strong' ? 'strong' : modeId === 'weak' ? 'weak' : null;
  const suggestedGenres = useMemo(
    () => (direction ? topByAccuracy(genreRanked, { direction, limit: 3 }) : []),
    [genreRanked, direction]
  );
  const suggestedKeywords = useMemo(
    () => (direction ? topByAccuracy(kwRanked, { direction, limit: 3 }) : []),
    [kwRanked, direction]
  );
  const [selectedChips, setSelectedChips] = useState(new Set());
  const [chipSig, setChipSig] = useState('');
  useEffect(() => {
    if (!direction) return;
    const sig = [
      ...suggestedGenres.map((g) => `genre:${g.genre}`),
      ...suggestedKeywords.map((k) => `kw:${k.keyword}`),
    ].join(',');
    if (sig === chipSig) return;
    setChipSig(sig);
    setSelectedChips(new Set(sig ? sig.split(',') : []));
  }, [direction, suggestedGenres, suggestedKeywords, chipSig]);
  const toggleChip = (key) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const accuracyPool = useMemo(() => {
    if (!direction) return [];
    const byId = new Map();
    for (const g of suggestedGenres) {
      if (!selectedChips.has(`genre:${g.genre}`)) continue;
      for (const q of g.questions) byId.set(q.id, q);
    }
    for (const k of suggestedKeywords) {
      if (!selectedChips.has(`kw:${k.keyword}`)) continue;
      for (const q of k.questions) byId.set(q.id, q);
    }
    return [...byId.values()];
  }, [direction, suggestedGenres, suggestedKeywords, selectedChips]);

  // ---- 選択式モード：科目→ジャンル→キーワードのカスケード検索 ----
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [relatedSelected, setRelatedSelected] = useState(new Set());
  const subjectOptions = useMemo(
    () => Array.from(new Set(questions.map((q) => q.subject))).sort((a, b) => a.localeCompare(b, 'ja')),
    [questions]
  );
  const afterSubject = useMemo(
    () => (filterSubject ? questions.filter((q) => q.subject === filterSubject) : questions),
    [questions, filterSubject]
  );
  const genreOptions = useMemo(
    () =>
      Array.from(new Set(afterSubject.flatMap((q) => (q.genre ? [q.genre] : [])))).sort((a, b) =>
        a.localeCompare(b, 'ja')
      ),
    [afterSubject]
  );
  const afterGenre = useMemo(
    () => (filterGenre ? afterSubject.filter((q) => q.genre === filterGenre) : afterSubject),
    [afterSubject, filterGenre]
  );
  const keywordOptions = useMemo(() => {
    const all = [];
    afterGenre.forEach((q) => all.push(...effectiveTags(q, links)));
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [afterGenre, links]);
  const relatedMapAll = useMemo(() => relatedKeywordMap(questions, links), [questions, links]);
  const relatedForKeyword = useMemo(() => {
    if (!filterKeyword) return [];
    return (relatedMapAll.get(filterKeyword) || []).filter((k) => k !== filterKeyword).slice(0, 8);
  }, [filterKeyword, relatedMapAll]);
  const pickPool = useMemo(() => {
    let pool = afterGenre;
    if (filterKeyword) {
      const kwSet = new Set([filterKeyword, ...relatedSelected]);
      pool = pool.filter((q) => effectiveTags(q, links).some((t) => kwSet.has(t)));
    }
    return pool;
  }, [afterGenre, filterKeyword, relatedSelected, links]);
  const applyFilter = (patch) => {
    if ('subject' in patch) {
      setFilterSubject(patch.subject);
      setFilterGenre('');
      setFilterKeyword('');
      setRelatedSelected(new Set());
    }
    if ('genre' in patch) {
      setFilterGenre(patch.genre);
      setFilterKeyword('');
      setRelatedSelected(new Set());
    }
    if ('keyword' in patch) {
      setFilterKeyword(patch.keyword);
      setRelatedSelected(new Set());
    }
  };
  const toggleRelated = (kw) => {
    setRelatedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  const startExam = () => {
    let picked = [];
    let sf = [];
    let minutes = 0;
    let isTimed = false;
    if (modeId === 'am' || modeId === 'pm') {
      const blueprint = modeId === 'am' ? EXAM_BLUEPRINT_AM : EXAM_BLUEPRINT_PM;
      const built = buildBlueprintExam(blueprint, questions);
      picked = built.order;
      sf = built.shortfalls;
      minutes = blueprint.minutes;
      isTimed = true;
    } else if (modeId === 'strong' || modeId === 'weak') {
      picked = shuffle(accuracyPool).slice(0, PRACTICE_COUNT);
    } else if (modeId === 'pick') {
      picked = shuffle(pickPool).slice(0, PRACTICE_COUNT);
    }
    if (!picked.length) return;
    setShortfalls(sf);
    setOrder(picked);
    setAnswers(new Array(picked.length).fill(null));
    setIdx(0);
    setTimed(isTimed);
    setRemain(isTimed ? minutes * 60 : 0);
    setStage('running');
  };

  // 保存済みの途中経過を読み込む（続きから）
  useEffect(() => {
    if (stage !== 'select' || !questions.length) return;
    let alive = true;
    storage.loadExamProgress().then((p) => {
      if (!alive || !p || !Array.isArray(p.ids) || !p.ids.length) return;
      if (p.timed && (p.remain || 0) <= 0) return;
      const byId = new Map(questions.map((q) => [q.id, q]));
      const rebuilt = p.ids.map((id) => byId.get(id)).filter(Boolean);
      if (rebuilt.length !== p.ids.length) return; // 収録が変わっていたら復元しない
      setResume(p);
    });
    return () => { alive = false; };
  }, [questions, stage]);

  const doResume = () => {
    if (!resume) return;
    const byId = new Map(questions.map((q) => [q.id, q]));
    setOrder(resume.ids.map((id) => byId.get(id)));
    setAnswers(resume.answers || new Array(resume.ids.length).fill(null));
    setIdx(Math.min(resume.idx || 0, resume.ids.length - 1));
    setRemain(resume.remain || 0);
    setModeId(resume.modeId || null);
    setTimed(!!resume.timed);
    setResume(null);
    setStage('running');
  };

  // 試験中は1問ごと（解答・移動ごと）に途中経過を保存
  useEffect(() => {
    if (stage !== 'running' || order.length === 0) return;
    storage.saveExamProgress({
      ids: order.map((q) => q.id),
      answers,
      idx,
      remain: remainRef.current,
      modeId,
      timed,
      presetLabel: MODE_BY_ID[modeId]?.label,
      at: Date.now(),
    });
  }, [stage, idx, answers, order]); // eslint-disable-line react-hooks/exhaustive-deps

  // 試験をリセット（途中経過を破棄してモード選択へ戻す）
  const resetExam = () => {
    clearInterval(timerRef.current);
    storage.clearExamProgress();
    setResume(null);
    setOrder([]);
    setAnswers([]);
    setIdx(0);
    setRemain(0);
    setStage('select');
  };

  // タイマー（時間制限モードのみ）
  useEffect(() => {
    if (stage !== 'running' || !timed) return;
    timerRef.current = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timed]);

  const selectAnswer = (choiceIdx) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = choiceIdx;
      return next;
    });
  };

  const finish = () => {
    clearInterval(timerRef.current);
    storage.clearExamProgress(); // 採点したら途中経過は破棄
    setStage('result');
  };

  // 結果ステージに入ったら履歴へ記録（1回だけ）
  // 未解答（skip）はSRS・復習リストを汚さないよう記録しない（採点上は別途、不正解として集計）。
  const recordedRef = useRef(false);
  useEffect(() => {
    if (stage === 'result' && !recordedRef.current) {
      recordedRef.current = true;
      let correctCount = 0;
      const perSubject = {};
      order.forEach((q, i) => {
        const correct = answers[i] === q.answer;
        if (correct) correctCount += 1;
        if (!perSubject[q.subject]) perSubject[q.subject] = { total: 0, correct: 0 };
        perSubject[q.subject].total += 1;
        if (correct) perSubject[q.subject].correct += 1;
        if (answers[i] == null) return; // 未解答はSRS・復習に記録しない
        recordAnswer(q, correct);
      });
      const scorePct = order.length > 0 ? Math.round((correctCount / order.length) * 100) : 0;
      addExamResult?.({
        mode: modeId,
        modeLabel: MODE_BY_ID[modeId]?.label,
        count: order.length,
        correct: correctCount,
        scorePct,
        passed: scorePct >= PASS_RATE * 100,
        perSubject,
      });
    }
    if (stage !== 'result') recordedRef.current = false;
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- モード選択 ----
  if (stage === 'select') {
    return (
      <div className="view">
        <h2 className="view-title">模擬試験</h2>
        <p className="view-desc">
          本番同形式の午前・午後演習のほか、得意・苦手を中心にした演習、条件を選んで出題する演習ができます。
        </p>

        {resume && (
          <button className="btn primary block lg" style={{ marginBottom: 12 }} onClick={doResume}>
            ▶ 前回の続きから（{MODE_BY_ID[resume.modeId]?.label || '模試'}・{(resume.idx || 0) + 1}/{resume.ids.length}問
            {resume.timed ? `・残り${fmtTime(resume.remain || 0)}` : ''}）
          </button>
        )}

        <div className="mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className="card tap"
              style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
              onClick={() => {
                setModeId(m.id);
                setStage('setup');
              }}
            >
              <div style={{ fontSize: 26 }}>{m.emoji}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{m.label}</div>
              <div className="inline-note" style={{ marginTop: 4 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {examResults && examResults.length > 0 && <ExamHistory results={examResults} passLine={PASS_RATE} />}
      </div>
    );
  }

  // ---- セットアップ：午前／午後（本番同形式） ----
  if (stage === 'setup' && (modeId === 'am' || modeId === 'pm')) {
    const blueprint = modeId === 'am' ? EXAM_BLUEPRINT_AM : EXAM_BLUEPRINT_PM;
    const avail = blueprintAvailability(blueprint, questions);
    const shortfallSlots = avail.filter((a) => !a.sufficient);
    return (
      <div className="view">
        <button className="btn ghost sm" onClick={() => setStage('select')}>← モードを選び直す</button>
        <h2 className="view-title">{blueprint.label}問題（{blueprint.totalCount}問）</h2>
        <p className="view-desc">
          本番同形式の科目配分で出題します。総合問題は連問形式（1つの事例に2〜3問）で最後にまとめて出題されます。
        </p>
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>科目別の出題数</div>
          {avail.map((a) => (
            <div className="stat-row" key={a.subject}>
              <div className="stat-head">
                <span className="stat-subject">{a.note}</span>
                <span className="stat-pct">
                  {a.requested}問
                  {!a.sufficient && (
                    <span className="inline-note"> （収録{a.available + (a.fallbackAvailable || 0)}問で代替）</span>
                  )}
                </span>
              </div>
            </div>
          ))}
          <div className="tiles" style={{ marginTop: 10 }}>
            <div className="tile">
              <div className="num">{blueprint.totalCount}</div>
              <div className="lbl">問題数</div>
            </div>
            <div className="tile">
              <div className="num">{blueprint.minutes}</div>
              <div className="lbl">制限時間（分）</div>
            </div>
            <div className="tile">
              <div className="num">60%</div>
              <div className="lbl">合格ライン</div>
            </div>
          </div>
          {shortfallSlots.length > 0 && (
            <p className="inline-note">
              ※ {shortfallSlots.map((s) => s.note).join('・')}
              は収録数がまだ既定に届かないため、収録分＋関連科目の問題で代替します。総合問題は過去問を追加いただき次第、実例に切り替わります。
            </p>
          )}
          <button className="btn primary block lg" style={{ marginTop: 10 }} onClick={startExam}>
            試験を開始する
          </button>
        </div>
      </div>
    );
  }

  // ---- セットアップ：得意／苦手 ----
  if (stage === 'setup' && (modeId === 'strong' || modeId === 'weak')) {
    const label = MODE_BY_ID[modeId].label;
    const noSuggestion = suggestedGenres.length === 0 && suggestedKeywords.length === 0;
    return (
      <div className="view">
        <button className="btn ghost sm" onClick={() => setStage('select')}>← モードを選び直す</button>
        <h2 className="view-title">{label}（最大{PRACTICE_COUNT}問）</h2>
        <p className="view-desc">
          解答実績からアプリが自動提案したジャンル・キーワードを中心に出題します。チップを外すと対象から除外できます（正答率は解答するたびに更新されます）。
        </p>
        {noSuggestion ? (
          <div className="empty">
            <div className="ico">📊</div>
            <p>解答実績がまだ少ないため自動提案できません。クイズや音声学習で何問か解いてから、もう一度お試しください。</p>
          </div>
        ) : (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>{label}そうなジャンル</div>
            <div className="chip-row">
              {suggestedGenres.map((g) => (
                <button
                  key={g.genre}
                  className={`chip ${selectedChips.has(`genre:${g.genre}`) ? 'active' : ''}`}
                  onClick={() => toggleChip(`genre:${g.genre}`)}
                >
                  {g.genre}（{g.accuracy == null ? '未回答' : `${Math.round(g.accuracy * 100)}%`}）
                </button>
              ))}
            </div>
            <div className="section-label">{label}そうなキーワード</div>
            <div className="chip-row">
              {suggestedKeywords.map((k) => (
                <button
                  key={k.keyword}
                  className={`chip ${selectedChips.has(`kw:${k.keyword}`) ? 'active' : ''}`}
                  onClick={() => toggleChip(`kw:${k.keyword}`)}
                >
                  {k.keyword}（{k.accuracy == null ? '未回答' : `${Math.round(k.accuracy * 100)}%`}）
                </button>
              ))}
            </div>
            <div className="tiles" style={{ marginTop: 10 }}>
              <div className="tile">
                <div className="num">{Math.min(PRACTICE_COUNT, accuracyPool.length)}</div>
                <div className="lbl">出題数</div>
              </div>
            </div>
            {accuracyPool.length === 0 && <p className="inline-note">チップを1つ以上選んでください。</p>}
            <button
              className="btn primary block lg"
              style={{ marginTop: 10 }}
              onClick={startExam}
              disabled={accuracyPool.length === 0}
            >
              試験を開始する
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- セットアップ：選択式 ----
  if (stage === 'setup' && modeId === 'pick') {
    return (
      <div className="view">
        <button className="btn ghost sm" onClick={() => setStage('select')}>← モードを選び直す</button>
        <h2 className="view-title">選択式（最大{PRACTICE_COUNT}問）</h2>
        <p className="view-desc">
          科目・ジャンル・キーワードで絞り込んで出題します。キーワードを選ぶと関連キーワードも芋づる式に追加できます。
        </p>
        <div className="card audio-search">
          <div className="section-label" style={{ marginTop: 0 }}>🔍 検索（しぼり込み）</div>
          <div className="search-grid">
            <label className="mini-field">
              <span>科目名</span>
              <select value={filterSubject} onChange={(e) => applyFilter({ subject: e.target.value })}>
                <option value="">指定なし</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="mini-field">
              <span>ジャンル</span>
              <select
                value={filterGenre}
                onChange={(e) => applyFilter({ genre: e.target.value })}
                disabled={!genreOptions.length}
              >
                <option value="">指定なし</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="mini-field">
              <span>キーワード</span>
              <select
                value={filterKeyword}
                onChange={(e) => applyFilter({ keyword: e.target.value })}
                disabled={!keywordOptions.length}
              >
                <option value="">指定なし</option>
                {keywordOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
          </div>
          {relatedForKeyword.length > 0 && (
            <>
              <div className="section-label">関連キーワード（芋づる式に追加できます）</div>
              <div className="chip-row">
                {relatedForKeyword.map((k) => (
                  <button
                    key={k}
                    className={`chip ${relatedSelected.has(k) ? 'active' : ''}`}
                    onClick={() => toggleRelated(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="tiles" style={{ marginTop: 10 }}>
            <div className="tile">
              <div className="num">{Math.min(PRACTICE_COUNT, pickPool.length)}</div>
              <div className="lbl">出題数</div>
            </div>
          </div>
          {pickPool.length === 0 && <p className="inline-note">条件に一致する問題がありません。条件を変えてください。</p>}
          <button
            className="btn primary block lg"
            style={{ marginTop: 10 }}
            onClick={startExam}
            disabled={pickPool.length === 0}
          >
            試験を開始する
          </button>
        </div>
      </div>
    );
  }

  // ---- 結果 ----
  if (stage === 'result') {
    const correctCount = order.reduce(
      (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
      0
    );
    const rate = order.length > 0 ? correctCount / order.length : 0;
    const passed = rate >= PASS_RATE;
    const showPassLine = modeId === 'am' || modeId === 'pm';
    // 科目別の内訳
    const perSubject = {};
    order.forEach((q, i) => {
      if (!perSubject[q.subject]) perSubject[q.subject] = { total: 0, correct: 0 };
      perSubject[q.subject].total += 1;
      if (answers[i] === q.answer) perSubject[q.subject].correct += 1;
    });

    return (
      <div className="view">
        <h2 className="view-title">{MODE_BY_ID[modeId]?.label || '演習'}の結果</h2>

        <div className={`result-hero ${passed ? 'pass' : 'fail'}`}>
          {showPassLine && <div className="verdict">{passed ? '合格ライン到達' : '合格ライン未満'}</div>}
          <div className="score">
            {Math.round(rate * 100)}
            <small>%</small>
          </div>
          <div className="sub">
            {order.length}問中 {correctCount}問正解 ／ {order.length - correctCount}問不正解
            {showPassLine && `　合格ライン ${Math.round(PASS_RATE * 100)}%`}
          </div>
        </div>

        {shortfalls.length > 0 && (
          <p className="inline-note">
            ※ {shortfalls.map((s) => s.note).join('・')} は収録不足のため一部を関連科目で代替しました。
          </p>
        )}

        <div className="section-label" style={{ marginTop: 0 }}>
          科目別の内訳
        </div>
        {Object.entries(perSubject).map(([s, v]) => {
          const acc = v.correct / v.total;
          const cls = acc >= 0.7 ? 'bar-good' : acc >= 0.5 ? 'bar-mid' : 'bar-bad';
          return (
            <div className="stat-row" key={s}>
              <div className="stat-head">
                <span className="stat-subject">{s}</span>
                <span className="stat-pct">
                  {Math.round(acc * 100)}%
                  <span className="stat-sub"> （{v.correct}/{v.total}）</span>
                </span>
              </div>
              <div className={`bar ${cls}`}>
                <span style={{ width: `${acc * 100}%` }} />
              </div>
            </div>
          );
        })}

        <p className="inline-note" style={{ marginTop: 10 }}>
          不正解・未解答の問題は復習リストへ自動的に追加されました。
        </p>

        <button
          className="btn primary block lg"
          style={{ marginTop: 16 }}
          onClick={() => setStage('setup')}
        >
          もう一度挑戦する
        </button>
        <button
          className="btn ghost block sm"
          style={{ marginTop: 8 }}
          onClick={() => setStage('select')}
        >
          他のモードを選ぶ
        </button>
      </div>
    );
  }

  // ---- 試験中 ----
  const current = order[idx];
  const answered = answers.filter((a) => a !== null).length;
  const timeWarn = timed && remain <= 60;

  return (
    <div className="view">
      <div className="exam-timer">
        {timed ? (
          <span className={`time ${timeWarn ? 'warn' : ''}`}>⏱ {fmtTime(remain)}</span>
        ) : (
          <span className="time">📝 演習モード（時間無制限）</span>
        )}
        <span className="count">
          解答済み {answered} / {order.length}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
      </div>

      <div className="card">
        <div className="q-meta">
          <span className={`badge ${current.type === 'ox' ? 'ox' : 'choice'}`}>
            {current.type === 'ox' ? '○×' : '四択'}
          </span>
          <span className="q-subject">
            第{idx + 1}問 ・ {current.subject}
          </span>
        </div>
        <div className="q-text">{current.question}</div>
        <div className="choices">
          {current.choices.map((choice, i) => {
            const mark =
              current.type === 'ox'
                ? i === 0
                  ? '○'
                  : '×'
                : String.fromCharCode(0x2460 + i);
            return (
              <button
                key={i}
                className={`choice-btn ${answers[idx] === i ? 'selected' : ''}`}
                onClick={() => selectAnswer(i)}
              >
                <span className="mark">{mark}</span>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
          ← 前へ
        </button>
        {idx < order.length - 1 ? (
          <button className="btn primary" onClick={() => setIdx(idx + 1)}>
            次へ →
          </button>
        ) : (
          <button className="btn accent" onClick={finish}>
            採点する
          </button>
        )}
      </div>

      <button
        className="btn ghost block sm"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (confirm('試験を終了して採点しますか？（未解答は誤答扱い）')) finish();
        }}
      >
        途中で終了して採点
      </button>

      <ResetInline label="模試をリセット（採点せず破棄）" onReset={resetExam} />
    </div>
  );
}

// 直近の模試スコアから合否を予測する
//  results は新しい→古い順。直近3回（無ければある分）の平均で判定し、傾向も見る。
function predictExam(results, passLine) {
  if (!results.length) return null;
  const passPct = Math.round(passLine * 100);
  const recent = results.slice(0, 3).map((r) => r.scorePct);
  const recentAvg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  // 傾向：直近と、その前の同数の平均を比べる
  const prev = results.slice(3, 6).map((r) => r.scorePct);
  const prevAvg = prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : null;
  const delta = prevAvg == null ? null : recentAvg - prevAvg;
  const gap = recentAvg - passPct; // 正なら合格ラインを上回る
  let zone, emoji, msg;
  if (gap >= 8) {
    zone = '合格圏';
    emoji = '🎉';
    msg = `直近平均は合格ライン+${gap}ポイント。この調子を維持しましょう。`;
  } else if (gap >= 0) {
    zone = 'ボーダー（合格圏内・僅差）';
    emoji = '🟢';
    msg = `合格ラインをわずかに上回っています（+${gap}ポイント）。取りこぼしを減らして余裕を作りましょう。`;
  } else if (gap >= -8) {
    zone = 'ボーダー（あと少し）';
    emoji = '🟡';
    msg = `合格ラインまであと${-gap}ポイント。弱点科目を重点復習すれば十分届きます。`;
  } else {
    zone = '要強化';
    emoji = '🔴';
    msg = `合格ラインまであと${-gap}ポイント。範囲のカバーと間違い直しを優先しましょう。`;
  }
  return { passPct, recentAvg, recentN: recent.length, delta, zone, emoji, msg };
}

// 模試の結果履歴と、合格ライン到達の推移グラフ＋合否予測
// 対象は午前／午後（本番同形式）の結果のみ（得意・苦手・選択式は合格ラインの対象外のため除く）。
function ExamHistory({ results, passLine }) {
  const scoped = results.filter((r) => !r.mode || r.mode === 'am' || r.mode === 'pm');
  if (scoped.length === 0) return null;
  // 古い→新しい（左→右）に並べ、直近20件
  const items = [...scoped].slice(0, 20).reverse();
  const passCount = scoped.filter((r) => r.passed).length;
  const best = Math.max(...scoped.map((r) => r.scorePct));
  const passPct = Math.round(passLine * 100);
  const pred = predictExam(scoped, passLine);
  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-label" style={{ marginTop: 0 }}>午前・午後の記録（{scoped.length}回）</div>

      {pred && (
        <div className="card exam-predict">
          <div className="exam-predict-head">
            <span className="exam-predict-emoji">{pred.emoji}</span>
            <div>
              <div className="exam-predict-zone">合否予測：{pred.zone}</div>
              <div className="exam-predict-avg">
                直近{pred.recentN}回の平均 <strong>{pred.recentAvg}%</strong>
                （合格ライン {pred.passPct}%）
                {pred.delta != null && (
                  <span className={`exam-predict-delta ${pred.delta >= 0 ? 'up' : 'down'}`}>
                    {pred.delta >= 0 ? `▲ +${pred.delta}` : `▼ ${pred.delta}`}pt
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="exam-predict-gauge">
            <span className="epg-fill" style={{ width: `${Math.min(100, pred.recentAvg)}%` }} />
            <span className="epg-line" style={{ left: `${pred.passPct}%` }} title={`合格ライン ${pred.passPct}%`} />
          </div>
          <div className="inline-note">{pred.msg}</div>
          <div className="inline-note">※直近の模試スコアからの目安です。合格基準は年度により変動します。</div>
        </div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="num">{scoped.length}</div>
          <div className="lbl">受験回数</div>
        </div>
        <div className="tile">
          <div className="num" style={{ color: 'var(--correct)' }}>{passCount}</div>
          <div className="lbl">合格ライン到達</div>
        </div>
        <div className="tile">
          <div className="num">{best}%</div>
          <div className="lbl">ベストスコア</div>
        </div>
      </div>
      <div className="card">
        <div className="exam-chart">
          {items.map((r, i) => (
            <div className="exam-chart-col" key={r.id || i} title={`${new Date(r.at).toLocaleDateString('ja-JP')}：${r.scorePct}%`}>
              <div className={`exam-chart-bar ${r.passed ? 'pass' : 'fail'}`} style={{ height: `${Math.max(4, r.scorePct)}%` }} />
              <span className="exam-chart-lbl">{r.scorePct}</span>
            </div>
          ))}
          <div className="exam-chart-line" style={{ bottom: `${passPct}%` }} title={`合格ライン ${passPct}%`}>
            <span>合格{passPct}%</span>
          </div>
        </div>
        <div className="inline-note" style={{ textAlign: 'center', marginTop: 6 }}>
          緑＝合格ライン到達／灰＝未満。左（過去）→右（最近）。
        </div>
      </div>
    </div>
  );
}
