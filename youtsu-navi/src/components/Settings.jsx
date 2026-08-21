import React, { useState } from 'react';
import { actions } from '../lib/useStore.js';
import { LICENSES, licenseById } from '../data/licenses.js';
import { CONSENT_TEXT, CONSENT_VERSION } from '../lib/consent.js';
import { storageSize } from '../lib/storage.js';
import { recordsToJson, parseRecordsJson, backupFileName } from '../lib/exporter.js';
import { downloadText, pickTextFile } from '../lib/share.js';
import { summarizeRecords } from '../lib/records.js';

const FONT_SCALES = [
  { id: 'm', label: '標準' },
  { id: 'l', label: '大' },
  { id: 'xl', label: '特大' },
];

function formatAt(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Settings({ state }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmKarte, setConfirmKarte] = useState(false);
  const [ioStatus, setIoStatus] = useState('');
  const records = state.records || [];
  const karte = summarizeRecords(records);

  const flash = (msg) => {
    setIoStatus(msg);
    setTimeout(() => setIoStatus(''), 4000);
  };

  const restore = async () => {
    const picked = await pickTextFile();
    if (!picked) return;
    const parsed = parseRecordsJson(picked.text);
    if (!parsed.ok) {
      flash(`復元できませんでした：${parsed.error}`);
      return;
    }
    const added = actions.importRecords(parsed.records);
    flash(`${added}件を取り込みました（同じ記録は新しい方を残しました）。${parsed.error || ''}`);
  };
  const license = licenseById(state.settings.licenseId);
  const logs = state.consentLog || [];

  return (
    <div className="page">
      <div className="card">
        <h2>表示</h2>
        <div>
          <p className="section-title">配色</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button
              type="button"
              className={`btn slim${state.settings.theme === 'light' ? '' : ' secondary'}`}
              onClick={() => actions.setSettings({ theme: 'light' })}
            >
              白背景（既定）
            </button>
            <button
              type="button"
              className={`btn slim${state.settings.theme === 'dark' ? '' : ' secondary'}`}
              onClick={() => actions.setSettings({ theme: 'dark' })}
            >
              黒背景
            </button>
          </div>
        </div>
        <div>
          <p className="section-title">文字サイズ</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {FONT_SCALES.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn slim${state.settings.fontScale === f.id ? '' : ' secondary'}`}
                onClick={() => actions.setSettings({ fontScale: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>資格</h2>
        <p className="muted small">選択した資格の業務範囲に合わせて、施術方針の提案と警告を出し分けます（※要確認）。</p>
        <div className="options">
          {LICENSES.map((l) => (
            <button
              key={l.id}
              type="button"
              className="option"
              aria-pressed={state.settings.licenseId === l.id}
              onClick={() => actions.setSettings({ licenseId: l.id })}
            >
              <span className="mark" aria-hidden="true">{state.settings.licenseId === l.id ? '●' : ''}</span>
              <span>
                <strong>{l.name}</strong>
                <span className="muted small" style={{ display: 'block' }}>{l.summary}</span>
              </span>
            </button>
          ))}
        </div>
        {license && (
          <div>
            <p className="section-title">この資格での注意点</p>
            <ul className="list tight small">
              {license.cautions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2>同意の記録</h2>
        <p className="muted small">
          同意文書バージョン {CONSENT_VERSION}／
          {state.consent ? `${formatAt(state.consent.agreedAt)} に同意` : '未同意'}
        </p>
        <details className="acc">
          <summary>同意内容を読む</summary>
          <ul className="list tight small">
            {CONSENT_TEXT.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </details>
        <details className="acc">
          <summary>同意・確認の履歴（{logs.length}件）</summary>
          <ul className="list tight small muted">
            {logs.slice(0, 50).map((l) => (
              <li key={l.id}>
                {formatAt(l.at)}／{l.kind === 'initial' ? '利用開始時の同意' : '結果表示時の確認'}
                {l.licenseId ? `／${licenseById(l.licenseId)?.name || l.licenseId}` : ''}
              </li>
            ))}
            {logs.length === 0 && <li>記録はありません</li>}
          </ul>
        </details>
      </div>

      <div className="card">
        <h2>カルテのバックアップ</h2>
        <p className="muted small">
          カルテ{karte.total}件を1つのファイルとして保存・復元できます。ファイルの保存先は端末の中です
          （アプリが外部へ送ることはありません）。機種変更の時はこのファイルを新しい端末で読み込んでください。
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn slim"
            disabled={records.length === 0}
            onClick={() => {
              downloadText(backupFileName(Date.now()), recordsToJson(records), 'application/json');
              flash('バックアップを保存しました。');
            }}
          >
            💾 バックアップを保存
          </button>
          <button type="button" className="btn slim secondary" onClick={restore}>
            📂 バックアップから復元
          </button>
        </div>
        {ioStatus && <p className="small" style={{ margin: 0 }}>{ioStatus}</p>}
        {records.length > 0 && (
          !confirmKarte ? (
            <button type="button" className="btn danger slim" onClick={() => setConfirmKarte(true)}>
              カルテだけをすべて削除
            </button>
          ) : (
            <div className="stack">
              <p className="small">カルテ{records.length}件を削除します。元に戻せません（設定・同意履歴は残ります）。</p>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <button type="button" className="btn secondary" onClick={() => setConfirmKarte(false)}>いいえ</button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => { actions.clearRecords(); setConfirmKarte(false); flash('カルテを削除しました。'); }}
                >
                  はい、削除する
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <div className="card">
        <h2>データ</h2>
        <p className="muted small">
          入力内容・設定・同意履歴はこの端末の中にのみ保存されます（外部送信は行いません）。保存量：約 {storageSize()} バイト。
        </p>
        <p className="muted small">
          お客様の氏名など個人情報は入力しない設計です（カルテは表示名のみ）。クラウド同期は将来のオプション機能として分離しています。
        </p>
        {!confirmReset ? (
          <button type="button" className="btn danger" onClick={() => setConfirmReset(true)}>
            この端末のデータをすべて削除
          </button>
        ) : (
          <div className="stack">
            <p className="small">設定・同意履歴・入力内容がすべて消えます。よろしいですか？</p>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn secondary" onClick={() => setConfirmReset(false)}>
                いいえ
              </button>
              <button type="button" className="btn danger" onClick={() => actions.resetAll()}>
                はい、削除する
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>このアプリについて</h2>
        <p className="small muted" style={{ margin: 0 }}>
          腰痛ナビ（Phase 1・腰痛特化MVP）。有資格者の判断を補助する参考情報を提示するツールであり、診断を行うものではありません。
          最終的な施術判断は施術者ご自身の責任で行ってください。
        </p>
      </div>
    </div>
  );
}
