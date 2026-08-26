// ホーム＝会社の司令室。
// 「今どうなっているか」と「次に何をするか」を、開いた瞬間に分かるようにする。

import { Suspense, lazy, useMemo } from 'react';
import { Card, Row, Stat, SectionTitle, Empty, Bar, Skeleton } from './ui.jsx';
import { relTime, usd } from '../lib/format.js';
import { taskProgress, TASK_STATUS } from '../lib/workflow.js';
import { backupReminder } from '../lib/backup.js';
import { availableProviders } from '../lib/providers/index.js';
import { buildLedger, todayFocus } from '../lib/ledger.js';
import { starterProgress } from '../lib/onboarding.js';
import { inventoryDraft } from '../lib/onboarding.js';

const HomeBelow = lazy(() => import('./HomeBelow.jsx'));
import Seal from './Seal.jsx';

export default function Home({ store, go }) {
  const {
    company,
    tasks,
    knowledge,
    employees,
    activeEmployees,
    approvals,
    deals,
    audit,
    secrets,
  } = store;

  const running = tasks.filter((t) => ['running', 'queued', 'awaiting_approval'].includes(t.status));
  const doneToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return tasks.filter((t) => t.status === 'done' && (t.finishedAt || 0) >= start.getTime());
  }, [tasks]);

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const busyIds = new Set(running.flatMap((t) => (t.steps || []).map((s) => s.employeeId)));
  const engines = availableProviders(secrets).filter((p) => p.needsKey);
  // **操作履歴から数え直さない。** 履歴は起動時に新しい400件しか読まないので、
  // 数え直すと実際より小さく出る。log() が設定に積み上げた値を使う。
  const spent = Number(store.settings.costTotalUsd) || 0;
  // 「今日やること」＝期限切れ・今日まで・あなたの判断・止まっているもの。
  // **ここは起動時に読んだぶん（新しい120件）だけで数える。**
  // ホームで全件を読み足すと、仕事が増えるほど起動が遅くなるため。
  // 全部を見るときは台帳（useAllTasks で読み足す）へ。
  const focus = useMemo(() => todayFocus(buildLedger(tasks, { deals })), [tasks, deals]);

  // 最初の道しるべ。**チェックは手で付けさせず、実際の状態から導く**。
  // 7つ全部済むと、この案内は自動で出なくなる。
  const starter = useMemo(
    () => starterProgress({ company, tasks, employees, funnel: store.funnel, settings: store.settings }),
    [company, tasks, employees, store.funnel, store.settings]
  );

  const remind = backupReminder({
    lastExportAt: store.settings.lastExportAt,
    items: knowledge.length + deals.length,
  });

  return (
    <div className="screen fade-in">
      {/* 会社の名札 */}
      <div style={{ textAlign: 'center', margin: '4px 0 18px' }}>
        <Seal size={104} />
        <div className="serif" style={{ fontSize: 26, letterSpacing: '0.24em', marginTop: -4 }}>
          Ouro
        </div>
        <div className="muted" style={{ letterSpacing: '0.18em', fontSize: 11 }}>
          {company?.name || 'あなたのAI会社'}
        </div>
      </div>

      {/* AIエンジン未接続の案内（お金が無くても動くことを最初に伝える） */}
      {engines.length === 0 && (
        <Card glyph="✳" title="AIエンジンが未接続です">
          <p className="muted" style={{ marginTop: 0 }}>
            今は「ローカル社員」が仕事の型だけを組み立てます。
            エンジン（Claude / ChatGPT / Gemini）を1つ接続すると、社員が実際に考えはじめます。
            キーはあなたのものを端末内に保存します。
          </p>
          <button type="button" className="btn block" onClick={() => go('settings')}>
            エンジンを接続する
          </button>
        </Card>
      )}

      {/* 書き出しの促し —— サーバーが無いので、端末が壊れたら復旧手段はこれだけ。
          判定は lib/backup.js（画面には条件を書かない）。 */}
      {remind.show && (
        <Card glyph="⇧" title="バックアップを取りましょう">
          <p className="muted" style={{ marginTop: 0 }}>
            {remind.reason}。このアプリのデータは端末の中だけにあります。
            機種変更や、ブラウザのデータ消去で失わないよう、書き出して保管してください。
          </p>
          <button type="button" className="btn block" onClick={() => go('settings')}>
            書き出す
          </button>
        </Card>
      )}

      {/* 最初の道しるべ（7つ済むと消える） */}
      {starter.next && !store.settings.starterHidden && (
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
      )}

      {/* 今日やること（期限切れ・今日まで・判断待ち・止まっているもの） */}
      {focus.total > 0 && (
        <Card glyph="◎" title="今日やること">
          <div className="chips" style={{ marginTop: -4, marginBottom: 8 }}>
            {focus.overdue.length > 0 && <span className="chip on">期限切れ {focus.overdue.length}</span>}
            {focus.today.length > 0 && <span className="chip on">今日まで {focus.today.length}</span>}
            {focus.decisions.length > 0 && <span className="chip on">あなたの判断 {focus.decisions.length}</span>}
            {focus.stopped.length > 0 && <span className="chip on">止まっている {focus.stopped.length}</span>}
          </div>
          {/* 期限切れと判断待ちは重なりうる（同じ仕事が両方に入る）。
              そのまま並べると同じ行が2回出て件数も二重になるので、id で畳む。 */}
          {dedupeById([...focus.overdue, ...focus.today, ...focus.decisions])
            .slice(0, 3)
            .map((r) => (
            <button key={r.id} type="button" className="row" onClick={() => go('task', r.id)}>
              <span className="g">{r.decisions ? '⚖' : '⏳'}</span>
              <span className="body">
                <span className="t">{r.title}</span>
                <span className="s">
                  {r.nextAction}
                  {r.dueAt ? `・期限 ${new Date(r.dueAt).toLocaleDateString('ja-JP')}` : ''}
                </span>
              </span>
              <span className="arrow">›</span>
            </button>
            ))}
          <button type="button" className="btn small block" onClick={() => go('ledger')}>
            台帳で全部見る
          </button>
        </Card>
      )}

      {/* 承認待ち（最優先） */}
      {pendingApprovals.length > 0 && (
        <Card glyph="⚖" title={`承認待ち ${pendingApprovals.length}件`}>
          <p className="muted" style={{ marginTop: 0 }}>
            最終判断はあなたが行います。内容を見て決めてください。
          </p>
          <button type="button" className="btn primary block" onClick={() => go('approvals')}>
            確認する
          </button>
        </Card>
      )}

      {/* 今日の状況 */}
      <div className="stats" style={{ marginBottom: 14 }}>
        <Stat value={activeEmployees.length} label="AI社員" />
        <Stat value={busyIds.size} label="稼働中" />
        <Stat value={doneToday.length} label="今日の完了" />
        <Stat value={knowledge.length} label="知識" />
      </div>

      {/* 進行中の仕事 */}
      <SectionTitle>進行中の仕事</SectionTitle>
      {running.length ? (
        running.slice(0, 4).map((t) => (
          <button key={t.id} type="button" className="row" onClick={() => go('task', t.id)}>
            <span className="g">{t.status === 'awaiting_approval' ? '⚖' : '⟳'}</span>
            <span className="body">
              <span className="t">{t.title}</span>
              <span className="s">
                {TASK_STATUS[t.status]}・{(t.steps || []).length}人が担当
              </span>
              <Bar pct={taskProgress(t)} />
            </span>
            <span className="arrow">›</span>
          </button>
        ))
      ) : (
        <Empty>
          進行中の仕事はありません。
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => go('compose')}>
              AI社員に依頼する
            </button>
          </div>
        </Empty>
      )}

      {/* クイック操作 —— **下部ナビと会社バーから行けるものは置かない。**
          常に見えている入口を重ねると、いちばん見てほしい「次にやること」が
          下へ押し下がる。ここに足したくなったら、まずナビを見直すこと。 */}
      <SectionTitle>ここからしか行けない操作</SectionTitle>
      <div className="btn-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {QUICK.map((q) => (
          <button key={q.view} type="button" className="btn" onClick={() => go(q.view)}>
            {q.label}
          </button>
        ))}
      </div>

      {/* ここから下は最初の画面に要らないので、描き終えてから読む（項目01）。
          お金・循環・提案・予定はスクロールしないと見えない位置にある。 */}
      <Suspense fallback={<Skeleton rows={4} />}>
        <HomeBelow store={store} go={go} />
      </Suspense>
    </div>
  );
}

// ホームのクイック操作。
// **下部ナビ（ホーム／目次／社員／依頼／予定／知識）と、
//   会社バーから開ける画面は入れない。** 重複した入口は迷いを増やすだけ。
// 増やす前に「ナビか会社バーから行けないか」を必ず確かめること。
const QUICK = [
  { view: 'meeting', label: '◎ AI会議' },
  { view: 'ingest', label: '⇩ 情報を追加' },
  { view: 'hire', label: '＋ 社員を雇う' },
  { view: 'deals', label: '¥ 案件・収益' },
];

function dedupeById(rows) {
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
}
