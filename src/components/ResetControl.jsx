// 学習リセットボタン ＋ 確認（はい/いいえ）
//   ①「学習◯◯をリセットする」をタップ → ②「本当にリセットしますか？」はい/いいえ
//   元はSession.jsxのローカル関数だったが、音声学習の「最初から」リセットでも同じ
//   確認の仕組みが要るため切り出した（単一の正。Session.jsx・AudioMode.jsxの両方から使う）。
export default function ResetControl({ target, label: labelOverride, confirming, onAsk, onConfirm, onCancel }) {
  const label = labelOverride || (target ? `学習${target}をリセットする` : '学習をリセットする');
  if (confirming) {
    return (
      <div className="sess-reset-confirm">
        <span className="sess-reset-q">本当にリセットしますか？</span>
        <div className="btn-row">
          <button className="btn danger" onClick={onConfirm}>はい</button>
          <button className="btn ghost" onClick={onCancel}>いいえ</button>
        </div>
      </div>
    );
  }
  return (
    <button className="btn ghost sm block sess-reset-btn" style={{ marginTop: 10 }} onClick={onAsk}>
      🗑 {label}
    </button>
  );
}
