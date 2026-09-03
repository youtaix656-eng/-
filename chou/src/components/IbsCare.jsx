import React from 'react';
import { careTypes, CARE_BY_TYPE, GAS_NOTE, CARE_NOTE, CARE_SOURCE } from '../data/ibsCare.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 型ごとのセルフケア（提案19）。**記録から型を当てない**（決まり59）——
// 選ぶのは本人で、いつでも選び直せる。選ばないまま読むこともできる。

const plain = (s) => String(s || '').replace(/\*\*/g, '');

export default function IbsCare({ store, onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const picked = store.settings.careType || '';
  const types = careTypes();
  const shown = picked ? CARE_BY_TYPE.filter((c) => c.typeId === picked) : CARE_BY_TYPE;

  return (
    <div className="page">
      <div className="page-head">
        <h1>型ごとにできること</h1>
        <p className="muted">
          型は<strong>自分で選ぶだけ</strong>です。記録から当てることはしません。選ばなくても読めます。
        </p>
      </div>

      <section className="block" id="care-pick">
        <div className="block-head">
          <h2>いまの自分に近いもの（任意）</h2>
        </div>
        <div className="choice-row" role="group" aria-label="型を選ぶ">
          {types.map((t) => {
            const on = picked === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`chip${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => store.setSettings({ careType: on ? '' : t.id })}
              >
                {t.title}
              </button>
            );
          })}
        </div>
        {picked && (
          <button type="button" className="ghost small" onClick={() => store.setSettings({ careType: '' })}>
            選ぶのをやめて、全部を読む
          </button>
        )}
        <p className="muted small">{CARE_NOTE}</p>
        <button type="button" className="ghost" onClick={() => onGo('ibs', 'ibs-types')}>
          型そのものの説明を読む
        </button>
      </section>

      <div className="notice" id="care-gas">
        <p>{GAS_NOTE}</p>
      </div>

      {shown.map((care) => (
        <section className="block" key={care.typeId} id={`care-${care.typeId}`}>
          <div className="block-head">
            <h2>{care.title}</h2>
          </div>
          <ul className="flags">
            {care.items.map((item) => (
              <li key={item.id} id={`care-${care.typeId}-${item.id}`}>
                <span className="small">{plain(item.body)}</span>
              </li>
            ))}
          </ul>
          {care.link && (
            <button type="button" className="ghost" onClick={() => onGo(care.link.view, care.link.targetId)}>
              {care.link.label}
            </button>
          )}
        </section>
      ))}

      <RedFlagLink onGo={onGo} />

      <p className="muted small" id="care-source">
        出典：{CARE_SOURCE.text}
        {CARE_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{CARE_SOURCE.checkedOn}
      </p>
    </div>
  );
}
