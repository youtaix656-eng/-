import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { buildTocEntries, entryMatches, TOC_GROUPS, tabForTarget, NEEDS_REVIEW_BADGE } from '../data/toc.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { flashTo } from '../lib/focus.js';
import { useFocusJump } from './useFocusJump.js';
import TermPanel from './TermPanel.jsx';
import TocCandidates from './TocCandidates.jsx';
import RedFlagLink from './RedFlagLink.jsx';

// 目次・索引。**目次専用の手書きの一覧を持たない**——`buildTocEntries` が元データから毎回作る。
//
// 決めていること
//  - 並びは「あ〜ん」→「A〜Z」→「その他」。読みで並べ、**数字は読みに直してから**行を決める。
//  - **読みが無いものは「その他」へ落とす**（入れ忘れが見えるように。推定して埋めない）。
//  - タブの切り替えは `useLayoutEffect`（描き終わる前に済ませないと、飛び先がまだ画面に無い）。
//  - 光らせる印は `data-flash` 属性（`className` に足すと、次の描き直しで消える）。

const TABS = [{ id: 'all', label: 'すべて' }, ...TOC_GROUPS, { id: 'candidates', label: '候補' }];

const isDev = () => {
  try {
    return Boolean(import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
};

export default function TableOfContents({ store, focus, onFocusDone, onGo }) {
  const [tab, setTab] = useState(() => tabForTarget(focus).tab || 'all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [message, setMessage] = useState('');

  // **描く前に**タブを合わせる（useEffect にすると、飛ぶ時にまだ古いタブが描かれていて着かない）
  useLayoutEffect(() => {
    const want = tabForTarget(focus).tab;
    if (want) setTab(want);
  }, [focus]);

  useFocusJump(focus, onFocusDone);

  const entries = useMemo(
    () => buildTocEntries({ userTerms: store.userTerms, removedIds: store.removedIds }),
    [store.userTerms, store.removedIds],
  );

  const shown = useMemo(() => {
    const base = tab === 'all' || tab === 'candidates' ? entries : entries.filter((e) => e.group === tab);
    if (!q.trim()) return base.map((entry) => ({ entry, via: null }));
    return base
      .map((entry) => ({ entry, match: entryMatches(entry, q) }))
      .filter((row) => row.match.hit)
      .map((row) => ({ entry: row.entry, via: row.match.via }));
  }, [entries, tab, q]);

  const index = useMemo(
    () =>
      buildKanaIndex(
        shown.map((row) => row.entry),
        {
          onWarn: isDev()
            ? (msg) => {
                // 読みの入れ忘れに開発中に気づくためのもの（画面は止めない）
                console.warn(`[目次] ${msg}`);
              }
            : undefined,
        },
      ),
    [shown],
  );

  const viaOf = useMemo(() => new Map(shown.map((row) => [row.entry.id, row.via])), [shown]);
  const open = useMemo(() => entries.find((e) => e.id === openId) || null, [entries, openId]);

  const goRow = useCallback((rowId) => {
    flashTo(`toc-row-${rowId}`);
  }, []);

  const handleGo = useCallback(
    (dest) => {
      setOpenId(null);
      onGo(dest.view, dest.targetId);
    },
    [onGo],
  );

  const acceptWith = useCallback(
    (id) => {
      const result = store.acceptTocCandidate(id);
      setMessage(result.ok ? '目次に入れました。' : `入れられませんでした：${result.reasons.join(' / ')}`);
    },
    [store],
  );

  const storeForCandidates = { ...store, acceptTocCandidate: acceptWith };
  const rowsWithOther = index.other.length
    ? [...index.rows, { id: 'other', label: 'その他', items: index.other }]
    : index.rows;

  return (
    <div className="view">
      <header className="view-head">
        <h1>目次</h1>
        <p className="muted">
          全{entries.length}件。読みの「あ〜ん」→「A〜Z」の順に並べています。
        </p>
      </header>

      <div className="seg" role="group" aria-label="まとまり">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip small${tab === t.id ? ' on' : ''}`}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'candidates' && store.tocCandidates.filter((c) => c.status === 'pending').length > 0
              ? `（${store.tocCandidates.filter((c) => c.status === 'pending').length}）`
              : ''}
          </button>
        ))}
      </div>

      {tab === 'candidates' ? (
        <TocCandidates store={storeForCandidates} message={message} />
      ) : (
        <>
          <label className="search">
            <span className="sr-only">目次をさがす（別の呼び名・ひらがなでも）</span>
            <input
              type="search"
              value={q}
              placeholder="さがす（別の呼び名・ひらがなでも）"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="kana-bar">
            {rowsWithOther.map((row) => (
              <button key={row.id} type="button" className="kana-key" onClick={() => goRow(row.id)}>
                {row.label}
              </button>
            ))}
          </div>

          <p className="muted small">
            {shown.length}件
            {q.trim() && shown.length === 0 && ' — 見つかりませんでした。別の呼び名でも引けます。'}
          </p>

          {rowsWithOther.map((row) => (
            <section key={row.id} className="block" id={`toc-row-${row.id}`}>
              <div className="block-head">
                <h2>{row.label}</h2>
                <span className="muted small">{row.items.length}件</span>
              </div>
              {row.id === 'other' && (
                <p className="muted small">
                  読みが入っていないものはここに落ちます（漢字の読みは機械が当てないため）。
                </p>
              )}
              <ul className="toc-list">
                {row.items.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" className="toc-item" onClick={() => setOpenId(entry.id)}>
                      <span className="toc-title">{entry.title}</span>
                      {viaOf.get(entry.id) && <span className="toc-via">→ {viaOf.get(entry.id)}</span>}
                      {entry.descriptionStatus !== 'verified' && (
                        <span className="badge-review small">{NEEDS_REVIEW_BADGE}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {open && <TermPanel entry={open} onClose={() => setOpenId(null)} onGo={handleGo} />}
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
