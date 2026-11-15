import { useEffect, useRef, useState } from 'react';
import '../styles/clockWeather.css';
import { playAlarmSound, alarmSoundName } from '../lib/alarmSounds.js';
import { vibrate } from '../lib/sound.js';
import { SNOOZE_MIN } from '../lib/alarm.js';

// アラームが鳴っている間の画面（どの画面にいても上に出る）。止める／スヌーズの2択。
// 音は「止める」まで鳴り続けるが、切り忘れ対策として5分で音だけ自動で止める（画面は残す）。
const AUTO_SILENCE_MS = 5 * 60 * 1000;

export default function AlarmRinger({ alarm, volume = 1, onStop, onSnooze }) {
  const playerRef = useRef(null);
  const [blocked, setBlocked] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const boxRef = useRef(null);

  const start = () => {
    playerRef.current?.stop();
    const p = playAlarmSound(alarm.sound, { volume, loop: true });
    playerRef.current = p;
    return p;
  };

  useEffect(() => {
    const p = start();
    vibrate([400, 200, 400, 200, 400]);
    // 操作なしの自動再生がブラウザに止められていたら、タップで鳴らせるよう知らせる
    const check = setTimeout(() => setBlocked(p.blocked || p.isBlocked()), 900);
    const silence = setTimeout(() => { playerRef.current?.stop(); setSilenced(true); }, AUTO_SILENCE_MS);
    boxRef.current?.focus();
    return () => {
      clearTimeout(check);
      clearTimeout(silence);
      playerRef.current?.stop();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarm.id]);

  return (
    <div className="alarm-ring-backdrop" role="alertdialog" aria-modal="true" aria-label="アラームが鳴っています">
      <div className="alarm-ring" ref={boxRef} tabIndex={-1}>
        <div className="alarm-ring-ico" aria-hidden="true">⏰</div>
        <div className="alarm-ring-time">{alarm.time}</div>
        <div className="alarm-ring-label">{alarm.label || 'アラーム'}</div>
        <div className="alarm-ring-sound">♪ {alarmSoundName(alarm.sound)}</div>
        {blocked && !silenced && (
          <button type="button" className="cw-btn" onClick={() => { const p = start(); setTimeout(() => setBlocked(p.blocked || p.isBlocked()), 500); }}>
            🔈 音が出ていない時はここをタップ
          </button>
        )}
        {silenced && <p className="cw-note sub">5分たったので音だけ止めました。</p>}
        <div className="alarm-ring-actions">
          <button type="button" className="cw-btn primary big" onClick={onStop}>止める</button>
          <button type="button" className="cw-btn big" onClick={onSnooze}>スヌーズ（{SNOOZE_MIN}分後）</button>
        </div>
      </div>
    </div>
  );
}
