import React, { useState } from 'react';
import { actions } from '../lib/useStore.js';
import { CONSENT_TEXT, CONSENT_VERSION } from '../lib/consent.js';
import { LICENSES } from '../data/licenses.js';

/**
 * 初回起動時の同意画面＋資格選択（企画書 改善策 #7・#4）
 * 同意しない限りアプリ本体には進めない。同意した事実は consentLog に残る。
 */
export default function Onboarding({ state, onDone }) {
  const [licenseId, setLicenseId] = useState(state.settings.licenseId || null);
  const [checked, setChecked] = useState(false);

  const submit = () => {
    actions.setSettings({ licenseId });
    actions.agreeConsent(licenseId);
    onDone();
  };

  return (
    <div className="app" style={{ paddingBottom: 32 }}>
      <header className="header">
        <h1>腰痛ナビ</h1>
      </header>
      <div className="page">
        <div className="card">
          <h2>{CONSENT_TEXT.title}</h2>
          <p className="muted">{CONSENT_TEXT.lead}</p>
          <ul className="list">
            {CONSENT_TEXT.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="small muted">同意文書バージョン {CONSENT_VERSION}／同意した日時は端末内に記録され、設定画面から確認できます。</p>
        </div>

        <div className="card">
          <h2>お持ちの資格</h2>
          <p className="muted">選んだ資格の業務範囲に合わせて、施術方針の提案と警告を出し分けます（※要確認：法的な業務範囲は個別にご確認ください）。</p>
          <div className="options">
            {LICENSES.map((l) => (
              <button
                key={l.id}
                type="button"
                className="option"
                aria-pressed={licenseId === l.id}
                onClick={() => setLicenseId(l.id)}
              >
                <span className="mark" aria-hidden="true">{licenseId === l.id ? '●' : ''}</span>
                <span>
                  <strong>{l.name}</strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    {l.kind}／{l.summary}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="small muted">複数の免許をお持ちの場合は主に使う資格を選んでください（設定画面でいつでも変更できます）。</p>
        </div>

        <div className="card">
          <button type="button" className="option" aria-pressed={checked} onClick={() => setChecked((v) => !v)}>
            <span className="mark" aria-hidden="true">{checked ? '✓' : ''}</span>
            <span>
              <strong>{CONSENT_TEXT.agree}</strong>
            </span>
          </button>
          <button type="button" className="btn" disabled={!checked || !licenseId} onClick={submit}>
            同意して開始する
          </button>
          {!licenseId && <p className="small muted center">資格を選択してください。</p>}
        </div>
      </div>
    </div>
  );
}
