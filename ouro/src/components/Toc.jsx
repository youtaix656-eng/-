// 目次（索引）。会社にあるものを読みで引く。
//
// リポジトリ共通の目次ルールに従う：
//   あ〜ん → A〜Z の順／数字は読みで振り分け／読みは明示（推定しない）／
//   タイトルは重複させない／文字は大きめ・タップで飛ぶ。

import { useMemo, useRef, useState } from 'react';
import { Card, Empty } from './ui.jsx';
import { buildToc, filterToc, tocSections, kindCounts, TOC_KINDS } from '../data/toc.js';
import { BUCKETS, UNKNOWN_BUCKET } from '../lib/yomi.js';
import { ROLES } from '../data/roles.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';
import { seatsOf } from '../lib/seed.js';

export default function Toc({ store, go }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState(null);
  const [view, setView] = useState('org'); // 'org' = 役職×ジャンルの一覧 / 'kana' = 読み引き
  const sectionRefs = useRef({});

  const entries = useMemo(
    () => buildToc({ employees: store.employees, customGenres: store.genres }),
    [store.employees, store.genres]
  );
  const filtered = useMemo(() => filterToc(entries, { query, kind }), [entries, query, kind]);
  const sections = useMemo(() => tocSections(filtered), [filtered]);
  const counts = useMemo(() => kindCounts(entries), [entries]);
  const present = new Set(sections.map((s) => s.bucket));

  const jump = (bucket) => {
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
                    <span className="g">{TOC_KINDS.find((k) => k.id === it.kind)?.glyph || '◉'}</span>
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
        <div className="chips">
          {ROLES.map((r) => {
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
                      <span className="sg">{emp.avatar}</span>
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
                    onClick={() => {
                      const e = store.hireIntoRole(roleId, g.id);
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
                onClick={() => {
                  const e = store.hireIntoRole(roleId, g.id);
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
