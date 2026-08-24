import { useEffect, useMemo, useState } from 'react';
import { buildMnemonicEntries } from '../lib/mnemonicEntries.js';
import {
  loadMnemonicSrs,
  gradeMnemonic,
  weakMnemonicKeywords,
  mnemonicMastered,
  mnemonicWrongCount,
} from '../lib/mnemonicSrs.js';

// 語呂合わせの想起テスト（④）— 語呂合わせ本文を見て、見出し語（キーワード）を
//   本当に思い出せるかを確認する。一覧・編集はMnemonicNotebook.jsx、こちらは確認専用。
export default function MnemonicQuiz({ store, onNavigate }) {
  const { kwMeta, questions, links } = store;
  const entries = useMemo(() => buildMnemonicEntries(kwMeta, questions, links), [kwMeta, questions, links]);

  const [srsMap, setSrsMap] = useState({});
  const [weakOnly, setWeakOnly] = useState(false);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { loadMnemonicSrs().then(setSrsMap); }, []);

  const pool = useMemo(() => {
    if (!weakOnly) return entries;
    const weakKws = new Set(weakMnemonicKeywords(srsMap, entries.map((e) => e.keyword)));
    const filtered = entries.filter((e) => weakKws.has(e.keyword));
    return filtered.length > 0 ? filtered : entries;
  }, [weakOnly, entries, srsMap]);

  useEffect(() => { setIdx(0); setRevealed(false); }, [weakOnly]);

  const safeIdx = Math.min(idx, Math.max(0, pool.length - 1));
  const entry = pool[safeIdx];

  const go = (d) => {
    if (pool.length === 0) return;
    setRevealed(false);
    setIdx((i) => (i + d + pool.length) % pool.length);
  };

  const grade = async (correct) => {
    if (!entry) return;
    const next = await gradeMnemonic(entry.keyword, correct);
    setSrsMap(next);
    go(1);
  };

  if (entries.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">語呂合わせ 想起テスト</h2>
        <div className="empty">
          <div className="ico">💡</div>
          <p>登録された語呂合わせがまだありません。</p>
          <button className="btn primary" onClick={() => onNavigate && onNavigate('mnemonics')}>語呂合わせノートへ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <h2 className="view-title">語呂合わせ 想起テスト</h2>
      <p className="view-desc">
        語呂合わせの本文を見て、見出し語を思い出せるか確認します。答えを見てから正直に自己採点してください。
      </p>

      <label className="switch-row" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={weakOnly} onChange={(e) => setWeakOnly(e.target.checked)} />
        <span>苦手な語呂合わせだけ出す（「まだ」を選んだもの）</span>
      </label>

      <div className="fc-counter">{safeIdx + 1} / {pool.length}</div>

      <button className={`fc-card${revealed ? ' flipped' : ''}`} onClick={() => setRevealed((r) => !r)}>
        {!revealed ? (
          <div className="fc-front">
            <div className="fc-name" style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 500 }}>{entry.mnemonic}</div>
            <div className="fc-tap">タップで見出し語を確認</div>
          </div>
        ) : (
          <div className="fc-back">
            <div className="fc-back-name">{entry.keyword}{entry.reading ? `（${entry.reading}）` : ''}</div>
            {entry.subjects.length > 0 && (
              <p className="inline-note" style={{ marginTop: 6 }}>{entry.subjects.join('・')}</p>
            )}
          </div>
        )}
      </button>

      {revealed && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn block" onClick={() => grade(false)}>😵 まだ</button>
          <button className="btn primary block" onClick={() => grade(true)}>😄 覚えた</button>
        </div>
      )}
      {mnemonicWrongCount(srsMap, entry.keyword) > 0 && (
        <p className="inline-note" style={{ textAlign: 'center', marginTop: 6 }}>
          {mnemonicMastered(srsMap, entry.keyword) ? '✅ マスター済み' : `これまで「まだ」${mnemonicWrongCount(srsMap, entry.keyword)}回`}
        </p>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn block" onClick={() => go(-1)}>← 前へ</button>
        <button className="btn primary block" onClick={() => go(1)}>次へ →</button>
      </div>

      <div className="ana-jump">
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('mnemonics')}>💡 語呂合わせノートへ</button>
      </div>
    </div>
  );
}
