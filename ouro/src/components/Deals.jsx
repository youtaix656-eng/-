// 案件・収益。AI社員の成果を実際のお金につなげるための画面。
//
// 金額はすべて「目安」。断定した相場として見せない
// （実際の相場はリサーチャーに調べさせる導線を必ず添える）。

import { useState } from 'react';
import { Card, Field, SectionTitle, Row, Empty, Stat, Jump } from './ui.jsx';
import { JOB_TEMPLATES, easiestFirst, templateById } from '../data/jobTemplates.js';
import { DEAL_STATUS, revenueSummary, upcomingDeals, formatMoney, dealAiCost } from '../lib/revenue.js';
import { relTime } from '../lib/format.js';
import { useAllTasks } from './useAllTasks.js';
import { checkPersonal, CLIENT_HINT } from '../lib/privacy.js';

export default function Deals({ store, go, toast, highlight = null }) {
  // 古い仕事も要る画面なので、残りを読み足す
  useAllTasks(store);
  // 目次から案件の型を指定して来たときは、その型が見えるタブを開く
  const [tab, setTab] = useState(highlight ? 'templates' : store.deals.length ? 'deals' : 'templates');
  const [form, setForm] = useState(null);

  const money = revenueSummary(store.deals, store.tasks, { usdJpy: store.settings.usdJpy });
  const upcoming = upcomingDeals(store.deals);

  const addFromTemplate = (tpl) => {
    setForm({
      title: tpl.name,
      client: '',
      fee: tpl.feeHint[0] || 0,
      templateId: tpl.id,
      status: 'lead',
      dueAt: '',
      notes: tpl.firstStep,
    });
    setTab('deals');
  };

  const save = () => {
    if (!form.title.trim()) return;
    const deal = store.addDeal({
      ...form,
      fee: Number(form.fee) || 0,
      dueAt: form.dueAt ? new Date(form.dueAt).getTime() : null,
    });
    setForm(null);
    toast('案件を追加しました');
    go('deal', deal.id);
  };

  return (
    <div className="screen fade-in">
      <div className="stats" style={{ marginBottom: 12 }}>
        <Stat value={formatMoney(money.earned)} label="入金済み" />
        <Stat value={formatMoney(money.expected)} label="見込み" />
        <Stat value={formatMoney(money.aiCost)} label="AI費用" />
        <Stat value={money.hourlyRate ? formatMoney(money.hourlyRate) : '—'} label="時給換算" />
      </div>

      {money.returnRatio !== null && (
        <Card className="tight">
          <div className="muted">
            AI費用1円あたり <strong style={{ color: '#fff' }}>{money.returnRatio}円</strong> の売上。
            {money.returnRatio < 1 && ' 今は赤字です。単価を上げるか、安いモデルに切り替えてください。'}
          </div>
        </Card>
      )}

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip ${tab === 'deals' ? 'on' : ''}`} onClick={() => setTab('deals')}>
          案件 {store.deals.length}
        </button>
        <button type="button" className={`chip ${tab === 'templates' ? 'on' : ''}`} onClick={() => setTab('templates')}>
          仕事の型 {JOB_TEMPLATES.length}
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="chip"
          onClick={() => setForm({ title: '', client: '', fee: 0, status: 'lead', dueAt: '', notes: '' })}
        >
          ＋ 案件
        </button>
      </div>

      {form && (
        <Card glyph="¥" title="案件を追加">
          <Field label="案件名">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="依頼元（任意）" hint={CLIENT_HINT}>
            <input
              className="input"
              value={form.client}
              placeholder="例：Aさん／〇〇整体院"
              onChange={(e) => setForm({ ...form, client: e.target.value })}
            />
          </Field>
          <PersonalWarning text={`${form.client} ${form.notes}`} />
          <Field label="金額（円）">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: e.target.value })}
            />
          </Field>
          <Field label="締切（任意）">
            <input className="input" type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </Field>
          <Field label="状態">
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(DEAL_STATUS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="メモ">
            <textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={save} disabled={!form.title.trim()}>
              追加する
            </button>
            <button type="button" className="btn ghost" onClick={() => setForm(null)}>やめる</button>
          </div>
        </Card>
      )}

      {tab === 'deals' ? (
        <>
          {upcoming.length > 0 && (
            <>
              <SectionTitle>締切が近い</SectionTitle>
              {upcoming.slice(0, 3).map((d) => (
                <Row
                  key={d.id}
                  glyph={d.daysLeft <= 2 ? '⚠' : '◷'}
                  title={d.title}
                  sub={`あと${d.daysLeft}日・${formatMoney(d.fee)}・${DEAL_STATUS[d.status]}`}
                  onClick={() => go('deal', d.id)}
                />
              ))}
            </>
          )}

          <SectionTitle>すべての案件</SectionTitle>
          {store.deals.length ? (
            store.deals.map((d) => (
              <Row
                key={d.id}
                glyph="¥"
                title={d.title}
                sub={`${DEAL_STATUS[d.status]}・${formatMoney(d.fee)}${d.client ? `・${d.client}` : ''}・${relTime(d.updatedAt)}`}
                onClick={() => go('deal', d.id)}
              />
            ))
          ) : (
            <Empty>
              まだ案件がありません。
              <br />
              「仕事の型」から、元手ゼロで始められるものを選んでみてください。
            </Empty>
          )}
        </>
      ) : (
        <>
          <Card glyph="¥" title="元手ゼロで始めやすい順">
            <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
              金額はすべて<strong style={{ color: '#fff' }}>目安</strong>です。
              実際の相場は時期・地域・実績で大きく変わるので、始める前にリサーチャーに調べさせてください。
            </p>
          </Card>

          {easiestFirst().map((t) => (
            <Jump key={t.id} id={t.id} active={highlight}>
            <Card glyph={t.glyph} title={t.name}>
              <div className="muted" style={{ marginTop: -6 }}>
                目安 {t.feeHint[0].toLocaleString()}〜{t.feeHint[1].toLocaleString()}円／{t.unit}
                ・必要スキル{t.skillNeed}・元手{t.startCost}円
              </div>
              <p style={{ fontSize: 14.5 }}>{t.desc}</p>
              <p className="muted">
                <strong style={{ color: '#fff' }}>最初の一歩：</strong>
                {t.firstStep}
              </p>
              <p className="muted">⚠ {t.caution}</p>
              <div className="btn-row">
                <button type="button" className="btn small primary" onClick={() => addFromTemplate(t)}>
                  この案件を始める
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() =>
                    go('compose', {
                      request: `「${t.name}」の日本での相場と、未経験から受注するまでの現実的な手順を調べてください。実際の募集が見られる場所も挙げてください。`,
                      workflowId: 'deep_research',
                    })
                  }
                >
                  相場を調べさせる
                </button>
              </div>
            </Card>
            </Jump>
          ))}
        </>
      )}
    </div>
  );
}

export function DealDetail({ store, dealId, go }) {
  // 古い仕事も要る画面なので、残りを読み足す
  useAllTasks(store);
  const deal = store.deals.find((d) => d.id === dealId);
  if (!deal) return <div className="screen"><Empty>案件が見つかりません。</Empty></div>;

  const tpl = templateById(deal.templateId);
  const tasks = store.tasks.filter((t) => t.dealId === deal.id);
  const aiCost = dealAiCost(deal, store.tasks, store.settings.usdJpy);
  const profit = (deal.fee || 0) - aiCost;

  return (
    <div className="screen fade-in">
      <Card glyph="¥" title={deal.title}>
        <div className="muted" style={{ marginTop: -6 }}>
          {DEAL_STATUS[deal.status]}
          {deal.client && `・${deal.client}`}
          {deal.dueAt && `・締切 ${new Date(deal.dueAt).toLocaleDateString('ja-JP')}`}
        </div>
        <div className="stats" style={{ marginTop: 10 }}>
          <Stat value={formatMoney(deal.fee)} label="報酬" />
          <Stat value={formatMoney(Math.round(aiCost))} label="AI費用" />
          <Stat value={formatMoney(Math.round(profit))} label="手残り" />
        </div>
        {deal.notes && <p className="muted" style={{ marginTop: 10 }}>{deal.notes}</p>}
      </Card>

      <Card glyph="◷" title="状態を変える">
        <div className="chips">
          {Object.entries(DEAL_STATUS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip ${deal.status === id ? 'on' : ''}`}
              onClick={() => store.updateDeal(deal.id, { status: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="かかった時間（時間）">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={deal.hoursSpent}
            onChange={(e) => store.updateDeal(deal.id, { hoursSpent: Number(e.target.value) || 0 })}
          />
        </Field>
      </Card>

      {tpl && (
        <Card glyph={tpl.glyph} title="この型の進め方">
          <p className="muted" style={{ marginTop: -6 }}>{tpl.desc}</p>
          <p className="muted">⚠ {tpl.caution}</p>
          <button
            type="button"
            className="btn block"
            onClick={() =>
              go('compose', {
                request: `案件「${deal.title}」を進めます。${tpl.desc}\n\n${deal.notes || ''}`,
                workflowId: tpl.workflowId,
                dealId: deal.id,
              })
            }
          >
            AI社員に作業させる（{tpl.workflowId}）
          </button>
        </Card>
      )}

      <SectionTitle>この案件の仕事</SectionTitle>
      <button type="button" className="btn small" style={{ marginBottom: 8 }} onClick={() => go('ledger')}>
        台帳で見る
      </button>
      {tasks.length ? (
        tasks.map((t) => (
          <Row key={t.id} glyph="✎" title={t.title} sub={relTime(t.createdAt)} onClick={() => go('task', t.id)} />
        ))
      ) : (
        <Empty>まだ紐づいた仕事がありません。</Empty>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn primary"
          onClick={() => go('compose', { dealId: deal.id, request: '' })}
        >
          この案件で依頼する
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (window.confirm('この案件を削除しますか？')) {
              store.deleteDeal(deal.id);
              go('deals');
            }
          }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

/**
 * お客さん個人を特定できるものが入っていないか（新規）。
 *
 * Ouro のデータは端末内にしか無いが、**書き出し（バックアップ）や CSV は
 * 端末の外へ出る**。落とした時に取り返しがつかないのはここなので、
 * 書いている最中に気づけるようにする。止めはしない。
 */
function PersonalWarning({ text }) {
  const hits = checkPersonal(text);
  if (!hits.length) return null;
  return (
    <div className="card tight" style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14 }}>
        ⚠ 個人を特定できるものが {hits.length} か所あります
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        {hits.map((h) => `${h.phrase}（${h.label}）`).join('・')}
      </div>
      <div className="muted">{CLIENT_HINT}</div>
    </div>
  );
}
