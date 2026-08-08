import { useState } from 'react';
import BottomNav, { type TabId } from './components/BottomNav';
import Home from './components/Home';
import History from './components/History';
import Dashboard from './components/Dashboard';
import Schedule from './components/Schedule';
import RecordForm from './components/RecordForm';
import NapTimer from './components/NapTimer';
import { useRecords } from './lib/useRecords';
import type { SleepRecord } from './types/sleep';

const TAB_TITLES: Record<TabId, string> = {
  home: '睡眠トラッカー',
  history: '記録一覧',
  dashboard: '分析',
  schedule: 'スケジュール提案',
};

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const { records, saveRecord, deleteRecord } = useRecords();
  const [editing, setEditing] = useState<SleepRecord | 'new' | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerPreset, setTimerPreset] = useState<number | null>(null);

  function openNewRecord() {
    setEditing('new');
  }

  function startTimer(min: number | null = null) {
    setTimerPreset(min);
    setTimerOpen(true);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{TAB_TITLES[tab]}</h1>
        {tab === 'home' && (
          <button className="header-action" onClick={() => startTimer(null)}>
            ⏱ 仮眠
          </button>
        )}
      </header>

      <main className="app-main">
        {tab === 'home' && <Home records={records} onStartNap={startTimer} onNewRecord={openNewRecord} />}
        {tab === 'history' && <History records={records} onEdit={(r) => setEditing(r)} onDelete={deleteRecord} />}
        {tab === 'dashboard' && <Dashboard records={records} />}
        {tab === 'schedule' && <Schedule records={records} />}
      </main>

      {(tab === 'home' || tab === 'history') && (
        <button className="fab" onClick={openNewRecord} aria-label="新規記録を追加">
          +
        </button>
      )}

      <BottomNav active={tab} onChange={setTab} />

      {editing !== null && (
        <RecordForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (record) => {
            await saveRecord(record);
            setEditing(null);
          }}
        />
      )}

      {timerOpen && (
        <NapTimer
          initialPreset={timerPreset}
          records={records}
          onSaveNap={saveRecord}
          onClose={() => setTimerOpen(false)}
        />
      )}
    </div>
  );
}
