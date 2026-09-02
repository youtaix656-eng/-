// 会社の画面。ダッシュボード・道具・承認・監査ログ・設定への入口。

import { useEffect, useState } from 'react';
import { Card, Row, SectionTitle, Stat, Spark, Field } from './ui.jsx';
import { cycleStats, growthSeries } from '../lib/cycle.js';
import { verifiedRate } from '../lib/knowledge.js';
import { usd, relTime } from '../lib/format.js';
import { planById, connectionLimit } from '../data/plans.js';
import { availableProviders } from '../lib/providers/index.js';
import { ROLES } from '../data/roles.js';
import * as perf from '../lib/perf.js';
import { storageEstimate, isStorageTight } from '../lib/storage.js';
import { briefLines } from '../lib/brief.js';
import { recentDecisions } from '../lib/decisions.js';
import { engineStats, cheapestUsed, unreliable } from '../lib/engineStats.js';
import { handworkSplit, handworkLine } from '../lib/handwork.js';
import { offloadReview, offloadLine, offloadAdvice, CHORE_WHO } from '../lib/offload.js';
import { spentTodayOf, dailyCap, monthlyCap } from '../lib/permissions.js';

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

  // 会社の現在地（社員が仕事の前に読むものと同じ材料）
  const brief = briefLines({
    company,
    ventures: store.ventures,
    funnel: store.funnel,
    tasks,
    approvals,
    settings: store.settings,
  });
  const decisions = recentDecisions(tasks, 5);
  const engineRows = engineStats(tasks);
  const cheapest = cheapestUsed(engineRows);
  const shaky = unreliable(engineRows);
  const split = handworkSplit({ tasks, approvals, knowledge, posts: store.posts, days: 30 });
  const today = spentTodayOf(store.settings);
  const dayCap = dailyCap(store.settings);
  const monCap = monthlyCap(store.settings);

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

      {brief.length > 0 && (
        <Card glyph="◎" title="会社の現在地">
          <p className="muted" style={{ marginTop: -6 }}>
            AI社員が仕事の前に読むのと<strong style={{ color: '#fff' }}>同じ1枚</strong>です。
            全員が同じ現在地を見ていないと、それぞれ違う前提で動きます。
          </p>
          {brief.map((line) => (
            <div key={line} className="muted" style={{ fontSize: 12.5, marginBottom: 3 }}>・{line}</div>
          ))}
        </Card>
      )}

      <Card glyph="¥" title="AIに使ったお金">
        <div className="stats">
          <Stat value={usd(today)} label={dayCap > 0 ? `今日／上限 $${dayCap}` : '今日'} />
          <Stat value={usd(Number(store.settings.costMonthUsd) || 0)} label={monCap > 0 ? `今月／上限 $${monCap}` : '今月'} />
          <Stat value={usd(Number(store.settings.costTotalUsd) || 0)} label="累計" />
        </div>
        {dayCap <= 0 && (
          <p className="muted" style={{ fontSize: 11.5 }}>
            1日の上限は決めていません。月の上限だけだと、1日で使い切っても気づくのが翌日以降になります。
            設定で1日の線を引けます。
          </p>
        )}
      </Card>

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
        glyph="◍"
        title="チーム"
        sub="誰が何をしているか・朝会・社内掲示板（AI費用ゼロ）"
        preload="team"
        onClick={() => go('team')}
      />
      <Row
        glyph="⚑"
        title="事業"
        sub="いま何を売るのか・やめる基準・今日やる1つ"
        preload="ventures"
        onClick={() => go('ventures')}
      />
      <Row
        glyph="↗"
        title="発信"
        sub="型 → まとめて作る → 出す → 伸びた型を次の種にする"
        preload="studio"
        onClick={() => go('studio')}
      />
      <Row
        glyph="❏"
        title="型パック"
        sub="うまくいった流れを、売れる形（結果つき）に固める"
        preload="kits"
        onClick={() => go('kits')}
      />
      <Row
        glyph="◎"
        title="収益導線"
        sub="どこで人が減っているかを見る（数字は端末内だけ）"
        preload="funnel"
        onClick={() => go('funnel')}
      />
      <Row
        glyph="⚖"
        title="会社のルール"
        sub="全AI社員が仕事の前に必ず読むもの"
        preload="rules"
        onClick={() => go('rules')}
      />
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

      <SectionTitle>エンジンの実績</SectionTitle>
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>
          どのエンジンに・何回・いくら使ったか。
          <strong style={{ color: '#fff' }}>安いモデルで足りていた仕事</strong>を、
          自分の記録から見つけるための表です（他社の平均のような手元にない基準は使いません）。
        </p>
        {!engineRows.length && <div className="muted">まだ実行の記録がありません。</div>}
        {engineRows.map((r) => (
          <div key={`${r.providerId}|${r.model}`} className="post-row">
            <div className="p-title">
              {r.providerName}
              {r.model ? ` ／ ${r.model}` : ''}
            </div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              {r.calls}回・{usd(r.usd)}
              {r.calls ? `・1回あたり ${usd(r.usdPerCall)}` : ''}
              {r.avgChars ? `・平均${r.avgChars}字` : ''}
              {r.failed ? `・失敗${r.failed}回` : ''}
            </div>
          </div>
        ))}
        {cheapest && (
          <p className="muted" style={{ fontSize: 11.5 }}>
            いまいちばん安く済んでいるのは「{cheapest.providerName}
            {cheapest.model ? ` ／ ${cheapest.model}` : ''}」です（1回あたり {usd(cheapest.usdPerCall)}）。
            軽い仕事は依頼画面で「安いモデル」を選ぶと、ここへ寄ります。
          </p>
        )}
        {shaky.map((r) => (
          <p key={`ng:${r.providerId}|${r.model}`} className="muted" style={{ fontSize: 11.5 }}>
            ⚠ {r.providerName}{r.model ? ` ／ ${r.model}` : ''} は {r.calls}回中 {r.failed}回 失敗しています。
          </p>
        ))}
      </Card>

      <SectionTitle>AIと、あなたの手</SectionTitle>
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>{handworkLine(split)}</p>
        <div className="stats">
          <Stat value={split.ai.calls} label="AIの呼び出し" />
          <Stat value={split.human.decisions} label="あなたの判断" />
          <Stat value={split.human.approvals} label="承認" />
          <Stat value={split.human.writes} label="自分で書いた" />
          <Stat value={split.human.posts} label="外へ出した" />
          <Stat value={split.ratio === null ? '—' : split.ratio} label="AI1回あたりの手" />
        </div>
        <p className="muted" style={{ fontSize: 11.5 }}>
          AIを使えるほど、AIにできない仕事の方が自分の仕事になっていきます。
          <strong style={{ color: '#fff' }}>多い＝悪い、ではありません</strong>——
          増え方を見て、どこを任せるかを決めるための数字です。
        </p>
      </Card>

      <SectionTitle>任せたら、月いくら浮くか</SectionTitle>
      <OffloadCard store={store} />

      {decisions.length > 0 && (
        <>
          <SectionTitle>決まったこと</SectionTitle>
          <Card className="tight">
            <p className="muted" style={{ marginTop: 0 }}>
              仕事ごとに散っていた判断を、時系列で1本にしたものです。
              いちばん新しい2件は、社員が読む「会社の現在地」にも入ります。
            </p>
            {decisions.map((d) => (
              <button
                key={d.id}
                type="button"
                className="post-row"
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, borderBottom: '1px solid var(--line)', color: 'inherit' }}
                onClick={() => go('task', d.taskId)}
              >
                <div className="p-title">{d.label}：{d.text}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {d.daysAgo === 0 ? '今日' : `${d.daysAgo}日前`}・{d.taskTitle}
                  {d.note ? `・${d.note}` : ''}
                </div>
              </button>
            ))}
          </Card>
        </>
      )}

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

