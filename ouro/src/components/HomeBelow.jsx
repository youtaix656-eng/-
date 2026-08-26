// ホームの下半分（新規）。
//
// 最初の画面に要るのは「今日やること・承認待ち・進行中の仕事」までで、
// お金・循環・提案・予定はスクロールしないと見えない。
// ここを後から読むことで、起動時に読む量から
// revenue.js / cycle.js / schedule.js / knowledge.js を外している（項目01）。

import { Card, Row, Stat, SectionTitle, Empty, Spark } from './ui.jsx';
import { relTime, usd } from '../lib/format.js';
import { cycleStats, weakestStage, growthSeries } from '../lib/cycle.js';
import { verifiedRate } from '../lib/knowledge.js';
import { revenueSummary, formatMoney } from '../lib/revenue.js';
import { upcoming } from '../lib/schedule.js';
import { roleById } from '../data/roles.js';
import { availableProviders } from '../lib/providers/index.js';
import { bottleneck, latestEntry, labelOf } from '../lib/funnel.js';

export default function HomeBelow({ store, go }) {
  const { tasks, knowledge, deals, secrets, employees } = store;
  const recentKnowledge = knowledge.slice(0, 3);
  const stages = cycleStats({ tasks, knowledge });
  const weak = weakestStage(stages);
  const series = growthSeries(knowledge, 14);
  const money = revenueSummary(deals, tasks, { usdJpy: store.settings.usdJpy });
  const engines = availableProviders(secrets).filter((p) => p.needsKey);
  // **操作履歴から数え直さない。** 履歴は起動時に新しい400件しか読まないので、
  // 数え直すと実際より小さく出る。log() が設定に積み上げた値を使う。
  const spent = Number(store.settings.costTotalUsd) || 0;
  const entry = latestEntry(store.funnel);
  const neck = entry ? bottleneck(entry) : null;

  return (
    <>
      {/* 地図（どこで人が減っているか）。作業が速くなっても、
          向きがズレていれば収入にはならない。 */}
      <SectionTitle>収益導線</SectionTitle>
      {neck ? (
        <Row
          glyph="◎"
          title={`いま詰まっているのは「${labelOf(store.funnel, neck.stageId)}」`}
          sub={neck.reason}
          preload="funnel"
          onClick={() => go('funnel')}
        />
      ) : (
        <Row
          glyph="◎"
          title="収益導線に数字を入れる"
          sub="どこで人が減っているかを見ます（端末内だけに残ります）"
          preload="funnel"
          onClick={() => go('funnel')}
        />
      )}

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
    </>
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

