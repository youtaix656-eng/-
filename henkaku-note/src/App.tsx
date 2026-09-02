import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useStore, actions } from './lib/useStore';
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
import TocView from './components/TocView';
import { SCREENS, type ViewId } from './data/toc';
import { ANCHORS } from './data/anchors';
import { useFocusJump } from './components/useFocusJump';
import { emptyTocData, normalizeTocData, type TocUserData } from './lib/tocStore';

type View = ViewId;

// ナビの並びは data/toc.ts の SCREENS が単一の正（目次と画面名が食い違わないため）
const NAV = SCREENS.map((s) => ({ id: s.id, icon: s.icon, label: s.label }));

export default function App() {
  const state = useStore();
  const [view, setView] = useState<View>('today');
  const [today, setToday] = useState(() => todayKey());
  const [selected, setSelected] = useState(today);
  /** 目次から運ぶ先。{ view, anchor } が入ったら画面を切り替えてから光らせる */
  const [jump, setJump] = useState<{ view: View; anchor: string } | null>(null);

  const tocData: TocUserData = useMemo(
    () => (state.toc ? normalizeTocData(state.toc) : emptyTocData()),
    [state.toc],
  );

  // 画面（タブ）の切り替えは **描く前に** 済ませる。
  // useEffect にすると、飛ぶ時（次のフレーム）にはまだ前の画面が描かれていて着かない。
  useLayoutEffect(() => {
    if (jump && jump.view !== view) setView(jump.view);
  }, [jump, view]);

  // 運び終わったら anchor を空へ戻すだけ。
  // **ここで画面の先頭へ戻さないこと**（飛んだ直後に引き戻される）。
  const clearJump = useCallback(() => setJump(null), []);
  useFocusJump(jump && jump.view === view ? jump.anchor : null, clearJump);

  // 日付が変わったら「今日」も切り替える（夜勤明けに開いたままのことがあるため）
  useEffect(() => {
    const timer = setInterval(() => {
      const now = todayKey();
      setToday((prev) => (prev === now ? prev : now));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const weekStart = startOfWeek(today);
  const weeklyDue = useMemo(
    () => isWeekReviewable(weekStart, today) && !isReviewWritten(state.weeks[weekStart]),
    [weekStart, today, state.weeks],
  );

  const openDay = (date: string) => {
    setSelected(date);
    setView(date === today ? 'today' : 'calendar');
  };

  /** 目次の飛び先ボタンから呼ばれる。今日の記録の飛び先なら「今日」に合わせる */
  const goTo = (target: View, anchor: string) => {
    if (target === 'today') setSelected(today);
    setJump({ view: target, anchor });
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
              anchorId={ANCHORS.threeRulesMonth}
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
        {view === 'toc' && (
          <div className="page">
            <TocView data={tocData} onChange={(next) => actions.setTocData(next)} onJump={goTo} />
          </div>
        )}
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
              // 画面の先頭へ戻すのは **操作の一部**（副作用にすると目次からの飛び先を引き戻す）
              window.scrollTo(0, 0);
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
