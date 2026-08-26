// AI会議。複数の社員に意見 → 反論 → 統合、をさせる。
// ユーザーはいつでも割り込める（最終決定は人間）。

import { useState } from 'react';
import { Card, Field, SectionTitle, Row, Empty, Doc, Bar } from './ui.jsx';
import { MEETING_PHASES, meetingProgress } from '../lib/meeting.js';
import { relTime, usd } from '../lib/format.js';

const TOPICS = [
  '今の自分の状況で、来月までに収入を作るなら何をすべきか',
  '新しいアプリを作るべきか',
  'この案件を受けるべきか、断るべきか',
];

export default function Meeting({ store, go }) {
  const [topic, setTopic] = useState('');
  const [picked, setPicked] = useState(() =>
    ['researcher', 'analyzer', 'strategist', 'reviewer']
      .map((r) => store.activeEmployees.find((e) => e.roleId === r))
      .filter(Boolean)
      .map((e) => e.id)
  );

  const start = () => {
    if (!topic.trim() || picked.length < 2) return;
    const mtg = store.startMeeting({ topic, employeeIds: picked });
    go('meetingDetail', mtg.id);
    store.runMeeting(mtg.id);
  };

  return (
    <div className="screen fade-in">
      <Card glyph="◎" title="AI会議を開く">
        <p className="muted" style={{ marginTop: -6 }}>
          複数の社員が、意見 → 反論 → 統合の順に話し合います。
          結論はあなたが決めるための材料であり、会社の決定ではありません。
        </p>
        <Field label="議題">
          <textarea
            className="textarea"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例：新しいアプリを作るべきか？"
            style={{ minHeight: 84 }}
          />
        </Field>
        <div className="chips" style={{ marginBottom: 14 }}>
          {TOPICS.map((t) => (
            <button key={t} type="button" className="chip" onClick={() => setTopic(t)}>
              {t.length > 20 ? `${t.slice(0, 20)}…` : t}
            </button>
          ))}
        </div>

        <Field label={`参加する社員（${picked.length}人）`} hint="2人以上。多いほど時間と費用がかかります。">
          <div className="chips">
            {store.activeEmployees.map((e) => {
              const on = picked.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== e.id) : [...picked, e.id])}
                >
                  {e.avatar} {e.shortName}
                </button>
              );
            })}
          </div>
        </Field>

        <button
          type="button"
          className="btn primary block"
          onClick={start}
          disabled={!topic.trim() || picked.length < 2}
        >
          会議をはじめる（{picked.length * 2 + 1}回の発言）
        </button>
      </Card>

      <SectionTitle>これまでの会議</SectionTitle>
      {store.meetings.length ? (
        store.meetings.map((m) => (
          <Row
            key={m.id}
            glyph="◎"
            title={m.topic}
            sub={`${m.participantIds.length}人・${m.status === 'done' ? '結論あり' : '進行中'}・${relTime(m.createdAt)}`}
            onClick={() => go('meetingDetail', m.id)}
          />
        ))
      ) : (
        <Empty>まだ会議はありません。</Empty>
      )}
    </div>
  );
}

export function MeetingDetail({ store, meetingId }) {
  const mtg = store.meetings.find((m) => m.id === meetingId);
  const [note, setNote] = useState('');
  if (!mtg) return <div className="screen"><Empty>会議が見つかりません。</Empty></div>;

  const busy = store.busy && store.busy.meetingId === mtg.id;

  return (
    <div className="screen fade-in">
      <Card glyph="◎" title={mtg.topic}>
        <Bar pct={meetingProgress(mtg)} />
        <div className="muted" style={{ marginTop: 6 }}>
          {mtg.participantIds.length}人・{relTime(mtg.createdAt)}
          {mtg.totalCost > 0 && `・${usd(mtg.totalCost)}`}
          {busy && <> ・<span className="spinner" /> 進行中</>}
        </div>
      </Card>

      {MEETING_PHASES.map((phase) => {
        const rounds = mtg.rounds.filter((r) => r.phase === phase.id);
        if (!rounds.length) return null;
        return (
          <div key={phase.id}>
            <SectionTitle>{phase.name}</SectionTitle>
            {rounds.map((r) => (
              <Card key={r.id} className="tight">
                <div style={{ fontSize: 13.5, marginBottom: 4 }}>
                  <span className="rune">◉</span> {r.employeeName}
                </div>
                <Doc text={r.text} />
              </Card>
            ))}
          </div>
        );
      })}

      {mtg.status === 'done' && (
        <>
          <SectionTitle>オーナーへ</SectionTitle>
          <Card>
            <p className="muted" style={{ marginTop: 0 }}>
              決めるのはあなたです。会議はそのための材料です。
            </p>
            <Doc text={mtg.conclusion} />
          </Card>
        </>
      )}

      <SectionTitle>会議に割り込む</SectionTitle>
      <Card className="tight">
        <Field label="補足・軌道修正を伝える">
          <textarea
            className="textarea"
            style={{ minHeight: 70 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：予算はゼロ、時間は平日夜だけという前提で考え直して"
          />
        </Field>
        <button
          type="button"
          className="btn block"
          disabled={!note.trim() || busy}
          onClick={() => {
            store.patchMeeting({
              ...mtg,
              interventions: [...mtg.interventions, { at: Date.now(), text: note }],
              rounds: [],
              conclusion: '',
              status: 'queued',
            });
            setNote('');
            store.runMeeting(mtg.id);
          }}
        >
          この前提で会議をやり直す
        </button>
      </Card>

      {mtg.interventions.length > 0 && (
        <p className="muted">
          あなたの割り込み：{mtg.interventions.map((i) => i.text).join(' / ')}
        </p>
      )}
    </div>
  );
}
