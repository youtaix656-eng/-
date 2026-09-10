import React, { useMemo, useState } from 'react';
import { lastKeys, todayKey } from '../lib/dates.js';
import { buildVisitNote, visitNoteFilename, NOTE_PARTS, DEFAULT_PARTS, NOTE_RANGES } from '../lib/visitNote.js';
import { canShare, shareText, downloadText, printText, SHARE_NOTE, PRINT_NOTE, PRINT_FAILED } from '../lib/share.js';
import { nextVisit, openQuestions, carryOverText, pastVisits } from '../lib/visits.js';
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
  const base = useMemo(() => buildVisitNote(store.days, keys, parts), [store.days, keys, parts]);

  // 聞きたいこと・前回言われたことを、本文の前後に足す（**アプリが要約しない**）
  const visit = useMemo(() => nextVisit(store.visits, todayKey()), [store.visits]);
  const questions = useMemo(() => openQuestions(visit), [visit]);
  const last = useMemo(() => pastVisits(store.visits, todayKey())[0] || null, [store.visits]);
  const carry = useMemo(() => carryOverText(last), [last]);
  const [withQuestions, setWithQuestions] = useState(true);
  const [withCarry, setWithCarry] = useState(true);

  const text = useMemo(() => {
    const head = withCarry && carry ? `${carry}\n\n` : '';
    const tail =
      withQuestions && questions.length > 0
        ? `\n\n聞きたいこと\n${questions.map((q) => `・${q.text}`).join('\n')}`
        : '';
    return `${head}${base}${tail}`;
  }, [base, carry, questions, withCarry, withQuestions]);

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

  const download = () => downloadText(visitNoteFilename(keys), text);

  /** 共有シートが使える端末だけ。**使えなければダウンロードへ落とす** */
  const share = async () => {
    const ok = await shareText({ title: '受診メモ', text });
    if (!ok) {
      download();
      setCopied('共有できなかったので、ファイルに書き出しました。');
    }
  };

  /** 白い紙に黒い字で開く。印刷のダイアログから PDF にも保存できる */
  const print = () => {
    const ok = printText('受診メモ', text);
    if (!ok) setCopied(PRINT_FAILED);
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>受診メモをつくる</h1>
        <p className="muted">記録から、そのまま読める形に組み立てます。</p>
      </header>

      {(questions.length > 0 || carry) && (
        <section className="block" id="note-extra">
          <div className="block-head">
            <h2>一緒に載せるもの</h2>
          </div>
          {carry && (
            <label className="mark">
              <input type="checkbox" checked={withCarry} onChange={() => setWithCarry((v) => !v)} />
              <span>前回の受診で言われたこと（書いた言葉のまま）</span>
            </label>
          )}
          {questions.length > 0 && (
            <label className="mark">
              <input type="checkbox" checked={withQuestions} onChange={() => setWithQuestions((v) => !v)} />
              <span>まだ聞けていないこと {questions.length}件</span>
            </label>
          )}
          <button type="button" className="ghost small" onClick={() => onGo('visits')}>
            通院の画面でととのえる
          </button>
        </section>
      )}

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
          <button type="button" className="ghost" onClick={print}>
            印刷する（PDFにも保存できます）
          </button>
          {canShare() ? (
            <button type="button" className="ghost" onClick={share}>
              共有する
            </button>
          ) : (
            <button type="button" className="ghost" onClick={download}>
              ファイルに書き出す
            </button>
          )}
        </div>
        {copied && <p className="muted small">{copied}</p>}
        <p className="muted small">{PRINT_NOTE}</p>
        {canShare() && <p className="muted small">{SHARE_NOTE}</p>}
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
