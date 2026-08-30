// 発信——型 → まとめて作る → 出す → 数える → 伸びた型を次の種にする。
//
// 量産だけでは伸びない。効くのは**回すこと**：
//   ①型を決めて何本か出す ②実際の数字を見る ③伸びた型だけを次の種にする
// これを繰り返すと中身が一つに寄り、その話が読みたい人だけが残る。
//
// **AIを呼ぶのは「まとめて作る」を押した時だけ**（そこから先は依頼の道を通るので、
// 費用の確認も日・月の上限もそのまま効く）。順位も候補もその場の計算で出す。

import { useMemo, useState } from 'react';
import { Card, SectionTitle, Field, Empty, Action } from './ui.jsx';
import {
  PATTERN_ORIGINS, MIN_POSTS, makePattern, patternsOf, rankPatterns, bestPattern,
  winnerCandidates, candidateStatus, patternFromPost,
} from '../lib/patterns.js';
import { BATCH_SIZES, DEFAULT_BATCH, batchRequest, splitPosts, overLimit, limitOf } from '../lib/batch.js';
import { POST_CHANNELS, channelName, postsOf } from '../lib/posts.js';
import { activeVenture } from '../lib/venture.js';
import { prepublishChecks, prepublishLine } from '../lib/prepublish.js';
import { similarOpenings } from '../lib/opening.js';
import { assembleResult } from '../lib/workflow.js';
import { useAllTasks } from './useAllTasks.js';

