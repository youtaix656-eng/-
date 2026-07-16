import { overallStats } from '../lib/stats.js';

// ホーム画面：学習状況の概要と各モードへの入り口
export default function Home({ store, onNavigate, installPrompt, onInstall }) {
  const { questions, history, reviewQuestions } = store;
  const overall = overallStats(history);
  const reviewCount = reviewQuestions.length;

  return (
    <div className="view">
      {installPrompt && (
        <button className="install-btn" onClick={onInstall}>
          <span>📲 ホーム画面に追加してアプリとして使う</span>
          <span className="install-cta">追加</span>
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
        </div>
      </div>

      <div className="menu-grid">
        <button className="menu-item" onClick={() => onNavigate('quiz')}>
          <span className="ico">✏️</span>
          <span className="title">一問一答</span>
          <span className="desc">科目別に問題演習。○×・四択に対応。</span>
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

        <button className="menu-item" onClick={() => onNavigate('exam')}>
          <span className="ico">📝</span>
          <span className="title">模擬試験</span>
          <span className="desc">本番想定の問題数・制限時間で通し演習。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('dashboard')}>
          <span className="ico">📊</span>
          <span className="title">弱点分析</span>
          <span className="desc">科目別の正答率をグラフで確認。</span>
        </button>

        <button className="menu-item" onClick={() => onNavigate('memos')}>
          <span className="ico">📌</span>
          <span className="title">メモ一覧</span>
          <span className="desc">付箋を残した問題をまとめて確認。</span>
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
