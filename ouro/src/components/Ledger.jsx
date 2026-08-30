// 仕事台帳。全部の仕事を1枚で見て、手当てが要るものから片付ける画面。
//
// 列も並びも絞り込みも **lib/ledger.js が単一の正**（この画面には持たない）。
// ここが持つのは、見た目と操作だけ。

import { useMemo, useRef, useState } from 'react';
import { Card, SectionTitle, Empty, Field } from './ui.jsx';
import Window from './Window.jsx';
import { useAllTasks } from './useAllTasks.js';
import {
  buildLedger,
  filterLedger,
  todayFocus,
  LEDGER_STATES,
  ledgerState,
  DUE_LABELS,
} from '../lib/ledger.js';
import { LEDGER_COLUMNS, csvRows, readLedgerCsv } from '../lib/ledgerCsv.js';
import { csvFile, csvToObjects } from '../lib/csv.js';
import { relTime } from '../lib/format.js';

// 行の高さ。**CSS の .ledger-row と必ずそろえること**
// （片方だけ直すと、行が増えるほど位置がずれて空白が出る）。
// 中身 86px ＋ 下の余白 8px。
const ROW_H = 94;
const WINDOW_FROM = 40; // これを超えたら見えている範囲だけ描く

export default function Ledger({ store, go, toast }) {
  // 台帳は「全部の仕事」を見る画面なので、残りを読み足す
  const loaded = useAllTasks(store);
  const [filter, setFilter] = useState({ due: '', state: '', decisionsOnly: false, openOnly: true, q: '' });
  const fileRef = useRef(null);

  const rows = useMemo(
    () => buildLedger(store.tasks, { deals: store.deals, requireShare: store.settings.requireShare !== false }),
    [store.tasks, store.deals, store.settings.requireShare]
  );
  const focus = useMemo(() => todayFocus(rows), [rows]);
  const shown = useMemo(() => filterLedger(rows, filter), [rows, filter]);

  const counts = useMemo(() => {
    const c = {};
    for (const r of rows) c[r.state] = (c[r.state] || 0) + 1;
    return c;
  }, [rows]);

  const exportCsv = () => {
    const text = csvFile(LEDGER_COLUMNS, csvRows(shown));
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ouro-台帳-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${shown.length}件を書き出しました`);
  };

  const importCsv = async (file) => {
    if (!file) return;
    const text = await file.text();
    const objects = csvToObjects(text);
    const plan = readLedgerCsv(objects, store.tasks);
    const hit = plan.filter((p) => p.taskId);
    if (!hit.length) {
      toast('受付番号が一致する仕事がありませんでした');
      return;
    }
    // 取り込みは必ず確認を出す（何が書き換わるかを先に伝える）
    const ok = window.confirm(
      `${hit.length}件の仕事の「期限・次の対応・保留」を、このCSVの内容で書き換えます。\n` +
        '（仕事そのものは作られません・消えません）\n\nよろしいですか？'
    );
    if (!ok) return;
    let n = 0;
    let unread = 0;
    for (const p of hit) {
      const patch = {};
      if (p.hasDue) patch.dueAt = p.dueAt;
      if (p.dueUnread) unread += 1;
      if (p.nextAction) patch.nextAction = p.nextAction;
      if (Object.keys(patch).length) store.setTaskMeta(p.taskId, patch);
      if (p.hold) store.holdTask(p.taskId, p.holdReason || 'CSVから保留');
      else if (p.resume) store.resumeTask(p.taskId);
      n += 1;
    }
    // 読めなかった日付は黙って捨てない（消したのか読めなかったのか分からなくなる）
    toast(unread ? `${n}件を取り込みました（${unread}件の期限は読めず、そのままです）` : `${n}件を取り込みました`);
  };

  const chip = (key, value, label) => (
    <button
      key={`${key}:${value}:${label}`}
      type="button"
      className={`chip ${filter[key] === value ? 'on' : ''}`}
      onClick={() => {
        const next = { ...filter, [key]: filter[key] === value ? '' : value };
        // 「完了」「中止」を選んだのに「終わっていないものだけ」が効いていると、
        // 何も出ないまま理由が分からない。選んだ方を優先する。
        if (key === 'state' && (value === 'done' || value === 'cancelled') && next.state) next.openOnly = false;
        setFilter(next);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="screen fade-in">
      <Card glyph="▤" title="仕事台帳">
        <p className="muted" style={{ marginTop: -6 }}>
          受け付けた仕事を1枚で見る場所です。手で書き換えるのは
          <strong style={{ color: '#fff' }}>期限・次の対応・保留の3つだけ</strong>で、
          残りの列は仕事から自動で導いています（台帳が第2の正にならないようにするため）。
        </p>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={exportCsv}>
            CSVで書き出す（{shown.length}件）
          </button>
          <button type="button" className="btn small ghost" onClick={() => fileRef.current?.click()}>
            CSVを取り込む
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              importCsv(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          書き出したCSVはExcelでそのまま開けます（文字化けしないようBOM付き・
          セルが数式として実行されないようにしています）。
        </p>
      </Card>

      {focus.total > 0 && (
        <Card glyph="◎" title="今日やること">
          <div className="chips" style={{ marginTop: -4 }}>
            {focus.overdue.length > 0 && (
              <button type="button" className="chip on" onClick={() => setFilter({ ...filter, due: 'overdue', state: '', decisionsOnly: false })}>
                期限切れ {focus.overdue.length}
              </button>
            )}
            {focus.today.length > 0 && (
              <button type="button" className="chip on" onClick={() => setFilter({ ...filter, due: 'today', state: '', decisionsOnly: false })}>
                今日まで {focus.today.length}
              </button>
            )}
            {focus.decisions.length > 0 && (
              <button type="button" className="chip on" onClick={() => setFilter({ ...filter, decisionsOnly: true, due: '', state: '' })}>
                あなたの判断 {focus.decisions.length}
              </button>
            )}
            {focus.stopped.length > 0 && (
              <button type="button" className="chip on" onClick={() => setFilter({ ...filter, state: 'stopped', due: '', decisionsOnly: false })}>
                止まっている {focus.stopped.length}
              </button>
            )}
          </div>
        </Card>
      )}

      <Field label="さがす">
        <input
          className="input"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="受付番号・依頼・担当・案件で探す"
        />
      </Field>

      <div className="chips" style={{ marginBottom: 8 }}>
        {chip('due', 'overdue', '期限切れ')}
        {chip('due', 'today', '今日まで')}
        {chip('due', 'week', '3日以内')}
        <button
          type="button"
          className={`chip ${filter.decisionsOnly ? 'on' : ''}`}
          onClick={() => setFilter({ ...filter, decisionsOnly: !filter.decisionsOnly })}
        >
          判断待ちだけ
        </button>
        <button
          type="button"
          className={`chip ${filter.openOnly ? 'on' : ''}`}
          onClick={() => setFilter({ ...filter, openOnly: !filter.openOnly })}
        >
          終わっていないものだけ
        </button>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {LEDGER_STATES.filter((s) => counts[s.id]).map((s) => chip('state', s.id, `${s.glyph} ${s.name} ${counts[s.id]}`))}
      </div>

      <SectionTitle>
        {shown.length}件{!loaded && '（読み込み中…）'}
      </SectionTitle>

      {!shown.length && (
        <Empty>
          {rows.length ? (
            <>
              絞り込みにあてはまる仕事がありません。
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setFilter({ due: '', state: '', decisionsOnly: false, openOnly: false, q: '' })}
                >
                  {rows.length}件すべてを見る
                </button>
              </div>
            </>
          ) : (
            'まだ仕事がありません。'
          )}
        </Empty>
      )}

      {shown.length > WINDOW_FROM ? (
        <Window items={shown} rowHeight={ROW_H}>
          {(r) => <LedgerRow key={r.id} row={r} go={go} />}
        </Window>
      ) : (
        shown.map((r) => <LedgerRow key={r.id} row={r} go={go} />)
      )}
    </div>
  );
}

function LedgerRow({ row, go }) {
  const st = ledgerState(row.state);
  const dueLabel = DUE_LABELS[row.dueState];
  return (
    <button type="button" className="ledger-row" onClick={() => go('task', row.id)}>
      <div className="lg-head">
        <span className={`badge ${row.state === 'stopped' || row.dueState === 'overdue' ? 'warn' : ''}`}>
          {st.glyph} {st.name}
        </span>
        <span className="lg-ticket">{row.ticket}</span>
        {row.decisions > 0 && <span className="badge solid">判断 {row.decisions}</span>}
      </div>
      <div className="lg-title">{row.title}</div>
      <div className="lg-sub">
        {row.owner || '担当なし'}
        {row.dueAt ? `・期限 ${new Date(row.dueAt).toLocaleDateString('ja-JP')}` : '・期限なし'}
        {dueLabel ? `（${dueLabel}）` : ''}
        {row.dueFromDeal ? '※案件の締切' : ''}
        {row.dealTitle ? `・${row.dealTitle}` : ''}
      </div>
      <div className="lg-sub">
        {row.holdReason ? `‖ ${row.holdReason}` : row.nextAction ? `→ ${row.nextAction}` : ''}
        {row.updatedAt ? `・${relTime(row.updatedAt)}` : ''}
      </div>
    </button>
  );
}
