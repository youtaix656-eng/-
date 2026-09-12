import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeCare, normalizeState, normalizeSymptom } from '../src/lib/storage.js';
import { DEFAULT_QUICK_CARE } from '../src/data/quickCare.js';
import { care, NOW, symptom } from './fixtures.js';

test('壊れた保存データでも落ちず、初期状態に戻る', () => {
  assert.deepEqual(normalizeState(null), initialState());
  assert.deepEqual(normalizeState('x'), initialState());
  assert.deepEqual(normalizeState({}), initialState());
});

test('必須項目が読めない記録は捨てる（黙って別の値に置き換えない）', () => {
  assert.equal(normalizeSymptom({ id: 'a', at: NOW, regionId: 'nowhere', vas: 3 }), null);
  assert.equal(normalizeSymptom({ id: 'a', at: NOW, regionId: 'head', vas: 11 }), null);
  assert.equal(normalizeSymptom({ id: '', at: NOW, regionId: 'head', vas: 1 }), null);
  assert.equal(normalizeCare({ id: 'k', at: NOW, content: '   ' }), null);
});

test('任意項目が欠けていても補う', () => {
  const s = normalizeSymptom({ id: 'a', at: NOW, regionId: 'head', vas: 3.4 });
  assert.deepEqual(s, { id: 'a', at: NOW, regionId: 'head', vas: 3, side: null, timing: 'other', timingOther: '', note: '' });
  const c = normalizeCare({ id: 'k', at: NOW, content: '温める', effect: 'なにか' });
  assert.equal(c?.effect, 'same');
  assert.equal(c?.date, '2026-09-12');
  assert.deepEqual(c?.symptomIds, []);
});

test('存在しない症状への紐づけは外す・同じ id は1件にまとめる', () => {
  const st = normalizeState({
    symptoms: [symptom({ id: 'a' }), symptom({ id: 'a', vas: 9 })],
    cares: [care({ id: 'k', symptomIds: ['a', 'ghost'] })],
    settings: { quickCareItems: ['温める', ''], lastView: 'cares' },
  });
  assert.equal(st.symptoms.length, 1);
  assert.equal(st.symptoms[0].vas, 5);
  assert.deepEqual(st.cares[0].symptomIds, ['a']);
  assert.deepEqual(st.settings.quickCareItems, ['温める']);
  assert.equal(st.settings.lastView, 'cares');
});

test('設定が無ければ初期のクイック項目', () => {
  const st = normalizeState({ symptoms: [], cares: [] });
  assert.deepEqual(st.settings.quickCareItems, [...DEFAULT_QUICK_CARE]);
});
