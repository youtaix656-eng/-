// 目次（索引）。会社にあるものを読みで引く。
//
// リポジトリ共通の目次ルールに従う：
//   あ〜ん → A〜Z の順／数字は読みで振り分け／読みは明示（推定しない）／
//   タイトルは重複させない／文字は大きめ・タップで飛ぶ。

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Empty } from './ui.jsx';
import { buildToc, filterToc, tocSections, kindCounts, TOC_KINDS } from '../data/toc.js';
import { BUCKETS, UNKNOWN_BUCKET } from '../lib/yomi.js';
import { ROLES, ROLE_GROUPS, rolesOfGroup } from '../data/roles.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';
import { seatsOf } from '../lib/seats.js';
import Portrait from './Portrait.jsx';

export default function Toc({ store, go }) {
  const [query, setQuery] = useState('');
  // 項目15：1文字ごとに全件を絞り込むと入力が引っかかる（実測80ms）。
  // 入力そのものは即座に反映し、絞り込みは1拍遅らせる。
  const deferredQuery = useDeferredValue(query);
  const [kind, setKind] = useState(null);
  const [limit, setLimit] = useState(120); // 項目19：多い時は段階的に出す
  const [view, setView] = useState('org'); // 'org' = 役職×ジャンルの一覧 / 'kana' = 読み引き
  const sectionRefs = useRef({});

  const entries = useMemo(
    () => buildToc({ employees: store.employees, customGenres: store.genres }),
    [store.employees, store.genres]
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
    <div className="screen fade-in">
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip ${view === 'org' ? 'on' : ''}`} onClick={() => setView('org')}>
          役職 × ジャンル
        </button>
        <button type="button" className={`chip ${view === 'kana' ? 'on' : ''}`} onClick={() => setView('kana')}>
          あ〜ん で引く
        </button>
      </div>

      {view === 'org' ? (
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
            <button type="button" className={`chip ${!kind ? 'on' : ''}`} onClick={() => setKind(null)}>
              すべて {entries.length}
            </button>
            {counts.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`chip ${kind === k.id ? 'on' : ''}`}
                onClick={() => setKind(kind === k.id ? null : k.id)}
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
                    type="button"
                    className="toc-row"
                    onClick={() => go(it.view, it.arg)}
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
              onClick={() => setLimit((n) => n + 200)}
              style={{ marginTop: 10 }}
            >
              もっと見る（残り{filtered.length - shown.length}件）
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** 役職 × ジャンル の一覧。1つの組に3席まで登録できることが一目で分かるようにする。 */
function OrgIndex({ store, go }) {
  const [roleId, setRoleId] = useState('researcher');
  const genres = allGenres(store.genres);
  const seatsPerGenre = store.company?.seatsPerRole || 3;
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
