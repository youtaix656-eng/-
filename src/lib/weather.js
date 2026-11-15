// 天気画面のロジック（2026-11-15追加・ユーザー指定）。
// 予報は Open-Meteo（APIキー不要の公開API）から取得する。地域の緯度・経度が外部の
// 天気サービスへ送られるので、端末内保存方針の「明示的な例外」として画面にもそう書く
// （Googleドライブ連携・ボイスクローンと同じ扱い。天気画面を開いた時だけ通信する）。
// 取得できない時（オフライン等）は黙らず、理由と「もう一度」を出す。
// ここは純関数＋fetch1つだけ。登録地域・履歴の保存はsettings経由（Weather.jsx）。

export const MAX_PLACES = 3; // 登録できる地域は3つまで（ユーザー指定）
export const HISTORY_MAX = 20;

// 都道府県庁所在地（緯度・経度はおおよその値。予報の地点指定には十分な精度）
export const PRESET_PLACES = [
  ['札幌', 43.06, 141.35], ['青森', 40.82, 140.74], ['盛岡', 39.7, 141.15], ['仙台', 38.27, 140.87],
  ['秋田', 39.72, 140.1], ['山形', 38.24, 140.36], ['福島', 37.75, 140.47], ['水戸', 36.34, 140.45],
  ['宇都宮', 36.57, 139.88], ['前橋', 36.39, 139.06], ['さいたま', 35.86, 139.65], ['千葉', 35.6, 140.12],
  ['東京', 35.69, 139.69], ['横浜', 35.45, 139.64], ['新潟', 37.9, 139.02], ['富山', 36.7, 137.21],
  ['金沢', 36.59, 136.63], ['福井', 36.07, 136.22], ['甲府', 35.66, 138.57], ['長野', 36.65, 138.18],
  ['岐阜', 35.39, 136.72], ['静岡', 34.98, 138.38], ['名古屋', 35.18, 136.91], ['津', 34.73, 136.51],
  ['大津', 35.0, 135.87], ['京都', 35.02, 135.76], ['大阪', 34.69, 135.52], ['神戸', 34.69, 135.18],
  ['奈良', 34.69, 135.83], ['和歌山', 34.23, 135.17], ['鳥取', 35.5, 134.24], ['松江', 35.47, 133.05],
  ['岡山', 34.66, 133.93], ['広島', 34.4, 132.46], ['山口', 34.19, 131.47], ['徳島', 34.07, 134.56],
  ['高松', 34.34, 134.04], ['松山', 33.84, 132.77], ['高知', 33.56, 133.53], ['福岡', 33.61, 130.42],
  ['佐賀', 33.25, 130.3], ['長崎', 32.74, 129.87], ['熊本', 32.79, 130.74], ['大分', 33.24, 131.61],
  ['宮崎', 31.91, 131.42], ['鹿児島', 31.56, 130.56], ['那覇', 26.21, 127.68],
].map(([name, lat, lon]) => ({ name, lat, lon }));

// WMOの天気コード → 表示（Open-Meteoのweather_code）
const CODE_TABLE = [
  [[0], '快晴', '☀️', 'sunny'],
  [[1], '晴れ', '🌤️', 'sunny'],
  [[2], '晴れ時々くもり', '⛅', 'cloudy'],
  [[3], 'くもり', '☁️', 'cloudy'],
  [[45, 48], '霧', '🌫️', 'fog'],
  [[51, 53, 55, 56, 57], '霧雨', '🌦️', 'rain'],
  [[61, 63, 80, 81], '雨', '🌧️', 'rain'],
  [[65, 82], '強い雨', '🌧️', 'rain'],
  [[66, 67], '凍る雨', '🌧️', 'rain'],
  [[71, 73, 75, 77, 85, 86], '雪', '❄️', 'snow'],
  [[95, 96, 99], '雷雨', '⛈️', 'thunder'],
];

export function weatherInfo(code, isDay = true) {
  const n = Number(code);
  for (const [codes, label, icon, kind] of CODE_TABLE) {
    if (codes.includes(n)) {
      // 夜の「晴れ」は月にする
      if (!isDay && kind === 'sunny') return { label, icon: '🌙', kind: 'night' };
      return { label, icon, kind };
    }
  }
  return { label: '不明', icon: '❔', kind: 'unknown' };
}

export function makePlace({ name, lat, lon, current = false }) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  const rla = Math.round(la * 100) / 100;
  const rlo = Math.round(lo * 100) / 100;
  return { id: `${rla},${rlo}`, name: String(name || '').trim().slice(0, 20) || '名前なし', lat: rla, lon: rlo, current: !!current };
}

