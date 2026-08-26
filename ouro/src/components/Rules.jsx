// 会社のルール。全AI社員が仕事の前に必ず読むもの。
//
// **消せない決まりは編集させない。** ここを外せてしまうと、
// 「出典を書く」「断定を避ける」「最終判断は人間」という前提が崩れる。
// 足すことはできるが、外すことはできない——という形にしている。

import { useState } from 'react';
import { Card, SectionTitle, Field, Empty } from './ui.jsx';
import { FIXED_RULES, RULE_FIELDS, normalizeRules } from '../lib/rules.js';

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
    </div>
  );
}
