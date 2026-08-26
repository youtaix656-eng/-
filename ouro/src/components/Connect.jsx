// 「会社で使える道具」。連携アプリ一覧ではなく、社員の道具として並べる。
// 接続上限はプラン定義から読む（画面に数字を直書きしない）。

import { Card, SectionTitle, Empty, Jump } from './ui.jsx';
import { TOOLS, TOOL_CATEGORIES } from '../data/tools.js';
import { planById, connectionLimit, PLANS } from '../data/plans.js';
import { providerById } from '../lib/providers/index.js';

export default function Connect({ store, go, toast, highlight = null }) {
  const plan = planById(store.company?.planId);
  const limit = connectionLimit(store.company?.planId, store.company?.limitOverrides);
  const enabled = store.connections.filter((c) => c.enabled);
  const isOn = (id) => enabled.some((c) => c.toolId === id);

  const toggle = (tool) => {
    const on = isOn(tool.id);
    if (!on && !tool.always && enabled.filter((c) => !TOOLS.find((t) => t.id === c.toolId)?.always).length >= limit) {
      toast(`${plan.name}プランで使える道具は${limit}つまでです`);
      return;
    }
    if (!on && tool.needs === 'key') {
      const p = providerById(tool.providerId);
      if (p && !store.secrets[p.id]) {
        toast('先に設定でキーを登録してください');
        go('settings');
        return;
      }
    }
    if (!on && tool.needs === 'oauth') {
      toast(`${tool.name} は Phase ${tool.plannedPhase} で対応予定です`);
      return;
    }
    store.toggleConnection(tool.id, !on);
  };

  return (
    <div className="screen fade-in">
      <Card glyph="⚒" title="会社で使える道具">
        <p className="muted" style={{ marginTop: -6 }}>
          社員が仕事に使う道具です。
          {plan.name}プランでは<strong style={{ color: '#fff' }}>{limit}つ</strong>まで
          （社内の道具は数に入りません）。今 {enabled.length} つ接続中。
        </p>
        <div className="chips">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${store.company?.planId === p.id ? 'on' : ''}`}
              onClick={() => store.updateCompany({ planId: p.id })}
            >
              {p.name}（{p.maxConnections}）
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
          {plan.desc}
        </p>
      </Card>

      {TOOL_CATEGORIES.map((cat) => {
        const list = TOOLS.filter((t) => t.category === cat.id);
        if (!list.length) return null;
        return (
          <div key={cat.id}>
            <SectionTitle>{cat.name}</SectionTitle>
            {list.map((t) => {
              const on = isOn(t.id) || t.always;
              return (
                <Jump key={t.id} id={t.id} active={highlight}>
                <div className="card tight">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="rune" style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                      {t.glyph}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5 }}>
                        {t.name}
                        {t.always && <span className="badge" style={{ marginLeft: 6 }}>社内</span>}
                        {!t.available && (
                          <span className="badge" style={{ marginLeft: 6 }}>Phase {t.plannedPhase}</span>
                        )}
                      </div>
                      <div className="muted">{t.desc}</div>
                    </div>
                    {!t.always && (
                      <button
                        type="button"
                        className={`btn small ${on ? '' : 'primary'}`}
                        onClick={() => toggle(t)}
                        disabled={!t.available}
                      >
                        {on ? '解除' : '接続'}
                      </button>
                    )}
                  </div>
                  {t.note && <div className="muted" style={{ marginTop: 6 }}>※ {t.note}</div>}
                  {t.capabilities?.some((c) => ['send', 'delete', 'pay'].includes(c)) && (
                    <div className="muted" style={{ marginTop: 4 }}>
                      ⚠ この道具には危険な操作（{t.capabilities.filter((c) => ['send', 'delete', 'pay'].includes(c)).join('・')}）
                      が含まれます。実行前に必ずあなたの承認を通します。
                    </div>
                  )}
                </div>
                </Jump>
              );
            })}
          </div>
        );
      })}

      {!TOOLS.length && <Empty>道具がありません。</Empty>}
    </div>
  );
}
