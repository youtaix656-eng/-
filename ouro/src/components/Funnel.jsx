// 収益導線。「作業が速くなる＝収益が増える」ではないので、
// **どこで人が減っているか**を先に見る画面。
//
// 数字はユーザーが手で入れる（自動で取れないものを取れるふりはしない）。
// 端末内だけに残り、外へは送らない。

import { useMemo, useState } from 'react';
import { Card, SectionTitle, Field, Empty, Stat } from './ui.jsx';
import {
  FUNNEL_STAGES,
  stageById,
  labelOf,
  latestEntry,
  stageStats,
  bottleneck,
  weekChange,
  pct,
  startOfWeek,
  normalizeFunnel,
} from '../lib/funnel.js';
import { roleById } from '../data/roles.js';

export default function Funnel({ store, go, toast }) {
  const funnel = normalizeFunnel(store.funnel);
  const entry = latestEntry(funnel);
  const stats = useMemo(() => stageStats(entry), [entry]);
  const neck = useMemo(() => bottleneck(entry), [entry]);
  const change = useMemo(() => weekChange(funnel), [funnel]);
  const [form, setForm] = useState(() => blankForm(entry));
  const [open, setOpen] = useState(!entry);

  const save = async () => {
    await store.putFunnelEntry({
      // **new Date('YYYY-MM-DD') を使わない**（UTCとして読まれるので、
      // 東の時間帯だと前日になり、週が1つ手前に入る）。
      weekStart: form.weekStart ? fromDateInput(form.weekStart) : Date.now(),
      values: form.values,
      note: form.note,
    });
    setOpen(false);
    toast('今週の数字を記録しました');
  };

  const askAnalysis = async () => {
    const { analysisRequest } = await import('../lib/funnelInput.js');
    const request = analysisRequest(store.funnel);
    if (!request) {
      toast('先に今週の数字を入れてください');
      return;
    }
    const t = store.newTask({ request, workflowId: 'numbers' });
    go('task', t.id);
    store.runTask(t.id);
  };

  const fixBottleneck = () => {
    if (!neck) return;
    const s = stageById(neck.stageId);
    const name = labelOf(funnel, neck.stageId);
    const request = [
      `いま「${name}」で詰まっています（${neck.reason}）。ここを良くする案を出してください。`,
      '',
      '## 今の数字',
      ...stats.map((x) => `- ${labelOf(funnel, x.stageId)}：${x.value}人${x.rate === null ? '' : `（通過率 ${pct(x.rate)}）`}`),
      '',
      '## お願い',
      `- ${name}だけを良くする案に絞ってください（他の段は今回は触りません）。`,
      '- 案は3つまで。それぞれ「今日できること」から書いてください。',
      '- どの数字がどうなったら成功かを必ず書いてください。',
      '- 効果を保証する書き方はしないでください。',
    ].join('\n');
    // 担当は依頼文から自動で決まる（役職を直に指定する口は newTask に無い）。
    // この段の担当役職が雇われていれば、その人が選ばれやすいよう役職名を添える。
    const t = store.newTask({ request: `${request}\n\n（${roleById(s.roleId)?.name || ''}の観点でお願いします）` });
    go('task', t.id);
    store.runTask(t.id);
  };

  return (
    <div className="screen fade-in">
      <Card glyph="◎" title="収益導線">
        <p className="muted" style={{ marginTop: -6 }}>
          仕事が速くなっても、向きがズレていれば収入にはなりません。
          ここは<strong style={{ color: '#fff' }}>どこで人が減っているか</strong>を見る場所です。
          数字はこの端末にだけ残り、どこにも送りません。
        </p>
      </Card>

      {neck && entry && (
        <Card glyph="⚠" title={`いま詰まっているのは「${labelOf(funnel, neck.stageId)}」`}>
          <p className="muted" style={{ marginTop: -6 }}>{neck.reason}</p>
          <p className="muted">
            ここを直すのが、いちばん効きます。他の段をいくら良くしても、
            ここで止まっている人は増えません。
          </p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={fixBottleneck}>
              ここを良くする案を出してもらう
            </button>
            <button type="button" className="btn" onClick={askAnalysis}>
              今週の数字を分析してもらう
            </button>
          </div>
        </Card>
      )}

      <SectionTitle>今の流れ</SectionTitle>
      {!entry && <Empty>まだ数字がありません。下から今週のぶんを入れてください。</Empty>}
      {entry &&
        stats.map((x) => {
          const s = stageById(x.stageId);
          const isNeck = neck && neck.stageId === x.stageId;
          const w = stats[0].value > 0 ? Math.max(2, Math.round((x.value / stats[0].value) * 100)) : 0;
          return (
            <div key={x.stageId} className={`funnel-stage ${isNeck ? 'neck' : ''}`}>
              <div className="fs-head">
                <span className="rune">{s.glyph}</span>
                <span className="fs-name">{labelOf(funnel, x.stageId)}</span>
                <span className="fs-value">
                  {x.value}
                  <span className="muted" style={{ fontSize: 11 }}> {s.metric}</span>
                </span>
              </div>
              <div className="fs-bar">
                <span style={{ width: `${w}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {x.rate === null ? s.desc : `前の段の ${pct(x.rate)}／${x.drop}人がここで離れた`}
                {isNeck && ' ← ここが詰まっています'}
              </div>
            </div>
          );
        })}

      {change && (
        <>
          <SectionTitle>前の週との差</SectionTitle>
          <div className="stats">
            {change.rows.map((r) => (
              <Stat
                key={r.stageId}
                value={`${r.diff >= 0 ? '+' : ''}${r.diff}`}
                label={labelOf(funnel, r.stageId)}
              />
            ))}
          </div>
        </>
      )}

      <SectionTitle>今週の数字を入れる</SectionTitle>
      {!open ? (
        <button type="button" className="btn block" onClick={() => { setForm(blankForm(entry)); setOpen(true); }}>
          数字を入れる・直す
        </button>
      ) : (
        <Card className="tight">
          <Field label="どの週か（月曜にそろえます）">
            <input
              className="input"
              type="date"
              value={form.weekStart}
              onChange={(e) => setForm({ ...form, weekStart: e.target.value })}
            />
          </Field>
          {FUNNEL_STAGES.map((s) => (
            <Field key={s.id} label={`${labelOf(funnel, s.id)}（${s.metric}）`} hint={s.ask}>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                value={form.values[s.id]}
                onChange={(e) => setForm({ ...form, values: { ...form.values, [s.id]: e.target.value } })}
              />
            </Field>
          ))}
          <Field label="今週やったこと（任意）" hint="何を変えたか。書いておくと、数字の変化と結びつけられます。">
            <textarea
              className="textarea"
              style={{ minHeight: 60 }}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={save}>
              記録する
            </button>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
              やめる
            </button>
          </div>
        </Card>
      )}

      {funnel.entries.length > 1 && (
        <>
          <SectionTitle>これまでの週</SectionTitle>
          {[...funnel.entries].reverse().slice(0, 12).map((e) => (
            <div key={e.id} className="card tight">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13.5 }}>
                  {new Date(e.weekStart).toLocaleDateString('ja-JP')}の週
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {FUNNEL_STAGES.map((s) => e.values[s.id] || 0).join(' → ')}
                </span>
              </div>
              {e.note && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{e.note}</div>}
              <button
                type="button"
                className="btn ghost small"
                style={{ marginTop: 6 }}
                onClick={() => {
                  if (window.confirm('この週の数字を消しますか？')) store.removeFunnelEntry(e.id);
                }}
              >
                消す
              </button>
            </div>
          ))}
        </>
      )}

      <SectionTitle>段の呼び名を変える</SectionTitle>
      <p className="muted" style={{ marginTop: -6 }}>
        商売の形で呼び方は変わります（例：登録 → 予約）。
        段の数と順番は変えられません——増やすと、どこが詰まっているか分かりにくくなるためです。
      </p>
      {FUNNEL_STAGES.map((s) => (
        <Field key={s.id} label={s.name}>
          <input
            className="input"
            value={funnel.labels[s.id] || ''}
            placeholder={s.name}
            onChange={(e) => store.renameFunnelStage(s.id, e.target.value)}
          />
        </Field>
      ))}
    </div>
  );
}

function blankForm(entry) {
  const values = {};
  for (const s of FUNNEL_STAGES) values[s.id] = entry ? String(entry.values[s.id] ?? '') : '';
  const at = new Date(entry ? entry.weekStart : startOfWeek(Date.now()));
  return {
    weekStart: [at.getFullYear(), String(at.getMonth() + 1).padStart(2, '0'), String(at.getDate()).padStart(2, '0')].join('-'),
    values,
    note: entry ? entry.note || '' : '',
  };
}

/** 日付の入力欄の値を、ローカルの日付として読む。 */
function fromDateInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return Date.now();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}
