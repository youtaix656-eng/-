// 型パック——**売っているのはファイルではなく「毎回同じ結果が出る型」。**
//
// ここでやること：
//  ① 終わった仕事から型をつくる（動いた実績のある形だけを型にする）
//  ② その型で依頼する（回した回数が増える）
//  ③ 出た成果物を「結果の見本」として同梱する
//  ④ 3回そろったら書き出す（足りなければ「未検証」と必ず書く）
//  ⑤ SKILL.md の形（先頭に name / description）で出す——買う人がそのまま置いて使える形
//  ⑥ 複数の型を1つの「パック」にまとめて売る
//
// **AIを呼ばない。**（「この型で依頼する」は依頼画面へ渡すので、
// 費用の確認も日・月の上限もそのまま効く）

import { useMemo, useState } from 'react';
import { Card, SectionTitle, Field, Empty, Stat, Row } from './ui.jsx';
import {
  SELL_MODES, MIN_RUNS, MAX_KITS, MAX_PACKS, normalizeKits, normalizePacks, runsOf,
  kitReady, kitLine, kitsLine, kitEffort, exportKit, exportSkillMd, skillName,
  kitsInPack, packReady, packLine, exportPack,
} from '../lib/kit.js';
import { prepublishChecks, prepublishLine } from '../lib/prepublish.js';
import { rivalsOf } from '../lib/rivals.js';
import { ROLES } from '../data/roles.js';
import { useAllTasks } from './useAllTasks.js';

const roleName = (id) => (ROLES.find((r) => r.id === id) || {}).name || id;

