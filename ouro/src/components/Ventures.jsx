// 事業（ベンチャー）——「1件の仕事」ではなく「1つの事業」を見る画面。
//
// ここでやること：
//  ① 事業をつくる（仮説・誰に・何を・いくらで・月いくら）
//  ② 実行中にする（**1つだけ**。選択と集中）
//  ③ 逆算を見る（月◯円 → 何人必要か）
//  ④ やめる基準を決める（始める前に。決めた期日が来たら判断待ちに出る）
//  ⑤ 今日やる1つを見る
//  ⑥ 出したものを記録する（発信ログ）
//
// **AIは呼ばない。**（呼ぶのは「分析してもらう」「案を出してもらう」を押した時だけ）

import { useEffect, useMemo, useState } from 'react';
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
      <VerdictCard venture={venture} status={status} store={store} funnel={funnel} toast={toast} />
      <TargetCard venture={venture} plan={plan} store={store} go={go} funnel={funnel} toast={toast} />
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
