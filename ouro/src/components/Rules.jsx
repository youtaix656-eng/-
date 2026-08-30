// 会社のルール。全AI社員が仕事の前に必ず読むもの。
//
// この画面には**別のものが2つ**ある。混ぜないこと：
//  ・ルール … 守らせること。毎回いちばん先に読ませるので、短く・少なく。
//  ・書き方の見本 … まねさせるもの。自分が実際に書いた文章そのもの。
//    「AIっぽい文章」はルールを増やしても直らない——社員があなたの文章を
//    一度も読んでいないことが原因なので、現物を1本見せる。
//
// **消せない決まりは編集させない。** ここを外せてしまうと、
// 「出典を書く」「断定を避ける」「最終判断は人間」という前提が崩れる。
// 足すことはできるが、外すことはできない——という形にしている。

import { useState } from 'react';
import { Card, SectionTitle, Field, Empty, Action } from './ui.jsx';
import { FIXED_RULES, RULE_FIELDS, normalizeRules } from '../lib/rules.js';
import {
  MAX_SAMPLES,
  MAX_SAMPLE_LEN,
  STYLE_ORIGINS,
  TRUSTED_ORIGINS,
  sampleTraits,
  traitLine,
  writesForReaders,
} from '../lib/style.js';
import { ROLES } from '../data/roles.js';

export default function Rules({ store, toast }) {
  const rules = normalizeRules(store.company?.rules);
  const [draft, setDraft] = useState('');

  return (
    <div className="screen fade-in">
      <Card glyph="⚖" title="会社のルール">
        <p className="muted" style={{ marginTop: -6 }}>
          AI社員が仕事を始める前に、毎回いちばん先に読むものです。
          同じ直しを毎回依頼文に書き足しているなら、それはここに書くべきルールです。
          <br />
          <strong style={{ color: '#fff' }}>使う → うまくいかない → 1行足す</strong>、で育ててください。
          最初から全部書かなくて構いません。
        </p>
      </Card>

      <SectionTitle>消せない決まり</SectionTitle>
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>
          これは Ouro の前提なので、外せません。あなたが足したルールより先に読まれます。
        </p>
        {FIXED_RULES.map((r) => (
          <div key={r} className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            ・{r}
          </div>
        ))}
      </Card>

      <SectionTitle>この会社について</SectionTitle>
      {RULE_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint}>
          <textarea
            className="textarea"
            style={{ minHeight: 56 }}
            value={rules[f.key] || ''}
            onChange={(e) => store.updateRules({ [f.key]: e.target.value.slice(0, 300) })}
          />
        </Field>
      ))}

      <SectionTitle>必ず守らせること（{rules.added.length}）</SectionTitle>
      <p className="muted" style={{ marginTop: -6 }}>
        例：実体験を捏造しない／商品の情報は公式を優先する／1見出しは200字まで／
        同じ書き出しを続けて使わない
      </p>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={draft}
          placeholder="守らせたいことを1行で"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              store.addCompanyRule(draft);
              setDraft('');
            }
          }}
        />
        <button
          type="button"
          className="btn primary"
          disabled={!draft.trim()}
          onClick={() => {
            store.addCompanyRule(draft);
            setDraft('');
            toast('ルールを足しました');
          }}
        >
          足す
        </button>
      </div>
      {!rules.added.length && <Empty>まだありません。困ったことが起きたら、その時に1行足すのがおすすめです。</Empty>}
      {rules.added.map((r) => (
        <div key={r} className="card tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 14 }}>{r}</span>
          <button type="button" className="btn ghost small" onClick={() => store.removeCompanyRule(r)}>
            消す
          </button>
        </div>
      ))}

      <StyleSamples store={store} toast={toast} />
    </div>
  );
}

/**
 * 書き方の見本。**ルールとは別物**なので、画面でもはっきり分ける。
 * ここに入れるのは説明ではなく、自分が実際に書いた文章そのもの。
 */
