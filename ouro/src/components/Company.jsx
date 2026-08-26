// 会社の画面。ダッシュボード・道具・承認・監査ログ・設定への入口。

import { useEffect, useState } from 'react';
import { Card, Row, SectionTitle, Stat, Spark } from './ui.jsx';
import { cycleStats, growthSeries } from '../lib/cycle.js';
import { verifiedRate } from '../lib/knowledge.js';
import { usd, relTime } from '../lib/format.js';
import { planById, connectionLimit } from '../data/plans.js';
import { availableProviders } from '../lib/providers/index.js';
import { ROLES } from '../data/roles.js';
import * as perf from '../lib/perf.js';
import { storageEstimate, isStorageTight } from '../lib/storage.js';

export default function Company({ store, go }) {
  const { company, tasks, knowledge, activeEmployees, audit, approvals, connections, deals } = store;
  const plan = planById(company?.planId);
  const limit = connectionLimit(company?.planId, company?.limitOverrides);
  const connected = connections.filter((c) => c.enabled).length;
  const pending = approvals.filter((a) => a.status === 'pending').length;
  const engines = availableProviders(store.secrets).filter((p) => p.needsKey);

  const weekAgo = Date.now() - 7 * 86400000;
  const doneWeek = tasks.filter((t) => t.status === 'done' && (t.finishedAt || 0) >= weekAgo).length;
  const newWeek = knowledge.filter((k) => k.createdAt >= weekAgo).length;
  const activeCount = activeEmployees.filter((e) => (e.stats?.tasks || 0) > 0).length;
  const utilization = activeEmployees.length
    ? Math.round((activeCount / activeEmployees.length) * 100)
    : 0;

  const stages = cycleStats({ tasks, knowledge });
  const series = growthSeries(knowledge, 21);

  return (
    <div className="screen fade-in">
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div className="serif" style={{ fontSize: 20, letterSpacing: '0.1em' }}>
          {company?.name}
        </div>
        <div className="muted">
          設立 {company ? new Date(company.foundedAt).toLocaleDateString('ja-JP') : '—'}・{plan?.name}プラン
        </div>
      </div>

      <SectionTitle>会社の成長</SectionTitle>
      <div className="stats" style={{ marginBottom: 12 }}>
        <Stat value={activeEmployees.length} label="AI社員" />
        <Stat value={doneWeek} label="今週の完了" />
        <Stat value={knowledge.length} label="保存知識" />
        <Stat value={newWeek} label="今週の新規知識" />
        <Stat value={`${utilization}%`} label="社員稼働率" />
        <Stat value={`${verifiedRate(knowledge)}%`} label="検証済み" />
        <Stat value={usd(Number(store.settings.costTotalUsd) || 0)} label="累計AI費用" />
        <Stat value={deals.length} label="案件" />
      </div>

      <Card glyph="⟳" title="知識の成長">
        <Spark series={series} />
        <div className="muted">直近21日の累計。働くほど右肩上がりになります。</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, textAlign: 'center' }}>
          {stages.map((s) => (
            <div key={s.id} style={{ flex: 1 }}>
              <div className="serif mono-num" style={{ fontSize: 17 }}>{s.count}</div>
              <div className="muted" style={{ fontSize: 10 }}>{s.name}</div>
            </div>
          ))}
        </div>
      </Card>

      <SectionTitle>会社の管理</SectionTitle>
      <Row
        glyph="▦"
        title="仕事台帳"
        sub="受け付けた仕事を1枚で見る・CSVで書き出す"
        preload="ledger"
        onClick={() => go('ledger')}
      />
      <Row
        glyph="⚖"
        title="承認待ち"
        sub={pending ? `${pending}件があなたの判断を待っています` : '待っているものはありません'}
        preload="approvals"
        onClick={() => go('approvals')}
      />
      <Row
        glyph="⚒"
        title="会社で使える道具"
        sub={`${connected} / ${limit} 接続中・エンジン${engines.length}種`}
        preload="connect"
        onClick={() => go('connect')}
      />
      <Row glyph="▤" title="操作履歴（Audit Log）" sub={`${audit.length}件の記録`} preload="audit"
        onClick={() => go('audit')} />
      <Row glyph="⚙" title="設定" sub="AIエンジン・プラン・データの持ち出し" preload="settings"
        onClick={() => go('settings')} />
      <Row glyph="▤" title="目次" sub="社員・役職・ジャンル・道具を読みで引く" preload="toc"
        onClick={() => go('toc')} />
      <Row glyph="◈" title="ジャンル" sub="担当する分野を足す・見直す" preload="genre"
        onClick={() => go('genre')} />
      <Row glyph="◍" title="AIキャラクター名鑑" sub="事業を回す10役割 × 各3名（全30名）" preload="characters"
        onClick={() => go('characters')} />

      <SectionTitle>役職ごとの在籍</SectionTitle>
      <Card className="tight">
        {ROLES.filter((r) => activeEmployees.some((e) => e.roleId === r.id) || r.core).map((r) => {
          const n = activeEmployees.filter((e) => e.roleId === r.id).length;
          return (
            <div
              key={r.id}
              style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, padding: '3px 0' }}
            >
              <span className="rune" style={{ width: 20 }}>{r.glyph}</span>
              <span style={{ flex: 1 }}>{r.name}</span>
              <span className="mono-num dim">{n}人</span>
            </div>
          );
        })}
      </Card>

      <SectionTitle>速さの記録</SectionTitle>
      <StorageCard />
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>
          この端末での実測です。遅くなった時に気づけるように残しています（外へは送りません）。
        </p>
        {perf.summary().length ? (
          perf.summary().map((s) => (
            <div key={s.category} style={{ padding: '3px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13.5 }}>
                <span style={{ flex: 1 }}>{perf.CATEGORY_LABEL[s.category] || s.category}</span>
                <span className="mono-num dim">中央 {s.median}ms</span>
                <span className="mono-num dim">最悪 {s.worst}ms</span>
                <span className="muted" style={{ fontSize: 11 }}>{s.count}回</span>
              </div>
              {/* 新項目28：いちばん遅かった時の状況。数字だけでは直す手がかりにならない。 */}
              {s.worstNote && (
                <div className="muted" style={{ fontSize: 11 }}>
                  最悪だった時：{Object.entries(s.worstNote)
                    .filter(([, v]) => v !== '' && v != null)
                    .map(([k, v]) => `${k} ${v}`)
                    .join('・')}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="muted">まだ記録がありません。画面を切り替えると溜まります。</div>
        )}
      </Card>

      <SectionTitle>最近の動き</SectionTitle>
      <Card className="tight">
        {audit.slice(-8).reverse().map((e) => (
          <div key={e.id} className="muted" style={{ padding: '2px 0' }}>
            {relTime(e.at)}・{nameOf(store, e.actor)}が{labelOf(e.action)}
            {e.target ? `：${e.target}` : ''}
          </div>
        ))}
        {!audit.length && <div className="muted">まだ記録がありません。</div>}
      </Card>
    </div>
  );
}

function nameOf(store, actor) {
  if (actor === 'user') return 'あなた';
  const e = store.employees.find((x) => x.id === actor);
  return e ? e.shortName : '社員';
}

function labelOf(action) {
  return (
    {
      taskCreated: '仕事を受けた',
      stepRun: '実行した',
      stepFailed: '失敗した',
      knowledgeCreated: '知識を作った',
      knowledgeUpdated: '知識を更新した',
      knowledgeDeleted: '知識を削除した',
      employeeHired: '社員を雇った',
      employeeArchived: '社員を休職にした',
      approvalRequested: '承認を求めた',
      approvalGranted: '承認した',
      approvalDenied: '却下した',
      connectionChanged: '道具を変えた',
      dealChanged: '案件を更新した',
      meetingHeld: '会議を開いた',
    }[action] || action
  );
}

/**
 * 保存容量の見張り（新項目10）。
 * 書けなくなってから気づくのを防ぐため、残りが少なくなったら知らせる。
 * ブラウザが教えてくれない端末では、そもそも何も出さない（憶測で不安にさせない）。
 */
function StorageCard() {
  const [est, setEst] = useState(null);
  useEffect(() => {
    let alive = true;
    storageEstimate().then((v) => alive && setEst(v));
    return () => {
      alive = false;
    };
  }, []);
  if (!est) return null;

  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;
  const tight = isStorageTight(est);
  return (
    <Card className="tight">
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13.5 }}>
        <span style={{ flex: 1 }}>この端末の保存容量</span>
        <span className="mono-num dim">
          {mb(est.usage)} / {mb(est.quota)}
        </span>
        <span className="mono-num dim">{Math.round(est.ratio * 100)}%</span>
      </div>
      {tight && (
        <p className="muted" style={{ marginBottom: 0 }}>
          残りが少なくなっています。設定からバックアップを取り、古い知識や仕事を整理してください。
          いっぱいになると新しい保存ができなくなります。
        </p>
      )}
    </Card>
  );
}
