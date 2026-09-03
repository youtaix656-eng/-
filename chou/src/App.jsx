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
import Combine from './components/Combine.jsx';
import Probiotics from './components/Probiotics.jsx';
import Seasonings from './components/Seasonings.jsx';
import Cleanup from './components/Cleanup.jsx';
import Prebiotics from './components/Prebiotics.jsx';
import Butyrate from './components/Butyrate.jsx';
import OtcDrugs from './components/OtcDrugs.jsx';
import GutHabits from './components/GutHabits.jsx';
import Protein from './components/Protein.jsx';
import Fasting from './components/Fasting.jsx';
import Morning from './components/Morning.jsx';
import ScaredFoods from './components/ScaredFoods.jsx';
import Ibs from './components/Ibs.jsx';
import Digest from './components/Digest.jsx';
import Diseases from './components/Diseases.jsx';
import Breathing from './components/Breathing.jsx';
import IbsCare from './components/IbsCare.jsx';
import EatingOut from './components/EatingOut.jsx';
import Flora from './components/Flora.jsx';
import Visits from './components/Visits.jsx';
import Periods from './components/Periods.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScrollArrows from './components/ScrollArrows.jsx';

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
  // ホーム画面のショートカット（manifest の `?view=`）から開いた時だけ、その画面で始める。
  // **知らない名前は無視して「きょう」へ**（当てずっぽうで別の画面を開かない）。
  const [view, setView] = useState(() => {
    try {
      const want = new URLSearchParams(window.location.search).get('view');
      return want === 'visitnote' || want === 'home' ? want : 'home';
    } catch {
      return 'home';
    }
  });
  const [focus, setFocus] = useState('');
  const [navArg, setNavArg] = useState('');

  useEffect(() => {
    const theme = store.settings.theme;
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [store.settings.theme]);

  // 読みやすさの設定は、根っこの属性で受ける（CSS だけで効かせる＝画面ごとに書かない）
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-text', store.settings.textSize || 'normal');
    root.setAttribute('data-contrast', store.settings.contrast || 'normal');
    if (store.settings.reduceMotion) root.setAttribute('data-motion', 'reduce');
    else root.removeAttribute('data-motion');
  }, [store.settings.textSize, store.settings.contrast, store.settings.reduceMotion]);

  // **飛び先を指定した移動では画面の先頭へ戻さない**（戻すと、運んだ画面が直後に引き戻される。
  // 鏡で実際に踏んだ事故）。判定は `lib/focus.js` の `shouldScrollTop` が単一の正。
  // 第3引数は「その画面へ持っていく値」（いまはカレンダーの日付だけ）。
  // **一度使ったら消す**——戻ってきたときに前の値で開き直さないため。
  const go = useCallback((next, targetId, arg) => {
    setView(next);
    setFocus(targetId || '');
    setNavArg(arg || '');
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
        <ErrorBoundary where={view} onError={store.logError} onReset={() => go('home')} key={view}>
        {view === 'home' && <Home store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'calendar' && (
          <Calendar store={store} onGo={go} focus={focus} onFocusDone={clearFocus} openDate={navArg} />
        )}
        {view === 'look' && <Look store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'know' && <Know onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'visitnote' && (
          <VisitNote store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'redflags' && <RedFlags focus={focus} onFocusDone={clearFocus} />}
        {view === 'fodmap' && <Fodmap store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'combine' && (
          <Combine store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'probiotics' && (
          <Probiotics store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'seasonings' && (
          <Seasonings store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'cleanup' && (
          <Cleanup store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'prebiotics' && (
          <Prebiotics store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'butyrate' && <Butyrate onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'otc' && <OtcDrugs onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'habits' && <GutHabits onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'protein' && (
          <Protein store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'fasting' && <Fasting onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'morning' && <Morning onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'scared' && <ScaredFoods onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'ibs' && <Ibs onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'digest' && <Digest onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'diseases' && <Diseases onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'breathing' && <Breathing onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'ibscare' && (
          <IbsCare store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'eatingout' && <EatingOut onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'flora' && <Flora onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'visits' && (
          <Visits store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'periods' && (
          <Periods store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        {view === 'settings' && <Settings store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />}
        {view === 'toc' && (
          <TableOfContents store={store} onGo={go} focus={focus} onFocusDone={clearFocus} />
        )}
        </ErrorBoundary>
      </main>
      <ScrollArrows />

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
