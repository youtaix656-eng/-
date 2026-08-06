import { useState } from 'react';

// 共通のインライン・リセット部品
//   ①「◯◯をリセット」ボタン → ②「本当にリセットしますか？」はい/いいえ で確認
// Session の .sess-reset-* スタイルを流用する。
export default function ResetInline({ label = 'リセット', confirmText = '本当にリセットしますか？', onReset }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="sess-reset-confirm">
        <span className="sess-reset-q">{confirmText}</span>
        <div className="btn-row">
          <button className="btn danger" onClick={() => { setConfirming(false); onReset(); }}>はい</button>
          <button className="btn ghost" onClick={() => setConfirming(false)}>いいえ</button>
        </div>
      </div>
    );
  }
  return (
    <button className="btn ghost sm block sess-reset-btn" style={{ marginTop: 10 }} onClick={() => setConfirming(true)}>
      🗑 {label}
    </button>
  );
}
