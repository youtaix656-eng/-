// 目次（索引）。**会社の組み立て**（社員・役職・ジャンル・仕事の流れ・案件の型・道具）を
// 読みで引く。
//
// **自分が作った知識・案件・仕事はここに載らない。**
// 題名をAIが付けるため読みが無く、リポジトリ共通の決まりで漢字の読みは推定しないので、
// 載せると全部が「その他」行に落ちてしまう。探す場所が2つあることを画面で明示し、
// 知識検索への導線をここに置く（黙って載せない・黙って推定しない）。
//
// リポジトリ共通の目次ルールに従う：
//   あ〜ん → A〜Z の順／数字は読みで振り分け／読みは明示（推定しない）／
//   タイトルは重複させない／文字は大きめ・タップで飛ぶ。

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Card, Empty, Sheet } from './ui.jsx';
import { buildTocEntries, filterToc, tocSections, kindCounts, TOC_KINDS } from '../data/toc.js';
import { BUCKETS, UNKNOWN_BUCKET, buildKanaIndex } from '../lib/yomi.js';
import { DESTINATION_TYPES, DESCRIPTION_STATUS, resolveDestination } from '../data/terms.js';
import { OTHER_ROW_WARN_AT, pendingCandidates, CANDIDATE_TRIGGERS } from '../lib/tocCandidates.js';
import { flashTo } from '../lib/focus.js';
import { ROLES, ROLE_GROUPS, rolesOfGroup } from '../data/roles.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';
import { seatsOf } from '../lib/seats.js';
import Portrait from './Portrait.jsx';