export default function Kits({ store, go, toast }) {
  // 型で回した仕事は古いものにも残るので、全部の仕事を見る
  useAllTasks(store);
  const [openId, setOpenId] = useState(null);

  const kits = useMemo(() => normalizeKits(store.kits || []), [store.kits]);
  // 型にできる仕事＝終わっていて、まだ型になっていないもの
  const done = useMemo(
    () => (store.tasks || []).filter((t) => t.status === 'done' && !t.flagged).slice(0, 20),
    [store.tasks]
  );

  return (
    <div className="view">
      <SectionTitle>型パック</SectionTitle>
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>
          {store.hydrated ? kitsLine(kits, store.tasks) : '読み込み中です…'}
        </p>
        <p className="muted" style={{ fontSize: 11.5 }}>
          売るのは手順書というファイルではなく、
          <strong style={{ color: '#fff' }}>その型に流すと毎回出てくる結果</strong>です。
          だから<strong style={{ color: '#fff' }}>結果の見本が付いていない型は、まだ売り物になりません</strong>。
          そして<strong style={{ color: '#fff' }}>自分で{MIN_RUNS}回やったものだけ</strong>を出してください。
        </p>
      </Card>

      {kits.length === 0 && (
        <Empty>まだ型がありません。下の「終わった仕事から型にする」から作れます。</Empty>
      )}

      {kits.map((kit) => (
        <KitCard
          key={kit.id}
          kit={kit}
          store={store}
          go={go}
          toast={toast}
          open={openId === kit.id}
          onToggle={() => setOpenId(openId === kit.id ? null : kit.id)}
        />
      ))}

      <PackSection kits={kits} store={store} toast={toast} />

      {kits.length < MAX_KITS && (
        <>
          <SectionTitle>終わった仕事から型にする</SectionTitle>
          <Card className="tight">
            <p className="muted" style={{ marginTop: 0 }}>
              一度もうまく回っていない流れを型にしても売り物になりません。
              <strong style={{ color: '#fff' }}>実際に終わった仕事</strong>から作ります。
            </p>
            {done.length === 0 && <Empty>終わった仕事がまだありません。</Empty>}
            {done.map((t) => (
              <Row
                key={t.id}
                glyph="✦"
                title={t.title || '無題の仕事'}
                sub="この流れを型にする"
                onClick={async () => {
                  const made = await store.kitFromTask(t.id);
                  if (made) {
                    toast(`「${made.title}」を型にしました`);
                    setOpenId(made.id);
                  }
                }}
              />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function KitCard({ kit, store, go, toast, open, onToggle }) {
  const [note, setNote] = useState('');
  const tasks = store.tasks || [];
  const runs = runsOf(kit, tasks);
  const rivalCount = rivalsOf(store.rivals, kit.ventureId).length;
  const ready = kitReady(kit, { tasks, rivalCount });
  const effort = kitEffort(kit, tasks, store.settings.usdJpy);
  const mode = SELL_MODES[kit.sellMode];

  // 出す前チェック（**型を渡した時だけ**、型ぶんの確認が増える）
  const md = exportKit(kit, { tasks, roleName, usdJpy: store.settings.usdJpy });
  const pre = prepublishChecks({ text: md, kit, kitTasks: tasks, rivalCount });

  // 見本にできる成果物＝この型で回して終わった仕事
  const sampleable = runs.filter((t) => !(kit.samples || []).some((s) => s.taskId === t.id));

  const skill = exportSkillMd(kit, { tasks, roleName });
  const [asSkill, setAsSkill] = useState(true);
  const shown = asSkill ? skill.text : md;

  const copyOut = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      toast('書き出しをコピーしました');
    } catch {
      toast('コピーできませんでした。下の本文を選んでコピーしてください');
    }
  };

  return (
    <Card
      glyph="❏"
      title={kit.title}
      action={<span className="chip">{ready.ready ? '出せる' : `あと${ready.reasons.length}`}</span>}
    >
      <p className="muted" style={{ marginTop: -6 }}>{kitLine(kit, tasks)}</p>
      <div className="stats" id="kit-runs">
        <Stat value={`${runs.length}／${MIN_RUNS}`} label="回した回数" />
        <Stat value={(kit.samples || []).length} label="結果の見本" />
        <Stat value={effort.minutesPerRun === null ? '—' : `${effort.minutesPerRun}分`} label="1回の目安" />
        <Stat value={effort.yenPerRun === null ? '—' : `¥${effort.yenPerRun.toLocaleString('ja-JP')}`} label="1回のAI費用" />
      </div>

      {ready.reasons.map((r) => (
        <p key={r} className="muted" style={{ fontSize: 12.5 }}>・{r}</p>
      ))}
      {ready.notes.map((n) => (
        <p key={n} className="muted" style={{ fontSize: 11.5 }}>▸ {n}</p>
      ))}

      <button
        type="button"
        className="btn primary block"
        onClick={() =>
          // `go(view, arg)` の arg が **そのまま** preset になる。
          // `{ preset: {...} }` と包むと1段深くなり、依頼文も kitId も渡らない。
          go('compose', {
            request: kit.request,
            kitId: kit.id,
            genreId: kit.genreId || undefined,
            ventureId: kit.ventureId || undefined,
          })
        }
      >
        この型で依頼する（回数が増えます）
      </button>
      <button type="button" className="btn ghost block" onClick={onToggle}>
        {open ? '閉じる' : '中身を見る・書き出す'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <Field label="何が出てくるか（買う人がいちばん知りたいところ）">
            <input
              value={kit.outcome}
              placeholder="例：SNS投稿の下書きが週5本"
              onChange={(e) => store.updateKit(kit.id, { outcome: e.target.value })}
            />
          </Field>
          <Field label="依頼文の型">
            <textarea rows={4} value={kit.request} onChange={(e) => store.updateKit(kit.id, { request: e.target.value })} />
          </Field>
          <Field label="完成条件（1行ずつ）">
            <textarea rows={3} value={kit.doneWhen} onChange={(e) => store.updateKit(kit.id, { doneWhen: e.target.value })} />
          </Field>
          <Field label="使うときの注意">
            <textarea rows={2} value={kit.notes} onChange={(e) => store.updateKit(kit.id, { notes: e.target.value })} />
          </Field>
          <Field label="売り方" hint={mode ? mode.note : ''}>
            <select value={kit.sellMode} onChange={(e) => store.updateKit(kit.id, { sellMode: e.target.value })}>
              {Object.entries(SELL_MODES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </Field>

          <SectionTitle>手順</SectionTitle>
          {kit.steps.length === 0 && <Empty>担当の並びが決まっていません。</Empty>}
          {kit.steps.map((roleId, i) => (
            <p key={`${roleId}:${i}`} className="muted" style={{ fontSize: 12.5, margin: '2px 0' }}>
              {i + 1}. {roleName(roleId)}
            </p>
          ))}

          <SectionTitle>結果の見本</SectionTitle>
          {(kit.samples || []).length === 0 && (
            <Empty>まだありません。この型で回した仕事の成果物を足してください。</Empty>
          )}
          {(kit.samples || []).map((s) => (
            <div key={s.id} className="card tight" style={{ marginTop: 8 }}>
              <strong>{s.title}</strong>
              <p className="muted" style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', margin: '4px 0' }}>
                {s.excerpt.slice(0, 200)}{s.excerpt.length > 200 ? '…' : ''}
              </p>
              <button type="button" className="btn ghost" onClick={() => store.removeKitSample(kit.id, s.id)}>外す</button>
            </div>
          ))}
          {sampleable.map((t) => (
            <Row
              key={t.id}
              glyph="＋"
              title={t.title || '無題の仕事'}
              sub="この成果物を見本にする"
              onClick={async () => {
                const s = await store.addKitSample(kit.id, t.id);
                toast(s ? '見本に足しました' : '成果物が空でした');
              }}
            />
          ))}

          <SectionTitle>出す前チェック</SectionTitle>
          <p className="muted" style={{ marginTop: -6 }}>{prepublishLine(pre)}</p>
          {pre.items.filter((i) => i.level !== 'skip').map((i) => (
            <p key={i.id} className="muted" style={{ fontSize: 12.5, margin: '2px 0' }}>
              {i.level === 'ok' ? '✓' : i.level === 'stop' ? '✕' : '△'} {i.title}：{i.level === 'ok' ? i.ok : i.ng}
            </p>
          ))}

          <Field label="英数字の名前（SKILL.md の name）" hint="小文字の英数字とハイフン。日本語からは作れないので、ご自分で決めてください。">
            <input
              value={kit.slug}
              placeholder="例：sns-posts"
              onChange={(e) => store.updateKit(kit.id, { slug: e.target.value })}
            />
          </Field>
          <Field label="どんな時に使うか（SKILL.md の description）" hint="ここが空だと、AIがこの型をいつ使えばよいか判断できません。">
            <textarea
              rows={2}
              value={kit.whenToUse}
              placeholder="例：SNSの投稿をまとめて作りたいとき"
              onChange={(e) => store.updateKit(kit.id, { whenToUse: e.target.value })}
            />
          </Field>

          <SectionTitle><span id="kit-export">書き出し（このまま売り物になります）</span></SectionTitle>
          <div className="btn-row">
            <button type="button" className={`btn${asSkill ? ' primary' : ''}`} onClick={() => setAsSkill(true)}>
              SKILL.md の形
            </button>
            <button type="button" className={`btn${asSkill ? '' : ' primary'}`} onClick={() => setAsSkill(false)}>
              読みもの用
            </button>
          </div>
          {asSkill && (
            <p className="muted" style={{ fontSize: 11.5 }}>
              ファイル名は <strong style={{ color: '#fff' }}>{skillName(kit)}/SKILL.md</strong>。
              買った人がそのまま置いて使える形です。
            </p>
          )}
          {asSkill && skill.warnings.map((w) => (
            <p key={w} className="muted" style={{ fontSize: 11.5 }}>△ {w}</p>
          ))}
          <p className="muted" style={{ fontSize: 11.5, marginTop: -6 }}>
            APIキー・お客さんの名前・社内の掲示板は<strong style={{ color: '#fff' }}>入りません</strong>
            （型が持っているものだけを出します）。
            {runs.length < MIN_RUNS && '（'}{runs.length < MIN_RUNS && <strong style={{ color: '#fff' }}>まだ{MIN_RUNS}回に足りないので「未検証」と書かれます</strong>}{runs.length < MIN_RUNS && '）'}
          </p>
          <button type="button" className="btn block" onClick={copyOut}>書き出しをコピーする</button>
          <pre className="doc" style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, maxHeight: 260, overflow: 'auto' }}>{shown}</pre>

          <SectionTitle>版</SectionTitle>
          <p className="muted" style={{ marginTop: -6, fontSize: 12.5 }}>いまは第{kit.version}版です。</p>
          <Field label="どこを直したか（1行）">
            <input value={note} placeholder="例：完成条件に出典を足した" onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button
            type="button"
            className="btn ghost block"
            onClick={() => { store.bumpKitVersion(kit.id, note); setNote(''); toast('版を上げました'); }}
          >
            第{kit.version + 1}版にする
          </button>
          {kit.changelog.map((c) => (
            <p key={`${c.version}:${c.at}`} className="muted" style={{ fontSize: 11.5, margin: '2px 0' }}>
              第{c.version}版：{c.note}
            </p>
          ))}

          <button type="button" className="btn ghost block" style={{ marginTop: 10 }} onClick={() => store.removeKit(kit.id)}>
            この型を消す
          </button>
        </div>
      )}
    </Card>
  );
}

/**
 * パック——**複数の型を1つの商品にまとめる。**
 * 1本ずつではなく束で売る形。パックは型の一覧を持つが、これは商品の目次であって
 * 同期する列ではない（型の側にパックの id を持たせない）。
 */
function PackSection({ kits, store, toast }) {
  const [title, setTitle] = useState('');
  const [openId, setOpenId] = useState(null);
  const packs = useMemo(() => normalizePacks(store.packs || []), [store.packs]);

  if (kits.length === 0) return null;

  return (
    <>
      <SectionTitle>パック（束にして売る）</SectionTitle>
      {packs.length === 0 && (
        <Card className="tight">
          <p className="muted" style={{ marginTop: 0 }}>
            型が2つ以上たまったら、束にすると売りやすくなります。
            <strong style={{ color: '#fff' }}>1つでも未検証の型が入っていたら、目次の先頭にそう書きます</strong>
            （束にすると個々の印が埋もれるため）。
          </p>
        </Card>
      )}
      {packs.map((pack) => (
        <PackCard
          key={pack.id}
          pack={pack}
          kits={kits}
          store={store}
          toast={toast}
          open={openId === pack.id}
          onToggle={() => setOpenId(openId === pack.id ? null : pack.id)}
        />
      ))}
      {packs.length < MAX_PACKS && (
        <Card className="tight">
          <Field label="パックの名前">
            <input value={title} placeholder="例：AI副業スターターパック" onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <button
            type="button"
            className="btn block"
            disabled={!title.trim()}
            onClick={async () => {
              const made = await store.addPack({ title });
              if (made) { setTitle(''); setOpenId(made.id); toast('パックをつくりました'); }
            }}
          >
            このパックをつくる
          </button>
        </Card>
      )}
    </>
  );
}

function PackCard({ pack, kits, store, toast, open, onToggle }) {
  const tasks = store.tasks || [];
  const inPack = kitsInPack(pack, kits);
  const rivalCount = rivalsOf(store.rivals, pack.ventureId).length;
  const ready = packReady(pack, { kits, tasks, rivalCount });
  const out = exportPack(pack, { kits, tasks, roleName });
  const text = out.files.map((f) => `===== ${f.path} =====\n${f.text}`).join('\n\n');

  return (
    <Card
      glyph="▤"
      title={pack.title}
      action={<span className="chip">{ready.ready ? '出せる' : `あと${ready.reasons.length}`}</span>}
    >
      <p className="muted" style={{ marginTop: -6 }}>{packLine(pack, kits, tasks)}</p>
      {ready.reasons.map((r) => (
        <p key={r} className="muted" style={{ fontSize: 12.5 }}>・{r}</p>
      ))}
      {ready.notes.map((n) => (
        <p key={n} className="muted" style={{ fontSize: 11.5 }}>▸ {n}</p>
      ))}
      <button type="button" className="btn ghost block" onClick={onToggle}>
        {open ? '閉じる' : `中身を選ぶ・書き出す（${inPack.length}個）`}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <Field label="このパックで何ができるようになるか">
            <textarea
              rows={2}
              value={pack.outcome}
              placeholder="例：AIに任せて、週5本の投稿を出せるようになる"
              onChange={(e) => store.updatePack(pack.id, { outcome: e.target.value })}
            />
          </Field>
          <Field label="売り方">
            <select value={pack.sellMode} onChange={(e) => store.updatePack(pack.id, { sellMode: e.target.value })}>
              {Object.entries(SELL_MODES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </Field>

          <SectionTitle>入れる型</SectionTitle>
          {kits.map((k) => {
            const on = pack.kitIds.includes(k.id);
            const runs = runsOf(k, tasks).length;
            return (
              <Row
                key={k.id}
                glyph={on ? '☑' : '☐'}
                title={k.title}
                sub={`${runs}／${MIN_RUNS}回${k.samples.length ? '' : '・見本なし'}${runs < MIN_RUNS ? '・未検証' : ''}`}
                onClick={() => store.togglePackKit(pack.id, k.id)}
              />
            );
          })}

          <SectionTitle>書き出し（{out.files.length}ファイル）</SectionTitle>
          <p className="muted" style={{ fontSize: 11.5, marginTop: -6 }}>
            目次（README.md）と、型ごとの SKILL.md をまとめて出します。
          </p>
          {out.warnings.slice(0, 6).map((w) => (
            <p key={w} className="muted" style={{ fontSize: 11.5 }}>△ {w}</p>
          ))}
          <button
            type="button"
            className="btn block"
            onClick={async () => {
              try { await navigator.clipboard.writeText(text); toast('パックをコピーしました'); }
              catch { toast('コピーできませんでした。下の本文を選んでコピーしてください'); }
            }}
          >
            パックをまとめてコピーする
          </button>
          <pre className="doc" style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, maxHeight: 300, overflow: 'auto' }}>{text}</pre>

          <button type="button" className="btn ghost block" style={{ marginTop: 10 }} onClick={() => store.removePack(pack.id)}>
            このパックを消す
          </button>
        </div>
      )}
    </Card>
  );
}
