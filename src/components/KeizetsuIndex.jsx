import { useEffect, useMemo, useRef, useState } from 'react';
import { KEIZETSU_INDEX } from '../data/keizetsuIndex.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { resolveKeizetsuTerm, dedupeKeizetsuIndex } from '../lib/keizetsuLookup.js';
import { meridianNameById } from '../data/knowledgeBase.js';
import { figureFor } from '../data/figures.jsx';

const KIND_LABEL = {
  card: 'フラッシュカードあり',
  point: '要穴として収録',
  meridian: '経絡そのもの',
  extra: '奇経八脈の所属穴',
  confusable: '紛らわしい経穴の対で収録',
  none: '教科書の索引のみ（アプリ未収録）',
};

// 経絡経穴概論 巻末索引を目次として使う画面。
// タップすると同じ画面内の「該当ページ」カードへジャンプし（一時的にハイライト）、
// アプリ内に詳しいデータがある項目はそのまま本文・イラストを表示する。
export default function KeizetsuIndex({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [activeTerm, setActiveTerm] = useState(null);

  const entries = useMemo(() => dedupeKeizetsuIndex(KEIZETSU_INDEX), []);
  const byTerm = useMemo(() => new Map(entries.map((e) => [e.term, e])), [entries]);
  const readings = useMemo(() => Object.fromEntries(entries.map((e) => [e.term, e.reading])), [entries]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return entries;
    return entries.filter((e) => e.term.includes(q) || e.reading.includes(q));
  }, [entries, query]);

  const sections = useMemo(
    () => buildKanaIndex(filtered.map((e) => e.term), readings),
    [filtered, readings]
  );

  const active = activeTerm ? byTerm.get(activeTerm) : null;
  const resolved = active ? resolveKeizetsuTerm(active.term) : null;

  return (
    <div className="view">
      <h2 className="view-title">経絡経穴概論 索引・目次</h2>
      <p className="view-desc">
        教科書巻末の索引（p.244〜247）をもとにした目次です。タップすると該当箇所へ飛び、色つきの項目は
        アプリ内の詳しいデータ（要穴・経絡・奇経八脈など）を表示します。グレーの項目はページ番号のみの
        参考情報です（アプリにまだ詳しいデータが無いことを正直に表示します）。
      </p>

      <div className="card audio-search" style={{ marginBottom: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="経穴名・読みで検索（例：合谷、ごうこく）"
          />
        </div>
      </div>

      {active && resolved && (
        <KeizetsuPageCard
          entry={active}
          resolved={resolved}
          onClose={() => setActiveTerm(null)}
          onNavigate={onNavigate}
        />
      )}

      {sections.length === 0 ? (
        <div className="empty">
          <div className="ico">🔍</div>
          <p>一致する項目が見つかりません。</p>
        </div>
      ) : (
        sections.map((sec) => (
          <div key={sec.label} style={{ marginBottom: 14 }}>
            <div className="section-label" style={{ marginTop: 0 }}>{sec.label}</div>
            <div className="kz-grid">
              {sec.items.map((term) => {
                const e = byTerm.get(term);
                const kind = resolveKeizetsuTerm(term).kind;
                return (
                  <button
                    key={term}
                    type="button"
                    title={KIND_LABEL[kind]}
                    className={`kz-chip kz-${kind}${activeTerm === term ? ' active' : ''}`}
                    onClick={() => setActiveTerm(term)}
                  >
                    <span className="kz-term">{term}</span>
                    <span className="kz-pages">p.{e.pages.join('・')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      <p className="inline-note" style={{ marginTop: 14 }}>
        全{entries.length}項目中{filtered.length}項目を表示。ページ番号は
        『新版 経絡経穴概論（第2版）』巻末索引の転記です。
      </p>
    </div>
  );
}

function KeizetsuPageCard({ entry, resolved, onClose, onNavigate }) {
  const ref = useRef(null);
  const [justJumped, setJustJumped] = useState(true);

  useEffect(() => {
    setJustJumped(true);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t = setTimeout(() => setJustJumped(false), 2200);
    return () => clearTimeout(t);
  }, [entry.term]);

  const Fig = resolved.kind === 'card' && resolved.card.figure ? figureFor(resolved.card.figure) : null;

  return (
    <div ref={ref} className={`kz-page${justJumped ? ' kz-jumped' : ''}`}>
      <div className="kz-page-head">
        <div>
          <span className="kz-page-term">{entry.term}</span>
          <span className="kz-page-yomi">{entry.reading}</span>
        </div>
        <button type="button" className="kz-page-close" onClick={onClose} aria-label="閉じる">✕</button>
      </div>

      <div className="kz-page-pages">
        {entry.pages.map((p) => (
          <span key={p} className="kz-page-badge">教科書 p.{p}</span>
        ))}
      </div>

      {resolved.kind === 'card' && (
        <div className="kz-page-body">
          {Fig && <Fig />}
          <table className="kz-table">
            <tbody>
              <tr><th>経絡</th><td>{resolved.card.meridian}{resolved.card.ryaku ? `（${resolved.card.ryaku}）` : ''}</td></tr>
              {resolved.card.type && <tr><th>分類</th><td>{resolved.card.type}</td></tr>}
              <tr><th>部位・取穴</th><td>{resolved.card.location}</td></tr>
              <tr><th>主治</th><td>{resolved.card.shuji}</td></tr>
            </tbody>
          </table>
          <button
            type="button"
            className="btn ghost block"
            style={{ marginTop: 10 }}
            onClick={() => onNavigate && onNavigate('flashcards')}
          >
            🃏 フラッシュカードで練習する
          </button>
        </div>
      )}

      {resolved.kind === 'point' && (
        <div className="kz-page-body">
          <p className="kz-page-lead">要穴として、次の経絡に属します。</p>
          <table className="kz-table">
            <tbody>
              {resolved.roles.map((r) => (
                <tr key={r.meridian + r.role}><th>{r.role}</th><td>{r.meridianName}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resolved.kind === 'meridian' && (
        <div className="kz-page-body">
          <table className="kz-table">
            <tbody>
              <tr><th>正式名称</th><td>{resolved.meridian.name}</td></tr>
              {resolved.meridian.organ && <tr><th>対応する臓腑</th><td>{resolved.meridian.organ}</td></tr>}
              {resolved.meridian.yinYang && <tr><th>陰陽</th><td>{resolved.meridian.yinYang}</td></tr>}
              {resolved.meridian.element && <tr><th>五行</th><td>{resolved.meridian.element}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {resolved.kind === 'extra' && (
        <div className="kz-page-body">
          <p className="kz-page-lead">奇経八脈のうち、独自の経穴を持たない経脈です（他経の経穴を借用）。</p>
          <table className="kz-table">
            <tbody>
              <tr><th>所属経穴数</th><td>{resolved.extra.count}穴</td></tr>
              <tr><th>経路</th><td>{resolved.extra.points}</td></tr>
              {resolved.extra.note && <tr><th>備考</th><td>{resolved.extra.note}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {resolved.kind === 'confusable' && (
        <div className="kz-page-body">
          <p className="kz-page-lead">名前が紛らわしい経穴として、教科書の参考資料に挙げられています。</p>
          <table className="kz-table">
            <tbody>
              <tr>
                <th className={resolved.confusable.a === entry.term ? 'kz-hit' : ''}>{resolved.confusable.a}</th>
                <td>{meridianNameById(resolved.confusable.aMeridian)}</td>
              </tr>
              <tr>
                <th className={resolved.confusable.b === entry.term ? 'kz-hit' : ''}>{resolved.confusable.b}</th>
                <td>{meridianNameById(resolved.confusable.bMeridian)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {resolved.kind === 'none' && (
        <div className="kz-page-body">
          <p className="kz-page-lead">この項目は教科書には掲載されていますが、アプリにはまだ詳しいデータがありません。</p>
          <p className="kz-page-lead">上のページ番号を教科書で確認してください（記憶で内容を補いません）。</p>
        </div>
      )}

      {resolved.kind !== 'confusable' && resolved.confusable && (
        <p className="kz-page-note">
          ⚠️ 紛らわしい経穴：「{resolved.confusable.a}」と「{resolved.confusable.b}」を混同しないよう注意
          （教科書 p.239 参考資料）。
        </p>
      )}
    </div>
  );
}
