// ホーム＝会社の司令室。
// 「今どうなっているか」と「次に何をするか」を、開いた瞬間に分かるようにする。

import { useMemo } from 'react';
import { Card, Row, Stat, SectionTitle, Empty, Bar, Spark } from './ui.jsx';
import { relTime, usd } from '../lib/format.js';
import { taskProgress, TASK_STATUS } from '../lib/workflow.js';
import { cycleStats, weakestStage, growthSeries } from '../lib/cycle.js';
import { backupReminder } from '../lib/backup.js';
import { verifiedRate } from '../lib/knowledge.js';
import { revenueSummary, formatMoney } from '../lib/revenue.js';
import { roleById } from '../data/roles.js';
import { availableProviders } from '../lib/providers/index.js';
import { upcoming } from '../lib/schedule.js';
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
  const recentKnowledge = knowledge.slice(0, 3);
  const stages = cycleStats({ tasks, knowledge });
  const weak = weakestStage(stages);
  const series = growthSeries(knowledge, 14);
  const money = revenueSummary(deals, tasks, { usdJpy: store.settings.usdJpy });
  const engines = availableProviders(secrets).filter((p) => p.needsKey);
  // **操作履歴から数え直さない。** 履歴は起動時に新しい400件しか読まないので、
  // 数え直すと実際より小さく出る。log() が設定に積み上げた値を使う。
  const spent = Number(store.settings.costTotalUsd) || 0;
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

      <UpcomingCard store={store} go={go} />

      {/* 稼ぐ（お金の状況） */}
      <SectionTitle>お金の状況</SectionTitle>
      <Card className="tight">
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>入金済み</div>
            <div className="big-num">{formatMoney(money.earned)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>見込み</div>
            <div className="serif mono-num" style={{ fontSize: 19 }}>{formatMoney(money.expected)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>AI費用（累計）</div>
            <div className="serif mono-num" style={{ fontSize: 19 }}>{usd(spent)}</div>
          </div>
        </div>
        {deals.length === 0 && (
          <p className="muted" style={{ marginBottom: 0 }}>
            まだ案件がありません。「案件・収益」から、元手ゼロで始められる仕事の型を選べます。
          </p>
        )}

      </Card>

      {/* 知識の循環 */}
      <SectionTitle>知識の循環</SectionTitle>
      <Card className="tight">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, textAlign: 'center' }}>
          {stages.map((s) => (
            <div key={s.id} style={{ flex: 1 }}>
              <div className="rune" style={{ fontSize: 15 }}>{s.glyph}</div>
              <div className="serif mono-num" style={{ fontSize: 18 }}>{s.count}</div>
              <div className="muted" style={{ fontSize: 10 }}>{s.name}</div>
            </div>
          ))}
        </div>
        <Spark series={series} />
        {weak && weak.count === 0 && (
          <p className="muted" style={{ margin: '6px 0 0' }}>
            「{weak.name}」がまだ回っていません。ここが動くと知識が資産に変わります。
          </p>
        )}
        <div className="muted" style={{ marginTop: 6 }}>
          検証済みの知識：{verifiedRate(knowledge)}％
        </div>
      </Card>

      {/* 最近増えた知識 */}
      <SectionTitle>最近増えた知識</SectionTitle>
      {recentKnowledge.length ? (
        recentKnowledge.map((k) => (
          <Row
            key={k.id}
            glyph={k.verifiedAt ? '✓' : '◉'}
            title={k.title}
            sub={`${k.category}・${relTime(k.createdAt)}`}
            onClick={() => go('knowledgeDetail', k.id)}
          />
        ))
      ) : (
        <Empty>まだ知識がありません。仕事を1つ終えると、成果が自動で知識になります。</Empty>
      )}

      {/* AI社員からの提案 */}
      <SectionTitle>AI社員からの提案</SectionTitle>
      <Card className="tight">
        {suggestions({ tasks, knowledge, employees, deals, engines }).map((s) => (
          // 新項目16：並び順（index）を key にしない。提案の増減で全部が作り直される。
          <div key={s.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14 }}>
              <span className="rune">{roleById(s.roleId)?.glyph || '◉'}</span>{' '}
              <span className="dim">{roleById(s.roleId)?.name || '会社'}</span>：{s.text}
            </div>
            {s.action && (
              <button type="button" className="btn small" onClick={() => go(s.action, s.arg)} style={{ marginTop: 5 }}>
                {s.actionLabel}
              </button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

/** 直近の締切と予定。カレンダーを開かなくてもホームで気づけるようにする。 */
function UpcomingCard({ store, go }) {
  const soon = upcoming({ events: store.events, deals: store.deals }, Date.now(), 7);
  if (!soon.length) return null;
  return (
    <>
      <SectionTitle>これから1週間</SectionTitle>
      {soon.slice(0, 3).map((x) => (
        <Row
          key={`${x.kind}-${x.id}`}
          glyph={x.kind === 'deadline' ? '▲' : '■'}
          title={x.title}
          sub={x.daysLeft === 0 ? '今日' : `あと${x.daysLeft}日`}
          onClick={() => (x.kind === 'deadline' ? go('deal', x.id) : go('calendar'))}
        />
      ))}
    </>
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

/** 今の状態から、次にやるとよいことを2〜3件だけ出す。 */
function suggestions({ tasks, knowledge, deals, engines }) {
  const out = [];

  if (!engines.length) {
    out.push({
      id: 'engine',
      roleId: 'strategist',
      text: 'まず無料枠のあるエンジンを1つ接続すると、社員が実際に考えられます。',
      action: 'settings',
      actionLabel: 'エンジンを接続',
    });
  }
  if (!deals.length) {
    out.push({
      id: 'deal',
      roleId: 'strategist',
      text: '元手ゼロで始められる案件の型が8つあります。1つ選んで、見本を1本作るところから。',
      action: 'deals',
      actionLabel: '案件の型を見る',
    });
  }
  const unverified = knowledge.filter((k) => !k.verifiedAt).length;
  if (unverified >= 3) {
    out.push({
      id: 'verify',
      roleId: 'reviewer',
      text: `未検証の知識が${unverified}件あります。使う前に確かめると資産になります。`,
      action: 'knowledge',
      actionLabel: '知識を見る',
    });
  }
  if (!tasks.length) {
    out.push({
      id: 'firsttask',
      roleId: 'researcher',
      text: '最初の依頼は短くて構いません。「〇〇について調べて」だけで社員は動きます。',
      action: 'compose',
      actionLabel: '依頼してみる',
    });
  }
  if (out.length === 0) {
    out.push({
      id: 'steady',
      roleId: 'mentor',
      text: '順調です。今日は1件だけ知識を「検証済み」にすると、明日の仕事が速くなります。',
      action: 'knowledge',
      actionLabel: '知識を見る',
    });
  }
  return out.slice(0, 3);
}
