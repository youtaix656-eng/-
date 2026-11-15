import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PLACES, PRESET_PLACES, weatherInfo, makePlace, addPlace, removePlace, pushHistory,
  forecastUrl, parseForecast, fetchForecast, failureText, fmtTemp, HISTORY_MAX,
} from '../src/lib/weather.js';

test('PRESET_PLACES：47件・名前の重複なし・日本の範囲に収まる', () => {
  assert.equal(PRESET_PLACES.length, 47);
  assert.equal(new Set(PRESET_PLACES.map((p) => p.name)).size, 47);
  for (const p of PRESET_PLACES) {
    assert.ok(p.lat > 24 && p.lat < 46, p.name);
    assert.ok(p.lon > 122 && p.lon < 146, p.name);
  }
});

test('PRESET_PLACES：都道府県名で選べる（岩手県＝盛岡・宮城県＝仙台）', () => {
  const iwate = PRESET_PLACES.find((p) => p.name === '岩手県');
  const miyagi = PRESET_PLACES.find((p) => p.name === '宮城県');
  assert.equal(iwate.city, '盛岡');
  assert.equal(miyagi.city, '仙台');
  assert.equal(makePlace(iwate).name, '岩手県');
  for (const p of PRESET_PLACES) assert.ok(/[都道府県]$/.test(p.name) && p.city, p.name);
});

test('weatherInfo：コードを表示に直す。夜の晴れは月。知らないコードは不明', () => {
  assert.equal(weatherInfo(0).label, '快晴');
  assert.equal(weatherInfo(0, false).icon, '🌙');
  assert.equal(weatherInfo(63).kind, 'rain');
  assert.equal(weatherInfo(73).kind, 'snow');
  assert.equal(weatherInfo(95).kind, 'thunder');
  assert.equal(weatherInfo(1234).label, '不明');
});

test('makePlace：座標は小数第2位に丸める。不正な座標はnull', () => {
  const p = makePlace({ name: '現在地', lat: 35.68123, lon: 139.76789, current: true });
  assert.deepEqual(p, { id: '35.68,139.77', name: '現在地', lat: 35.68, lon: 139.77, current: true });
  assert.equal(makePlace({ name: 'x', lat: 'a', lon: 1 }), null);
  assert.equal(makePlace({ name: 'x', lat: 95, lon: 1 }), null);
});

test('addPlace：3つまで。同じ場所は足さない', () => {
  let places = [];
  for (const p of PRESET_PLACES.slice(0, MAX_PLACES)) places = addPlace(places, makePlace(p)).places;
  assert.equal(places.length, 3);
  const full = addPlace(places, makePlace(PRESET_PLACES[5]));
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'full');
  assert.equal(full.places.length, 3);
  assert.equal(addPlace(places.slice(0, 1), places[0]).reason, 'duplicate');
  assert.equal(addPlace(places, null).reason, 'invalid');
  assert.equal(removePlace(places, places[0].id).length, 2);
});

test('pushHistory：新しい順・同じ地域は1件に寄せる・上限で切る', () => {
  const a = makePlace(PRESET_PLACES[0]);
  const b = makePlace(PRESET_PLACES[1]);
  let h = pushHistory([], a, 1);
  h = pushHistory(h, b, 2);
  h = pushHistory(h, a, 3);
  assert.deepEqual(h.map((x) => x.name), [a.name, b.name]);
  assert.equal(h[0].at, 3);
  let many = [];
  PRESET_PLACES.forEach((p, i) => { many = pushHistory(many, makePlace(p), i); });
  assert.equal(many.length, HISTORY_MAX);
});

test('forecastUrl：緯度・経度と必要な項目が入る', () => {
  const u = forecastUrl({ lat: 35.69, lon: 139.69 });
  assert.ok(u.startsWith('https://api.open-meteo.com/v1/forecast?'));
  assert.ok(u.includes('latitude=35.69') && u.includes('longitude=139.69'));
  assert.ok(u.includes('timezone=auto') && u.includes('forecast_days=7'));
});

