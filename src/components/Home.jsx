import { useEffect, useState } from 'react';
import { overallStats, studyStreak } from '../lib/stats.js';
import { daysUntil, formatExamDate } from '../lib/gamify.js';
import { loadQuizProgress } from '../lib/storage.js';
import Mascot from './Mascot.jsx';

// ホーム画面：学習状況の概要と各モードへの入り口
export default function Home({ store, onNavigate, onResumeQuiz, installPrompt, onInstall }) {
  const { questions, history, reviewQuestions, session, unread, settings } = store;
  const overall = overallStats(history);
  const reviewCount = reviewQuestions.length;
  const unreadCount = (unread || []).length;
  const sessionActive = session && session.pos < session.target;
  const { streak } = studyStreak(history);
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

  return (
    <div className="view">
      {installPrompt && (
        <button className="install-btn" onClick={onInstall}>
          <span>📲 ホーム画面に追加してアプリとして使う</span>
          <span className="install-cta">追加</span>
        </button>
      )}

      {/* ハリオ先生（AIマスコット） */}
      <Mascot store={store} />

      {/* 前回の続きから（画面上部） */}
      {hasResume && (
        <div className="resume-top">
          <div className="resume-top-label">▶ 前回の続きから</div>
          {sessionActive && (
            <button className="resume-top-item" onClick={() => onNavigate('session')}>
              <div className="rt-main">
                <span className="rt-ico">📚</span>
                <span className="rt-title">学習（{session.subject === 'all' ? '全科目' : session.subject}）</span>
                <span className="rt-frac">{session.pos}/{session.target}問</span>
              </div>
              <div className="rt-bar"><span style={{ width: `${(session.pos / session.target) * 100}%` }} /></div>
            </button>
          )}
          {quizResume && (
            <button className="resume-top-item" onClick={() => (onResumeQuiz ? onResumeQuiz() : onNavigate('quiz'))}>
              <div className="rt-main">
                <span className="rt-ico">✏️</span>
                <span className="rt-title">一問一答（{quizResume.subject === 'all' ? '全科目' : quizResume.subject}）</span>
                <span className="rt-frac">{quizResume.idx + 1}/{quizResume.len}問</span>
              </div>
              <div className="rt-bar"><span style={{ width: `${((quizResume.idx + 1) / quizResume.len) * 100}%` }} /></div>
            </button>
          )}
        </div>
      )}

      {examLeft != null && examLeft >= 0 && (
        <button className="exam-countdown" onClick={() => onNavigate('settings')}>
          <span className="ec-days">試験日まで残り <strong>{examLeft}</strong> 日！</span>
          <span className="ec-date">試験日 {formatExamDate(settings.examDate)}</span>
        </button>
      )}

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
        <button className="menu-item wide featured roadmap-card" onClick={() => onNavigate('roadmap')}>
          <span className="ico">🗺️</span>
          <span className="title">合格するためのロードマップ</span>
          <span className="desc">
            本番までの計画・やること/NG・新規→△✕の切替時期・手が使えない時の音声学習まで。迷ったらここ。
          </span>
        </button>

        <button className="menu-item wide featured" onClick={() => onNavigate('session')}>
          <span className="ico">📚</span>
          <span className="title">学習（60・300・900）</span>
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

        <button className="menu-item wide" onClick={() => onNavigate('settings')}>
          <span className="ico">⚙️</span>
          <span className="title">設定・問題データ管理</span>
          <span className="desc">CSV / JSON のインポート、音声設定、データ管理。</span>
        </button>
      </div>
    </div>
  );
}
