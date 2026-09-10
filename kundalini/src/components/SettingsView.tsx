import { useState } from 'react';
import { actions } from '../lib/useStore.js';
import { approximateSize } from '../lib/storage.js';
import { buildBackup, backupFilename, parseBackup } from '../lib/backup.js';
import { hashPin, validatePin, canUseStrongHash } from '../lib/lock.js';
import { normalizeThresholds } from '../lib/level.js';
import { CHAKRAS, DEFAULT_THRESHOLDS, CHAKRA_DISCLAIMER } from '../data/chakras.js';
import { PRESETS, REAL_TITLE, applyDisguise } from '../lib/disguise.js';
import { HELP_NOTE, OUT_OF_SCOPE } from '../data/safety.js';
import type { AppState } from '../types/index.js';

export function SettingsView({ state }: { state: AppState }) {
  return (
    <div>
      <h2 className="view-title">設定</h2>
      <LevelSettings state={state} />
      <TimerSettings state={state} />
      <PinSettings state={state} />
      <DisguiseSettings state={state} />
      <DataSettings state={state} />
      <div className="card">
        <h3>このアプリがしないこと</h3>
        {OUT_OF_SCOPE.map((line) => (
          <p key={line} className="small">・{line}</p>
        ))}
        <div className="note">{CHAKRA_DISCLAIMER}</div>
        <div className="note warn">{HELP_NOTE}</div>
      </div>
    </div>
  );
}

function LevelSettings({ state }: { state: AppState }) {
  const [list, setList] = useState<number[]>(() => normalizeThresholds(state.settings.levelThresholds));
  const [msg, setMsg] = useState('');
  return (
    <div className="card">
      <h3>チャクラレベルの境界日数</h3>
      <p className="small">
        何日でレベルが上がるかを決めます。<strong>この数字に根拠はありません</strong>——伝統にも医学にも
        「何日で次の段」という決まりは無いので、自分に合う区切りにしてかまいません。
      </p>
      {CHAKRAS.map((c, i) => (
        <div key={c.level} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
          <span style={{ width: 150, fontSize: 13 }}>
            レベル{c.level}・{c.name}
          </span>
          <input
            type="number"
            min={0}
            value={list[i]}
            disabled={i === 0}
            onChange={(e) => {
              const next = [...list];
              next[i] = Number(e.target.value);
              setList(next);
            }}
            style={{ width: 100 }}
            aria-label={`レベル${c.level}の境界日数`}
          />
          <span className="small">日〜</span>
        </div>
      ))}
      <div className="btn-row">
        <button
          className="primary"
          onClick={() => {
            const fixed = normalizeThresholds(list);
            setList(fixed);
            actions.setSettings({ levelThresholds: fixed });
            setMsg('保存しました。');
          }}
        >
          保存する
        </button>
        <button
          className="ghost"
          onClick={() => {
            setList([...DEFAULT_THRESHOLDS]);
            actions.setSettings({ levelThresholds: [...DEFAULT_THRESHOLDS] });
            setMsg('はじめの値に戻しました。');
          }}
        >
          はじめの値に戻す
        </button>
      </div>
      {msg && <p className="small ok-msg">{msg}</p>}
      <p className="small">※ 同じ数字が並ばないよう、保存するときに1日ずつ離します。</p>
    </div>
  );
}

function TimerSettings({ state }: { state: AppState }) {
  const s = state.settings;
  return (
    <div className="card">
      <h3>タイマー・音</h3>
      <label htmlFor="cool">冷却タイマーの長さ：{Math.round(s.coolDownSeconds / 60)}分</label>
      <input
        id="cool"
        type="range"
        min={1}
        max={20}
        value={Math.round(s.coolDownSeconds / 60)}
        onChange={(e) => actions.setSettings({ coolDownSeconds: Number(e.target.value) * 60 })}
      />
      <label>
        <input
          type="checkbox"
          checked={s.bell}
          onChange={(e) => actions.setSettings({ bell: e.target.checked })}
          style={{ width: 'auto', minHeight: 0, marginRight: 8 }}
        />
        始まりと終わりに音を鳴らす
      </label>
      <p className="small">音は端末の中で作っています（音声ファイルを持っていません）。鳴らない端末でもタイマーは動きます。</p>
    </div>
  );
}

function PinSettings({ state }: { state: AppState }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const on = state.settings.pinHash != null;

  return (
    <div className="card">
      <h3>のぞき見よけ（暗証番号）</h3>
      {on ? (
        <>
          <p className="small">いま、開くときに番号を聞くようになっています。</p>
          <button className="ghost danger" onClick={() => { actions.setSettings({ pinHash: null, pinKind: null }); setMsg('番号を外しました。'); }}>
            番号を外す
          </button>
        </>
      ) : (
        <>
          <label htmlFor="pin1">暗証番号（数字4〜8桁）</label>
          <input id="pin1" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
          <label htmlFor="pin2">もう一度</label>
          <input id="pin2" type="password" inputMode="numeric" value={again} onChange={(e) => setAgain(e.target.value)} />
          <button
            className="primary"
            style={{ marginTop: 10 }}
            onClick={() => {
              const bad = validatePin(pin);
              if (bad) { setErr(bad); return; }
              if (pin !== again) { setErr('2つの番号が違います。'); return; }
              void hashPin(pin).then(({ hash, kind }) => {
                actions.setSettings({ pinHash: hash, pinKind: kind });
                setPin('');
                setAgain('');
                setErr('');
                setMsg('番号を設定しました。次に開くときから聞きます。');
              });
            }}
          >
            この番号にする
          </button>
        </>
      )}
      {err && <p className="err">{err}</p>}
      {msg && <p className="small ok-msg">{msg}</p>}
      <p className="small">
        番号は、そのままではなく変換して保存します（入力した数字そのものは残りません）。
        ただしこれは<strong>のぞき見よけ</strong>で、端末の中の記録を暗号化するものではありません。
        {!canUseStrongHash() && 'この端末では簡易な方式で変換します。'}
      </p>
      <p className="small">指紋・顔での解除には対応していません（ブラウザからは鍵を安全に置く場所を用意できないため）。</p>
      <p className="small">番号を忘れると開けません。消してやり直すことになるので、書き出しを取っておくと安心です。</p>
    </div>
  );
}

