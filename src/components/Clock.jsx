import { useEffect, useRef, useState } from 'react';
import '../styles/clockWeather.css';
import {
  ALARM_MAX, WEEKDAY_LABELS, makeAlarm, nextRingAt, untilText, repeatText, sortAlarms, normalizeDays,
} from '../lib/alarm.js';
import { ALARM_SOUNDS, alarmSoundName, playAlarmSound, primeAlarmAudio } from '../lib/alarmSounds.js';

// 時計（アナログ＋デジタル）とアラーム（2026-11-15追加・ユーザー指定）。
// 黒い文字盤に1〜12の数字、白い針（芯は黒）。1秒ごとに進む（刻む音は出さない）。
// アラームを実際に鳴らすのはApp.jsxの見張り＋AlarmRinger.jsx（どの画面にいても鳴るように）。
// ここは時刻の表示と、アラームの一覧・追加・編集だけ。

const pad2 = (n) => String(n).padStart(2, '0');
const DOW = ['日', '月', '火', '水', '木', '金', '土'];

function AnalogClock({ now }) {
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourDeg = (h + m / 60) * 30;
  const minDeg = (m + s / 60) * 6;
  const secDeg = s * 6;
  const numbers = [];
  for (let n = 1; n <= 12; n++) {
    const a = (n * 30 * Math.PI) / 180;
    numbers.push(
      <text key={n} x={120 + Math.sin(a) * 88} y={120 - Math.cos(a) * 88} className="clock-num" textAnchor="middle" dominantBaseline="central">
        {n}
      </text>
    );
  }
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    ticks.push(
      <line
        key={i}
        x1="120" y1={major ? 9 : 11} x2="120" y2={major ? 18 : 15}
        stroke="#fff" strokeWidth={major ? 2.2 : 1} opacity={major ? 0.95 : 0.5}
        transform={`rotate(${i * 6} 120 120)`}
      />
    );
  }
  return (
    <svg className="clock-face" viewBox="0 0 240 240" role="img" aria-label={`アナログ時計 ${now.getHours()}時${m}分${s}秒`}>
      <circle cx="120" cy="120" r="117" fill="#000" stroke="#fff" strokeWidth="3" />
      {ticks}
      {numbers}
      {/* 針は白、芯に黒い線（白と黒の針） */}
      <g transform={`rotate(${hourDeg} 120 120)`}>
        <line x1="120" y1="132" x2="120" y2="66" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
        <line x1="120" y1="122" x2="120" y2="74" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${minDeg} 120 120)`}>
        <line x1="120" y1="136" x2="120" y2="36" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
        <line x1="120" y1="124" x2="120" y2="44" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${secDeg} 120 120)`}>
        <line x1="120" y1="144" x2="120" y2="28" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="120" cy="120" r="6" fill="#fff" />
      <circle cx="120" cy="120" r="2.5" fill="#000" />
    </svg>
  );
}

const emptyDraft = (now) => ({
  id: null,
  time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
  days: [],
  label: '',
  sound: 'bell',
});

