import { useEffect, useState } from 'react';
import { clampDraftCommit, BEEP_TONES } from '../lib/pomodoroLogic.js';
import { dailyBreakdown } from '../lib/pomoLog.js';
import { phaseForDate } from '../data/roadmapPhases.js';
import { requestNotifyPermissionIfNeeded, notifyStatusLabel } from '../lib/pomoNotify.js';

// ポモドーロの設定パネル一式（プリセット・分数・通知・音・統計）を独立ファイルへ切り出し、
// Pomodoro.jsx側からはlazy(() => import(...))で読み込む（設定を開くまでJSは要らないため）。
// Settings.jsx（表示OFFの間も調整できる画面）は PomodoroConfigFields をそのまま同期import
// しているが、そちらは元々lazyな画面なので起動時バンドルには影響しない。
// Pomodoro自体はApp.jsxの常時マウント対象（下部ナビ以外で唯一の例外）のため、ここを
// 分離しないと設定に使う項目（プリセット・数字入力・音の設定など）がすべて起動時の
// 読み込み量に含まれてしまう。

// 科目の重さ・場面別プリセット（ワンタップで勉強/短い休憩の分数を切り替える）。
// 長い休憩・サイクル回数は個人差が大きいのでプリセットに含めず、既存の設定のまま残す。
const POMO_PRESETS = [
  { id: 'heavy', label: '重い科目（25+5）', study: 25, shortBreak: 5, hint: '解剖学・生理学など、じっくり読み解く科目向け' },
  { id: 'light', label: '軽い科目（15+5）', study: 15, shortBreak: 5, hint: '一問一答の反復など、テンポよく回す科目向け' },
  { id: 'gap', label: '隙間時間（10分×3）', study: 10, shortBreak: 3, hint: '通勤・休憩の合間など、短時間だけ確保できる時' },
];

