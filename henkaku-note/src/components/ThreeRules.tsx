import { actions } from '../lib/useStore';
import { carryDown, filledCount, getThree, SLOTS, ITEM_MAX, type Scope } from '../lib/threeRules';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  scope: Scope;
  date: string;
  title: string;
  lead: string;
  /** 上の階層（週→日、月→週）の3つ。空いている枠に降ろせる */
  upper?: string[];
  upperLabel?: string;
  /** 目次からの飛び先（data/anchors.ts の ANCHORS） */
  anchorId?: string;
}

/**
 * 3のルール。今日・今週・今月に3つずつ。
 * 3つ埋めることを条件にしない（1つでも書けていれば「書いた」扱い）。
 */
export default function ThreeRules({ state, scope, date, title, lead, upper, upperLabel, anchorId }: Props) {
  const list = getThree(state.threeRules, scope, date);
  const carry = carryDown(upper, list);
  const filled = filledCount(list);

  return (
    <div className="card" id={anchorId}>
      <div className="row">
        <h3 style={{ margin: 0, flex: 1 }}>📋 {title}</h3>
        <span className="num muted">{filled}/{SLOTS}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{lead}</p>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((text, i) => (
          <label className="field" key={i}>
            <span className="field-label">{i + 1}</span>
            <input
              type="text"
              maxLength={ITEM_MAX}
              value={text}
              placeholder={i === 0 ? '例：過去問を20問' : ''}
              onChange={(e) => actions.setThreeRule(scope, date, i, e.target.value)}
            />
          </label>
        ))}
      </div>

      {carry.length > 0 && (
        <div>
          <p className="section-title">{upperLabel ?? '上の階層'}から降ろす</p>
          <div className="chips">
            {carry.map((t) => (
              <button key={t} type="button" className="chip" onClick={() => actions.fillThreeRule(scope, date, t)}>
                ＋ {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {filled === 0 && (
        <p className="note-line" style={{ margin: 0 }}>
          やるべきことがぼんやりしたままだと、不安やストレスを感じやすいとされています。1つだけでも書いておくと違います。
        </p>
      )}
    </div>
  );
}
