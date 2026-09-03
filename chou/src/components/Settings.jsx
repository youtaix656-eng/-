import React, { useRef, useState } from 'react';
import { recordedTotal } from '../lib/stats.js';
import { todayKey, lastKeys } from '../lib/dates.js';
import { daysToCsv, csvFilename, CSV_NOTE } from '../lib/csv.js';
import { canShare, shareText, downloadText, SHARE_NOTE } from '../lib/share.js';
import { encodeTransfer, decodeTransfer, fitsInQr, TRANSFER_NOTE, TRANSFER_TOO_BIG } from '../lib/transfer.js';
import { toMatrix } from '../lib/qr.js';
import { formatAt, toText, ERROR_LOG_NOTE, ERROR_LOG_EMPTY } from '../lib/errorLog.js';
import { VOICE_OPT_IN_TITLE, VOICE_OPT_IN_NOTE, canListen } from '../lib/voice.js';
import { canSpeak, SPEAK_NOTE } from '../lib/speak.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 設定・書き出し。
// **消す操作には必ず確認を出し、何が消えるかを全部書く。**

/** 1KB に満たないものを「0KB」と書かない（消えたように見える） */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}バイト`;
  return `約${Math.round(bytes / 1024)}KB`;
}

const THEMES = [
  { id: 'auto', label: '端末に合わせる' },
  { id: 'light', label: '明るい' },
  { id: 'dark', label: '暗い（夜の記録に）' },
];

/** 文字の大きさ。**「読めない」を我慢させない**（飛び先の余白は rem で持ってある） */
const TEXT_SIZES = [
  { id: 'normal', label: '標準' },
  { id: 'large', label: '大きめ' },
  { id: 'xlarge', label: '特大' },
];

const CONTRASTS = [
  { id: 'normal', label: 'ふつう' },
  { id: 'high', label: 'はっきり' },
];

/** QR を線ではなく四角で描く（**画像ファイルを持たない**。決まり9） */
function QrCode({ matrix }) {
  if (!matrix) return null;
  const n = matrix.length;
  const rects = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (matrix[r][c]) rects.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000" />);
    }
  }
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width="240" height="240" role="img" aria-label="受け渡し用のQRコード">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      {rects}
    </svg>
  );
}

export default function Settings({ store, focus, onFocusDone, onGo }) {
  useFocusJump(focus, onFocusDone);
  const fileRef = useRef(null);
  const [message, setMessage] = useState('');
  const [handoff, setHandoff] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [paste, setPaste] = useState('');
  const total = recordedTotal(store.days);
  const size = store.storageSize();

  const backupText = () => JSON.stringify(store.exportAll(), null, 2);

  const exportFile = () => {
    downloadText(`chou-backup_${todayKey()}.json`, backupText(), 'application/json;charset=utf-8');
    setMessage('書き出しました。記録そのものが入っているので、置き場所に気をつけてください。');
  };

  /** 共有シートへ渡す。**使えなければダウンロードへ落とす**（何も起きないボタンにしない） */
  const shareBackup = async () => {
    const ok = await shareText({ title: '腸（ちょう）の記録', text: backupText() });
    if (!ok) {
      exportFile();
      setMessage('共有できなかったので、ファイルに書き出しました。');
    } else {
      setMessage('渡しました。渡した先に記録がそのまま残ります。');
    }
  };

  /** CSV。**判定も平均も入らない**——書いたものだけ（決まり2・3） */
  const exportCsv = (n) => {
    const keys = lastKeys(n, todayKey());
    downloadText(csvFilename(keys), daysToCsv(store.days, keys), 'text/csv;charset=utf-8');
    setMessage('CSVを書き出しました。表計算ソフトで開けます。');
  };

  /**
   * 別の端末へ渡す文字列を作る。QR は**入る大きさの時だけ**出す（入ったふりをしない）。
   * ライブラリは押した時に読み込む（起動時の重さにしない）。
   */
  const makeHandoff = async () => {
    const text = encodeTransfer(store.exportAll());
    setHandoff(text);
    setMatrix(null);
    if (!fitsInQr(text)) {
      setMessage(TRANSFER_TOO_BIG);
      return;
    }
    setMessage('');
    try {
      const mod = await import('../lib/vendor/qrcode-generator.mjs');
      setMatrix(toMatrix(mod.default || mod, text));
    } catch {
      setMessage(TRANSFER_TOO_BIG);
    }
  };

  const takeHandoff = () => {
    const result = decodeTransfer(paste);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    if (!window.confirm('取り込みますか？ 今ある記録は消しません（同じ日は、あとから直したほうを残します）。')) {
      return;
    }
    const out = store.importAll(result.data);
    setMessage(
      out.ok
        ? `取り込みました（新しく足した ${out.added}日 / 上書きした ${out.updated}日）。`
        : '読み取れませんでした。',
    );
    setPaste('');
  };

  const importFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('取り込みますか？ 今ある記録は消しません（同じ日は、あとから直したほうを残します）。')) {
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      const result = store.importAll(raw);
      setMessage(
        result.ok
          ? `取り込みました（新しく足した ${result.added}日 / 上書きした ${result.updated}日）。`
          : '読み取れませんでした。書き出したファイルをそのまま選んでください。',
      );
    } catch {
      setMessage('読み取れませんでした。書き出したファイルをそのまま選んでください。');
    }
  };

  const clearAll = () => {
    const ok = window.confirm(
      [
        'この端末から、次のものをすべて消します。戻せません。',
        '',
        '・毎日の記録（お腹の調子・お通じ・たべもの・ひとこと）',
        '・食材につけた「合った／合わなかった」',
        '・表示の設定',
        '',
        '消す前に、書き出しておくこともできます。消しますか？',
      ].join('\n'),
    );
    if (!ok) return;
    store.clearAll();
    setMessage('すべて消しました。');
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>このアプリのこと</h1>
      </header>

      <section className="block" id="set-storage">
        <div className="block-head">
          <h2>保存されているもの</h2>
        </div>
        <p>
          記録した日 <strong>{total}日</strong>／この端末で使っている大きさ {formatSize(size)}
        </p>
        <p className="muted small">
          記録はこの端末の中だけに残ります。どこにも送っていません。
          お通じと食事の記録は、人に見られたくないものだからです。
          端末を変えるとき・アプリのデータを消すときに残したければ、下から書き出してください。
        </p>
      </section>

      <section className="block" id="set-io">
        <div className="block-head">
          <h2>書き出す・取り込む</h2>
        </div>
        <div className="row">
          <button type="button" className="solid" onClick={exportFile}>
            ファイルに書き出す
          </button>
          <button type="button" className="ghost" onClick={() => fileRef.current && fileRef.current.click()}>
            ファイルから取り込む
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={importFile}
        />
        {canShare() && (
          <button type="button" className="ghost" onClick={shareBackup}>
            共有する（メール・チャットなどへ）
          </button>
        )}
        {canShare() && <p className="muted small">{SHARE_NOTE}</p>}
        {message && <p className="muted small">{message}</p>}
      </section>

      <section className="block" id="set-csv">
        <div className="block-head">
          <h2>CSVで書き出す</h2>
        </div>
        <p className="muted small">{CSV_NOTE}</p>
        <div className="row">
          <button type="button" className="ghost" onClick={() => exportCsv(30)}>
            この30日ぶん
          </button>
          <button type="button" className="ghost" onClick={() => exportCsv(90)}>
            この90日ぶん
          </button>
          <button type="button" className="ghost" onClick={() => exportCsv(400)}>
            ぜんぶ
          </button>
        </div>
      </section>

      <section className="block" id="set-handoff">
        <div className="block-head">
          <h2>別の端末へ渡す</h2>
        </div>
        <p className="muted small">{TRANSFER_NOTE}</p>
        <button type="button" className="ghost" onClick={makeHandoff}>
          渡すものを作る
        </button>
        {handoff && (
          <>
            {matrix && (
              <div className="figure-row">
                <QrCode matrix={matrix} />
              </div>
            )}
            <label className="field">
              <span className="muted small">この文字列をコピーして、もう一方の端末に貼ってください</span>
              <textarea className="note-out" rows="4" readOnly value={handoff} />
            </label>
            <button
              type="button"
              className="ghost small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(handoff);
                  setMessage('コピーしました。');
                } catch {
                  setMessage('コピーできませんでした。上の文字列を選んでコピーしてください。');
                }
              }}
            >
              コピーする
            </button>
          </>
        )}
        <label className="field">
          <span className="muted small">受け取る（貼り付けて取り込む）</span>
          <textarea rows="3" value={paste} onChange={(e) => setPaste(e.target.value)} />
        </label>
        <button type="button" className="ghost" onClick={takeHandoff}>
          貼ったものを取り込む
        </button>
      </section>

      <section className="block" id="set-theme">
        <div className="block-head">
          <h2>見た目</h2>
        </div>
        <div className="seg" role="group" aria-label="見た目">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`chip${store.settings.theme === theme.id ? ' on' : ''}`}
              aria-pressed={store.settings.theme === theme.id}
              onClick={() => store.setSettings({ theme: theme.id })}
            >
              {theme.label}
            </button>
          ))}
        </div>

        <div className="block-head">
          <h3>文字の大きさ</h3>
        </div>
        <div className="seg" role="group" aria-label="文字の大きさ">
          {TEXT_SIZES.map((size2) => (
            <button
              key={size2.id}
              type="button"
              className={`chip${(store.settings.textSize || 'normal') === size2.id ? ' on' : ''}`}
              aria-pressed={(store.settings.textSize || 'normal') === size2.id}
              onClick={() => store.setSettings({ textSize: size2.id })}
            >
              {size2.label}
            </button>
          ))}
        </div>

        <div className="block-head">
          <h3>見え方</h3>
        </div>
        <div className="seg" role="group" aria-label="コントラスト">
          {CONTRASTS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip${(store.settings.contrast || 'normal') === c.id ? ' on' : ''}`}
              aria-pressed={(store.settings.contrast || 'normal') === c.id}
              onClick={() => store.setSettings({ contrast: c.id })}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="mark">
          <input
            type="checkbox"
            checked={Boolean(store.settings.reduceMotion)}
            onChange={() => store.setSettings({ reduceMotion: !store.settings.reduceMotion })}
          />
          <span>動きを少なくする（画面のアニメーションを止めます）</span>
        </label>

        {canSpeak() && (
          <>
            <div className="block-head">
              <h3>読み上げ</h3>
            </div>
            <label className="mark">
              <input
                type="checkbox"
                checked={Boolean(store.settings.speak)}
                onChange={() => store.setSettings({ speak: !store.settings.speak })}
              />
              <span>読み物に読み上げのボタンを出す（既定はオフ）</span>
            </label>
            <p className="muted small">{SPEAK_NOTE}</p>
          </>
        )}
      </section>

      <section className="block" id="set-voice">
        <div className="block-head">
          <h2>{VOICE_OPT_IN_TITLE}</h2>
        </div>
        <p className="muted small">{VOICE_OPT_IN_NOTE}</p>
        {canListen() ? (
          <label className="mark">
            <input
              type="checkbox"
              checked={Boolean(store.settings.voiceInput)}
              onChange={() => store.setSettings({ voiceInput: !store.settings.voiceInput })}
            />
            <span>声で入力できるようにする（既定はオフ）</span>
          </label>
        ) : (
          <p className="muted small">この端末では音声入力を使えません。</p>
        )}
      </section>

      <section className="block" id="set-errors">
        <div className="block-head">
          <h2>エラーの記録</h2>
        </div>
        <p className="muted small">{ERROR_LOG_NOTE}</p>
        {store.errors.length === 0 ? (
          <p className="muted">{ERROR_LOG_EMPTY}</p>
        ) : (
          <>
            <ul className="flags">
              {store.errors.map((e) => (
                <li key={e.id}>
                  <span className="muted small">
                    {formatAt(e.at)}
                    {e.where ? `／${e.where}` : ''}
                  </span>
                  <span className="small">{e.message}</span>
                </li>
              ))}
            </ul>
            <div className="row">
              <button
                type="button"
                className="ghost small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(toText(store.errors));
                    setMessage('エラーの記録をコピーしました。');
                  } catch {
                    setMessage('コピーできませんでした。');
                  }
                }}
              >
                コピーする
              </button>
              <button type="button" className="ghost small" onClick={store.clearErrors}>
                エラーの記録を消す
              </button>
            </div>
          </>
        )}
      </section>

      <section className="block" id="set-clear">
        <div className="block-head">
          <h2>すべて消す</h2>
        </div>
        <button type="button" className="ghost danger" onClick={clearAll}>
          この端末の記録をすべて消す
        </button>
      </section>

      <div className="notice">
        <p>
          このアプリは、症状の見分けをしません。作っているのは
          「あとで思い出せない材料を残して、受診のときに渡せる形にする」ところまでです。
        </p>
        <p>つらいとき・気になることがあるときは、記録の有無に関わらず医療機関に相談してください。</p>
      </div>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
