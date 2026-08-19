// QRのモジュール配列を SVG で描画（SyncQR.jsx・P2PTransfer.jsxで共用）
export default function QRImage({ matrix, size = 260, dim = false }) {
  if (!matrix) return null;
  const n = matrix.length;
  const quiet = 2;
  const total = n + quiet * 2;
  const cell = size / total;
  const rects = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        rects.push(
          <rect key={`${r}-${c}`} x={(c + quiet) * cell} y={(r + quiet) * cell} width={cell} height={cell} fill="#000" />
        );
      }
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ background: '#fff', borderRadius: 8, opacity: dim ? 0.18 : 1, transition: 'opacity .2s' }}
    >
      {rects}
    </svg>
  );
}
