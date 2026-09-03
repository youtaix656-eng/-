import React, { useMemo, useState } from 'react';
import { lastKeys, todayKey } from '../lib/dates.js';
import { buildVisitNote, visitNoteFilename, NOTE_PARTS, DEFAULT_PARTS, NOTE_RANGES } from '../lib/visitNote.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 受診メモ。**このアプリを持つ理由がここ。**
// アプリは医療者へ送らない——作るのは文章まで。渡す相手は本人が選ぶ。

export default function VisitNote({ store, focus, onFocusDone, onGo }) {
  useFocusJump(focus, onFocusDone);
  const [days, setDays] = useState(14);
  const [parts, setParts] = useState(DEFAULT_PARTS);
  const [copied, setCopied] = useState('');
  const keys = useMemo(() => lastKeys(days, todayKey()), [days]);
  const text = useMemo(() => buildVisitNote(store.days, keys, parts), [store.days, keys, parts]);

  const toggle = (id) =>
    setParts((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('コピーしました');
    } catch {
      setCopied('コピーできませんでした。下の文章を選んでコピーしてください。');
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = visitNoteFilename(keys);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>受診メモをつくる</h1>
        <p className="muted">記録から、そのまま読める形に組み立てます。</p>
      </header>

      <section className="block" id="note-range">
        <div className="block-head">
          <h2>期間</h2>
        </div>
        <div className="seg" role="group" aria-label="期間">
          {NOTE_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`chip${days === r.id ? ' on' : ''}`}
              aria-pressed={days === r.id}
              onClick={() => setDays(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      <section className="block" id="note-parts">
        <div className="block-head">
          <h2>入れるもの</h2>
        </div>
        {NOTE_PARTS.map((part) => (
          <label key={part.id} className="mark">
            <input
              type="checkbox"
              checked={part.fixed || parts.includes(part.id)}
              disabled={part.fixed}
              onChange={() => toggle(part.id)}
            />
            <span>
              {part.label}
              {part.fixed && <span className="muted small">（かならず入れます）</span>}
            </span>
          </label>
        ))}
      </section>

      <section className="block" id="note-out">
        <div className="block-head">
          <h2>できあがり</h2>
        </div>
        <label className="sr-only" htmlFor="visit-note">
          受診メモの本文
        </label>
        <textarea id="visit-note" className="note-out" rows="16" readOnly value={text} />
        <div className="row">
          <button type="button" className="solid" onClick={copy}>
            コピーする
          </button>
          <button type="button" className="ghost" onClick={download}>
            ファイルに書き出す
          </button>
        </div>
        {copied && <p className="muted small">{copied}</p>}
      </section>

      <div className="notice">
        <p>
          これは<strong>本人が記録したもの</strong>で、診断ではありません。
          どこまで見せるかは自分で決められます（上の「入れるもの」から外せます）。
        </p>
        <p>アプリが誰かへ送ることはありません。コピーしたあと、貼る先は自分で選んでください。</p>
      </div>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
