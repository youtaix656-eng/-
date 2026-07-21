import { useState } from 'react';
import { fileToDataUrl, isImageFile } from '../lib/image.js';
import PhotoSource from './PhotoSource.jsx';

// 試験会場と、その近くのホテルを任意で登録・メモ・写真つきで管理できる。
// store.venues = [{ id, name, address, memo, photos:[dataURI],
//                   hotels:[{ id, name, memo, url, photos:[dataURI] }] }]

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

// フォーム内で写真を追加・削除できるサムネイル欄
function PhotoEditor({ photos, onChange, onToast }) {
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const addFiles = async (files) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const added = [];
      for (const f of files) {
        if (!isImageFile(f)) continue;
        try {
          added.push(await fileToDataUrl(f));
        } catch (err) {
          onToast?.('写真の読み込みに失敗しました');
        }
      }
      if (added.length) onChange([...(photos || []), ...added]);
    } finally {
      setBusy(false);
    }
  };
  const remove = (i) => onChange((photos || []).filter((_, k) => k !== i));

  return (
    <div className="photo-editor">
      <div className="photo-strip">
        {(photos || []).map((src, i) => (
          <div className="photo-thumb" key={i}>
            <img src={src} alt={`写真${i + 1}`} />
            <button type="button" className="photo-x" onClick={() => remove(i)} aria-label="写真を削除">✕</button>
          </div>
        ))}
        <button type="button" className="photo-add" onClick={() => setSheetOpen(true)} disabled={busy}>
          {busy ? '…' : '＋\n写真'}
        </button>
      </div>
      <PhotoSource
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={addFiles}
        multiple
      />
    </div>
  );
}

