import React, { useState } from 'react';
import { copyText, shareText, downloadText, printText } from '../lib/share.js';

/**
 * 書き出し・共有の共通UI。
 * 生成したテキストをその場で確認してから、コピー／共有／印刷／保存を選べる。
 * 送信先は施術者自身が選ぶ（アプリが外部へ送ることはない）。
 */
export default function ShareBox({ title, text, filename = 'youtsu-navi.txt', note = '' }) {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2600);
  };

  return (
    <div className="stack">
      {note && <p className="notice-inline">{note}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn slim"
          onClick={async () => {
            const ok = await copyText(text);
            flash(ok ? 'コピーしました' : 'コピーできませんでした。下の本文を選択してコピーしてください。');
            if (!ok) setOpen(true);
          }}
        >
          📋 コピー
        </button>
        <button
          type="button"
          className="btn slim secondary"
          onClick={async () => {
            const shared = await shareText(text, title);
            if (!shared) {
              const ok = await copyText(text);
              flash(ok ? '共有に対応していない端末のため、コピーしました' : 'コピーできませんでした');
            }
          }}
        >
          📤 共有
        </button>
        <button type="button" className="btn slim secondary" onClick={() => { if (!printText(title, text)) flash('印刷用の画面を開けませんでした（ポップアップの許可をご確認ください）'); }}>
          🖨 印刷
        </button>
        <button type="button" className="btn slim secondary" onClick={() => { downloadText(filename, text); flash('ファイルを保存しました'); }}>
          💾 保存
        </button>
      </div>
      {status && <p className="small" style={{ margin: 0 }}>{status}</p>}
      <button type="button" className="btn slim secondary" onClick={() => setOpen((v) => !v)}>
        {open ? '本文を隠す' : '本文を確認する'}
      </button>
      {open && <textarea className="share-text" readOnly value={text} rows={14} onFocus={(e) => e.target.select()} />}
    </div>
  );
}
