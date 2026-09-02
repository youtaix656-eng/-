// 事業（ベンチャー）——「1件の仕事」ではなく「1つの事業」を見る画面。
//
// ここでやること：
//  ① 事業をつくる（仮説・誰に・何を・いくらで・月いくら）
//  ② 実行中にする（**1つだけ**。選択と集中）
//  ③ 逆算を見る（月◯円 → 何人必要か）
//  ④ やめる基準を決める（始める前に。決めた期日が来たら判断待ちに出る）
//  ⑤ 今日やる1つを見る
//  ⑥ 出したものを記録する（発信ログ）
//  ⑦ 1件あたりの採算を見る（稼ぎ ＞ AI費用 か）
//  ⑧ 手離れを見る（最後に手を入れてから何日／そのあいだに入ったお金）
//  ⑨ 続くかどうかの見立て（真似される・場所に止められる。**採点しない**）
//  ⑩ 有料記事として売る（段階的に値上げする・売る前の確認）
//  ⑪ 回し方（OODA／PDCA）を1周ずつ進め、AI社員を動かす
//  ⑫ 競合台帳（**実際に見た1件だけ**。推測とAIの当てずっぽうを入れない）
//  ⑬ 需要の観測（実際に見た困りごとの声。検索ボリュームのような外の数字は持たない）
//
// **AIは呼ばない。**（呼ぶのは「分析してもらう」「案を出してもらう」を押した時だけ）

import { useEffect, useMemo, useState } from 'react';
import {
  rivalsOf, rivalsLine, rivalAdvice, pricePosition, pricePositionLine,
  openings, openingsLine, compareTable, seenEvidence,
  RIVAL_PLACES, MIN_RIVALS, STALE_DAYS,
} from '../lib/rivals.js';
import { demandReview, demandLine, demandAdvice, VOICE_PLACES } from '../lib/demand.js';
import { Card, SectionTitle, Field, Empty, Stat, Action, Row } from './ui.jsx';
import {
  VENTURE_STATES,
  DEFAULT_DAYS,
  makeVenture,
  ventureById,
  ventureStats,
  sortVentures,
  activeVenture,
} from '../lib/venture.js';
import { targetPlan, targetLine, targetRequest } from '../lib/target.js';
import { verdictStatus, verdictLine, VERDICT_METRICS } from '../lib/verdict.js';
import { todayPlan } from '../lib/daily.js';
import { POST_CHANNELS, channelName, postsOf, postStats, weekDraft } from '../lib/posts.js';
import { normalizeFunnel, latestEntry, startOfWeek, labelOf } from '../lib/funnel.js';
import { formatMoney } from '../lib/revenue.js';
import { unitEconomics, unitLine, costAdvice } from '../lib/unit.js';
import { passiveState, passiveLine, finishNudge, REST_DAYS } from '../lib/passive.js';
import { RISK_QUESTIONS, RISK_ANSWERS, riskReview, riskLine } from '../lib/risk.js';
import { pricePlan, priceLine, halfOf, SELL_CHECKS, sellReview, sellLine, normalizePricing, LETTER_ROLE_ID } from '../lib/paid.js';
import {
  LOOP_MODES, suggestMode, openLoop, loopsOf, stepOf, loopLine, loopStages,
  orientResult, loopRequest, fixById, stepsOf,
} from '../lib/loop.js';

export default function Ventures({ store, go, toast }) {
  const list = useMemo(() => sortVentures(store.ventures || []), [store.ventures]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const create = async () => {
    if (!form.title.trim()) {
      toast('事業の名前を入れてください');
      return;
    }
    const made = await store.addVenture(form);
    setForm(blank());
    setOpen(false);
    go('venture', made.id);
  };

  return (
    <div className="screen fade-in">
      <Card glyph="⚑" title="事業">
        <p className="muted" style={{ marginTop: -6 }}>
          仕事は1件ずつ終わりますが、<strong style={{ color: '#fff' }}>事業は続きます</strong>。
          ここは「何を・誰に・いくらで売るのか」と「いつまでにダメならやめるのか」を持つ場所です。
          実行中にできるのは<strong style={{ color: '#fff' }}>1つだけ</strong>です。
        </p>
      </Card>

      {!list.length && <Empty>まだ事業がありません。下から1つ作ってください。</Empty>}

      {list.map((v) => (
        <VentureCard key={v.id} venture={v} store={store} go={go} />
      ))}

      <SectionTitle>新しい事業</SectionTitle>
      {!open ? (
        <button type="button" className="btn block" onClick={() => { setForm(blank()); setOpen(true); }}>
          ＋ 事業をつくる
        </button>
      ) : (
        <Card className="tight">
          <VentureForm form={form} setForm={setForm} />
          <div className="btn-row">
            <Action className="btn primary" onClick={create}>つくる</Action>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>やめる</button>
          </div>
        </Card>
      )}
    </div>
  );
}

function blank() {
  return {
    title: '', hypothesis: '', who: '', what: '',
    priceJpy: '', goalMonthlyJpy: '', days: String(DEFAULT_DAYS),
  };
}

function VentureForm({ form, setForm }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
      <Field label="事業の名前">
        <input className="input" value={form.title} onChange={set('title')} placeholder="例：腰痛のセルフケア講座" />
      </Field>
      <Field label="仮説（何が当たると思っているか）" hint="外れたと分かることが大事なので、1行だけ残します。">
        <input className="input" value={form.hypothesis} onChange={set('hypothesis')} placeholder="例：病院で異常なしと言われた人は、続けられる運動を探している" />
      </Field>
      <Field label="誰に">
        <input className="input" value={form.who} onChange={set('who')} placeholder="例：40〜60代・デスクワーク" />
      </Field>
      <Field label="何を">
        <input className="input" value={form.what} onChange={set('what')} placeholder="例：週1回のオンライン指導" />
      </Field>
      <Field label="単価（円）">
        <input className="input" type="number" inputMode="numeric" min="0" value={form.priceJpy} onChange={set('priceJpy')} placeholder="1980" />
      </Field>
      <Field label="目標（月いくら）" hint="ここから必要な人数を逆算します。">
        <input className="input" type="number" inputMode="numeric" min="0" value={form.goalMonthlyJpy} onChange={set('goalMonthlyJpy')} placeholder="100000" />
      </Field>
      <Field label="期間（日）" hint="この日数でいったん判断します。既定は30日。">
        <input className="input" type="number" inputMode="numeric" min="1" value={form.days} onChange={set('days')} />
      </Field>
    </>
  );
}

