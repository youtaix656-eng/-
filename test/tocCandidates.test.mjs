import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  proposeAddCandidate,
  proposeDeleteCandidate,
  suggestCandidatesFromTags,
  runTocChecks,
  acceptCandidate,
  rejectCandidate,
  undoLastTocAdditions,
} from '../src/lib/tocCandidates.js';
import { GLOSSARY_TERMS, effectiveGlossary } from '../src/data/glossaryTerms.js';

function makeTerm(overrides = {}) {
  return {
    id: 'gt-new',
    title: '新規用語',
    reading: 'しんきようご',
    category: 'keiraku',
    description: '',
    aliases: [],
    destinations: [],
    ...overrides,
  };
}

function baseState(overrides = {}) {
  const glossaryExtra = [];
  const removedIds = [];
  return {
    candidates: [],
    glossaryExtra,
    removedIds,
    history: [],
    fullGlossary: effectiveGlossary(glossaryExtra, removedIds),
    ...overrides,
  };
}

test('candidateNeverWritesToSourceUntilAccepted: 候補を作っただけでは本体データは変わらない', () => {
  const before = effectiveGlossary([], []);
  const candidates = proposeAddCandidate(makeTerm(), { trigger: 'user_request' }, []);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].status, 'pending');
  // 候補を作る操作自体はglossaryExtra/removedIdsに一切触れない（別の配列で完結する）
  const after = effectiveGlossary([], []);
  assert.deepEqual(before, after);
});

test('proposeAddCandidate: 会話由来の候補は常にneeds_reviewになる（渡した値を無視する）', () => {
  const candidates = proposeAddCandidate(makeTerm({ descriptionStatus: 'verified' }), { trigger: 'user_request' }, []);
  assert.equal(candidates[0].term.descriptionStatus, 'needs_review');
});

test('acceptedAddPassesAllRulesBeforeWrite: 4チェックのいずれかに落ちると反映されない', () => {
  const state = baseState();
  // 分類が未定義 → runTocChecksで落ちるはず
  const candidates = proposeAddCandidate(makeTerm({ category: 'no-such-category' }), { trigger: 'user_request' }, []);
  const res = acceptCandidate(candidates[0].id, { ...state, candidates });
  assert.equal(res.ok, false);
  assert.ok(res.errors.length > 0);
  assert.deepEqual(res.glossaryExtra, []); // 本体は変わらない
  // 候補自身はpendingのまま（承認されていない）
  assert.equal(res.candidates[0].status, 'pending');
});

test('acceptedAddPassesAllRulesBeforeWrite: 読み無し・重複もそれぞれ検出する', () => {
  const noReading = runTocChecks(makeTerm({ reading: '' }), []);
  assert.equal(noReading.ok, false);
  assert.ok(noReading.errors.some((e) => e.includes('読み')));

  const dup = runTocChecks(makeTerm({ title: GLOSSARY_TERMS[0].title, reading: GLOSSARY_TERMS[0].reading }), GLOSSARY_TERMS);
  assert.equal(dup.ok, false);
  assert.ok(dup.errors.some((e) => e.includes('重複')));
});

test('acceptedAddPassesAllRulesBeforeWrite: すべて満たせば承認でextraに入り履歴が残る', () => {
  const state = baseState();
  const candidates = proposeAddCandidate(makeTerm(), { trigger: 'user_request' }, []);
  const res = acceptCandidate(candidates[0].id, { ...state, candidates });
  assert.equal(res.ok, true);
  assert.equal(res.glossaryExtra.length, 1);
  assert.equal(res.glossaryExtra[0].title, '新規用語');
  assert.equal(res.candidates[0].status, 'accepted');
  assert.equal(res.history.length, 1);
  assert.equal(res.history[0].decision, 'accepted');
  assert.equal(res.history[0].action, 'add');
});

test('acceptedDeleteRemovesOnlyTarget: 削除候補を承認すると対象idだけがremovedIdsに入る', () => {
  const targetId = GLOSSARY_TERMS[0].id;
  const otherId = GLOSSARY_TERMS[1].id;
  const state = baseState();
  const candidates = proposeDeleteCandidate(targetId, { trigger: 'user_request' }, []);
  const res = acceptCandidate(candidates[0].id, { ...state, candidates });
  assert.equal(res.ok, true);
  assert.deepEqual(res.removedIds, [targetId]);
  assert.ok(!res.removedIds.includes(otherId));
  // 本体データ（extra）自体には影響しない
  assert.deepEqual(res.glossaryExtra, []);
});

