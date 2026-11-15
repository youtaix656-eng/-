import { useEffect, useRef, useState } from 'react';
import '../styles/clockWeather.css';
import {
  MAX_PLACES, PRESET_PLACES, makePlace, addPlace, removePlace, pushHistory,
  fetchForecast, failureText, fmtTemp,
} from '../lib/weather.js';

// 天気（2026-11-15追加・ユーザー指定）。地域は3つまで登録でき、現在地も取得できる。
// 選んだ・足した地域は履歴に残る。予報は外部の天気サービス（Open-Meteo）から取るので、
// 地域の緯度・経度がそこへ送られる——画面の下に必ずそう書く（端末内保存方針の明示的な例外）。

const CACHE_MS = 10 * 60 * 1000; // 同じ地域は10分間は取り直さない（画面を行き来するたびに通信しない）
const cache = new Map();

const pad2 = (n) => String(n).padStart(2, '0');
function fmtAt(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function Weather({ store, onToast }) {
  const { settings, updateSettings } = store;
  const places = Array.isArray(settings.weatherPlaces) ? settings.weatherPlaces : [];
  const history = Array.isArray(settings.weatherHistory) ? settings.weatherHistory : [];
  const active = places.find((p) => p.id === settings.weatherActiveId) || places[0] || null;
  const [state, setState] = useState({ status: 'idle' }); // idle | loading | ok | error
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState('東京都');
  const [locating, setLocating] = useState(false);
  const reqRef = useRef(0);

  const load = async (place, force = false) => {
    if (!place) { setState({ status: 'idle' }); return; }
    const hit = cache.get(place.id);
    if (!force && hit && Date.now() - hit.at < CACHE_MS) {
      setState({ status: 'ok', placeId: place.id, data: hit.data, at: hit.at });
      return;
    }
    const req = ++reqRef.current;
    setState({ status: 'loading' });
    const r = await fetchForecast(place);
    if (req !== reqRef.current) return; // 途中で別の地域に切り替えた時は、古い結果を出さない
    if (r.ok) {
      cache.set(place.id, { data: r.data, at: r.at });
      setState({ status: 'ok', placeId: place.id, data: r.data, at: r.at });
    } else {
      setState({ status: 'error', reason: r.reason });
    }
  };

  useEffect(() => {
    load(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const select = (place) => {
    updateSettings({ weatherActiveId: place.id, weatherHistory: pushHistory(history, place) });
  };

  const register = (place) => {
    if (!place) { onToast?.('⚠️ 地域を読み取れませんでした。'); return false; }
    const r = addPlace(places, place);
    if (r.reason === 'duplicate') {
      select(place);
      onToast?.(`「${place.name}」は登録済みです。表示を切り替えました。`);
      return true;
    }
    if (r.reason === 'full') {
      onToast?.(`地域は${MAX_PLACES}つまでです。どれかを削除してから追加してください。`);
      return false;
    }
    updateSettings({ weatherPlaces: r.places, weatherActiveId: place.id, weatherHistory: pushHistory(history, place) });
    onToast?.(r.replaced ? '現在地を新しい位置に更新しました' : `「${place.name}」を登録しました`);
    return true;
  };

  const addPreset = () => {
    const p = PRESET_PLACES.find((x) => x.name === preset);
    if (register(p ? makePlace(p) : null)) setAdding(false);
  };

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onToast?.('⚠️ この端末・ブラウザでは現在地を取得できません。地域を一覧から選んでください。');
      return;
    }
    setLocating(true);
    // 許可の確認が出たまま答えないと、ブラウザ側のtimeoutは数え始めない（ずっと「確認中」に
    // なる）。こちらでも20秒で切り上げて、行き止まりにしない。
    let done = false;
    const giveUp = setTimeout(() => {
      if (done) return;
      done = true;
      setLocating(false);
      onToast?.('⚠️ 現在地を取得できませんでした。位置情報の許可を確認するか、地域を一覧から選んでください。');
    }, 20000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return;
        done = true;
        clearTimeout(giveUp);
        setLocating(false);
        if (register(makePlace({ name: '現在地', lat: pos.coords.latitude, lon: pos.coords.longitude, current: true }))) setAdding(false);
      },
      (err) => {
        if (done) return;
        done = true;
        clearTimeout(giveUp);
        setLocating(false);
        onToast?.(err?.code === 1
          ? '⚠️ 位置情報の利用が許可されませんでした。地域を一覧から選んでください。'
          : '⚠️ 現在地を取得できませんでした。地域を一覧から選んでください。');
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const remove = (place) => {
    const next = removePlace(places, place.id);
    // 表示中でない地域を消した時は、表示中の地域をそのまま保つ（勝手に先頭へ切り替えない）
    const keep = active && active.id !== place.id ? active.id : next[0]?.id || null;
    updateSettings({ weatherPlaces: next, weatherActiveId: keep });
    onToast?.(`「${place.name}」を削除しました（履歴には残ります）`);
  };

  const full = places.length >= MAX_PLACES;
  // 地域を切り替えた直後の1コマに、前の地域の予報を新しい地域名で出さない
  const data = state.status === 'ok' && state.placeId === active?.id ? state.data : null;
  const today = data?.daily?.[0];

  return (
    <div className="view cw-view">
      <h2 className="view-title">🌤️ 天気</h2>

      <div className="cw-panel">
        <div className="cw-head">
          <h3>📍 地域（{places.length}/{MAX_PLACES}）</h3>
          <button type="button" className="cw-add" onClick={() => setAdding((v) => !v)} aria-label="地域を追加" aria-expanded={adding}>＋</button>
        </div>
        {places.length === 0 && <p className="cw-empty">地域がまだありません。「＋」から追加してください（3つまで登録できます）。</p>}
        <div className="wx-places">
          {places.map((p) => (
            <span key={p.id} className={`wx-place${active?.id === p.id ? ' active' : ''}`}>
              <button type="button" className="wx-place-pick" onClick={() => select(p)} aria-pressed={active?.id === p.id}>
                {p.current ? '📍 ' : ''}{p.name}
              </button>
              <button type="button" className="wx-place-del" onClick={() => remove(p)} aria-label={`${p.name}を削除`}>✕</button>
            </span>
          ))}
        </div>
        {adding && (
          <div className="wx-add">
            {full ? (
              <p className="cw-note">地域は{MAX_PLACES}つまで登録できます。追加するには、上のどれかを「✕」で削除してください。</p>
            ) : (
              <>
                <label className="cw-field">
                  都道府県から選ぶ（予報の地点は県庁所在地です）
                  <span className="wx-add-row">
                    <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="地域を選ぶ">
                      {PRESET_PLACES.map((p) => <option key={p.name} value={p.name}>{p.name}（{p.city}）</option>)}
                    </select>
                    <button type="button" className="cw-btn primary" onClick={addPreset}>追加</button>
                  </span>
                </label>
                <button type="button" className="cw-btn" onClick={locate} disabled={locating}>
                  {locating ? '現在地を確認中…' : '📍 現在地を取得して追加'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {active && state.status === 'loading' && <div className="cw-panel"><p className="cw-empty">「{active.name}」の天気を取得しています…</p></div>}

      {active && state.status === 'error' && (
        <div className="cw-panel">
          <p className="cw-note">{failureText(state.reason)}</p>
          <button type="button" className="cw-btn primary" onClick={() => load(active, true)}>もう一度</button>
        </div>
      )}

      {active && data && (
        <>
          <div className={`wx-now wx-${data.current.kind}`}>
            <div className="wx-now-place">{active.current ? '📍 ' : ''}{active.name}</div>
            <div className="wx-now-main">
              <span className="wx-now-ico" aria-hidden="true">{data.current.icon}</span>
              <span className="wx-now-temp">{fmtTemp(data.current.temp)}</span>
            </div>
            <div className="wx-now-label">{data.current.label}</div>
            {today && (
              <div className="wx-now-hl">
                <span className="wx-max">最高 {fmtTemp(today.max)}</span>
                <span className="wx-min">最低 {fmtTemp(today.min)}</span>
              </div>
            )}
            <div className="wx-now-stats">
              <span>体感 {fmtTemp(data.current.feels)}</span>
              <span>湿度 {data.current.humidity == null ? '—' : `${Math.round(data.current.humidity)}%`}</span>
              <span>風 {data.current.wind == null ? '—' : `${data.current.wind.toFixed(1)}m/s`}</span>
              <span>降水 {today?.pop == null ? '—' : `${Math.round(today.pop)}%`}</span>
            </div>
            <div className="wx-now-foot">
              <span>{fmtAt(state.at)} 取得</span>
              <button type="button" className="wx-refresh" onClick={() => load(active, true)}>🔄 更新</button>
            </div>
          </div>

          <div className="cw-panel">
            <h3 className="cw-h3">🕐 1時間ごと</h3>
            <div className="wx-hours">
              {data.hourly.map((h, i) => (
                <div key={h.time} className="wx-hour">
                  <span className="wx-hour-t">{i === 0 ? '今' : `${h.hour}時`}</span>
                  <span className="wx-hour-ico" aria-label={h.label}>{h.icon}</span>
                  <span className="wx-hour-temp">{fmtTemp(h.temp)}</span>
                  <span className="wx-hour-pop">{h.pop == null ? '—' : `${Math.round(h.pop)}%`}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cw-panel">
            <h3 className="cw-h3">📅 週間予報</h3>
            <ul className="wx-days">
              {data.daily.map((d) => (
                <li key={d.date} className="wx-day">
                  <span className="wx-day-label">{d.dayLabel}</span>
                  <span className="wx-day-ico" role="img" aria-label={d.label}>{d.icon}</span>
                  <span className="wx-day-text">{d.pop == null ? null : <span className="wx-day-pop">☔{Math.round(d.pop)}%</span>}</span>
                  <span className="wx-min">{fmtTemp(d.min)}</span>
                  <span className="wx-max">{fmtTemp(d.max)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="cw-panel">
        <div className="cw-head">
          <h3>🕘 履歴（選んだ地域）</h3>
          {history.length > 0 && (
            <button type="button" className="cw-btn sm" onClick={() => { updateSettings({ weatherHistory: [] }); onToast?.('履歴を消しました'); }}>履歴を消す</button>
          )}
        </div>
        {history.length === 0 && <p className="cw-empty">まだ履歴はありません。地域を選ぶ・追加するとここに残ります。</p>}
        <ul className="wx-history">
          {history.map((h) => {
            const registered = places.some((p) => p.id === h.id);
            return (
              <li key={h.id}>
                <button type="button" className="wx-history-item" onClick={() => (registered ? select(h) : register(makePlace(h)))}>
                  <span>{h.current ? '📍 ' : ''}{h.name}</span>
                  <span className="wx-history-at">{fmtAt(h.at)}{registered ? '' : '・タップで再登録'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="cw-note sub">
        天気の予報は外部の天気サービス（Open-Meteo）から取得しています。そのため、選んだ地域・現在地の緯度と経度
        （小数第2位まで＝約1kmの粗さに丸めた値）がこのサービスへ送られます。通信するのはこの画面を開いている時だけです。
        予報は目安で、実際の天気と違うことがあります。
      </p>
    </div>
  );
}
