import { useEffect, useRef, useState } from 'react';
import { importFile, exportCsv, exportJson } from '../lib/importer.js';
import { loadVoices } from '../lib/speech.js';

// 設定・問題データ管理画面
// - CSV / JSON のインポート（置き換え / 追加）
// - 現在の問題データのエクスポート（バックアップ）
// - 音声設定
// - 学習データのリセット / サンプル復元
export default function Settings({ store, onToast }) {
  const {
    questions,
    settings,
    updateSettings,
    replaceQuestions,
    appendQuestions,
    resetProgress,
    restoreSamples,
  } = store;

  const fileRef = useRef(null);
  const [importMode, setImportMode] = useState('append'); // append | replace
  const [preview, setPreview] = useState(null); // { questions, errors, fileName }
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    loadVoices().then((vs) => setVoices(vs.filter((v) => v.lang && v.lang.startsWith('ja'))));
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = importFile(text, file.name);
    setPreview({ ...result, fileName: file.name });
    e.target.value = ''; // 同じファイルを再選択できるように
  };

  const confirmImport = () => {
    if (!preview || preview.questions.length === 0) return;
    if (importMode === 'replace') {
      replaceQuestions(preview.questions);
      onToast(`${preview.questions.length}問に置き換えました`);
    } else {
      appendQuestions(preview.questions);
      onToast(`${preview.questions.length}問を追加しました`);
    }
    setPreview(null);
  };

  const download = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sampleCsv = `科目,問題文,選択肢,正解,解説
経絡経穴概論,合谷穴が属する経絡はどれか。,手の陽明大腸経|手の太陰肺経|手の少陰心経|手の厥陰心包経,1,合谷は手の陽明大腸経の原穴。
東洋医学概論,督脈は身体前正中線を上行する。,,×,督脈は後正中線を上行する。前正中線は任脈。`;

  return (
    <div className="view">
      <h2 className="view-title">設定・問題データ管理</h2>

      {/* ===== 問題データのインポート ===== */}
      <div className="section-label" style={{ marginTop: 0 }}>
        問題データのインポート
      </div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 12 }}>
          CSV または JSON 形式の問題を取り込めます。項目は
          <span className="mono">科目 / 問題文 / 選択肢 / 正解 / 解説</span>。
        </p>

        <div className="chip-row">
          <button
            className={`chip ${importMode === 'append' ? 'active' : ''}`}
            onClick={() => setImportMode('append')}
          >
            既存に追加
          </button>
          <button
            className={`chip ${importMode === 'replace' ? 'active' : ''}`}
            onClick={() => setImportMode('replace')}
          >
            全て置き換え
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          className="btn primary block"
          style={{ marginTop: 10 }}
          onClick={() => fileRef.current?.click()}
        >
          📁 ファイルを選択（CSV / JSON）
        </button>

        {preview && (
          <div style={{ marginTop: 14 }}>
            <div className="explanation">
              <span className="label">読み込み結果：{preview.fileName}</span>
              取り込み可能：<strong>{preview.questions.length}問</strong>
              {preview.errors.length > 0 && (
                <div style={{ color: 'var(--wrong)', marginTop: 6, fontSize: 13 }}>
                  スキップ {preview.errors.length}件
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {preview.errors.slice(0, 5).map((er, i) => (
                      <li key={i}>{er}</li>
                    ))}
                    {preview.errors.length > 5 && <li>ほか{preview.errors.length - 5}件…</li>}
                  </ul>
                </div>
              )}
            </div>
            {preview.questions.length > 0 && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setPreview(null)}>
                  やめる
                </button>
                <button className="btn accent" onClick={confirmImport}>
                  {importMode === 'replace' ? 'この内容で置き換える' : 'この内容を追加する'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== フォーマット説明 ===== */}
      <details className="card" style={{ padding: '14px 18px' }}>
        <summary style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--navy)' }}>
          CSV / JSON フォーマットの書き方
        </summary>
        <div style={{ marginTop: 10 }}>
          <p className="inline-note">
            <strong>選択肢</strong>は半角パイプ <span className="mono">|</span> で区切ります。
            空欄にすると ○×（正誤）問題になります。<br />
            <strong>正解</strong>は 四択なら番号（1〜4）、○×なら
            <span className="mono">○</span> / <span className="mono">×</span> で指定します。
          </p>
          <div className="inline-note" style={{ marginTop: 6 }}>CSV 例：</div>
          <code className="block">{sampleCsv}</code>
          <div className="inline-note" style={{ marginTop: 10 }}>
            将来的に、本のページ写真をOCRで読み取ったテキストを、この形式に整形して取り込む運用も可能です。
          </div>
        </div>
      </details>

      {/* ===== エクスポート ===== */}
      <div className="section-label">バックアップ（エクスポート）</div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 10 }}>
          現在の{questions.length}問を書き出して保存できます。
        </p>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => download(exportCsv(questions), 'shinkyu_questions.csv', 'text/csv')}
          >
            CSVで保存
          </button>
          <button
            className="btn"
            onClick={() =>
              download(exportJson(questions), 'shinkyu_questions.json', 'application/json')
            }
          >
            JSONで保存
          </button>
        </div>
      </div>

      {/* ===== 音声設定 ===== */}
      <div className="section-label">音声設定</div>
      <div className="card">
        <div className="field">
          <label>読み上げ速度</label>
          <div className="range-row">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={settings.speechRate}
              onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
            />
            <span className="range-val">{settings.speechRate.toFixed(2)}×</span>
          </div>
        </div>

        <div className="field">
          <label>問題文と正解の「間」</label>
          <div className="range-row">
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={settings.gapSeconds}
              onChange={(e) => updateSettings({ gapSeconds: Number(e.target.value) })}
            />
            <span className="range-val">{settings.gapSeconds}秒</span>
          </div>
        </div>

        {voices.length > 0 && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>音声（ボイス）</label>
            <select
              value={settings.voiceURI}
              onChange={(e) => updateSettings({ voiceURI: e.target.value })}
            >
              <option value="">既定の日本語音声</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
            <div className="hint">端末にインストールされている日本語音声から選べます。</div>
          </div>
        )}
        {voices.length === 0 && (
          <p className="inline-note" style={{ marginBottom: 0 }}>
            日本語の音声が見つかりませんでした。端末の設定で日本語の音声合成データを追加すると、より自然に読み上げられます。
          </p>
        )}
      </div>

      {/* ===== データ管理 ===== */}
      <div className="section-label">データ管理</div>
      <div className="card">
        <button
          className="btn block"
          onClick={() => {
            if (confirm('サンプル問題に戻します。取り込んだ問題は失われます。よろしいですか？')) {
              restoreSamples();
              onToast('サンプル問題を復元しました');
            }
          }}
        >
          サンプル問題に戻す
        </button>
        <button
          className="btn danger block"
          style={{ marginTop: 10 }}
          onClick={() => {
            if (confirm('学習の進捗・誤答履歴をすべて消去します。問題データは残ります。よろしいですか？')) {
              resetProgress();
              onToast('学習の進捗をリセットしました');
            }
          }}
        >
          学習の進捗をリセット
        </button>
        <p className="inline-note" style={{ marginTop: 10 }}>
          データはすべてこの端末のブラウザ内（localStorage）に保存されます。サーバーには送信されません。
        </p>
      </div>
    </div>
  );
}
