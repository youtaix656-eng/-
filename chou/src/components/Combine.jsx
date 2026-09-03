import React, { useMemo, useState } from 'react';
import {
  SPEED_CLASSES,
  SPEED_NAMED,
  SPEED_BASIS_LABELS,
  BAD_PAIRS,
  OLIVE_OIL_TIP,
  MEAL_GAP_NOTE,
  LIGHT_MORNING_NOTE,
  THREE_CAUSES,
  ADAMSKI_UNVERIFIED,
  ADAMSKI_PRECHECKS,
  ADAMSKI_PRECHECK_WARNING,
  ADAMSKI_PARTIAL_OK,
  ADAMSKI_SOURCE,
} from '../data/adamski.js';
import { checkCombination, checkDay, mealGaps, morningCheck, findSpeedIn, speedLabel } from '../lib/combine.js';
import { conflictFoods, CONFLICT_NOTE } from '../lib/conflicts.js';
import { emptyDay } from '../lib/days.js';
import { todayKey } from '../lib/dates.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 食べ合わせ（アダムスキー式）。
//
// **この画面でいちばん大事なのは「決めつけないこと」。**
//  - アプリは「詰まっています」「毒素が出ています」と言わない。出すのは
//    「この考え方では、速いものと遅いものが一緒になっています」までにする。
//  - 低FODMAP と反対になる食べものは、**両方の言い分を並べる**（どちらが正しいか決めない）。
//  - 裏が取れていない主張は隠さず出したうえで、必ず「確かめられていない」と添える。
//  - 守れた回数を数えない（出典自身が「できる範囲で」と言っている）。

function SpeedTag({ speed }) {
  return <span className={`tag sp-${speed || 'unknown'}`}>{speedLabel(speed)}</span>;
}

function Result({ result }) {
  if (!result.items.length) {
    return <p className="muted small">食べものを読み取れませんでした（「、」で区切ると拾いやすくなります）。</p>;
  }
  return (
    <>
      <ul className="speed-list">
        {result.items.map((item) => (
          <li key={item.name}>
            <span className="food-name">{item.name}</span>
            <SpeedTag speed={item.speed} />
            {/* 出典に無いものは、札と同じ文が二度出ないように出どころを省く */}
            {item.basis !== 'unknown' && (
              <span className="muted small">{SPEED_BASIS_LABELS[item.basis]}</span>
            )}
          </li>
        ))}
      </ul>
      <p>
        {result.mixed ? (
          <>
            この考え方では、<strong>速いものと遅いものが一緒になっています</strong>。
            合わない組み合わせとして挙げられている形です。
          </>
        ) : (
          <>この考え方では、速いものと遅いものが一緒にはなっていません。</>
        )}
      </p>
      {result.hasNeutral && (
        <p className="muted small">
          ニュートラルのものが入っています（出典では「消化を助ける」とされています。※要確認）。
        </p>
      )}
      {result.unknown.length > 0 && (
        <p className="muted small">出典に出てこないもの：{result.unknown.join('、')}</p>
      )}
      {result.guessed > 0 && (
        <p className="muted small">
          このうち{result.guessed}件は、出典で名前が挙がっているのではなく区分から当てはめたものです。
        </p>
      )}
      <p className="muted small">
        これは判定ではありません。合うかどうかは、しばらく試して自分の記録で見つけてください。
      </p>
    </>
  );
}

