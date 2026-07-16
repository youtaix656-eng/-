import { useEffect, useRef, useState } from 'react';
import { importFile, exportCsv, exportJson } from '../lib/importer.js';
import { exportAll } from '../lib/storage.js';
import { loadVoices } from '../lib/speech.js';

// 設定・問題データ管理画面
export default function Settings({ store, onToast, onOpenOcr, importText, onConsumeImportText }) {
  const {
    questions,
    settings,
    updateSettings,
    replaceQuestions,
    appendQuestions,
    resetProgress,
    restoreSamples,
    markBackedUp,
    importBackup,
  } = store;

  const fileRef = useRef(null);
  const backupRef = useRef(null);
  const [importMode, setImportMode] = useState('append'); // append | replace
  const [preview, setPreview] = useState(null); // { questions, errors, warnings, fileName }
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    loadVoices().then((vs) => setVoices(vs.filter((v) => v.lang && v.lang.startsWith('ja'))));
  }, []);

  // OCR から渡された CSV テキストをプレビューに流し込む
  useEffect(() => {
    if (importText) {
      const result = importFile(importText, 'ocr.csv');
      setPreview({ ...result, fileName: 'OCR抽出データ' });
      setImportMode('append');
      onConsumeImportText?.();
    }
  }, [importText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = importFile(text, file.name);
    setPreview({ ...result, fileName: file.name });
    e.target.value = '';
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

  // 全データ（問題＋進捗＋メモ＋設定）のバックアップ
  const backupAll = async () => {
    const data = await exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    download(JSON.stringify(data, null, 2), `shinkyu_backup_${stamp}.json`, 'application/json');
    markBackedUp();
    onToast('バックアップを書き出しました');
  };

  // バックアップからの復元
  const restoreAll = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!confirm('現在の学習データをバックアップの内容で上書きします。よろしいですか？')) return;
    try {
      const data = JSON.parse(await file.text());
      await importBackup(data);
      onToast('バックアップから復元しました');
    } catch (err) {
      onToast('復元に失敗しました（ファイル形式をご確認ください）');
    }
  };

  const sampleCsv = `科目,問題文,選択肢,正解,解説
経絡経穴概論,合谷穴が属する経絡はどれか。,手の陽明大腸経|手の太陰肺経|手の少陰心経|手の厥陰心包経,1,合谷は手の陽明大腸経の原穴。
東洋医学概論,督脈は身体前正中線を上行する。,,×,督脈は後正中線を上行する。前正中線は任脈。`;

  return (
    <div className="view">
      <h2 className="view-title">設定・問題データ管理</h2>

      {/* ===== バックアップと復元（端末間の持ち運び） ===== */}
      <div className="section-label" style={{ marginTop: 0 }}>
        バックアップと復元
      </div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 10 }}>
          問題・学習進捗・メモ・設定をまとめて1つのファイルに書き出せます。
          別の端末で「復元」すれば、そのまま学習を引き継げます（クラウド保存やUSB、
          Google Drive 等のファイル共有経由で持ち運べます）。
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={backupAll}>
            💾 バックアップを保存
          </button>
          <button className="btn" onClick={() => backupRef.current?.click()}>
            復元（読み込み）
          </button>
        </div>
        <input
          ref={backupRef}
          type="file"
          accept="application/json,.json"
          onChange={restoreAll}
          style={{ display: 'none' }}
        />

        <label className="switch-row" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={settings.autoBackupOnStart}
            onChange={(e) => updateSettings({ autoBackupOnStart: e.target.checked })}
          />
          <span>
            起動時に自動バックアップ
            <small>1日1回まで、アプリを開いた時にバックアップを自動保存します。</small>
          </span>
        </label>
      </div>

      {/* ===== 問題データのインポート ===== */}
      <div className="section-label">問題データのインポート</div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 12 }}>
          CSV または JSON 形式の問題を取り込めます。項目は
          <span className="mono">科目 / 問題文 / 選択肢 / 正解 / 解説</span>（任意で
          <span className="mono">画像</span>）。
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
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => fileRef.current?.click()}>
            📁 ファイルを選択
          </button>
          <button className="btn" onClick={onOpenOcr}>
            📷 写真から（OCR）
          </button>
        </div>

        {preview && (
          <div style={{ marginTop: 14 }}>
            <div className="explanation">
              <span className="label">読み込み結果：{preview.fileName}</span>
              取り込み可能：<strong>{preview.questions.length}問</strong>
              {preview.errors.length > 0 && (
                <div style={{ color: 'var(--wrong)', marginTop: 6, fontSize: 13 }}>
                  取り込めなかった行：{preview.errors.length}件
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {preview.errors.slice(0, 5).map((er, i) => (
                      <li key={i}>{er}</li>
                    ))}
                    {preview.errors.length > 5 && <li>ほか{preview.errors.length - 5}件…</li>}
                  </ul>
                </div>
              )}
              {preview.warnings && preview.warnings.length > 0 && (
                <div style={{ color: 'var(--warn)', marginTop: 8, fontSize: 13 }}>
                  ⚠️ 確認事項：{preview.warnings.length}件
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {preview.warnings.slice(0, 6).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {preview.warnings.length > 6 && (
                      <li>ほか{preview.warnings.length - 6}件…</li>
                    )}
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
            <strong>正解</strong>は 選択肢の番号（国試は1〜5）、○×なら
            <span className="mono">○</span> / <span className="mono">×</span> で指定します。<br />
            <strong>画像</strong>列（任意）に画像URLやデータURIを入れると、経穴図などの
            図表問題に対応できます。
          </p>
          <div className="inline-note" style={{ marginTop: 6 }}>CSV 例：</div>
          <code className="block">{sampleCsv}</code>
        </div>
      </details>

      {/* ===== 問題データのエクスポート ===== */}
      <div className="section-label">問題データの書き出し</div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 10 }}>
          現在の{questions.length}問を CSV / JSON で書き出せます（問題データのみ）。
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
          データはすべてこの端末のブラウザ内（IndexedDB）に保存されます。サーバーには送信されません。
        </p>
      </div>
    </div>
  );
}
