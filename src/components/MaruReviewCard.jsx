// 「✅ ○にした問題をふりかえる」カード（見直し・高速回転）。
//   Session.jsx・Quiz.jsxの両方から使う共有コンポーネント（単一の正）。
//   状態は useMaruReview フックから受け取り、開始処理だけ呼び出し側（onStartReview/onStartFast）に委ねる
//   （Session.jsxのbegin()とQuiz.jsxのbeginWith()で開始の仕組みが異なるため）。
export default function MaruReviewCard({
  maruStatusAll,
  maruUncertainCount,
  maruExcludeMastered,
  setMaruExcludeMastered,
  maruStatusFiltered,
  maruPool,
  onStartReview,
  onStartFast,
  onGoAnalytics,
}) {
  return (
    <div className="card">
      <div className="section-label" style={{ marginTop: 0 }}>✅ ○にした問題をふりかえる</div>
      <p className="inline-note" style={{ marginTop: 0 }}>
        自己採点で最後に「○ 完璧」にした問題（現在の絞り込みで<strong>{maruStatusAll.length}問</strong>）だけを対象にします。
        あとで△・✕に変わった問題は自動で対象から外れます。
      </p>
      {maruUncertainCount > 0 && (
        <p className="inline-note" style={{ marginTop: 0, color: 'var(--warn, #e0a800)' }}>
          ⚠️ うち<strong>{maruUncertainCount}問</strong>は、選んだ答えが不正解なのに○のままにした「うっかり○」の可能性があります（見直しで先頭に出します）。
        </p>
      )}
      <label className="autokw-row" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={maruExcludeMastered} onChange={(e) => setMaruExcludeMastered(e.target.checked)} />
        <span>
          マスター済み（5連続○）は除く（残り{maruStatusFiltered.length}問）。
          直前期の総ざらいなど全部確認したい時はチェックを外してください
        </span>
      </label>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          className="btn"
          disabled={maruPool.length === 0}
          onClick={() => onStartReview(maruPool)}
        >
          📝 問題演習で見直す（適当に○にしていないか確認）
        </button>
        <button
          className="btn"
          disabled={maruPool.length === 0}
          onClick={() => onStartFast(maruPool)}
        >
          ⚡ 高速回転でインプット強化
        </button>
      </div>
      {maruPool.length === 0 && (
        <p className="inline-note" style={{ marginTop: 8 }}>
          この条件で○にした問題はまだありません。学習を進めると、ここに対象が増えていきます。
        </p>
      )}
      {onGoAnalytics && (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => onGoAnalytics()}>
          🏅 得意科目の分析を見る
        </button>
      )}
    </div>
  );
}
