import React, { useState } from 'react';
import { actions } from '../lib/useStore.js';
import { storageSize } from '../lib/storage.js';
import CopyBox from './CopyBox.jsx';

export default function Settings({ state }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const size = storageSize();

  const doImport = () => {
    // **取り込みは必ず確認を出す**（今のデータを置き換えるため）
    const ok = window.confirm(
      '取り込むと、いま入っているデータ（試験・計画・認知特性の答え・問題・ポモドーロの記録）が\nすべて置き換わります。よろしいですか。',
    );
    if (!ok) return;
    const result = actions.importAll(text);
    setMsg(result.ok ? '取り込みました。' : `取り込めませんでした：${result.error}`);
    if (result.ok) setText('');
  };

  return (
    <div>
      <h2>⚙️ 設定</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>見た目</h3>
        <p className="muted">テーマ</p>
        <div className="chips">
          {[
            ['light', '☀ ライト'],
            ['dark', '🌙 ダーク'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip ${state.settings.theme === id ? 'on' : ''}`}
              onClick={() => actions.setSettings({ theme: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted">文字の大きさ</p>
        <div className="chips">
          {[
            ['m', '小'],
            ['l', '中'],
            ['xl', '大'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip ${state.settings.fontScale === id ? 'on' : ''}`}
              onClick={() => actions.setSettings({ fontScale: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>保存について</h3>
        <ul>
          <li>保存先は<strong>この端末の中だけ</strong>です（localStorage）。</li>
          <li>ネットワークには一切送りません。アカウントもログインもありません。</li>
          <li>
            そのぶん、<strong>ブラウザのデータを消すと無くなります。</strong>
            大事な計画書・問題は、下の書き出しでファイルに保存しておいてください。
          </li>
        </ul>
        <p className="muted">いま入っているデータ：約 {(size / 1024).toFixed(1)} KB／問題 {state.questions.length}問</p>
      </div>

      <h3>書き出し（バックアップ）</h3>
      <CopyBox text={actions.exportAll()} filename="shikaku-lab-backup.json" label="全データ" collapsed />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>取り込み（復元）</h3>
        <p className="err">取り込むと、いま入っているデータはすべて置き換わります。</p>
        <label className="field">
          <span>バックアップの中身を貼る</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "version": 1, ... }' />
        </label>
        <div className="btn-row">
          <button type="button" onClick={doImport} disabled={!text.trim()}>
            取り込む
          </button>
        </div>
        {msg && <p className={msg.startsWith('取り込みました') ? 'ok-text' : 'err'}>{msg}</p>}
      </div>

      <div className="card danger">
        <h3 style={{ marginTop: 0 }}>全部消す</h3>
        <p>試験の選択・計画・認知特性の答え・取り込んだ問題・ポモドーロの記録が、すべて消えます。元に戻せません。</p>
        <div className="btn-row">
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('本当に全部消しますか。元に戻せません。')) return;
              if (!window.confirm('もう一度確認します。書き出し（バックアップ）は取りましたか。')) return;
              actions.resetAll();
              setMsg('全部消しました。');
            }}
          >
            全部消す
          </button>
        </div>
      </div>
    </div>
  );
}
