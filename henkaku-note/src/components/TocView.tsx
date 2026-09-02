import { useMemo, useState } from 'react';
import {
  buildTocEntries, buildKanaIndex, searchEntries, warnOtherRow, resolveAlias,
  TOC_CATEGORIES, TOC_CATEGORY_MAP, type TocEntry, type ViewId,
} from '../data/toc';
import { GROUP_ORDER } from '../lib/yomi';
import { buildPanel, NEEDS_REVIEW_BADGE } from '../lib/tocPanel';
import { flashTo } from '../lib/focus';
import { ANCHORS } from '../data/anchors';
import { CONVERSATION_CANDIDATES, TRIGGER_LABELS, type TocCandidate } from '../data/tocCandidates';
import {
  acceptAdd, acceptDelete, rejectCandidate, pendingCandidates, undoLastTocAdditions,
  type TocUserData,
} from '../lib/tocStore';

/** 開発モードかどうか（本番では黙る）。import.meta の型に頼らずに見る */
function isDev(): boolean {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

interface Props {
  data: TocUserData;
  onChange: (next: TocUserData) => void;
  /** 飛び先へ運ぶ（画面を切り替えてからハイライト） */
  onJump: (view: ViewId, anchor: string) => void;
}

export default function TocView({ data, onChange, onJump }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  // 目次は元データから毎回導く（目次専用の手書きデータを持たない）
  const entries = useMemo(() => buildTocEntries(data.additions, data.removals), [data.additions, data.removals]);

  const filtered = useMemo(() => {
    const byCategory = category ? entries.filter((e) => e.category === category) : entries;
    return searchEntries(byCategory, query);
  }, [entries, category, query]);

  const sections = useMemo(() => buildKanaIndex(filtered), [filtered]);
  const open = useMemo(() => (openId ? entries.find((e) => e.id === openId) ?? null : null), [entries, openId]);

  // 「その他」行が増えていたら、読みの入れ忘れとして開発モードでだけ知らせる
  const otherWarning = useMemo(() => (isDev() ? warnOtherRow(entries) : null), [entries]);

  // 会話から来た候補を、まだ決めていないものだけ受け皿に載せる（本体には入れない）
  const decided = new Set(data.candidates.map((c) => c.id));
  const withFresh: TocUserData = useMemo(() => {
    const fresh = CONVERSATION_CANDIDATES.filter((c) => !decided.has(c.id));
    return fresh.length === 0 ? data : { ...data, candidates: [...data.candidates, ...fresh] };
  }, [data, decided]);
  const pending = pendingCandidates(withFresh);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.category, (m.get(e.category) || 0) + 1);
    return m;
  }, [entries]);

  const decide = (c: TocCandidate, yes: boolean) => {
    const at = Date.now();
    const base = withFresh;
    const r = yes
      ? (c.action === 'add' ? acceptAdd(base, c.id, at) : acceptDelete(base, c.id, at))
      : rejectCandidate(base, c.id, at);
    setProblems(r.ok ? [] : r.problems);
    if (r.ok) onChange(r.data);
  };

  const jumpToEntry = (title: string) => {
    const hit = resolveAlias(entries, title);
    if (hit) setOpenId(hit.id);
  };

  const addedCount = data.history.filter((h) => h.kind === 'added').length
    - data.history.filter((h) => h.kind === 'undone').length;

  return (
    <div className="stack">
      <div className="card">
        <h2>📇 目次</h2>
        <p className="small muted" style={{ margin: 0 }}>
          アプリに出てくる言葉を、あ〜ん／A〜Z で引けます。言葉をタップすると説明と飛び先が出ます。
          読みが登録されていない言葉は「その他」に入ります（読み方は<strong>推定しません</strong>）。
        </p>
        <label className="field">
          <span className="field-label">さがす（言葉・読み・別の呼び名）</span>
          <input
            type="search"
            value={query}
            placeholder="めいそう / 腸活 / WHO"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          {filtered.length} 件{query || category ? `（全 ${entries.length} 件から）` : ''}
        </p>
        {otherWarning && <p className="note-line warm" style={{ margin: 0 }}>{otherWarning}</p>}
      </div>

      <div className="card">
        <span className="section-title">まとまりでしぼる</span>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={category === ''} onClick={() => setCategory('')}>
            すべて
          </button>
          {TOC_CATEGORIES.filter((c) => (counts.get(c.id) || 0) > 0).map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={category === c.id}
              onClick={() => setCategory(category === c.id ? '' : c.id)}
            >
              {c.icon} {c.label}（{counts.get(c.id)}）
            </button>
          ))}
        </div>
      </div>

      {/* あ〜ん / A〜Z の行バー。**絞り込んだ結果の全体から作る** */}
      <div className="card">
        <span className="section-title">行へ飛ぶ</span>
        <div className="chips">
          {GROUP_ORDER.map((g) => {
            const has = sections.some((s) => s.group === g);
            return (
              <button
                key={g}
                type="button"
                className="chip"
                disabled={!has}
                onClick={() => flashTo(`toc-row-${g}`)}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {sections.length === 0 && (
        <div className="card">
          <p className="small muted" style={{ margin: 0 }}>
            当てはまる言葉がありませんでした。ひらがなだけ／別の呼び名でも引けます。
          </p>
        </div>
      )}

      {sections.map((s) => (
        <div className="card" key={s.group} id={`toc-row-${s.group}`}>
          <div className="row">
            <h3 style={{ margin: 0, flex: 1 }}>{s.group}</h3>
            <span className="num muted">{s.items.length}</span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {s.items.map((e) => (
              <button
                key={e.id}
                type="button"
                className="toc-item"
                onClick={() => { setOpenId(e.id); setProblems([]); }}
              >
                <span className="toc-title">
                  {e.title}
                  {e.descriptionStatus === 'needs_review' && <span className="tag warn">{NEEDS_REVIEW_BADGE}</span>}
                  {e.userAdded && <span className="tag">自分で足した</span>}
                </span>
                <span className="toc-sub">
                  {TOC_CATEGORY_MAP[e.category]?.icon} {e.sub}
                </span>
                {e.aliases.length > 0 && <span className="toc-alias">別の呼び名：{e.aliases.join('・')}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      {open && <TocPanel entry={open} onClose={() => setOpenId(null)} onJump={onJump} onJumpToEntry={jumpToEntry} />}

      {/* ── 会話から来た追加・削除の候補 ── */}
      <div className="card" id={ANCHORS.tocCandidates}>
        <h3>🗂 追加・削除の候補</h3>
        <p className="small muted" style={{ margin: 0 }}>
          候補は<strong>ここに留めてあるだけ</strong>で、目次にはまだ入っていません。
          「追加する」を押した時に初めて、読み・重複・分類・正規化を見てから入ります。
        </p>
        {problems.length > 0 && (
          <div className="confirm">
            <strong className="small">入れられませんでした</strong>
            {problems.map((p) => <p className="small" key={p} style={{ margin: 0 }}>・{p}</p>)}
          </div>
        )}
        {pending.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>いまは候補がありません。</p>
        ) : (
          pending.map((c) => (
            <div key={c.id} className="card" style={{ gap: 6, background: 'rgba(16,20,43,0.55)' }}>
              <div className="row">
                <h4 style={{ flex: 1, margin: 0 }}>{c.title}</h4>
                <span className="tag">{c.action === 'add' ? '追加の候補' : '削除の候補'}</span>
              </div>
              {c.reading && <p className="small muted" style={{ margin: 0 }}>よみ：{c.reading}</p>}
              <p className="small" style={{ margin: 0 }}>{c.description || '※説明未登録'}</p>
              <p className="small muted" style={{ margin: 0 }}>
                {NEEDS_REVIEW_BADGE}／きっかけ：{TRIGGER_LABELS[c.addedFrom.trigger]}（{c.addedFrom.date}）
              </p>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn slim" onClick={() => decide(c, true)}>
                  {c.action === 'add' ? '追加する' : '削除する'}
                </button>
                <button type="button" className="btn slim secondary" onClick={() => decide(c, false)}>
                  {c.action === 'add' ? '追加しない' : '削除しない'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" id={ANCHORS.tocHistory}>
        <h3>🕘 決めたことの履歴</h3>
        {data.history.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>まだありません。</p>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            {[...data.history].reverse().slice(0, 20).map((h, i) => (
              <p className="small" key={`${h.candidateId}-${h.at}-${i}`} style={{ margin: 0 }}>
                {new Date(h.at).toLocaleString('ja-JP')}　
                {h.kind === 'added' ? '追加した' : h.kind === 'deleted' ? '削除した' : h.kind === 'rejected' ? '見送った' : '取り消した'}
                ：{h.title}
              </p>
            ))}
          </div>
        )}
        {addedCount > 0 && (
          <button
            type="button"
            className="btn slim secondary"
            onClick={() => onChange(undoLastTocAdditions(data, 1, Date.now()))}
          >
            直近の追加を1件取り消す
          </button>
        )}
      </div>
    </div>
  );
}

function TocPanel({
  entry, onClose, onJump, onJumpToEntry,
}: {
  entry: TocEntry;
  onClose: () => void;
  onJump: (view: ViewId, anchor: string) => void;
  onJumpToEntry: (title: string) => void;
}) {
  const p = buildPanel(entry);
  return (
    <div className="toc-panel" role="dialog" aria-label={`${p.title} の説明`}>
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0, flex: 1 }}>{p.categoryIcon} {p.title}</h3>
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={onClose}>×</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="tag">{p.categoryLabel}</span>
          {p.reading && <span className="tag">よみ：{p.reading}</span>}
          {/* needs_review なら必ず出す */}
          {p.showNeedsReview && <span className="tag warn">{NEEDS_REVIEW_BADGE}</span>}
        </div>

        <p className={p.descriptionMissing ? 'small muted' : 'note-line'} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {p.description}
        </p>
        {p.showNeedsReview && (
          <p className="small muted" style={{ margin: 0 }}>
            出典は本人の要約で、一次資料には当たっていません。断定された効果として受け取らないでください。
          </p>
        )}

        {p.aliases.length > 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            別の呼び名：
            {p.aliases.map((a) => (
              <button key={a} type="button" className="link-btn" onClick={() => onJumpToEntry(a)}>{a}</button>
            ))}
          </p>
        )}

        <span className="section-title">飛び先</span>
        {p.destinationsEmpty ? (
          <p className="small muted" style={{ margin: 0 }}>{p.destinationsNote}</p>
        ) : (
          <div className="chips">
            {p.destinations.map((d) => (
              <button
                key={`${d.view}#${d.anchor}`}
                type="button"
                className="chip"
                onClick={() => { onClose(); onJump(d.view, d.anchor); }}
              >
                {d.typeIcon} {d.label}<span className="muted small">（{d.typeLabel}）</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