export default function Studio({ store, go, toast }) {
  // 出来た投稿は古い仕事にも残るので、全部の仕事を見る
  useAllTasks(store);
  const venture = activeVenture(store.ventures || []);
  const vid = venture ? venture.id : null;
  const patterns = useMemo(() => patternsOf(store.patterns || [], vid), [store.patterns, vid]);
  const posts = useMemo(() => postsOf(store.posts || [], vid), [store.posts, vid]);
  const ranked = useMemo(() => rankPatterns(patterns, posts), [patterns, posts]);
  const best = useMemo(() => bestPattern(patterns, posts), [patterns, posts]);
  const candidates = useMemo(() => winnerCandidates(posts, store.patterns || []), [posts, store.patterns]);
  const candStatus = useMemo(() => candidateStatus(posts), [posts]);

  const [channel, setChannel] = useState('x');
  const [count, setCount] = useState(DEFAULT_BATCH);
  const [extra, setExtra] = useState('');
  const [picked, setPicked] = useState([]);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seed, setSeed] = useState({ label: '', text: '' });

  const useThese = picked.length ? patterns.filter((p) => picked.includes(p.id)) : patterns.slice(0, 4);

  const make = () => {
    const request = batchRequest({ venture, patterns: useThese, count, channel, extra });
    const t = store.newTask({
      request,
      workflowId: 'make_content',
      ventureId: vid,
      // まとめて作る仕事は本数が多いので、既定で安いモデルに寄せる
      costMode: store.settings.costMode === 'best' ? 'best' : 'cheap',
      doneWhen: `${count}本ある、1本ずつ見出しで分かれている、効果を保証していない、同じ書き出しが続いていない`,
    });
    go('task', t.id);
    store.runTask(t.id);
  };

  const addSeed = async () => {
    if (!seed.text.trim()) {
      toast('見本の本文を入れてください');
      return;
    }
    await store.addPattern(makePattern({ ventureId: vid, text: seed.text, label: seed.label, origin: 'seed' }));
    setSeed({ label: '', text: '' });
    setSeedOpen(false);
    toast('型に入れました');
  };

  return (
    <div className="screen fade-in">
      <Card glyph="↗" title="発信">
        <p className="muted" style={{ marginTop: -6 }}>
          まとめて作るだけでは伸びません。効くのは
          <strong style={{ color: '#fff' }}>①型を決めて何本か出す ②数字を見る
          ③伸びた型だけを次の種にする</strong>、を繰り返すことです。
          繰り返すほど中身が一つに寄り、その話が読みたい人だけが残ります。
        </p>
        {!venture && (
          <p className="muted" style={{ fontSize: 11.5 }}>
            実行中の事業がありません。事業を決めておくと「誰に・何を」が投稿に入ります。
          </p>
        )}
      </Card>

      {best && (
        <Card glyph="◎" title="いま効いている型">
          <p className="muted" style={{ marginTop: -6 }}>
            {best.label || best.text.slice(0, 30)}
            {'　'}
            1投稿あたりの反応 {ranked.find((r) => r.pattern.id === best.id)?.stats.perPost}
          </p>
          <p className="muted" style={{ fontSize: 11.5 }}>
            次はこの型で作ると、いまのフォロワーと噛み合いやすくなります。
          </p>
        </Card>
      )}

      <SectionTitle>まとめて作る</SectionTitle>
      <Card className="tight">
        <Field label="どこへ出すか">
          <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {POST_CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {limitOf(c.id) ? `（${limitOf(c.id)}字まで）` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="何本つくるか" hint="20本ずつ出して数字を見る、が回しやすい形です。">
          <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {BATCH_SIZES.map((n) => (
              <option key={n} value={n}>{n}本</option>
            ))}
          </select>
        </Field>
        {patterns.length > 0 && (
          <Field label="種にする型（選ばなければ上から4つ）">
            <div className="chips">
              {patterns.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${picked.includes(p.id) ? 'on' : ''}`}
                  onClick={() =>
                    setPicked((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))
                  }
                >
                  {p.label || p.text.slice(0, 14)}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="追加の指定（任意）" hint="例：数字を入れる／体験談は書かない／絵文字を使わない">
          <input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </Field>
        <Action className="btn primary block" onClick={make}>
          {patterns.length ? `この型で${count}本つくる` : `${count}本つくる（型なし）`}
        </Action>
        <p className="muted" style={{ fontSize: 11.5 }}>
          押すと依頼になります。費用の確認と日・月の上限は今までどおり通ります。
        </p>
      </Card>

      <SectionTitle>型（{patterns.length}／{MIN_POSTS}本出すと順位が付きます）</SectionTitle>
      {!patterns.length && (
        <Empty>
          型がまだありません。最初だけ、伸びている投稿を見本として1〜4本入れてください。
          そのあとは、あなた自身の伸びた投稿から作れます。
        </Empty>
      )}
      {ranked.map(({ pattern, stats, rank }) => (
        <div key={pattern.id} className="post-row">
          <div className="p-title">
            {rank ? `${rank}位　` : ''}
            {pattern.label || pattern.text.slice(0, 24)}
          </div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {PATTERN_ORIGINS[pattern.origin]}・{stats.count}本
            {stats.tooFew
              ? `・あと${MIN_POSTS - stats.count}本で順位が付きます`
              : stats.perPost > 0
                ? `・1投稿あたりの反応 ${stats.perPost}・見られた${stats.reach}・登録${stats.lead}`
                : '・数字がまだ入っていません（下の「出した投稿」から入れてください）'}
          </div>
          <div className="btn-row">
            <button type="button" className="btn ghost small" onClick={() => navigator.clipboard?.writeText(pattern.text)}>
              本文をコピー
            </button>
            <button type="button" className="btn ghost small" onClick={() => store.removePattern(pattern.id)}>
              外す
            </button>
          </div>
        </div>
      ))}

      {!seedOpen ? (
        <button type="button" className="btn block" onClick={() => setSeedOpen(true)}>
          ＋ 見本を型に入れる
        </button>
      ) : (
        <Card className="tight">
          <p className="muted" style={{ marginTop: 0, fontSize: 11.5 }}>
            まねるのは<strong style={{ color: '#fff' }}>組み立て方</strong>（書き出し・運び・締め）です。
            本文をそのまま出さないでください。
          </p>
          <Field label="呼び名（任意）">
            <input className="input" value={seed.label} onChange={(e) => setSeed({ ...seed, label: e.target.value })} placeholder="例：失敗談から入る型" />
          </Field>
          <Field label="本文">
            <textarea className="textarea" style={{ minHeight: 110 }} value={seed.text} onChange={(e) => setSeed({ ...seed, text: e.target.value })} />
          </Field>
          <div className="btn-row">
            <Action className="btn primary" onClick={addSeed}>型に入れる</Action>
            <button type="button" className="btn ghost" onClick={() => setSeedOpen(false)}>やめる</button>
          </div>
        </Card>
      )}

      <SectionTitle>これを型にしませんか</SectionTitle>
      {!candStatus.ready && (
        <Empty>
          反応の数字が入った投稿が{MIN_POSTS}本になると、平均よりはっきり伸びたものを
          型の候補として出します（いま{candStatus.measured}本・あと{candStatus.need}本）。
          下の「出した投稿」から数字を入れてください。
        </Empty>
      )}
      {candStatus.ready && candidates.length === 0 && (
        <Empty>
          いまのところ、平均（反応{candStatus.avg}）よりはっきり伸びた投稿はありません。
        </Empty>
      )}
      {candidates.length > 0 && (
        <>
          <Card className="tight">
            <p className="muted" style={{ marginTop: 0, fontSize: 11.5 }}>
              あなたの投稿の平均（反応{candidates[0].avg}）より、はっきり伸びたものです。
              <strong style={{ color: '#fff' }}>入れるかどうかは、あなたが決めてください。</strong>
            </p>
            {candidates.map((c) => (
              <div key={c.post.id} className="post-row">
                <div className="p-title">{c.post.title || c.post.text.slice(0, 24)}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  平均の{c.times}倍・反応{c.post.reaction}・{channelName(c.post.channel)}
                </div>
                <Action
                  className="btn small"
                  onClick={async () => {
                    await store.addPattern(patternFromPost(c.post, vid));
                    toast('型に入れました');
                  }}
                >
                  この投稿を型にする
                </Action>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>出した投稿（数字を入れる）</SectionTitle>
      {!posts.length && <Empty>まだありません。下で作った投稿を「出した」で記録してください。</Empty>}
      {posts.slice(0, 12).map((post) => (
        <PostNumbers key={post.id} post={post} store={store} patterns={patterns} toast={toast} />
      ))}

      <SectionTitle>出来た投稿</SectionTitle>
      <MadePosts store={store} go={go} toast={toast} vid={vid} channel={channel} patterns={patterns} posts={posts} />
    </div>
  );
}

/**
 * 出した投稿に、あとから反応の数字を入れる。
 *
 * **ここが無いと回し方が閉じない。** 出しっぱなしでは「どの型が効いたか」が
 * 永遠に分からず、次の種も選べない。分からない数字は0のままでよい。
 */
function PostNumbers({ post, store, patterns, toast }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    reach: String(post.reach || ''),
    reaction: String(post.reaction || ''),
    lead: String(post.lead || ''),
    patternId: post.patternId || '',
  });
  const pat = patterns.find((x) => x.id === post.patternId);

  const save = async () => {
    await store.updateSharePost(post.id, {
      reach: Number(v.reach) || 0,
      reaction: Number(v.reaction) || 0,
      lead: Number(v.lead) || 0,
      patternId: v.patternId || null,
    });
    setOpen(false);
    toast('数字を入れました');
  };

  return (
    <div className="post-row">
      <div className="p-title">{post.title || (post.text || '').slice(0, 28) || '（題名なし）'}</div>
      <div className="muted" style={{ fontSize: 11.5 }}>
        {channelName(post.channel)}・{new Date(post.postedAt).toLocaleDateString('ja-JP')}
        {pat ? `・型：${pat.label || pat.text.slice(0, 10)}` : '・型なし'}
        {post.reach || post.reaction || post.lead
          ? `・見られた${post.reach}／反応${post.reaction}／登録${post.lead}`
          : '・数字はまだ'}
      </div>
      {!open ? (
        <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>
          数字を入れる
        </button>
      ) : (
        <>
          <div className="stats">
            <Field label="見られた">
              <input className="input" type="number" inputMode="numeric" min="0" value={v.reach} onChange={(e) => setV({ ...v, reach: e.target.value })} />
            </Field>
            <Field label="反応">
              <input className="input" type="number" inputMode="numeric" min="0" value={v.reaction} onChange={(e) => setV({ ...v, reaction: e.target.value })} />
            </Field>
            <Field label="登録">
              <input className="input" type="number" inputMode="numeric" min="0" value={v.lead} onChange={(e) => setV({ ...v, lead: e.target.value })} />
            </Field>
          </div>
          {patterns.length > 0 && (
            <Field label="どの型で出したか">
              <select className="select" value={v.patternId} onChange={(e) => setV({ ...v, patternId: e.target.value })}>
                <option value="">型なし</option>
                {patterns.map((x) => (
                  <option key={x.id} value={x.id}>{x.label || x.text.slice(0, 12)}</option>
                ))}
              </select>
            </Field>
          )}
          <div className="btn-row">
            <Action className="btn primary small" onClick={save}>保存する</Action>
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>やめる</button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 直近の「まとめて作る」の成果を、1本ずつ貼れる形で並べる。
 *
 * **1本ずつ出す前チェックを通す**（確約・個人情報・書き出しの重なり）。
 * 量産はここが崩れやすい——同じ型から5本作ると、書き出しがそっくりになる。
 */
function MadePosts({ store, go, toast, vid, channel, patterns, posts }) {
  const [openId, setOpenId] = useState(null);
  const tasks = useMemo(
    () =>
      (store.tasks || [])
        .filter((t) => t.status === 'done' && t.ventureId === vid && /まとめて作って|本、まとめて/.test(t.request || ''))
        .slice(0, 5),
    [store.tasks, vid]
  );

  if (!tasks.length) {
    return <Empty>まだありません。上の「まとめて作る」を押すと、ここに1本ずつ並びます。</Empty>;
  }

  return (
    <>
      {tasks.map((task) => {
        const items = splitPosts(assembleResult(task));
        const over = overLimit(items, channel);
        const isOpen = openId === task.id;
        return (
          <Card key={task.id} className="tight">
            <div className="p-title">
              {new Date(task.finishedAt || task.createdAt).toLocaleDateString('ja-JP')}・{items.length}本
              {over.length > 0 ? `・${over.length}本が長すぎます` : ''}
            </div>
            <div className="btn-row">
              <button type="button" className="btn small" onClick={() => setOpenId(isOpen ? null : task.id)}>
                {isOpen ? '▲ 閉じる' : '▼ 1本ずつ見る'}
              </button>
              <button type="button" className="btn ghost small" onClick={() => go('task', task.id)}>
                仕事を見る
              </button>
            </div>
            {isOpen &&
              items.map((item) => (
                <OnePost
                  key={`${task.id}-${item.n}`}
                  item={item}
                  task={task}
                  store={store}
                  toast={toast}
                  vid={vid}
                  channel={channel}
                  patterns={patterns}
                  posts={posts}
                  siblings={items}
                />
              ))}
          </Card>
        );
      })}
    </>
  );
}

function OnePost({ item, task, store, toast, vid, channel, patterns, posts, siblings }) {
  const [done, setDone] = useState(false);
  const [patternId, setPatternId] = useState(patterns[0] ? patterns[0].id : '');
  const limit = limitOf(channel);
  const tooLong = limit && item.text.length > limit;

  // 出す前チェック（個人情報だけ止める。ほかは知らせるだけ）
  const check = prepublishChecks({ text: item.text });
  // **同じ束の中どうしと、これまで出したものの両方**と比べる。
  // 量産はここが崩れやすい（同じ型から作ると入口がそっくりになる）。
  const past = [
    ...siblings.filter((s) => s.n !== item.n).map((s) => ({ id: `s${s.n}`, title: `同じ束の${s.n}本目`, text: s.text })),
    ...posts.slice(0, 20).map((p) => ({ id: p.id, title: p.title || '前に出したもの', text: p.text || '' })),
  ];
  const same = similarOpenings(item.text, past);

  const record = async () => {
    await store.addSharePost({
      ventureId: vid,
      channel,
      title: item.text.slice(0, 40),
      text: item.text,
      patternId: patternId || null,
      taskId: task.id,
    });
    setDone(true);
    toast('発信ログに入れました。反応の数は、あとから事業の画面で入れられます');
  };

  return (
    <div className="post-row">
      <div className="ti-label" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{item.text}</div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
        {item.text.length}字{tooLong ? `・${limit}字を超えています` : ''}
        {check.blocked ? '・⛔ 個人情報' : check.worst === 'warn' ? `・⚠ ${prepublishLine(check)}` : ''}
        {same.length ? `・≡ 書き出しが「${same[0].title}」とそっくり` : ''}
      </div>
      <div className="btn-row">
        <button
          type="button"
          className="btn small primary"
          onClick={() => {
            navigator.clipboard?.writeText(item.text);
            toast('コピーしました。貼り付けて投稿してください');
          }}
        >
          コピー
        </button>
        {patterns.length > 0 && (
          <select className="select" style={{ maxWidth: 140 }} value={patternId} onChange={(e) => setPatternId(e.target.value)}>
            <option value="">型を選ばない</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>{p.label || p.text.slice(0, 10)}</option>
            ))}
          </select>
        )}
        <Action className="btn small" onClick={record} disabled={done}>
          {done ? '記録済み' : '出した'}
        </Action>
      </div>
    </div>
  );
}
