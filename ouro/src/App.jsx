// 画面の切り替え。モバイルファースト・下部ナビ5つ。
//
// 新しい画面を追加するときは基本 lazy import にする
// （下部ナビ相当の頻繁に使う画面だけ即時 import）。

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useStore } from './lib/useStore.js';
import { useToast } from './components/ui.jsx';
import Splash from './components/Splash.jsx';
import Home from './components/Home.jsx';
import Employees from './components/Employees.jsx';
import Compose from './components/Compose.jsx';
import KnowledgeView from './components/Knowledge.jsx';
import Company from './components/Company.jsx';
// カレンダーと目次は下部ナビ相当で頻繁に使うため即時 import（lazy に戻さない）
import Calendar from './components/Calendar.jsx';
import Toc from './components/Toc.jsx';

const TaskDetail = lazy(() => import('./components/TaskDetail.jsx'));
const EmployeeDetail = lazy(() => import('./components/EmployeeDetail.jsx'));
const Hire = lazy(() => import('./components/Hire.jsx'));
const KnowledgeDetail = lazy(() => import('./components/KnowledgeDetail.jsx'));
const Ingest = lazy(() => import('./components/Ingest.jsx'));
const Meeting = lazy(() => import('./components/Meeting.jsx'));
const MeetingDetail = lazy(() =>
  import('./components/Meeting.jsx').then((m) => ({ default: m.MeetingDetail }))
);
const Deals = lazy(() => import('./components/Deals.jsx'));
const DealDetail = lazy(() =>
  import('./components/Deals.jsx').then((m) => ({ default: m.DealDetail }))
);
const Connect = lazy(() => import('./components/Connect.jsx'));
const Approvals = lazy(() => import('./components/Approvals.jsx'));
const AuditView = lazy(() => import('./components/AuditView.jsx'));
const Settings = lazy(() => import('./components/Settings.jsx'));
const GenreEditor = lazy(() => import('./components/GenreEditor.jsx'));

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
    setStack([]);
    setView(id);
    setArg(null);
    window.scrollTo(0, 0);
  };

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
