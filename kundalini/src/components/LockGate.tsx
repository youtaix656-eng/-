import { useState } from 'react';
import { PIN_MAX, verifyPin } from '../lib/lock.js';
import { actions } from '../lib/useStore.js';
import type { AppState } from '../types/index.js';

// ロック画面。
// ⚠ 行き止まりを作らない：PIN を忘れたときに何ができるかを、この画面自身に書く
//    （このアプリは端末の中にしか記録が無いので、思い出せなければ消すしかない）。
// ⚠ できないことを書かない：生体認証は使えない。

export function LockGate({ state, onUnlock }: { state: AppState; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [askReset, setAskReset] = useState(false);

  const push = (n: string) => {
    if (pin.length >= PIN_MAX) return;
    setErr('');
    setPin(pin + n);
  };

  const submit = async (value: string) => {
    const ok = await verifyPin(value, state.settings.pinHash, state.settings.pinKind);
    if (ok) {
      onUnlock();
      return;
    }
    setErr('番号が違います。');
    setPin('');
  };

  return (
    <div className="lock">
      <div className="lock-inner">
        <p className="small">暗証番号を入れてください。</p>
        <div className="pin-dots" aria-hidden="true">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span key={i} className={`pin-dot${i < pin.length ? ' on' : ''}`} />
          ))}
        </div>
        {err && <p className="err">{err}</p>}
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button key={n} onClick={() => push(n)}>{n}</button>
          ))}
          <button className="ghost" onClick={() => setPin('')}>消す</button>
          <button onClick={() => push('0')}>0</button>
          <button className="primary" onClick={() => void submit(pin)}>開く</button>
        </div>

        <div className="card" style={{ textAlign: 'left', marginTop: 20 }}>
          <h3>番号を忘れたとき</h3>
          <p className="small">
            記録はこの端末の中にしかないので、番号を思い出せない場合は、消してやり直すしかありません。
            （書き出しファイルを持っている場合は、消したあとで取り込めます。）
          </p>
          {askReset ? (
            <div className="btn-row">
              <button className="danger" onClick={() => void actions.resetAll().then(onUnlock)}>
                本当にすべて消す
              </button>
              <button className="ghost" onClick={() => setAskReset(false)}>やめる</button>
            </div>
          ) : (
            <button className="ghost danger" onClick={() => setAskReset(true)}>すべて消してやり直す</button>
          )}
        </div>
        <p className="small">
          このロックはのぞき見よけです。端末の中の記録そのものを暗号化するものではありません。
          指紋・顔での解除には対応していません。
        </p>
      </div>
    </div>
  );
}
