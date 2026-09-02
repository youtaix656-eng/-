import { useState } from 'react';

// 3分の2バッファ術：マネージャービュー（基礎タスク完了直後の振り返り）。
//   「悪いのは実行役ではなく、無理な計画を立てたマネージャー」という前提で、
//   集中が切れた・進まなかった場合もユーザーを責めるトーンの文言は一切使わない。
//   Session.jsx・Quiz.jsxの両方から使う共有コンポーネント（単一の正）。
export default function ManagerReview({ buffer, onDecide }) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div className="view">
      <div className="card sess-done">
        <div className="sess-done-ico">🧑‍💼</div>
        <h2>マネージャービュー：振り返り</h2>
        <p className="view-desc" style={{ textAlign: 'center' }}>
          基礎タスク、おつかれさまでした。予定（約{buffer.baseTaskMinutes}分・{buffer.baseTaskQuestionCount}問）通りに進みましたか？
        </p>
        {!showNote ? (
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={() => onDecide(true)}>✅ 予定通り完了した</button>
            <button className="btn" onClick={() => setShowNote(true)}>⏳ 予定通りには終わらなかった</button>
          </div>
        ) : (
          <>
            <p className="inline-note" style={{ textAlign: 'center' }}>
              大丈夫です。悪いのは実行役ではなく、無理な計画を立てたマネージャー（＝設定した時間や問題数）の方です。
              よければ理由をひとことだけ（任意・あとで見返す用）。
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：思ったより1問に時間がかかった／急な予定が入った　など（空欄でもOK）"
              rows={3}
              style={{ width: '100%', marginTop: 6 }}
            />
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={() => onDecide(false, note.trim() || undefined)}>この内容で続ける</button>
              <button className="btn ghost" onClick={() => setShowNote(false)}>戻る</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
