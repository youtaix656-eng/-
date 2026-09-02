import { useEffect, useMemo, useState } from 'react';
import * as storage from '../lib/storage.js';
import { makePage, addPage, removePage, searchPages, snippetFor, buildSearchPrompt } from '../lib/keiketsuLibrary.js';
import { formatBytes } from '../lib/storageHealth.js';

// 経絡経穴の教科書材料の置き場（検索可能な原文ライブラリ）。
//
// ここに貼り付けた原文はそのまま「問題」にはならない。実際の経穴データ
// （data/keiketsuCards.js）はこの原文を出典として Claude が出典つきで手動整備する
// （著作物である教科書の文章そのものを問題として大量常設しない方針・CLAUDE.md参照）。
// このため画面には「経穴データとして取り込む」ボタンは置かず、あくまで
//「後で見返す・検索する・出典として残す」ための下書き置き場として設計している。
export default function KeiketsuLibrary({ onToast, onNavigate }) {
  const [pages, setPages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    storage.loadKeiketsuLibrary().then((v) => {
      setPages(v);
      setLoaded(true);
    });
  }, []);

  const persist = (next) => {
    setPages(next);
    storage.saveKeiketsuLibrary(next);
  };

  const doAdd = () => {
    if (!text.trim()) {
      onToast?.('本文を入力してください');
      return;
    }
    const page = makePage({ title, text });
    persist(addPage(pages, page));
    setTitle('');
    setText('');
    onToast?.('教科書材料を保存しました');
  };

  const doRemove = (id) => {
    if (!confirm('この教科書材料を削除しますか？（元に戻せません）')) return;
    persist(removePage(pages, id));
    if (openId === id) setOpenId(null);
    onToast?.('削除しました');
  };

  const copyPrompt = async (targetPages, label) => {
    try {
      await navigator.clipboard.writeText(buildSearchPrompt(targetPages));
      onToast?.(`${label}をコピーしました。AIチャットに貼り付けて質問してください`);
    } catch (e) {
      onToast?.('コピーできませんでした');
    }
  };

  const results = useMemo(() => searchPages(pages, query), [pages, query]);
  // 端末内保存容量の目安（貼り付けた原文が積み上がるほど増えるため、追加前に現在地が分かるよう表示）。
  const totalBytes = useMemo(() => pages.reduce((sum, p) => sum + (p.text?.length || 0) + (p.title?.length || 0), 0), [pages]);
  const sorted = useMemo(() => [...results].sort((a, b) => b.addedAt - a.addedAt), [results]);

  return (
    <div className="view">
      <h2 className="view-title">📚 経絡経穴 教科書ライブラリ</h2>
      <p className="view-desc">
        経絡経穴の教科書ページを貼り付けて保存し、あとから検索できます。ここに置いた原文が
        自動で問題になるわけではありません（教科書の文章をそのまま出題プールに入れない方針のため）。
        貼り付けた内容を実際の経穴カード・一問一答へ反映してほしい時は、このページを開いた状態で
        「この材料を教材化して」と伝えてください。AIチャットで検索したい時は、下の
        「検索用プロンプトをコピー」を使ってください（数字・専門用語を勝手に変えないよう
        指示済みの原文保護版プロンプトです）。
      </p>

      <div className="card">
        <label className="section-label" style={{ marginTop: 0 }}>教科書材料を追加</label>
        <div className="field">
          <label htmlFor="keiketsu-lib-title">タイトル（任意・例：「合谷 P12」）</label>
          <input
            id="keiketsu-lib-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ページ名・見出しなど"
          />
        </div>
        <div className="field">
          <label htmlFor="keiketsu-lib-text">本文</label>
          <textarea
            id="keiketsu-lib-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ minHeight: 140 }}
            placeholder="教科書のページ本文を貼り付けてください"
          />
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={doAdd}>💾 保存する</button>
          <button className="btn ghost" onClick={() => onNavigate && onNavigate('ocr')}>
            📷 写真・PDFから文字を抽出する
          </button>
        </div>
        <p className="inline-note" style={{ marginTop: 8 }}>
          写真・PDFから文字を抽出した場合は、抽出画面の「コピー」で本文欄へ貼り付けてください。
        </p>
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          className="btn accent"
          onClick={() => copyPrompt(pages, '検索用プロンプト（全材料）')}
          disabled={pages.length === 0}
        >
          📋 検索用プロンプトをコピー（全材料）
        </button>
      </div>
      <p className="inline-note" style={{ marginTop: 4 }}>
        保存した本文を差し込んだプロンプトをコピーします。AIチャット（Claude等）に貼り付けて
        質問すると、数字・専門用語を勝手に変えず、答えの根拠を照合表つきで返すよう指示済みです。
      </p>

      {pages.length > 0 && (
        <p className="inline-note" style={{ marginTop: 4 }}>
          保存済み {pages.length}件・約{formatBytes(totalBytes)}
        </p>
      )}
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="keiketsu-lib-search">検索</label>
        <input
          id="keiketsu-lib-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="経穴名・キーワードで検索"
        />
      </div>

      {!loaded ? null : sorted.length === 0 ? (
        <div className="empty">
          <div className="ico">📄</div>
          <p>{pages.length === 0 ? 'まだ材料がありません。上のフォームから追加してください。' : '一致する材料が見つかりません。'}</p>
        </div>
      ) : (
        <div className="list">
          {sorted.map((p) => {
            const open = openId === p.id;
            return (
              <div key={p.id} className="card">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setOpenId(open ? null : p.id)}
                >
                  <strong>{p.title}</strong>
                  <span className="inline-note">{new Date(p.addedAt).toLocaleDateString('ja-JP')}</span>
                </div>
                {open ? (
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{p.text}</p>
                ) : (
                  <p className="inline-note" style={{ marginTop: 8 }}>{snippetFor(p.text, query)}</p>
                )}
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button className="btn sm" onClick={() => setOpenId(open ? null : p.id)}>
                    {open ? '閉じる' : '全文を見る'}
                  </button>
                  <button className="btn sm accent" onClick={() => copyPrompt([p], `「${p.title}」の検索用プロンプト`)}>
                    📋 このページ用にコピー
                  </button>
                  <button className="btn sm danger" onClick={() => doRemove(p.id)}>🗑️ 削除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
