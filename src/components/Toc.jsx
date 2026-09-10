import { useEffect, useMemo, useState } from 'react';
import {
  buildTocEntries,
  tocSections,
  filterToc,
  duplicateTitles,
  resolveDestination,
  openTermAction,
  termPanelViewModel,
} from '../data/toc.js';
import { effectiveGlossary, GLOSSARY_CATEGORIES } from '../data/glossaryTerms.js';
import { proposeAddCandidate, runTocChecks, acceptCandidate, rejectCandidate, undoLastTocAdditions } from '../lib/tocCandidates.js';
import * as storage from '../lib/storage.js';
import { useFocusJump } from './useFocusJump.js';

// 「その他」行がこの件数を超えたら開発モードで警告する（#11。readingの入れ忘れの早期発見用）。
const OTHER_ROW_WARN_THRESHOLD = 30;

// 用語集（目次・索引）——アプリ内の用語をあ〜ん順で一覧にし、タップで説明・関連する
// 画面/問題へのリンクを開く。会話や「これを目次に追加して」から出た候補は、
// このレビューで承認されるまで本体データ（glossaryTerms.js）には一切影響しない
// （data/glossaryTerms.jsの単一の正・lib/tocCandidates.jsの候補フロー参照）。
export default function Toc({
  store,
  onToast,
  onNavigate,
  onOpenKeyword,
  onOpenGraphConcept,
  onOpenFlashcardKeyword,
  onStartCustomQuiz,
}) {
  const { questions } = store;
  const [loaded, setLoaded] = useState(false);
  const [glossaryExtra, setGlossaryExtra] = useState([]);
  const [removedIds, setRemovedIds] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('index'); // 'index' | 'candidates' | 'history'
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [openTermId, setOpenTermId] = useState(null);
  const [activeAnchor, setActiveAnchor] = useState(null);

  useEffect(() => {
    Promise.all([
      storage.loadGlossaryExtra(),
      storage.loadGlossaryRemovedIds(),
      storage.loadTocCandidates(),
      storage.loadTocHistory(),
    ]).then(([extra, removed, cand, hist]) => {
      setGlossaryExtra(extra);
      setRemovedIds(removed);
      setCandidates(cand);
      setHistory(hist);
      setLoaded(true);
    });
  }, []);

  const fullGlossary = useMemo(() => effectiveGlossary(glossaryExtra, removedIds), [glossaryExtra, removedIds]);
  const entries = useMemo(() => buildTocEntries(fullGlossary), [fullGlossary]);
  const filtered = useMemo(() => filterToc(entries, { query, category: categoryFilter }), [entries, query, categoryFilter]);
  const sections = useMemo(
    () => tocSections(filtered, { warnOtherThreshold: OTHER_ROW_WARN_THRESHOLD }),
    [filtered]
  );
  const dupTitles = useMemo(() => duplicateTitles(entries), [entries]);
  const byTermId = useMemo(() => {
    const m = new Map();
    for (const e of entries) if (!e.isAlias) m.set(e.targetId, e);
    return m;
  }, [entries]);
  const openTerm = openTermId ? byTermId.get(openTermId) : null;

  // 飛んだ先を運んで光らせるだけで、「anchorが空なら先頭へ戻す」副作用は絶対に作らない
  // （鏡アプリで実際に踏んだバグと同じ形を避けるため）。
  useFocusJump(activeAnchor, () => setActiveAnchor(null));

  const persistExtra = (next) => { setGlossaryExtra(next); storage.saveGlossaryExtra(next); };
  const persistRemoved = (next) => { setRemovedIds(next); storage.saveGlossaryRemovedIds(next); };
  const persistCandidates = (next) => { setCandidates(next); storage.saveTocCandidates(next); };
  const persistHistory = (next) => { setHistory(next); storage.saveTocHistory(next); };

  const openEntry = (entry) => {
    const action = openTermAction(entry.targetId);
    setTab(action.tab);
    setOpenTermId(action.openTermId);
    setActiveAnchor(action.anchor);
  };

  const runDestination = (dest) => {
    const action = resolveDestination(dest);
    if (!action) return;
    if (action.kind === 'navigate') {
      onNavigate?.(action.view);
    } else if (action.kind === 'relay') {
      if (action.relay === 'openKeyword') onOpenKeyword?.(action.arg);
      else if (action.relay === 'openGraphConcept') onOpenGraphConcept?.(action.arg);
      else if (action.relay === 'openFlashcardKeyword') onOpenFlashcardKeyword?.(action.arg);
    } else if (action.kind === 'startQuestion') {
      const q = questions.find((x) => x.id === action.questionId);
      if (q) onStartCustomQuiz?.([q]);
      else onToast?.('この問題は見つかりませんでした');
    } else if (action.kind === 'jumpTerm') {
      const target = byTermId.get(action.targetId);
      if (target) openEntry(target);
    }
  };

  // ---- 候補フロー ----
  const doAccept = (candidateId) => {
    const res = acceptCandidate(candidateId, { candidates, glossaryExtra, removedIds, history, fullGlossary });
    persistCandidates(res.candidates);
    if (!res.ok) {
      onToast?.(res.errors.join(' / '));
      return;
    }
    persistExtra(res.glossaryExtra);
    persistRemoved(res.removedIds);
    persistHistory(res.history);
    onToast?.('候補を反映しました');
  };
  const doReject = (candidateId) => {
    const res = rejectCandidate(candidateId, { candidates, history });
    if (!res.ok) return;
    persistCandidates(res.candidates);
    persistHistory(res.history);
    onToast?.('候補を見送りました');
  };
  const [undoCount, setUndoCount] = useState(1);
  const doUndo = () => {
    const res = undoLastTocAdditions(undoCount, { glossaryExtra, history });
    persistExtra(res.glossaryExtra);
    persistHistory(res.history);
    onToast?.(`直近の自動反映を${res.removedCount}件取り消しました`);
  };

  // ---- クイック追加（トリガーc：ユーザーが明示的に指示した場合） ----
  const [quickTitle, setQuickTitle] = useState('');
  const [quickReading, setQuickReading] = useState('');
  const [quickCategory, setQuickCategory] = useState(GLOSSARY_CATEGORIES[0]?.id || '');
  const [quickDesc, setQuickDesc] = useState('');
  const quickAdd = () => {
    if (!quickTitle.trim()) return;
    const term = {
      id: `gt-${Date.now().toString(36)}`,
      title: quickTitle.trim(),
      reading: quickReading.trim(),
      category: quickCategory,
      description: quickDesc.trim(),
      aliases: [],
      destinations: [],
    };
    persistCandidates(proposeAddCandidate(term, { trigger: 'user_request' }, candidates));
    setQuickTitle('');
    setQuickReading('');
    setQuickDesc('');
    setTab('candidates');
    onToast?.('候補として追加しました。レビューで承認すると反映されます');
  };

  const pendingCandidates = candidates.filter((c) => c.status === 'pending');
  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.at - a.at), [history]);

  return (
    <div className="view">
      <h2 className="view-title">用語集（目次・索引）</h2>
      <p className="view-desc">
        アプリ内の用語をあ〜ん順で一覧にしました。タップすると説明と関連する画面・問題へのリンクが開きます。
        「これを目次に追加して」と伝えれば候補として登録でき、レビューで承認すると反映されます。
        取り込んだ問題を科目ごとに一覧したい時は「目次」画面もあわせてご覧ください。
      </p>
      <button className="btn ghost block" style={{ marginBottom: 12 }} onClick={() => onNavigate && onNavigate('toc')}>
        📘 目次（科目→キーワードで演習）へ
      </button>

      <div className="btn-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <button className={`chip ${tab === 'index' ? 'active' : ''}`} onClick={() => setTab('index')}>索引</button>
        <button className={`chip ${tab === 'candidates' ? 'active' : ''}`} onClick={() => setTab('candidates')}>
          候補{pendingCandidates.length > 0 ? `（${pendingCandidates.length}）` : ''}
        </button>
        <button className={`chip ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>履歴</button>
      </div>

      {tab === 'index' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="用語名・読みで検索" />
            </div>
            <div className="toc-grid">
              <button className={`chip ${categoryFilter === '' ? 'active' : ''}`} onClick={() => setCategoryFilter('')}>すべて</button>
              {GLOSSARY_CATEGORIES.map((c) => (
                <button key={c.id} className={`chip ${categoryFilter === c.id ? 'active' : ''}`} onClick={() => setCategoryFilter(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {dupTitles.length > 0 && (
            <p className="inline-note" style={{ color: 'var(--wrong)' }}>
              ⚠️ タイトルが重複しています：{dupTitles.join('、')}
            </p>
          )}

          {openTerm && <TermPanel entry={openTerm} onClose={() => setOpenTermId(null)} onRunDestination={runDestination} />}

          {!loaded ? null : sections.length === 0 ? (
            <div className="empty">
              <div className="ico">🔍</div>
              <p>一致する項目が見つかりません。</p>
            </div>
          ) : (
            sections.map((sec) => (
              <div key={sec.label} style={{ marginBottom: 14 }}>
                <div className="toc-section-label">{sec.label}</div>
                <div className="toc-grid">
                  {sec.items.map((e) => (
                    <button key={e.id} className="chip toc-chip" onClick={() => openEntry(e)}>
                      {e.title}
                      {e.sub && <span className="toc-chip-sub">{e.sub}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="card" style={{ marginTop: 14 }}>
            <div className="section-label" style={{ marginTop: 0 }}>これを目次に追加して</div>
            <div className="field">
              <label htmlFor="toc-quick-title">用語</label>
              <input id="toc-quick-title" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder="例）衛気" />
            </div>
            <div className="field">
              <label htmlFor="toc-quick-reading">読み（ひらがな）</label>
              <input id="toc-quick-reading" value={quickReading} onChange={(e) => setQuickReading(e.target.value)} placeholder="例）えき" />
            </div>
            <div className="field">
              <label htmlFor="toc-quick-category">分類</label>
              <select id="toc-quick-category" value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)}>
                {GLOSSARY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="toc-quick-desc">説明（任意）</label>
              <textarea id="toc-quick-desc" value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)} />
            </div>
            <button className="btn primary block" style={{ marginTop: 10 }} onClick={quickAdd} disabled={!quickTitle.trim()}>
              候補として追加する
            </button>
          </div>
        </>
      )}

      {tab === 'candidates' && (
        <CandidatesTab
          candidates={pendingCandidates}
          fullGlossary={fullGlossary}
          onAccept={doAccept}
          onReject={doReject}
          undoCount={undoCount}
          setUndoCount={setUndoCount}
          onUndo={doUndo}
        />
      )}

      {tab === 'history' && (
        <div className="card">
          {sortedHistory.length === 0 ? (
            <p className="inline-note">まだ履歴はありません。</p>
          ) : (
            sortedHistory.map((h, i) => (
              <div key={`${h.id}-${i}`} className="toc-history-row">
                {new Date(h.at).toLocaleString('ja-JP')}・
                {h.action === 'add' ? '追加' : h.action === 'delete' ? '削除' : h.action === 'undo_add' ? '取り消し' : h.action}・
                {h.decision === 'accepted' ? '承認' : h.decision === 'rejected' ? '見送り' : h.decision === 'undone' ? '取り消し済み' : h.decision}・
                「{h.term?.title || h.targetId}」
                {h.addedFrom?.trigger ? `（${h.addedFrom.trigger}）` : ''}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TermPanel({ entry, onClose, onRunDestination }) {
  const vm = termPanelViewModel(entry);
  return (
    <div id={`toc-term-${entry.targetId}`} className="card toc-panel">
      <div className="toc-panel-head">
        <div>
          <span className="toc-panel-title">{vm.title}</span>
          {vm.reading && <span className="toc-panel-reading">{vm.reading}</span>}
        </div>
        <button className="btn ghost sm" onClick={onClose} aria-label="閉じる">✕</button>
      </div>
      {vm.showNeedsReview && <span className="freshness-badge">※要確認</span>}
      <p style={{ marginTop: 8 }}>{vm.descriptionText}</p>
      {vm.hasDestinations ? (
        <div className="toc-dest-list">
          {vm.destinations.map((d, i) => (
            <button key={i} className="btn ghost sm block" onClick={() => onRunDestination(d)}>
              {d.label || '関連する場所へ'}
            </button>
          ))}
        </div>
      ) : (
        <p className="inline-note">{vm.emptyDestinationsMessage}</p>
      )}
    </div>
  );
}

function CandidatesTab({ candidates, fullGlossary, onAccept, onReject, undoCount, setUndoCount, onUndo }) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label" style={{ marginTop: 0 }}>直近の自動反映を取り消す</div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label htmlFor="toc-undo-count">件数</label>
          <input
            id="toc-undo-count"
            type="number"
            min="1"
            value={undoCount}
            onChange={(e) => setUndoCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <button className="btn ghost block" onClick={onUndo}>直近{undoCount}件を取り消す</button>
      </div>

      {candidates.length === 0 ? (
        <div className="empty">
          <div className="ico">📥</div>
          <p>レビュー待ちの候補はありません。</p>
        </div>
      ) : (
        candidates.map((c) => {
          if (c.action === 'add') {
            const check = runTocChecks(c.term, fullGlossary);
            return (
              <div key={c.id} className="card toc-candidate-row">
                <div className="stat-head">
                  <span className="stat-subject">{c.term.title}</span>
                  <span className="freshness-badge">※要確認</span>
                </div>
                <p className="inline-note" style={{ margin: 0 }}>
                  {c.term.description ? c.term.description : '※説明未登録'}
                </p>
                {!check.ok && <p className="toc-candidate-errors">{check.errors.join(' / ')}</p>}
                <div className="btn-row">
                  <button className="btn primary sm" onClick={() => onAccept(c.id)}>追加する</button>
                  <button className="btn ghost sm" onClick={() => onReject(c.id)}>追加しない</button>
                </div>
              </div>
            );
          }
          const target = fullGlossary.find((g) => g.id === c.targetId);
          return (
            <div key={c.id} className="card toc-candidate-row">
              <div className="stat-head">
                <span className="stat-subject">🗑️ {target?.title || c.targetId} を削除</span>
              </div>
              <div className="btn-row">
                <button className="btn danger sm" onClick={() => onAccept(c.id)}>削除する</button>
                <button className="btn ghost sm" onClick={() => onReject(c.id)}>削除しない</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
