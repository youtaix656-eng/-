import { useEffect, useMemo, useRef, useState } from 'react';
import { actions } from '../lib/useStore';
import {
  LENGTH_OPTIONS, LENGTH_MAP, effectStageFor, formatRemaining, nextStage, pastMinutesOf,
  recommendMinutes, shouldWarnJump, summarize,
} from '../lib/meditation';
import { MEDITATION_SOURCE } from '../data/presets';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  date: string;
  /** 今日以外の日は、タイマーではなく手入力で記録する */
  canRunTimer: boolean;
}

/** 終わりの合図。音源を持たずにその場で作る（オフラインでも鳴る） */
function playBell() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 528;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 2.3);
    setTimeout(() => void ctx.close(), 2600);
  } catch {
    /* 音が出せない環境でも記録はできる */
  }
}

export default function MeditationCard({ state, date, canRunTimer }: Props) {
  const sessionsByDate = useMemo(() => {
    const out: Record<string, AppState['days'][string]['meditations']> = {};
    for (const [key, d] of Object.entries(state.days)) out[key] = d.meditations ?? [];
    return out;
  }, [state.days]);

  const stats = useMemo(() => summarize(sessionsByDate), [sessionsByDate]);
  const past = useMemo(() => pastMinutesOf(sessionsByDate), [sessionsByDate]);
  const suggestion = useMemo(() => recommendMinutes(past), [past]);
  const stage = effectStageFor(stats.days);
  const upcoming = nextStage(stats.days);

  const [minutes, setMinutes] = useState(() => state.settings.meditationDefaultMinutes || suggestion.minutes);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [justDone, setJustDone] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const bellRef = useRef(state.settings.meditationBell);
  bellRef.current = state.settings.meditationBell;

  const today = state.days[date]?.meditations ?? [];
  const warn = shouldWarnJump(minutes, past);
  const running = deadline !== null;

  // 実時間（Date.now）で残りを計算する。画面を閉じてもズレない
  useEffect(() => {
    if (deadline === null) return undefined;
    const tick = () => {
      const left = (deadline - Date.now()) / 1000;
      if (left <= 0) {
        setRemaining(0);
        setDeadline(null);
        actions.addMeditation(date, minutes);
        setJustDone(true);
        if (bellRef.current) playBell();
        return;
      }
      setRemaining(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline, date, minutes]);

  const elapsedMinutes = Math.floor(minutes - remaining / 60);

  if (running) {
    return (
      <div className="card center">
        <p className="section-title">瞑想中</p>
        <p className="num" style={{ fontSize: '3.2rem', margin: '4px 0', color: 'var(--dawn)' }}>
          {formatRemaining(remaining)}
        </p>
        <p className="small muted" style={{ margin: 0 }}>{minutes}分。終わったら音でお知らせします。</p>
        <button type="button" className="btn secondary" onClick={() => { setDeadline(null); setRemaining(0); }}>
          やめる（記録しない）
        </button>
        {/* 経過が1分に満たないうちは記録しない（座っていない時間を実績にしない） */}
        <button
          type="button"
          className="btn ghost"
          disabled={elapsedMinutes < 1}
          onClick={() => { setDeadline(null); actions.addMeditation(date, elapsedMinutes); setJustDone(true); }}
        >
          {elapsedMinutes < 1 ? 'あと1分で「ここまでを記録」できます' : `ここまで（${elapsedMinutes}分）を記録して終える`}
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0, flex: 1 }}>🧘 瞑想</h3>
        {stats.days > 0 && <span className="tag dawn">実践 {stats.days}日</span>}
      </div>

      {today.length > 0 && (
        <p className="small" style={{ margin: 0 }}>
          今日：{today.map((m, i) => (
            <span key={`${m.recordedAt}-${i}`} className="tag" style={{ marginRight: 6 }}>
              {m.minutes}分
              <button
                type="button"
                aria-label={`${m.minutes}分の記録を消す`}
                onClick={() => actions.removeMeditation(date, i)}
                style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', marginLeft: 4, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </p>
      )}

      {justDone && <p className="note-line warm" style={{ margin: 0 }}>記録しました。長さより、続いた日数のほうが効いてくるとされています。</p>}

      <div>
        <p className="section-title">長さ</p>
        <div className="chips">
          {LENGTH_OPTIONS.map((o) => (
            <button key={o.minutes} type="button" className="chip" aria-pressed={minutes === o.minutes} onClick={() => { setMinutes(o.minutes); setJustDone(false); }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <p className="small muted" style={{ margin: 0 }}>{LENGTH_MAP[minutes]?.purpose}</p>
      {LENGTH_MAP[minutes]?.caution && <p className="note-line" style={{ margin: 0 }}>{LENGTH_MAP[minutes].caution}</p>}
      {warn && (
        <p className="note-line" style={{ margin: 0, borderLeftColor: 'var(--ember)' }}>
          いつもより長い設定です。急に長くすると雑念との格闘で逆にストレスになることがあります。
          {suggestion.minutes}分から段階的に伸ばすほうが続きます。
        </p>
      )}
      {!warn && minutes !== suggestion.minutes && (
        <p className="small muted" style={{ margin: 0 }}>おすすめ：{suggestion.minutes}分（{suggestion.reason}）</p>
      )}

      {canRunTimer ? (
        <button type="button" className="btn" onClick={() => { setJustDone(false); setDeadline(Date.now() + minutes * 60_000); }}>
          {minutes}分はじめる
        </button>
      ) : (
        <button type="button" className="btn secondary" onClick={() => { actions.addMeditation(date, minutes); setJustDone(true); }}>
          この日に {minutes}分 を記録する
        </button>
      )}

      <button type="button" className="btn slim ghost" onClick={() => setShowEffects((v) => !v)}>
        {showEffects ? '効果の見通しを閉じる' : '効果の見通しを見る'}
      </button>

      {showEffects && (
        <div className="stack" style={{ gap: 8 }}>
          {stage ? (
            <>
              <p className="section-title">いまの段階：{stage.title}（実践 {stats.days}日）</p>
              <ul className="list small">
                {stage.reported.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {stage.note && <p className="note-line" style={{ margin: 0 }}>{stage.note}</p>}
            </>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>まだ記録がありません。1回でも座ると、ここに段階が出ます。</p>
          )}
          {upcoming && (
            <p className="small muted" style={{ margin: 0 }}>
              次は「{upcoming.stage.title}」（あと {upcoming.remaining}日）。
            </p>
          )}
          {stats.days > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              通算 {stats.sessions}回・{stats.totalMinutes}分（1日あたり平均 {stats.averageMinutes}分）。
              効果は「量」より<strong>続けた日数</strong>に強く依存するとされるため、合計分数は目安です。
            </p>
          )}
          <p className="note-line" style={{ margin: 0 }}>
            出典：{MEDITATION_SOURCE.origin}（{MEDITATION_SOURCE.receivedAt} 受領）。
            <span style={{ display: 'block' }}>{MEDITATION_SOURCE.caution}</span>
          </p>
        </div>
      )}
    </div>
  );
}
