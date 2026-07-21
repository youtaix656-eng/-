import { useState } from 'react';

// 試験会場と、その近くのホテルを任意で登録・メモできる。
// store.venues = [{ id, name, address, memo, hotels:[{ id, name, memo, url }] }]

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

export default function Venues({ store, onToast }) {
  const { venues, setVenues } = store;
  const [venueForm, setVenueForm] = useState(null); // {id?, name, address, memo}
  const [hotelForm, setHotelForm] = useState(null); // {venueId, id?, name, memo, url}

  // ---- 会場 ----
  const saveVenue = () => {
    if (!venueForm.name.trim()) {
      onToast('会場名を入力してください');
      return;
    }
    if (venueForm.id) {
      setVenues(venues.map((v) => (v.id === venueForm.id ? { ...v, name: venueForm.name, address: venueForm.address, memo: venueForm.memo } : v)));
    } else {
      setVenues([...venues, { id: newId('vn'), name: venueForm.name, address: venueForm.address, memo: venueForm.memo, hotels: [] }]);
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
        if (hotelForm.id) {
          return { ...v, hotels: hotels.map((h) => (h.id === hotelForm.id ? { id: h.id, name: hotelForm.name, memo: hotelForm.memo, url: hotelForm.url } : h)) };
        }
        return { ...v, hotels: [...hotels, { id: newId('ht'), name: hotelForm.name, memo: hotelForm.memo, url: hotelForm.url }] };
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

  return (
    <div className="view">
      <h2 className="view-title">試験会場・ホテル</h2>
      <p className="view-desc">
        受験する会場と、近くの宿泊候補を自由に登録できます。持ち物や交通メモも残せます。
      </p>

      <button className="btn primary block" onClick={() => setVenueForm({ id: null, name: '', address: '', memo: '' })}>
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
              <button className="btn ghost sm" onClick={() => setVenueForm({ ...v })}>編集</button>
            </div>
          </div>
          {v.memo && <div className="venue-memo">{v.memo}</div>}

          <div className="hotel-list">
            <div className="section-label">🏨 近くのホテル</div>
            {(v.hotels || []).length === 0 && <p className="inline-note">ホテルは未登録です。</p>}
            {(v.hotels || []).map((h) => (
              <div className="hotel-row" key={h.id}>
                <div className="hotel-main">
                  <div className="hotel-name">{h.name}</div>
                  {h.memo && <div className="hotel-memo">{h.memo}</div>}
                  {h.url && (
                    <a className="hotel-link" href={h.url} target="_blank" rel="noopener noreferrer">予約ページを開く ↗</a>
                  )}
                </div>
                <div className="hotel-actions">
                  <a className="btn ghost sm" href={mapUrl(h.name)} target="_blank" rel="noopener noreferrer">地図</a>
                  <button className="btn ghost sm" onClick={() => setHotelForm({ venueId: v.id, id: h.id, name: h.name, memo: h.memo || '', url: h.url || '' })}>編集</button>
                </div>
              </div>
            ))}
            <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => setHotelForm({ venueId: v.id, id: null, name: '', memo: '', url: '' })}>
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
    </div>
  );
}