export default function Venues({ store, onToast }) {
  const { venues, setVenues } = store;
  const [venueForm, setVenueForm] = useState(null); // {id?, name, address, memo, photos}
  const [hotelForm, setHotelForm] = useState(null); // {venueId, id?, name, memo, url, photos}
  const [lightbox, setLightbox] = useState(null); // 拡大表示中の data URI

  // ---- 会場 ----
  const saveVenue = () => {
    if (!venueForm.name.trim()) {
      onToast('会場名を入力してください');
      return;
    }
    if (venueForm.id) {
      setVenues(venues.map((v) => (v.id === venueForm.id
        ? { ...v, name: venueForm.name, address: venueForm.address, memo: venueForm.memo, photos: venueForm.photos || [] }
        : v)));
    } else {
      setVenues([...venues, { id: newId('vn'), name: venueForm.name, address: venueForm.address, memo: venueForm.memo, photos: venueForm.photos || [], hotels: [] }]);
    }
    setVenueForm(null);
    onToast('会場を保存しました');
  };
  const deleteVenue = (id) => {
    setVenues(venues.filter((v) => v.id !== id));
    onToast('会場を削除しました');
  };

  // ---- ホテル ----
  const saveHotel = () => {
    if (!hotelForm.name.trim()) {
      onToast('ホテル名を入力してください');
      return;
    }
    setVenues(
      venues.map((v) => {
        if (v.id !== hotelForm.venueId) return v;
        const hotels = v.hotels || [];
        const rec = { name: hotelForm.name, memo: hotelForm.memo, url: hotelForm.url, photos: hotelForm.photos || [] };
        if (hotelForm.id) {
          return { ...v, hotels: hotels.map((h) => (h.id === hotelForm.id ? { id: h.id, ...rec } : h)) };
        }
        return { ...v, hotels: [...hotels, { id: newId('ht'), ...rec }] };
      })
    );
    setHotelForm(null);
    onToast('ホテルを保存しました');
  };
  const deleteHotel = (venueId, hotelId) => {
    setVenues(venues.map((v) => (v.id === venueId ? { ...v, hotels: (v.hotels || []).filter((h) => h.id !== hotelId) } : v)));
    onToast('ホテルを削除しました');
  };

  const mapUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  // 保存済みの写真を横スクロールで表示（タップで拡大）
  const PhotoRow = ({ photos }) =>
    photos && photos.length > 0 ? (
      <div className="photo-strip view-only">
        {photos.map((src, i) => (
          <button type="button" className="photo-thumb" key={i} onClick={() => setLightbox(src)}>
            <img src={src} alt={`写真${i + 1}`} />
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="view">
      <h2 className="view-title">試験会場・ホテル</h2>
      <p className="view-desc">
        受験する会場と、近くの宿泊候補を写真つきで登録できます。持ち物や交通メモも残せます。
      </p>

      <button className="btn primary block" onClick={() => setVenueForm({ id: null, name: '', address: '', memo: '', photos: [] })}>
        ＋ 会場を追加
      </button>

      {venues.length === 0 && (
        <p className="inline-note" style={{ marginTop: 12 }}>
          まだ会場が登録されていません。「＋ 会場を追加」から登録しましょう。
        </p>
      )}

      {venues.map((v) => (
        <div className="card venue-card" key={v.id}>
          <div className="venue-head">
            <div>
              <div className="venue-name">🏛️ {v.name}</div>
              {v.address && <div className="venue-addr">{v.address}</div>}
            </div>
            <div className="venue-actions">
              <a className="btn ghost sm" href={mapUrl(v.address || v.name)} target="_blank" rel="noopener noreferrer">地図</a>
              <button className="btn ghost sm" onClick={() => setVenueForm({ id: v.id, name: v.name, address: v.address || '', memo: v.memo || '', photos: v.photos || [] })}>編集</button>
            </div>
          </div>
          <PhotoRow photos={v.photos} />
          {v.memo && <div className="venue-memo">{v.memo}</div>}

          <div className="hotel-list">
            <div className="section-label">🏨 近くのホテル</div>
            {(v.hotels || []).length === 0 && <p className="inline-note">ホテルは未登録です。</p>}
            {(v.hotels || []).map((h) => (
              <div className="hotel-row" key={h.id}>
                <div className="hotel-main">
                  <div className="hotel-name">{h.name}</div>
                  {h.memo && <div className="hotel-memo">{h.memo}</div>}
                  <PhotoRow photos={h.photos} />
                  {h.url && (
                    <a className="hotel-link" href={h.url} target="_blank" rel="noopener noreferrer">予約ページを開く ↗</a>
                  )}
                </div>
                <div className="hotel-actions">
                  <a className="btn ghost sm" href={mapUrl(h.name)} target="_blank" rel="noopener noreferrer">地図</a>
                  <button className="btn ghost sm" onClick={() => setHotelForm({ venueId: v.id, id: h.id, name: h.name, memo: h.memo || '', url: h.url || '', photos: h.photos || [] })}>編集</button>
                </div>
              </div>
            ))}
            <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => setHotelForm({ venueId: v.id, id: null, name: '', memo: '', url: '', photos: [] })}>
              ＋ ホテルを追加
            </button>
          </div>

          <button className="link-danger" onClick={() => deleteVenue(v.id)}>この会場を削除</button>
        </div>
      ))}

      {/* 会場フォーム */}
      {venueForm && (
        <div className="modal-backdrop" onClick={() => setVenueForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{venueForm.id ? '会場を編集' : '会場を追加'}</h3>
            <label className="field">
              <span>会場名</span>
              <input value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} placeholder="例）〇〇大学 △△キャンパス" autoFocus />
            </label>
            <label className="field">
              <span>住所（任意）</span>
              <input value={venueForm.address} onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })} placeholder="例）東京都〇〇区…" />
            </label>
            <label className="field">
              <span>メモ（任意）</span>
              <textarea value={venueForm.memo} onChange={(e) => setVenueForm({ ...venueForm, memo: e.target.value })} placeholder="最寄り駅・交通・持ち物など" style={{ minHeight: 60 }} />
            </label>
            <div className="field">
              <span>写真（任意・複数可）</span>
              <PhotoEditor photos={venueForm.photos} onChange={(p) => setVenueForm({ ...venueForm, photos: p })} onToast={onToast} />
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => setVenueForm(null)}>キャンセル</button>
              <button className="btn primary" onClick={saveVenue}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ホテルフォーム */}
      {hotelForm && (
        <div className="modal-backdrop" onClick={() => setHotelForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{hotelForm.id ? 'ホテルを編集' : 'ホテルを追加'}</h3>
            <label className="field">
              <span>ホテル名</span>
              <input value={hotelForm.name} onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })} placeholder="例）〇〇ホテル 駅前店" autoFocus />
            </label>
            <label className="field">
              <span>メモ（任意）</span>
              <textarea value={hotelForm.memo} onChange={(e) => setHotelForm({ ...hotelForm, memo: e.target.value })} placeholder="料金・会場まで徒歩◯分・朝食など" style={{ minHeight: 56 }} />
            </label>
            <label className="field">
              <span>予約URL（任意）</span>
              <input value={hotelForm.url} onChange={(e) => setHotelForm({ ...hotelForm, url: e.target.value })} placeholder="https://…" inputMode="url" />
            </label>
            <div className="field">
              <span>写真（任意・複数可）</span>
              <PhotoEditor photos={hotelForm.photos} onChange={(p) => setHotelForm({ ...hotelForm, photos: p })} onToast={onToast} />
            </div>
            <div className="btn-row">
              {hotelForm.id && (
                <button className="btn danger" onClick={() => deleteHotel(hotelForm.venueId, hotelForm.id)}>削除</button>
              )}
              <button className="btn" onClick={() => setHotelForm(null)}>キャンセル</button>
              <button className="btn primary" onClick={saveHotel}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 写真の拡大表示 */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="拡大表示" />
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="閉じる">✕</button>
        </div>
      )}
    </div>
  );
}
