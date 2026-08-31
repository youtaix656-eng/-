import { useEffect, useMemo, useRef, useState } from 'react';
import { overallStats, studyStreak } from '../lib/stats.js';
import { estimateLevel } from '../lib/learnerLevel.js';
import { todayFocusSubjects } from '../lib/todayFocus.js';
import { scopeCoverage } from '../data/examScope.js';
import { daysUntil, formatExamDate } from '../lib/gamify.js';
import { loadQuizProgress, clearQuizProgress, loadSyncMeta } from '../lib/storage.js';
import { loadNextTask, clearNextTask } from '../lib/nextTask.js';
import {
  detectBrokenYesterday,
  BREAK_REASONS,
  loadStreakBreakLog,
  loadStreakBreakDismissed,
  recordStreakBreakReason,
  dismissStreakBreak,
} from '../lib/streakBreak.js';
import Mascot from './Mascot.jsx';
import featureRegistry from '../data/featureRegistry.js';
import { suggestUnvisitedFeature } from '../lib/featureDiscovery.js';

const LONG_PRESS_MS = 550;

// 場所別のおすすめモード（ホーム「今いる場所から始める」）。
// 場所ごとに集中できる度合いが違うので、その場に合う学習形式へワンタップで飛べるようにする。
// いずれも下部ナビ等から行ける既存画面へのショートカット（新しい画面は作らない）。
const LOCATION_MODES = [
  { id: 'home', icon: '🏠', label: '自宅', view: 'session', hint: 'じっくり集中できる場所。学習(10・60・300・900)で腰を据えて進める' },
  { id: 'work', icon: '💼', label: '職場', view: 'audio', hint: '手が使えない・すきま時間向け。音声学習で耳から暗記物を回す' },
  { id: 'room', icon: '🚪', label: '個室', view: 'exam', hint: '人目を気にせず時間を測れる場所。模擬試験を通しで解く' },
];

// 長押しで削除確認、タップで通常動作。ボタンに ...longPress(onLongPress, onTap) を展開して使う。
function useLongPress(onLongPress, onTap) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const start = () => {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const clear = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => {
      if (firedRef.current) { firedRef.current = false; return; }
      onTap();
    },
  };
}

// ホーム画面：学習状況の概要と各モードへの入り口
// 「n分前」のような簡易な相対時刻表示（クラウド同期の鮮度表示専用の小さな整形なので、
// 汎用ヘルパーとしては切り出さずここに閉じる）。
function timeAgoJa(at) {
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 60) return 'たった今';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  return `${Math.floor(hour / 24)}日前`;
}

const SYNC_STALE_MS = 3 * 24 * 60 * 60 * 1000; // 3日

