// チーム — 社員どうしが進み具合を共有する場。
//
// 3つを1画面に置く：
//   ① 在席ボード（誰がいま何をしているか）… AIを呼ばない
//   ② 朝会（今日の進み具合）………………… AIを呼ばない（まとめだけ任意で1回）
//   ③ 社内掲示板（共通記憶）……………… AIを呼ばない
//
// **会議はここから開かない。** 会議はいちばん高いので、
// 「まず費用ゼロで共有し、それでも足りない時だけ会議」という順にする。

import { useMemo, useState } from 'react';
import { Card, SectionTitle, Empty, Field, Stat, Doc } from './ui.jsx';
import { useAllTasks } from './useAllTasks.js';
import { buildPresence, presenceState, presenceCounts, PRESENCE_STATES } from '../lib/presence.js';
import { buildStandup, standupText, alreadyHeld } from '../lib/standup.js';
import { livePosts, kindById, POST_KINDS, BOARD_TTL_DAYS } from '../lib/board.js';
import { buildQueue, worstBlocker } from '../lib/queue.js';
import { buildRoleLoad, heaviestRole, BUSY_PER_PERSON } from '../lib/load.js';
import { buildStalls, longStalls, humanDuration, stallKind } from '../lib/stall.js';
import { forRole, repeated } from '../lib/pitfalls.js';
import { buildPromotions, ruleDraft } from '../lib/promote.js';
import { relTime } from '../lib/format.js';
import { roleById } from '../data/roles.js';