export default function Combine({ store, focus, onFocusDone, onGo }) {
  useFocusJump(focus, onFocusDone);
  const [text, setText] = useState('');
  const today = todayKey();
  const day = store.days[today] || emptyDay(today);

  const typed = useMemo(() => (text.trim() ? checkCombination(findSpeedIn(text).map((h) => h.name)) : null), [text]);
  const meals = useMemo(() => checkDay(day), [day]);
  const gaps = useMemo(() => mealGaps(day), [day]);
  const morning = useMemo(() => morningCheck(day), [day]);
  const conflicts = useMemo(() => conflictFoods(), []);
  const checked = store.settings.adamskiChecks || [];

  const toggleCheck = (id) => {
    const next = checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id];
    store.setSettings({ adamskiChecks: next });
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>食べ合わせ</h1>
        <p className="muted">
          「消化の速いもの」と「遅いもの」を一緒に食べない、という考え方です。
        </p>
      </header>

      {checked.length > 0 && (
        <div className="notice" id="combine-precheck-warning">
          <p>
            <strong>{ADAMSKI_PRECHECK_WARNING.replace(/\*\*/g, '')}</strong>
          </p>
        </div>
      )}

      <div className="notice">
        <p>{ADAMSKI_PARTIAL_OK}</p>
      </div>

      <section className="block" id="combine-check">
        <div className="block-head">
          <h2>組み合わせを見る</h2>
        </div>
        <label className="search">
          <span className="sr-only">食べたもの（「、」で区切る）</span>
          <input
            type="text"
            value={text}
            placeholder="トマト、パスタ"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {typed && <Result result={typed} />}
      </section>

      <section className="block" id="combine-today">
        <div className="block-head">
          <h2>きょうの記録から</h2>
        </div>
        {meals.length === 0 ? (
          <p className="muted">きょうのたべものの記録がまだありません。</p>
        ) : (
          meals.map((meal) => (
            <div key={meal.id} className="meal-block">
              <p>
                <span className="meal-at">{meal.at || '—'}</span> {meal.text}
              </p>
              <Result result={meal.result} />
            </div>
          ))
        )}
      </section>

      <section className="block" id="combine-gap">
        <div className="block-head">
          <h2>食事の間隔</h2>
        </div>
        {gaps.gaps.length === 0 ? (
          <p className="muted">時刻の入った食事が2件以上あると、間隔が出ます。</p>
        ) : (
          <ul className="plain">
            {gaps.gaps.map((g) => (
              <li key={`${g.from}-${g.to}`}>
                {g.from} → {g.to}：{Math.floor(g.minutes / 60)}時間{g.minutes % 60}分
                {g.reachesGuide ? '（目安の4時間以上）' : ''}
              </li>
            ))}
          </ul>
        )}
        {gaps.skipped > 0 && (
          <p className="muted small">時刻の入っていない記録が{gaps.skipped}件あり、間隔に数えていません。</p>
        )}
        <p className="muted small">{MEAL_GAP_NOTE}</p>
        {morning.known && (
          <p className="muted small">
            きょう最初の食事（{morning.at}）は
            {morning.lightOnly ? '速いものだけでした。' : '遅いものが入っていました。'}
            {LIGHT_MORNING_NOTE}
          </p>
        )}
      </section>

      <section className="block" id="combine-olive">
        <div className="block-head">
          <h2>{OLIVE_OIL_TIP.title}</h2>
        </div>
        <p>{OLIVE_OIL_TIP.body}</p>
        <div className="notice">
          <p>{OLIVE_OIL_TIP.caution}</p>
        </div>
      </section>

      <section className="block" id="combine-badpairs">
        <div className="block-head">
          <h2>よくない組み合わせとして挙げられているもの</h2>
        </div>
        <ul className="flags">
          {BAD_PAIRS.map((pair) => (
            <li key={pair.id} id={`badpair-${pair.id}`}>
              <strong>{pair.title}</strong>
              <span className="muted small">
                速い：{pair.fast}／遅い：{pair.slow}
              </span>
              <span className="muted small">{pair.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="combine-speeds">
        <div className="block-head">
          <h2>出典で名前が挙がっている食べもの</h2>
          <span className="muted small">{SPEED_NAMED.length}件</span>
        </div>
        {SPEED_CLASSES.map((cls) => (
          <div key={cls.id}>
            <p>
              <strong>{cls.label}</strong>
              <span className="muted small">　{cls.note}</span>
            </p>
            <p className="chips">
              {SPEED_NAMED.filter((f) => f.speed === cls.id).map((f) => (
                <span key={f.name} className="chip small">
                  {f.name}
                </span>
              ))}
            </p>
          </div>
        ))}
        <p className="muted small">
          ここに無いものは、出典の「くだものはほぼ全て速い」「速いもの以外はほぼ全て遅い」から
          当てはめています。当てはめたものは、上の結果に必ずそう書いています。
        </p>
      </section>

      <section className="block" id="combine-conflicts">
        <div className="block-head">
          <h2>低FODMAP と言っていることが反対になるもの</h2>
          <span className="muted small">{conflicts.length}件</span>
        </div>
        <ul className="flags">
          {conflicts.map((c) => (
            <li key={c.name} id={`conflict-${c.reading}`}>
              <strong>{c.name}</strong>
              {c.lines.map((line) => (
                <span key={line} className="muted small">
                  {line}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <div className="notice">
          <p>{CONFLICT_NOTE}</p>
        </div>
        <button type="button" className="ghost" onClick={() => onGo('fodmap')}>
          低FODMAP の一覧を見る
        </button>
      </section>

      <section className="block" id="combine-causes">
        <div className="block-head">
          <h2>消化管が働きにくくなる原因として挙げられている3つ</h2>
        </div>
        <ul className="plain">
          {THREE_CAUSES.map((c) => (
            <li key={c.id}>{c.label}</li>
          ))}
        </ul>
        <p className="muted small">
          ストレスと体を動かしたかは「きょう」の画面で記録できます。
          運動が腸の動きに関わるという話はよく言われますが、時間の数字は確かめられていません。
        </p>
        <button type="button" className="ghost" onClick={() => onGo('home', 'rec-life')}>
          きょうの記録へ
        </button>
      </section>

      <section className="block" id="combine-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる話のうち、確かめきれていないものです。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {ADAMSKI_UNVERIFIED.map((item) => (
            <li key={item.id} id={`unverified-${item.id}`}>
              <strong>{item.claim}</strong>
              <span className="muted small">{item.note}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="combine-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">
          当てはまるものがあれば、食事の間隔を空ける・朝を軽くする・油をとる のどれも
          先に相談してください。印は端末の中だけに残ります。
        </p>
        {ADAMSKI_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="combine-source">
        出典：{ADAMSKI_SOURCE.text}
        {ADAMSKI_SOURCE.check && ' ※要確認'}
        <br />
        最終確認：{ADAMSKI_SOURCE.checkedOn}
      </p>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
