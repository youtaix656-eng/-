import { useEffect, useRef, useState } from 'react';
import { actions, activePreset, useStore } from './lib/useStore.js';
import { useHeadphones } from './components/useHeadphones.js';
import { TimerView } from './components/TimerView.js';
import { BreakView } from './components/BreakView.js';
import { StatsView } from './components/StatsView.js';
import { CalendarView } from './components/CalendarView.js';
import { ScheduleView } from './components/ScheduleView.js';
import { SettingsView } from './components/SettingsView.js';
import { Icon, type IconName } from './components/Icons.js';
import * as bgm from './lib/bgm.js';
import { playSound, unlockAudio, vibrate } from './lib/bell.js';
import { phaseLabel } from './lib/session.js';
import { acquireWakeLock, notifyIfHidden, releaseWakeLock } from './lib/wake.js';

const NAV: { id: string; label: string; icon: IconName }[] = [
  { id: 'timer', label: 'タイマー', icon: 'timer' },
  { id: 'stats', label: '記録', icon: 'chart' },
  { id: 'calendar', label: 'カレンダー', icon: 'calendar' },
  { id: 'schedule', label: 'スケジュール', icon: 'list' },
  { id: 'settings', label: '設定', icon: 'settings' },
];

export default function App() {
  const state = useStore();
  const [view, setView] = useState('timer');
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmWanted, setBgmWanted] = useState(true);
  const headphone = useHeadphones(state.settings.headphoneConfirmed);
  const allowedRef = useRef(headphone.allowed);
  allowedRef.current = headphone.allowed;
  const settingsRef = useRef(state.settings);
  settingsRef.current = state.settings;

  useEffect(() => {
    void actions.hydrate().then(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) setView(NAV.some((n) => n.id === state.settings.lastView) ? state.settings.lastView : 'timer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // 1秒ごと・タブ復帰時に時計を進める（残り時間は endAt から引き算するのでズレない）
  const running = state.timer.status === 'running';
  useEffect(() => {
    if (!hydrated) return;
    const step = () => {
      const t = Date.now();
      setNow(t);
      actions.tick(t);
    };
    step();
    const id = setInterval(step, running ? 1000 : 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') step();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', step);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', step);
    };
  }, [hydrated, running]);

  // 局面の終わり：終了音・バイブ・通知。自動で次が始まった時は開始音も
  useEffect(() => {
    return actions.onPhase((events, autoStarted, next) => {
      const s = settingsRef.current;
      const completed = events.filter((e) => e.kind === 'completed');
      if (completed.length === 0) return;
      if (allowedRef.current) {
        playSound(s.endSound);
        if (autoStarted > 0) setTimeout(() => playSound(s.startSound), 900);
      }
      if (s.vibrate) vibrate(next.timer.phase === 'focus' ? [120, 80, 120] : [200]);
      if (s.notify) {
        const last = completed[completed.length - 1];
        notifyIfHidden('EarPomo', `${phaseLabel(last.phase)}が終わりました。次は${phaseLabel(next.timer.phase)}${autoStarted > 0 ? '（始まっています）' : ''}`);
      }
    });
  }, []);

  // BGM：集中中に走っている間だけ流す。イヤホンの確認が無ければ絶対に流さない
  const phase = state.timer.phase;
  const bgmId = state.settings.bgmId;
  const shouldPlay = hydrated && running && phase === 'focus' && bgmId != null && headphone.allowed && bgmWanted;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      bgm.setVolume(state.settings.bgmVolume);
      if (!shouldPlay) {
        bgm.pause();
        setBgmPlaying(false);
        bgm.setMediaPlaybackState(false);
        return;
      }
      const ok = await bgm.load(bgmId);
      if (cancelled || !ok) return;
      const played = await bgm.play();
      if (cancelled) return;
      setBgmPlaying(played);
      bgm.setMediaPlaybackState(played);
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldPlay, bgmId, state.settings.bgmVolume]);

  useEffect(() => {
    const track = bgmId ? state.bgm.find((b) => b.id === bgmId) : null;
    bgm.setMediaSession({
      title: track ? track.name : 'EarPomo',
      artist: `${phaseLabel(phase)}・${activePreset(state).name}`,
      onPlay: () => actions.start(),
      onPause: () => actions.pause(),
      onNext: () => actions.skip(),
    });
  }, [bgmId, phase, state.bgm, state.activePresetId]);

  // 画面を眠らせない：走っている間だけ取り、止まったら必ず離す
  useEffect(() => {
    if (running && state.settings.keepAwake) void acquireWakeLock();
    else void releaseWakeLock();
    return () => {
      void releaseWakeLock();
    };
  }, [running, state.settings.keepAwake]);

  const go = (next: string) => {
    setView(next);
    actions.setSettings({ lastView: next });
    window.scrollTo({ top: 0 });
  };

  if (!hydrated) {
    return <div className="app"><p className="quiet center">読み込んでいます…</p></div>;
  }

  const inBreak = view === 'timer' && phase !== 'focus';

  return (
    <div className="app" onPointerDownCapture={unlockAudio}>
      <main className="main">
        {view === 'timer' && !inBreak && (
          <TimerView
            state={state}
            now={now}
            audioAllowed={headphone.allowed}
            bgmPlaying={bgmPlaying}
            onToggleBgm={() => setBgmWanted((v) => !v)}
            onNavigate={go}
          />
        )}
        {inBreak && <BreakView state={state} now={now} />}
        {view === 'stats' && <StatsView state={state} now={now} />}
        {view === 'calendar' && <CalendarView state={state} now={now} onNavigate={go} />}
        {view === 'schedule' && <ScheduleView state={state} now={now} onNavigate={go} />}
        {view === 'settings' && <SettingsView state={state} headphone={headphone} />}
      </main>

      <nav className="bottom-nav" aria-label="画面の切り替え">
        {NAV.map((n) => (
          <button key={n.id} className={view === n.id ? 'nav-btn on' : 'nav-btn'} onClick={() => go(n.id)} aria-label={n.label} aria-current={view === n.id ? 'page' : undefined} title={n.label}>
            <Icon name={n.icon} size={22} />
          </button>
        ))}
      </nav>
    </div>
  );
}
