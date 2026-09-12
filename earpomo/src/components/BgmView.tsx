import { useRef, useState } from 'react';
import { Icon } from './Icons.js';
import { actions } from '../lib/useStore.js';
import type { AppState } from '../types/index.js';

function fmtDuration(sec: number | null): string {
  if (sec == null) return '長さ不明';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function BgmView({ state, audioAllowed, onBack }: { state: AppState; audioAllowed: boolean; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = state.settings.bgmId;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac|oga|opus)$/i.test(f.name)) {
        setError(`「${f.name}」は音声ファイルとして読めませんでした`);
        continue;
      }
      const track = await actions.addBgm(f);
      if (!track) setError(`「${f.name}」を端末に保存できませんでした（空き容量・プライベートモードを確認してください）`);
      else if (!selected) actions.selectBgm(track.id);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <section className="view" aria-label="勉強中BGM">
      <div className="sub-head">
        <button className="icon-btn" onClick={onBack} aria-label="戻る"><Icon name="back" /></button>
        <span className="title">勉強中BGM</span>
      </div>

      <button className="dashed" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Icon name="plus" size={16} /> {busy ? '読み込んでいます…' : 'フォルダから曲を追加'}
      </button>
      <input ref={fileRef} type="file" accept="audio/*" multiple className="visually-hidden" onChange={(e) => void onFiles(e.target.files)} aria-label="音声ファイルを選ぶ" />
      {error && <p className="quiet">{error}</p>}

      <h3 className="label">追加済みの曲</h3>
      {state.bgm.length === 0 ? (
        <p className="quiet">まだありません。曲は端末の中にだけ保存され、どこへも送りません。</p>
      ) : (
        <ul className="rows">
          {state.bgm.map((b) => (
            <li key={b.id} className="row-item">
              <button className="row-btn" onClick={() => actions.selectBgm(b.id)}>
                <span className="name">{b.name}<span className="quiet inline">{fmtDuration(b.durationSec)}・{fmtSize(b.sizeBytes)}</span></span>
                {selected === b.id && <Icon name="check" size={16} />}
              </button>
              <button className="icon-btn" onClick={() => void actions.removeBgm(b.id)} aria-label={`${b.name} を削除`}><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <ul className="rows">
        <li className="row-item">
          <button className="row-btn" onClick={() => actions.selectBgm(null)}>
            <span className="name">無音のまま集中する</span>
            {selected == null && <Icon name="check" size={16} />}
          </button>
        </li>
      </ul>

      <h3 className="label">音量</h3>
      <label className="slider-row">
        <span className="visually-hidden">BGMの音量</span>
        <input type="range" min={0} max={100} value={Math.round(state.settings.bgmVolume * 100)} onChange={(e) => actions.setSettings({ bgmVolume: Number(e.target.value) / 100 })} />
        <span className="val">{Math.round(state.settings.bgmVolume * 100)}</span>
      </label>
      <p className="quiet">
        選んだ1曲を集中中にくり返し流します（休憩中は止まります）。
        {audioAllowed ? '' : ' いまはイヤホンの確認が取れていないため、選んでも無音のままです。'}
        シャッフル再生は今はありません。
      </p>
    </section>
  );
}
