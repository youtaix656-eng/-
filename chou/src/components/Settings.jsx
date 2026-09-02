import React, { useRef, useState } from 'react';
import { recordedTotal } from '../lib/stats.js';
import { todayKey } from '../lib/dates.js';

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

export default function Settings({ store }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState('');
  const total = recordedTotal(store.days);
  const size = store.storageSize();

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chou-backup_${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('書き出しました。記録そのものが入っているので、置き場所に気をつけてください。');
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

      <section className="block">
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

      <section className="block">
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
        {message && <p className="muted small">{message}</p>}
      </section>

      <section className="block">
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
      </section>

      <section className="block">
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
    </div>
  );
}