// 地域を足す。3つまで。同じ場所は足さない。返り値 { places, ok, reason }
export function addPlace(places, place) {
  const list = Array.isArray(places) ? places : [];
  if (!place) return { places: list, ok: false, reason: 'invalid' };
  if (list.some((p) => p.id === place.id)) return { places: list, ok: false, reason: 'duplicate' };
  // 現在地は1つだけ持つ。少し移動して取り直した時は、枠を増やさず前の「現在地」と入れ替える。
  if (place.current && list.some((p) => p.current)) {
    return { places: list.map((p) => (p.current ? place : p)), ok: true, reason: null, replaced: true };
  }
  if (list.length >= MAX_PLACES) return { places: list, ok: false, reason: 'full' };
  return { places: [...list, place], ok: true, reason: null };
}

export function removePlace(places, id) {
  return (Array.isArray(places) ? places : []).filter((p) => p.id !== id);
}

// 履歴（選んだ・足した地域）。新しい順、同じ地域は先頭へ寄せて1件に。
export function pushHistory(history, place, now = Date.now()) {
  if (!place) return Array.isArray(history) ? history : [];
  const rest = (Array.isArray(history) ? history : []).filter((h) => h.id !== place.id);
  return [{ id: place.id, name: place.name, lat: place.lat, lon: place.lon, current: !!place.current, at: now }, ...rest].slice(0, HISTORY_MAX);
}

export function forecastUrl(place) {
  const q = [
    `latitude=${place.lat}`,
    `longitude=${place.lon}`,
    'current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    'hourly=temperature_2m,weather_code,precipitation_probability',
    'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    'wind_speed_unit=ms',
    'timezone=auto',
    'forecast_days=7',
  ].join('&');
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

// APIの応答を画面用に整える。足りない値はnullのまま持つ（0と書かない）。
export function parseForecast(json) {
  if (!json || typeof json !== 'object' || !json.current) return null;
  const c = json.current;
  const isDay = c.is_day !== 0;
  const current = {
    time: c.time || null,
    temp: num(c.temperature_2m),
    feels: num(c.apparent_temperature),
    humidity: num(c.relative_humidity_2m),
    wind: num(c.wind_speed_10m),
    isDay,
    code: num(c.weather_code),
    ...weatherInfo(c.weather_code, isDay),
  };
  const h = json.hourly || {};
  const times = Array.isArray(h.time) ? h.time : [];
  // 現在時刻（その地域の時刻の文字列。'YYYY-MM-DDTHH:MM'は辞書順で比べられる）以降の24時間ぶん
  const nowHour = String(c.time || '').slice(0, 13);
  let start = times.findIndex((t) => String(t).slice(0, 13) >= nowHour);
  if (start < 0) start = 0;
  const hourly = times.slice(start, start + 24).map((t, i) => {
    const k = start + i;
    const hour = Number(String(t).slice(11, 13));
    const day = hour >= 6 && hour < 18;
    return {
      time: t,
      hour,
      temp: num(h.temperature_2m?.[k]),
      pop: num(h.precipitation_probability?.[k]),
      ...weatherInfo(h.weather_code?.[k], day),
    };
  });
  const d = json.daily || {};
  const daily = (Array.isArray(d.time) ? d.time : []).map((t, i) => {
    const [y, m, dd] = String(t).split('-').map(Number);
    const dow = new Date(y, (m || 1) - 1, dd || 1).getDay();
    return {
      date: t,
      dayLabel: i === 0 ? '今日' : `${m}/${dd}(${DOW[dow]})`,
      max: num(d.temperature_2m_max?.[i]),
      min: num(d.temperature_2m_min?.[i]),
      pop: num(d.precipitation_probability_max?.[i]),
      ...weatherInfo(d.weather_code?.[i], true),
    };
  });
  return { current, hourly, daily };
}

// 予報を取りに行く。失敗は例外にせず { ok:false, reason } で返す。
export async function fetchForecast(place, { fetchImpl, timeoutMs = 12000 } = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { ok: false, reason: 'unsupported' };
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await f(forecastUrl(place), ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return { ok: false, reason: 'http', status: res.status };
    const data = parseForecast(await res.json());
    if (!data) return { ok: false, reason: 'format' };
    return { ok: true, data, at: Date.now() };
  } catch (e) {
    return { ok: false, reason: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function failureText(reason) {
  if (reason === 'offline') return 'オフラインのため天気を取得できません。通信がつながってから「もう一度」を押してください。';
  if (reason === 'http') return '天気サービスから予報を受け取れませんでした。少し時間をおいて「もう一度」を押してください。';
  if (reason === 'format') return '天気サービスの応答を読み取れませんでした。少し時間をおいて「もう一度」を押してください。';
  if (reason === 'unsupported') return 'この端末・ブラウザでは天気を取得できません。';
  return '天気を取得できませんでした。通信状態を確認して「もう一度」を押してください。';
}

export function fmtTemp(v) {
  return v == null ? '—' : `${Math.round(v)}°`;
}
