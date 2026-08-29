import React, { useEffect, useState } from 'react';
import Search from './components/Search.jsx';
import Toc from './components/Toc.jsx';
import Saved from './components/Saved.jsx';
import About from './components/About.jsx';
import HackDetail from './components/HackDetail.jsx';
import { useStore } from './lib/useStore.js';

const NAV = [
  { id: 'search', label: 'さがす', icon: '🔍' },
  { id: 'toc', label: '目次', icon: '📑' },
  { id: 'saved', label: '気になる', icon: '★' },
  { id: 'about', label: 'このアプリ', icon: 'ℹ️' },
];

export default function App() {
  const store = useStore();
  const [view, setView] = useState('search');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  // 画面を切り替えたら先頭へ（前の画面の位置のまま出ると、どこを見ているか分からなくなる）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, openId]);

  const open = (id) => setOpenId(id);
  const search = (text) => {
    setQuery(text);
    store.remember(text);
    setOpenId(null);
    setView('search');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔍 ライフハック検索</h1>
        <p>困った時の言葉から引く</p>
      </header>

      <main>
        {openId ? (
          <HackDetail
            id={openId}
            query={query}
            store={store}
            onBack={() => setOpenId(null)}
            onOpen={open}
            onSearch={search}
          />
        ) : (
          <>
            {view === 'search' ? <Search query={query} setQuery={setQuery} store={store} onOpen={open} /> : null}
            {view === 'toc' ? <Toc onOpen={open} onSearch={search} /> : null}
            {view === 'saved' ? <Saved store={store} onOpen={open} onGoSearch={() => setView('search')} /> : null}
            {view === 'about' ? <About store={store} /> : null}
          </>
        )}
      </main>

      <nav className="bottom-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id && !openId ? 'on' : ''}
            onClick={() => {
              setOpenId(null);
              setView(item.id);
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
