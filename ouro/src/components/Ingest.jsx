// 情報を会社に取り込む（Web / YouTube / PDF / メモ / 音声メモ）。
// クロスオリジンの本文取得はブラウザから出来ないので、
// 「URL＋本文の貼り付け」を基本にし、AIエンジン接続時は社員に読ませる。

import { useEffect, useRef, useState } from 'react';
import { Card, Field, Empty } from './ui.jsx';
import {
  canUseVoiceInput,
  createRecognizer,
  appendTranscript,
  previewTranscript,
  describeVoiceError,
  VOICE_PRIVACY_NOTE,
} from '../lib/voice.js';
import { INGEST_KINDS, ingestOne, detectKind, youtubeId, MAX_TEXT_BYTES, MAX_TEXT_CHARS } from '../lib/ingest.js';
import { CATEGORIES } from '../lib/knowledge.js';

/**
 * 話したことを、そのまま材料にする（既定オフのオプトイン）。
 *
 * **端末内保存方針の明示的な例外**なので、ボタンの下に必ず理由を書く。
 * 設定を入れていない人には何も出さない（勝手にマイクの話をしない）。
 */
function VoiceButton({ settings, text, setText, toast }) {
  const [on, setOn] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const textRef = useRef(text);
  textRef.current = text;

  // 画面を離れたら必ず止める（マイクが開いたままにならないように）
  useEffect(() => () => {
    if (recRef.current) recRef.current.abort();
  }, []);

  if (typeof window === 'undefined' || !canUseVoiceInput(window, settings)) return null;

  const stop = () => {
    if (recRef.current) recRef.current.stop();
    recRef.current = null;
    setOn(false);
    setInterim('');
  };

  const start = () => {
    const rec = createRecognizer(window, {
      onFinal: (chunk) => {
        // **ref から足すこと。** state を閉じ込めると、
        // 2文目以降が1文目を上書きする。
        const next = appendTranscript(textRef.current, chunk);
        textRef.current = next;
        setText(next);
      },
      onInterim: setInterim,
      onError: (code) => {
        toast(describeVoiceError(code));
        stop();
      },
      onEnd: () => {
        recRef.current = null;
        setOn(false);
        setInterim('');
      },
    });
    if (!rec) {
      toast('このブラウザは音声入力に対応していません');
      return;
    }
    recRef.current = rec;
    rec.start();
    setOn(true);
  };

  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" className={`btn small ${on ? 'primary' : ''}`} onClick={on ? stop : start}>
        {on ? '■ 話し終わった' : '◍ 話して入力する'}
      </button>
      {interim && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{previewTranscript('', interim)}</span>}
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{VOICE_PRIVACY_NOTE}</div>
    </div>
  );
}

