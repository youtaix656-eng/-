// 画面の切り替え。モバイルファースト・下部ナビ6つ。
//
// 起動を速くするため、**最初に見えるホーム以外はすべて後から読む**。
// タブの画面も lazy にしたうえで、ホームを描いた後の空き時間に先読みするので、
// タブを押した時の待ちは実質ゼロになる（項目07・08）。

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useStore } from './lib/useStore.js';
import * as perf from './lib/perf.js';
import { LOADERS, preloadView, preloadMany } from './lib/preload.js';
import { useToast } from './components/ui.jsx';
import Splash from './components/Splash.jsx';
import Home from './components/Home.jsx';
import Employees from './components/Employees.jsx';
import Compose from './components/Compose.jsx';
import KnowledgeView from './components/Knowledge.jsx';
import Company from './components/Company.jsx';
// 肖像の額縁は全員で1つを使い回すので、その定義だけ即時に読む
import { PortraitSprite } from './components/Portrait.jsx';

const TaskDetail = lazy(LOADERS.task);
const EmployeeDetail = lazy(LOADERS.employee);
const Hire = lazy(LOADERS.hire);
const KnowledgeDetail = lazy(LOADERS.knowledgeDetail);
const Ingest = lazy(LOADERS.ingest);
const Meeting = lazy(LOADERS.meeting);
const MeetingDetail = lazy(() => LOADERS.meetingDetail().then((m) => ({ default: m.MeetingDetail })));
const Deals = lazy(LOADERS.deals);
const DealDetail = lazy(() => LOADERS.deal().then((m) => ({ default: m.DealDetail })));
const Connect = lazy(LOADERS.connect);
const Approvals = lazy(LOADERS.approvals);
const AuditView = lazy(LOADERS.audit);
const Settings = lazy(LOADERS.settings);
// 新項目01：下部ナビにあるが起動直後には要らないので、後から読む
const Calendar = lazy(LOADERS.calendar);
const Toc = lazy(LOADERS.toc);
const GenreEditor = lazy(LOADERS.genre);
const Characters = lazy(LOADERS.characters);

const NAV = [
  { id: 'home', glyph: '◉', label: 'ホーム' },
  { id: 'toc', glyph: '▤', label: '目次' },
  { id: 'employees', glyph: '☉', label: '社員' },
  { id: 'compose', glyph: '✎', label: '依頼' },
  { id: 'calendar', glyph: '▦', label: '予定' },
  { id: 'knowledge', glyph: '⌕', label: '知識' },
];

const TITLES = {
  home: 'Ouro',
  employees: 'AI社員',
  compose: '仕事を依頼する',
  knowledge: 'Ouro Knowledge',
  toc: '目次',
  calendar: '予定',
  genre: 'ジャンル',
  characters: 'AIキャラクター名鑑',
  company: '会社',
  task: '仕事',
  employee: '社員',
  hire: 'AI社員を雇う',
  knowledgeDetail: '知識',
  ingest: '情報を追加',
  meeting: 'AI会議',
  meetingDetail: 'AI会議',
  deals: '案件・収益',
  deal: '案件',
  connect: '会社で使える道具',
  approvals: '承認',
  audit: '操作履歴',
  settings: '設定',
};

