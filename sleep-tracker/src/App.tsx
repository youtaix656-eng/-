import { useEffect, useRef, useState } from 'react';
import BottomNav, { type TabId } from './components/BottomNav';
import Home from './components/Home';
import History from './components/History';
import Dashboard from './components/Dashboard';
import Schedule from './components/Schedule';
import RecordForm from './components/RecordForm';
import NapTimer from './components/NapTimer';
import QuickWakeLog from './components/QuickWakeLog';
import NapQuickAdd from './components/NapQuickAdd';
import GroggyQuickAdd from './components/GroggyQuickAdd';
import EveningReflection from './components/EveningReflection';
import SettingsScreen from './components/Settings';
import WorkTab from './components/work/WorkTab';
import ShiftStartForm from './components/work/ShiftStartForm';
import SymptomQuickLog from './components/work/SymptomQuickLog';
import TreatmentSessionForm from './components/work/TreatmentSessionForm';
import { useRecords } from './lib/useRecords';
import { useShifts } from './lib/useShifts';
import { loadSettings, saveSettings } from './lib/storage';
import { startReminderWatch, stopReminderWatch } from './lib/reminders';
import { markTodayOff } from './lib/todayShift';
import { todayISODate } from './lib/time';
import type { SleepRecord } from './types/sleep';
import type { AppSettings } from './types/settings';

const TAB_TITLES: Record<TabId, string> = {
  home: '睡眠トラッカー',
  history: '記録一覧',
  dashboard: '分析',
  schedule: 'スケジュール提案',
  work: '勤務ログ',
};

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const { records, saveRecord, deleteRecord, refresh } = useRecords();
  const { shifts, saveShift, refresh: refreshShifts } = useShifts();
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const [settings, setSettings] = useState<AppSettings>({});
  const [editing, setEditing] = useState<SleepRecord | 'new' | null>(null);
  const [newRecordDate, setNewRecordDate] = useState<string | undefined>(undefined);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerPreset, setTimerPreset] = useState<number | null>(null);
  const [quickWakeOpen, setQuickWakeOpen] = useState(false);
  const [napQuickAddOpen, setNapQuickAddOpen] = useState(false);
  const [groggyQuickAddOpen, setGroggyQuickAddOpen] = useState(false);
  const [eveningReflectionOpen, setEveningReflectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shiftStartOpen, setShiftStartOpen] = useState(false);
  const [symptomLogOpen, setSymptomLogOpen] = useState(false);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);

  async function refreshAll() {
    await Promise.all([refresh(), refreshShifts()]);
  }

  async function handleMarkDayOff() {
    await saveShift(markTodayOff(shifts));
  }

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

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      saveSettings(next);
      return next;
    });
  }

  // 設定の読み込み、PWAショートカット（ホーム長押し）からの起動アクション処理
  useEffect(() => {
    loadSettings().then(setSettings);

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'nap20') {
      startTimer(20);
    } else if (action === 'quickwake') {
      setQuickWakeOpen(true);
    }
    if (action) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 未記録リマインダーの開始/停止
  useEffect(() => {
    if (settings.remindersEnabled) {
      startReminderWatch(() => recordsRef.current);
    } else {
      stopReminderWatch();
    }
    return () => stopReminderWatch();
  }, [settings.remindersEnabled]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>{TAB_TITLES[tab]}</h1>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {tab === 'home' && (
            <button className="header-action" onClick={() => startTimer(null)}>
              ⏱ 仮眠
            </button>
          )}
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="設定">
            ⚙
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'home' && (
          <Home
            records={records}
            settings={settings}
            onStartNap={startTimer}
            onOpenQuickWake={() => setQuickWakeOpen(true)}
            onOpenNapQuickAdd={() => setNapQuickAddOpen(true)}
            onOpenGroggyQuickAdd={() => setGroggyQuickAddOpen(true)}
            onOpenEveningReflection={() => setEveningReflectionOpen(true)}
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
        {tab === 'work' && (
          <WorkTab
            shifts={shifts}
            records={records}
            onOpenShiftStart={() => setShiftStartOpen(true)}
            onOpenSymptomLog={() => setSymptomLogOpen(true)}
            onOpenSessionForm={() => setSessionFormOpen(true)}
            onMarkDayOff={handleMarkDayOff}
          />
        )}
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

      {groggyQuickAddOpen && (
        <GroggyQuickAdd
          records={records}
          onClose={() => setGroggyQuickAddOpen(false)}
          onSave={async (record) => {
            await saveRecord(record);
            setGroggyQuickAddOpen(false);
          }}
        />
      )}

      {eveningReflectionOpen && (
        <EveningReflection
          records={records}
          onClose={() => setEveningReflectionOpen(false)}
          onSave={async (record) => {
            await saveRecord(record);
            setEveningReflectionOpen(false);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsScreen
          settings={settings}
          onUpdateSettings={updateSettings}
          onImported={refreshAll}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {shiftStartOpen && (
        <ShiftStartForm
          shifts={shifts}
          records={records}
          onClose={() => setShiftStartOpen(false)}
          onSave={async (shift) => {
            await saveShift(shift);
            setShiftStartOpen(false);
          }}
        />
      )}

      {symptomLogOpen && (
        <SymptomQuickLog shifts={shifts} onClose={() => setSymptomLogOpen(false)} onSave={saveShift} />
      )}

      {sessionFormOpen && (
        <TreatmentSessionForm
          shifts={shifts}
          onClose={() => setSessionFormOpen(false)}
          onSave={async (shift) => {
            await saveShift(shift);
            setSessionFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
