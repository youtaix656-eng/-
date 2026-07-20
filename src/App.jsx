import { useEffect, useRef, useState } from 'react';
import { useStore } from './lib/useStore.js';
import { exportAll } from './lib/storage.js';
import Home from './components/Home.jsx';
import Quiz from './components/Quiz.jsx';
import Review from './components/Review.jsx';
import AudioMode from './components/AudioMode.jsx';
import Exam from './components/Exam.jsx';
import Dashboard from './components/Dashboard.jsx';
import Memos from './components/Memos.jsx';
import Settings from './components/Settings.jsx';
import Ocr from './components/Ocr.jsx';
import QuestionTools from './components/QuestionTools.jsx';
import ExamScope from './components/ExamScope.jsx';
import ConnectedLearning from './components/ConnectedLearning.jsx';
import Builder from './components/Builder.jsx';

const NAV = [
  { id: 'home', label: 'ホーム', ico: '🏠' },
  { id: 'quiz', label: '一問一答', ico: '✏️' },
  { id: 'review', label: '復習', ico: '🔁' },
  { id: 'audio', label: '音声', ico: '🎧' },
  { id: 'exam', label: '模試', ico: '📝' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const store = useStore();
  const [view, setView] = useState('home');
  const [toast, setToast] = useState(null);
  const [importText, setImportText] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [quizSubject, setQuizSubject] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState(null);
  const [focusKeyword, setFocusKeyword] = useState(null);

  const showToast = (msg) => setToast(msg);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // PWA インストールプロンプトを捕捉
  useEffect(() => {
    const onBip = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  // 全データバックアップ（reminder / 自動バックアップ共通）
  const doBackup = async (silent = false) => {
    const data = await exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(
      JSON.stringify(data, null, 2),
      `shinkyu_backup_${stamp}.json`,
      'application/json'
    );
    store.markBackedUp();
    if (!silent) showToast('バックアップを保存しました');
  };

  // 起動時の自動バックアップ（1日1回まで）
  const autoBackupDone = useRef(false);
  useEffect(() => {
    if (!store.loaded || autoBackupDone.current) return;
    autoBackupDone.current = true;
    const { autoBackupOnStart, lastAutoBackup } = store.settings;
    if (autoBackupOnStart && Date.now() - (lastAutoBackup || 0) > DAY_MS) {
      // 履歴が空のときは何もしない
      if (store.history.length > 0) doBackup(true);
    }
  }, [store.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const openOcr = () => setView('ocr');
  const startSubjectQuiz = (subjectName) => {
    setQuizSubject(subjectName);
    setView('quiz');
  };
  const openKeyword = (kw) => {
    setFocusKeyword(kw);
    setView('connect');
  };
  const startCustomQuiz = (questionsList) => {
    setQuizQuestions(questionsList);
    setView('quiz');
  };
  const sendOcrToImport = (csv) => {
    setImportText(csv);
    setView('settings');
  };

  // ---- 初期ロード中 ----
  if (!store.loaded) {
    return (
      <div className="splash">
        <div className="splash-logo">🩺</div>
        <div className="splash-title">鍼灸国試 対策アプリ</div>
        <div className="splash-sub">データを読み込んでいます…</div>
      </div>
    );
  }

  const reviewCount = store.reviewQuestions.length;
  const needBackup =
    (store.settings.answersSinceBackup || 0) >= (store.settings.backupReminderEvery || 50);

  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <Home
            store={store}
            onNavigate={setView}
            installPrompt={installPrompt}
            onInstall={installApp}
          />
        );
      case 'quiz':
        return (
          <Quiz
            store={store}
            initialSubject={quizSubject}
            initialQuestions={quizQuestions}
            onConsumed={() => {
              setQuizSubject(null);
              setQuizQuestions(null);
            }}
            onOpenKeyword={openKeyword}
          />
        );
      case 'review':
        return <Review store={store} onOpenKeyword={openKeyword} />;
      case 'audio':
        return <AudioMode store={store} />;
      case 'exam':
        return <Exam store={store} />;
      case 'dashboard':
        return <Dashboard store={store} />;
      case 'memos':
        return <Memos store={store} />;
      case 'ocr':
        return <Ocr onToast={showToast} onSendToImport={sendOcrToImport} />;
      case 'tools':
        return <QuestionTools store={store} onToast={showToast} />;
      case 'scope':
        return (
          <ExamScope
            store={store}
            onStartSubject={startSubjectQuiz}
            onOpenSettings={() => setView('settings')}
          />
        );
      case 'builder':
        return <Builder store={store} onStartQuiz={startCustomQuiz} onOpenKeyword={openKeyword} />;
      case 'connect':
        return (
          <ConnectedLearning
            store={store}
            onToast={showToast}
            focusKeyword={focusKeyword}
            onConsumeKeyword={() => setFocusKeyword(null)}
          />
        );
      case 'settings':
        return (
          <Settings
            store={store}
            onToast={showToast}
            onOpenOcr={openOcr}
            importText={importText}
            onConsumeImportText={() => setImportText('')}
          />
        );
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
      ocr: '写真から取り込み',
      tools: '問題ツール',
      scope: '試験範囲',
      connect: '連結学習',
      builder: '出題を作る',
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
                className="back-btn"
                aria-label="ホームへ"
              >
                ‹
              </button>
              {headerTitle()}
            </>
          )}
        </h1>
        {view === 'home' && <p className="subtitle">過去問ベースで、合格まで着実に。</p>}
      </header>

      <main>
        {/* バックアップ促しバナー */}
        {needBackup && view !== 'settings' && (
          <div className="reminder-banner">
            <span>
              📌 前回のバックアップから{store.settings.answersSinceBackup}問解きました。データ消失に備えて保存しましょう。
            </span>
            <div className="reminder-actions">
              <button className="btn sm primary" onClick={() => doBackup(false)}>
                今すぐ保存
              </button>
              <button
                className="btn sm ghost"
                onClick={() => store.markBackedUp()}
                aria-label="あとで"
              >
                あとで
              </button>
            </div>
          </div>
        )}
        {renderView()}
      </main>

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
