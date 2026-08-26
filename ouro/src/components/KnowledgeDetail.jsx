// 知識1件。**必ず出典まで辿れる**ようにする（AI生成か外部由来かも区別する）。

import { Card, Doc, Empty, SectionTitle, Row } from './ui.jsx';
import { ORIGINS, SOURCE_TYPES } from '../lib/knowledge.js';
import { relTime } from '../lib/format.js';
import { useAllTasks } from './useAllTasks.js';

export default function KnowledgeDetail({ store, knowledgeId, go }) {
  // 古い仕事も要る画面なので、残りを読み足す
  useAllTasks(store);
  const k = store.knowledge.find((x) => x.id === knowledgeId);
  if (!k) return <div className="screen"><Empty>知識が見つかりません。</Empty></div>;

  const sources = store.sources.filter((s) => (k.sourceIds || []).includes(s.id));
  const author = store.employees.find((e) => e.id === k.employeeId);
  const task = store.tasks.find((t) => t.id === k.taskId);

  return (
    <div className="screen fade-in">
      <Card>
        <div className="muted" style={{ marginTop: -4 }}>
          {k.category}・{ORIGINS[k.origin]}
          {k.verifiedAt ? '・✓ 検証済み' : '・未検証'}
        </div>
        <h2 className="serif" style={{ fontSize: 20, margin: '6px 0 8px', lineHeight: 1.5 }}>
          {k.title}
        </h2>
        <p style={{ fontSize: 14.5, marginTop: 0 }}>{k.summary}</p>
        <div className="chips">
          {(k.tags || []).map((t) => (
            <span key={t} className="chip">#{t}</span>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          作成 {relTime(k.createdAt)}
          {k.updatedAt !== k.createdAt && `・更新 ${relTime(k.updatedAt)}`}
          {k.usedCount ? `・${k.usedCount}回使われた` : '・まだ使われていない'}
          {author && `・${author.name}`}
        </div>
      </Card>

      <Card glyph="⚖" title={`信頼性 ${k.trust}`}>
        <div className="bar">
          <i style={{ width: `${k.trust}%` }} />
        </div>
        <p className="muted" style={{ marginBottom: 8 }}>
          {k.verifiedAt
            ? `${relTime(k.verifiedAt)}に検証されました。`
            : 'まだ検証されていません。使う前にレビュアーに確かめさせると安全です。'}
        </p>
        {!k.verifiedAt && (
          <div className="btn-row">
            <button
              type="button"
              className="btn small"
              onClick={() =>
                go('compose', {
                  request: `次の知識を検証してください。根拠の弱い主張・古い数字・断定しすぎている箇所を指摘してください。\n\n【${k.title}】\n${k.body.slice(0, 3000)}`,
                })
              }
            >
              レビュアーに検証させる
            </button>
            <button type="button" className="btn small" onClick={() => store.verifyKnowledge(k.id, 'user')}>
              自分で確認した
            </button>
          </div>
        )}
      </Card>

      <SectionTitle>出典（どこから来た情報か）</SectionTitle>
      {sources.length ? (
        sources.map((s) => (
          <div key={s.id} className="card tight">
            <div style={{ fontSize: 14 }}>
              <span className="rune">{glyphOf(s.type)}</span> {s.title}
            </div>
            <div className="muted">
              {SOURCE_TYPES[s.type] || s.type}・{relTime(s.addedAt)}
            </div>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="muted"
                style={{ wordBreak: 'break-all', display: 'block' }}
              >
                {s.url}
              </a>
            )}
            {s.excerpt && <p className="muted" style={{ marginBottom: 0 }}>{s.excerpt.slice(0, 240)}</p>}
          </div>
        ))
      ) : (
        <Empty>出典が登録されていません。</Empty>
      )}

      <SectionTitle>本文</SectionTitle>
      <Card>
        <Doc text={k.body} />
      </Card>

      {task && (
        <Row glyph="✎" title="この知識を生んだ仕事" sub={task.title} onClick={() => go('task', task.id)} />
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn small"
          onClick={() => go('compose', { request: `次の知識をもとに、次の一手を提案してください。\n\n【${k.title}】\n${k.summary}` })}
        >
          この知識を使って依頼する
        </button>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            if (window.confirm('この知識を削除しますか？')) {
              store.deleteKnowledge(k.id);
              go('knowledge');
            }
          }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

function glyphOf(type) {
  return { web: '⌕', youtube: '▷', pdf: '▤', note: '✍', audio: '◍', ai: '✳', user: '◉' }[type] || '◉';
}
