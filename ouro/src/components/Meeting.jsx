// AI会議。複数の社員に意見 → 反論 → 統合、をさせる。
// ユーザーはいつでも割り込める（最終決定は人間）。

import { useState } from 'react';
import { Card, Field, SectionTitle, Row, Empty, Doc, Bar } from './ui.jsx';
import { MEETING_PHASES, meetingProgress, estimatedCalls, hasGuard, GUARD_ROLE_IDS } from '../lib/meeting.js';
import { weeklyTopic } from '../lib/briefing.js';
import { roleById } from '../data/roles.js';
import { relTime, usd } from '../lib/format.js';

const TOPICS = [
  '今の自分の状況で、来月までに収入を作るなら何をすべきか',
  '新しいアプリを作るべきか',
  'この案件を受けるべきか、断るべきか',
];

export default function Meeting({ store, go }) {
  const [topic, setTopic] = useState('');
  const [starting, setStarting] = useState(false);
  const [picked, setPicked] = useState(() =>
    ['researcher', 'analyzer', 'strategist', 'reviewer']
      .map((r) => store.activeEmployees.find((e) => e.roleId === r))
      .filter(Boolean)
      .map((e) => e.id)
  );

  const pickedPeople = picked
    .map((id) => store.activeEmployees.find((e) => e.id === id))
    .filter(Boolean);
  // **全員が賛成する会議は、開いた意味がない。** 守り役が入っているか確かめる。
  const guarded = hasGuard(pickedPeople);
  const guardCandidates = store.activeEmployees.filter(
    (e) => GUARD_ROLE_IDS.includes(e.roleId) && !picked.includes(e.id)
  );

  // **startMeeting は非同期**（材料を組み立てる所を後から読むため）。
  // await を忘れると mtg が Promise になり、会議が始まらない（実際に踏んだ）。
  const start = async (kind = 'free', useTopic = topic) => {
    if (!useTopic.trim() || picked.length < 2 || starting) return;
    setStarting(true);
    try {
      const mtg = await store.startMeeting({ topic: useTopic, employeeIds: picked, kind });
      if (!mtg) return;
      go('meetingDetail', mtg.id);
      store.runMeeting(mtg.id);
    } finally {
      setStarting(false);
    }
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
        <button
          type="button"
          className="btn small block"
          style={{ marginBottom: 10 }}
          onClick={() => start('weekly', weeklyTopic())}
          disabled={picked.length < 2 || starting}
        >
          ▤ 今週の振り返り会を開く（台帳と数字を全員に配ります）
        </button>
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

        {/* 反対役（守り）がいない会議は、賛成が並ぶだけで終わる。
            止めはしないが、必ず知らせる。 */}
        {picked.length >= 2 && !guarded && (
          <div className="card tight" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14 }}>⚠ 反対役がいません</div>
            <div className="muted" style={{ marginTop: 4 }}>
              全員が賛成する会議は、開いた意味がありません。
              危ういところを指摘する役（レビュアー・分析ガバナンス・セキュリティ）を1人入れてください。
            </div>
            {guardCandidates.length > 0 && (
              <div className="chips" style={{ marginTop: 8 }}>
                {guardCandidates.slice(0, 4).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="chip"
                    onClick={() => setPicked([...picked, e.id])}
                  >
                    ＋ {e.shortName}（{roleById(e.roleId)?.name}）
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn primary block"
          onClick={() => start('free')}
          disabled={!topic.trim() || picked.length < 2 || starting}
        >
          会議をはじめる（AIを約{estimatedCalls(picked.length)}回呼びます）
        </button>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 0 }}>
          会議はいちばん費用がかかります。まず「チーム」の掲示板・朝会・ひとりに聞く
          （どれもAI 0〜1回）で足りないか確かめてください。
        </p>
      </Card>

      <SectionTitle>これまでの会議</SectionTitle>
      {store.meetings.length ? (
        store.meetings.map((m) => (
          <Row
            key={m.id}
            glyph="◎"
            title={m.topic}
            sub={`${m.participantIds.length}人・${MEETING_STATUS[m.status] || '進行中'}・${relTime(m.createdAt)}`}
            onClick={() => go('meetingDetail', m.id)}
          />
        ))
      ) : (
        <Empty>まだ会議はありません。</Empty>
      )}
    </div>
  );
}

// 会議の状態の言葉づかい（一覧と詳細でそろえる）
const MEETING_STATUS = {
  queued: '待機中',
  awaiting_approval: '承認待ち',
  running: '進行中',
  done: '結論あり',
  cancelled: '中止',
};

export function MeetingDetail({ store, meetingId, go }) {
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
        {mtg.status === 'awaiting_approval' && (
          <p className="muted" style={{ marginBottom: 0 }}>
            費用が発生するため、承認画面であなたの確認を待っています。
          </p>
        )}
      </Card>

      {mtg.materials && (
        <details style={{ marginBottom: 12 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>
            全員に配った材料を見る（この会議は同じ材料を読んでいます）
          </summary>
          <div className="card tight" style={{ marginTop: 8 }}>
            <Doc text={mtg.materials} fold={0} />
          </div>
        </details>
      )}

      {/* 会議も途中でやめられる。止めればその先の利用料はかからない。 */}
      {busy && (
        <button
          type="button"
          className="btn ghost block"
          onClick={() => store.cancelRun()}
          style={{ marginBottom: 12 }}
        >
          やめる（ここまでの発言は残ります）
        </button>
      )}

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
            {mtg.hasGuard === false && (
              <p className="muted">
                ⚠ この会議には反対役がいませんでした。賛成が並んでいないか、ご自身で確かめてください。
              </p>
            )}
            <Doc text={mtg.conclusion} />
            <div className="btn-row" style={{ marginTop: 10 }}>
              {!mtg.knowledgeId ? (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    const k = store.saveMeetingAsKnowledge(mtg.id);
                    if (k) go('knowledgeDetail', k.id);
                  }}
                >
                  結論を知識として残す
                </button>
              ) : (
                <button type="button" className="btn small" onClick={() => go('knowledgeDetail', mtg.knowledgeId)}>
                  知識として見る
                </button>
              )}
              <button type="button" className="btn small ghost" onClick={() => go('team')}>
                掲示板を見る
              </button>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              決まったことは社内掲示板にも載りました。次に動く社員が読んでから仕事をします。
            </p>
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
