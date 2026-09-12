import { useEffect, useMemo, useState } from 'react';
import { CircleProgress } from './CircleProgress.js';
import { Icon } from './Icons.js';
import { actions, activePreset } from '../lib/useStore.js';
import { phaseLabel, progressOf, remainingMs } from '../lib/session.js';
import { mmss } from '../lib/date.js';
import { recentTags } from '../lib/stats.js';
import type { AppState } from '../types/index.js';

export function TimerView({
  state,
  now,
  audioAllowed,
  bgmPlaying,
  onToggleBgm,
  onNavigate,
}: {
  state: AppState;
  now: number;
  audioAllowed: boolean;
  bgmPlaying: boolean;
  onToggleBgm: () => void;
  onNavigate: (view: string) => void;
}) {
  const preset = activePreset(state);
  const t = state.timer;
  const running = t.status === 'running';
  const paused = t.status === 'paused';
  const remain = remainingMs(t, now);
  const progress = progressOf(t, now);
  const bgm = state.settings.bgmId ? state.bgm.find((b) => b.id === state.settings.bgmId) : null;
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState(t.tag ?? '');
  const tags = useMemo(() => recentTags(state.records), [state.records]);

  useEffect(() => {
    if (!tagOpen) setTagDraft(t.tag ?? '');
  }, [t.tag, tagOpen]);

  const dots = [];
  for (let i = 0; i < preset.sessionsCount; i++) {
    const done = i < t.pomoIndex || (i === t.pomoIndex && t.phase !== 'focus');
    const current = i === t.pomoIndex && t.phase === 'focus';
    dots.push(<span key={i} className={done ? 'dot on' : current ? 'dot cur' : 'dot'} />);
  }

  const commitTag = () => {
    actions.setTag(tagDraft);
    setTagOpen(false);
  };

  return (
    <section className={paused ? 'timer paused' : 'timer'} aria-label="タイマー">
      <div className="phase">{paused ? '一時停止中' : phaseLabel(t.phase)}</div>
      <CircleProgress progress={progress} dim={paused}>
        <div className="time" aria-live="off">{mmss(remain)}</div>
      </CircleProgress>

      <div className="dots" aria-label={`集中 ${preset.sessionsCount} 回のうち ${t.pomoIndex} 回が終わっています`}>{dots}</div>
      <div className="pos">POMO {Math.min(t.pomoIndex + 1, preset.sessionsCount)}/{preset.sessionsCount}</div>

      <div className="controls">
        <button className="ctl side" onClick={() => actions.skip()} aria-label="この局面をスキップ">
          <Icon name="skip" />
        </button>
        <button className="ctl main" onClick={() => actions.toggle()} aria-label={running ? '一時停止' : '開始'}>
          <Icon name={running ? 'pause' : 'play'} size={30} />
        </button>
        <button
          className={bgmPlaying ? 'ctl side on' : 'ctl side'}
          onClick={onToggleBgm}
          disabled={!audioAllowed || !bgm}
          aria-label={bgmPlaying ? 'BGMを止める' : 'BGMを流す'}
          title={!bgm ? 'BGMは未選択（設定 → 勉強中BGM）' : !audioAllowed ? 'イヤホンの確認が取れていません' : undefined}
        >
          <Icon name={bgmPlaying ? 'music' : 'musicOff'} />
        </button>
      </div>

      {!audioAllowed && (
        <p className="quiet">
          イヤホンの確認が取れていないため、音は出しません。
          <button className="link" onClick={() => onNavigate('settings')}>設定で確認する</button>
        </p>
      )}
      {audioAllowed && bgm && !bgmPlaying && t.phase === 'focus' && (
        <p className="quiet">BGM「{bgm.name}」は集中中に流れます</p>
      )}

      <div className="tagline">
        {tagOpen ? (
          <div className="tag-edit">
            <label className="visually-hidden" htmlFor="tag-input">タグ</label>
            <input
              id="tag-input"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="作業内容（例：鍼灸国試勉強）"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTag();
              }}
            />
            <div className="chips">
              {tags.map((tg) => (
                <button key={tg} className="chip" onClick={() => setTagDraft(tg)}>{tg}</button>
              ))}
            </div>
            <div className="row">
              <button className="btn" onClick={commitTag}>決める</button>
              <button className="btn ghost" onClick={() => { setTagDraft(''); actions.setTag(null); setTagOpen(false); }}>タグなし</button>
              <button className="btn ghost" onClick={() => setTagOpen(false)}>閉じる</button>
            </div>
          </div>
        ) : (
          <button className="link tag" onClick={() => setTagOpen(true)} aria-label="タグを変える">
            <Icon name="tag" size={14} /> {t.tag ?? 'タグなし'}
          </button>
        )}
      </div>

      <div className="preset-name">{preset.name}</div>
      {!running && (t.pomoIndex > 0 || t.phase !== 'focus' || paused) && (
        <button className="link faint" onClick={() => actions.resetCycle()} aria-label="周期を最初から">
          <Icon name="reset" size={13} /> 最初から
        </button>
      )}
    </section>
  );
}
