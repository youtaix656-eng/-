import React, { useState } from 'react';
import { CANDIDATE_CHOICES, TRIGGER_LABELS, makeCandidate } from '../data/tocCandidates.js';
import { NEEDS_REVIEW_BADGE } from '../data/toc.js';

// 目次への追加・削除の候補。**候補のあいだは目次に出ない**（押した時に初めて入る）。
// 二択の文言は action で変える（追加する／追加しない・削除する／削除しない）。

export default function TocCandidates({ store, message }) {
  const [title, setTitle] = useState('');
  const [reading, setReading] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const pending = store.tocCandidates.filter((c) => c.status === 'pending');
  const history = [...store.tocHistory].reverse().slice(0, 20);
  const undoable = store.tocHistory.filter((h) => h.action === 'add' && h.status === 'accepted' && !h.undone).length;

  return (
    <div className="toc-candidates">
      <section className="block" id="toc-candidates">
        <div className="block-head">
          <h2>追加・削除の候補</h2>
          <span className="muted small">{pending.length}件</span>
        </div>
        <p className="muted small">
          会話や教材から拾った言葉を、目次へ入れる前に置いてあります。
          <strong>ここにある間は、目次にも本体のデータにも入っていません。</strong>
          「{CANDIDATE_CHOICES.add.yes}」を押したときに、読み・重複・分類・表記の4つを確かめてから入ります。
        </p>
        {pending.length === 0 ? (
          <p className="muted">いまは候補がありません。</p>
        ) : (
          pending.map((c) => {
            const choices = CANDIDATE_CHOICES[c.action] || CANDIDATE_CHOICES.add;
            return (
              <div key={c.id} className="cand">
                <div className="cand-head">
                  <strong>{c.title}</strong>
                  <span className="tag">{c.action === 'delete' ? '削除の候補' : '追加の候補'}</span>
                </div>
                <p className="muted small">
                  読み：{c.reading || '（未記入）'}／出どころ：{TRIGGER_LABELS[c.addedFrom.trigger] || '不明'}
                  {c.addedFrom.date ? `（${c.addedFrom.date}）` : ''}
                </p>
                {c.description && <p className="small">{c.description}</p>}
                <span className="badge-review">{NEEDS_REVIEW_BADGE}</span>
                <div className="row">
                  <button type="button" className="solid" onClick={() => store.acceptTocCandidate(c.id)}>
                    {choices.yes}
                  </button>
                  <button type="button" className="ghost" onClick={() => store.rejectTocCandidate(c.id)}>
                    {choices.no}
                  </button>
                </div>
              </div>
            );
          })
        )}
        {message && <p className="muted small">{message}</p>}
      </section>

      <section className="block">
        <div className="block-head">
          <h2>自分で候補に足す</h2>
        </div>
        <p className="muted small">
          ここから足したものも<strong>いったん候補</strong>です。「{CANDIDATE_CHOICES.add.yes}」を押すまで目次には出ません。
          <strong>読みは自分で書いてください</strong>——漢字の読みを機械が当てると必ず間違えるので、
          このアプリは推測しません（書かないと「その他」に落ちます）。
        </p>
        <label className="search">
          <span className="sr-only">用語</span>
          <input type="text" value={title} placeholder="用語（例：ぜん動運動）" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="search">
          <span className="sr-only">読み（ひらがな）</span>
          <input
            type="text"
            value={reading}
            placeholder="読み・ひらがな（例：ぜんどううんどう）"
            onChange={(e) => setReading(e.target.value)}
          />
        </label>
        <label className="search">
          <span className="sr-only">説明（任意）</span>
          <input
            type="text"
            value={description}
            placeholder="説明（任意）"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="solid"
            onClick={() => {
              // **合図は3つだけ。** ここは「本人の指示」なので user_request
              const candidate = makeCandidate({
                trigger: 'user_request',
                title,
                reading,
                description,
                date: new Date().toLocaleDateString('ja-JP'),
              });
              if (!candidate) {
                setNote('用語を書いてください。');
                return;
              }
              store.addTocCandidate(candidate);
              setTitle('');
              setReading('');
              setDescription('');
              setNote('候補に入れました。下の「追加する」を押すと目次に入ります。');
            }}
          >
            候補にする
          </button>
        </div>
        {note && <p className="muted small">{note}</p>}
      </section>

      <section className="block" id="toc-history">
        <div className="block-head">
          <h2>決めたことの履歴</h2>
          {undoable > 0 && (
            <button type="button" className="ghost small" onClick={() => store.undoTocAdditions(1)}>
              直前の追加を取り消す
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          <ul className="plain small">
            {history.map((h) => (
              <li key={`${h.id}-${h.at}`}>
                {h.title}：
                {h.status === 'rejected'
                  ? h.action === 'delete'
                    ? '削除しない'
                    : '追加しない'
                  : h.action === 'delete'
                    ? '削除した'
                    : '追加した'}
                {h.undone && '（取り消し済み）'}
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          「しない」を選んだものは本体のデータに何も残しません（この履歴にだけ、見送ったことが残ります）。
        </p>
      </section>
    </div>
  );
}
