import React, { useMemo, useState } from 'react';
import { BELLY_STEPS, BRISTOL, BRISTOL_GROUPS, STOOL_MARKS } from '../data/scales.js';
import { lastKeys, todayKey, formatShort } from '../lib/dates.js';
import { perDayText } from '../lib/visitNote.js';
import {
  fillOf,
  series,
  bristolCounts,
  stoolPerDay,
  markDays,
  topFoods,
  hardBellyDays,
  MIN_FOOD_DAYS,
} from '../lib/stats.js';

// ふりかえり。**この画面がいちばん壊しやすい。**
// 「たまねぎ → 腹痛」と矢印で結んだ瞬間に、根拠のない食事指導になる。
// 並べるところまでで止めて、結ぶのは本人に任せる（README 決まり3、stats.js の決めごと2）。

const RANGES = [
  { days: 14, label: '2週間' },
  { days: 30, label: '1か月' },
  { days: 90, label: '3か月' },
];

/** お腹の段の並び。線でつながず点で置く（記録の無い日を「なめらかに補う」と嘘になる） */
function BellyChart({ rows }) {
  const w = 300;
  const h = 96;
  const stepX = rows.length > 1 ? (w - 24) / (rows.length - 1) : 0;
  const y = (order) => 12 + ((order - 1) / 4) * (h - 30);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="お腹の調子の並び">
      {[1, 3, 5].map((order) => (
        <line key={order} x1="12" x2={w - 12} y1={y(order)} y2={y(order)} className="grid" />
      ))}
      {rows.map((row, i) =>
        row.bellyOrder ? (
          <circle key={row.key} cx={12 + i * stepX} cy={y(row.bellyOrder)} r="3.2" className="dot" />
        ) : null,
      )}
    </svg>
  );
}

/** ブリストルの並び（その日に出た回ぶんの点） */
function StoolChart({ rows }) {
  const w = 300;
  const h = 96;
  const stepX = rows.length > 1 ? (w - 24) / (rows.length - 1) : 0;
  const y = (n) => 12 + ((n - 1) / 6) * (h - 30);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="便のかたさの並び">
      {[1, 4, 7].map((n) => (
        <line key={n} x1="12" x2={w - 12} y1={y(n)} y2={y(n)} className="grid" />
      ))}
      {rows.map((row, i) =>
        row.stools.map((n, j) => (
          <rect
            key={`${row.key}-${j}`}
            x={12 + i * stepX - 1.6}
            y={y(n) - 1.6}
            width="3.2"
            height="3.2"
            className="dot"
          />
        )),
      )}
    </svg>
  );
}

export default function Look({ store, onGo }) {
  const [days, setDays] = useState(14);
  const today = todayKey();
  const keys = useMemo(() => lastKeys(days, today), [days, today]);

  const fill = useMemo(() => fillOf(store.days, keys), [store.days, keys]);
  const rows = useMemo(() => series(store.days, keys), [store.days, keys]);
  const bristol = useMemo(() => bristolCounts(store.days, keys), [store.days, keys]);
  const per = useMemo(() => stoolPerDay(store.days, keys), [store.days, keys]);
  const marks = useMemo(() => markDays(store.days, keys), [store.days, keys]);
  const foods = useMemo(() => topFoods(store.days, keys, 10), [store.days, keys]);
  const hard = useMemo(() => hardBellyDays(store.days, keys), [store.days, keys]);

  const maxBristol = Math.max(1, ...Object.values(bristol.byNumber));

  return (
    <div className="view">
      <header className="view-head">
        <h1>ふりかえり</h1>
        <p className="muted">
          {formatShort(keys[0])} 〜 {formatShort(keys[keys.length - 1])}
        </p>
      </header>

      <div className="seg" role="group" aria-label="期間">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            className={`chip${days === r.days ? ' on' : ''}`}
            aria-pressed={days === r.days}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {fill.done === 0 ? (
        <section className="block">
          <p>この期間の記録はまだありません。</p>
          <button type="button" className="solid" onClick={() => onGo('home')}>
            きょうの記録へ
          </button>
        </section>
      ) : (
        <>
          <section className="block">
            <div className="block-head">
              <h2>お腹の調子</h2>
            </div>
            <div className="chart-wrap">
              <div className="chart-y">
                <span>{BELLY_STEPS[0].label}</span>
                <span>{BELLY_STEPS[4].label}</span>
              </div>
              <BellyChart rows={rows} />
            </div>
            <p className="muted small">
              つらい・とてもつらい と記録した日：{hard}日 / 記録した日 {fill.done}日
            </p>
          </section>

          <section className="block">
            <div className="block-head">
              <h2>お通じ</h2>
            </div>
            <div className="chart-wrap">
              <div className="chart-y">
                <span>1 かたい</span>
                <span>7 水のよう</span>
              </div>
              <StoolChart rows={rows} />
            </div>
            <p>
              計 {bristol.total}回
              {per && `（記録した日の中で ${perDayText(per)}）`}
            </p>
            <ul className="bars">
              {BRISTOL.map((b) => (
                <li key={b.n}>
                  <span className="bar-label">
                    {b.n} {b.label}
                  </span>
                  <span className="bar">
                    <span
                      className="bar-fill"
                      style={{ width: `${(bristol.byNumber[b.n] / maxBristol) * 100}%` }}
                    />
                  </span>
                  <span className="bar-n">{bristol.byNumber[b.n]}回</span>
                </li>
              ))}
            </ul>
            <p className="muted small">
              まとまりでは
              {BRISTOL_GROUPS.map((g) => ` ${g.range[0]}〜${g.range[1]}（${g.label}）${bristol.byGroup[g.id]}回`).join(
                ' /',
              )}
              。平均は出していません——1と7が1回ずつあった日の「平均4」は、
              ふつうの便が1回あったという意味にならないからです。
            </p>
          </section>

          <section className="block">
            <div className="block-head">
              <h2>気になった項目</h2>
            </div>
            {STOOL_MARKS.filter((m) => marks[m.id]).length === 0 ? (
              <p className="muted">この期間では、いずれも付いていません。</p>
            ) : (
              <ul className="plain">
                {STOOL_MARKS.filter((m) => marks[m.id]).map((m) => (
                  <li key={m.id}>
                    {m.label}：{marks[m.id]}日
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="block">
            <div className="block-head">
              <h2>よく食べていたもの</h2>
            </div>
            {foods.length === 0 ? (
              <p className="muted">
                {MIN_FOOD_DAYS}日以上に出てきたものがまだありません（1日だけのものは「よく」と数えていません）。
              </p>
            ) : (
              <p>{foods.map((f) => `${f.food} ${f.days}日`).join(' / ')}</p>
            )}
            <div className="notice">
              <p>
                食べたものとお腹の調子を、同じ期間で並べています。
                <strong>どちらかがどちらかの原因かは、この表からは分かりません。</strong>
                気になるものがあれば、しばらくやめて記録を続けると、自分の答えのほうが出ます。
              </p>
            </div>
          </section>

          <section className="block">
            <p className="muted small">
              この期間で記録した日 {fill.done} / {fill.total}日。
              記録の無い日は「症状が無かった日」ではなく「記録していない日」として扱っています。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
