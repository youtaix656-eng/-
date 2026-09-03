import React, { useMemo } from 'react';
import Gut, { gutLine } from './Gut.jsx';
import DayEditor from './DayEditor.jsx';
import { emptyDay, hasRecord } from '../lib/days.js';
import { lastKeys, todayKey, formatKey } from '../lib/dates.js';
import { recordedTotal, fillOf, foodSuggestions } from '../lib/stats.js';
import {
  probioticHome,
  PROBIOTIC_HOME_NOTE,
  GUT_CARE_TOPICS,
  GUT_CARE_NOTE,
} from '../lib/homeTopics.js';
import { missingDays, gapLine, GAP_NOTE } from '../lib/gaps.js';
import { nextVisit, visitLine, openQuestions, NO_REMINDER_NOTE } from '../lib/visits.js';
import { openPeriods, KIND_BY_ID, periodLength } from '../lib/periods.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

export default function Home({ store, onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const today = todayKey();
  const day = store.days[today] || emptyDay(today);
  const recordedToday = hasRecord(day);

  const total = useMemo(() => recordedTotal(store.days), [store.days]);
  const fill = useMemo(() => fillOf(store.days, lastKeys(14, today)), [store.days, today]);
  const suggestions = useMemo(() => foodSuggestions(store.days, 8), [store.days]);
  // **中身は元データから毎回導く**（ホーム専用の手書きの一覧を持たない）
  const probiotic = useMemo(
    () => probioticHome(store.probiotic, store.days, today),
    [store.probiotic, store.days, today],
  );
  // 抜けている日（提案2）。**責める言い方をしない**——出すのは空いている日まで
  const missing = useMemo(() => missingDays(store.days, 14, today), [store.days, today]);
  // つぎの通院（提案14）。**鳴らさない**——表示するだけ
  const visit = useMemo(() => nextVisit(store.visits, today), [store.visits, today]);
  const open = useMemo(() => openQuestions(visit), [visit]);
  // いま続いている「いつもと違う期間」の印（提案6）
  const running = useMemo(() => openPeriods(store.periods), [store.periods]);

  return (
    <div className="view">
      <header className="view-head">
        <h1>きょう</h1>
        <p className="muted">{formatKey(today)}</p>
      </header>

      <section className="gut-card" id="gut-character">
        <Gut mood={recordedToday ? day.belly : null} />
        <p className="gut-line">{gutLine(day.belly, { recordedToday })}</p>
      </section>

      <DayEditor
        date={today}
        day={day}
        store={store}
        suggestions={suggestions}
        onOpenRedFlags={() => onGo('redflags')}
        onOpenCombine={() => onGo('combine')}
      />

      <section className="block" id="home-probiotic">
        <div className="block-head">
          <h2>整腸剤</h2>
        </div>
        <p>{probiotic.line}</p>
        {probiotic.registered && (
          <p className="muted small">
            登録しているもの：{probiotic.name}
            {probiotic.takenToday ? '（きょうは飲んだ印が付いています）' : '（きょうの印はまだです）'}
          </p>
        )}
        <p className="muted small">{probiotic.trialNote.replace(/\*\*/g, '')}</p>
        <ul className="flags" id="home-probiotic-counts">
          <li>
            <strong>収録されている整腸剤の情報</strong>
            <span className="muted small">菌の種類 {probiotic.counts.bacteria}／出典が挙げるもの {probiotic.counts.products}</span>
            <span className="muted small">
              そのままにできないところ {probiotic.counts.corrections}／裏が取れていない主張 {probiotic.counts.unverified}
            </span>
            <span className="muted small">
              よくある質問 {probiotic.counts.faq}／はじめる前に {probiotic.counts.prechecks}
            </span>
          </li>
        </ul>
        <p>{PROBIOTIC_HOME_NOTE}</p>
        <p className="muted small">{probiotic.otcNote.replace(/\*\*/g, '')}</p>
        <button type="button" className="ghost" onClick={() => onGo('probiotics', 'probiotic-mine')}>
          整腸剤の画面をひらく
        </button>
        <button type="button" className="ghost" onClick={() => onGo('otc', 'otc-kinds')}>
          市販薬の画面で読む
        </button>
        <p className="muted small" id="home-probiotic-source">
          出典：{probiotic.source.text}
          {probiotic.source.check && ' ※要確認'}
        </p>
      </section>

      <section className="block" id="home-gutcare">
        <div className="block-head">
          <h2>あなたに向いた腸活</h2>
        </div>
        <p className="muted small">{GUT_CARE_NOTE}</p>
        {GUT_CARE_TOPICS.map((topic) => (
          <div key={topic.id} className="cand" id={`home-${topic.id}`}>
            <div className="cand-head">
              <strong>{topic.title}</strong>
            </div>
            <p className="muted small">{topic.lead}</p>
            <ul className="flags">
              {topic.rows().map((row) => (
                <li key={row.id} id={`home-${topic.id}-${row.id}`}>
                  <strong>{row.title}</strong>
                  {row.lines.map((line) => (
                    <span key={line} className="muted small">
                      {line}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <p>{topic.note.replace(/\*\*/g, '')}</p>
            <button
              type="button"
              className="ghost"
              onClick={() => onGo(topic.view, topic.targetId)}
            >
              {topic.label}
            </button>
            <p className="muted small" id={`home-${topic.id}-source`}>
              出典：{topic.source().text}
              {topic.source().check && ' ※要確認'}
            </p>
          </div>
        ))}
      </section>

      <section className="block" id="rec-total">
        <div className="block-head">
          <h2>これまで</h2>
        </div>
        <p>
          記録した日 <strong>{total}日</strong>
        </p>
        <div className="fill-row" aria-label={`この2週間で記録した日 ${fill.done}日 / ${fill.total}日`}>
          {fill.marks.map((on, i) => (
            <span key={lastKeys(14, today)[i]} className={`fill-dot${on ? ' on' : ''}`} />
          ))}
        </div>
        <p className="muted small">
          この2週間で {fill.done} / {fill.total}日。
          連続日数は数えていません——お腹の調子は自分で決められるものではないので、
          途切れた日が「怠けた日」に見えないようにしています。
        </p>
      </section>

      {visit && (
        <section className="block" id="home-visit">
          <div className="block-head">
            <h2>つぎの通院</h2>
          </div>
          <p>
            {visitLine(visit, today)}
            {visit.place ? `（${visit.place}）` : ''}
          </p>
          {open.length > 0 && (
            <p className="muted small">まだ聞けていないこと {open.length}件。受診メモに一緒に出せます。</p>
          )}
          <button type="button" className="ghost" onClick={() => onGo('visits', `visit-${visit.id}`)}>
            通院の画面をひらく
          </button>
          <p className="muted small">{NO_REMINDER_NOTE}</p>
        </section>
      )}

      {running.length > 0 && (
        <section className="block" id="home-period">
          <div className="block-head">
            <h2>いま印をつけている期間</h2>
          </div>
          <ul className="flags">
            {running.map((p) => (
              <li key={p.id}>
                <strong>{(KIND_BY_ID[p.kind] || {}).label || p.kind}</strong>
                <span className="muted small">
                  {p.from} から（{periodLength(p, today)}日目）{p.note ? `／${p.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="ghost" onClick={() => onGo('periods')}>
            期間の印を見る
          </button>
        </section>
      )}

      <section className="block" id="home-gaps">
        <div className="block-head">
          <h2>空いている日</h2>
        </div>
        <p>{gapLine(missing, 14)}</p>
        {missing.length > 0 && (
          <div className="suggest">
            {missing.slice(0, 7).map((key) => (
              <button key={key} type="button" className="chip small" onClick={() => onGo('calendar', '', key)}>
                {formatKey(key, { withYear: false })}
              </button>
            ))}
          </div>
        )}
        <p className="muted small">{GAP_NOTE}</p>
      </section>

      <RedFlagLink onGo={onGo} />
    </div>
  );
}
