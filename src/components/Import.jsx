import { useRef, useState } from 'react';

// 問題の取り込みハブ
// ファイル(CSV/JSON) / 文章の貼り付け / 写真・PDF の入口をまとめる。
// 取り込んだ内容は設定画面のプレビューに渡り、そこで確認して追加する。
export default function Import({ onSendToImport, onOpenOcr, onOpenParse, onToast }) {
  const fileRef = useRef(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    onSendToImport(t);
    e.target.value = '';
  };

  const submitPaste = () => {
    if (!paste.trim()) return;
    onSendToImport(paste);
  };

  return (
    <div className="view">
      <h2 className="view-title">問題を取り込む</h2>
      <p className="view-desc">
        いろいろな形式から問題を取り込めます。取り込み後に内容を確認して追加します。
      </p>

      {/* ファイル */}
      <button className="import-tile" onClick={() => fileRef.current?.click()}>
        <span className="import-ico">📁</span>
        <span className="import-main">
          <span className="import-title">ファイル（CSV / JSON）</span>
          <span className="import-desc">表計算などで作ったCSV、またはJSONを選択</span>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {/* 文章の貼り付け */}
      <button className="import-tile" onClick={() => setPasteOpen((v) => !v)}>
        <span className="import-ico">📝</span>
        <span className="import-main">
          <span className="import-title">文章を貼り付け</span>
          <span className="import-desc">CSV/JSONのテキストを貼り付けて取り込み</span>
        </span>
      </button>
      {pasteOpen && (
        <div className="card">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={'CSV や JSON を貼り付け\n例）科目,問題文,選択肢,正解,解説\n医療概論,問題文…,あ|い|う|え|お,2,解説…'}
            style={{ minHeight: 130 }}
          />
          <button className="btn primary block" style={{ marginTop: 8 }} onClick={submitPaste}>
            この文章を読み込む
          </button>
        </div>
      )}

      {/* 写真・PDF */}
      <button className="import-tile" onClick={onOpenOcr}>
        <span className="import-ico">📷</span>
        <span className="import-main">
          <span className="import-title">写真・PDFから取り込む</span>
          <span className="import-desc">本のページ写真やPDFから文字を抽出（要ネット接続）</span>
        </span>
      </button>

      {/* 自由文から自動作成 */}
      <button className="import-tile" onClick={onOpenParse}>
        <span className="import-ico">✨</span>
        <span className="import-main">
          <span className="import-title">自由文から自動作成</span>
          <span className="import-desc">問題集の文章・ネットのコピーを貼ると、選択肢と正解を自動で読み取り</span>
        </span>
      </button>

      <div className="card" style={{ marginTop: 4 }}>
        <div className="section-label" style={{ marginTop: 0 }}>CSVの書き方（任意項目つき）</div>
        <p className="inline-note">
          基本は <span className="mono">科目, 問題文, 選択肢, 正解, 解説</span>。<br />
          任意で <span className="mono">画像 / 回 / ジャンル / ファイル</span> 列を足せます。<br />
          選択肢は <span className="mono">|</span> 区切り（○×は空欄）、正解は番号（国試は1〜5）。
        </p>
        <code className="block">{`科目,問題文,選択肢,正解,解説,回,ジャンル,ファイル
医療概論,問題文…,あ|い|う|え|お,2,解説…,第34回,社会保障,2027過去問`}</code>
      </div>

      <p className="inline-note">
        ※ 取り込み時に「取り込み先ファイル名」を付けると、出題ビルダーでファイル単位に絞り込めます（次の確認画面で指定できます）。
      </p>
    </div>
  );
}
