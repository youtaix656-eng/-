import React, { useMemo, useState } from 'react';
import { PLACES, PLACE_MAP, countByTactic, countByPlace } from '../lib/records.js';
import { matchesLoose } from '../lib/personSearch.js';
import Finder from './Finder.jsx';
import { TACTIC_MAP } from '../data/tactics.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

function when(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 一度に描く件数。**全部を1枚に描かない**（120件で35,000pxになっていた） */
const PAGE = 30;

export default function Records({ records, onRemove, onGoCheck, onGoTactic }) {
  // **消すときは必ず確認を出す**（見立て・全消しと同じ扱い。押した瞬間には消さない）
  const [confirmId, setConfirmId] = useState('');
  const [query, setQuery] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [sort, setSort] = useState('new');
  const [limit, setLimit] = useState(PAGE);
  const byTactic = countByTactic(records);
  const byPlace = countByPlace(records);

  const shown = useMemo(() => {
    let list = records;
    if (placeId) list = list.filter((r) => r.placeId === placeId);
    if (query.trim()) {
      list = list.filter((r) =>
        matchesLoose(
          [r.text, r.note, PLACE_MAP[r.placeId]?.label, ...(r.tacticIds || []).map((id) => TACTIC_MAP[id]?.name || '')].join(' '),
          query,
        ),
      );
    }
    if (sort === 'old') return [...list].sort((a, b) => a.at - b.at);
    return list; // 既定は新しい順（呼び出し元が並べたものをそのまま使う）
  }, [records, query, placeId, sort]);

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>記録</h1>
        <p>{records.length}件。すべてこの端末の中だけにあります。</p>
      </div>
      <Rule mark={GLYPHS.reference} />

      {records.length === 0 ? (
        <div className="card quiet">
          <p>まだ記録はありません。</p>
          <p className="muted">
            「貼って調べる」で調べたあと、記録に残せます。争うためではなく、
            あとから自分が「あれは気のせいだったか」と迷わないための控えです。
          </p>
          <div className="row end">
            <button className="primary" onClick={onGoCheck}>
              貼って調べる
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="note">
            残しているのは<strong>いつ・どこで・どの言い回しに当たったか</strong>だけです。
            相手の名前・連絡先は持ちません。回数は「その相手がどういう人か」の判定ではありません。
          </div>

          {byTactic.length > 0 && (
            <div className="card">
              <h3>よく当たっている型</h3>
              <ul className="tiny">
                {byTactic.slice(0, 5).map((c) => (
                  <li key={c.tacticId}>
                    <button className="chip" onClick={() => onGoTactic && onGoTactic(c.tacticId)}>
                      {TACTIC_MAP[c.tacticId]?.name || c.tacticId}
                    </button>{' '}
                    — {c.count}回
                  </li>
                ))}
              </ul>
              {byTactic.length > 5 && (
                <p className="tiny">ほか{byTactic.length - 5}件の型にも当たっています。</p>
              )}
              {byPlace.length > 0 && (
                <p className="tiny">
                  場面：{byPlace.map((p) => `${p.place.label} ${p.count}件`).join(' / ')}
                </p>
              )}
            </div>
          )}

          <Finder
            label="記録をさがす"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setLimit(PAGE);
            }}
            total={records.length}
            shown={shown.length}
            hint="本文・場面・型の名前で引けます。"
          />

          <div className="chips">
            <button className={`chip ${placeId === '' ? 'on' : ''}`} onClick={() => setPlaceId('')}>
              場面で絞らない
            </button>
            {PLACES.filter((pl) => records.some((r) => r.placeId === pl.id)).map((pl) => (
              <button
                key={pl.id}
                className={`chip ${placeId === pl.id ? 'on' : ''}`}
                onClick={() => setPlaceId(placeId === pl.id ? '' : pl.id)}
              >
                {pl.icon} {pl.label}
              </button>
            ))}
          </div>
          <div className="chips">
            {[
              ['new', '新しい順'],
              ['old', '古い順'],
            ].map(([id, lbl]) => (
              <button key={id} className={`chip ${sort === id ? 'on' : ''}`} onClick={() => setSort(id)}>
                {lbl}
              </button>
            ))}
          </div>

          {shown.slice(0, limit).map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="tiny">
                  {when(r.at)}・{PLACE_MAP[r.placeId]?.icon} {PLACE_MAP[r.placeId]?.label}
                </span>
                {r.masked && <span className="badge">伏せて保存</span>}
              </div>
              <div className="excerpt" style={{ marginTop: 8 }}>
                {r.text}
              </div>
              {r.truncated && (
                <p className="tiny">
                  {GLYPHS.reference} 長かったので、本文は先頭だけ残しています。
                </p>
              )}
              {r.tacticIds.length > 0 && (
                <div className="chips">
                  {r.tacticIds.map((id) => (
                    <button className="chip" key={id} onClick={() => onGoTactic && onGoTactic(id)}>
                      {TACTIC_MAP[id]?.name || id}
                    </button>
                  ))}
                </div>
              )}
              {r.note && <p className="muted">{r.note}</p>}
              <div className="row end">
                {confirmId === r.id ? (
                  <>
                    <span className="tiny">元に戻せません。</span>
                    <button className="ghost" onClick={() => setConfirmId('')}>
                      やめる
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        onRemove(r.id);
                        setConfirmId('');
                      }}
                    >
                      消す
                    </button>
                  </>
                ) : (
                  <button className="danger ghost" onClick={() => setConfirmId(r.id)}>
                    この記録を消す
                  </button>
                )}
              </div>
            </div>
          ))}

          {shown.length > limit && (
            <div className="row end">
              <button className="ghost" onClick={() => setLimit(limit + PAGE)}>
                もっと見る（残り{shown.length - limit}件）
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
