import { useEffect, useMemo, useState } from 'react';
import { fileToDataUrl, isImageFile } from '../lib/image.js';
import { makeImageEntry, addImageEntry, removeImageEntry, sortByPage } from '../lib/keizetsuPageImages.js';
import { textbookSectionFor } from '../data/keizetsuTextbookMap.js';
import * as storage from '../lib/storage.js';
import PhotoSource from './PhotoSource.jsx';

// 経絡経穴の教科書ページ写真（端末内限定）。
//
// 教科書のページ画像そのものを公開リポジトリ（GitHub Pages）に載せると著作権上の
// 問題になるため、この画面で追加した写真は「この端末のIndexedDBにのみ」保存し、
// バックアップ・QR・クラウド自動同期にも含めない（storage.js参照）。他の端末や
// 他の人には一切共有されない、あなただけの写真帳。
export default function KeizetsuPageImages({ onToast, onNavigate }) {
  const [entries, setEntries] = useState([]);
  const [pageNumber, setPageNumber] = useState('');
  const [label, setLabel] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    storage.loadKeizetsuPageImages().then(setEntries);
  }, []);

  const persist = (next) => {
    setEntries(next);
    storage.saveKeizetsuPageImages(next);
  };

  const addPhoto = async (files) => {
    const list = (files || []).filter(isImageFile);
    if (list.length === 0) {
      onToast?.('画像ファイルを選んでください');
      return;
    }
    setBusy(true);
    try {
      // 複数まとめて選んだ場合は、ページ番号を1枚ごとに自動で+1しながら連番で保存する
      // （経穴一覧のような連続ページをまとめて撮影しやすくするため）。
      let next = entries;
      let n = Number(pageNumber);
      const useAutoPage = Number.isFinite(n) && n > 0;
      for (const file of list) {
        const dataUrl = await fileToDataUrl(file);
        const entry = makeImageEntry({ pageNumber: useAutoPage ? n : '', label, dataUrl });
        next = addImageEntry(next, entry);
        if (useAutoPage) n += 1;
      }
      persist(next);
      setLabel('');
      if (useAutoPage) setPageNumber(String(n));
      onToast?.(`${list.length}枚の画像を保存しました（この端末にのみ保存）`);
    } catch (e) {
      onToast?.('画像の読み込みに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const doRemove = (id) => {
    if (!confirm('この画像を削除しますか？（元に戻せません）')) return;
    persist(removeImageEntry(entries, id));
    onToast?.('削除しました');
  };

  const sorted = useMemo(() => sortByPage(entries), [entries]);

  return (
    <div className="view">
      <h2 className="view-title">📷 経絡経穴 教科書ページ写真</h2>
      <p className="view-desc">
        教科書のページを自分で撮影して、この端末にだけ保存できます。著作権への配慮から、
        アプリ本体（公開サイト）には一切含まれません——バックアップ・QR・クラウド自動同期の
        対象からも外しているので、他の端末には移動しません。ブラウザのデータを消すと
        一緒に消えるので、大事なページは端末の写真アプリにも残しておくことをおすすめします。
      </p>

      <div className="card">
        <label className="section-label" style={{ marginTop: 0 }}>写真を追加</label>
        <div className="field">
          <label htmlFor="kpi-page">ページ番号（任意）</label>
          <input
            id="kpi-page"
            type="number"
            inputMode="numeric"
            min="1"
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
            placeholder="例）30"
          />
        </div>
        <div className="field">
          <label htmlFor="kpi-label">メモ（任意）</label>
          <input
            id="kpi-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例）督脈 経穴一覧"
          />
        </div>
        <button className="btn primary block" onClick={() => setSheetOpen(true)} disabled={busy}>
          {busy ? '保存中…' : '📷 写真を選ぶ・撮る'}
        </button>
      </div>

      <PhotoSource open={sheetOpen} onClose={() => setSheetOpen(false)} onPick={addPhoto} />

      <div className="section-label">保存済み（{sorted.length}枚）</div>
      {sorted.length === 0 ? (
        <div className="empty">
          <div className="ico">📷</div>
          <p>まだ写真がありません。</p>
        </div>
      ) : (
        <div className="photo-strip">
          {sorted.map((e) => {
            const section = e.pageNumber != null ? textbookSectionFor(e.pageNumber) : null;
            return (
              <div className="photo-thumb" key={e.id}>
                <img src={e.dataUrl} alt={e.label || 'ページ写真'} onClick={() => setLightbox(e.dataUrl)} />
                <button type="button" className="photo-x" onClick={() => doRemove(e.id)} aria-label="削除">✕</button>
                <div className="li-stat" style={{ marginTop: 4 }}>
                  {e.pageNumber != null ? `p.${e.pageNumber}` : 'ページ不明'}
                  {e.label ? `・${e.label}` : ''}
                  {section ? `（${section.title}）` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn ghost block" style={{ marginTop: 14 }} onClick={() => onNavigate && onNavigate('keizetsutextbook')}>
        📖 教科書目次（ページ順・出題頻度つき）へ
      </button>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="拡大表示" />
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="閉じる">✕</button>
        </div>
      )}
    </div>
  );
}