const SAMPLE = {
  current: { time: '2026-11-15T14:15', temperature_2m: 16.4, relative_humidity_2m: 55, apparent_temperature: 15.1, is_day: 1, weather_code: 2, wind_speed_10m: 3.2 },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => `2026-11-${15 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`),
    temperature_2m: Array.from({ length: 48 }, (_, i) => 10 + (i % 24) / 2),
    weather_code: Array.from({ length: 48 }, () => 61),
    precipitation_probability: Array.from({ length: 48 }, (_, i) => i),
  },
  daily: {
    time: ['2026-11-15', '2026-11-16'],
    weather_code: [2, 71],
    temperature_2m_max: [18.2, 9.9],
    temperature_2m_min: [8.1, null],
    precipitation_probability_max: [20, 80],
  },
};

test('parseForecast：今の天気・現在時刻以降の24時間・日ごとに整える', () => {
  const d = parseForecast(SAMPLE);
  assert.equal(d.current.temp, 16.4);
  assert.equal(d.current.label, '晴れ時々くもり');
  assert.equal(d.hourly.length, 24);
  assert.equal(d.hourly[0].time, '2026-11-15T14:00');
  assert.equal(d.hourly[0].pop, 14);
  assert.equal(d.daily[0].dayLabel, '今日');
  assert.equal(d.daily[1].dayLabel, '11/16(月)');
  assert.equal(d.daily[1].kind, 'rain'); // 1時間ごとの予報（日中ずっと雨）からまとめる。1日のコード（71）より優先
  assert.equal(d.daily[1].min, null); // 欠けている値を0にしない
  assert.equal(parseForecast({}), null);
  assert.equal(parseForecast(null), null);
});

