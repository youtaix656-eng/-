import { useEffect, useState } from 'react';
import { actions, useStore } from './lib/useStore.js';
import { applyDisguise } from './lib/disguise.js';
import { HomeView } from './components/HomeView.js';
import { RecordView } from './components/RecordView.js';
import { AnalyzeView } from './components/AnalyzeView.js';
import { MeditateView } from './components/MeditateView.js';
import { BadgeView } from './components/BadgeView.js';
import { SettingsView } from './components/SettingsView.js';
import { EmergencyOverlay } from './components/EmergencyOverlay.js';
import { LockGate } from './components/LockGate.js';

const NAV = [
  { id: 'home', label: 'ホーム', ico: '🏠' },
  { id: 'record', label: '記録', ico: '📝' },
  { id: 'analyze', label: '分析', ico: '📊' },
  { id: 'meditate', label: '瞑想', ico: '🧘' },
  { id: 'badges', label: '実績', ico: '🎖' },
  { id: 'settings', label: '設定', ico: '⚙️' },
];

export default function App() {
  const state = useStore();
  const [view, setView] = useState<string>('home');
  const [now, setNow] = useState(() => Date.now());
  const [sos, setSos] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // 読み込みが済むまで「ロックなし」と決めない（決めると、一瞬だけ中身が見える）
  useEffect(() => {
    void actions.hydrate().then(() => setHydrated(true));
  }, []);

  // 経過時間の表示だけを更新する（1分に1回。秒単位で動かすと落ち着かない）
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    applyDisguise(state.settings.disguiseEnabled, state.settings.disguiseTitle, state.settings.disguiseIcon);
  }, [state.settings.disguiseEnabled, state.settings.disguiseTitle, state.settings.disguiseIcon]);

  useEffect(() => {
    if (hydrated) setView(state.settings.lastView || 'home');
    // 起動時に一度だけ、前に見ていた画面へ戻す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const go = (next: string) => {
    setView(next);
    actions.setSettings({ lastView: next });
    window.scrollTo({ top: 0 });
  };

  if (!hydrated) {
    return <div className="lock"><p className="small">読み込んでいます…</p></div>;
  }

  if (state.settings.pinHash && !unlocked) {
    return <LockGate state={state} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{state.settings.disguiseEnabled && state.settings.disguiseTitle ? state.settings.disguiseTitle : 'クンダリーニトラッカー'}</h1>
        <span className="sub">端末の中だけに保存</span>
      </header>

      {view === 'home' && <HomeView state={state} now={now} onNavigate={go} />}
      {view === 'record' && <RecordView state={state} now={now} />}
      {view === 'analyze' && <AnalyzeView state={state} now={now} />}
      {view === 'meditate' && <MeditateView state={state} />}
      {view === 'badges' && <BadgeView state={state} now={now} />}
      {view === 'settings' && <SettingsView state={state} />}

      {!sos && (
        <button className="sos-fab" onClick={() => setSos(true)} aria-label="衝動が来たとき">
          いま<br />つらい
        </button>
      )}
      {sos && <EmergencyOverlay state={state} onClose={() => setSos(false)} />}

      <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${NAV.length}, 1fr)` }}>
        {NAV.map((n) => (
          <button key={n.id} className={view === n.id ? 'on' : ''} onClick={() => go(n.id)} aria-current={view === n.id}>
            <span className="ico" aria-hidden="true">{n.ico}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