export default function Ingest({ store, go, toast, preset = {} }) {
  // 呼び出し元が本文の下書きを渡せる（掲示板から知識へ移すときなど）
  const [kind, setKind] = useState(preset.kind || (preset.text ? 'note' : 'web'));
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState(preset.text || '');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('調査');
  const [summarize, setSummarize] = useState(true);

  const meta = INGEST_KINDS.find((k) => k.id === kind);
  const vid = kind === 'youtube' ? youtubeId(url) : null;

  const onUrl = (v) => {
    setUrl(v);
    const d = detectKind(v);
    if (d !== 'note') setKind(d);
  };

  const onFile = async (file) => {
    if (!file) return;
    // 大きすぎるファイルは読まない（読むと端末が固まる）。
    // 以前の上限は PDF の枝の中にあったので、テキストには効いていなかった。
    if (file.size > MAX_TEXT_BYTES) {
      toast(`ファイルが大きすぎます（${Math.round(MAX_TEXT_BYTES / 1024 / 1024)}MBまで）`);
      return;
    }
    if (file.type === 'application/pdf') {
      // PDF の中身はブラウザだけでは取り出せない。
      // **読み込むふりをしないこと。** 以前はここで base64 を作って捨てていたため、
      // 大きなファイルで数秒固まるだけで、中身は1文字も入っていなかった。
      setTitle(file.name);
      setKind('pdf');
      toast('PDFの自動読み取りは未対応です。本文をコピーして貼り付けてください。');
      return;
    }
    const content = await file.text();
    setText(content.slice(0, MAX_TEXT_CHARS));
    setTitle(file.name);
  };

  const save = () => {
    if (!text.trim() && !url.trim()) {
      toast('URL か 本文のどちらかを入れてください');
      return;
    }
    const { source, knowledge } = ingestOne({
      kind,
      url,
      title: title || url,
      text,
      tags: tags.split(/[,、\s]+/).filter(Boolean),
      category,
    });
    store.addKnowledge({ knowledge, source });

    if (summarize && text.trim().length > 200) {
      // 取り込んだ本文を社員に要約・整理させ、その成果も知識にする（循環の起点）
      const task = store.newTask({
        request: `次の資料を要約し、要点・使いどころ・注意点を整理してください。\n出典：${url || title}\n\n${text.slice(0, 6000)}`,
        workflowId: null,
      });
      store.runTask(task.id);
      go('task', task.id);
      return;
    }

    toast('知識ベースに追加しました');
    go('knowledgeDetail', knowledge.id);
  };

  return (
    <div className="screen fade-in">
      <Card glyph="⇩" title="情報を追加する">
        <div className="chips" style={{ marginBottom: 12 }}>
          {INGEST_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`chip ${kind === k.id ? 'on' : ''}`}
              onClick={() => setKind(k.id)}
            >
              {k.glyph} {k.name}
            </button>
          ))}
        </div>

        {meta?.needsUrl && (
          <Field label="URL">
            <input
              className="input"
              value={url}
              onChange={(e) => onUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          </Field>
        )}

        {vid && (
          <div style={{ marginBottom: 12 }}>
            <img
              src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`}
              alt=""
              style={{ width: '100%', borderRadius: 10, filter: 'grayscale(1) contrast(1.1)', opacity: 0.9 }}
            />
          </div>
        )}

        {kind === 'ai' && (
          <p className="muted" style={{ marginTop: -4 }}>
            別のAIの会話（docs/PROMPT.md の貼り付け用プロンプトなど）で書かせた文章を、
            <strong style={{ color: '#fff' }}>来歴「AI生成」</strong>として取り込みます。
            メモとして貼ると「自分で書いた」になってしまうので、こちらを使ってください。
            出典が付いていないので、確からしさは低めから始まります。
          </p>
        )}

        <Field label="タイトル">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="この情報の名前" />
        </Field>

        <Field
          label="本文・文字起こし"
          hint={
            kind === 'youtube'
              ? '動画の説明欄や文字起こしを貼ってください。自動取得はブラウザからできません。'
              : kind === 'pdf'
                ? 'PDFの本文を貼るか、ファイルを選んでください。'
                : meta?.hint
          }
        >
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ minHeight: 140 }}
            placeholder="ここに貼り付け"
          />
          <VoiceButton settings={store.settings} text={text} setText={setText} toast={toast} />
        </Field>

        {(kind === 'pdf' || kind === 'note') && (
          <Field label="ファイルから読み込む（テキスト / PDF）">
            <input
              type="file"
              accept=".txt,.md,.csv,.json,application/pdf"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="input"
            />
          </Field>
        )}

        <Field label="カテゴリ">
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="タグ（カンマ区切り）">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="腰痛, ストレッチ" />
        </Field>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 14 }}>
          <input type="checkbox" checked={summarize} onChange={(e) => setSummarize(e.target.checked)} />
          取り込んだあと、AI社員に要約・整理させる
        </label>

        <button type="button" className="btn primary block" onClick={save}>
          会社の知識にする
        </button>
      </Card>

      <Card glyph="⌕" title="Webから社員に調べさせる">
        <p className="muted" style={{ marginTop: -6 }}>
          手元に本文が無いときは、リサーチャーに探させる方が早いことがあります
          （Claude を接続していると実際にWeb検索します）。
        </p>
        <button
          type="button"
          className="btn block"
          onClick={() => go('compose', { request: url ? `${url} の内容を調べて要約してください` : '' })}
        >
          リサーチャーに依頼する
        </button>
      </Card>

      {store.knowledge.length === 0 && (
        <Empty>
          最初の1件を入れると、会社の知識が動き始めます。
          <br />
          気になった動画・記事・自分のメモ、何でも構いません。
        </Empty>
      )}
    </div>
  );
}
