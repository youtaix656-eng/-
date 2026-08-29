import React, { useState } from 'react';

export default function Settings({ settings, setSetting, onClearAll, recordCount, storageSize }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="head">
        <h1>設定</h1>
        <p>このアプリのデータは、この端末から出ません。</p>
      </div>

      <div className="card">
        <h3>記録の残し方</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={!!settings.keepRaw}
            onChange={(e) => setSetting('keepRaw', e.target.checked)}
          />
          <span>
            本文をそのまま残す（既定は<strong>伏せる</strong>）
            <br />
            <span className="tiny">
              電話番号・メール・リンク・長い数字を〔電話番号〕のような札に置き換えるのをやめます。
              端末を人に見られる可能性があるなら、伏せたままをおすすめします。
            </span>
          </span>
        </label>
      </div>

      <div className="card">
        <h3>保存されているもの</h3>
        <p className="tiny">
          記録 {recordCount}件・約{Math.max(1, Math.round(storageSize() / 1024))}KB（端末内）。
          このアプリはサーバーを持たないので、端末を変えるとデータは引き継がれません。
        </p>
        {!confirming ? (
          <div className="row end">
            <button className="danger" onClick={() => setConfirming(true)}>
              すべて消す
            </button>
          </div>
        ) : (
          <div className="note warn">
            記録{recordCount}件と設定をすべて消します。元に戻せません。
            <div className="row end" style={{ marginTop: 8 }}>
              <button className="ghost" onClick={() => setConfirming(false)}>
                やめる
              </button>
              <button
                className="danger"
                onClick={() => {
                  onClearAll();
                  setConfirming(false);
                }}
              >
                消す
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card quiet">
        <h3>このアプリについて</h3>
        <p className="muted">
          相手を操るための道具ではありません。<strong>「そう言われると断りにくい」の正体に名前をつける</strong>ためのものです。
          名前がつくと、その場で「あ、これだ」と気づけるようになります。
        </p>
        <p className="tiny">
          点数や危険度は出しません。「危険度80点」を出すには他人の事例という手元にない基準が要ります。
          出せるのは「どの型の言い回しに、どの語で当たったか」だけで、決めるのはあなたです。
        </p>
      </div>
    </>
  );
}
