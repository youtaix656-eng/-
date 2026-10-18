import { CircleProgress } from './CircleProgress.js';
import { DeskNap, LyingDown } from './BreakIllustration.js';
import { Icon } from './Icons.js';
import { actions } from '../lib/useStore.js';
import { phaseLabel, progressOf, remainingMs } from '../lib/session.js';
import { mmss } from '../lib/date.js';
import { tipsFor } from '../data/breakTips.js';
import type { AppState } from '../types/index.js';

export function BreakView({ state, now }: { state: AppState; now: number }) {
  const t = state.timer;
  const long = t.phase === 'long';
  const paused = t.status === 'paused';
  const idle = t.status === 'idle';
  const tips = tipsFor(t.phase, t.pomoIndex);
  return (
    <section className={paused ? 'timer break paused' : 'timer break'} aria-label={phaseLabel(t.phase)}>
      <div className="phase">{paused ? '一時停止中' : phaseLabel(t.phase)}</div>
      <CircleProgress progress={progressOf(t, now)} size={200} dim>
        <div className="time sm">{mmss(remainingMs(t, now))}</div>
      </CircleProgress>

      <div className="illust-wrap">{long ? <LyingDown /> : <DeskNap />}</div>

      <ul className="tips" aria-label="過ごし方の提案">
        {tips.map((tip) => (
          <li key={tip.id}>
            <Icon name={tip.icon} size={18} />
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>

      {idle && (
        <button className="ctl main" onClick={() => actions.start()} aria-label="休憩を始める">
          <Icon name="play" size={30} />
        </button>
      )}
      {!idle && (
        <button className="ctl side" onClick={() => actions.toggle()} aria-label={paused ? '再開' : '一時停止'}>
          <Icon name={paused ? 'play' : 'pause'} />
        </button>
      )}

      <button className="link faint" onClick={() => actions.skip()}>スキップ</button>
    </section>
  );
}
