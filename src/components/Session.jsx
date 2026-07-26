import { useMemo, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import { GRADES } from '../lib/srs.js';
import { getSubjects } from '../lib/stats.js';
import { subjectMatches } from '../data/examScope.js';

// 学習セッション（60/300/900）
//   60問＝1セット（休憩の区切り） / 300問＝1日の基本目標 / 900問＝1周
//   1問ごとに位置を自動保存し、アプリを閉じても「続きから」再開できる。
const SET_SIZE = 60;
const TARGETS = [60, 300, 900];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  return ids.slice(0, target);
}

export default function Session({ store, onToast, onOpenKeyword, onGoReview }) {
  const { questions, session, startSession, updateSession, clearSession, memos, setMemo, links, setLink, recordAnswer } = store;
  const subjects = useMemo(() => getSubjects(questions), [questions]);
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);

  const [subject, setSubject] = useState('all');
  const [showBreak, setShowBreak] = useState(false);

  const begin = (target, subj = subject, round = 1) => {
    const pool = poolFor(questions, subj);
    if (pool.length === 0) {
      onToast?.('この科目の問題がありません');
      return;
    }
    startSession({ subject: subj, ids: buildOrder(pool, target), pos: 0, target, round, startedAt: Date.now() });
    setShowBreak(false);
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
        <h2 className="view-title">学習（60・300・900）</h2>
        <p className="view-desc">
          60問で1区切り、300問で今日の目標、900問で1周。1問ごとに自動保存され、いつでも続きから再開できます。
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
              <button className="btn" onClick={() => begin(session.target, session.subject)}>▶ 最初から</button>
            </div>
          </div>
        )}

        <div className="card">
          <label className="section-label" style={{ marginTop: 0 }}>科目</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">全科目</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="section-label">今日はどれで勉強しますか？</label>
          <div className="sess-targets">
            {TARGETS.map((t) => (
              <button key={t} className="sess-target" onClick={() => begin(t)}>
                <span className="sess-target-n">{t}</span>
                <span className="sess-target-l">
                  {t === 60 ? '1セット（区切り）' : t === 300 ? '1日の目標' : '1周（周回）'}
                </span>
              </button>
            ))}
          </div>
          <p className="inline-note" style={{ marginTop: 10 }}>
            収録数が少ない科目では、同じ問題を繰り返して指定問数に到達します（高速回転）。
          </p>
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
            {t >= 900 ? '1周（900問）終了！' : t >= 300 ? '今日の目標 300問 達成！' : '1セット（60問）完了！'}
          </h2>
          <p className="view-desc" style={{ textAlign: 'center' }}>
            {t >= 900
              ? 'おつかれさまでした。苦手を分析して2周目へ進みましょう。'
              : t >= 300
              ? 'すばらしい集中力です。苦手の復習で定着させましょう。'
              : 'いいペースです。続けて次のセットへ。'}
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn accent" onClick={() => onGoReview?.()}>苦手を復習する</button>
            {t >= 900 ? (
              <button className="btn primary" onClick={() => begin(900, session.subject, (session.round || 1) + 1)}>2周目を開始</button>
            ) : (
              <button className="btn primary" onClick={() => begin(t, session.subject)}>もう一度</button>
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
        GRADES={GRADES}
      />
      <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={() => setShowBreak(true)}>
        中断して休憩（自動保存されています）
      </button>
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
