import { useEffect, useRef, useState } from 'react';
import { useStore } from './lib/useStore.js';
import { exportAll, loadLastView, saveLastView } from './lib/storage.js';
import { daysUntil } from './lib/gamify.js';
import { haripanReminder } from './data/haripan.js';
import { speak, cancelSpeech, isSpeechSupported } from './lib/speech.js';
import Home from './components/Home.jsx';
import Quiz from './components/Quiz.jsx';
import Session from './components/Session.jsx';
import Review from './components/Review.jsx';
import AudioMode from './components/AudioMode.jsx';
import Exam from './components/Exam.jsx';
import ChoiceQuiz from './components/ChoiceQuiz.jsx';
import MnemonicNotebook from './components/MnemonicNotebook.jsx';
import Dashboard from './components/Dashboard.jsx';
import Analytics from './components/Analytics.jsx';
import Memos from './components/Memos.jsx';
import Settings from './components/Settings.jsx';
import Ocr from './components/Ocr.jsx';
import QuestionTools from './components/QuestionTools.jsx';
import ExamScope from './components/ExamScope.jsx';
import ConnectedLearning from './components/ConnectedLearning.jsx';
import Builder from './components/Builder.jsx';
import Import from './components/Import.jsx';
import Parse from './components/Parse.jsx';
import NoteGen from './components/NoteGen.jsx';
import Calendar from './components/Calendar.jsx';
import Venues from './components/Venues.jsx';
import ExamContent from './components/ExamContent.jsx';
import Experiences from './components/Experiences.jsx';
import MindMap from './components/MindMap.jsx';
import TableOfContents from './components/TableOfContents.jsx';
import MiniPlayer from './components/MiniPlayer.jsx';
import UnreadPages from './components/UnreadPages.jsx';
import AuthGate from './components/AuthGate.jsx';
import Pomodoro from './components/Pomodoro.jsx';
import MistakeNote from './components/MistakeNote.jsx';
import Roadmap from './components/Roadmap.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import NumberFacts from './components/NumberFacts.jsx';
import CoverageMap from './components/CoverageMap.jsx';
import KnowledgeGraph from './components/KnowledgeGraph.jsx';
import Flashcards from './components/Flashcards.jsx';

const UNLOCK_KEY = 'shinkyu:unlocked';

