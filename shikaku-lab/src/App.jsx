import React, { useEffect, useState } from 'react';
import { useStore, actions } from './lib/useStore.js';
import { resolveExam } from './lib/myExam.js';
import PomodoroBar from './components/PomodoroBar.jsx';
import Home from './components/Home.jsx';
import Exams from './components/Exams.jsx';
import Convert from './components/Convert.jsx';
import Plan from './components/Plan.jsx';
import Spec from './components/Spec.jsx';
import TableOfContents from './components/TableOfContents.jsx';
import Settings from './components/Settings.jsx';

// 下部ナビは6つ。**ポモドーロタイマーは画面のいちばん上に常設**（どの画面でも消えない）。
// 設定はヘッダーの歯車から開く（ナビと二重にしない）。
const NAV = [
  { id: 'home', icon: '🏠', label: 'ホーム' },
  { id: 'exams', icon: '🎓', label: '試験' },
  { id: 'convert', icon: '🔁', label: '変換' },
  { id: 'plan', icon: '🗺', label: '計画' },
  { id: 'spec', icon: '🛠', label: '設計' },
  { id: 'toc', icon: '📖', label: '目次' },
];

export default function App() {
  const state = useStore();
  const [view, setView] = useState('home');
  const [focus, setFocus] = useState(null);
  const exam = resolveExam(state.settings.examId, state.myExams);

  // テーマ・文字サイズを <html> に反映する
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = state.settings.theme;
    el.dataset.fs = state.settings.fontScale;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.settings.theme === 'dark' ? '#000000' : '#ffffff');
  }, [state.settings.theme, state.settings.fontScale]);

  // 画面が変わったら先頭へ。目次から飛んだ時は、その項目まで送る
  useEffect(() => {
    if (focus?.anchor) {
      const el = document.getElementById(focus.anchor);
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [view, focus]);

  // 設計書を一度開いたことを覚える（道しるべの最後の1つ）
  useEffect(() => {
    if (view === 'spec' && !state.settings.didOpenSpec) actions.setSettings({ didOpenSpec: true });
  }, [view, state.settings.didOpenSpec]);

  const go = (next, nextFocus = null) => {
    setFocus(nextFocus);
    setView(next);
  };

  return (
    <div className="app">
      <PomodoroBar state={state} />

      <header className="header">
        <h1>資格ラボ</h1>
        <div className="spacer" />
        <span className="badge-exam">{exam ? exam.name : '試験 未選択'}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="設定を開く"
          aria-current={view === 'settings' ? 'page' : undefined}
          onClick={() => go('settings')}
        >
          ⚙️
        </button>
      </header>

      <main>
        {view === 'home' && <Home state={state} go={go} />}
        {view === 'exams' && <Exams state={state} go={go} focus={focus} />}
        {view === 'convert' && <Convert state={state} go={go} />}
        {view === 'plan' && <Plan state={state} go={go} />}
        {view === 'spec' && <Spec state={state} go={go} />}
        {view === 'toc' && <TableOfContents go={go} />}
        {view === 'settings' && <Settings state={state} />}
      </main>

      <nav className="nav" aria-label="画面の切り替え">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={view === n.id ? 'on' : ''}
            aria-current={view === n.id ? 'page' : undefined}
            onClick={() => go(n.id)}
          >
            <span className="ico" aria-hidden="true">
              {n.icon}
            </span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
