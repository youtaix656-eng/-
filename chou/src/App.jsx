import React, { useCallback, useEffect, useState } from 'react';
import { shouldScrollTop } from './lib/focus.js';
import { useStore } from './lib/useStore.js';
import Home from './components/Home.jsx';
import Calendar from './components/Calendar.jsx';
import Look from './components/Look.jsx';
import Know from './components/Know.jsx';
import VisitNote from './components/VisitNote.jsx';
import RedFlags from './components/RedFlags.jsx';
import Fodmap from './components/Fodmap.jsx';
import Settings from './components/Settings.jsx';
import TableOfContents from './components/TableOfContents.jsx';

// 下部ナビは4つ。そのすぐ上に「受診メモをつくる」の常設バーを置く。
// 受診メモはこのアプリを持つ理由なので、思い立った時にどの画面からでも開けること。
//
// **絵文字を使わない**（環境によって色付きで描かれ、モノクロの見た目が崩れる）。
// 印はその場に線を引く（このリポジトリの他アプリと同じ線）。

const NAV = [
  { id: 'home', label: 'きょう' },
  { id: 'calendar', label: 'カレンダー' },
  { id: 'look', label: 'ふりかえり' },
  { id: 'know', label: 'しらべる' },
  { id: 'toc', label: '目次' },
];

function NavIcon({ id }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' };
  return (
    <svg viewBox="0 0 24 24" className="nav-icon" aria-hidden="true">
      {id === 'home' && <path d="M12 5v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" {...s} />}
      {id === 'calendar' && (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" {...s} />
          <path d="M4 10h16M9 3v4M15 3v4" {...s} />
        </>
      )}
      {id === 'look' && <path d="M4 18l5-6 4 3 6-8M4 20V4" {...s} />}
      {id === 'know' && (
        <>
          <circle cx="11" cy="11" r="6" {...s} />
          <path d="M15.5 15.5L21 21" {...s} />
        </>
      )}
      {id === 'toc' && <path d="M4 6h16M4 12h16M4 18h10" {...s} />}
    </svg>
  );
}

export default function App() {
  const store = useStore();
  const [view, setView] = useState('home');
  const [focus, setFocus] = useState('');

  useEffect(() => {
    const theme = store.settings.theme;
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [store.settings.theme]);

  // **飛び先を指定した移動では画面の先頭へ戻さない**（戻すと、運んだ画面が直後に引き戻される。
  // 鏡で実際に踏んだ事故）。判定は `lib/focus.js` の `shouldScrollTop` が単一の正。
  const go = useCallback((next, targetId) => {
    setView(next);
    setFocus(targetId || '');
    if (shouldScrollTop(targetId)) window.scrollTo(0, 0);
  }, []);

  const clearFocus = useCallback(() => setFocus(''), []);

  return (
    <div className="app">
      {store.saveFailed && (
        <p className="save-failed">
          この端末に保存できていません（ブラウザの設定で保存が止められているかもしれません）。
          書いたものが残らない状態です。
        </p>
      )}

      <main>
        {view === 'home' && <Home store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'calendar' && <Calendar store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'look' && <Look store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'know' && <Know onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'visitnote' && <VisitNote store={store} focus={focus} onFocusDone={clearFocus} />}
        {view === 'redflags' && <RedFlags focus={focus} onFocusDone={clearFocus} />}
        {view === 'fodmap' && <Fodmap store={store} focus={focus} onFocusDone={clearFocus} />}
        {view === 'settings' && <Settings store={store} focus={focus} onFocusDone={clearFocus} />}
        {view === 'toc' && (
          <TableOfContents store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
      </main>

      {store.undo && (
        <div className="undo-bar" role="status">
          <span>{store.undo.label}</span>
          <button type="button" onClick={store.runUndo}>
            元に戻す
          </button>
          <button type="button" className="ghost small" onClick={store.clearUndo}>
            閉じる
          </button>
        </div>
      )}

      {view !== 'visitnote' && (
        <div className="note-bar">
          <button type="button" onClick={() => go('visitnote')}>
            受診メモをつくる
          </button>
        </div>
      )}

      <nav className="nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'on' : ''}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <NavIcon id={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