function VentureCard({ venture, store, go }) {
  const stats = useMemo(
    () => ventureStats({
      venture,
      tasks: store.tasks,
      deals: store.deals,
      knowledge: store.knowledge,
      posts: store.posts,
      usdJpy: store.settings.usdJpy,
    }),
    [venture, store.tasks, store.deals, store.knowledge, store.posts, store.settings.usdJpy]
  );
  const status = verdictStatus(venture, store.funnel);

  return (
    <Row
      glyph={venture.state === 'running' ? '▶' : venture.state === 'stopped' ? '×' : '·'}
      title={venture.title}
      sub={[
        VENTURE_STATES[venture.state],
        venture.startedAt ? `${stats.dayIndex}日目／全${venture.days}日` : null,
        stats.earned > 0 || stats.aiCost > 0 ? `手残り ${formatMoney(stats.net)}` : null,
        status && status.state === 'due' ? '判断待ち' : null,
      ].filter(Boolean).join('・')}
      onClick={() => go('venture', venture.id)}
      preload="venture"
    />
  );
}

// ───────────────────────── 詳細 ─────────────────────────

export function VentureDetail({ store, ventureId, go, toast }) {
  const venture = ventureById(store.ventures || [], ventureId);
  const funnel = normalizeFunnel(store.funnel);
  const entry = latestEntry(funnel);

  const myTasks = useMemo(
    () => (store.tasks || []).filter((t) => t.ventureId === ventureId),
    [store.tasks, ventureId]
  );
  const myPosts = useMemo(() => postsOf(store.posts || [], ventureId), [store.posts, ventureId]);

  const stats = venture
    ? ventureStats({
        venture,
        tasks: store.tasks,
        deals: store.deals,
        knowledge: store.knowledge,
        posts: store.posts,
        usdJpy: store.settings.usdJpy,
      })
    : null;
  const plan = venture ? targetPlan({ venture, entry, funnel }) : null;
  const status = venture ? verdictStatus(venture, store.funnel) : null;
  const today = venture ? todayPlan({ venture, posts: myPosts, tasks: myTasks, loaded: store.hydrated }) : null;
  const unit = venture
    ? unitEconomics({ venture, tasks: store.tasks, deals: store.deals, usdJpy: store.settings.usdJpy })
    : null;
  const passive = venture
    ? passiveState({ venture, tasks: store.tasks, posts: store.posts, deals: store.deals })
    : null;
  const loop = venture ? openLoop(store.loops || [], venture.id) : null;

  if (!venture) return <Empty>事業が見つかりません。</Empty>;

  return (
    <div className="screen fade-in">
      <Card glyph="⚑" title={venture.title} action={<span className="chip">{VENTURE_STATES[venture.state]}</span>}>
        {venture.hypothesis && <p className="muted" style={{ marginTop: -6 }}>仮説：{venture.hypothesis}</p>}
        <p className="muted">
          {[venture.who && `${venture.who}に`, venture.what, venture.priceJpy ? `${formatMoney(venture.priceJpy)}` : null]
            .filter(Boolean)
            .join('／') || 'まだ中身が書かれていません。'}
        </p>
        <div className="stats">
          <Stat value={venture.startedAt ? `${stats.dayIndex}` : '—'} label={`日目／全${venture.days}日`} />
          <Stat value={stats.taskCount} label="仕事" />
          <Stat value={stats.postCount} label="発信" />
          <Stat value={formatMoney(stats.net)} label="手残り" />
        </div>
      </Card>

      <StateCard venture={venture} store={store} toast={toast} />
      {venture.state === 'running' && today && <TodayCard plan={today} go={go} venture={venture} />}
      <div id="venture-loop"><LoopCard
        venture={venture}
        loop={loop}
        store={store}
        funnel={funnel}
        plan={plan}
        unit={unit}
        go={go}
        toast={toast}
      /></div>
      <div id="venture-verdict">
        <VerdictCard venture={venture} status={status} store={store} funnel={funnel} toast={toast} />
      </div>
      <div id="venture-rivals"><RivalsCard venture={venture} store={store} /></div>
      <div id="venture-demand"><DemandCard venture={venture} store={store} /></div>
      <div id="venture-risk"><RiskCard venture={venture} store={store} toast={toast} /></div>
      <TargetCard venture={venture} plan={plan} store={store} go={go} funnel={funnel} toast={toast} />
      <MoneyCard venture={venture} unit={unit} store={store} go={go} toast={toast} />
      <SellCard venture={venture} sold={unit ? unit.sales : 0} store={store} go={go} toast={toast} />
      <PassiveCard venture={venture} passive={passive} store={store} toast={toast} />
      <PostsCard venture={venture} posts={myPosts} store={store} toast={toast} funnel={funnel} />

      <SectionTitle>この事業の仕事（{myTasks.length}）</SectionTitle>
      <button
        type="button"
        className="btn block primary"
        onClick={() => go('compose', { ventureId: venture.id })}
      >
        ✎ この事業で依頼する
      </button>
      {myTasks.slice(0, 8).map((t) => (
        <Row key={t.id} glyph="✎" title={t.request.slice(0, 40)} sub={t.status} onClick={() => go('task', t.id)} preload="task" />
      ))}

      <EditCard venture={venture} store={store} toast={toast} />

      <SectionTitle>この事業をやめる</SectionTitle>
      <Action
        className="btn ghost block"
        onClick={() => {
          if (!window.confirm('この事業の記録を消します。仕事と案件は残ります。よろしいですか？')) return;
          store.removeVenture(venture.id);
          go('ventures');
        }}
      >
        事業を削除する
      </Action>
    </div>
  );
}

