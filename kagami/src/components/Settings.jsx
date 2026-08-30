import React, { useState } from 'react';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

/** 何も入っていないのに「約1KB」と書かない（実際の量をそのまま出す） */
function sizeLine(bytes) {
  if (!bytes) return 'まだ何も入っていません';
  if (bytes < 1024) return `約${bytes}バイト`;
  return `約${Math.round(bytes / 1024)}KB`;
}

export default function Settings({
  settings, setSetting, onClearAll, recordCount, caseCount = 0, tryCount = 0, habitCount = 0, storageSize,
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
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
          記録 {recordCount}件・人間分析の見立て {caseCount}件・やってみた記録 {tryCount}件・
          自分に当てはまる癖 {habitCount}件・{sizeLine(storageSize())}（端末内）。
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
            <strong>この端末に入っているものを全部消します。</strong>
            記録{recordCount}件・人間分析の見立て{caseCount}件・やってみた記録{tryCount}件・
            自分に当てはまる癖{habitCount}件・しぼり込みとさがした語・設定。元に戻せません。
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
