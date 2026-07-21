import { useRef } from 'react';

// 写真の取得元を選ぶアクションシート。
// 「写真を追加」を押すと、カメラ撮影 か 端末のフォルダ/写真から選択 を選べる。
//  - カメラ: capture 付き input（その場で撮影）
//  - フォルダ: capture なし input（端末の写真アクセス許可のうえ、複数選択・全選択が可能）
// open を親が制御し、選ばれたファイルは onPick(File[]) で受け取る。
export default function PhotoSource({ open, onClose, onPick, multiple = true, title = '写真を追加' }) {
  const camRef = useRef(null);
  const galRef = useRef(null);

  const handle = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    onClose?.();
    if (files.length) onPick(files);
  };

  return (
    <>
      {/* カメラ撮影 */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handle}
        style={{ display: 'none' }}
      />
      {/* フォルダ・写真から選択（複数選択・全選択可） */}
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        {...(multiple ? { multiple: true } : {})}
        onChange={handle}
        style={{ display: 'none' }}
      />

      {open && (
        <div className="modal-backdrop sheet-top" onClick={onClose}>
          <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">{title}</div>
            <button className="sheet-btn" onClick={() => camRef.current?.click()}>
              <span className="sheet-ico">📷</span>
              <span>
                <span className="sheet-main">カメラで撮影</span>
                <span className="sheet-sub">その場で写真を撮って追加</span>
              </span>
            </button>
            <button className="sheet-btn" onClick={() => galRef.current?.click()}>
              <span className="sheet-ico">🖼️</span>
              <span>
                <span className="sheet-main">フォルダ・写真から選ぶ{multiple ? '（複数選択可）' : ''}</span>
                <span className="sheet-sub">
                  {multiple ? '端末の写真から複数まとめて選べます（全選択も可）' : '端末の写真・ファイルから選びます'}
                </span>
              </span>
            </button>
            <p className="sheet-note">
              「フォルダ・写真から選ぶ」を押すと、端末の写真へのアクセス許可を求められることがあります。
              「許可（はい）」を選ぶと写真フォルダから選択できます。
            </p>
            <button className="sheet-cancel" onClick={onClose}>キャンセル</button>
          </div>
        </div>
      )}
    </>
  );
}