/** 状態（検討中／実行中／休止…）。実行中は1つだけ。 */
function StateCard({ venture, store, toast }) {
  const other = activeVenture((store.ventures || []).filter((v) => v.id !== venture.id));
  const change = async (state) => {
    const res = await store.setVentureState(venture.id, state);
    if (res && res.ok === false) {
      toast(`「${res.blocker.title}」が実行中です。先に休止にしてください`);
      return;
    }
    toast(`${VENTURE_STATES[state]}にしました`);
  };
  return (
    <Card glyph="◐" title="いまの状態">
      <p className="muted" style={{ marginTop: -6 }}>
        実行中にできるのは1つだけです。分けて進めると、どちらも中途半端になります。
        {other && venture.state !== 'running' && ` いまは「${other.title}」が実行中です。`}
      </p>
      <div className="btn-row">
        {['idea', 'running', 'paused'].map((s) => (
          <Action
            key={s}
            className={`btn ${venture.state === s ? 'primary' : ''}`}
            onClick={() => change(s)}
            disabled={venture.state === s}
          >
            {VENTURE_STATES[s]}
          </Action>
        ))}
      </div>
    </Card>
  );
}

/** 今日やる1つ。**連続日数は出さない。** */
function TodayCard({ plan, go, venture }) {
  return (
    <Card glyph="☀" title={`今日やること（${plan.day}日目／全${plan.total}日）`}>
      {!plan.loaded && <p className="muted" style={{ marginTop: -6 }}>確認中…</p>}
      {plan.items.map((i) => (
        <div key={i.id} className={`today-item ${i.done ? 'done' : ''}`}>
          <span className="rune">{i.done ? '✓' : i.glyph}</span>
          <div className="ti-body">
            <div className="ti-label">{i.label}</div>
            <div className="ti-why">{i.why}</div>
          </div>
        </div>
      ))}
      {plan.next && plan.next.view === 'compose' && (
        <button type="button" className="btn block" onClick={() => go('compose', { ventureId: venture.id })}>
          ✎ 仕事を1つ進める
        </button>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>
        これまでに動かした日：{plan.practiceDays}日（連続ではありません。休んだ日があっても減りません）
      </p>
    </Card>
  );
}

/** 逆算：月◯円 → 何人必要か。 */
function TargetCard({ venture, plan, store, go, funnel, toast }) {
  if (!plan) return null;
  const ask = () => {
    const request = targetRequest(venture, plan, funnel);
    if (!request) {
      toast('先に単価と目標額を入れてください');
      return;
    }
    const t = store.newTask({ request, workflowId: 'numbers', ventureId: venture.id });
    go('task', t.id);
    store.runTask(t.id);
  };
  return (
    <Card glyph="⟲" title="逆算">
      <p className="muted" style={{ marginTop: -6 }}>{targetLine(plan)}</p>
      {plan.ready && (
        <>
          {plan.rows.map((r) => (
            <div key={r.stageId} className="funnel-stage">
              <div className="fs-head">
                <span className="fs-name">{labelOf(funnel, r.stageId)}</span>
                <span className="fs-value">
                  {r.need === null ? '—' : r.need.toLocaleString('ja-JP')}
                  <span className="muted" style={{ fontSize: 11 }}> {r.metric}</span>
                </span>
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {r.need === null
                  ? '通過率がまだ分かりません（収益導線に数字を入れると出ます）'
                  : `いま ${r.now}人／あと ${r.gap}人`}
              </div>
            </div>
          ))}
          <button type="button" className="btn block" onClick={ask}>
            いちばん足りない段を埋める案を出してもらう
          </button>
        </>
      )}
      {!plan.ready && (
        <p className="muted" style={{ fontSize: 11.5 }}>
          手元にない基準（業界の平均など）は使いません。自分で決めた単価と目標だけで計算します。
        </p>
      )}
    </Card>
  );
}

/** やめる基準。**始める前に決める。** */
function VerdictCard({ venture, status, store, funnel, toast }) {
  const v = venture.verdict || {};
  const [metric, setMetric] = useState(v.metric || 'lead');
  const [target, setTarget] = useState(String(v.target || ''));

  useEffect(() => {
    setMetric(v.metric || 'lead');
    setTarget(String(v.target || ''));
  }, [venture.id, v.metric, v.target]);

  const save = () => {
    store.updateVenture(venture.id, {
      verdict: { ...v, metric, target: Number(target) || 0, decidedAt: 0, decision: '' },
    });
    toast('やめる基準を決めました');
  };

  const decide = async (decision) => {
    await store.decideVenture(venture.id, decision);
    toast(decision === 'stop' ? 'やめると記録しました' : decision === 'extend' ? '14日のばしました' : '続けると記録しました');
  };

  return (
    <Card glyph="⚖" title="やめる基準">
      <p className="muted" style={{ marginTop: -6 }}>{verdictLine(status)}</p>
      {status && status.state === 'due' && (
        <div className="btn-row">
          <Action className="btn primary" onClick={() => decide('continue')}>続ける</Action>
          <Action className="btn" onClick={() => decide('extend')}>14日のばす</Action>
          <Action className="btn ghost" onClick={() => decide('stop')}>やめる</Action>
        </div>
      )}
      <Field label="どの数字で決めるか">
        <select className="input" value={metric} onChange={(e) => setMetric(e.target.value)}>
          {VERDICT_METRICS.map((m) => (
            <option key={m.id} value={m.id}>{labelOf(funnel, m.id)}（{m.metric}）</option>
          ))}
        </select>
      </Field>
      <Field label="いくつ届けば続けるか" hint="期間が終わった時にこの数に届いていなければ、判断待ちになります。">
        <input className="input" type="number" inputMode="numeric" min="0" value={target} onChange={(e) => setTarget(e.target.value)} />
      </Field>
      <button type="button" className="btn" onClick={save}>基準を保存する</button>
      <p className="muted" style={{ fontSize: 11.5 }}>
        続ける勇気より、降りる線引きのほうが先に要ります。ここを決めておくと、
        うまくいかない時に「もう少しだけ」を繰り返さずに済みます。
      </p>
    </Card>
  );
}

/**
 * 回し方（OODA／PDCA）を1周ずつ進める。
 *
 * **2つを混ぜない。** 数字がまだ無いうちは OODA（週1周）、貯まったら PDCA（月1周）。
 * どちらを回すかはアプリが導き、人が上書きもできる。
 *
 * **1周のうちAIを呼ぶのは1〜2段だけ**（観察・情勢判断・意思決定・評価はAIを呼ばない）。
 * **勝手に次へ進めない**——段を進めるのは人が押した時だけ。
 */
function LoopCard({ venture, loop, store, funnel, plan, unit, go, toast }) {
  const guess = suggestMode({ venture, funnel, deals: store.deals || [] });
  const mode = loop ? loop.mode : guess.mode;
  const m = LOOP_MODES[mode];
  const past = loopsOf(store.loops || [], venture.id).filter((l) => l.closedAt);
  const step = stepOf(loop);
  const orient = orientResult(funnel);

  // 読み込みが済むまで「まだ回していない」と言い切らない（項目138）
  if (!store.hydrated && !loop) {
    return (
      <Card glyph="◌" title="回し方">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>読み込んでいます…</p>
      </Card>
    );
  }

  const start = async () => {
    await store.startLoop(venture.id, mode);
    toast(`${m.name} を始めました`);
  };
  const next = async (patch) => {
    const r = await store.advanceLoop(loop.id, patch);
    if (r && r.closedAt) toast('1周まわりました');
  };
  const ask = () => {
    const req = loopRequest(loop, { venture, funnel, plan, unit });
    if (!req) return;
    // 依頼文はアプリの数字から組み立て済み。人は中身を見て押すだけ。
    go('compose', {
      ventureId: venture.id,
      request: req.request,
      workflowId: req.workflowId || undefined,
    });
  };

  return (
    <Card
      glyph="◌"
      title={`回し方（${m.name}・${m.sub}）`}
      action={loop ? <span className="chip">{loop.n}周目</span> : null}
    >
      <p className="muted" style={{ marginTop: -6 }}>{loopLine(loop, funnel, past.length)}</p>

      {!loop && (
        <>
          <p className="muted" style={{ fontSize: 12.5 }}>{guess.why}{guess.forced ? '' : `（${m.why}）`}</p>
          <button type="button" className="btn primary block" onClick={start}>
            {m.name} を1周まわす
          </button>
          <div className="btn-row">
            {Object.values(LOOP_MODES).map((x) => (
              <Action
                key={x.id}
                className={`btn small${mode === x.id ? ' primary' : ''}`}
                onClick={() => { store.updateVenture(venture.id, { loopMode: x.id }); toast(`${x.name} にしました`); }}
              >
                {x.name}（{x.sub}）
              </Action>
            ))}
          </div>
        </>
      )}

      {loop && (
        <>
          {/* 4つの段 */}
          <div className="chips" style={{ marginBottom: 10 }}>
            {loopStages(loop).map((st) => (
              <span key={st.id} className={`chip ${st.state === 'now' ? 'on' : ''}`}>
                {st.state === 'done' ? '✓ ' : ''}{st.key} {st.name}
              </span>
            ))}
          </div>

          {step && (
            <>
              <p style={{ margin: '0 0 4px', fontSize: 14 }}>{step.what}</p>
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{step.note}</p>
            </>
          )}

          {/* 観察・評価：数字を入れに行く（AIを呼ばない） */}
          {step && step.go === 'funnel' && (
            <button type="button" className="btn block" onClick={() => go('funnel')}>
              ◎ 収益導線に数字を入れる
            </button>
          )}

          {/* 情勢判断：アプリが判定する（AIを呼ばない） */}
          {step && step.id === 'orient' && (
            <div className="card tight">
              {orient.ready ? (
                <>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    詰まっているのは <strong>「{orient.label}」</strong>
                  </p>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{orient.reason}</p>
                </>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>{orient.reason}</p>
              )}
            </div>
          )}

          {/* 意思決定：人が1つだけ選ぶ（AIを呼ばない） */}
          {step && step.id === 'decide' && (
            <div style={{ marginTop: 8 }}>
              {orient.options.map((f) => (
                <div key={f.id} className="card tight">
                  <button
                    type="button"
                    className={`chip ${loop.decision === f.id ? 'on' : ''}`}
                    onClick={() => store.decideLoop(loop.id, f.id, orient.stageId)}
                  >
                    {f.label}
                  </button>
                  <p className="muted" style={{ fontSize: 11.5, margin: '6px 0 0' }}>{f.why}</p>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 11.5 }}>
                選ぶのは1つだけです。2つ直すと、どちらが効いたか分からなくなります。
              </p>
            </div>
          )}

          {/* 行動・計画・改善：ここだけAI社員を動かす */}
          {step && step.kind === 'ai' && (
            <>
              <button
                type="button"
                className="btn primary block"
                onClick={ask}
                disabled={step.id === 'act' && loop.mode === 'ooda' && !loop.decision}
              >
                ✎ AI社員に依頼する
              </button>
              {step.id === 'act' && loop.mode === 'ooda' && !loop.decision && (
                <p className="muted" style={{ fontSize: 12.5 }}>
                  先に「意思決定」で直す所を1つ選んでください。
                </p>
              )}
              {step.id === 'act' && loop.mode === 'ooda' && loop.decision && (
                <p className="muted" style={{ fontSize: 12.5 }}>
                  依頼文は、いまの数字と「{(fixById(loop.decision) || {}).label || loop.decision}」から自動で組み立てます。
                  費用の確認と日・月の上限は、今までどおり通ります。
                </p>
              )}
            </>
          )}

          <div className="btn-row" style={{ marginTop: 10 }}>
            <Action className="btn" onClick={() => next()}>
              {stepIndexLabel(loop)}
            </Action>
            <Action className="btn ghost" onClick={() => { store.closeLoop(loop.id); toast('この周を閉じました'); }}>
              この周を閉じる
            </Action>
          </div>
        </>
      )}

      {past.length > 0 && (
        <p className="muted" style={{ fontSize: 11.5 }}>
          これまでに {past.length} 周。{past.length >= 2 ? '同じ所で止まっていないか、たまに見返してください。' : ''}
        </p>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>
        1周のうちAIを呼ぶのは{mode === 'ooda' ? '「行動」の1回' : '「計画」と「改善」の2回'}だけです。
        観察・判断・評価はアプリの計算と、あなたの判断でやります（費用はかかりません）。
      </p>
    </Card>
  );
}

/** 「次は〇〇へ」の文言。最後の段では「1周を終える」。 */
function stepIndexLabel(loop) {
  const steps = stepsOf(loop.mode);
  const i = steps.findIndex((s) => s.id === loop.stepId);
  if (i < 0 || i >= steps.length - 1) return '1周を終える';
  return `次は「${steps[i + 1].name}」へ`;
}

/**
 * 続くかどうかの見立て。
 *
 * **採点しない・総合判定を出さない。** 「危険度◯点」は手元に無い基準（他社の事例）が
 * 無いと出せないので出さない。出すのは「あなたがこう答えた」ことと、その時にできることだけ。
 */
function RiskCard({ venture, store, toast }) {
  const [open, setOpen] = useState(false);
  const review = riskReview(venture);

  const answer = (id, value) => {
    store.updateVenture(venture.id, { risks: { ...review.answers, [id]: value } });
  };

  return (
    <Card glyph="⚠" title="続くかどうかの見立て" action={<span className="chip">{review.answered}／{review.total}</span>}>
      <p className="muted" style={{ marginTop: -6 }}>{riskLine(review)}</p>
      {review.cares.map((q) => (
        <p key={q.id} className="muted" style={{ fontSize: 12.5 }}>・{q.care}</p>
      ))}
      <button type="button" className="btn ghost block" onClick={() => setOpen(!open)}>
        {open ? '閉じる' : review.answered ? '答えを見直す' : `${review.total}つの問いに答える`}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {RISK_QUESTIONS.map((q) => (
            <div key={q.id} style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13.5, fontWeight: 600 }}>{q.q}</p>
              <p className="muted" style={{ margin: '0 0 6px', fontSize: 11.5 }}>{q.why}</p>
              {q.id === 'seen' && (
                <p className="muted" style={{ margin: '0 0 6px', fontSize: 11.5 }}>
                  ▸ {seenEvidence(store.rivals, venture.id).line}
                </p>
              )}
              <div className="btn-row">
                {Object.entries(RISK_ANSWERS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn${review.answers[q.id] === key ? ' primary' : ''}`}
                    onClick={() => answer(q.id, key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="btn block" onClick={() => { setOpen(false); toast('見立てを保存しました'); }}>
            閉じる
          </button>
        </div>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>
        点は付けません。うまくいかなくなる理由は「真似される」か「場所に止められる」の
        どちらかがほとんどで、どちらも頑張りでは避けられないからです。
      </p>
    </Card>
  );
}

/**
 * 1件あたりの採算。**線は1本だけ**——稼ぎが AI費用 を上回っているか。
 * 「◯割なら健全」のような外の基準は持たない。
 */
function MoneyCard({ venture, unit, store, go, toast }) {
  if (!unit) return null;
  const tips = costAdvice(unit, store.settings);
  return (
    <Card glyph="¥" title="1件あたりの採算">
      <p className="muted" style={{ marginTop: -6 }}>{unitLine(unit)}</p>
      <div className="stats">
        <Stat value={unit.sales} label="売れた数" />
        <Stat value={unit.perSale === null ? '—' : formatMoney(unit.perSale)} label="1件の売上" />
        <Stat value={unit.costPerSale === null ? '—' : formatMoney(unit.costPerSale)} label="1件のAI費用" />
        <Stat value={formatMoney(unit.net)} label="手残り" />
      </div>
      {unit.breakEven !== null && unit.aiCost > 0 && (
        <p className="muted" style={{ fontSize: 12.5 }}>
          {unit.remaining
            ? `いまのAI費用（${formatMoney(unit.aiCost)}）を取り戻すには、${formatMoney(unit.price)}のものがあと${unit.remaining}本。`
            : `AI費用（${formatMoney(unit.aiCost)}）は取り戻せています。`}
        </p>
      )}
      {tips && tips.map((t) => (
        <p key={t.id} className="muted" style={{ fontSize: 12.5 }}>・{t.text}</p>
      ))}
      {tips && store.settings.costMode !== 'cheap' && (
        <Action
          className="btn"
          onClick={() => {
            store.updateSettings({ costMode: 'cheap' });
            toast('これからの仕事は安いモデルで動かします');
          }}
        >
          安いモデルに切り替える
        </Action>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>
        線は1本だけです——稼ぎがAI費用を上回っているあいだは続けられます。
        速くなっただけでは残らないので、ここだけは毎回見てください。
      </p>
    </Card>
  );
}

/**
 * 有料記事として売る——値付けの段と、売る前の確認。
 *
 * **相場の表は持たない。** ジャンルごとの相場は手元に無い基準なので、
 * 「このジャンルは◯円」とは書かない（自分で調べた数字を入れてもらう）。
 * 出すのは「決めた数が売れたら、決めた額だけ上げる」という自分の段だけ。
 */
function SellCard({ venture, sold, store, go, toast }) {
  const [open, setOpen] = useState(false);
  const hasLetterWriter = (store.activeEmployees || []).some((e) => e.roleId === LETTER_ROLE_ID);
  const p = normalizePricing(venture.pricing);
  const [form, setForm] = useState(p);
  useEffect(() => setForm(normalizePricing(venture.pricing)), [venture.id, venture.pricing]);

  const plan = pricePlan(venture.pricing, sold);
  const review = sellReview(venture);

  const save = () => {
    store.updateVenture(venture.id, { pricing: normalizePricing(form) });
    toast('値段の段を決めました');
  };
  const toggle = (id) => {
    store.updateVenture(venture.id, { sellChecks: { ...review.done, [id]: !review.done[id] } });
  };

  return (
    <Card glyph="❏" title="有料記事として売る">
      <p className="muted" style={{ marginTop: -6 }}>{priceLine(plan)}</p>
      {plan.ready && (
        <div className="stats">
          <Stat value={formatMoney(plan.price)} label={`いまの値段（${plan.stage}段目）`} />
          <Stat value={sold} label="売れた数" />
          <Stat value={plan.netPerSale === null ? '—' : formatMoney(plan.netPerSale)} label="1件の手取り" />
        </div>
      )}

      <button
        type="button"
        className="btn block primary"
        onClick={() => go('compose', { ventureId: venture.id, workflowId: 'paid_note' })}
      >
        ❏ 有料記事をつくる（無料のレターつき）
      </button>
      <p className="muted" style={{ fontSize: 11.5 }}>
        調べる → 読み手と流れを決める → 本文（有料）→ 無料のレター → 言い過ぎと誤りを見る、の順に進みます。
        レターを別の担当にしているのは、中身が良くても手前の無料部分がイマイチだと手に取ってもらえないからです。
      </p>
      {/* レター担当（ライター）は最初から居る6役職に入っていない。
          未雇用だとその手順ごと計画から外れる＝**売る文章が丸ごと抜ける**ので、
          押す前に見えるようにしておく（実行してから気づくと1回ぶん無駄になる）。 */}
      {!hasLetterWriter && (
        <p className="muted" style={{ fontSize: 12.5 }}>
          レター担当（ライター）がまだ在籍していません。このままでも本文は作れますが、
          <strong style={{ color: '#fff' }}>無料で読める部分（買うかどうかを決める所）が抜けます。</strong>
          <br />
          <Action className="btn small" onClick={() => go('hire', { roleId: 'writer' })}>ライターを雇う</Action>
        </p>
      )}

      <SectionTitle>値段の段</SectionTitle>
      <p className="muted" style={{ marginTop: -6, fontSize: 12.5 }}>
        安すぎると手元に残らず内容も軽く見られ、いきなり高いとまだ届きません。
        <strong style={{ color: '#fff' }}>決めた数が売れるたびに、決めた額だけ上げる</strong>のが間を取る形です。
      </p>
      <Field label="最終的に売りたい値段（円）">
        <input className="input" type="number" inputMode="numeric" min="0" value={form.targetJpy || ''}
          onChange={(e) => setForm({ ...form, targetJpy: e.target.value })} />
      </Field>
      <Field label="最初の値段（円）">
        <input className="input" type="number" inputMode="numeric" min="0" value={form.startJpy || ''}
          onChange={(e) => setForm({ ...form, startJpy: e.target.value })} />
      </Field>
      {Number(form.targetJpy) > 0 && (
        <button type="button" className="btn small" onClick={() => setForm({ ...form, startJpy: halfOf(form.targetJpy) })}>
          まず半分（{formatMoney(halfOf(form.targetJpy))}）から始める
        </button>
      )}
      <div className="btn-row">
        <Field label="何部売れたら">
          <input className="input" type="number" inputMode="numeric" min="1" value={form.everyN || ''}
            onChange={(e) => setForm({ ...form, everyN: e.target.value })} />
        </Field>
        <Field label="いくら上げるか（円）">
          <input className="input" type="number" inputMode="numeric" min="0" value={form.stepJpy || ''}
            onChange={(e) => setForm({ ...form, stepJpy: e.target.value })} />
        </Field>
      </div>
      <Field label="売る場所の手数料（％・任意）" hint="調べた数字を入れると、1件あたりの手取りが出ます。入れなければ出しません。">
        <input className="input" type="number" inputMode="numeric" min="0" max="100" value={form.feePct || ''}
          onChange={(e) => setForm({ ...form, feePct: e.target.value })} />
      </Field>
      <button type="button" className="btn" onClick={save}>段を保存する</button>
      {plan.ready && plan.stages.length > 1 && (
        <p className="muted" style={{ fontSize: 12 }}>
          {plan.stages.map((st) => `${st.from}部〜 ${st.price.toLocaleString('ja-JP')}円`).join(' → ')}
        </p>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>
        ジャンルごとの相場は持っていません（手元に無い基準なので書きません）。
        自分の分野で売れているものをいくつか見て、自分で決めてください。
      </p>

      <SectionTitle>出す前に確かめる（{review.count}／{review.total}）</SectionTitle>
      <p className="muted" style={{ marginTop: -6, fontSize: 12.5 }}>{sellLine(review)}</p>
      <button type="button" className="btn ghost block" onClick={() => setOpen(!open)}>
        {open ? '閉じる' : '一つずつ確かめる'}
      </button>
      {open && SELL_CHECKS.map((c) => (
        <div key={c.id} className="card tight">
          <button
            type="button"
            className={`chip ${review.done[c.id] ? 'on' : ''}`}
            onClick={() => toggle(c.id)}
          >
            {review.done[c.id] ? '済' : '未'} {c.label}
          </button>
          <p className="muted" style={{ fontSize: 11.5, margin: '6px 0 0' }}>{c.why}</p>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 11.5 }}>
        Ouro は出す作業そのものはしません。道具でまとめて大量に投稿すると規約違反になり、
        アカウントごと止められることがあるからです。作るところまでを任せて、出すのは自分の手で。
      </p>
    </Card>
  );
}

/**
 * 手離れ（不労所得の実測）と、仕上げ線。
 *
 * 「不労所得」は**作るまでは労働**で、作ったあと更新しなくても回るもの。
 * 気持ちではなく「最後に手を入れてから何日」「そのあいだに入ったお金」で見る。
 * 仕上げ線は**伸びた時に手を止めるための線**（やめる基準の裏側）。
 */
function PassiveCard({ venture, passive, store, toast }) {
  const [finish, setFinish] = useState(venture.finishWhen || '');
  useEffect(() => setFinish(venture.finishWhen || ''), [venture.id, venture.finishWhen]);
  if (!passive) return null;

  const save = () => {
    store.updateVenture(venture.id, { finishWhen: finish.trim().slice(0, 120) });
    toast('仕上げ線を決めました');
  };

  return (
    <Card glyph="☾" title="手離れ">
      <p className="muted" style={{ marginTop: -6 }}>{passiveLine(passive)}</p>
      <div className="stats">
        <Stat value={passive.last ? passive.days : '—'} label="手を入れていない日数" />
        {/* まだ作っている最中の入金は「手を止めているあいだに入ったお金」ではないので出さない
            （出すと、作りながら売れただけのものが不労所得に見える）。 */}
        <Stat
          value={passive.state === 'resting' || passive.state === 'passive' ? formatMoney(passive.earned) : '—'}
          label="そのあいだに入ったお金"
        />
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>
        {REST_DAYS}日以上手を入れずにお金が入って、はじめて「不労所得」と呼べます。
        入金の記録と説明文の手直しは、手を入れたうちに数えていません
        （数えると、売れるたびに日数が0に戻って永久に測れないためです）。
      </p>

      <SectionTitle>ここで手を止める</SectionTitle>
      <p className="muted" style={{ marginTop: -6, fontSize: 12.5 }}>{finishNudge(venture, passive)}</p>
      {!venture.restedAt && (
        <>
          <Field label="ここまで出来たら手を止める" hint="例：月3万円が3か月続いたら／講座が10本たまったら">
            <input className="input" value={finish} onChange={(e) => setFinish(e.target.value)} maxLength={120} />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn" onClick={save}>仕上げ線を保存する</button>
            {venture.finishWhen && (
              <Action
                className="btn primary"
                onClick={() => {
                  store.updateVenture(venture.id, { restedAt: Date.now() });
                  toast('ここで手を止めたと記録しました');
                }}
              >
                ここで手を止める
              </Action>
            )}
          </div>
        </>
      )}
      {venture.restedAt > 0 && (
        <Action className="btn ghost" onClick={() => { store.updateVenture(venture.id, { restedAt: 0 }); toast('また手を入れます'); }}>
          やっぱり続きをやる
        </Action>
      )}
      <p className="muted" style={{ fontSize: 11.5 }}>
        いちばん難しいのは、うまくいかない時ではなく、うまくいった時に止めることです。
        「もっと稼げるかも」で手を広げ続けると、不労所得のはずが仕事に戻ります。
      </p>
    </Card>
  );
}

/** 発信ログ。 */
function PostsCard({ venture, posts, store, toast, funnel }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankPost);
  const week = postStats(posts, 7);

  const add = async () => {
    if (!form.title.trim() && !form.url.trim()) {
      toast('題名かURLのどちらかを入れてください');
      return;
    }
    await store.addSharePost({ ...form, ventureId: venture.id });
    setForm(blankPost());
    setOpen(false);
    toast('発信を記録しました');
  };

  const toFunnel = async () => {
    const ws = startOfWeek(Date.now());
    const draft = weekDraft(posts, ws);
    if (!draft.count) {
      toast('今週の発信がまだありません');
      return;
    }
    await store.putFunnelEntry({ weekStart: ws, values: draft, note: '発信ログから' });
    toast('今週の数字に入れました（収益導線で確かめてください）');
  };

  return (
    <Card glyph="↗" title={`発信ログ（直近7日で${week.count}件）`}>
      <p className="muted" style={{ marginTop: -6 }}>
        作っただけでは誰にも届きません。出したものと、その反応をここに残します。
        分からない数字は0のままで構いません（推測で埋めないでください）。
      </p>
      {week.count > 0 && (
        <div className="stats">
          <Stat value={week.reach} label="見られた" />
          <Stat value={week.reaction} label="反応" />
          <Stat value={week.lead} label="登録・問い合わせ" />
        </div>
      )}

      {!open ? (
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => { setForm(blankPost()); setOpen(true); }}>
            ＋ 出したものを記録する
          </button>
          {week.count > 0 && (
            <Action className="btn ghost" onClick={toFunnel}>今週の数字に入れる</Action>
          )}
        </div>
      ) : (
        <>
          <Field label="どこへ">
            <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {POST_CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="題名・何を出したか">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="URL（任意）">
            <input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          <div className="stats">
            <Field label="見られた">
              <input className="input" type="number" inputMode="numeric" min="0" value={form.reach} onChange={(e) => setForm({ ...form, reach: e.target.value })} />
            </Field>
            <Field label="反応">
              <input className="input" type="number" inputMode="numeric" min="0" value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} />
            </Field>
            <Field label="登録">
              <input className="input" type="number" inputMode="numeric" min="0" value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} />
            </Field>
          </div>
          <div className="btn-row">
            <Action className="btn primary" onClick={add}>記録する</Action>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>やめる</button>
          </div>
        </>
      )}

      {posts.slice(0, 10).map((p) => (
        <div key={p.id} className="post-row">
          <div className="p-title">↗ {p.title || p.url || '（題名なし）'}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {channelName(p.channel)}・{new Date(p.postedAt).toLocaleDateString('ja-JP')}
            {p.reach || p.reaction || p.lead ? `・見られた${p.reach}／反応${p.reaction}／登録${p.lead}` : ''}
          </div>
          <button type="button" className="btn ghost" onClick={() => store.removeSharePost(p.id)}>
            消す
          </button>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 11.5 }}>
        {labelOf(funnel, 'reach')}の数字は、ここから今週ぶんをまとめて入れられます。
      </p>
    </Card>
  );
}

function blankPost() {
  return { channel: 'x', title: '', url: '', reach: '', reaction: '', lead: '', postedAt: Date.now() };
}

/** あとから中身を直す。 */
function EditCard({ venture, store, toast }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(venture));
  useEffect(() => setForm(toForm(venture)), [venture.id]);

  const save = () => {
    const clean = makeVenture({ ...venture, ...form });
    store.updateVenture(venture.id, {
      title: clean.title,
      hypothesis: clean.hypothesis,
      who: clean.who,
      what: clean.what,
      priceJpy: clean.priceJpy,
      goalMonthlyJpy: clean.goalMonthlyJpy,
      days: clean.days,
    });
    setOpen(false);
    toast('直しました');
  };

  if (!open) {
    return (
      <button type="button" className="btn block" onClick={() => { setForm(toForm(venture)); setOpen(true); }}>
        中身を直す
      </button>
    );
  }
  return (
    <Card className="tight">
      <VentureForm form={form} setForm={setForm} />
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={save}>保存する</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>やめる</button>
      </div>
    </Card>
  );
}

function toForm(v) {
  return {
    title: v.title,
    hypothesis: v.hypothesis,
    who: v.who,
    what: v.what,
    priceJpy: String(v.priceJpy || ''),
    goalMonthlyJpy: String(v.goalMonthlyJpy || ''),
    days: String(v.days || DEFAULT_DAYS),
  };
}

/**
 * 競合台帳。**推測させない——実際に見た1件だけを残す。**
 *
 * ここでいちばん危ないのは、AIに「この分野の相場は？」と聞いて
 * もっともらしい値段とURLを作らせること。だから入力欄しか置かず、
 * **AIに調べさせるボタンを置いていない**（材料が揃ってから、依頼画面で
 * 「競合と市場を見る」の流れに渡す）。
 */
function RivalsCard({ venture, store }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', place: 'note', url: '', price: '', postsPerMonth: '', who: '', what: '', opening: '' });

  const list = rivalsOf(store.rivals, venture.id);
  const pos = pricePosition(list, venture.priceJpy);
  const gap = openings(list, { who: venture.who ? [venture.who] : [], what: venture.what ? [venture.what] : [] });
  const table = compareTable(list, { price: venture.priceJpy, who: venture.who, what: venture.what });
  const advice = rivalAdvice(list, { myPrice: venture.priceJpy, mine: { who: venture.who ? [venture.who] : [], what: venture.what ? [venture.what] : [] } });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    store.addRival({ ...form, ventureId: venture.id });
    setForm({ name: '', place: 'note', url: '', price: '', postsPerMonth: '', who: '', what: '', opening: '' });
  };

  return (
    <Card glyph="◎" title="競合台帳（実際に見たもの）" action={<span className="chip">{list.length}</span>}>
      <p className="muted" style={{ marginTop: -6 }}>
        {store.hydrated ? rivalsLine(list) : '読み込み中です…'}
      </p>
      <p className="muted" style={{ fontSize: 12.5 }}>{pricePositionLine(pos)}</p>
      {list.length > 0 && <p className="muted" style={{ fontSize: 12.5 }}>{openingsLine(gap)}</p>}

      <button type="button" className="btn ghost block" onClick={() => setOpen(!open)}>
        {open ? '閉じる' : '見たものを入れる・一覧を見る'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <form onSubmit={submit}>
            <Field label="名前（サービス名・発信者名）">
              <input value={form.name} placeholder="例：〇〇さんの副業note" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="どこで見たか">
              <select value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })}>
                {Object.entries(RIVAL_PLACES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="URL（あれば）" hint="あなたが実際に開いた画面のURLだけ。思い出せなければ空でかまいません。">
              <input value={form.url} placeholder="https://" onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </Field>
            <Field label="値段（円）" hint="分からなければ空のまま。0円と書かないでください（無料と読めてしまいます）。">
              <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="月に何本くらい出しているか">
              <input type="number" min="0" value={form.postsPerMonth} onChange={(e) => setForm({ ...form, postsPerMonth: e.target.value })} />
            </Field>
            <Field label="誰に（読点で区切る）">
              <input value={form.who} placeholder="初心者、副業したい人" onChange={(e) => setForm({ ...form, who: e.target.value })} />
            </Field>
            <Field label="何を（読点で区切る）">
              <input value={form.what} placeholder="AI、時短" onChange={(e) => setForm({ ...form, what: e.target.value })} />
            </Field>
            <Field label="書き出し（あれば）" hint="そっくりな書き出しを出したときに知らせます（止めはしません）。">
              <textarea rows={2} value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value })} />
            </Field>
            <button type="submit" className="btn primary block" disabled={!form.name.trim()}>この観測を足す</button>
          </form>

          {table.rows.map((r) => (
            <div key={r.id} className="card tight" style={{ marginTop: 8 }}>
              <strong>{r.name}</strong>
              {r.stale && <span className="chip" style={{ marginLeft: 6 }}>見た日が古い（{r.staleDays}日前）</span>}
              <p className="muted" style={{ fontSize: 11.5, margin: '4px 0' }}>
                {r.place}
                {r.price ? ` / ¥${r.price.toLocaleString('ja-JP')}` : ' / 値段は未入力'}
                {r.postsPerMonth ? ` / 月${r.postsPerMonth}本` : ''}
                {r.who.length ? ` / 誰に：${r.who.join('・')}` : ''}
                {r.what.length ? ` / 何を：${r.what.join('・')}` : ''}
              </p>
              {r.url && <p className="muted" style={{ fontSize: 11.5, margin: '0 0 4px', wordBreak: 'break-all' }}>{r.url}</p>}
              <div className="btn-row">
                <button type="button" className="btn ghost" onClick={() => store.updateRival(r.id, { seenAt: Date.now() })}>
                  今もう一度見た
                </button>
                <button type="button" className="btn ghost" onClick={() => store.removeRival(r.id)}>消す</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {advice.map((a) => (
        <p key={a.title} className="muted" style={{ fontSize: 11.5 }}>
          <strong style={{ color: '#fff' }}>{a.title}</strong>：{a.body}
        </p>
      ))}
      <p className="muted" style={{ fontSize: 11.5 }}>
        ここに入るのは<strong style={{ color: '#fff' }}>あなたが実際に見たものだけ</strong>です。
        {MIN_RIVALS}件たまると値段の位置が出て、{STALE_DAYS}日を過ぎた観測には「古い」と印を付けます
        （勝手に消したり更新したりはしません）。
      </p>
    </Card>
  );
}

/**
 * 需要の観測。**検索ボリューム・市場規模のような外の数字は持たない。**
 * 実際に見た「困りごとの声」を、その人が使った言葉のまま貯めるだけ。
 */
function DemandCard({ venture, store }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ text: '', place: 'sns' });

  const list = (store.voices || []).filter((v) => !v.ventureId || v.ventureId === venture.id);
  const review = demandReview(list);
  const advice = demandAdvice(review);

  const submit = (e) => {
    e.preventDefault();
    if (!form.text.trim()) return;
    store.addVoice({ ...form, ventureId: venture.id });
    setForm({ text: '', place: form.place });
  };

  return (
    <Card glyph="◇" title="需要の観測（見た声）" action={<span className="chip">{review.counted}</span>}>
      <p className="muted" style={{ marginTop: -6 }}>
        {store.hydrated ? demandLine(review) : '読み込み中です…'}
      </p>
      {review.words.length > 0 && (
        <div className="btn-row" style={{ marginTop: 6 }}>
          {review.words.slice(0, 8).map((w) => (
            <span key={w.word} className="chip">{w.word} {w.hits}</span>
          ))}
        </div>
      )}

      <button type="button" className="btn ghost block" onClick={() => setOpen(!open)}>
        {open ? '閉じる' : '見た声を入れる・一覧を見る'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <form onSubmit={submit}>
            <Field label="見た声（その人の言葉のまま）" hint="言い換えないでください。言い換えるほど、届く言葉から離れます。氏名やアカウント名は書かないこと。">
              <textarea rows={2} value={form.text} placeholder="例：腰が痛いけど病院に行く時間がない" onChange={(e) => setForm({ ...form, text: e.target.value })} />
            </Field>
            <Field label="どこで見たか">
              <select value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })}>
                {Object.entries(VOICE_PLACES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <button type="submit" className="btn primary block" disabled={!form.text.trim()}>この声を足す</button>
          </form>
          {list.map((v) => (
            <div key={v.id} className="card tight" style={{ marginTop: 8 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13 }}>{v.text}</p>
              <p className="muted" style={{ fontSize: 11.5, margin: '0 0 4px' }}>{VOICE_PLACES[v.place]}</p>
              <button type="button" className="btn ghost" onClick={() => store.removeVoice(v.id)}>消す</button>
            </div>
          ))}
        </div>
      )}

      {advice.map((a) => (
        <p key={a.title} className="muted" style={{ fontSize: 11.5 }}>
          <strong style={{ color: '#fff' }}>{a.title}</strong>：{a.body}
        </p>
      ))}
    </Card>
  );
}
