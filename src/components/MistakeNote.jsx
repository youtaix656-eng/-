import { useMemo, useState } from 'react';
import { normalize } from '../lib/srs.js';

// 間違いノートの自動生成
// 間違えた問題（＝△✕を含む復習対象）＋自分メモをまとめ、テキスト/PDF(印刷)で出力。
export default function MistakeNote({ store, onToast }) {
  const { reviewQuestions, memos, links, srs } = store;
  const [subjectFilter, setSubjectFilter] = useState('all');

  const subjects = useMemo(
    () => Array.from(new Set(reviewQuestions.map((q) => q.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja')),
    [reviewQuestions]
  );
  const list = useMemo(
    () => (subjectFilter === 'all' ? reviewQuestions : reviewQuestions.filter((q) => q.subject === subjectFilter)),
    [reviewQuestions, subjectFilter]
  );

  const answerOf = (q) =>
    q.type === 'ox' ? q.choices[q.answer] : `${q.answer + 1}. ${q.choices[q.answer]}`;

  const buildText = () => {
    const lines = [];
    lines.push('■ 間違いノート（鍼灸国試 対策アプリ）');
    lines.push(`作成日：${new Date().toLocaleDateString('ja-JP')} ／ ${list.length}問`);
    lines.push('');
    list.forEach((q, i) => {
      const st = normalize(srs[q.id]);
      lines.push(`【${i + 1}】${q.subject || ''}${q.round ? '（' + q.round + '）' : ''}  誤答${st.wrongCount || 0}回`);
      lines.push(`Q. ${q.question || '（図の問題）'}`);
      lines.push(`A. ${answerOf(q)}`);
      if (q.explanation) lines.push(`解説: ${q.explanation}`);
      const memo = memos[q.id];
      if (memo) lines.push(`メモ: ${memo}`);
      const note = links[q.id]?.note;
      if (note) lines.push(`つながり: ${note}`);
      lines.push('');
    });
    return lines.join('\n');
  };

  const downloadText = () => {
    if (list.length === 0) return;
    const blob = new Blob([buildText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `間違いノート_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.('テキストで保存しました');
  };

  const escapeHtml = (s) =>
    String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const printPdf = () => {
    if (list.length === 0) return;
    const rows = list
      .map((q, i) => {
        const st = normalize(srs[q.id]);
        const memo = memos[q.id];
        const note = links[q.id]?.note;
        return `<div class="item">
          <div class="head">【${i + 1}】${escapeHtml(q.subject || '')} ${q.round ? '（' + escapeHtml(q.round) + '）' : ''} <span class="wrong">誤答${st.wrongCount || 0}回</span></div>
          <div class="q">Q. ${escapeHtml(q.question || '（図の問題）')}</div>
          <div class="a">A. ${escapeHtml(answerOf(q))}</div>
          ${q.explanation ? `<div class="exp">解説：${escapeHtml(q.explanation)}</div>` : ''}
          ${memo ? `<div class="memo">📝 ${escapeHtml(memo)}</div>` : ''}
          ${note ? `<div class="memo">🔗 ${escapeHtml(note)}</div>` : ''}
        </div>`;
      })
      .join('');
    const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>間違いノート</title>
      <style>
        body{font-family:-apple-system,'Hiragino Kaku Gothic ProN',sans-serif;color:#111;margin:24px;line-height:1.6;}
        h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:6px;}
        .meta{color:#666;font-size:12px;margin-bottom:16px;}
        .item{border:1px solid #ccc;border-radius:8px;padding:10px 12px;margin-bottom:10px;page-break-inside:avoid;}
        .head{font-size:12px;color:#444;font-weight:700;margin-bottom:4px;}
        .wrong{color:#c0392b;}
        .q{font-weight:700;margin:2px 0;}
        .a{color:#1a6b3a;font-weight:700;}
        .exp{font-size:13px;color:#333;margin-top:4px;}
        .memo{font-size:13px;color:#555;background:#f5f5f5;border-radius:6px;padding:4px 8px;margin-top:4px;}
        @media print{ .item{border-color:#999;} }
      </style></head><body>
      <h1>間違いノート</h1>
      <div class="meta">作成日：${new Date().toLocaleDateString('ja-JP')} ／ ${list.length}問${subjectFilter !== 'all' ? ' ／ ' + escapeHtml(subjectFilter) : ''}</div>
      ${rows}
      <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      onToast?.('ポップアップがブロックされました。ブラウザの設定をご確認ください。');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="view">
      <h2 className="view-title">間違いノート</h2>
      <p className="view-desc">
        間違えた問題（△・✕を含む復習対象）と自分のメモをまとめて、テキストやPDF（印刷）で出力できます。移動中の見返しに。
      </p>

      {reviewQuestions.length === 0 ? (
        <div className="empty">
          <div className="ico">🎉</div>
          <p>まとめる間違いがありません。</p>
          <p className="inline-note">一問一答・復習・模試で間違えた問題が、自動でここに集まります。</p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="field" style={{ marginBottom: 10 }}>
              <label>科目でしぼる</label>
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                <option value="all">すべて（{reviewQuestions.length}問）</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}（{reviewQuestions.filter((q) => q.subject === s).length}問）
                  </option>
                ))}
              </select>
            </div>
            <div className="btn-row">
              <button className="btn primary" onClick={printPdf}>🖨️ PDF（印刷）</button>
              <button className="btn" onClick={downloadText}>📄 テキスト保存</button>
            </div>
            <p className="inline-note" style={{ marginTop: 8 }}>
              「PDF（印刷）」は印刷画面が開きます。保存先で「PDFに保存」を選ぶとPDFになります。
            </p>
          </div>

          <div className="section-label">プレビュー（{list.length}問）</div>
          {list.map((q, i) => {
            const st = normalize(srs[q.id]);
            return (
              <div className="list-item" key={q.id}>
                <div className="li-subject">
                  【{i + 1}】{q.subject} ・ 誤答{st.wrongCount || 0}回
                </div>
                <div className="li-q">{q.question || '（図の問題）'}</div>
                <div className="li-stat" style={{ color: 'var(--correct)' }}>
                  答え：{answerOf(q)}
                </div>
                {q.explanation && <div className="li-stat">解説：{q.explanation}</div>}
                {memos[q.id] && <div className="li-memo">📝 {memos[q.id]}</div>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
