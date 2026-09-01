import { useEffect, useMemo, useState } from 'react';
import { haripanMessages, MASCOT_NAME } from '../data/haripan.js';
import { studyStreak } from '../lib/stats.js';
import { speak, cancelSpeech, isSpeechSupported } from '../lib/speech.js';
import { weakTagClusters } from '../lib/weakClusters.js';
import { forgettingRisk } from '../lib/forgetting.js';
import { loadStreakBreakLog, breakReasonLabel } from '../lib/streakBreak.js';
import { loadNextTask } from '../lib/nextTask.js';
import { MOODS, loadTodayMood, recordTodayMood } from '../lib/mood.js';
import { loadContentSeedLog, seedEntriesSince } from '../lib/contentSeedLog.js';

const HARIO_IMG = `${import.meta.env.BASE_URL}haripan.png`;
const DAY_MS = 24 * 60 * 60 * 1000;
const FORGETTING_THRESHOLD = 0.4;

function dayStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ハリオ先生 — アプリのAIマスコット。状況に合わせて一言を返し、読み上げもする。
//   ＋分析（苦手・忘却リスク）／今日の進捗（1日の目標との差）／今日の調子 も表示。
export default function Mascot({ store, onNavigate }) {
  const { questions, links, srs, history, dueReviewQuestions, examResults, settings } = store;

  // 直近の状況から、外部（idb）に保存された補足情報を読み込む
  const [streakBreakReasonLabel, setStreakBreakReasonLabel] = useState(null);
  const [nextTaskText, setNextTaskText] = useState(null);
  const [mood, setMood] = useState(null);
  const [contentAdded, setContentAdded] = useState(0); // #23：直近7日でコンテンツが増えたか

  useEffect(() => {
    let alive = true;
    const today = dayStart(Date.now());
    const yesterday = today - DAY_MS;
    loadStreakBreakLog().then((log) => {
      if (!alive) return;
      const entry = log[String(yesterday)];
      // きのう分の理由が「今日」記録されたものだけ、その日1回だけ触れる
      if (entry && dayStart(entry.at) === today) {
        setStreakBreakReasonLabel(breakReasonLabel(entry.reason) || null);
      }
    });
    loadNextTask().then((t) => { if (alive && t && t.text) setNextTaskText(t.text); });
    loadTodayMood().then((m) => { if (alive) setMood(m); });
    loadContentSeedLog().then((log) => {
      if (!alive) return;
      const recent = seedEntriesSince(log, Date.now() - 7 * DAY_MS);
      setContentAdded(recent.reduce((s, e) => s + (e.totalAdded || 0), 0));
    });
    return () => { alive = false; };
  }, []);

  const pickMood = (id) => {
    setMood(id);
    recordTodayMood(id);
  };

  // 弱点タグ・忘却リスク（#7の弱点クラスタ／#6の忘却予測をそのまま流用）
  const weak = useMemo(() => weakTagClusters(history, questions, links, { limit: 3 }), [history, questions, links]);
  const risk = useMemo(() => forgettingRisk(questions, srs, { threshold: FORGETTING_THRESHOLD, limit: 30 }), [questions, srs]);
  const hasAnalysis = weak.length > 0 || risk.length > 0;

  // 今日の進捗（1日の目標との差。今日の調子が「しんどい」ならノルマを軽くする）
  const todayCount = useMemo(() => {
    const today = dayStart(Date.now());
    return history.filter((h) => h.at && dayStart(h.at) === today).length;
  }, [history]);
  const dailyGoal = settings.dailyGoal ?? 300;
  const effectiveGoal = mood === 'tired' ? Math.max(20, Math.round(dailyGoal * 0.5)) : dailyGoal;
  const remaining = Math.max(0, effectiveGoal - todayCount);
  const progressPct = Math.min(100, Math.round((todayCount / effectiveGoal) * 100));

  // 今日受けた模試があれば
  const latestExam = useMemo(() => {
    const last = (examResults || [])[0];
    if (!last || !last.at) return null;
    return dayStart(last.at) === dayStart(Date.now()) ? last : null;
  }, [examResults]);

  const ctx = useMemo(
    () => ({
      examDate: settings.examDate,
      dueCount: (dueReviewQuestions || []).length,
      streak: studyStreak(history).streak,
      historyLen: history.length,
      weakTag: weak[0]?.tag || null,
      riskCount: risk.length,
      streakBreakReasonLabel,
      nextTaskText,
      latestExam,
      mood,
      contentAdded,
    }),
    [settings.examDate, dueReviewQuestions, history, weak, risk, streakBreakReasonLabel, nextTaskText, latestExam, mood, contentAdded]
  );
  const messages = useMemo(() => haripanMessages(ctx), [ctx]);
  const [i, setI] = useState(() => Math.floor(Math.random() * Math.max(1, haripanMessages(ctx).length)));
  const msg = messages[i % messages.length] || '……よう。';

  const next = () => {
    cancelSpeech();
    setI((v) => (v + 1) % messages.length);
  };
  const readAloud = () => {
    if (!isSpeechSupported()) return;
    cancelSpeech();
    speak(msg, { rate: settings.speechRate || 1, pitch: settings.speechPitch || 1 }).catch(() => {});
  };
  const analysisText = () => {
    const parts = [];
    if (weak.length > 0) parts.push(`苦手は、${weak.map((w) => w.tag).join('、')}。`);
    if (risk.length > 0) parts.push(`忘れかけてる問題が${risk.length}問ある。`);
    return `分析だ。${parts.join(' ')}`;
  };
  const progressText = () =>
    remaining === 0
      ? `今日のノルマ、${todayCount}問。……達成だ。よくやった。`
      : `今日の進捗、${todayCount}問。目標まであと${remaining}問だ。`;
  const readAll = async () => {
    if (!isSpeechSupported()) return;
    cancelSpeech();
    const opts = { rate: settings.speechRate || 1, pitch: settings.speechPitch || 1 };
    try {
      await speak(msg, opts);
      if (hasAnalysis) await speak(analysisText(), opts);
      await speak(progressText(), opts);
    } catch (e) { /* 読み上げ中断は無視 */ }
  };

  return (
    <div className="mascot">
      <img className="mascot-img" src={HARIO_IMG} alt={MASCOT_NAME} loading="lazy" width="64" height="64" />
      <div className="mascot-body">
        <div className="mascot-name">{MASCOT_NAME}<span className="mascot-role">鍼灸師AI</span></div>
        <div className="mascot-bubble">{msg}</div>
        <div className="mascot-actions">
          {isSpeechSupported() && (
            <button className="mascot-btn" onClick={readAloud} aria-label="読み上げ">🔊 喋ってもらう</button>
          )}
          <button className="mascot-btn ghost" onClick={next} aria-label="次のひとこと">↻ 次のひとこと</button>
          {isSpeechSupported() && (
            <button className="mascot-btn ghost" onClick={readAll} aria-label="全部まとめて聞く">🔊 全部まとめて聞く</button>
          )}
        </div>

        {hasAnalysis && (
          <button className="mascot-sub" onClick={() => onNavigate?.('analytics')}>
            <span className="mascot-sub-label">🧭 最近の分析（タップで詳しく）</span>
            {weak.length > 0 && <div>苦手：{weak.map((w) => w.tag).join('・')}</div>}
            {risk.length > 0 && <div>忘れかけている問題：{risk.length}問</div>}
          </button>
        )}

        <button className="mascot-sub" onClick={() => onNavigate?.('session')}>
          <span className="mascot-sub-label">📅 今日の進捗（タップで学習へ）</span>
          <div>
            {todayCount} / {effectiveGoal}問
            {mood === 'tired' && <span className="mascot-sub-note">（今日は少なめに調整中）</span>}
          </div>
          <div className="mascot-progress"><i style={{ width: `${progressPct}%` }} /></div>
          <div>{remaining === 0 ? '🎉 今日のノルマ達成！' : `あと${remaining}問`}</div>
        </button>

        <div className="mascot-mood-row">
          <span className="mascot-mood-label">今日の調子</span>
          {MOODS.map((m) => (
            <button
              key={m.id}
              className={`mascot-mood-btn ${mood === m.id ? 'active' : ''}`}
              onClick={() => pickMood(m.id)}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
