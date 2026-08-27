// 仕事の依頼。自然言語で書くだけで、Ouro が担当と順番を決める。

import { useMemo, useState } from 'react';
import { Card, Field, SectionTitle, Action } from './ui.jsx';
import { WORKFLOWS } from '../data/workflows.js';
import { planSteps, detectNeeds } from '../lib/dispatcher.js';
import { roleById } from '../data/roles.js';
import { workflowById } from '../data/workflows.js';
import { availableProviders } from '../lib/providers/index.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';
import { suggestPlan, MIN_REQUEST } from '../lib/suggest.js';
import Portrait from './Portrait.jsx';

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
  // 提案どおりに進めるか、自分で決めるか。
  // **既定は提案。** 選べるものが増えすぎて、選ぶこと自体が負担になっていた。
  // 社員を直に指名して来た時だけ、最初から手動にする。
  const [mode, setMode] = useState(preset.employeeId ? 'manual' : 'suggest');
  const genres = allGenres(store.genres);

  // おすすめの組み合わせ（AIを呼ばずに、語の一致と既存の計画から作る）
  const suggestion = useMemo(
    () =>
      suggestPlan({
        request,
        assign: store.assignFor,
        customGenres: store.genres,
        deals: store.deals,
        // **呼び出し元が決めているものを、推測で上書きしない。**
        // 案件から開いたのに紐づけが外れると、その案件の仕事が0件のままになる。
        fixed: { dealId: preset.dealId, workflowId: preset.workflowId, genreId: preset.genreId },
      }),
    [request, store.assignFor, store.genres, store.deals, preset.dealId, preset.workflowId, preset.genreId]
  );

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

  /**
   * 依頼する。
   * @param {object} [over] 提案どおりに進める時は、提案の値で上書きする
   *   （画面の状態を書き換えてから送ると、setState が反映される前に送ってしまう）。
   */
  const submit = async (over = null) => {
    if (!request.trim()) return;
    const v = over || {};
    const wf = 'workflowId' in v ? v.workflowId : workflowId === 'auto' ? null : workflowId;
    const task = store.newTask({
      request,
      workflowId: wf,
      employeeId: 'employeeId' in v ? v.employeeId : employeeId,
      dealId: 'dealId' in v ? v.dealId : dealId,
      // 事業から依頼した時の紐づけ。**提案では推測しない**
      // （呼び出し元が決めているものを推測で上書きしない、と同じ理由）。
      ventureId: preset.ventureId || null,
      context,
      genreId: 'genreId' in v ? v.genreId : genreId,
      dueAt: spec.dueAt ? new Date(spec.dueAt).getTime() : null,
      deliverableSpec: spec.deliverable,
      doneWhen: 'doneWhen' in v ? v.doneWhen : spec.doneWhen,
      materials: spec.materials,
      constraints: spec.constraints,
    });
    go('task', task.id);
    store.runTask(task.id);
  };

  /** 提案どおりに実行する（②の「はい」）。 */
  const runSuggestion = async () => {
    // 担当が1人もいない計画は、最初の手順で必ず失敗する。実行させない。
    if (!suggestion.ok || suggestion.staffedCount === 0) return;
    await submit({
      workflowId: suggestion.workflowId,
      genreId: suggestion.genreId,
      dealId: suggestion.dealId,
      doneWhen: suggestion.doneWhen,
      employeeId: null,
    });
  };

  /** 提案を下敷きにして、自分で決める（②の「いいえ」）。 */
  const editSuggestion = () => {
    if (suggestion.ok) {
      setWorkflowId(suggestion.workflowId || 'auto');
      setGenreId(suggestion.genreId);
      if (suggestion.dealId) setDealId(suggestion.dealId);
      if (suggestion.doneWhen && !spec.doneWhen) setSpec((x) => ({ ...x, doneWhen: suggestion.doneWhen }));
    }
    setMode('manual');
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

      {/* ② おすすめの組み合わせ → はい／いいえ */}
      {mode === 'suggest' && !chosenEmployee && (
        <SuggestionCard
          suggestion={suggestion}
          request={request}
          store={store}
          go={go}
          onYes={runSuggestion}
          onNo={editSuggestion}
        />
      )}

      {mode === 'manual' && !chosenEmployee && (
        <button
          type="button"
          className="btn ghost small"
          style={{ marginBottom: 12 }}
          onClick={() => setMode('suggest')}
        >
          ‹ おすすめの組み合わせに戻る
        </button>
      )}

      {mode === 'manual' && (chosenEmployee ? (
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
      ))}

      {mode === 'manual' && plan.length > 0 && (
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

      {mode === 'manual' && (
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
      )}

      {/* 新項目26：押した瞬間に待ちの見た目にする。二度押しで仕事が2つできるのを防ぐ。 */}
      {mode === 'manual' && (
        <Action
          className="btn primary block"
          onClick={() => submit()}
          disabled={!request.trim()}
          busyLabel="依頼しています…"
        >
          依頼する
        </Action>
      )}
      {engines.length === 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          AIエンジン未接続のため、今は「仕事の型」だけが返ります。
        </p>
      )}
    </div>
  );
}