test('rejectedCandidateLeavesNoTrace: 「しない」を選ぶとglossaryには一切影響しない', () => {
  const candidates = proposeAddCandidate(makeTerm(), { trigger: 'user_request' }, []);
  // rejectCandidateはcandidates/historyしか受け取らない・返さない設計
  // （glossaryExtra/removedIdsを引数にも戻り値にも持たない＝呼びようがない＝本体に触れない）
  const rejectRes = rejectCandidate(candidates[0].id, { candidates, history: [] });
  assert.equal(rejectRes.ok, true);
  assert.equal(rejectRes.candidates[0].status, 'rejected');
  assert.deepEqual(Object.keys(rejectRes).sort(), ['candidates', 'history', 'ok']);
  // 履歴には「見送り」として残る（#23）
  assert.equal(rejectRes.history[0].decision, 'rejected');
});

test('candidateGeneratedOnlyByWhitelistedTrigger: 候補を生成できるのはpropose*/suggestCandidatesFromTagsだけ', () => {
  const src = readFileSync(new URL('../src/lib/tocCandidates.js', import.meta.url), 'utf8');
  const exportedFns = [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
  const generators = exportedFns.filter((n) => /^propose|^suggest/.test(n));
  assert.deepEqual(generators.sort(), ['proposeAddCandidate', 'proposeDeleteCandidate', 'suggestCandidatesFromTags'].sort());
});

test('candidateGeneratedOnlyByWhitelistedTrigger: suggestCandidatesFromTagsのtriggerは常にtags', () => {
  const questions = [{ id: 'q1', tags: ['まだ用語集に無いタグ'] }];
  const candidates = suggestCandidatesFromTags(questions, GLOSSARY_TERMS, {}, []);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].addedFrom.trigger, 'tags');
  assert.equal(candidates[0].term.descriptionStatus, 'needs_review');
});

test('candidateGeneratedOnlyByWhitelistedTrigger: suggestCandidatesFromTagsはどこからも自動で呼ばれていない', () => {
  const componentDir = new URL('../src/components/', import.meta.url);
  const libDir = new URL('../src/lib/', import.meta.url);
  const files = [
    ...readdirSync(componentDir, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.jsx?$/.test(e.name))
      .map((e) => new URL(e.name, componentDir)),
    ...readdirSync(libDir, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.jsx?$/.test(e.name))
      .map((e) => new URL(e.name, libDir)),
  ];
  for (const f of files) {
    if (f.pathname.endsWith('tocCandidates.js')) continue;
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(
      src,
      /suggestCandidatesFromTags\s*\(/,
      `${f.pathname}: suggestCandidatesFromTagsを呼んでいます（自動発火の禁止に違反）`
    );
  }
});

test('undoRemovesOnlyTargetedEntries: 直近n件だけをextraから取り消す', () => {
  const t1 = makeTerm({ id: 'gt-1', title: '用語1', reading: 'ようご1' });
  const t2 = makeTerm({ id: 'gt-2', title: '用語2', reading: 'ようご2' });
  const t3 = makeTerm({ id: 'gt-3', title: '用語3', reading: 'ようご3' });
  const glossaryExtra = [t1, t2, t3];
  const history = [
    { id: 'h1', action: 'add', term: t1, decision: 'accepted', at: 1000 },
    { id: 'h2', action: 'add', term: t2, decision: 'accepted', at: 2000 },
    { id: 'h3', action: 'add', term: t3, decision: 'accepted', at: 3000 },
  ];
  const res = undoLastTocAdditions(1, { glossaryExtra, history });
  assert.equal(res.removedCount, 1);
  // 最新（t3, at:3000）だけが消え、t1・t2は残る
  assert.deepEqual(
    res.glossaryExtra.map((t) => t.id),
    ['gt-1', 'gt-2']
  );
});

test('undoRemovesOnlyTargetedEntries: nを超える対象は無い場合はある分だけ取り消す', () => {
  const t1 = makeTerm({ id: 'gt-1', title: '用語1', reading: 'ようご1' });
  const glossaryExtra = [t1];
  const history = [{ id: 'h1', action: 'add', term: t1, decision: 'accepted', at: 1000 }];
  const res = undoLastTocAdditions(5, { glossaryExtra, history });
  assert.equal(res.removedCount, 1);
  assert.deepEqual(res.glossaryExtra, []);
});
