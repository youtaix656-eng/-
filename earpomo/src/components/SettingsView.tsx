import { useState } from 'react';
import { Icon } from './Icons.js';
import { BgmView } from './BgmView.js';
import { actions, activePreset } from '../lib/useStore.js';
import { playSound, unlockAudio } from '../lib/bell.js';
import { approximateSize } from '../lib/storage.js';
import { requestNotifyPermission, notifySupported, wakeLockSupported } from '../lib/wake.js';
import { LIMITS } from '../data/presets.js';
import { SOUND_OPTIONS, soundName } from '../data/sounds.js';
import type { AppState, Preset, SoundId } from '../types/index.js';
import type { HeadphoneStatus } from '../lib/headphones.js';

type Sub = null | 'bgm' | 'startSound' | 'endSound';

const TIME_FIELDS: { key: keyof typeof LIMITS; label: string; unit: string }[] = [
  { key: 'focusMinutes', label: '集中時間', unit: '分' },
  { key: 'shortBreakMinutes', label: '短い休憩', unit: '分' },
  { key: 'longBreakMinutes', label: '長い休憩', unit: '分' },
  { key: 'sessionsCount', label: 'セッション回数', unit: '回' },
];

export function SettingsView({
  state,
  headphone,
}: {
  state: AppState;
  headphone: { status: HeadphoneStatus; detectable: boolean; allowed: boolean };
}) {
  const [sub, setSub] = useState<Sub>(null);
  const [editing, setEditing] = useState<keyof typeof LIMITS | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const preset = activePreset(state);
  const s = state.settings;
  const running = state.timer.status === 'running';

  if (sub === 'bgm') return <BgmView state={state} audioAllowed={headphone.allowed} onBack={() => setSub(null)} />;
  if (sub === 'startSound' || sub === 'endSound') {
    const key = sub;
    const current = s[key];
    return (
      <section className="view" aria-label={key === 'startSound' ? '開始音' : '終了音'}>
        <div className="sub-head">
          <button className="icon-btn" onClick={() => setSub(null)} aria-label="戻る"><Icon name="back" /></button>
          <span className="title">{key === 'startSound' ? '開始音' : '終了音'}</span>
        </div>
        <ul className="rows">
          {SOUND_OPTIONS.map((o) => (
            <li key={o.id}>
              <button
                className="row-btn"
                onClick={() => {
                  actions.setSettings({ [key]: o.id } as Partial<AppState['settings']>);
                  if (headphone.allowed) {
                    unlockAudio();
                    playSound(o.id as SoundId);
                  }
                }}
              >
                <span className="name">{o.name}<span className="quiet inline">{o.note}</span></span>
                {current === o.id && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
        </ul>
        <p className="quiet">{headphone.allowed ? 'タップすると試し聞きできます。' : 'イヤホンの確認が取れていないため、試し聞きは鳴りません。'}</p>
      </section>
    );
  }

  const changeField = (key: keyof typeof LIMITS, delta: number) => {
    const lim = LIMITS[key];
    const next = Math.min(lim.max, Math.max(lim.min, preset[key] + delta));
    actions.updatePreset(preset.id, { [key]: next } as Partial<Preset>);
  };

  return (
    <section className="view" aria-label="設定">
      <h2 className="view-title">設定</h2>
      <h3 className="label">イヤホン</h3>
      <div className="card">
        <div className="hp-row">
          <Icon name="headphones" size={20} />
          <span>{headphone.status === 'connected' ? 'イヤホン・ヘッドホンが見つかっています' : headphone.detectable ? '自動では見つかっていません' : 'この端末では自動で確かめられません'}</span>
        </div>
        <label className="switch-row">
          <span>イヤホンをつけている（自分で確認）</span>
          <input type="checkbox" checked={s.headphoneConfirmed} onChange={(e) => actions.setSettings({ headphoneConfirmed: e.target.checked })} />
        </label>
        <p className="quiet">
          音（BGM・開始音・終了音）は、イヤホンが自動で見つかった時か、この確認がある時だけ出します。
          ブラウザはイヤホンの抜き差しを直接教えてくれないため、確かめられない端末では本人の確認に任せています。
          {headphone.status === 'connected' ? ' 見つかっていたものが消えた時は、確認を外して音を止めます。' : ''}
        </p>
      </div>

      <h3 className="label">プリセット</h3>
      <ul className="rows">
        {state.presets.map((p) => (
          <li key={p.id} className="row-item">
            {renaming === p.id ? (
              <div className="tag-edit">
                <label className="visually-hidden" htmlFor={`rn-${p.id}`}>名前</label>
                <input id={`rn-${p.id}`} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={40} />
                <div className="row">
                  <button className="btn" onClick={() => { actions.updatePreset(p.id, { name: nameDraft.trim() || p.name }); setRenaming(null); }}>決める</button>
                  <button className="btn ghost" onClick={() => setRenaming(null)}>閉じる</button>
                </div>
              </div>
            ) : (
              <>
                <button className="row-btn" onClick={() => actions.selectPreset(p.id)} disabled={running && p.id !== state.activePresetId}>
                  <span className="name">{p.name}<span className="quiet inline">{p.focusMinutes}/{p.shortBreakMinutes}/{p.longBreakMinutes}・{p.sessionsCount}回</span></span>
                  {p.id === state.activePresetId && <Icon name="check" size={16} />}
                </button>
                <button className="icon-btn" onClick={() => { setRenaming(p.id); setNameDraft(p.name); }} aria-label={`${p.name} の名前を変える`}><Icon name="note" size={16} /></button>
                {state.presets.length > 1 && (
                  <button className="icon-btn" onClick={() => actions.deletePreset(p.id)} aria-label={`${p.name} を削除`}><Icon name="trash" size={16} /></button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <button className="link faint" onClick={() => { const id = actions.addPreset(); setRenaming(id); setNameDraft(`${preset.name} のコピー`); }}>
        <Icon name="plus" size={13} /> プリセットを追加
      </button>
      {running && <p className="quiet">走っている間はプリセットを切り替えられません。</p>}

      <h3 className="label">時間設定（{preset.name}）</h3>
      <ul className="rows">
        {TIME_FIELDS.map((f) => (
          <li key={f.key} className="row-item">
            <button className="row-btn" onClick={() => setEditing(editing === f.key ? null : f.key)} aria-expanded={editing === f.key}>
              <span className="name">{f.label}</span>
              <span className="val">{preset[f.key]}{f.unit} <Icon name="chevron" size={14} /></span>
            </button>
            {editing === f.key && (
              <div className="stepper">
                <button className="btn ghost" onClick={() => changeField(f.key, -5)} aria-label="5減らす">−5</button>
                <button className="btn ghost" onClick={() => changeField(f.key, -1)} aria-label="1減らす">−1</button>
                <span className="cur">{preset[f.key]}{f.unit}</span>
                <button className="btn ghost" onClick={() => changeField(f.key, 1)} aria-label="1増やす">+1</button>
                <button className="btn ghost" onClick={() => changeField(f.key, 5)} aria-label="5増やす">+5</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <label className="switch-row">
        <span>集中 → 休憩 → 集中 を自動で進める</span>
        <input type="checkbox" checked={s.autoContinue} onChange={(e) => actions.setSettings({ autoContinue: e.target.checked })} />
      </label>

      <h3 className="label">音・通知</h3>
      <ul className="rows">
        <li className="row-item">
          <button className="row-btn" onClick={() => setSub('startSound')}>
            <span className="name">開始音</span><span className="val">{soundName(s.startSound)} <Icon name="chevron" size={14} /></span>
          </button>
        </li>
        <li className="row-item">
          <button className="row-btn" onClick={() => setSub('endSound')}>
            <span className="name">終了音</span><span className="val">{soundName(s.endSound)} <Icon name="chevron" size={14} /></span>
          </button>
        </li>
        <li className="row-item">
          <label className="switch-row">
            <span>バイブ</span>
            <input type="checkbox" checked={s.vibrate} onChange={(e) => actions.setSettings({ vibrate: e.target.checked })} />
          </label>
        </li>
        <li className="row-item">
          <button className="row-btn" onClick={() => setSub('bgm')}>
            <span className="name">勉強中BGM</span>
            <span className="val">{s.bgmId ? state.bgm.find((b) => b.id === s.bgmId)?.name ?? '無音' : '無音'} <Icon name="chevron" size={14} /></span>
          </button>
        </li>
      </ul>

      <h3 className="label">裏に回った時</h3>
      <ul className="rows">
        <li className="row-item">
          <label className="switch-row">
            <span>走っている間は画面を眠らせない{wakeLockSupported() ? '' : '（この端末は非対応）'}</span>
            <input type="checkbox" checked={s.keepAwake} disabled={!wakeLockSupported()} onChange={(e) => actions.setSettings({ keepAwake: e.target.checked })} />
          </label>
        </li>
        <li className="row-item">
          <label className="switch-row">
            <span>局面の終わりを端末通知で知らせる{notifySupported() ? '' : '（この端末は非対応）'}</span>
            <input
              type="checkbox"
              checked={s.notify}
              disabled={!notifySupported()}
              onChange={async (e) => {
                if (!e.target.checked) return actions.setSettings({ notify: false });
                const ok = await requestNotifyPermission();
                actions.setSettings({ notify: ok });
              }}
            />
          </label>
        </li>
      </ul>
      <p className="quiet">
        タイマーは「終わる時刻」から毎回引き算しているので、裏に回っても戻った時に正しい残り時間になります。
        ただしブラウザや端末によっては、裏で音が止まる・通知が出ないことがあります（アプリが生きている間だけ効く仕組みです）。
      </p>

      <h3 className="label">データ</h3>
      <p className="quiet">保存場所は端末の中だけ（目安 {Math.round(approximateSize(state) / 1024)} KB。曲の音声は別に持ちます）。どこへも送りません。</p>
      {confirmReset ? (
        <div className="row">
          <button className="btn" onClick={() => { void actions.resetAll(); setConfirmReset(false); }}>本当にすべて消す</button>
          <button className="btn ghost" onClick={() => setConfirmReset(false)}>やめる</button>
        </div>
      ) : (
        <button className="link faint" onClick={() => setConfirmReset(true)}><Icon name="trash" size={13} /> すべてのデータを消す（記録・予定・曲・設定）</button>
      )}
    </section>
  );
}
