import { useEffect, useMemo, useState } from 'react';
import { useStore } from './lib/useStore';
import { todayKey } from './lib/cycle';
import { startOfWeek } from './lib/date';
import { isWeekReviewable, isReviewWritten } from './lib/weekly';
import Calendar from './components/Calendar';
import DayPanel from './components/DayPanel';
import WeeklyReviewView from './components/WeeklyReviewView';
import HabitsView from './components/HabitsView';
import SettingsView from './components/SettingsView';
import CycleCard from './components/CycleCard';
import ThreeRules from './components/ThreeRules';

type View = 'today' | 'calendar' | 'weekly' | 'habits' | 'settings';

const NAV: { id: View; icon: string; label: string }[] = [
  { id: 'today', icon: '🌅', label: '今日' },
  { id: 'calendar', icon: '🗓', label: 'カレンダー' },
  { id: 'weekly', icon: '📓', label: '週次' },
  { id: 'habits', icon: '✳️', label: '習慣' },
  { id: 'settings', icon: '⚙️', label: '設定' },
];

export default function App() {
  const state = useStore();
  const [view, setView] = useState<View>('today');
  const [today, setToday] = useState(() => todayKey());
  const [selected, setSelected] = useState(today);

  // 日付が変わったら「今日」も切り替える（夜勤明けに開いたままのことがあるため）
  useEffect(() => {
    const timer = setInterval(() => {
      const now = todayKey();
      setToday((prev) => (prev === now ? prev : now));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const weekStart = startOfWeek(today);
  const weeklyDue = useMemo(
    () => isWeekReviewable(weekStart, today) && !isReviewWritten(state.weeks[weekStart]),
    [weekStart, today, state.weeks],
  );

  const openDay = (date: string) => {
    setSelected(date);
    setView(date === today ? 'today' : 'calendar');
  };

  return (
    <div className="app">
      <header className="header">
        <span className="mark" aria-hidden="true">🌅</span>
        <h1>変革ノート</h1>
        <div className="spacer" />
        {weeklyDue && (
          <button type="button" className="btn slim secondary" onClick={() => setView('weekly')}>
            週次を書く
          </button>
        )}
      </header>

      <main>
        {view === 'today' && (
          <div className="page">
            <CycleCard state={state} today={today} />
            <DayPanel state={state} date={today} today={today} onOpenWeekly={() => setView('weekly')} />
            <ThreeRules
              state={state}
              scope="month"
              date={today}
              title="今月の3つ"
              lead="月初めに3つ。実践期間の「最上位目標1つ」とは別で、今月やり遂げたいことです。"
            />
          </div>
        )}

        {view === 'calendar' && (
          <div className="page">
            <Calendar state={state} selected={selected} today={today} onSelect={setSelected} />
            <DayPanel state={state} date={selected} today={today} onOpenWeekly={() => setView('weekly')} />
          </div>
        )}

        {view === 'weekly' && (
          <div className="page">
            <WeeklyReviewView state={state} anchor={selected > today ? today : selected} today={today} onSelectDay={openDay} />
          </div>
        )}

        {view === 'habits' && <div className="page"><HabitsView state={state} /></div>}
        {view === 'settings' && <div className="page"><SettingsView state={state} /></div>}
      </main>

      <nav className="nav" aria-label="メインナビゲーション">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-current={view === n.id ? 'page' : undefined}
            onClick={() => {
              if (n.id === 'today') setSelected(today);
              setView(n.id);
            }}
          >
            <b aria-hidden="true">{n.icon}</b>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