export default function Toc({ store, go, preset = {} }) {
  const [query, setQuery] = useState('');
  // 項目15：1文字ごとに全件を絞り込むと入力が引っかかる（実測80ms）。
  // 入力そのものは即座に反映し、絞り込みは1拍遅らせる。
  const deferredQuery = useDeferredValue(query);
  const [kind, setKind] = useState(null);
  // 新項目13：種類の絞り込みと表示の切り替えは「急がない更新」にする。
  // 押した瞬間にボタンの見た目だけ変わり、一覧の作り直しは後ろで進む。
  const [pending, startTransition] = useTransition();
  const [limit, setLimit] = useState(120); // 項目19：多い時は段階的に出す
  // 'org' = 役職×ジャンルの一覧 / 'kana' = 読み引き / 'cand' = 目次への候補
  // **飛び先が指定されている時は、描く前に「あ〜ん」へ切り替える**（下の useLayoutEffect）。
  const [view, setView] = useState(preset.termId ? 'kana' : 'org');
  const sectionRefs = useRef({});
  // タップで開く詳細（説明・別名・飛び先）
  const [picked, setPicked] = useState(null);

  const cand = store.tocCandidates || { candidates: [], history: [] };
  const waiting = useMemo(() => pendingCandidates(cand.candidates), [cand.candidates]);

  // **目次は元データから毎回導出する**（目次専用の手書きデータを持たない）。
  // 画面を離れるたびに作り直されるので、必ず useMemo で包む。
  const entries = useMemo(
    () => buildTocEntries({
      employees: store.employees,
      customGenres: store.genres,
      customTerms: store.terms,
    }),
    [store.employees, store.genres, store.terms]
  );
  const filtered = useMemo(
    () => filterToc(entries, { query: deferredQuery, kind }),
    [entries, deferredQuery, kind]
  );
  // 項目19：件数が多いときは先頭だけ描き、「もっと見る」で足す
  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const sections = useMemo(() => tocSections(shown), [shown]);
  // **五十音バーは「絞り込み後の全件」で判定する。**
  // 表示中のぶんだけで判定すると、上限より後ろの行（な行・や行など）が
  // 押せなくなり、そこへ辿り着く手段が無くなる。
  const allSections = useMemo(() => tocSections(filtered), [filtered]);
  const counts = useMemo(() => kindCounts(entries), [entries]);
  const present = new Set(allSections.map((s) => s.bucket));
  const rendered = new Set(sections.map((s) => s.bucket));

  // 絞り込みを変えたら表示件数を最初に戻す
  useEffect(() => {
    setLimit(120);
  }, [deferredQuery, kind]);

  // **枠の切り替えは useLayoutEffect**（描く前に直す）。
  // useEffect にすると、切り替えの描き直しが flashTo（次のフレーム）より後になり、
  // 運んだ先が作り直された拍子に印だけが消える。
  useLayoutEffect(() => {
    if (preset.termId && view !== 'kana') setView('kana');
  }, [preset.termId, view]);

  // 目次の中の飛び先（用語そのもの）へ運ぶ
  useEffect(() => {
    if (!preset.termId || view !== 'kana') return undefined;
    let tries = 0;
    let raf = 0;
    const tick = () => {
      if (flashTo(`term-${preset.termId}`)) return;
      tries += 1;
      if (tries < 40) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [preset.termId, view, shown]);

  // **「その他」行は読みの入れ忘れが見える場所。** 増えたら開発時に気づけるようにする。
  const kanaIndex = useMemo(() => buildKanaIndex(entries), [entries]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (kanaIndex.otherCount > OTHER_ROW_WARN_AT) {
      // eslint-disable-next-line no-console
      console.warn(
        `[toc]「その他」行が ${kanaIndex.otherCount} 件あります（目安 ${OTHER_ROW_WARN_AT} 件）。`
        + '読みの入れ忘れの可能性があります：'
        + kanaIndex.missing.slice(0, 10).map((m) => m.title).join('・')
      );
    }
  }, [kanaIndex]);

  const jump = (bucket) => {
    // まだ描いていない枠へ飛ぶときは、先に全部出してから移動する
    if (!rendered.has(bucket)) {
      setLimit(filtered.length);
      setTimeout(() => jump(bucket), 60);
      return;
    }
    const el = sectionRefs.current[bucket];
    if (!el) return;
    // 固定ヘッダーの下に見出しが出るようにずらす
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: 'smooth' });
    el.classList.add('toc-flash');
    setTimeout(() => el.classList.remove('toc-flash'), 2000);
  };

  return (
    <div className="screen fade-in" style={pending ? { opacity: 0.62 } : undefined}>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip ${view === 'org' ? 'on' : ''}`} onClick={() => startTransition(() => setView('org'))}>
          役職 × ジャンル
        </button>
        <button type="button" className={`chip ${view === 'kana' ? 'on' : ''}`} onClick={() => startTransition(() => setView('kana'))}>
          あ〜ん で引く
        </button>
        <button type="button" className={`chip ${view === 'cand' ? 'on' : ''}`} onClick={() => startTransition(() => setView('cand'))}>
          目次への候補{waiting.length ? ` ${waiting.length}` : ''}
        </button>
      </div>

      {/* 探す場所が2つあることを先に伝える。
          目次に載るのは「会社の組み立て」だけで、作った知識はここでは引けない。 */}
      <Card className="tight">
        <p className="muted" style={{ margin: 0 }}>
          ここで引けるのは<strong style={{ color: '#fff' }}>会社の組み立て</strong>
          （社員・役職・ジャンル・仕事の流れ・案件の型・道具）です。
          自分が作った知識は、題名に読みが無いためここには載りません。
        </p>
        <button
          type="button"
          className="btn ghost small"
          style={{ marginTop: 8 }}
          onClick={() => go('knowledge')}
        >
          ⌕ 作った知識を探す
        </button>
      </Card>

      {/* 新項目13：作り直しの最中は薄く見せる（固まったように見せない） */}
      {view === 'cand' ? (
        <Candidates store={store} />
      ) : view === 'org' ? (
        <OrgIndex store={store} go={go} />
      ) : (
        <>
          <input
            className="input toc-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="⌕ 名前・読み（ひらがな）で探す"
            style={{ marginBottom: 10 }}
          />

          <div className="chips" style={{ marginBottom: 10 }}>
            <button type="button" className={`chip ${!kind ? 'on' : ''}`} onClick={() => startTransition(() => setKind(null))}>
              すべて {entries.length}
            </button>
            {counts.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`chip ${kind === k.id ? 'on' : ''}`}
                onClick={() => startTransition(() => setKind(kind === k.id ? null : k.id))}
              >
                {k.glyph} {k.name} {k.count}
              </button>
            ))}
          </div>

          {/* 五十音ジャンプバー（タップ領域は大きめに） */}
          <div className="kana-bar">
            {BUCKETS.map((b) => (
              <button
                key={b}
                type="button"
                className="kana-key"
                disabled={!present.has(b)}
                onClick={() => jump(b)}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="muted" style={{ margin: '10px 0' }}>
            {filtered.length}件（読みの「あ〜ん」→「A〜Z」の順）
            {filtered.length > shown.length && ` — うち${shown.length}件を表示中`}
          </div>

          {sections.length ? (
            sections.map((sec) => (
              <div key={sec.bucket} ref={(el) => { sectionRefs.current[sec.bucket] = el; }}>
                <div className="toc-head">
                  {sec.bucket}
                  {sec.bucket !== UNKNOWN_BUCKET && sec.bucket !== 'A-Z' ? '行' : ''}
                  <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{sec.items.length}</span>
                </div>
                {sec.bucket === UNKNOWN_BUCKET && (
                  <p className="muted" style={{ margin: '0 0 8px' }}>
                    読みが設定されていない項目です。漢字の読みは推測しない決まりなので、
                    社員を編集して読みを入れると正しい行に並びます。
                  </p>
                )}
                {sec.items.map((it) => (
                  <button
                    key={it.id}
                    id={it.anchor || undefined}
                    type="button"
                    className="toc-row"
                    onClick={() => setPicked(it)}
                  >
                    {it.kind === 'employee' && it.employee ? (
                      <Portrait employee={it.employee} size={40} frame={false} />
                    ) : (
                      <span className="g">{TOC_KINDS.find((k) => k.id === it.kind)?.glyph || '◉'}</span>
                    )}
                    <span className="body">
                      <span className="t">{it.title}</span>
                      <span className="r">{it.reading || '読み未設定'}</span>
                      {it.sub && <span className="s">{it.sub}</span>}
                    </span>
                    <span className="arrow">›</span>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <Empty>該当する項目がありません。</Empty>
          )}

          {filtered.length > shown.length && (
            <button
              type="button"
              className="btn block"
              onClick={() => startTransition(() => setLimit((n) => n + 200))}
              style={{ marginTop: 10 }}
            >
              もっと見る（残り{filtered.length - shown.length}件）
            </button>
          )}
        </>
      )}

      {picked && (
        <TermPanel entry={picked} store={store} go={go} onClose={() => setPicked(null)} />
      )}
    </div>
  );
}

/**
 * 項目をタップした時に開く詳細。
 *
 * **説明が無ければ「※説明未登録」、飛び先が無ければ「関連する飛び先はありません」**と
 * 正直に出す（空欄を埋めるために作り話を書かない）。
 * **確かめていない説明には必ず「※要確認」を出す**（`descriptionStatus`）。
 */
function TermPanel({ entry, store, go, onClose }) {
  // 用語以外（役職・社員など）は元から飛び先を1つ持っている。
  // それを飛び先の一覧として見せる——**新しい飛び方を作らない。**
  const dests = entry.destinations && entry.destinations.length
    ? entry.destinations
    : entry.view
      ? [{ type: 'page', label: 'この項目をひらく', view: entry.view, arg: entry.arg, anchor: entry.anchor }]
      : [];
  const status = DESCRIPTION_STATUS[entry.descriptionStatus] || null;
  const aliases = (entry.aliases || []).filter(Boolean);

  return (
    <Sheet title={entry.title} onClose={onClose}>
      <p className="muted" style={{ marginTop: -6 }}>
        {entry.reading || '読み未設定'}
        {status && status.badge && (
          <span className="badge" style={{ marginLeft: 8 }}>{status.badge}</span>
        )}
      </p>

      {entry.description ? (
        <p style={{ fontSize: 14, lineHeight: 1.8 }}>{entry.description}</p>
      ) : (
        <p className="muted">※説明未登録</p>
      )}

      {aliases.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>別名：{aliases.join('・')}</p>
      )}

      {dests.length ? (
        dests.map((d, i) => (
          <button
            key={`${d.type}:${d.label}:${i}`}
            type="button"
            className="btn block"
            style={{ marginTop: 6 }}
            onClick={() => {
              onClose();
              // 事業の中の目印は「いま実行中の事業」へ読み替える（無ければ目印を外す）
              const r = resolveDestination(d, { ventures: store.ventures || [] });
              if (r.view) {
                // **飛び先の仕組みは既存の flashTo をそのまま使う**（新設しない）
                go(r.view, r.arg ?? null, r.anchor || null);
              } else if (r.anchor) {
                flashTo(r.anchor);
              }
            }}
          >
            {DESTINATION_TYPES[d.type]?.glyph || '▸'} {d.label}
            <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
              {DESTINATION_TYPES[d.type]?.name || d.type}
            </span>
          </button>
        ))
      ) : (
        <p className="muted">関連する飛び先はありません。</p>
      )}

      {entry.descriptionStatus === 'needs_review' && (
        <button
          type="button"
          className="btn ghost block"
          style={{ marginTop: 10 }}
          onClick={() => { store.verifyTerm(String(entry.id).replace(/^term:/, '')); onClose(); }}
        >
          読んで確かめた（※要確認を外す）
        </button>
      )}
    </Sheet>
  );
}

/**
 * 目次への追加・削除の候補。
 *
 * **押すまで本体データには1文字も入らない。** 「追加する」を押した時にだけ
 * 読み・重複・分類・正規化の4つを確かめ、通らなければ書かずに理由を出す。
 */
function Candidates({ store }) {
  const [note, setNote] = useState('');
  const data = store.tocCandidates || { candidates: [], history: [] };
  const list = (data.candidates || []).filter((c) => c.status === 'pending');
  const history = (data.history || []).slice(0, 12);

  const decide = async (id, accept) => {
    const r = await store.decideTocCandidate(id, accept);
    setNote(!accept ? '見送りました（本体データは変わっていません）。' : r.ok ? '目次に反映しました。' : `入れられませんでした：${r.reason}`);
  };

  return (
    <>
      <Card glyph="＊" title="目次への候補">
        <p className="muted" style={{ marginTop: -6 }}>
          {store.hydrated ? `未確認の候補が ${list.length} 件です。` : '読み込み中です…'}
          <br />
          候補が生まれるのは
          <strong style={{ color: '#fff' }}>{Object.values(CANDIDATE_TRIGGERS).join('・')}</strong>
          の3つのときだけで、<strong style={{ color: '#fff' }}>押すまで目次には入りません</strong>。
        </p>
        {note && <p className="muted" style={{ fontSize: 12.5 }}>{note}</p>}
      </Card>

      {list.length === 0 && <Empty>いまは候補がありません。</Empty>}

      {list.map((c) => (
        <Card key={c.id} className="tight">
          <strong>{c.title}</strong>
          <span className="badge" style={{ marginLeft: 8 }}>
            {c.action === 'delete' ? '削除の候補' : '追加の候補'}
          </span>
          <span className="badge" style={{ marginLeft: 6 }}>※要確認</span>
          <p className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}>
            {c.description || '※説明未登録'}
          </p>
          <p className="muted" style={{ fontSize: 11.5, margin: '0 0 6px' }}>
            読み：{c.reading || '未設定'} ／ 出どころ：{CANDIDATE_TRIGGERS[c.addedFrom?.trigger] || '不明'}
          </p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => decide(c.id, true)}>
              {c.action === 'delete' ? '削除する' : '追加する'}
            </button>
            <button type="button" className="btn" onClick={() => decide(c.id, false)}>
              {c.action === 'delete' ? '削除しない' : '追加しない'}
            </button>
          </div>
        </Card>
      ))}

      {history.length > 0 && (
        <>
          <div className="toc-head">これまでの確定</div>
          <Card className="tight">
            {history.map((h) => (
              <p key={h.id} className="muted" style={{ fontSize: 12, margin: '2px 0' }}>
                {h.result === 'added' ? '追加' : h.result === 'removed' ? '削除' : h.result === 'undone' ? '取り消し' : h.result === 'blocked' ? '止めた' : '見送り'}
                ：{h.title}
              </p>
            ))}
            <button
              type="button"
              className="btn ghost block"
              style={{ marginTop: 8 }}
              onClick={async () => {
                const undone = await store.undoTocAdditions(1);
                setNote(undone.length ? '直近の追加を1件取り消しました。' : '取り消せる追加がありません。');
              }}
            >
              直近の追加を1件取り消す
            </button>
          </Card>
        </>
      )}
    </>
  );
}

/** 役職 × ジャンル の一覧。1つの組に3席まで登録できることが一目で分かるようにする。 */
function OrgIndex({ store, go }) {
  const [roleId, setRoleId] = useState('researcher');
  const genres = allGenres(store.genres);
  const seatsPerGenre = store.company?.seatsPerGenre || 3;
  const role = ROLES.find((r) => r.id === roleId);

  return (
    <>
      <Card glyph="▦" title="役職 × ジャンル">
        <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
          1つの組（役職 × ジャンル）につき<strong style={{ color: '#fff' }}>3席</strong>まで登録できます。
          同じ役職でも分野が違えば別の3人を雇えます。
        </p>
        {ROLE_GROUPS.map((g) => (
          <div key={g.id} style={{ marginBottom: 10 }}>
            <div className="muted" style={{ marginBottom: 4 }}>{g.name}｜{g.desc}</div>
            <div className="chips">
              {rolesOfGroup(g.id).map((r) => {
                const n = store.activeEmployees.filter((e) => e.roleId === r.id).length;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`chip ${roleId === r.id ? 'on' : ''}`}
                    onClick={() => setRoleId(r.id)}
                  >
                    {r.glyph} {r.name}
                    {n > 0 ? ` ${n}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      <div className="toc-head">
        {role?.glyph} {role?.name}
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{role?.summary}</span>
      </div>

      {genres.map((g) => {
        const seats = seatsOf(store.employees, roleId, g.id);
        const free = Math.max(0, seatsPerGenre - seats.length);
        return (
          <div key={g.id} className="genre-block">
            <div className="genre-head">
              <span className="rune">{g.glyph}</span>
              <span className="n">{g.name}</span>
              <span className="muted" style={{ fontSize: 11 }}>{g.reading}</span>
              <span style={{ flex: 1 }} />
              <span className="badge">{seats.length} / {seatsPerGenre}席</span>
            </div>
            {g.desc && <div className="muted" style={{ margin: '2px 0 6px' }}>{g.desc}</div>}

            <div className="seat-grid">
              {Array.from({ length: Math.max(seatsPerGenre, seats.length) }).map((_, i) => {
                const emp = seats[i];
                if (emp) {
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      className="seat filled"
                      onClick={() => go('employee', emp.id)}
                    >
                      <Portrait employee={emp} size={40} frame={false} />
                      <span className="sn">{emp.shortName}</span>
                      <span className="ss">{emp.strength || `${i + 1}席`}</span>
                    </button>
                  );
                }
                return (
                  <button
                    key={`empty-${i}`}
                    type="button"
                    className="seat empty"
                    onClick={async () => {
                      const e = await store.hireIntoRole(roleId, g.id);
                      if (e) go('employee', e.id);
                    }}
                  >
                    <span className="sg">＋</span>
                    <span className="sn">空き席</span>
                    <span className="ss">雇う</span>
                  </button>
                );
              })}
            </div>
            {free === 0 && seats.length >= seatsPerGenre && (
              <button
                type="button"
                className="btn ghost small"
                onClick={async () => {
                  const e = await store.hireIntoRole(roleId, g.id);
                  if (e) go('employee', e.id);
                }}
              >
                ＋ この組の席を増やす（4席目以降）
              </button>
            )}
          </div>
        );
      })}

      <button type="button" className="btn block" onClick={() => go('genre')} style={{ marginTop: 12 }}>
        ＋ ジャンルを足す
      </button>
    </>
  );
}
