import React, { useState } from 'react';

// 作った文章を出す共通の箱（コピー・ファイルに保存・折りたたみ）。
// **同じ本文を2か所に持たない**ため、どの画面もこの箱に渡すだけにする。

export default function CopyBox({ text, filename = 'output.txt', label = '出力', collapsed = false, children }) {
  const [open, setOpen] = useState(!collapsed);
  const [msg, setMsg] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg('コピーしました');
    } catch {
      // クリップボードが使えない環境（古い端末・権限なし）でも行き止まりにしない
      setMsg('コピーできませんでした。下の文章を長押しして選んでください。');
    }
    setTimeout(() => setMsg(''), 2600);
  };

  const download = () => {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMsg('保存できませんでした。コピーして使ってください。');
      setTimeout(() => setMsg(''), 2600);
    }
  };

  const chars = (text || '').length;

  return (
    <div className="card">
      <div className="btn-row">
        <button type="button" className="primary" onClick={copy}>
          📋 コピー
        </button>
        <button type="button" onClick={download}>
          💾 ファイルに保存
        </button>
        <button type="button" className="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? '本文を閉じる' : '本文を見る'}
        </button>
        <span className="muted">
          {label}・{chars.toLocaleString('ja-JP')}字
        </span>
      </div>
      {msg && <p className="ok-text">{msg}</p>}
      {children}
      {open && <pre className="out">{text}</pre>}
    </div>
  );
}
