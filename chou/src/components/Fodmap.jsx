import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  FODMAP_FOODS,
  FODMAP_LEVELS,
  FODMAP_CATEGORIES,
  FODMAP_NOTES,
  FODMAP_SOURCE,
  FOOD_RESULTS,
} from '../data/fodmap.js';
import { foodTargetId, tabForTarget } from '../data/toc.js';
import { useFocusJump } from './useFocusJump.js';

// 低FODMAP の食材一覧。
// **合う／合わないを機械が決めない**——結果を押すのは本人（fodmap.js の決めごと4）。

export default function Fodmap({ store, focus, onFocusDone }) {
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('all');

  // **飛ぶ前に絞り込みを解く。** 絞り込みが掛かったままだと飛び先が画面に無くて掴めない。
  // `useEffect` にすると、掴みに行く時（次のフレーム）にはまだ古い絞り込みで描かれている。
  useLayoutEffect(() => {
    if (!focus) return;
    const want = tabForTarget(focus);
    if (want.level && want.level !== level) setLevel(want.level);
    if (want.query !== undefined && want.query !== q) setQ(want.query);
    // level/q は「合わせにいく先」なので、focus が変わった時だけ走らせる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useFocusJump(focus, onFocusDone);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return FODMAP_FOODS.filter((food) => {
      if (level !== 'all' && food.level !== level) return false;
      if (!needle) return true;
      return (
        food.name.toLowerCase().includes(needle) ||
        food.reading.includes(needle) ||
        (food.note || '').includes(needle)
      );
    });
  }, [q, level]);

  const byCategory = useMemo(
    () =>
      FODMAP_CATEGORIES.map((cat) => ({
        cat,
        foods: shown.filter((f) => f.category === cat.id),
      })).filter((g) => g.foods.length),
    [shown],
  );

  return (
    <div className="view">
      <header className="view-head">
        <h1>低FODMAP の食材</h1>
      </header>

      <div className="notice" id="fodmap-notes">
        {FODMAP_NOTES.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>

      <label className="search">
        <span className="sr-only">食材をさがす</span>
        <input
          type="search"
          value={q}
          placeholder="食材をさがす（ひらがなでも）"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <div className="seg" role="group" aria-label="しぼりこみ">
        <button
          type="button"
          className={`chip${level === 'all' ? ' on' : ''}`}
          aria-pressed={level === 'all'}
          onClick={() => setLevel('all')}
        >
          ぜんぶ
        </button>
        {FODMAP_LEVELS.map((lv) => (
          <button
            key={lv.id}
            type="button"
            className={`chip${level === lv.id ? ' on' : ''}`}
            aria-pressed={level === lv.id}
            onClick={() => setLevel(lv.id)}
          >
            {lv.label}
          </button>
        ))}
      </div>

      <p className="muted small">
        {shown.length}件（全{FODMAP_FOODS.length}件）
        {q && shown.length === 0 && ' — 見つかりませんでした。一覧に無いものも多くあります。'}
      </p>

      {byCategory.map(({ cat, foods }) => (
        <section key={cat.id} className="block">
          <div className="block-head">
            <h2>{cat.label}</h2>
          </div>
          <ul className="foods">
            {foods.map((food) => {
              const result = store.foodResults[food.name] || null;
              return (
                <li key={food.name} id={foodTargetId(food)}>
                  <div className="food-head">
                    <span className="food-name">{food.name}</span>
                    <span className={`tag lv-${food.level}`}>
                      {FODMAP_LEVELS.find((l) => l.id === food.level).label}
                    </span>
                  </div>
                  {food.note && <p className="muted small">{food.note}</p>}
                  <div className="food-results">
                    <span className="muted small">自分のからだでは：</span>
                    {FOOD_RESULTS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`chip small${result === r.id ? ' on' : ''}`}
                        aria-pressed={result === r.id}
                        onClick={() => store.setFoodResult(food.name, r.id)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="muted small" id="fodmap-source">
        出典：{FODMAP_SOURCE.text}
        {FODMAP_SOURCE.check && ' ※要確認'}
        <br />
        最終確認：{FODMAP_SOURCE.checkedOn}
      </p>
    </div>
  );
}
