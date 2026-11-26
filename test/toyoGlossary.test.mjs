import test from 'node:test';
import assert from 'node:assert/strict';
import { TOYO_GLOSSARY_ROWS, buildToyoGlossaryTerms, toyoSpeechReadings } from '../src/data/toyoGlossaryTerms.js';
import { GLOSSARY_TERMS } from '../src/data/glossaryTerms.js';
import { SPEECH_READINGS } from '../src/data/speechReadings.js';
import { buildReadingDict, applyReadingDict } from '../src/lib/speechText.js';

test('東洋医学概論の用語：167語すべてに読みと意味があり、用語集に入っている', () => {
  assert.equal(TOYO_GLOSSARY_ROWS.length, 167);
  for (const [title, reading, desc] of TOYO_GLOSSARY_ROWS) {
    assert.ok(title && desc, title);
    assert.match(reading, /^[ぁ-んー]+$/, `${title} の読みがひらがなではない`);
  }
  const ids = new Set(GLOSSARY_TERMS.map((t) => t.id));
  for (const t of buildToyoGlossaryTerms()) {
    assert.ok(ids.has(t.id), t.title);
    for (const d of t.destinations) if (d.type === 'system') assert.ok(ids.has(d.target), `${t.title} → ${d.target}`);
  }
});

test('東洋医学概論の用語：音声学習で読みが当たる（1文字の言葉は当てない）', () => {
  const r = toyoSpeechReadings();
  assert.ok(!('水' in r) && !('神' in r));
  const dict = buildReadingDict({ common: SPEECH_READINGS });
  assert.equal(applyReadingDict('悪寒発熱がある', dict), 'おかんはつねつがある');
  assert.equal(applyReadingDict('眩暈と耳聾', dict), 'げんうんとじろう');
  assert.equal(applyReadingDict('裏急後重', dict), 'りきゅうこうじゅう');
  assert.equal(applyReadingDict('日哺潮熱', dict), 'にっぽちょうねつ');
});
