import React, { useCallback, useState } from 'react';
import { GLYPHS } from './data/glyphs.js';
import { useStore } from './lib/useStore.js';
import Home from './components/Home.jsx';
import Check from './components/Check.jsx';
import Tactics from './components/Tactics.jsx';
import Replies from './components/Replies.jsx';
import Habits from './components/Habits.jsx';
import Myths from './components/Myths.jsx';
import People from './components/People.jsx';
import Sources from './components/Sources.jsx';
import TableOfContents from './components/TableOfContents.jsx';
import Records from './components/Records.jsx';
import Settings from './components/Settings.jsx';

const NAV = [
  { id: 'home', label: 'ホーム', icon: GLYPHS.sun },
  { id: 'check', label: '調べる', icon: GLYPHS.circleDouble },
  { id: 'tactics', label: '型', icon: GLYPHS.moonWane },
  { id: 'people', label: '人', icon: GLYPHS.piece },
  { id: 'records', label: '記録', icon: GLYPHS.reference },
  { id: 'toc', label: '目次', icon: GLYPHS.lines },
];

export default function App() {
  const store = useStore();
  const [view, setView] = useState('home');
  const [checkMode, setCheckMode] = useState('received');
  const [focus, setFocus] = useState('');

  // 画面の先頭へ戻すのは**操作の一部**として行う。
  // 「focus が空なら先頭へ」という副作用にすると、目次から飛んだ直後に
  // focus を空へ戻した瞬間そちらが走り、飛び先まで運んだ画面が先頭へ引き戻される
  // （実際にこれで飛べなくなっていた）。
  const go = useCallback((next, arg) => {
    if (next === 'check') {
      setCheckMode(arg === 'draft' ? 'draft' : 'received');
      window.scrollTo(0, 0);
    } else if (arg) {
      setFocus(arg); // 飛び先は画面側が運ぶので、ここでは先頭へ戻さない
    } else {
      window.scrollTo(0, 0);
    }
    setView(next);
  }, []);

  const goFromToc = useCallback((entry) => {
    setFocus(entry.targetId);
    setView(entry.view);
  }, []);

  const clearFocus = useCallback(() => setFocus(''), []);

  return (
    <div className="app">
      {view === 'home' && <Home onGo={go} records={store.records} />}
      {view === 'check' && (
        <Check
          mode={checkMode}
          onChangeMode={setCheckMode}
          onSave={store.addRecord}
          settings={store.settings}
        />
      )}
      {view === 'tactics' && <Tactics focus={focus} onFocusDone={clearFocus} />}
      {view === 'replies' && <Replies focus={focus} onFocusDone={clearFocus} />}
      {view === 'habits' && (
        <Habits focus={focus} onFocusDone={clearFocus} onGoTactic={(id) => go('tactics', id)} />
      )}
      {view === 'sources' && <Sources focus={focus} onFocusDone={clearFocus} />}
      {view === 'toc' && <TableOfContents onGo={goFromToc} />}
      {view === 'myths' && <Myths focus={focus} onFocusDone={clearFocus} />}
      {view === 'people' && (
        <People
          focus={focus}
          onFocusDone={clearFocus}
          onGoTactic={(id) => go('tactics', id)}
          cases={store.cases}
          onSaveCase={store.saveCase}
          onRemoveCase={store.removeCase}
          tries={store.tries}
          onAddTry={store.addTry}
          personView={store.personView}
          onSetPersonView={store.setPersonView}
        />
      )}
      {view === 'records' && (
        <Records
          records={store.records}
          onRemove={store.removeRecord}
          onGoCheck={() => go('check')}
        />
      )}
      {view === 'settings' && (
        <Settings
          settings={store.settings}
          setSetting={store.setSetting}
          onClearAll={store.clearAll}
          recordCount={store.records.length}
          caseCount={store.cases.length}
          storageSize={store.storageSize}
        />
      )}

      {!NAV.some((n) => n.id === view) && (
        <button className="back" onClick={() => go('home')}>
          ← ホームへもどる
        </button>
      )}

      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? 'on' : ''}
            onClick={() => go(n.id)}
            aria-current={view === n.id ? 'page' : undefined}
          >
            <span className="ic">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
