// 設定。AIエンジンのキー（BYOK）・AI Router・プラン・データの持ち出し。

import { useState } from 'react';
import { Card, Field, SectionTitle } from './ui.jsx';
import { PROVIDERS } from '../lib/providers/index.js';
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from '../lib/providers/compat.js';
import { VOICE_PRIVACY_NOTE, isVoiceInputAvailable } from '../lib/voice.js';
import { canNotify, notifyState, askNotifyPermission, canKeepAwake } from '../lib/notify.js';
import { PLANS } from '../data/plans.js';

export default function Settings({ store, toast }) {
  const [keys, setKeys] = useState(() => ({ ...store.secrets }));
  const [show, setShow] = useState({});

  const saveKey = (id) => {
    store.setSecret(id, (keys[id] || '').trim());
    toast(keys[id] ? `${id} のキーを保存しました` : 'キーを削除しました');
  };

  const doExport = async () => {
    const data = await store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ouro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('書き出しました（APIキーは含まれません）');
  };

  const doImport = async (file) => {
    if (!file) return;
    // **いちばん壊れる操作なのに、ここだけ確認が無かった。**
    // 案件1件・知識1件・仕事1件の削除には確認があるのに、
    // 全部を置き換える取り込みだけ素通りしていた。
    const okToGo = window.confirm(
      'いまの端末のデータ（社員・知識・案件・履歴）を、このファイルの内容で置き換えます。\n' +
        '元に戻せません。よろしいですか？'
    );
    if (!okToGo) return;
    try {
      const payload = JSON.parse(await file.text());
      // 置き換える前に、いまの状態を自動で書き出しておく（取り違えた時の保険）
      await autoBackupBeforeImport();
      await store.importData(payload);
    } catch (e) {
      toast(`取り込めませんでした：${e.message}`);
    }
  };

  /** 取り込みの直前に、いまのデータを1つ書き出しておく。 */
  const autoBackupBeforeImport = async () => {
    try {
      // recordDate:false ＝ 書き出した日を記録しない。
      // 記録すると「取り込む前の設定」の保存が待ち行列に残り、
      // 取り込んだ内容をあとから上書きしてしまう。
      const data = await store.exportData(false);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ouro-before-import-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // 書き出せなくても取り込みは止めない（止めると復旧手段が無くなる）
    }
  };

  return (
    <div className="screen fade-in">
      <Card glyph="✳" title="AIエンジン（キーはあなたのもの）">
        <p className="muted" style={{ marginTop: -6 }}>
          Ouro はサーバーを持ちません。あなたのAPIキーを端末内に保存し、
          ブラウザから直接エンジンを呼びます。キーは書き出し（バックアップ）にも含まれません。
          <br />
          <strong style={{ color: '#fff' }}>1つ登録すれば、社員全員が使えるようになります。</strong>
        </p>

        {/* **どれが0円で始められるかを先に言う。** 3つ並べるだけだと、
            お金が無い時にどれを選べばよいか分からない。 */}
        {PROVIDERS.filter((p) => p.freeTier && p.needsKey).map((p) => (
          <p key={`free:${p.id}`} className="muted" style={{ marginTop: -2 }}>
            💡 <strong style={{ color: '#fff' }}>{p.name} は無料で始められます。</strong>
            {p.freeNote}
          </p>
        ))}

        {PROVIDERS.filter((p) => p.needsKey).sort((a, b) => (b.freeTier ? 1 : 0) - (a.freeTier ? 1 : 0)).map((p) => (
          <div key={p.id} style={{ marginBottom: 16 }}>
            <Field
              label={`${p.name}${p.freeTier ? '（無料で始められます）' : ''}${store.secrets[p.id] ? '・接続済み' : ''}`}
              hint={p.desc}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  type={show[p.id] ? 'text' : 'password'}
                  value={keys[p.id] || ''}
                  onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                  placeholder={store.secrets[p.id] ? '登録済み（変更するときだけ入力）' : 'APIキーを貼り付け'}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setShow({ ...show, [p.id]: !show[p.id] })}
                >
                  {show[p.id] ? '隠す' : '表示'}
                </button>
              </div>
            </Field>
            <div className="btn-row" style={{ marginTop: -8 }}>
              <button type="button" className="btn small" onClick={() => saveKey(p.id)}>
                保存
              </button>
              {store.secrets[p.id] && (
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => {
                    setKeys({ ...keys, [p.id]: '' });
                    store.setSecret(p.id, '');
                    toast('削除しました');
                  }}
                >
                  削除
                </button>
              )}
              {p.keyHelpUrl && (
                <a
                  href={p.keyHelpUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn small ghost"
                  style={{ textDecoration: 'none' }}
                >
                  キーを取りに行く ↗
                </a>
              )}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              モデル：{p.models.map((m) => m.label).join('／')}
            </div>
          </div>
        ))}
      </Card>

      <Card glyph="◱" title="ローカルAI（自分のパソコンの中で動かす）">
        <p className="muted" style={{ marginTop: -6 }}>
          Ollama や LM Studio など、<strong style={{ color: '#fff' }}>自分のPCの中で動くAI</strong>に繋げます。
          費用は0です。要約・分類・整理のような軽い仕事をここへ逃がすと、月の上限に当たりにくくなります。
        </p>
        <p className="muted" style={{ fontSize: 11.5 }}>
          ⚠ <strong style={{ color: '#fff' }}>iPhone・iPad では使えません</strong>
          （端末にモデルが無く、Safari はこのページから自分のPCへの通信を止めます）。
          パソコンの Chrome / Firefox で開いた時だけ使えます。
          サーバー側で「このページからの通信を許す」設定も要ります（Ollama なら OLLAMA_ORIGINS）。
        </p>
        <Field label="宛先のURL" hint={`空にすると使いません。Ollama の既定は ${DEFAULT_BASE_URL}`}>
          <input
            className="input"
            value={store.settings.compatBaseUrl || ''}
            onChange={(e) => store.updateSettings({ compatBaseUrl: e.target.value.trim() })}
            placeholder={DEFAULT_BASE_URL}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label="モデル名" hint={`サーバーに入れてあるモデルの名前。空なら ${DEFAULT_MODEL}`}>
          <input
            className="input"
            value={store.settings.compatModel || ''}
            onChange={(e) => store.updateSettings({ compatModel: e.target.value.trim() })}
            placeholder={DEFAULT_MODEL}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </Card>

      <Card glyph="⟳" title="AI Router">
        <Field
          label="モデルの選び方（既定）"
          hint="依頼ごとに上書きできます。安い＝いちばん安いモデルに固定。1行の要約にまで上位モデルが回るのを止められます。"
        >
          <select
            className="select"
            value={store.settings.costMode || 'auto'}
            onChange={(e) => store.updateSettings({ costMode: e.target.value })}
          >
            <option value="cheap">安いモデルで（節約）</option>
            <option value="auto">おまかせ（仕事の重さで選ぶ）</option>
            <option value="best">良いモデルで（高い）</option>
          </select>
        </Field>
        <Field
          label="1日のAI費用の上限（ドル）"
          hint="0 で上限なし。月の上限だけだと、1日で使い切っても気づくのが翌日以降になります。"
        >
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={store.settings.dailyCapUsd ?? 0}
            onChange={(e) => store.updateSettings({ dailyCapUsd: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
        <Field label="どのモデルを使うか" hint="自動＝仕事の重さと必要な道具から選びます。手動＝各社員の希望どおりに。">
          <select
            className="select"
            value={store.settings.routerMode}
            onChange={(e) => store.updateSettings({ routerMode: e.target.value })}
          >
            <option value="auto">自動</option>
            <option value="manual">手動（社員の希望を優先）</option>
          </select>
        </Field>
        <Field label="1回の返答の上限（トークン）" hint="長い成果物が途中で切れるときは増やしてください。">
          <select
            className="select"
            value={store.settings.maxTokens}
            onChange={(e) => store.updateSettings({ maxTokens: Number(e.target.value) })}
          >
            <option value={2000}>2,000（短い・安い）</option>
            <option value={4000}>4,000</option>
            <option value={8000}>8,000（標準）</option>
            <option value={16000}>16,000（長い・高い）</option>
          </select>
        </Field>
        <Field
          label="共有しないと完了にしない"
          hint="仕事から「他の社員が知っておくとよいこと」を1行、掲示板へ残すまで、台帳では『確認待ち』のままにします。書く場所を作っただけでは誰も書かないため、既定は入りです。"
        >
          <select
            className="select"
            value={store.settings.requireShare === false ? 'off' : 'on'}
            onChange={(e) => store.updateSettings({ requireShare: e.target.value === 'on' })}
          >
            <option value="on">共有を書くまで完了にしない（標準）</option>
            <option value="off">共有が無くても完了にする</option>
          </select>
        </Field>
        <Field
          label="社員から社員への引き継ぎ"
          hint="要点だけ＝次の担当に要るものだけを渡します。前の担当の出力が長いほど費用が下がります。拾えなかった時は全文をそのまま渡すので、材料が消えることはありません。"
        >
          <select
            className="select"
            value={store.settings.handoffMode || 'compact'}
            onChange={(e) => store.updateSettings({ handoffMode: e.target.value })}
          >
            <option value="compact">要点だけ渡す（標準）</option>
            <option value="full">前の担当の出力を全部渡す</option>
          </select>
        </Field>
      </Card>

      <Card glyph="⚙" title="会社">
        <Field label="会社名">
          <input
            className="input"
            value={store.company?.name || ''}
            onChange={(e) => store.updateCompany({ name: e.target.value })}
          />
        </Field>
        <Field label="プラン（道具の接続数の上限）">
          <select
            className="select"
            value={store.company?.planId || 'free'}
            onChange={(e) => store.updateCompany({ planId: e.target.value })}
          >
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（道具{p.maxConnections}まで）
              </option>
            ))}
          </select>
        </Field>
        <Field label="円換算に使うレート（1ドル＝）" hint="AI費用を円で見るための目安です。">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={store.settings.usdJpy}
            onChange={(e) => store.updateSettings({ usdJpy: Number(e.target.value) || 155 })}
          />
        </Field>
      </Card>

      <Card glyph="◷" title="裏で動かす・終わったら知らせる">
        <p className="muted" style={{ marginTop: -6 }}>
          <strong style={{ color: '#fff' }}>アプリを完全に閉じると、仕事は本当に止まります。</strong>
          ブラウザの仕組み上どうにもならないので、その代わりに次の3つで埋めています。
        </p>
        <Field
          label="開いた時に、止まっている仕事を続きから走らせる"
          hint="閉じている間に止まったものを、次に開いた瞬間に拾います。一度に走らせるのは1件だけ。費用の承認・上限は今までどおり通ります。"
        >
          <select
            className="select"
            value={store.settings.autoResume === false ? 'off' : 'on'}
            onChange={(e) => store.updateSettings({ autoResume: e.target.value === 'on' })}
          >
            <option value="on">続きから走らせる（既定）</option>
            <option value="off">走らせない（自分で押す）</option>
          </select>
        </Field>
        <Field
          label="終わったら端末で知らせる"
          hint={
            canNotify()
              ? '裏に回っている間に終わった時だけ出します。閉じている間は出せません（サーバーを持たないため）。'
              : 'このブラウザは通知に対応していません。'
          }
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              className="select"
              value={store.settings.notifyDone ? 'on' : 'off'}
              onChange={async (e) => {
                const on = e.target.value === 'on';
                if (on && notifyState() !== 'granted') {
                  const r = await askNotifyPermission();
                  if (r !== 'granted') {
                    toast('通知が許可されませんでした');
                    return;
                  }
                }
                store.updateSettings({ notifyDone: on });
              }}
            >
              <option value="off">知らせない（既定）</option>
              <option value="on">知らせる</option>
            </select>
          </div>
        </Field>
        <Field
          label="走っている間、画面を眠らせない"
          hint={
            canKeepAwake()
              ? 'スマホは画面が消えるとタブごと止めることがあります。入れると最後まで走り切りやすくなりますが、電池を食います。'
              : 'この端末では使えません。'
          }
        >
          <select
            className="select"
            value={store.settings.keepAwake ? 'on' : 'off'}
            onChange={(e) => store.updateSettings({ keepAwake: e.target.value === 'on' })}
          >
            <option value="off">眠らせる（既定）</option>
            <option value="on">走っている間は眠らせない</option>
          </select>
        </Field>
      </Card>

      <Card glyph="◍" title="音声で入力する">
        <p className="muted" style={{ marginTop: -6 }}>
          話したことを、そのまま会社の材料にします。手で打ち直す手間があるうちは、人は貯めません。
        </p>
        <p className="muted" style={{ fontSize: 11.5 }}>
          ⚠ <strong style={{ color: '#fff' }}>ここは端末内保存の例外です。</strong>{VOICE_PRIVACY_NOTE}
        </p>
        <Field label="音声入力を使う" hint={isVoiceInputAvailable(typeof window === 'undefined' ? null : window) ? '情報を追加の画面にマイクのボタンが出ます。' : 'このブラウザは音声認識に対応していません。'}>
          <select
            className="select"
            value={store.settings.voiceInput ? 'on' : 'off'}
            onChange={(e) => store.updateSettings({ voiceInput: e.target.value === 'on' })}
          >
            <option value="off">使わない（既定）</option>
            <option value="on">使う</option>
          </select>
        </Field>
      </Card>

      <SectionTitle>データ</SectionTitle>
      <Card glyph="▤" title="持ち出し・取り込み">
        <p className="muted" style={{ marginTop: -6 }}>
          すべてのデータは端末の中だけにあります。機種変更のときは書き出して移してください。
          <br />
          <strong style={{ color: '#fff' }}>APIキーは書き出しに含まれません</strong>（移した先で入れ直してください）。
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={doExport}>
            書き出す
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            取り込む（置き換え）
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => doImport(e.target.files?.[0])}
            />
          </label>
        </div>
      </Card>

      <Card glyph="⊘" title="安全について">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
          ・APIキーはこの端末の IndexedDB にのみ保存され、Ouro のサーバーへは送られません
          （そもそもサーバーがありません）。
          <br />
          ・キーはあなたが呼び出すエンジン（Anthropic / OpenAI / Google）へ直接送られます。
          <br />
          ・共有端末では使わないでください。ブラウザのデータを消すとキーも消えます。
          <br />
          ・AI社員の操作はすべて操作履歴に残ります。
        </p>
      </Card>

      <div className="divider-glyph">✦</div>
      <p className="muted" style={{ textAlign: 'center' }}>
        Ouro — AIを使うのではなく、AIを雇う。
        <br />
        AIが働くほど、あなたの知識が資産になる。
      </p>
    </div>
  );
}
