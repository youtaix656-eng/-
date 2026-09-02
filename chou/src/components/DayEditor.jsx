import React, { useState } from 'react';
import { BELLY_STEPS, LEVELS, EXERCISE_STEPS, SLEEP_STEPS, POSTURE_STEPS, STOOL_MARKS } from '../data/scales.js';
import { nowTime } from '../lib/dates.js';
import { flagMarksOf } from '../lib/days.js';
import BristolPicker from './Bristol.jsx';

// 1日ぶんの入力。**ホームの「きょう」とカレンダーの日別の両方でこれを使う**
// （画面ごとに書くと、片方だけ直したときに必ず食い違う）。

function Choice({ label, options, value, onChange, name, id }) {
  return (
    <div className="choice" id={id}>
      <div className="choice-label" id={`lbl-${name}`}>
        {label}
      </div>
      <div className="choice-row" role="group" aria-labelledby={`lbl-${name}`}>
        {options.map((opt) => {
          const on = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`chip${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => onChange(on ? null : opt.id)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StoolRow({ stool, onChange, onRemove }) {
  const toggleMark = (id) => {
    const has = stool.marks.includes(id);
    onChange({ marks: has ? stool.marks.filter((m) => m !== id) : [...stool.marks, id] });
  };
  return (
    <div className="stool">
      <div className="stool-head">
        <label className="time-field">
          <span className="sr-only">時刻</span>
          <input
            type="time"
            value={stool.at || ''}
            onChange={(e) => onChange({ at: e.target.value })}
          />
        </label>
        <button type="button" className="ghost small" onClick={onRemove}>
          この1件を消す
        </button>
      </div>
      <BristolPicker value={stool.bristol} onChange={(n) => onChange({ bristol: n })} />
      <div className="marks">
        {STOOL_MARKS.map((mark) => (
          <label key={mark.id} className="mark">
            <input
              type="checkbox"
              checked={stool.marks.includes(mark.id)}
              onChange={() => toggleMark(mark.id)}
            />
            <span>{mark.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function DayEditor({ date, day, store, suggestions = [], onOpenRedFlags, onOpenCombine }) {
  const [mealText, setMealText] = useState('');
  const flags = flagMarksOf(day);

  const addMeal = () => {
    const text = mealText.trim();
    if (!text) return;
    store.addMeal(date, { at: nowTime(), text });
    setMealText('');
  };

  return (
    <div className="day-editor">
      <Choice
        id="rec-belly"
        name="belly"
        label="お腹の調子"
        options={BELLY_STEPS}
        value={day.belly}
        onChange={(v) => store.updateDay(date, { belly: v })}
      />

      <section className="block" id="rec-stool">
        <div className="block-head">
          <h2>お通じ</h2>
          <button
            type="button"
            className="ghost"
            onClick={() => store.addStool(date, { at: nowTime(), bristol: null, marks: [] })}
          >
            ＋ 1回ぶん足す
          </button>
        </div>
        {day.stools.length === 0 ? (
          <p className="muted">まだありません。出たときに足してください（無かった日は空のままで大丈夫です）。</p>
        ) : (
          <>
            <p className="muted">きょう {day.stools.length}回</p>
            {day.stools.map((stool) => (
              <StoolRow
                key={stool.id}
                stool={stool}
                onChange={(patch) => store.updateStool(date, stool.id, patch)}
                onRemove={() => store.removeStool(date, stool.id)}
              />
            ))}
          </>
        )}
        {flags.length > 0 && (
          <div className="notice">
            <p>
              いま付けた印は、「受診の目安」に載っている項目です。
              <strong>これは判定ではありません</strong>——読める場所を出しているだけです。
            </p>
            <button type="button" className="ghost" onClick={onOpenRedFlags}>
              受診の目安を読む
            </button>
          </div>
        )}
      </section>

      <div className="two">
        <Choice
          name="pain"
          label="痛み"
          options={LEVELS}
          value={day.pain}
          onChange={(v) => store.updateDay(date, { pain: v })}
        />
        <Choice
          name="bloat"
          label="張り・ガス"
          options={LEVELS}
          value={day.bloat}
          onChange={(v) => store.updateDay(date, { bloat: v })}
        />
      </div>

      <div className="two" id="rec-life">
        <Choice
          name="stress"
          label="ストレス"
          options={LEVELS}
          value={day.stress}
          onChange={(v) => store.updateDay(date, { stress: v })}
        />
        <Choice
          name="exercise"
          label="体を動かした"
          options={EXERCISE_STEPS}
          value={day.exercise}
          onChange={(v) => store.updateDay(date, { exercise: v })}
        />
      </div>

      <div className="two" id="rec-body">
        <Choice
          name="sleep"
          label="眠れたか"
          options={SLEEP_STEPS}
          value={day.sleep}
          onChange={(v) => store.updateDay(date, { sleep: v })}
        />
        <Choice
          name="posture"
          label="姿勢"
          options={POSTURE_STEPS}
          value={day.posture}
          onChange={(v) => store.updateDay(date, { posture: v })}
        />
      </div>

      {store.probiotic && store.probiotic.name && (
        <section className="block" id="rec-probiotic">
          <label className="mark">
            <input
              type="checkbox"
              checked={day.probiotic}
              onChange={() => store.updateDay(date, { probiotic: !day.probiotic })}
            />
            <span>整腸剤を飲んだ（{store.probiotic.name}）</span>
          </label>
        </section>
      )}

      <section className="block" id="rec-meal">
        <div className="block-head">
          <h2>たべたもの</h2>
        </div>
        {day.meals.map((meal) => (
          <div key={meal.id} className="meal">
            <span className="meal-at">{meal.at || '—'}</span>
            <span className="meal-text">{meal.text}</span>
            <button type="button" className="ghost small" onClick={() => store.removeMeal(date, meal.id)}>
              消す
            </button>
          </div>
        ))}
        <div className="meal-add">
          <label className="sr-only" htmlFor={`meal-${date}`}>
            食べたもの（「、」で区切ると、あとで数えられます）
          </label>
          <input
            id={`meal-${date}`}
            type="text"
            value={mealText}
            placeholder="ヨーグルト、パン"
            onChange={(e) => setMealText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMeal();
            }}
          />
          <button type="button" className="solid" onClick={addMeal}>
            足す
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="suggest">
            <span className="muted">よく書いたもの：</span>
            {suggestions.map((food) => (
              <button
                key={food}
                type="button"
                className="chip small"
                onClick={() => setMealText((cur) => (cur ? `${cur}、${food}` : food))}
              >
                {food}
              </button>
            ))}
          </div>
        )}
        <p className="muted small">
          区切りは「、」やスペースでざっくり数えています。書き方によっては拾えないものがあります。
        </p>
        {day.meals.length > 0 && onOpenCombine && (
          <button type="button" className="ghost small" onClick={onOpenCombine}>
            この日の食べ合わせを見る
          </button>
        )}
      </section>

      <section className="block" id="rec-note">
        <label className="block-head" htmlFor={`note-${date}`}>
          <h2>ひとこと（任意）</h2>
        </label>
        <textarea
          id={`note-${date}`}
          rows="3"
          value={day.note}
          placeholder="会議の前から痛い、など"
          onChange={(e) => store.updateDay(date, { note: e.target.value })}
        />
      </section>
    </div>
  );
}