export default function Home({ store, onNavigate, onResumeQuiz, installPrompt, onInstall, onJumpToRoadmapLevel, onStartSubjectQuiz }) {
  const { questions, history, reviewQuestions, dueReviewQuestions, session, unread, settings, srs, cloudSyncStatus } = store;

  // 直近の同期試行が失敗続きでも、実際に最後に成功したのがいつかを別途持っておく
  // （cloudSyncStatusは直近1回の結果しか持たないため）。syncMetaは同期が成功した時だけ
  // 更新されるので、そのまま「最後に成功した時刻」として使える。
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState(null);
  useEffect(() => {
    if (!settings.googleDriveAutoSync) return;
    loadSyncMeta().then((m) => setLastSuccessfulSyncAt(m?.updatedAt || null));
  }, [settings.googleDriveAutoSync, cloudSyncStatus]);
  const overall = overallStats(history);
  const level = estimateLevel({ srs, history });
  const focusSubjects = useMemo(() => {
    const scope = scopeCoverage(questions, history);
    return todayFocusSubjects(scope, daysUntil(settings.examDate));
  }, [questions, history, settings.examDate]);
  const reviewCount = reviewQuestions.length;
  const dueCount = (dueReviewQuestions || []).length;
  const unreadCount = (unread || []).length;
  // まだ使ったことのない機能を日替わりで1件だけ提案（60超の機能が下部ナビ・常設バー・
  // 各画面内メニューに散らばっていて気づかれにくいため）。全部使ったことがあればnull。
  const unvisitedFeature = useMemo(
    () => suggestUnvisitedFeature(featureRegistry, store.visitedViews),
    [store.visitedViews]
  );
  const sessionActive = session && session.pos < session.target;
  const { streak, longestStreak, studiedToday } = studyStreak(history);
  const examLeft = daysUntil(settings.examDate);

  // 一問一答の途中経過（1問ごと自動保存）を「続きから」に出す
  const [quizResume, setQuizResume] = useState(null);
  useEffect(() => {
    let alive = true;
    loadQuizProgress().then((p) => {
      if (!alive || !p || !Array.isArray(p.ids) || !p.ids.length) return;
      const len = p.ids.length;
      if ((p.idx || 0) >= len) return;
      setQuizResume({ subject: p.subject || 'all', idx: p.idx || 0, len });
    });
    return () => {
      alive = false;
    };
  }, [history]);

  const hasResume = sessionActive || quizResume;

  // 「前回の続きから」長押しで削除確認（誤タップでの消去を防ぐため、通常タップは今まで通り再開）
  const [confirmDelete, setConfirmDelete] = useState(null); // 'session' | 'quiz' | null
  const deleteSessionResume = () => {
    store.clearSession();
    setConfirmDelete(null);
  };
  const deleteQuizResume = () => {
    clearQuizProgress();
    setQuizResume(null);
    setConfirmDelete(null);
  };
  const sessionLongPress = useLongPress(() => setConfirmDelete('session'), () => onNavigate('session'));
  const quizLongPress = useLongPress(
    () => setConfirmDelete('quiz'),
    () => (onResumeQuiz ? onResumeQuiz() : onNavigate('quiz'))
  );

  // 明日の最初の1タスク（学習セッション完了画面で決めたもの）をホームの一番上に固定表示
  const [nextTask, setNextTask] = useState(null);
  useEffect(() => {
    loadNextTask().then((t) => setNextTask(t && t.text ? t : null));
  }, []);
  const doneNextTask = () => {
    clearNextTask();
    setNextTask(null);
  };

  // 「できなかった日は、原因を分解する」：連続日数が前日で途切れていたら、理由をワンタップで振り返る
  const [breakPrompt, setBreakPrompt] = useState(null);
  useEffect(() => {
    const broken = detectBrokenYesterday(history);
    if (!broken) { setBreakPrompt(null); return; }
    const dayKey = String(broken);
    Promise.all([loadStreakBreakLog(), loadStreakBreakDismissed()]).then(([log, dismissed]) => {
      if (log[dayKey] || dismissed[dayKey]) { setBreakPrompt(null); return; }
      setBreakPrompt({ dayKey });
    });
  }, [history]);
  const chooseBreakReason = (reasonId) => {
    if (!breakPrompt) return;
    recordStreakBreakReason(breakPrompt.dayKey, reasonId);
    setBreakPrompt(null);
  };
  const dismissBreak = () => {
    if (!breakPrompt) return;
    dismissStreakBreak(breakPrompt.dayKey);
    setBreakPrompt(null);
  };

  return (
    <div className="view">
      {installPrompt && (
        <button className="install-btn" onClick={onInstall}>
          <span>📲 ホーム画面に追加してアプリとして使う</span>
          <span className="install-cta">追加</span>
        </button>
      )}

      {/* クラウド自動同期の状態を軽く見える化（常に最新かどうかの安心材料。詳細は設定画面）。
          直近の試行が失敗していても、最後に「成功した」時刻からまだ日が浅ければ静かに
          再試行に任せる。3日以上成功していない場合だけ、見た目を強めて気づきやすくする
          （毎回の一時的な失敗をいちいち赤字にすると、かえって見なくなってしまうため）。 */}
      {settings.googleDriveAutoSync && (() => {
        const longFailure = !cloudSyncStatus?.ok && lastSuccessfulSyncAt != null
          && Date.now() - lastSuccessfulSyncAt > SYNC_STALE_MS;
        return (
          <button
            className="inline-note"
            onClick={() => onNavigate('settings')}
            style={{
              display: 'block', width: '100%', textAlign: 'left', marginBottom: 10,
              padding: '4px 2px', background: 'none', border: 'none',
              color: longFailure ? 'var(--wrong, #c62828)' : undefined,
              fontWeight: longFailure ? 700 : undefined,
            }}
          >
            {!cloudSyncStatus ? (
              '☁️ 同期を準備しています…'
            ) : cloudSyncStatus.ok ? (
              `☁️ 最新の状態に同期済み（${timeAgoJa(cloudSyncStatus.at)}）`
            ) : cloudSyncStatus.needsRelogin ? (
              '⚠️ 再ログインが必要です（タップして設定へ）'
            ) : longFailure ? (
              `⚠️ ${timeAgoJa(lastSuccessfulSyncAt)}から同期できていません（タップして確認）`
            ) : (
              `☁️ 同期に失敗しました（${timeAgoJa(cloudSyncStatus.at)}・自動で再試行します）`
            )}
          </button>
        );
      })()}

      <button
        className="level-badge"
        onClick={() => onJumpToRoadmapLevel?.(level.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          textAlign: 'left', marginBottom: 10, padding: '10px 14px',
          borderRadius: 12, border: '1px solid var(--border, #333)', background: 'var(--surface-2, transparent)',
        }}
      >
        <span style={{ fontSize: 22 }}>{level.icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 700 }}>今のレベル：{level.label}</span>
          <span className="inline-note" style={{ display: 'block' }}>
            レベル別の使い方を見る →
          </span>
        </span>
      </button>

      {/* ハリオ先生（AIマスコット） */}
      <Mascot store={store} onNavigate={onNavigate} />

      {/* 明日の最初の1タスク：セッション完了画面で決めたもの。何から始めるか迷わないよう一番上に固定 */}
      {nextTask && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="section-label" style={{ marginTop: 0 }}>📌 今日の最初の1タスク</div>
          <p style={{ margin: '4px 0 10px', fontSize: 16 }}>{nextTask.text}</p>
          <div className="btn-row">
            <button className="btn ghost sm" onClick={doneNextTask}>やった・消す</button>
          </div>
        </div>
      )}

      {/* 今日集中すべき科目：残り日数×手薄度×直近正答率から自動レコメンド。次のタスクが決まっている日は出さない */}
      {!nextTask && focusSubjects.length > 0 && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>🎯 今日集中すべき科目</div>
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            {focusSubjects.map((f) => (
              <button
                key={f.subject.id}
                className="chip"
                onClick={() => onStartSubjectQuiz?.(f.subject.name)}
              >
                {f.subject.name}
                <span className="inline-note" style={{ marginLeft: 4 }}>（{f.reason}）</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* できなかった日は、原因を分解する（責めるのではなく、また今日から戻るためのワンタップ記録） */}
      {breakPrompt && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>きのうはお休みでした</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            完璧じゃなくて大丈夫。原因だけ振り返って、また今日から戻りましょう。
          </p>
          <div className="chip-row">
            {BREAK_REASONS.map((r) => (
              <button key={r.id} className="chip" onClick={() => chooseBreakReason(r.id)}>{r.label}</button>
            ))}
          </div>
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={dismissBreak}>あとで</button>
        </div>
      )}

      {/* 前回の続きから（画面上部）。長押しで削除確認、タップで再開。 */}
      {hasResume && (
        <div className="resume-top">
          <div className="resume-top-label">▶ 前回の続きから<span className="resume-top-hint">（長押しで削除）</span></div>
          {sessionActive && (
            confirmDelete === 'session' ? (
              <div className="resume-top-item resume-delete-confirm">
                <span>この「続きから」を削除しますか？</span>
                <div className="btn-row">
                  <button className="btn danger sm" onClick={deleteSessionResume}>はい</button>
                  <button className="btn ghost sm" onClick={() => setConfirmDelete(null)}>いいえ</button>
                </div>
              </div>
            ) : (
              <button className="resume-top-item" {...sessionLongPress}>
                <div className="rt-main">
                  <span className="rt-ico">📚</span>
                  <span className="rt-title">学習（{session.subject === 'all' ? '全科目' : session.subject}）</span>
                  <span className="rt-frac">{session.pos}/{session.target}問</span>
                </div>
                <div className="rt-bar"><span style={{ width: `${(session.pos / session.target) * 100}%` }} /></div>
              </button>
            )
          )}
          {quizResume && (
            confirmDelete === 'quiz' ? (
              <div className="resume-top-item resume-delete-confirm">
                <span>この「続きから」を削除しますか？</span>
                <div className="btn-row">
                  <button className="btn danger sm" onClick={deleteQuizResume}>はい</button>
                  <button className="btn ghost sm" onClick={() => setConfirmDelete(null)}>いいえ</button>
                </div>
              </div>
            ) : (
              <button className="resume-top-item" {...quizLongPress}>
                <div className="rt-main">
                  <span className="rt-ico">✏️</span>
                  <span className="rt-title">一問一答（{quizResume.subject === 'all' ? '全科目' : quizResume.subject}）</span>
                  <span className="rt-frac">{quizResume.idx + 1}/{quizResume.len}問</span>
                </div>
                <div className="rt-bar"><span style={{ width: `${((quizResume.idx + 1) / quizResume.len) * 100}%` }} /></div>
              </button>
            )
          )}
        </div>
      )}

      {examLeft != null && examLeft >= 0 && (
        <button className="exam-countdown" onClick={() => onNavigate('settings')}>
          <span className="ec-days">試験日まで残り <strong>{examLeft}</strong> 日！</span>
          <span className="ec-date">試験日 {formatExamDate(settings.examDate)}</span>
        </button>
      )}

      {/* 今日の復習（SRSで期限が来ている件数）を大きく前面化 */}
      {dueCount > 0 && (
        <button className="today-review-card" onClick={() => onNavigate('review')}>
          <span className="trc-ico">🔁</span>
          <span className="trc-main">
            <span className="trc-num">{dueCount}</span>問
            <span className="trc-label">今日、復習すべき問題があります</span>
          </span>
          <span className="trc-cta">復習する →</span>
        </button>
      )}

      {/* 連続日数（ストリーク）だけを大きく表示 */}
      <div className={`streak-card${studiedToday ? ' lit' : ''}`}>
        <span className="streak-flame">{streak > 0 ? '🔥' : '🌱'}</span>
        <span className="streak-main">
          <strong>{streak}</strong>日連続
        </span>
        <span className="streak-sub">
          {studiedToday ? '今日も学習済み！' : '今日まだ未学習。1問でも解いて継続！'}
          <br />
          最長 {longestStreak}日
        </span>
      </div>

      <div className="home-hero">
        <h2>今日も一歩ずつ</h2>
        <p>合格へ向けて、着実に積み上げましょう。</p>
        <div className="hero-stats">
          <div>
            <strong>{questions.length}</strong>
            収録問題
          </div>
          <div>
            <strong>{history.length}</strong>
            のべ解答数
          </div>
          <div>
            <strong>
              {overall.accuracy == null ? '—' : Math.round(overall.accuracy * 100) + '%'}
            </strong>
            通算正答率
          </div>
          <div>
            <strong>{streak > 0 ? `🔥${streak}` : '0'}</strong>
            連続日数
          </div>
        </div>
      </div>

      <div className="menu-grid">
        <button className="menu-item wide" onClick={() => onNavigate('features')}>
          <span className="ico">🔍</span>
          <span className="title">全機能一覧</span>
          <span className="desc">このアプリの機能をすべて検索・確認できます。迷ったらここ。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('faq')}>
          <span className="ico">❓</span>
          <span className="title">鍼灸国試アプリ Q&A</span>
          <span className="desc">使い方・学習の悩み・不具合など、よくある質問をキーワードや文章で検索できます。</span>
        </button>

        {unvisitedFeature && (
          <button
            className="menu-item wide unvisited-feature-card"
            onClick={() => onNavigate(unvisitedFeature.view)}
          >
            <span className="ico">✨</span>
            <span className="title">まだ使ったことのない機能：{unvisitedFeature.title}</span>
            <span className="desc">{unvisitedFeature.desc}</span>
          </button>
        )}

        <button className="menu-item wide featured roadmap-card" onClick={() => onNavigate('roadmap')}>
          <span className="ico">🗺️</span>
          <span className="title">合格するためのロードマップ</span>
          <span className="desc">
            本番までの計画・やること/NG・新規→△✕の切替時期・手が使えない時の音声学習まで。迷ったらここ。
          </span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('cognitivestyle')}>
          <span className="ico">🧭</span>
          <span className="title">あなたの学習スタイル</span>
          <span className="desc">
            認知特性チェックの結果から、どの機能をどう使うと定着しやすいかをまとめました。
          </span>
        </button>

        <div className="card" style={{ marginBottom: 10 }}>
          <div className="section-label" style={{ marginTop: 0 }}>📍 今いる場所から始める</div>
          <p className="inline-note" style={{ marginTop: 0, marginBottom: 8 }}>
            場所によって集中できる度合いは違うので、その場に合う形を選ぶと迷わず始められます。
          </p>
          <div className="chip-row">
            {LOCATION_MODES.map((m) => (
              <button key={m.id} className="chip" onClick={() => onNavigate(m.view)} title={m.hint}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        <button className="menu-item wide featured" onClick={() => onNavigate('session')}>
          <span className="ico">📚</span>
          <span className="title">学習（10・60・300・900）</span>
          <span className="desc">
            {sessionActive
              ? `続きから：${session.subject === 'all' ? '全科目' : session.subject}　${session.pos}/${session.target}問`
              : '60問で区切り・300問で今日の目標・900問で1周。1問ごと自動保存で、いつでも続きから。'}
          </span>
        </button>

        <button className="menu-item wide featured" onClick={() => onNavigate('connect')}>
          <span className="ico">🔗</span>
          <span className="title">連結学習（今日の1問）</span>
          <span className="desc">
            過去問を一生モノの知識に。1日1問を深掘りし、キーワードでつなげて知識の地図を育てる。
          </span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('quiz')}>
          <span className="ico">✏️</span>
          <span className="title">一問一答</span>
          <span className="desc">科目別に問題演習。○×・四択に対応。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('choicequiz')}>
          <span className="ico">4️⃣</span>
          <span className="title">4択問題</span>
          <span className="desc">過去問／模試／その他から選び、科目別に四択だけを演習。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('builder')}>
          <span className="ico">🎛️</span>
          <span className="title">出題を作る</span>
          <span className="desc">科目・回次・ジャンル・問題数を指定して出題。検索も。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('mindmap')}>
          <span className="ico">🧠</span>
          <span className="title">マインドマップ</span>
          <span className="desc">つながる語・比較・数値注意を1枚に。引っかけに強くなる。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('kgraph')}>
          <span className="ico">🕸️</span>
          <span className="title">知識グラフ</span>
          <span className="desc">解くたびに概念が自動でつながる。中心概念・強い連想・次に広がる問題を提示。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('flashcards')}>
          <span className="ico">🃏</span>
          <span className="title">フラッシュカード</span>
          <span className="desc">経穴カード＋全科目対応。問題からその場でカードを作って反復。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('keizetsutextbook')}>
          <span className="ico">📖</span>
          <span className="title">経絡経穴 教科書目次</span>
          <span className="desc">教科書の章立てをページ順に要約。過去問の出題頻度を🔴🟠🟡⚪で色分け表示。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('mnemonics')}>
          <span className="ico">💡</span>
          <span className="title">語呂合わせノート</span>
          <span className="desc">登録した語呂合わせを一覧で見返す。その場で追加・編集も。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('toc')}>
          <span className="ico">📖</span>
          <span className="title">目次</span>
          <span className="desc">取り込んだ問題を科目・キーワードで一覧。範囲を選んで演習。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('review')}>
          <span className="ico">🔁</span>
          <span className="title">間違えた問題</span>
          <span className="desc">間隔反復で弱点を集中復習。</span>
          {reviewCount > 0 && <span className="count-pill">{reviewCount}問</span>}
        </button>

        <button className="menu-item" onClick={() => onNavigate('audio')}>
          <span className="ico">🎧</span>
          <span className="title">音声学習</span>
          <span className="desc">間違えた問題を読み上げ。ながら学習に。</span>
          {reviewCount > 0 && <span className="count-pill">{reviewCount}問</span>}
        </button>

        <button className="menu-item" onClick={() => onNavigate('mistakes')}>
          <span className="ico">📓</span>
          <span className="title">間違いノート</span>
          <span className="desc">間違えた問題＋メモをPDF/テキスト出力。移動中の見返しに。</span>
          {reviewCount > 0 && <span className="count-pill">{reviewCount}問</span>}
        </button>

        <button className="menu-item" onClick={() => onNavigate('explain')}>
          <span className="ico">🗣️</span>
          <span className="title">説明ノート</span>
          <span className="desc">マスター済みの問題を人に説明するつもりで書いて定着を確認。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('exam')}>
          <span className="ico">📝</span>
          <span className="title">模擬試験</span>
          <span className="desc">本番想定の問題数・制限時間で通し演習。</span>
        </button>

        <button className="menu-item wide featured" onClick={() => onNavigate('analytics')}>
          <span className="ico">📈</span>
          <span className="title">分析・攻略率・合格診断</span>
          <span className="desc">
            合格ラインまであと何%・出題範囲の攻略率・あなたの合格者スタイルを診断。
          </span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('dashboard')}>
          <span className="ico">📊</span>
          <span className="title">弱点分析</span>
          <span className="desc">科目別の正答率をグラフで確認。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('coverage')}>
          <span className="ico">🗺️</span>
          <span className="title">網羅マップ</span>
          <span className="desc">全13科目の収録状況を色で俯瞰。手薄・未収録の科目が一目で分かる。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('pasttrends')}>
          <span className="ico">📈</span>
          <span className="title">鍼灸過去問題の傾向と対策</span>
          <span className="desc">収録済み過去問（回・タグ・ジャンル）を実際に集計した頻出テーマ・頻出キーワード。学習法への活かし方も。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('migrationguide')}>
          <span className="ico">🧭</span>
          <span className="title">機種変更ガイド</span>
          <span className="desc">新しい端末への引き継ぎ方法（QR・共有・Googleドライブ・WebRTC）をデータ量に応じて自動でおすすめ。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('scope')}>
          <span className="ico">🗂️</span>
          <span className="title">試験範囲</span>
          <span className="desc">全13科目（午前/午後）と収録状況・合格ライン。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('memos')}>
          <span className="ico">📌</span>
          <span className="title">メモ一覧</span>
          <span className="desc">付箋を残した問題をまとめて確認。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('import')}>
          <span className="ico">📥</span>
          <span className="title">問題を取り込む（PDF・写真・文章・ファイル）</span>
          <span className="desc">PDFや本のページ写真、CSV/JSON、貼り付けた文章から問題を追加。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('unread')}>
          <span className="ico">📄</span>
          <span className="title">読み取れないページ</span>
          <span className="desc">
            取り込みで読み取れなかったページ・問題を控えておく。あとで読み取れたら消せる。
          </span>
          {unreadCount > 0 && <span className="count-pill">{unreadCount}件</span>}
        </button>

        <button className="menu-item" onClick={() => onNavigate('calendar')}>
          <span className="ico">🗓️</span>
          <span className="title">カレンダー</span>
          <span className="desc">勉強や試験の予定を書き込み。試験までのカウントダウンも。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('venues')}>
          <span className="ico">🏛️</span>
          <span className="title">試験会場・ホテル</span>
          <span className="desc">受験会場と近くの宿泊候補を登録・メモ。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('examcontent')}>
          <span className="ico">📋</span>
          <span className="title">鍼灸国家試験の内容</span>
          <span className="desc">試験概要・出題基準・持ち物などを貼り付けて管理。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('examday')}>
          <span className="ico">✅</span>
          <span className="title">試験当日チェックリスト</span>
          <span className="desc">持ち物・当日の流れを「前日まで／朝／会場到着後」で時系列に確認。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('experiences')}>
          <span className="ico">🗣️</span>
          <span className="title">体験談ノート（自分・他人・合格・不合格）</span>
          <span className="desc">体験談や体調・生活の気づきを記録。端末内だけに保存（非公開）。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('tools')}>
          <span className="ico">🧪</span>
          <span className="title">問題ツール（自動生成・誤りチェック）</span>
          <span className="desc">経穴マスタから問題を自動生成。既存問題の形式・重複・矛盾・経穴×経絡の誤りを点検。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('numbers')}>
          <span className="ico">🔢</span>
          <span className="title">数値の棚卸し・一括更新</span>
          <span className="desc">国民医療費・平均寿命・出生率など毎年変わる数値を、全科目まとめて更新。年1回の見直しに。</span>
        </button>

        <button className="menu-item wide" onClick={() => onNavigate('settings')}>
          <span className="ico">⚙️</span>
          <span className="title">設定・問題データ管理</span>
          <span className="desc">CSV / JSON のインポート、音声設定、データ管理。</span>
        </button>
      </div>
    </div>
  );
}
