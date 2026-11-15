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
  assert.equal(d.daily[1].kind, 'snow');
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
