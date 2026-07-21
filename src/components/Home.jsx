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