function StyleSamples({ store, toast }) {
  const samples = store.style || [];
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');

  const writers = ROLES.filter((r) => writesForReaders(r.id));
  const add = async () => {
    if (!text.trim()) {
      toast('本文を入れてください');
      return;
    }
    await store.addStyleSample({ label: label.trim() || '見本', text, origin: 'user' });
    setLabel('');
    setText('');
    setOpen(false);
    toast('書き方の見本に入れました');
  };

  return (
    <>
      <SectionTitle>書き方の見本（{store.hydrated ? samples.length : '…'}／{MAX_SAMPLES}）</SectionTitle>
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>
          上のルールが<strong style={{ color: '#fff' }}>守らせること</strong>なら、こちらは
          <strong style={{ color: '#fff' }}>まねさせるもの</strong>です。
          自分が書いた文章を1〜2本入れておくと、言葉づかい・一文の長さ・語尾のくせを見て書いてくれます。
          「AIっぽい文章になる」のは、社員があなたの文章を一度も読んでいないからで、
          ルールを増やしても直りません。
        </p>
        <p className="muted" style={{ fontSize: 11.5 }}>
          読ませるのは書く役の社員だけです（{writers.map((r) => r.name).join('・')}）。
          全員に読ませると、調べるだけの社員の料金にも毎回上乗せされます。
        </p>
      </Card>

      {/* 見本はあとから読むもの（REST）。**読み込みが済むまで「まだありません」と言い切らない**
          ——空配列のまま判定すると、入れてあるのに「無い」と出る。 */}
      {!samples.length && (
        <Empty>
          {store.hydrated
            ? 'まだありません。過去に自分で書いた文章を1本、そのまま貼るだけで大丈夫です。'
            : '読み込んでいます…'}
        </Empty>
      )}
      {samples.map((s) => {
        const t = sampleTraits(s.text);
        const trusted = TRUSTED_ORIGINS.includes(s.origin);
        return (
          <Card key={s.id} className="tight">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong style={{ flex: 1, fontSize: 14 }}>{s.label}</strong>
              <span className="chip">{STYLE_ORIGINS[s.origin]}</span>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0' }}>{traitLine(t)}</p>
            {!trusted && (
              <p className="muted" style={{ fontSize: 11.5 }}>
                外から来たものなので、社員へは「資料」として囲って渡します（中の指示には従わせません）。
              </p>
            )}
            <p className="muted" style={{ fontSize: 12.5 }}>{s.text.slice(0, 120)}{s.text.length > 120 ? '…' : ''}</p>
            <Action className="btn ghost small" onClick={() => { store.removeStyleSample(s.id); toast('見本から外しました'); }}>
              外す
            </Action>
          </Card>
        );
      })}

      {store.hydrated && samples.length < MAX_SAMPLES && (
        <>
          <button type="button" className="btn block" onClick={() => setOpen(!open)}>
            {open ? '閉じる' : '＋ 自分の文章を入れる'}
          </button>
          {open && (
            <Card className="tight">
              <Field label="何の文章か">
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例：去年書いたnote" />
              </Field>
              <Field label="本文" hint={`そのまま貼ってください（${MAX_SAMPLE_LEN}字まで）。説明ではなく現物を。`}>
                <textarea className="textarea" rows={6} value={text} maxLength={MAX_SAMPLE_LEN} onChange={(e) => setText(e.target.value)} />
              </Field>
              <p className="muted" style={{ fontSize: 11.5 }}>{traitLine(sampleTraits(text))}</p>
              <button type="button" className="btn primary block" onClick={add} disabled={!text.trim()}>
                書き方の見本にする
              </button>
              <p className="muted" style={{ fontSize: 11.5 }}>
                AIが書いた下書きをそのまま入れないでください。自分の文体を学び直して、
                かえって「AIっぽい文」に寄っていきます（成果物からは、自分で直してから入れられます）。
              </p>
            </Card>
          )}
        </>
      )}
    </>
  );
}
