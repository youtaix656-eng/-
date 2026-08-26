// 仕事の依頼。自然言語で書くだけで、Ouro が担当と順番を決める。

import { useMemo, useState } from 'react';
import { Card, Field, SectionTitle, Action } from './ui.jsx';
import { WORKFLOWS } from '../data/workflows.js';
import { planSteps, detectNeeds } from '../lib/dispatcher.js';
import { roleById } from '../data/roles.js';
import { workflowById } from '../data/workflows.js';
import { availableProviders } from '../lib/providers/index.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';

const EXAMPLES = [
  'YouTubeとWebから腰痛について調べて、信頼できる情報だけまとめて',
  '今の自分のスキルで、来月までに収入を作る方法を探して',
  'このテーマでブログ記事を1本書いて。事実の誤りは潰して',
  '副業として〇〇を始めるべきか、賛成と反対の両方から考えて',
];

export default function Compose({ store, preset = {}, go }) {
  // 呼び出し元が下書きを渡せる（棚卸しなど、書き出しが決まっているもの）
  const [request, setRequest] = useState(preset.request || '');
  const [workflowId, setWorkflowId] = useState(
    preset.employeeId ? null : preset.workflowId || 'auto'
  );
  const [employeeId, setEmployeeId] = useState(preset.employeeId || null);
  const [dealId, setDealId] = useState(preset.dealId || null);
  const [genreId, setGenreId] = useState(preset.genreId || DEFAULT_GENRE_ID);
  const [context, setContext] = useState('');
  // 受付のときに決めておくと、あとで手戻りが減るもの（全部任意）。
  // 空なら今までどおり1行の依頼としてそのまま動く。
  const [spec, setSpec] = useState({ dueAt: '', deliverable: '', doneWhen: '', materials: '', constraints: '' });
  const genres = allGenres(store.genres);

  const chosenEmployee = store.employees.find((e) => e.id === employeeId);

  // 誰が担当するかを、送る前にその場で見せる（毎回考えなくて済むように）
  const plan = useMemo(() => {
    if (!request.trim()) return [];
    if (employeeId && chosenEmployee) {
      return [{ roleId: chosenEmployee.roleId, employee: chosenEmployee }];
    }
    const wf = workflowId && workflowId !== 'auto' ? workflowById(workflowId) : null;
    const forceRoles = wf && wf.steps.length ? wf.steps : null;
    return planSteps(request, { forceRoles }).map((s) => ({
      roleId: s.roleId,
      // 新項目22：同じ group の手順は同時に走る（画面でもそう見せる）
      group: s.group,
      employee: store.assignFor(s.roleId, genreId),
    }));
  }, [request, workflowId, employeeId, chosenEmployee, genreId, store]);

  const needs = detectNeeds(request);
  const engines = availableProviders(store.secrets).filter((p) => p.needsKey);

  const submit = async () => {
    if (!request.trim()) return;
    const task = store.newTask({
      request,
      workflowId: workflowId === 'auto' ? null : workflowId,
      employeeId,
      dealId,
      context,
      genreId,
      dueAt: spec.dueAt ? new Date(spec.dueAt).getTime() : null,
      deliverableSpec: spec.deliverable,
      doneWhen: spec.doneWhen,
      materials: spec.materials,
      constraints: spec.constraints,
    });
    go('task', task.id);
    store.runTask(task.id);
  };

  return (
    <div className="screen fade-in">
      <Card glyph="✎" title="AI社員に依頼する">
        <p className="muted" style={{ marginTop: -6 }}>
          誰に頼むかは決めなくて大丈夫です。書いた内容から Ouro が担当と順番を決めます。
        </p>
        <textarea
          className="textarea"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="例：YouTubeとWebから腰痛について調べて、信頼できる情報だけまとめて"
          style={{ minHeight: 130 }}
        />
        <div className="chips" style={{ marginTop: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setRequest(ex)}>
              {ex.length > 22 ? `${ex.slice(0, 22)}…` : ex}
            </button>
          ))}
        </div>
      </Card>

      {chosenEmployee ? (
        <Card glyph={chosenEmployee.avatar} title={`${chosenEmployee.name} に直接依頼`}>
          <p className="muted" style={{ marginTop: -6, marginBottom: 8 }}>
            {chosenEmployee.title}／{chosenEmployee.persona}
          </p>
          <button type="button" className="btn small" onClick={() => setEmployeeId(null)}>
            会社全体に任せる
          </button>
        </Card>
      ) : (
        <>
          <SectionTitle>どの分野の仕事か</SectionTitle>
          <p className="muted" style={{ marginTop: -4 }}>
            分野を選ぶと、その分野の社員が優先して担当します（いなければ汎用の社員が受けます）。
          </p>
          <div className="chips" style={{ marginBottom: 12 }}>
            {genres.map((g) => {
              const n = store.activeEmployees.filter((e) => (e.genreId || DEFAULT_GENRE_ID) === g.id).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`chip ${genreId === g.id ? 'on' : ''}`}
                  onClick={() => setGenreId(g.id)}
                >
                  {g.glyph} {g.name}
                  {n ? ` ${n}人` : ''}
                </button>
              );
            })}
          </div>

          <SectionTitle>仕事の進め方</SectionTitle>
          <div className="chips" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`chip ${workflowId === 'auto' ? 'on' : ''}`}
              onClick={() => setWorkflowId('auto')}
            >
              ◎ おまかせ
            </button>
            {WORKFLOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`chip ${workflowId === w.id ? 'on' : ''}`}
                onClick={() => setWorkflowId(w.id)}
              >
                {w.glyph} {w.name}
              </button>
            ))}
          </div>
          {workflowId !== 'auto' && workflowById(workflowId) && (
            <p className="muted" style={{ marginTop: -6 }}>
              {workflowById(workflowId).desc}
            </p>
          )}
        </>
      )}

      {plan.length > 0 && (
        <Card glyph="⟳" title="この順番で進みます">
          <div className="steps">
            {plan.map((p, i) => {
              const role = roleById(p.roleId);
              // 直前の手順と同じ group なら「同時に進む」と分かるように印を出す
              const together = i > 0 && p.group != null && p.group === plan[i - 1].group;
              // 未雇用の役職は実際には担当から外れる。ここでも同じように見せる。
              const vacant = !p.employee;
              return (
                <div key={p.stepId || `${p.roleId}-${i}`} className={`step ${vacant ? 'vacant' : 'done'}`}>
                  {together && <div className="muted" style={{ fontSize: 11 }}>↑ と同時に進みます</div>}
                  <div className="who">
                    {role?.glyph} {p.employee ? p.employee.name : role?.name}
                    {p.employee?.strength ? (
                      <span className="badge" style={{ marginLeft: 6 }}>{p.employee.strength}</span>
                    ) : (
                      <span className="badge" style={{ marginLeft: 6 }}>未雇用</span>
                    )}
                  </div>
                  <div className="what">
                    {role?.summary}
                    {vacant && '／まだ雇っていないので、今回は担当から外れます'}
                  </div>
                </div>
              );
            })}
          </div>
          {plan.some((p) => !p.employee) && (
            <button type="button" className="btn small" onClick={() => go('characters')}>
              ＋ 足りない役職を雇う（キャラクター名鑑）
            </button>
          )}
          {needs.length > 0 && (
            <p className="muted" style={{ marginBottom: 0 }}>
              使う道具：{needs.join('・')}
              {engines.some((p) => p.serverTools && p.serverTools.web)
                ? ''
                : '（Claude 接続時のみ実際に検索します）'}
            </p>
          )}
        </Card>
      )}

      <details style={{ marginBottom: 12 }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>受付の条件を決める（任意）</summary>
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ marginTop: 0 }}>
            ここを埋めると、社員が「何を作れば終わりなのか」を分かった状態で始められます。
            空のままでも依頼できます。
          </p>
          <Field label="期限" hint="台帳とホームの『今日やること』に出ます。">
            <input
              className="input"
              type="date"
              value={spec.dueAt}
              onChange={(e) => setSpec({ ...spec, dueAt: e.target.value })}
            />
          </Field>
          <Field label="成果物の形" hint="例：1500字の記事／比較表／メール文案">
            <input
              className="input"
              value={spec.deliverable}
              onChange={(e) => setSpec({ ...spec, deliverable: e.target.value })}
            />
          </Field>
          <Field label="これが満たせたら完成" hint="例：出典が3つ以上あり、初心者が読んで分かる">
            <input
              className="input"
              value={spec.doneWhen}
              onChange={(e) => setSpec({ ...spec, doneWhen: e.target.value })}
            />
          </Field>
          <Field label="使ってよい材料" hint="例：公式サイトと厚労省の統計だけ">
            <input
              className="input"
              value={spec.materials}
              onChange={(e) => setSpec({ ...spec, materials: e.target.value })}
            />
          </Field>
          <Field label="触れてはいけないこと" hint="例：価格を約束しない／効果を保証しない">
            <input
              className="input"
              value={spec.constraints}
              onChange={(e) => setSpec({ ...spec, constraints: e.target.value })}
            />
          </Field>
          <Field label="社員に伝えておきたい前提" hint="例：初心者向け／文字数は1500字／〇〇には触れない">
            <textarea className="textarea" value={context} onChange={(e) => setContext(e.target.value)} />
          </Field>
          {store.deals.length > 0 && (
            <Field label="案件に紐づける">
              <select className="select" value={dealId || ''} onChange={(e) => setDealId(e.target.value || null)}>
                <option value="">紐づけない</option>
                {store.deals.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </details>

      {/* 新項目26：押した瞬間に待ちの見た目にする。二度押しで仕事が2つできるのを防ぐ。 */}
      <Action className="btn primary block" onClick={submit} disabled={!request.trim()} busyLabel="依頼しています…">
        依頼する
      </Action>
      {engines.length === 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          AIエンジン未接続のため、今は「仕事の型」だけが返ります。
        </p>
      )}
    </div>
  );
}
