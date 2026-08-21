import React, { useEffect, useRef, useState } from 'react';
import {
  createRecognizer, canUseVoiceInput, appendTranscript, previewTranscript,
  describeVoiceError, isRetryableVoiceError, VOICE_PRIVACY_NOTE,
} from '../lib/voice.js';

/**
 * 音声メモ入力つきのテキスト欄（企画書 Phase 2）。
 *
 * 施術中は手が離せないので、話した内容をそのままメモへ入れられるようにする。
 * ボタンが出るのは「設定で音声メモをオンにしていて」「その端末が対応している」時だけ
 * （voice.js の canUseVoiceInput が単一の判定）。それ以外はただのテキスト欄として動く。
 * 認識中でもキーボード入力を止めない（うまく変換されなかった所をその場で直せるように）。
 */
export default function VoiceMemo({ label, value, onChange, rows = 4, placeholder = '', settings = {}, hint = '' }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  // 認識の途中で欄を直されても最新の内容へ足せるように、値を ref でも持っておく
  const valueRef = useRef(value);
  valueRef.current = value;

  const available = canUseVoiceInput(typeof window === 'undefined' ? null : window, settings);

  // 画面を離れる時は必ず止める（マイクを掴んだままにしない）
  useEffect(() => () => {
    if (recRef.current) recRef.current.abort();
  }, []);

  const start = () => {
    setError('');
    const rec = createRecognizer(window, {
      onFinal: (text) => {
        onChange(appendTranscript(valueRef.current, text));
      },
      onInterim: setInterim,
      onError: (code) => {
        setError(describeVoiceError(code));
        if (!isRetryableVoiceError(code)) setListening(false);
      },
      onEnd: () => {
        setListening(false);
        recRef.current = null;
      },
    });
    if (!rec) {
      setError('この端末では音声入力が使えません。キーボード入力をお使いください。');
      return;
    }
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stop = () => {
    if (recRef.current) recRef.current.stop();
    setListening(false);
  };

  return (
    <div className="voice-memo">
      <label className="field">
        <span className="field-label">{label}</span>
        <textarea
          className="share-text"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>

      {available && (
        <div className="voice-row">
          <button
            type="button"
            className={`btn slim${listening ? ' danger' : ' secondary'}`}
            aria-pressed={listening}
            onClick={() => (listening ? stop() : start())}
          >
            {listening ? '⏹ 聞き取りを止める' : '🎤 音声で入力'}
          </button>
          {listening && <span className="voice-live" role="status">聞き取り中…話し終えたら「止める」を押してください</span>}
        </div>
      )}

      {listening && interim && (
        <p className="voice-interim" aria-live="polite">{previewTranscript(value, interim)}</p>
      )}
      {error && <p className="notice-inline">{error}</p>}
      {available && listening && <p className="small muted" style={{ margin: 0 }}>{VOICE_PRIVACY_NOTE}</p>}
      {hint && !listening && <p className="small muted" style={{ margin: 0 }}>{hint}</p>}
    </div>
  );
}
