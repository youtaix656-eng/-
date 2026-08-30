// 最初の道しるべ（7つ済むと自動で消える）。
//
// **Home から切り出して後から読む。** 判定に使う lib/onboarding.js が
// 起動時に読む束に入っていたが、この案内は初めの数日しか出ない。
// チェックは手で付けさせず、実際の状態から導く（onboarding.js が単一の正）。

import { Card } from './ui.jsx';
import { starterProgress, inventoryDraft } from '../lib/onboarding.js';

export default function Starter({ store, go }) {
  const { company, tasks, employees } = store;
  if (store.settings.starterHidden) return null;

  const starter = starterProgress({
    company,
    tasks,
    employees,
    funnel: store.funnel,
    settings: store.settings,
  });
  if (!starter.next) return null;

  return (
    <Card glyph="◈" title={`まずはここから（${starter.doneCount}/${starter.total}）`}>
      <p className="muted" style={{ marginTop: -6 }}>
        AI社員は18人いますが、いきなり全員に頼まなくて大丈夫です。1つずつ進めます。
      </p>
      <div className="card tight">
        <div style={{ fontSize: 14.5 }}>
          {starter.next.day}. {starter.next.title}
        </div>
        <div className="muted" style={{ marginTop: 4 }}>{starter.next.why}</div>
        <button
          type="button"
          className="btn primary small block"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (starter.next.id === 'inventory') {
              // 書き出す枠だけ用意する（中身は本人が書く）
              store.updateSettings({ didInventory: true });
              go('compose', { request: inventoryDraft(), workflowId: 'sort_work' });
              return;
            }
            if (starter.next.id === 'doneWhen') {
              go('compose', {});
              return;
            }
            go(starter.next.view, starter.next.arg ?? null);
          }}
        >
          {starter.next.label}
        </button>
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {starter.steps.map((x) => (
          <span key={x.id} className={`chip ${x.done ? 'on' : ''}`}>
            {x.done ? '✓' : x.day} {x.title}
          </span>
        ))}
      </div>
      <button
        type="button"
        className="btn ghost small"
        style={{ marginTop: 8 }}
        onClick={() => store.updateSettings({ starterHidden: true })}
      >
        この案内を閉じる
      </button>
    </Card>
  );
}