const pad2 = (n) => String(n).padStart(2, '0');
function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 分・回数などの数値入力欄。value(確定値)をそのままcontrolled inputに渡すと、
// 全消しして2桁の新しい数字を打つ途中（一瞬空文字→0扱い）にmin側へ強制的に
// スナップして「一桁残さないと入力できない」状態になる。ここでは入力中は
// 自由な文字列（空欄も含む）をローカルに保持し、フォーカスが外れた時にだけ
// min/maxへ丸めて確定する（判定はclampDraftCommitに切り出し単体テスト済み）。
// stepボタン（＋/－）も併設し、スマホでも調整しやすくする。
export function PomoNumberField({ label, value, min, max, step = 1, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = (raw) => {
    const { clamped, changed } = clampDraftCommit(raw, value, min, max);
    setDraft(String(clamped));
    if (changed) onCommit(clamped);
  };
  const bump = (delta) => {
    const cur = Number.isFinite(parseInt(draft, 10)) ? parseInt(draft, 10) : value;
    commit(String(Math.min(max, Math.max(min, cur + delta))));
  };
  return (
    <label>
      {label}
      <span className="pomo-num-row">
        <button type="button" className="pomo-num-step" onClick={() => bump(-step)} aria-label={`${label}を減らす`}>－</button>
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
        <button type="button" className="pomo-num-step" onClick={() => bump(step)} aria-label={`${label}を増やす`}>＋</button>
      </span>
    </label>
  );
}

// 設定フィールド一式（プリセット＋分数＋通知＋カスタムプリセット保存＋音・集中モード）。
// ポモドーロのバー（⚙）と、設定画面（表示オフの間も調整できるように）の両方から使う。
export function PomodoroConfigFields({ cfg, setCfg }) {
  const customPresets = cfg.customPresets || [];
  const [notifyStatus, setNotifyStatus] = useState(notifyStatusLabel());
  useEffect(() => {
    const t = setInterval(() => setNotifyStatus(notifyStatusLabel()), 2000);
    return () => clearInterval(t);
  }, []);
  const saveCustomPreset = () => {
    const label = `カスタム（${cfg.study || 25}+${cfg.shortBreak || 5}）`;
    if (customPresets.some((p) => p.study === (cfg.study || 25) && p.shortBreak === (cfg.shortBreak || 5))) return;
    const next = [...customPresets, { id: `custom-${Date.now()}`, label, study: cfg.study || 25, shortBreak: cfg.shortBreak || 5 }].slice(-5);
    setCfg({ customPresets: next });
  };
  const removeCustomPreset = (id) => setCfg({ customPresets: customPresets.filter((p) => p.id !== id) });
  const moveCustomPreset = (id, dir) => {
    const idx = customPresets.findIndex((p) => p.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= customPresets.length) return;
    const arr = customPresets.slice();
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setCfg({ customPresets: arr });
  };

  const todayPhase = phaseForDate(todayDateStr());

  return (
    <>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {POMO_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${cfg.study === p.study && cfg.shortBreak === p.shortBreak ? 'active' : ''}`}
            onClick={() => setCfg({ study: p.study, shortBreak: p.shortBreak })}
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
        {customPresets.map((p, i) => (
          <span key={p.id} className={`chip-with-remove ${cfg.study === p.study && cfg.shortBreak === p.shortBreak ? 'active' : ''}`}>
            {i > 0 && <button className="chip-reorder" onClick={() => moveCustomPreset(p.id, -1)} aria-label={`${p.label}を前へ`}>‹</button>}
            <button className="chip" onClick={() => setCfg({ study: p.study, shortBreak: p.shortBreak })}>{p.label}</button>
            {i < customPresets.length - 1 && <button className="chip-reorder" onClick={() => moveCustomPreset(p.id, 1)} aria-label={`${p.label}を後ろへ`}>›</button>}
            <button className="chip-remove" onClick={() => removeCustomPreset(p.id)} aria-label={`${p.label}を削除`}>×</button>
          </span>
        ))}
        <button className="chip" onClick={saveCustomPreset} title="今の勉強・短い休憩の分数を組み合わせとして保存">＋ 現在の組み合わせを保存</button>
      </div>
      <div className="pomo-config-grid">
        <PomoNumberField label="勉強（分）" min={1} max={180} step={5} value={cfg.study || 25} onCommit={(n) => setCfg({ study: n })} />
        <PomoNumberField label="短い休憩（分）" min={1} max={60} step={5} value={cfg.shortBreak || 5} onCommit={(n) => setCfg({ shortBreak: n })} />
        <PomoNumberField label="長い休憩（分）" min={1} max={120} step={5} value={cfg.longBreak || 15} onCommit={(n) => setCfg({ longBreak: n })} />
        <PomoNumberField
          label="長休憩まで（回）"
          min={1}
          max={12}
          value={cfg.cycles || 4}
          onCommit={(n) => setCfg({ cycles: n })}
        />
        <PomoNumberField
          label="勉強中の通知（分おき・0でなし）"
          min={0}
          max={60}
          value={cfg.notifyEvery || 0}
          onCommit={(n) => {
            setCfg({ notifyEvery: n });
            if (n > 0) requestNotifyPermissionIfNeeded();
          }}
        />
        <PomoNumberField
          label="1日の目標勉強時間（分・0でなし）"
          min={0}
          max={600}
          step={10}
          value={cfg.dailyGoalMin || 0}
          onCommit={(n) => setCfg({ dailyGoalMin: n })}
        />
      </div>
      <p className="pomo-hint">通知の許可状態：{notifyStatus}</p>
      {(cfg.notifyEvery || 0) > 0 && (cfg.notifyEvery || 0) >= (cfg.study || 25) && (
        <p className="pomo-hint" style={{ color: 'var(--wrong, #c62828)' }}>
          ⚠️ 通知間隔（{cfg.notifyEvery}分）が勉強時間（{cfg.study || 25}分）以上のため、この設定では通知が一度も鳴りません。
        </p>
      )}
      <p className="pomo-hint">「長休憩まで（回）」を変更すると、現在の位置（◯/◯）もその場で新しい回数で数え直されます。</p>
      {todayPhase && (
        <p className="pomo-hint">📍 今のロードマップフェーズ：{todayPhase.title}（{todayPhase.mix}）</p>
      )}
      <label className="pomo-switch" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={cfg.beepEnabled !== false} onChange={(e) => setCfg({ beepEnabled: e.target.checked })} />
        <span>フェーズ切り替え時に効果音を鳴らす</span>
      </label>
      {cfg.beepEnabled !== false && (
        <div className="pomo-sound-sub">
          <label className="pomo-select-row">
            音の種類
            <select value={cfg.beepTone || 'chime'} onChange={(e) => setCfg({ beepTone: e.target.value })}>
              {BEEP_TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="pomo-select-row">
            音量（{cfg.beepVolume ?? 100}%）
            <input
              type="range" min={0} max={100} step={5}
              value={cfg.beepVolume ?? 100}
              onChange={(e) => setCfg({ beepVolume: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
      <label className="pomo-switch" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={!!cfg.wakeLock} onChange={(e) => setCfg({ wakeLock: e.target.checked })} />
        <span>実行中は画面を暗くしない（対応端末のみ）</span>
      </label>
      <label className="pomo-switch" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={!!cfg.autoMinimizeOnStudy} onChange={(e) => setCfg({ autoMinimizeOnStudy: e.target.checked })} />
        <span>集中モード（勉強が始まったら自動でバーを最小化）</span>
      </label>
      <label className="pomo-switch" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={cfg.barPosition === 'bottom'} onChange={(e) => setCfg({ barPosition: e.target.checked ? 'bottom' : 'top' })} />
        <span>最小化中は画面下に表示する（既定は上部。開くと通常どおり上部に表示します）</span>
      </label>
      <label className="pomo-switch" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={!!cfg.confirmBeforeClose} onChange={(e) => setCfg({ confirmBeforeClose: e.target.checked })} />
        <span>勉強中にタブを閉じようとしたら一声かける（PCブラウザのみ有効。既定オフ）</span>
      </label>
    </>
  );
}

// 統計まわり（週間グラフ・CSV書き出し・データ消去）。設定より重くなりがちなので
// PomodoroConfigFieldsとは別に切り出し、Pomodoro.jsx側でだけ使う（Settings.jsxは使わない）。
export function PomodoroStatsPanel({ log, onExportCsv, onResetStats }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const rows = dailyBreakdown(log, 7);
  const maxSec = Math.max(1, ...rows.map((r) => r.sec));
  return (
    <div className="pomo-graph-wrap">
      <p className="pomo-hint" style={{ marginTop: 0 }}>直近7日間の勉強時間</p>
      <div className="pomo-graph">
        {rows.map((r) => (
          <div className="pomo-graph-col" key={r.dateKey}>
            <div className="pomo-graph-bar" style={{ height: `${Math.max(4, (r.sec / maxSec) * 100)}%` }} title={`${Math.round(r.sec / 60)}分`} />
            <span className="pomo-graph-lbl">{r.dateKey}</span>
          </div>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn sm ghost" onClick={onExportCsv}>📤 統計をCSVで書き出す</button>
        {!confirmClear ? (
          <button className="btn sm ghost" onClick={() => setConfirmClear(true)}>統計を消去</button>
        ) : (
          <>
            <button className="btn sm danger" onClick={() => { onResetStats(); setConfirmClear(false); }}>本当に消去する</button>
            <button className="btn sm ghost" onClick={() => setConfirmClear(false)}>やめる</button>
          </>
        )}
      </div>
    </div>
  );
}