function DisguiseSettings({ state }: { state: AppState }) {
  const s = state.settings;
  return (
    <div className="card">
      <h3>表示名を変える</h3>
      <label>
        <input
          type="checkbox"
          checked={s.disguiseEnabled}
          onChange={(e) => {
            actions.setSettings({ disguiseEnabled: e.target.checked });
            applyDisguise(e.target.checked, s.disguiseTitle, s.disguiseIcon);
          }}
          style={{ width: 'auto', minHeight: 0, marginRight: 8 }}
        />
        別の名前で表示する
      </label>
      <div className="chip-row">
        {PRESETS.map((p) => (
          <button
            key={p.title}
            className={`chip${s.disguiseTitle === p.title ? ' on' : ''}`}
            onClick={() => {
              actions.setSettings({ disguiseTitle: p.title, disguiseIcon: p.icon, disguiseEnabled: true });
              applyDisguise(true, p.title, p.icon);
            }}
          >
            {p.icon} {p.title}
          </button>
        ))}
      </div>
      <label htmlFor="dg-title">名前</label>
      <input
        id="dg-title"
        type="text"
        value={s.disguiseTitle}
        placeholder={REAL_TITLE}
        onChange={(e) => {
          actions.setSettings({ disguiseTitle: e.target.value });
          applyDisguise(s.disguiseEnabled, e.target.value, s.disguiseIcon);
        }}
      />
      <label htmlFor="dg-icon">アイコン（絵文字1つ）</label>
      <input
        id="dg-icon"
        type="text"
        value={s.disguiseIcon}
        placeholder="📝"
        onChange={(e) => {
          actions.setSettings({ disguiseIcon: e.target.value });
          applyDisguise(s.disguiseEnabled, s.disguiseTitle, e.target.value);
        }}
      />
      <p className="small">
        変えられるのは<strong>ブラウザのタブに出る名前とアイコン</strong>だけです。
        すでにホーム画面に追加してあるアイコンの名前は変わりません
        （追加した時点の名前が焼き付くため、変えたい場合は一度削除してから追加し直してください）。
      </p>
    </div>
  );
}

function DataSettings({ state }: { state: AppState }) {
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [askReset, setAskReset] = useState(false);
  const size = approximateSize(state);

  const exportFile = () => {
    const at = Date.now();
    const blob = new Blob([JSON.stringify(buildBackup(state, at), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename(at);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('書き出しました。記録がそのまま入っているので、置き場所に気をつけてください。');
  };

  return (
    <div className="card">
      <h3>データ</h3>
      <p className="small">
        いま保存されているのは約 {(size / 1024).toFixed(1)} KB です。記録はこの端末の中だけにあります
        （送る仕組み自体を持っていません）。
      </p>
      <div className="btn-row">
        <button onClick={exportFile}>ファイルに書き出す</button>
        <label htmlFor="import-file" style={{ margin: 0 }}>
          <button onClick={() => document.getElementById('import-file')?.click()}>ファイルから取り込む</button>
        </label>
        <input
          id="import-file"
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const res = parseBackup(text);
              if (!res.ok) {
                setErr(res.reason);
                setPending(null);
                return;
              }
              setErr('');
              setPending(text);
            });
            e.target.value = '';
          }}
        />
      </div>
      {pending && (
        <div className="card flat">
          <p className="small">
            取り込むと、<strong>いまの記録は置き換わります</strong>（元には戻せません）。よろしいですか？
          </p>
          <div className="btn-row">
            <button
              className="danger"
              onClick={() => {
                const res = parseBackup(pending);
                if (res.ok) {
                  actions.replaceState(res.file.state);
                  setMsg('取り込みました。');
                }
                setPending(null);
              }}
            >
              置き換える
            </button>
            <button className="ghost" onClick={() => setPending(null)}>やめる</button>
          </div>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      {msg && <p className="small ok-msg">{msg}</p>}
      <p className="small">※ 暗証番号は書き出しに含めません（別の端末へロックごと持って行かないため）。</p>

      <h3>すべて消す</h3>
      <p className="small">消えるもの：継続の記録・リラプスの記録・日々の記録とジャーナル・緊急ボタンの記録・設定。</p>
      {askReset ? (
        <div className="btn-row">
          <button className="danger" onClick={() => void actions.resetAll().then(() => { setAskReset(false); setMsg('すべて消しました。'); })}>
            本当に消す
          </button>
          <button className="ghost" onClick={() => setAskReset(false)}>やめる</button>
        </div>
      ) : (
        <button className="ghost danger" onClick={() => setAskReset(true)}>すべて消す</button>
      )}
    </div>
  );
}