/**
 * ① 依頼を書いたら、おすすめの組み合わせを1つ出す。
 * ② 「この提案で実行する」／「自分で決める」の2択。
 *
 * **選択肢を全部並べない。** 役職25・仕事の流れ12・ジャンル9…と増えたので、
 * 選べること自体が負担になっていた。まず1つ出して、違えば直せばよい。
 * 判定は AI を呼ばずに（語の一致だけで）作っているので、費用はかからない。
 */
function SuggestionCard({ suggestion, request, store, go, onYes, onNo }) {
  if (!request.trim()) {
    return (
      <p className="muted" style={{ textAlign: 'center', marginTop: -4 }}>
        依頼を書くと、おすすめの組み合わせを出します。
      </p>
    );
  }
  // **提案が出せない時も行き止まりにしない。**
  // 「自分で決める」は必ず押せるようにしておく（ここが無いと、短い依頼では
  // 依頼するボタンにも手動の設定にもたどり着けなくなる）。
  if (!suggestion.ok) {
    return (
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>
          {suggestion.reason}（あと{Math.max(1, MIN_REQUEST - request.trim().length)}文字）
        </p>
        <button type="button" className="btn block" onClick={onNo}>
          このまま自分で決める
        </button>
      </Card>
    );
  }

  const engines = availableProviders(store.secrets).filter((p) => p.needsKey);
  const vacant = suggestion.steps.filter((x) => !x.employee);
  const noOne = suggestion.staffedCount === 0;

  return (
    <>
      <Card glyph="◎" title="おすすめの組み合わせ">
        <div className="sg-grid">
          <div className="sg-cell">
            <div className="k">分野</div>
            <div className="v">{suggestion.genreName}</div>
          </div>
          <div className="sg-cell">
            <div className="k">進め方</div>
            <div className="v">{suggestion.workflowName}</div>
          </div>
          <div className="sg-cell">
            <div className="k">担当</div>
            <div className="v">{suggestion.staffedCount}人</div>
          </div>
          <div className="sg-cell">
            <div className="k">AIを呼ぶ</div>
            <div className="v">{suggestion.calls}回</div>
          </div>
        </div>

        <div className="sg-people">
          {suggestion.steps.map((x, i) => (
            <div key={`${x.roleId}-${i}`} className={`sg-person ${x.employee ? '' : 'vacant'}`}>
              {x.employee ? (
                <Portrait employee={x.employee} size={44} />
              ) : (
                <span className="rune" style={{ fontSize: 22 }}>◌</span>
              )}
              <div className="sg-name">{x.employee ? x.employee.shortName || x.employee.name : x.roleName}</div>
              <div className="sg-role">{x.employee ? x.roleName : '未雇用'}</div>
            </div>
          ))}
        </div>

        <ul className="sg-why">
          {suggestion.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        {suggestion.doneWhen && (
          <p className="muted" style={{ marginBottom: 0 }}>
            完成条件：{suggestion.doneWhen}
          </p>
        )}
      </Card>

      {vacant.length > 0 && (
        <Card glyph="＋" title={`${vacant.length}人ぶんの席が空いています`}>
          <p className="muted" style={{ marginTop: -6 }}>
            {vacant.map((x) => x.roleName).join('・')}
            が向いていますが、まだ雇っていないので今回は担当から外れます。
            {noOne ? '' : 'このまま進めても構いません。'}
          </p>
          <button type="button" className="btn small primary" onClick={() => go('characters')}>
            雇いに行く（AIキャラクター名鑑）
          </button>
        </Card>
      )}

      <Card glyph="?" title="この提案を実行しますか？">
        {engines.length === 0 && (
          <p className="muted" style={{ marginTop: -6 }}>
            ※ AIエンジンが未接続なので、今は「仕事の型」だけが返ります。
          </p>
        )}
        {noOne ? (
          // 担当が1人もいない計画は、最初の手順で必ず失敗する。
          // 押しても失敗するだけのボタンは出さない（行き止まりを作らない）。
          <p className="muted" style={{ marginTop: -6 }}>
            この依頼に向いている役職を1人も雇っていないので、このままでは実行できません。
            上から雇うか、「自分で決める」で担当を選んでください。
          </p>
        ) : (
          <Action className="btn primary block" onClick={onYes} busyLabel="依頼しています…">
            はい、この提案で実行する
          </Action>
        )}
        <button
          type="button"
          className={`btn block ${noOne ? 'primary' : ''}`}
          style={{ marginTop: 8 }}
          onClick={onNo}
        >
          いいえ、自分で決める
        </button>
        <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
          「自分で決める」を選ぶと、分野・進め方・担当・完成条件をこの提案から直せます。
        </p>
      </Card>
    </>
  );
}
