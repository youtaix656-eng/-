import { useState } from 'react';
import BottomNav, { type TabId } from './components/BottomNav';
import Home from './components/Home';
import History from './components/History';
import Dashboard from './components/Dashboard';
import Schedule from './components/Schedule';
import RecordForm from './components/RecordForm';
import NapTimer from './components/NapTimer';
import QuickWakeLog from './components/QuickWakeLog';
import NapQuickAdd from './components/NapQuickAdd';
import { useRecords } from './lib/useRecords';
import { todayISODate } from './lib/time';
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
  const [newRecordDate, setNewRecordDate] = useState<string | undefined>(undefined);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerPreset, setTimerPreset] = useState<number | null>(null);
  const [quickWakeOpen, setQuickWakeOpen] = useState(false);
  const [napQuickAddOpen, setNapQuickAddOpen] = useState(false);

  function openNewRecord() {
    setNewRecordDate(undefined);
    setEditing('new');
  }

  // カレンダーで記録の無い日をタップしたときは、その日付を初期値にした新規フォームを開く
  function openNewRecordForDate(date: string) {
    setNewRecordDate(date);
    setEditing('new');
  }

  function closeForm() {
    setEditing(null);
    setNewRecordDate(undefined);
  }

  // ホームの「詳しく編集する」は今日の記録があればそれを編集する（新規の空フォームを開かない）
  function openTodayFullForm() {
    const today = records.find((r) => r.date === todayISODate());
    setNewRecordDate(undefined);
    setEditing(today ?? 'new');
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
        {tab === 'home' && (
          <Home
            records={records}
            onStartNap={startTimer}
            onOpenQuickWake={() => setQuickWakeOpen(true)}
            onOpenNapQuickAdd={() => setNapQuickAddOpen(true)}
            onOpenFullForm={openTodayFullForm}
          />
        )}
        {tab === 'history' && (
          <History
            records={records}
            onEdit={(r) => setEditing(r)}
            onCreateDate={openNewRecordForDate}
            onDelete={deleteRecord}
          />
        )}
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
          defaultDate={editing === 'new' ? newRecordDate : undefined}
          onClose={closeForm}
          onSave={async (record) => {
            await saveRecord(record);
            closeForm();
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

      {quickWakeOpen && (
        <QuickWakeLog
          records={records}
          onClose={() => setQuickWakeOpen(false)}
          onSave={async (record) => {
            await saveRecord(record);
            setQuickWakeOpen(false);
          }}
        />
      )}

      {napQuickAddOpen && (
        <NapQuickAdd
          records={records}
          onClose={() => setNapQuickAddOpen(false)}
          onSave={async (record) => {
            await saveRecord(record);
            setNapQuickAddOpen(false);
          }}
        />
      )}
    </div>
  );
}
