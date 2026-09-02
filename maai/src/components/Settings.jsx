import React, { useState } from 'react';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Settings({
  settings,
  setSetting,
  onClearAll,
  recordCount,
  triedCount = 0,
  storageSize,
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>設定</h1>
        <p>このアプリのデータは、この端末から出ません。</p>
      </div>
      <Rule mark={GLYPHS.circleCross} />

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
          記録 {recordCount}件・やってみた印 {triedCount}件・
          約{Math.max(1, Math.round(storageSize() / 1024))}KB（端末内）。
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
            記録{recordCount}件・やってみた印{triedCount}件と設定をすべて消します。元に戻せません。
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
          恋愛の心理学を、<strong>近づき方</strong>と<strong>気づき方</strong>の両方から扱います。
          相手を思いどおりにする方法は書いていません——書くと、それを使われる側が
          このアプリを読んでも助けにならなくなるからです。
        </p>
        <p className="tiny">
          点数・順位・診断は出しません。効き目の大きさも書きません（「◯％が落ちる」は
          実験の条件次第で変わります）。出せるのは、その話がどのくらい確かめられているかと、
          当たった言葉がどれかだけで、決めるのはあなたです。
        </p>
      </div>
    </>
  );
}
