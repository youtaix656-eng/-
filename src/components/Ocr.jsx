import { useRef, useState } from 'react';
import PhotoSource from './PhotoSource.jsx';

// 写真・PDF からの取り込み補助（実験的）
//
// 本のページの写真や PDF から文字を抽出する下処理を、ブラウザ内で行う。
//  - 写真: tesseract.js で OCR（CDNから動的読み込み）
//  - PDF : pdf.js でテキスト抽出（CDNから動的読み込み）。文字が埋め込まれていない
//          スキャンPDFは抽出できないため、その場合は写真OCRを使う。
// 抽出テキストは編集でき、CSV に整形してインポート画面へ渡せる。
// ※ この機能のみインターネット接続が必要。
export default function Ocr({ onToast, onSendToImport }) {
  const pdfRef = useRef(null);
  const [imgSheet, setImgSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  const runOcr = async (file) => {
    setError('');
    setBusy(true);
    setProgress(0);
    setPreview(URL.createObjectURL(file));
    try {
      // CDN から tesseract.js を動的読み込み（この機能はオフライン非対応）
      const mod = await import(
        /* @vite-ignore */ 'https://esm.sh/tesseract.js@5'
      );
      const Tesseract = mod.default || mod;
      const { data } = await Tesseract.recognize(file, 'jpn', {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      setText((prev) => (prev ? prev + '\n' + data.text : data.text));
      onToast?.('文字を抽出しました');
    } catch (e) {
      console.error(e);
      setError(
        '文字認識に失敗しました。ネット接続をご確認ください（この機能のみ通信が必要です）。'
      );
    } finally {
      setBusy(false);
    }
  };

  const runPdf = async (file) => {
    setError('');
    setBusy(true);
    setProgress(0);
    setPreview('');
    try {
      // CDN から pdf.js を動的読み込み
      const pdfjs = await import(
        /* @vite-ignore */ 'https://esm.sh/pdfjs-dist@4.7.76/build/pdf.min.mjs'
      );
      pdfjs.GlobalWorkerOptions.workerSrc =
        'https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      let out = '';
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        out += content.items.map((i) => i.str).join(' ') + '\n';
        setProgress(Math.round((p / doc.numPages) * 100));
      }
      if (!out.trim()) {
        setError(
          'このPDFには文字データが埋め込まれていません（スキャン画像のPDFの可能性）。その場合は「写真（OCR）」で各ページを撮影して取り込んでください。'
        );
      } else {
        setText((prev) => (prev ? prev + '\n' + out : out));
        onToast?.('PDFから文字を抽出しました');
      }
    } catch (e) {
      console.error(e);
      setError('PDFの読み取りに失敗しました。ネット接続をご確認ください。');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) runPdf(file);
      else runOcr(file);
    }
    e.target.value = '';
  };

  // カメラ/フォルダから選ばれた画像を順番にOCR（複数ページまとめ取り込み対応）
  const handlePickedImages = async (files) => {
    for (const f of files) {
      if (!/^image\//.test(f.type || '')) continue;
      await runOcr(f);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onToast?.('コピーしました');
    } catch {
      onToast?.('コピーできませんでした');
    }
  };

  // 抽出テキストを CSV の雛形に流し込む（各行を問題文の候補として並べる）
  const toCsvTemplate = () => {
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 3);
    const esc = (s) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
    const rows = ['科目,問題文,選択肢,正解,解説'];
    lines.forEach((l) => rows.push(['', esc(l), '', '', ''].join(',')));
    return rows.join('\n');
  };

  return (
    <div className="view">
      <h2 className="view-title">写真・PDFから取り込む</h2>
      <p className="view-desc">
        本のページの写真や PDF から文字を抽出します。抽出後にご自身で
        「科目・選択肢・正解・解説」を整えて取り込んでください。
      </p>

      <div className="card">
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <PhotoSource
          open={imgSheet}
          onClose={() => setImgSheet(false)}
          onPick={handlePickedImages}
          multiple
          title="写真を取り込む"
        />
        <div className="btn-row">
          <button
            className="btn primary"
            onClick={() => setImgSheet(true)}
            disabled={busy}
          >
            📷 写真を撮影 / 選択
          </button>
          <button className="btn" onClick={() => pdfRef.current?.click()} disabled={busy}>
            📄 PDFを選択
          </button>
        </div>

        {busy && (
          <div style={{ marginTop: 14 }}>
            <div className="inline-note">文字認識中… {progress}%</div>
            <div className="progress" style={{ marginTop: 6 }}>
              <span style={{ width: `${Math.max(progress, 5)}%` }} />
            </div>
          </div>
        )}

        {error && (
          <p className="inline-note" style={{ color: 'var(--wrong)', marginTop: 10 }}>
            {error}
          </p>
        )}

        {preview && !busy && (
          <img
            src={preview}
            alt="読み取り対象"
            style={{ width: '100%', borderRadius: 10, marginTop: 12 }}
          />
        )}
      </div>

      {text && (
        <div className="card">
          <label className="section-label" style={{ marginTop: 0 }}>
            抽出テキスト（編集できます）
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ minHeight: 160 }}
          />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={copyText}>
              コピー
            </button>
            <button className="btn sm" onClick={() => setText('')}>
              クリア
            </button>
            <button
              className="btn accent sm"
              onClick={() => onSendToImport?.(toCsvTemplate())}
            >
              CSV雛形にしてインポートへ
            </button>
          </div>
          <p className="inline-note" style={{ marginTop: 10 }}>
            「CSV雛形にしてインポートへ」を押すと、各行を問題文として並べた CSV を
            インポート画面に渡します。選択肢・正解・解説の列を埋めてから取り込んでください。
          </p>
        </div>
      )}

      <p className="inline-note">
        ※ OCR はこの機能のみインターネット接続が必要です（文字認識エンジンを都度読み込むため）。
        認識精度は画像の写り方に依存します。うまくいかない場合は明るく・まっすぐ撮影してください。
      </p>
    </div>
  );
}
