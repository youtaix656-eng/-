import { useEffect, useRef, useState } from 'react';
import { PRACTICES, practiceById } from '../data/breathing.js';
import { BreathGuide } from './BreathGuide.js';
import { ding } from '../lib/bell.js';
import { mmss } from '../lib/date.js';
import { actions } from '../lib/useStore.js';
import type { AppState } from '../types/index.js';

// 瞑想・呼吸法のタイマー。
// ⚠ やめどきをやり方より前に置く（つらくなったら中断してよい、を先に出す）。
// ⚠ **連続日数を数えない**——「毎日やれた回数」を数え始めると、
//    できなかった日を責める道具になる。ここでは記録自体を残さない。

export function MeditateView({ state }: { state: AppState }) {
  const [id, setId] = useState(PRACTICES[0].id);
  const [minutes, setMinutes] = useState(state.settings.meditationMinutes);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(minutes * 60);
  const endRef = useRef(0);
  const practice = practiceById(id);

  useEffect(() => {
    if (!running) return;
    // 終わる時刻から毎回引き算する（1秒ずつ減らすと、裏に回したときにずれる）
    const tick = setInterval(() => {
      const rest = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(rest);
      if (rest <= 0) {
        setRunning(false);
        ding(state.settings.bell, 396);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [running, state.settings.bell]);

  const start = () => {
    endRef.current = Date.now() + minutes * 60000;
    setLeft(minutes * 60);
    setRunning(true);
    ding(state.settings.bell);
  };

  return (
    <div>
      <h2 className="view-title">瞑想・呼吸法</h2>
      <div className="note warn">
        やめどき：ふらつく・息苦しい・頭が痛む・つらい記憶が出てきて苦しい——そのときは途中でやめて、ふつうの呼吸に戻してください。
        続けることより、中断できることのほうが大事です。
      </div>

      <div className="card">
        <label htmlFor="practice">やり方</label>
        <select id="practice" value={id} onChange={(e) => setId(e.target.value)} disabled={running}>
          {PRACTICES.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <p className="small">{practice.summary}</p>
        <p className="small">やめどき：{practice.stop}</p>

        <label htmlFor="minutes">長さ：{minutes}分</label>
        <input
          id="minutes"
          type="range"
          min={1}
          max={30}
          value={minutes}
          disabled={running}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMinutes(v);
            setLeft(v * 60);
            actions.setSettings({ meditationMinutes: v });
          }}
        />

        <BreathGuide practice={practice} running={running} />
        <div className="sos-timer">{mmss(left)}</div>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 10 }}>
          {running ? (
            <button className="wide" onClick={() => setRunning(false)}>とめる</button>
          ) : (
            <button className="primary wide" onClick={start}>はじめる</button>
          )}
        </div>
        <p className="small">
          この画面は記録を残しません（何日やったかを数えません）。数えると、できなかった日を責める材料になるためです。
        </p>
      </div>

      <div className="card">
        <h3>やり方の一覧</h3>
        {PRACTICES.map((p) => (
          <div key={p.id} className="list-item">
            <strong style={{ fontSize: 14 }}>{p.title}</strong>
            <p className="small">{p.summary}</p>
            <p className="small">やめどき：{p.stop}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