test('fetchForecast：成功・HTTPエラー・通信失敗・形式違いを例外にせず返す', async () => {
  const place = { lat: 35.69, lon: 139.69 };
  const ok = await fetchForecast(place, { fetchImpl: async () => ({ ok: true, json: async () => SAMPLE }) });
  assert.equal(ok.ok, true);
  assert.equal(ok.data.current.temp, 16.4);
  const http = await fetchForecast(place, { fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.deepEqual([http.ok, http.reason], [false, 'http']);
  const net = await fetchForecast(place, { fetchImpl: async () => { throw new Error('x'); } });
  assert.equal(net.ok, false);
  const fmt = await fetchForecast(place, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(fmt.reason, 'format');
});

test('failureText・fmtTemp：理由ごとに次にすることまで書く。値が無ければ「—」', () => {
  for (const r of ['offline', 'http', 'format', 'network']) assert.ok(failureText(r).includes('もう一度'));
  assert.equal(fmtTemp(16.4), '16°');
  assert.equal(fmtTemp(null), '—');
});

test('addPlace：現在地は1つだけ。取り直した時は枠を増やさず入れ替える', () => {
  const tokyo = makePlace(PRESET_PLACES[12]);
  const here1 = makePlace({ name: '現在地', lat: 34.69, lon: 135.5, current: true });
  const here2 = makePlace({ name: '現在地', lat: 34.75, lon: 135.52, current: true });
  const a = addPlace(addPlace([], tokyo).places, here1).places;
  const r = addPlace(a, here2);
  assert.equal(r.ok, true);
  assert.equal(r.replaced, true);
  assert.deepEqual(r.places.map((p) => p.id), [tokyo.id, here2.id]);
  // 3つ埋まっていても、現在地の入れ替えはできる
  const full = addPlace(addPlace(a, makePlace(PRESET_PLACES[0])).places, here2);
  assert.equal(full.ok, true);
  assert.equal(full.places.length, 3);
});

test('北上市：一覧では岩手県のすぐ下に出て、盛岡とは別の地点になる', async () => {
  const { PLACE_OPTIONS, CITY_PLACES, placeOptionLabel } = await import('../src/lib/weather.js');
  const i = PLACE_OPTIONS.findIndex((p) => p.name === '岩手県');
  assert.equal(PLACE_OPTIONS[i + 1].name, '岩手県北上市');
  assert.equal(placeOptionLabel(PLACE_OPTIONS[i]), '岩手県（盛岡）');
  assert.equal(placeOptionLabel(PLACE_OPTIONS[i + 1]), '岩手県北上市');
  assert.equal(PLACE_OPTIONS.length, 47 + CITY_PLACES.length);
  assert.equal(new Set(PLACE_OPTIONS.map((p) => p.name)).size, PLACE_OPTIONS.length);
  const k = makePlace(PLACE_OPTIONS[i + 1]);
  assert.notEqual(k.id, makePlace(PLACE_OPTIONS[i]).id);
  assert.ok(k.lat > 39.2 && k.lat < 39.4 && k.lon > 141.0 && k.lon < 141.2);
});

test('summarizeDay：日中の1時間ごとの天気から1日をまとめる', async () => {
  const { summarizeDay } = await import('../src/lib/weather.js');
  const rep = (c, n) => Array(n).fill(c);
  assert.equal(summarizeDay(rep(0, 13)).label, '晴れ');
  assert.equal(summarizeDay(rep(3, 13)).label, 'くもり');
  assert.equal(summarizeDay([...rep(1, 8), ...rep(3, 5)]).label, '晴れ時々くもり');
  assert.equal(summarizeDay([...rep(1, 5), ...rep(3, 8)]).label, 'くもり時々晴れ');
  assert.equal(summarizeDay([...rep(3, 12), 61]).label, 'くもり一時雨');
  assert.equal(summarizeDay([...rep(3, 9), ...rep(61, 4)]).label, 'くもり時々雨');
  assert.equal(summarizeDay([...rep(0, 9), ...rep(71, 4)]).label, '晴れ時々雪');
  assert.equal(summarizeDay([...rep(3, 5), ...rep(63, 8)]).label, '雨');
  assert.equal(summarizeDay([...rep(3, 5), ...rep(73, 8)]).label, '雪');
  assert.equal(summarizeDay(rep(0, 3)), null); // 時間が足りない時はまとめない
  assert.equal(summarizeDay([null, undefined]), null);
});

test('parseForecast：夜中だけの雨で1日を「雨」にしない／昼夜は天気サービスの値を使う', () => {
  const time = []; const code = []; const isDay = []; const temp = []; const pop = [];
  for (let hh = 0; hh < 24; hh += 1) {
    time.push(`2026-11-15T${String(hh).padStart(2, '0')}:00`);
    code.push(hh < 3 ? 63 : 1); // 夜中の0〜2時だけ雨、あとは晴れ
    isDay.push(hh >= 7 && hh < 16 ? 1 : 0); // 冬：16時にはもう夜
    temp.push(5); pop.push(10);
  }
  const data = parseForecast({
    current: { time: '2026-11-15T15:00', temperature_2m: 5, is_day: 1, weather_code: 1 },
    hourly: { time, weather_code: code, is_day: isDay, temperature_2m: temp, precipitation_probability: pop },
    daily: { time: ['2026-11-15'], weather_code: [63], temperature_2m_max: [8], temperature_2m_min: [1], precipitation_probability_max: [80] },
  });
  assert.equal(data.daily[0].label, '晴れ'); // 天気サービスの1日コード（63＝雨）ではなく日中の実際
  assert.equal(data.hourly[0].hour, 15);
  assert.equal(data.hourly[0].icon, '🌤️');
  assert.equal(data.hourly[2].hour, 17);
  assert.equal(data.hourly[2].icon, '🌙'); // 17時は夜（6〜18時固定だと太陽になっていた）
});

test('parseForecast：1時間ごとのデータが無い日は、天気サービスの1日のコードを使う', () => {
  const data = parseForecast({
    current: { time: '2026-11-15T15:00', is_day: 1, weather_code: 1 },
    daily: { time: ['2026-11-15'], weather_code: [71] },
  });
  assert.equal(data.daily[0].label, '雪');
});
