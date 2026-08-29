import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchFaq } from '../src/lib/faqSearch.js';
import faq from '../src/data/faq.js';

const LIST = [
  { id: 'a', category: 'テスト', question: 'Googleのログイン画面が毎回出て邪魔。', answer: 'サイレント認証の失敗を検知して自動再試行を止めるようにしました。', tags: ['Google', 'ログイン', 'ポップアップ'] },
  { id: 'b', category: 'テスト', question: '復習の間隔はどう決まっている？', answer: 'SRSで自動計算します。', tags: ['SRS', '間隔反復'] },
  { id: 'c', category: 'テスト', question: '機種変更したらデータはどうなる？', answer: 'QRやバックアップファイルで移行できます。', tags: ['機種変更'] },
];

test('searchFaq: 空クエリは全件を返す', () => {
  const r = searchFaq(LIST, '');
  assert.equal(r.length, LIST.length);
});

test('searchFaq: 単語1語のキーワード検索でヒットする', () => {
  const r = searchFaq(LIST, 'ログイン');
  assert.ok(r.some((f) => f.id === 'a'));
  assert.ok(!r.some((f) => f.id === 'c'));
});

test('searchFaq: タグ経由でもヒットする', () => {
  const r = searchFaq(LIST, 'SRS');
  assert.ok(r.some((f) => f.id === 'b'));
});

test('searchFaq: 文章をそのまま貼り付けても該当項目が拾える', () => {
  const r = searchFaq(LIST, 'Googleのログイン画面が毎回出てくるので邪魔で困っています');
  assert.ok(r.length > 0);
  assert.equal(r[0].id, 'a');
});

test('searchFaq: 完全一致は文章検索より上位に来る', () => {
  const r = searchFaq(LIST, 'ログイン');
  assert.equal(r[0].id, 'a');
});

test('searchFaq: 関係の無い単語では何もヒットしない', () => {
  const r = searchFaq(LIST, 'まったく関係のない架空の単語XYZ123');
  assert.equal(r.length, 0);
});

test('searchFaq: 実データ（faq.js）でも例外を投げず、キーワードで正しくヒットする', () => {
  const r = searchFaq(faq, 'ログイン');
  assert.ok(r.length > 0);
  assert.ok(r.some((f) => f.id === 'google-login-popup'));
});

test('searchFaq: 実データでカテゴリ検索語（例：機種変更）もヒットする', () => {
  const r = searchFaq(faq, '機種変更');
  assert.ok(r.some((f) => f.id === 'device-migration'));
});
