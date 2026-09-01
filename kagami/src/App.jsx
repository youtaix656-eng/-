import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import ErrorBoundary from './components/ErrorBoundary.jsx';
import FigureBackground, { FIGURES } from './components/Figures.jsx';
import { pickFigureId } from './lib/figure.js';

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
  /**
   * 目次が持っている飛び先（DOM の id）。
   *
   * **画面側で組み立て直さない。** 目次の `anchor` と画面側の組み立てが二重にあると、
   * 片方だけ直したときに黙って食い違う（「ふるまいでさがす」が実際に飛べなくなっていた）。
   */
  const [focusAnchor, setFocusAnchor] = useState('');

  /**
   * 画面ごとの「書きかけ」を、画面を移っても持っておく箱。
   *
   * App は画面を出し入れするので、離れた瞬間に画面の中の状態が捨てられる
   * ——貼った本文も、選んだふるまいも、黙って消えていた（実際に踏んだ）。
   * **端末には保存しない**（貼った文面は送らない・選んだだけでは残らない、という
   * 約束をそのまま守るため）。タブを閉じれば消える、開いている間だけの覚え書き。
   */
  const uiRef = useRef({});

  /**
   * 地に敷く面（おもて）。**開き直すたびに変わる。**
   * 前に出したものを避けて選び、選んだものを覚えておく
   * （ただの乱数だと同じものが続けて出て「変わらない」と見える）。
   */
  const [figureId] = useState(() =>
    pickFigureId(FIGURES.map((f) => f.id), store.settings.lastFigure),
  );
  useEffect(() => {
    if (figureId && store.settings.lastFigure !== figureId) store.setSetting('lastFigure', figureId);
  }, [figureId]);

  // 画面の先頭へ戻すのは**操作の一部**として行う。
  // 「focus が空なら先頭へ」という副作用にすると、目次から飛んだ直後に
  // focus を空へ戻した瞬間そちらが走り、飛び先まで運んだ画面が先頭へ引き戻される
  // （実際にこれで飛べなくなっていた）。
  const go = useCallback((next, arg) => {
    if (next === 'check') {
      // **下部ナビで戻っただけで、選んでいた側を変えない**（「自分が書いた側」で
      // 書いている途中に「言われた側」へ勝手に戻っていた）。指定があった時だけ変える。
      if (arg === 'draft' || arg === 'received') setCheckMode(arg);
      window.scrollTo(0, 0);
    } else if (arg) {
      setFocus(arg); // 飛び先は画面側が運ぶので、ここでは先頭へ戻さない
      setFocusAnchor('');
    } else {
      window.scrollTo(0, 0);
    }
    setView(next);
  }, []);

  const goFromToc = useCallback((entry) => {
    setFocus(entry.targetId);
    setFocusAnchor(entry.anchor || '');
    setView(entry.view);
  }, []);

  const clearFocus = useCallback(() => {
    setFocus('');
    setFocusAnchor('');
  }, []);

  return (
    <div className="app">
      <FigureBackground id={figureId} />
      {store.saveFailed && (
        <div className="note warn save-warn" role="alert">
          <strong>この端末に保存できていません。</strong>
          空きが足りないか、ブラウザが保存を止めている可能性があります。
          <strong>いま画面に出ているものは、閉じると消えます。</strong>
          設定の「書き出してコピー」で先に控えを取ってください。
          <button className="chip" style={{ marginLeft: 8 }} onClick={() => go('settings')}>
            設定をひらく
          </button>
        </div>
      )}

      <ErrorBoundary viewKey={view} onHome={() => go('home')} onSettings={() => go('settings')}>
      {view === 'home' && <Home onGo={go} records={store.records} cases={store.cases} />}
      {view === 'check' && (
        <Check
          mode={checkMode}
          onChangeMode={setCheckMode}
          onSave={store.addRecord}
          settings={store.settings}
          ui={uiRef.current}
          onGoSettings={() => go('settings')}
          onGoTactic={(id) => go('tactics', id)}
          records={store.records}
        />
      )}
      {view === 'tactics' && <Tactics focus={focus} anchor={focusAnchor} onFocusDone={clearFocus} ui={uiRef.current} />}
      {view === 'replies' && <Replies focus={focus} anchor={focusAnchor} onFocusDone={clearFocus} />}
      {view === 'habits' && (
        <Habits
          focus={focus}
          anchor={focusAnchor}
          onFocusDone={clearFocus}
          onGoTactic={(id) => go('tactics', id)}
          myHabits={store.myHabits}
          onSetMyHabits={store.setMyHabits}
        />
      )}
      {view === 'sources' && (
        <Sources
          focus={focus}
          anchor={focusAnchor}
          onFocusDone={clearFocus}
          onGoTactic={(id) => go('tactics', id)}
        />
      )}
      {view === 'toc' && <TableOfContents onGo={goFromToc} ui={uiRef.current} />}
      {view === 'myths' && <Myths focus={focus} anchor={focusAnchor} onFocusDone={clearFocus} />}
      {view === 'people' && (
        <People
          focus={focus}
          anchor={focusAnchor}
          onFocusDone={clearFocus}
          onGoTactic={(id) => go('tactics', id)}
          cases={store.cases}
          onSaveCase={store.saveCase}
          onRemoveCase={store.removeCase}
          tries={store.tries}
          onAddTry={store.addTry}
          personView={store.personView}
          onSetPersonView={store.setPersonView}
          myHabits={store.myHabits}
          undoCases={store.undoCases}
          onUndoRemove={store.undoRemoveCase}
          onDismissUndo={store.dismissUndo}
          onClearPeople={store.clearPeople}
          onImportPeople={store.importPeople}
          onRemoveTry={store.removeTry}
          onHideCounter={store.hideCounter}
          ui={uiRef.current}
        />
      )}
      {view === 'records' && (
        <Records
          records={store.records}
          onRemove={store.removeRecord}
          onGoCheck={() => go('check')}
          onGoTactic={(id) => go('tactics', id)}
        />
      )}
      {view === 'settings' && (
        <Settings
          settings={store.settings}
          setSetting={store.setSetting}
          onClearAll={store.clearAll}
          recordCount={store.records.length}
          caseCount={store.cases.length}
          tryCount={store.tries.length}
          habitCount={store.myHabits.length}
          storageSize={store.storageSize}
          onExportAll={store.exportAll}
          onImportAll={store.importAll}
        />
      )}

      </ErrorBoundary>

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
