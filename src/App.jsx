import { useEffect, useState } from 'react';
import { useStore } from './lib/useStore.js';
import Home from './components/Home.jsx';
import Quiz from './components/Quiz.jsx';
import Review from './components/Review.jsx';
import AudioMode from './components/AudioMode.jsx';
import Exam from './components/Exam.jsx';
import Dashboard from './components/Dashboard.jsx';
import Memos from './components/Memos.jsx';
import Settings from './components/Settings.jsx';

const NAV = [
  { id: 'home', label: 'ホーム', ico: '🏠' },
  { id: 'quiz', label: '一問一答', ico: '✏️' },
  { id: 'review', label: '復習', ico: '🔁' },
  { id: 'audio', label: '音声', ico: '🎧' },
  { id: 'exam', label: '模試', ico: '📝' },
];

export default function App() {
  const store = useStore();
  const [view, setView] = useState('home');
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // ビュー切り替え時に先頭へスクロール
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const reviewCount = store.reviewQuestions.length;

  const renderView = () => {
    switch (view) {
      case 'home':
        return <Home store={store} onNavigate={setView} />;
      case 'quiz':
        return <Quiz store={store} />;
      case 'review':
        return <Review store={store} />;
      case 'audio':
        return <AudioMode store={store} />;
      case 'exam':
        return <Exam store={store} />;
      case 'dashboard':
        return <Dashboard store={store} />;
      case 'memos':
        return <Memos store={store} />;
      case 'settings':
        return <Settings store={store} onToast={showToast} />;
      default:
        return <Home store={store} onNavigate={setView} />;
    }
  };

  const headerTitle = () => {
    const map = {
      home: '鍼灸国試 対策アプリ',
      quiz: '一問一答',
      review: '間違えた問題',
      audio: '音声学習',
      exam: '模擬試験',
      dashboard: '弱点分析',
      memos: 'メモ一覧',
      settings: '設定',
    };
    return map[view] || '鍼灸国試 対策アプリ';
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          {view === 'home' ? (
            <>🩺 鍼灸国試 対策アプリ</>
          ) : (
            <>
              <button
                onClick={() => setView('home')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: 18,
                  padding: 0,
                  marginRight: 2,
                }}
                aria-label="ホームへ"
              >
                ‹
              </button>
              {headerTitle()}
            </>
          )}
        </h1>
        {view === 'home' && (
          <p className="subtitle">過去問ベースで、合格まで着実に。</p>
        )}
      </header>

      <main>{renderView()}</main>

      {toast && <div className="toast">{toast}</div>}

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? 'active' : ''}
            onClick={() => setView(n.id)}
          >
            <span className="ico" style={{ position: 'relative' }}>
              {n.ico}
              {n.id === 'review' && reviewCount > 0 && (
                <span className="nav-dot">{reviewCount > 99 ? '99+' : reviewCount}</span>
              )}
            </span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