export default function Clock({ store, onToast }) {
  const { settings, updateSettings } = store;
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState(null); // 追加・編集中のアラーム（nullなら閉じている）
  const previewRef = useRef(null);
  const alarms = sortAlarms(settings.alarms);
  const volume = settings.alarmVolume ?? 1;

  // 1秒ごとに進める。秒が変わった時だけ描き直す（タブが裏から戻っても、時刻は毎回時計から読む）。
  useEffect(() => {
    let last = -1;
    const tick = () => {
      const d = new Date();
      if (d.getSeconds() !== last) {
        last = d.getSeconds();
        setNow(d);
      }
    };
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, []);

  const stopPreview = () => {
    previewRef.current?.stop();
    previewRef.current = null;
  };
  useEffect(() => stopPreview, []);

  const preview = (soundId) => {
    stopPreview();
    const p = playAlarmSound(soundId, { volume, loop: false });
    if (p.blocked) onToast?.('⚠️ この端末・ブラウザでは音を鳴らせません。');
    previewRef.current = p;
  };

  const saveAlarms = (next) => updateSettings({ alarms: next });

  const toggle = (a) => {
    primeAlarmAudio();
    const on = !a.enabled;
    // ONにし直した時は updatedAt を今にする（すでに過ぎた今日の時刻で即鳴らさないため）
    saveAlarms(alarms.map((x) => (x.id === a.id ? { ...x, enabled: on, snoozeUntil: null, updatedAt: on ? Date.now() : x.updatedAt } : x)));
  };

  const openNew = () => {
    if (alarms.length >= ALARM_MAX) {
      onToast?.(`アラームは${ALARM_MAX}件までです。不要なものを削除してください。`);
      return;
    }
    primeAlarmAudio();
    setDraft(emptyDraft(new Date()));
  };

  const saveDraft = () => {
    const made = makeAlarm({ ...draft, id: draft.id || undefined, enabled: true });
    if (!made) {
      onToast?.('⚠️ 時刻を入力してください。');
      return;
    }
    stopPreview();
    const next = draft.id ? alarms.map((x) => (x.id === draft.id ? made : x)) : [...alarms, made];
    saveAlarms(next);
    setDraft(null);
    onToast?.(`⏰ ${made.time} のアラームを保存しました（${untilText(nextRingAt(made) - Date.now())}）`);
  };

  const removeDraft = () => {
    stopPreview();
    saveAlarms(alarms.filter((x) => x.id !== draft.id));
    setDraft(null);
    onToast?.('アラームを削除しました');
  };

  const toggleDay = (d) => {
    const has = draft.days.includes(d);
    setDraft({ ...draft, days: normalizeDays(has ? draft.days.filter((x) => x !== d) : [...draft.days, d]) });
  };

  const nowMs = now.getTime();

  return (
    <div className="view cw-view">
      <h2 className="view-title">🕐 時計</h2>

      <div className="cw-panel clock-panel">
        <AnalogClock now={now} />
        <div className="clock-digital" aria-live="off">
          {pad2(now.getHours())}:{pad2(now.getMinutes())}:<span className="clock-digital-sec">{pad2(now.getSeconds())}</span>
        </div>
        <div className="clock-date">
          {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日（{DOW[now.getDay()]}）
        </div>
      </div>

      <div className="cw-panel">
        <div className="cw-head">
          <h3>⏰ アラーム</h3>
          <button type="button" className="cw-add" onClick={openNew} aria-label="アラームを追加">＋</button>
        </div>
        <p className="cw-note" role="note">
          ※このアプリはアプリを開いているまたバックグラウンドにあるときのみなる仕様です。アプリを閉じてる時はなりません
        </p>
        <p className="cw-note sub">
          バックグラウンドにある時は、端末の省電力やブラウザの制限で、鳴るのが遅れたり音が出なかったりすることがあります。
          確実に起きたい時は、端末の時計アプリのアラームも一緒に使ってください。
        </p>

        {alarms.length === 0 && !draft && <p className="cw-empty">アラームはまだありません。右上の「＋」で追加できます。</p>}

        <ul className="alarm-list">
          {alarms.map((a) => {
            const next = nextRingAt(a, nowMs);
            return (
              <li key={a.id} className={`alarm-item${a.enabled ? '' : ' off'}`}>
                <button type="button" className="alarm-main" onClick={() => { primeAlarmAudio(); setDraft({ id: a.id, time: a.time, days: normalizeDays(a.days), label: a.label || '', sound: a.sound }); }} aria-label={`${a.time}のアラームを編集`}>
                  <span className="alarm-time">{a.time}</span>
                  <span className="alarm-sub">
                    {a.label ? `${a.label}・` : ''}{repeatText(a.days)}・{alarmSoundName(a.sound)}
                  </span>
                  <span className="alarm-next">
                    {a.enabled && next ? (a.snoozeUntil && a.snoozeUntil > nowMs ? `スヌーズ中・${untilText(next - nowMs)}` : untilText(next - nowMs)) : 'オフ'}
                  </span>
                </button>
                <label className="cw-switch">
                  <input type="checkbox" checked={!!a.enabled} onChange={() => toggle(a)} aria-label={`${a.time}のアラームを${a.enabled ? 'オフ' : 'オン'}にする`} />
                  <span className="cw-switch-track" aria-hidden="true" />
                </label>
              </li>
            );
          })}
        </ul>

        {draft && (
          <div className="alarm-editor">
            <h4>{draft.id ? 'アラームを編集' : 'アラームを追加'}</h4>
            <label className="cw-field">
              時刻
              <input type="time" className="alarm-time-input" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            </label>
            <div className="cw-field">
              くり返し（選ばなければ1回だけ）
              <div className="alarm-days">
                {WEEKDAY_LABELS.map((w, d) => (
                  <button key={w} type="button" className={`alarm-day${draft.days.includes(d) ? ' active' : ''}`} onClick={() => toggleDay(d)} aria-pressed={draft.days.includes(d)}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <label className="cw-field">
              ラベル（任意）
              <input type="text" maxLength={30} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="例：朝の復習" />
            </label>
            <div className="cw-field">
              アラーム音（{ALARM_SOUNDS.length}種類・タップで試聴）
              <ul className="alarm-sounds">
                {ALARM_SOUNDS.map((s, i) => (
                  <li key={s.id}>
                    <button type="button" className={`alarm-sound${draft.sound === s.id ? ' active' : ''}`} onClick={() => { setDraft({ ...draft, sound: s.id }); preview(s.id); }} aria-pressed={draft.sound === s.id}>
                      <span className="alarm-sound-no">{i + 1}</span> {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="cw-field">
              アラームの音量（すべてのアラーム共通）
              <div className="cw-range">
                <input type="range" min="10" max="100" step="5" value={Math.round(volume * 100)} onChange={(e) => updateSettings({ alarmVolume: Number(e.target.value) / 100 })} aria-label="アラームの音量" />
                <span>{Math.round(volume * 100)}%</span>
              </div>
            </div>
            <div className="cw-actions">
              <button type="button" className="cw-btn primary" onClick={saveDraft}>保存する</button>
              <button type="button" className="cw-btn" onClick={() => { stopPreview(); setDraft(null); }}>やめる</button>
              {draft.id && <button type="button" className="cw-btn danger" onClick={removeDraft}>削除</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
