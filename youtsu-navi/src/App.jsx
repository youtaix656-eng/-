import React, { useEffect, useMemo, useState } from 'react';
import { useStore, actions } from './lib/useStore.js';
import { isConsentValid } from './lib/consent.js';
import { symptomById } from './data/symptoms.js';
import { licenseById } from './data/licenses.js';
import Onboarding from './components/Onboarding.jsx';
import Home from './components/Home.jsx';
import Assess from './components/Assess.jsx';
import Result from './components/Result.jsx';
import Reference from './components/Reference.jsx';
import Settings from './components/Settings.jsx';

const NAV = [
  { id: 'home', icon: '🏠', label: 'ホーム' },
  { id: 'assess', icon: '📝', label: '評価' },
  { id: 'result', icon: '🧭', label: '結果' },
  { id: 'ref', icon: '📚', label: '資料' },
  { id: 'settings', icon: '⚙️', label: '設定' },
];

export default function App() {
  const state = useStore();
  const [view, setView] = useState('home');
  const symptom = useMemo(() => symptomById(state.settings.symptomId), [state.settings.symptomId]);
  const license = licenseById(state.settings.licenseId);

  // テーマ・文字サイズを <html> に反映する
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = state.settings.theme;
    el.dataset.fs = state.settings.fontScale;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.settings.theme === 'dark' ? '#000000' : '#ffffff');
  }, [state.settings.theme, state.settings.fontScale]);

  // 画面が変わったら先頭へ
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  if (!isConsentValid(state.consent)) {
    return <Onboarding state={state} onDone={() => setView('home')} />;
  }

  const go = (next) => setView(next);

  return (
    <div className="app">
      <header className="header">
        <h1>腰痛ナビ</h1>
        <div className="spacer" />
        {license ? <span className="badge-license">{license.name}</span> : <span className="badge-license">資格未設定</span>}
        <button
          type="button"
          className="icon-btn"
          aria-label={state.settings.theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
          onClick={() => actions.setSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          {state.settings.theme === 'dark' ? '☀' : '🌙'}
        </button>
      </header>

      <main>
        {view === 'home' && <Home state={state} symptom={symptom} go={go} />}
        {view === 'assess' && <Assess state={state} symptom={symptom} go={go} />}
        {view === 'result' && <Result state={state} symptom={symptom} go={go} />}
        {view === 'ref' && <Reference state={state} symptom={symptom} />}
        {view === 'settings' && <Settings state={state} />}
      </main>

      <nav className="nav" aria-label="メインナビゲーション">
        {NAV.map((n) => (
          <button key={n.id} type="button" aria-current={view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
            <b aria-hidden="true">{n.icon}</b>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