export default function App() {
  const store = useStore();
  const [toastNode, toast] = useToast();
  const [view, setView] = useState('home');
  const [arg, setArg] = useState(null);
  const [stack, setStack] = useState([]);

  const go = useCallback(
    (next, nextArg = null) => {
      perf.mark(`view:${next}`);
      preloadView(next);
      setStack((s) => [...s, { view, arg }].slice(-20));
      setView(next);
      setArg(nextArg);
      window.scrollTo(0, 0);
    },
    [view, arg]
  );

  const back = useCallback(() => {
    setStack((s) => {
      const prev = s[s.length - 1];
      if (prev) {
        setView(prev.view);
        setArg(prev.arg);
        window.scrollTo(0, 0);
        return s.slice(0, -1);
      }
      setView('home');
      setArg(null);
      return s;
    });
  }, []);

  const navTo = (id) => {
    perf.mark(`view:${id}`);
    preloadView(id);
    setStack([]);
    setView(id);
    setArg(null);
    window.scrollTo(0, 0);
  };

  // 描き終わったところで、切り替えにかかった時間を記録する
  useEffect(() => {
    const id = requestAnimationFrame(() => perf.measure(`view:${view}`, 'view'));
    return () => cancelAnimationFrame(id);
  }, [view]);

  // ホームを描いたあとの空き時間に、次に開きそうな画面を取っておく。
  // 新項目02：対象を「会社」から開く画面まで広げ、節約モード・2G相当の端末では
  // 先読みしない（本命の通信の邪魔になるため。判定は lib/preload.js）。
  useEffect(() => {
    if (!store.ready) return undefined;
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : null;
    if (!idle) return undefined;
    const id = idle(
      () => {
        preloadMany(['toc', 'calendar', 'task', 'employee']);
        // さらに空きがあれば、会社バーから開く画面も
        idle(() => preloadMany(['approvals', 'settings', 'characters', 'connect']), { timeout: 8000 });
      },
      { timeout: 4000 }
    );
    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
    };
  }, [store.ready]);

  // ブラウザの戻るで1つ前の画面へ
  useEffect(() => {
    const onPop = () => back();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [back]);

  if (!store.ready) {
    return (
      <div className="splash">
        <span className="spinner" />
      </div>
    );
  }

  if (!store.settings.splashSeen) {
    return <Splash onStart={() => store.updateSettings({ splashSeen: true })} />;
  }

  const isTab = NAV.some((n) => n.id === view);

  return (
    <div className="app">
      {/* 肖像の額縁と切り抜きは、この1つだけを全員で使い回す */}
      <PortraitSprite />

      {!isTab && (
        <header className="topbar">
          <button type="button" className="back" onClick={back} aria-label="戻る">
            ‹
          </button>
          <h1>{TITLES[view] || 'Ouro'}</h1>
        </header>
      )}

      <Suspense
        fallback={
          <div className="screen" style={{ textAlign: 'center', paddingTop: 60 }}>
            <span className="spinner" />
          </div>
        }
      >
        {view === 'home' && <Home store={store} go={go} />}
        {view === 'employees' && <Employees store={store} go={go} preset={arg || {}} key={JSON.stringify(arg)} />}
        {view === 'compose' && <Compose store={store} preset={arg || {}} go={go} key={JSON.stringify(arg)} />}
        {view === 'knowledge' && <KnowledgeView store={store} go={go} />}
        {view === 'toc' && <Toc store={store} go={go} />}
        {view === 'calendar' && <Calendar store={store} go={go} toast={toast} />}
        {view === 'genre' && <GenreEditor store={store} go={go} toast={toast} />}
        {view === 'characters' && (
          <Characters store={store} go={go} toast={toast} highlight={arg && arg.roleId} />
        )}
        {view === 'company' && <Company store={store} go={go} />}
        {view === 'task' && <TaskDetail store={store} taskId={arg} go={go} />}
        {view === 'employee' && <EmployeeDetail store={store} employeeId={arg} go={go} />}
        {view === 'hire' && <Hire store={store} initialRoleId={arg} go={go} />}
        {view === 'knowledgeDetail' && <KnowledgeDetail store={store} knowledgeId={arg} go={go} />}
        {view === 'ingest' && <Ingest store={store} go={go} toast={toast} />}
        {view === 'meeting' && <Meeting store={store} go={go} />}
        {view === 'meetingDetail' && <MeetingDetail store={store} meetingId={arg} go={go} />}
        {view === 'deals' && <Deals store={store} go={go} toast={toast} highlight={arg && arg.templateId} />}
        {view === 'deal' && <DealDetail store={store} dealId={arg} go={go} />}
        {view === 'connect' && <Connect store={store} go={go} toast={toast} highlight={arg && arg.toolId} />}
        {view === 'approvals' && <Approvals store={store} go={go} />}
        {view === 'audit' && <AuditView store={store} />}
        {view === 'settings' && <Settings store={store} toast={toast} />}
      </Suspense>

      {/* 下部ナビは6つに絞ったため、「会社」への入口を常設のバーで確保する */}
      {isTab && (
        <button type="button" className="company-bar" onClick={() => go('company')}>
          ▦ 会社（ダッシュボード・道具・承認・設定）
        </button>
      )}

      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-current={view === n.id}
            onPointerDown={() => preloadView(n.id)}
            onPointerEnter={() => preloadView(n.id)}
            onClick={() => navTo(n.id)}
          >
            <span className="g">{n.glyph}</span>
            <span className="t">{n.label}</span>
          </button>
        ))}
      </nav>

      {toastNode}
    </div>
  );
}