const NAV = [
  { id: 'home', label: 'ホーム', ico: '🏠' },
  { id: 'quiz', label: '一問一答', ico: '✏️' },
  { id: 'review', label: '復習', ico: '🔁' },
  { id: 'audio', label: '音声', ico: '🎧' },
  { id: 'exam', label: '模試', ico: '📝' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// 画面 → 表示タイトル（ヘッダー・履歴で共用）
const VIEW_TITLES = {
  home: '鍼灸国試 対策アプリ',
  quiz: '一問一答',
  choicequiz: '4択問題',
  session: '学習（10・60・300・900）',
  review: '間違えた問題',
  audio: '音声学習',
  exam: '模擬試験',
  dashboard: '弱点分析',
  coverage: '網羅マップ',
  kgraph: '知識グラフ',
  analytics: '分析・攻略率・合格診断',
  roadmap: '合格するためのロードマップ',
  unread: '読み取れないページ',
  mistakes: '間違いノート',
  numbers: '数値の棚卸し・一括更新',
  memos: 'メモ一覧',
  ocr: '写真から取り込み',
  tools: '問題ツール',
  scope: '試験範囲',
  connect: '連結学習',
  builder: '出題を作る',
  import: '問題を取り込む',
  parse: '自由文から自動作成',
  notegen: '文章から問題を作る',
  calendar: 'カレンダー',
  venues: '試験会場・ホテル',
  examcontent: '鍼灸国家試験の内容',
  experiences: '体験談ノート',
  mindmap: 'マインドマップ',
  flashcards: 'フラッシュカード',
  mnemonics: '語呂合わせノート',
  toc: '目次',
  settings: '設定',
};

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
  const [quizAutoResume, setQuizAutoResume] = useState(false);
  const [focusKeyword, setFocusKeyword] = useState(null);
  const [audioReview, setAudioReview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === '1';
    } catch (e) {
      return false;
    }
  });

  const examDaysLeft = () => daysUntil(store.settings.examDate);
  const showToast = (msg) => setToast(msg);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // 前回開いていた画面を復元（アプリを閉じて開き直しても続きから）
  const viewRestored = useRef(false);
  useEffect(() => {
    if (!store.loaded || viewRestored.current) return;
    let cancelled = false;
    loadLastView().then((v) => {
      if (cancelled) return;
      // ハッシュ経由の取り込み等で既に他画面へ切り替わっている場合は尊重
      if (v && typeof v === 'string' && v !== 'home') {
        setView((cur) => (cur === 'home' ? v : cur));
      }
      // 復元が完了してから保存を有効化する（初期の 'home' で上書きしないため）
      viewRestored.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [store.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 画面を切り替えるたびに保存（復元完了後のみ）
  useEffect(() => {
    if (store.loaded && viewRestored.current) saveLastView(view);
  }, [view, store.loaded]);

  // 直近の履歴に記録（ホーム以外の画面を開いたとき）。復元完了後のみ。
  useEffect(() => {
    if (!store.loaded || !viewRestored.current || view === 'home') return;
    store.logActivity(activityInfo(view));
  }, [view, store.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 端末だけに取り込む体験メモ（#notes=…）を反映したら知らせて画面を開く
  useEffect(() => {
    if (store.seedToast > 0) {
      showToast(`体験談を${store.seedToast}件、この端末に取り込みました`);
      setView('experiences');
      store.clearSeedToast();
    }
  }, [store.seedToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // チャットから投げた問題の取り込みリンク（#import=…）を反映したら目次を開く
  useEffect(() => {
    if (store.importedToast > 0) {
      showToast(`問題を${store.importedToast}問、この端末に取り込みました`);
      setView('toc');
      store.clearImportedToast();
    }
  }, [store.importedToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // 別端末からQR/URLで進捗を取り込んだら知らせてホームへ
  useEffect(() => {
    if (store.syncToast > 0) {
      showToast('別端末の学習データを取り込みました');
      setView('home');
      store.clearSyncToast();
    }
  }, [store.syncToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // 毎日のリマインド通知（指定時刻以降にアプリを開いていたら1日1回）
  useEffect(() => {
    if (!store.loaded) return;
    const check = () => {
      const r = store.settings.reminder;
      if (!r || !r.enabled) return;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (r.lastNotified === today) return;
      const [hh, mm] = String(r.time || '07:00').split(':').map((x) => parseInt(x, 10));
      const target = new Date(now);
      target.setHours(hh || 7, mm || 0, 0, 0);
      if (now < target) return;
      // ハリオ先生からのリマインド（通知＋アプリ内トースト＋読み上げ）
      const body = haripanReminder(store.settings.examDate);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('ハリオ先生', { body });
        }
      } catch (e) {
        /* noop */
      }
      showToast(`🩹 ハリオ先生：${body}`);
      // アプリを開いていれば声で伝える（喋る）
      try {
        if (isSpeechSupported() && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          cancelSpeech();
          speak(body, { rate: store.settings.speechRate || 1, pitch: store.settings.speechPitch || 1 }).catch(() => {});
        }
      } catch (e) {
        /* noop */
      }
      store.updateSettings({ reminder: { ...r, lastNotified: today } });
    };
    check();
    const iv = setInterval(check, 60 * 1000);
    return () => clearInterval(iv);
  }, [store.loaded, store.settings.reminder]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 履歴に残す情報（タイトル・ジャンル）を今の文脈から組み立てる
  const activityInfo = (v) => {
    const info = { view: v, title: VIEW_TITLES[v] || '', genre: '', subject: '', keyword: '' };
    if (v === 'quiz' && quizSubject) {
      info.subject = quizSubject;
      info.title = `一問一答：${quizSubject}`;
      info.genre = quizSubject;
    } else if (v === 'session') {
      const s = store.session && store.session.subject && store.session.subject !== 'all' ? store.session.subject : '';
      if (s) info.genre = s;
      info.subject = s;
    } else if ((v === 'connect' || v === 'mindmap') && focusKeyword) {
      info.keyword = focusKeyword;
      info.genre = focusKeyword;
    }
    return info;
  };

  // 履歴カードのダブルタップで元の画面へ飛ぶ
  const jumpToActivity = (e) => {
    setShowHistory(false);
    if (e.view === 'quiz' && e.subject) {
      startSubjectQuiz(e.subject);
    } else if (e.view === 'connect' && e.keyword) {
      openKeyword(e.keyword);
    } else {
      setView(e.view);
    }
  };

  const unlock = () => {
    try {
      sessionStorage.setItem(UNLOCK_KEY, '1');
    } catch (e) {
      /* noop */
    }
    setUnlocked(true);
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

  // ---- ログイン（端末内ロック）----
  // 鍵が設定済みで未解錠ならログイン画面。未設定なら初回のみ設定画面（スキップ可）。
  if (store.auth && !unlocked) {
    return <AuthGate mode="login" auth={store.auth} onSetAuth={store.setAuth} onUnlock={unlock} />;
  }
  if (!store.auth && !store.settings.authSkipped) {
    return (
      <AuthGate
        mode="setup"
        auth={null}
        onSetAuth={store.setAuth}
        onUnlock={unlock}
        onSkip={() => store.updateSettings({ authSkipped: true })}
      />
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
            onResumeQuiz={() => {
              setQuizAutoResume(true);
              setView('quiz');
            }}
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
            autoResume={quizAutoResume}
            onConsumeAutoResume={() => setQuizAutoResume(false)}
            onConsumed={() => {
              setQuizSubject(null);
              setQuizQuestions(null);
            }}
            onOpenKeyword={openKeyword}
          />
        );
      case 'session':
        return (
          <Session
            store={store}
            onToast={showToast}
            onOpenKeyword={openKeyword}
            onGoReview={() => setView('review')}
          />
        );
      case 'review':
        return (
          <Review
            store={store}
            onOpenKeyword={openKeyword}
            onGoAudio={() => {
              setAudioReview(true);
              setView('audio');
            }}
          />
        );
      case 'audio':
        return (
          <AudioMode
            store={store}
            onToast={showToast}
            reviewPreset={audioReview}
            onConsumePreset={() => setAudioReview(false)}
          />
        );
      case 'exam':
        return <Exam store={store} />;
      case 'choicequiz':
        return <ChoiceQuiz store={store} onStartQuiz={startCustomQuiz} />;
      case 'dashboard':
        return <Dashboard store={store} />;
      case 'analytics':
        return <Analytics store={store} onNavigate={setView} />;
      case 'unread':
        return <UnreadPages store={store} onToast={showToast} onOpenImport={() => setView('import')} />;
      case 'mistakes':
        return <MistakeNote store={store} onToast={showToast} />;
      case 'numbers':
        return <NumberFacts store={store} onToast={showToast} />;
      case 'coverage':
        return <CoverageMap store={store} onStartSubject={startSubjectQuiz} />;
      case 'kgraph':
        return <KnowledgeGraph store={store} onOpenKeyword={openKeyword} onStudyConcepts={(concepts) => {
          const set = new Set(concepts);
          const qs = store.questions.filter((q) => (q.tags || []).some((t) => set.has(t)));
          if (qs.length) startCustomQuiz(qs);
        }} />;
      case 'roadmap':
        return <Roadmap store={store} onNavigate={setView} />;
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
      case 'import':
        return (
          <Import
            onSendToImport={sendOcrToImport}
            onOpenOcr={openOcr}
            onOpenParse={() => setView('parse')}
            onOpenNoteGen={() => setView('notegen')}
            onOpenUnread={() => setView('unread')}
            onToast={showToast}
          />
        );
      case 'parse':
        return <Parse store={store} onToast={showToast} onDone={() => setView('import')} />;
      case 'notegen':
        return <NoteGen store={store} onToast={showToast} onDone={() => setView('import')} />;
      case 'calendar':
        return <Calendar store={store} onToast={showToast} />;
      case 'venues':
        return <Venues store={store} onToast={showToast} />;
      case 'examcontent':
        return <ExamContent store={store} onToast={showToast} />;
      case 'experiences':
        return <Experiences store={store} onToast={showToast} />;
      case 'mindmap':
        return <MindMap store={store} onOpenKeyword={openKeyword} />;
      case 'flashcards':
        return <Flashcards store={store} />;
      case 'mnemonics':
        return <MnemonicNotebook store={store} onToast={showToast} />;
      case 'toc':
        return <TableOfContents store={store} onStartQuiz={startCustomQuiz} onOpenKeyword={openKeyword} />;
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

  const headerTitle = () => VIEW_TITLES[view] || '鍼灸国試 対策アプリ';

  const pomoOn = !!(store.settings.pomodoro && store.settings.pomodoro.enabled);

  return (
    <div className={`app${pomoOn ? ' has-pomo' : ''}`}>
      <Pomodoro store={store} onToast={showToast} />
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
        {view === 'home' && (
          <button
            className="hist-open-btn"
            onClick={() => setShowHistory(true)}
            aria-label="直近の履歴"
            title="直近の履歴"
          >
            🕘
          </button>
        )}
      </header>

      {showHistory && (
        <HistoryPanel
          activity={store.activity}
          onClose={() => setShowHistory(false)}
          onJump={jumpToActivity}
          onClear={store.clearActivity}
        />
      )}

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

      {/* 音声ミニプレーヤー：他の画面へ移っても再生を続けられる（音声画面では非表示） */}
      <MiniPlayer hidden={view === 'audio'} onOpen={() => setView('audio')} />

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