/**
 * 手でやっている作業の棚卸し。**「便利になった」ではなく引き算で出す。**
 * 時給・売上はユーザーが入れる（相場を初期値に置かない）。
 * 読み込みが済むまで「まだ書き出していません」と言い切らない（項目138）。
 */
function OffloadCard({ store }) {
  const { settings, chores, hydrated, updateSettings, addChore, updateChore, removeChore } = store;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', minutes: '', timesPerMonth: '' });

  const review = offloadReview({
    chores: chores || [],
    hourlyYen: settings.hourlyYen,
    revenueYen: settings.monthRevenueYen,
  });
  const advice = offloadAdvice(review);
  const yen = (n) => `\u00a5${Math.round(n).toLocaleString('ja-JP')}`;

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    addChore(form);
    setForm({ title: '', minutes: '', timesPerMonth: '' });
  };

  return (
    <Card className="tight">
      <p className="muted" style={{ marginTop: 0 }}>
        {hydrated ? offloadLine(review) : '\u8aad\u307f\u8fbc\u307f\u4e2d\u3067\u3059\u2026'}
      </p>

      <div className="stats">
        <Stat value={`${Math.round(review.mineHours * 10) / 10}h`} label="自分の手（月）" />
        <Stat value={review.mineYen === null ? '—' : yen(review.mineYen)} label="その金額（目安）" />
        <Stat value={review.netYen === null ? '—' : yen(review.netYen)} label="任せて浮いた" />
        <Stat value={review.marginPct === null ? '—' : `${review.marginPct}%`} label="売上に対して" />
      </div>

      <Field label="あなたの時給（円）" hint="相場や平均は使いません。入っていない間は、金額を出さずに時間だけ出します。">
        <input
          type="number"
          min="0"
          value={settings.hourlyYen || ''}
          placeholder="未入力"
          onChange={(e) => updateSettings({ hourlyYen: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="月の売上（円・任意）" hint="入れると、浮いた額が売上の何%にあたるかを出します。">
        <input
          type="number"
          min="0"
          value={settings.monthRevenueYen || ''}
          placeholder="未入力"
          onChange={(e) => updateSettings({ monthRevenueYen: Number(e.target.value) || 0 })}
        />
      </Field>

      <button className="ghost" onClick={() => setOpen(!open)}>
        {open ? '閉じる' : `作業を書き出す（${review.counted}件）`}
      </button>

      {open && (
        <>
          <form onSubmit={submit} style={{ marginTop: 10 }}>
            <Field label="くり返している手作業">
              <input
                value={form.title}
                placeholder="例：請求書の手打ち"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="1回あたり（分）">
              <input
                type="number"
                min="0"
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: e.target.value })}
              />
            </Field>
            <Field label="月に何回">
              <input
                type="number"
                min="0"
                value={form.timesPerMonth}
                onChange={(e) => setForm({ ...form, timesPerMonth: e.target.value })}
              />
            </Field>
            <button type="submit" disabled={!form.title.trim()}>この作業を足す</button>
          </form>

          {(chores || []).map((c) => (
            <div key={c.id} className="card tight" style={{ marginTop: 8 }}>
              <strong>{c.title}</strong>
              <p className="muted" style={{ fontSize: 11.5, margin: '4px 0' }}>
                月 {Math.round(((c.minutes * c.timesPerMonth) / 60) * 10) / 10}時間
                （{c.minutes}分 × {c.timesPerMonth}回）／ {CHORE_WHO[c.who]}
              </p>
              <button
                className="ghost"
                onClick={() => updateChore(c.id, { who: c.who === 'me' ? 'ai' : 'me' })}
              >
                {c.who === 'me' ? 'AI社員に任せた' : '自分でやっているに戻す'}
              </button>
              <button className="ghost" onClick={() => removeChore(c.id)}>消す</button>
              {c.who === 'ai' && (
                <Field label="この作業の月のAI費用（円・分かれば）" hint="入っていないと「浮いた額」が多めに出ます。">
                  <input
                    type="number"
                    min="0"
                    value={c.aiCostYen || ''}
                    placeholder="未入力"
                    onChange={(e) => updateChore(c.id, { aiCostYen: Number(e.target.value) || 0 })}
                  />
                </Field>
              )}
            </div>
          ))}
        </>
      )}

      {advice.map((a) => (
        <p key={a.title} className="muted" style={{ fontSize: 11.5 }}>
          <strong style={{ color: '#fff' }}>{a.title}</strong>：{a.body}
        </p>
      ))}
    </Card>
  );
}