export default function Team({ store, go, toast }) {
  useAllTasks(store);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [post, setPost] = useState('');
  const [askWho, setAskWho] = useState('');
  const [question, setQuestion] = useState('');

  const people = store.activeEmployees;
  const presence = useMemo(
    () => buildPresence(people, store.tasks),
    [people, store.tasks]
  );
  const counts = useMemo(() => presenceCounts(presence), [presence]);
  const standup = useMemo(
    () => buildStandup({ tasks: store.tasks, employees: people }),
    [store.tasks, people]
  );
  const posts = useMemo(() => livePosts(store.board), [store.board]);
  // 以下はすべて AI を呼ばずに、仕事・掲示板から導く
  const queue = useMemo(() => buildQueue(store.tasks, people), [store.tasks, people]);
  const jam = worstBlocker(queue);
  const load = useMemo(() => buildRoleLoad(store.tasks, people), [store.tasks, people]);
  const heavy = heaviestRole(load);
  const stalls = useMemo(
    () => buildStalls({ tasks: store.tasks, approvals: store.approvals }),
    [store.tasks, store.approvals]
  );
  const nagging = useMemo(() => longStalls(stalls), [stalls]);
  // 合計は**画面に出している分**で数える（全部の合計を出すと、
  // 一覧の数字とどこも一致しなくて意味が分からなくなる）。
  const naggingTotal = useMemo(() => nagging.reduce((n, r) => n + r.ms, 0), [nagging]);
  const pits = useMemo(() => (store.pitfalls || []).slice().sort((a, b) => (b.count || 1) - (a.count || 1)), [store.pitfalls]);
  const promotions = useMemo(() => buildPromotions(store.board), [store.board]);
  const heldToday = alreadyHeld(store.settings.lastStandupAt);

  const runStandup = async (withSummary) => {
    setBusy(true);
    try {
      const r = await store.holdStandup({ withSummary });
      if (r && r.queued) toast('承認が要ります。承認画面から進めてください');
      else if (r && r.summary) setSummary(r.summary);
      else toast('今日の朝会をまとめました');
    } finally {
      setBusy(false);
    }
  };

  /**
   * ルールにする前に、必ず人が直せるようにする。
   * 掲示やエラーの文はそのままではルールとして読めない
   * （途中で切れていたり、状態番号が混ざっていたりする）。
   * ここで直さずに入れると、全社員が毎回それを読むことになる。
   */
  const makeRule = (draft) => {
    const text = window.prompt('会社のルールとして、全社員に読ませる文に直してください', ruleDraft(draft));
    if (text === null) return;
    if (!text.trim()) return;
    store.addCompanyRule(text.trim());
    toast('会社のルールにしました');
  };

  const ask = async () => {
    if (!askWho || !question.trim()) return;
    setBusy(true);
    try {
      const r = await store.consultEmployee({ employeeId: askWho, question });
      if (r && r.queued) toast('承認が要ります。承認画面から進めてください');
      else if (r && r.error) toast(`聞けませんでした：${r.error}`);
      else {
        setQuestion('');
        toast('答えを掲示板に載せました');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen fade-in">
      <Card glyph="◍" title="チーム">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
          社員は役割ごとに別々の仕事をしています。ここは
          <strong style={{ color: '#fff' }}>互いの進み具合を知るための場</strong>です。
          この画面の中身は<strong style={{ color: '#fff' }}>AIを1回も呼びません</strong>
          （仕事の状況から作っています）。
        </p>
      </Card>

      {/* ① 在席ボード */}
      <SectionTitle>いま誰が何をしているか</SectionTitle>
      <div className="stats" style={{ marginBottom: 10 }}>
        {PRESENCE_STATES.filter((s) => counts[s.id]).map((s) => (
          <Stat key={s.id} value={counts[s.id]} label={s.name} />
        ))}
      </div>
      {!presence.some((p) => p.state !== 'idle') && (
        <Empty>いま動いている仕事はありません。</Empty>
      )}
      {presence
        .filter((p) => p.state !== 'idle')
        .slice(0, 12)
        .map((p) => {
          const st = presenceState(p.state);
          return (
            <button
              key={p.employee.id}
              type="button"
              className="row"
              onClick={() => (p.task ? go('task', p.task.id) : go('employee', p.employee.id))}
            >
              <span className="g">{st.glyph}</span>
              <span className="body">
                <span className="t">
                  {p.employee.name}
                  <span className="muted" style={{ fontSize: 11 }}>
                    　{roleById(p.employee.roleId)?.name || ''}
                  </span>
                </span>
                <span className="s">
                  {st.name}
                  {p.task ? `・「${p.task.title}」` : ''}
                  {p.note ? `／${p.note}` : ''}
                </span>
              </span>
              <span className="arrow">›</span>
            </button>
          );
        })}

      {/* 待ち行列（誰が誰を待っているか） */}
      <SectionTitle>誰を待っているか</SectionTitle>
      {jam && (
        <Card glyph="⚠" title={`「${jam.name}」で${jam.waiting.length}件が止まっています`}>
          <p className="muted" style={{ marginTop: -6 }}>
            この人の手が空くまで、後ろの仕事は進みません。席を増やすか、他の担当へ振り分けてください。
          </p>
          <div className="btn-row">
            <button type="button" className="btn small" onClick={() => go('employee', jam.employeeId)}>
              この社員を見る
            </button>
            <button type="button" className="btn small ghost" onClick={() => go('hire', { roleId: jam.roleId })}>
              同じ役職をもう1人雇う
            </button>
          </div>
        </Card>
      )}
      {!queue.blockers.length && !queue.owner.length && <Empty>待っているものはありません。</Empty>}
      {queue.blockers.slice(0, 6).map((b) => (
        <button
          key={b.employeeId || b.name}
          type="button"
          className="row"
          onClick={() => (b.employeeId ? go('employee', b.employeeId) : null)}
        >
          <span className="g">◷</span>
          <span className="body">
            <span className="t">{b.name}</span>
            <span className="s">
              まだ始めていない {b.waiting.length}件／実行中 {b.running.length}件
              {b.waiting[0] ? `・「${b.waiting[0].title}」ほか` : ''}
            </span>
          </span>
          <span className="arrow">›</span>
        </button>
      ))}
      {queue.owner.length > 0 && (
        <Card glyph="⚖" title={`あなた待ち ${queue.owner.length}件`}>
          <p className="muted" style={{ marginTop: -6 }}>
            社員ではなく<strong style={{ color: '#fff' }}>あなたが動かないと進まない</strong>ものです。
          </p>
          {queue.owner.slice(0, 4).map((o) => (
            <button key={o.taskId} type="button" className="row" onClick={() => go('task', o.taskId)}>
              <span className="g">⚖</span>
              <span className="body">
                <span className="t">{o.title}</span>
                <span className="s">{o.why}を待っています</span>
              </span>
              <span className="arrow">›</span>
            </button>
          ))}
        </Card>
      )}

      {/* 止まっている時間（人間が原因の遅れ） */}
      {nagging.length > 0 && (
        <>
          <SectionTitle>止まっている時間</SectionTitle>
          <Card className="tight">
            <p className="muted" style={{ marginTop: 0 }}>
              半日以上、あなたの手を待っているものです。合計 {humanDuration(stalls.totalMs)}。
              AIの費用ばかり見ていると、いちばん時間を食っているここが見えません。
            </p>
            {nagging.map((r) => (
              <button key={r.taskId} type="button" className="row" onClick={() => go('task', r.taskId)}>
                <span className="g">{stallKind(r.kind).glyph}</span>
                <span className="body">
                  <span className="t">{r.title}</span>
                  <span className="s">
                    {stallKind(r.kind).name}・{humanDuration(r.ms)}止まっています
                  </span>
                </span>
                <span className="arrow">›</span>
              </button>
            ))}
          </Card>
        </>
      )}

      {/* 役職別の負荷（どの役職を雇い足すか） */}
      <SectionTitle>役職ごとの持ち数</SectionTitle>
      {heavy && (
        <Card glyph="＋" title={`${roleById(heavy.roleId)?.name || heavy.roleId} が重くなっています`}>
          <p className="muted" style={{ marginTop: -6 }}>
            {heavy.people}人で {heavy.open}件（1人あたり {heavy.perPerson}件）。
            1人あたり {BUSY_PER_PERSON}件を超えたら、席を増やすか依頼を減らす目安です。
          </p>
          <button type="button" className="btn small primary" onClick={() => go('hire', { roleId: heavy.roleId })}>
            この役職をもう1人雇う
          </button>
        </Card>
      )}
      {!load.rows.some((r) => r.open > 0) && <Empty>未完了の手順はありません。</Empty>}
      {load.rows
        .filter((r) => r.open > 0)
        .slice(0, 8)
        .map((r) => (
          <div key={r.roleId} className="load-row">
            <div className="lr-head">
              <span className="lr-name">{roleById(r.roleId)?.name || r.roleId}</span>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {r.people}人・{r.open}件（1人 {r.perPerson}）
              </span>
            </div>
            <div className="lr-bar">
              <span
                className={r.heavy ? 'heavy' : ''}
                style={{ width: `${Math.min(100, Math.round((r.perPerson / (BUSY_PER_PERSON * 2)) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      {load.unstaffed.length > 0 && (
        <Card glyph="◌" title="雇っていないので、そもそも数に出ない役職">
          <p className="muted" style={{ marginTop: -6 }}>
            依頼に向いていたのに、在籍していないため計画から外した役職です。
          </p>
          {load.unstaffed.slice(0, 5).map((u) => (
            <button
              key={u.roleId}
              type="button"
              className="row"
              onClick={() => go('hire', { roleId: u.roleId })}
            >
              <span className="g">＋</span>
              <span className="body">
                <span className="t">{roleById(u.roleId)?.name || u.roleId}</span>
                <span className="s">{u.count}回、担当から外れました</span>
              </span>
              <span className="arrow">›</span>
            </button>
          ))}
        </Card>
      )}

      {/* ② 朝会 */}
      <SectionTitle>今日の朝会</SectionTitle>
      <Card className="tight">
        <div className="muted" style={{ marginTop: 0 }}>
          {standup.counts.people}人が動いています・終えた {standup.counts.done}件／これから{' '}
          {standup.counts.todo}件／詰まっている {standup.counts.blocked}件
          {heldToday && '・今日はもう開きました'}
        </div>
        <Doc text={standupText(standup)} fold={0} />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button type="button" className="btn small" disabled={busy} onClick={() => runStandup(false)}>
            朝会を開く（費用ゼロ）
          </button>
          <button type="button" className="btn small ghost" disabled={busy} onClick={() => runStandup(true)}>
            書記に3行でまとめてもらう（AI1回）
          </button>
        </div>
        {summary && (
          <div className="card tight" style={{ marginTop: 8 }}>
            <Doc text={summary} fold={0} />
          </div>
        )}
      </Card>

      {/* ③ 掲示板 */}
      <SectionTitle>社内掲示板（{posts.length}）</SectionTitle>
      <p className="muted" style={{ marginTop: -6 }}>
        社員が仕事の中で気づいたことが自動で載ります。ここに載っていることは、
        次に動く社員が<strong style={{ color: '#fff' }}>必ず読んでから</strong>仕事をします。
        {BOARD_TTL_DAYS}日で自動的に消えます（溜める場所ではなく、
        新しいものだけが見える場所にしておくため）。
      </p>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={post}
          placeholder="全員に伝えておきたいことを1行で"
          onChange={(e) => setPost(e.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={!post.trim()}
          onClick={() => {
            store.addBoardPost({ text: post, kind: 'decision', employeeName: 'あなた' });
            setPost('');
          }}
        >
          貼る
        </button>
      </div>
      {!posts.length && <Empty>まだ何もありません。仕事が動くと自動で載ります。</Empty>}
      {posts.slice(0, 30).map((p) => (
        <div key={p.id} className="card tight">
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="rune">{kindById(p.kind).glyph}</span>
            <span style={{ flex: 1, fontSize: 14 }}>{p.text}</span>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {kindById(p.kind).name}・{p.employeeName || '会社'}・{relTime(p.at)}
            {p.taskId && (
              <button
                type="button"
                className="btn ghost small"
                style={{ marginLeft: 8 }}
                onClick={() => go('task', p.taskId)}
              >
                その仕事へ
              </button>
            )}
            <button
              type="button"
              className="btn ghost small"
              style={{ marginLeft: 6 }}
              onClick={() => store.removeBoardPost(p.id)}
            >
              消す
            </button>
          </div>
        </div>
      ))}

      {/* 軽い相談 */}
      {/* 掲示板の棚卸し（溜めるだけにしない） */}
      {promotions.length > 0 && (
        <>
          <SectionTitle>掲示板の棚卸し</SectionTitle>
          <p className="muted" style={{ marginTop: -6 }}>
            掲示は{BOARD_TTL_DAYS}日で消えます。消えると困るものは、ここで
            <strong style={{ color: '#fff' }}>会社のルール</strong>か
            <strong style={{ color: '#fff' }}>知識</strong>へ移してください。
            勝手には移しません。
          </p>
          {promotions.map((pm) => (
            <div key={pm.postIds[0]} className="card tight">
              <div style={{ fontSize: 14 }}>{pm.text}</div>
              <div className="muted" style={{ marginTop: 4 }}>{pm.why}</div>
              <div className="btn-row" style={{ marginTop: 8 }}>
                {pm.kind === 'rule' ? (
                  <button
                    type="button"
                    className="btn small primary"
                    onClick={() => makeRule(pm.text)}
                  >
                    会社のルールにする
                  </button>
                ) : (
                  <button type="button" className="btn small" onClick={() => go('ingest', { text: pm.text })}>
                    知識として残す
                  </button>
                )}
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => pm.postIds.forEach((id) => store.removeBoardPost(id))}
                >
                  もう要らない
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* つまずき集（同じ失敗を繰り返さない） */}
      <SectionTitle>つまずき集（{pits.length}）</SectionTitle>
      <p className="muted" style={{ marginTop: -6 }}>
        失敗した手順が<strong style={{ color: '#fff' }}>役職ごとに</strong>ここへ貯まります。
        同じ役職の社員は、仕事を始める前に新しい3件を必ず読みます。
        掲示板と違って消えません（不要になったら手で消してください）。
      </p>
      {!pits.length && <Empty>まだありません。失敗するとここに貯まります。</Empty>}
      {pits.slice(0, 10).map((x) => (
        <div key={x.id} className="card tight">
          <div style={{ fontSize: 14 }}>
            {x.text}
            {(x.count || 1) > 1 && <span className="badge warn" style={{ marginLeft: 6 }}>{x.count}回</span>}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {x.roleName || roleById(x.roleId)?.name || '役職不明'}
            {x.taskTitle ? `／「${x.taskTitle}」` : ''}
            {x.at ? `・${relTime(x.at)}` : ''}
          </div>
          <div className="btn-row" style={{ marginTop: 6 }}>
            {(x.count || 1) > 1 && (
              <button type="button" className="btn small" onClick={() => makeRule(x.text)}>
                会社のルールにする
              </button>
            )}
            <button type="button" className="btn small ghost" onClick={() => store.removePitfallEntry(x.id)}>
              消す
            </button>
          </div>
        </div>
      ))}
      {repeated(pits).length > 0 && (
        <p className="muted">
          ※ {repeated(pits).length}件は2回以上起きています。同じことが繰り返されるなら、
          会社のルールにした方が確実です。
        </p>
      )}

      <SectionTitle>ひとりに聞く</SectionTitle>
      <p className="muted" style={{ marginTop: -6 }}>
        会議を開くほどではない時に。<strong style={{ color: '#fff' }}>AIを1回だけ</strong>呼び、
        答えは3行までです（会議は「人数×2＋1回」かかります）。答えは掲示板に載ります。
      </p>
      <Card className="tight">
        <Field label="誰に聞くか">
          <select className="select" value={askWho} onChange={(e) => setAskWho(e.target.value)}>
            <option value="">選んでください</option>
            {people.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}（{roleById(e.roleId)?.name || ''}）
              </option>
            ))}
          </select>
        </Field>
        <Field label="聞きたいこと">
          <textarea
            className="textarea"
            style={{ minHeight: 60 }}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例：この価格で出して大丈夫だと思う？"
          />
        </Field>
        <button
          type="button"
          className="btn primary block"
          disabled={busy || !askWho || !question.trim()}
          onClick={ask}
        >
          {busy ? '聞いています…' : '聞く（AIを1回呼びます）'}
        </button>
      </Card>

      <SectionTitle>それでも足りないとき</SectionTitle>
      <button type="button" className="btn block" onClick={() => go('meeting')}>
        ◎ AI会議を開く（いちばん費用がかかります）
      </button>
      <p className="muted">
        掲示板・朝会・ひとりに聞く、で足りない時だけ会議にしてください。
        会議は参加人数×2＋1回ぶんAIを呼びます。
      </p>
    </div>
  );
}
