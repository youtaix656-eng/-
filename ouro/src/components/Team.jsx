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
