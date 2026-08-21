import { useState } from 'react';
import { actions } from '../lib/useStore';
import { approximateSize } from '../lib/storage';
import { backupFileName, downloadText, parseJson, pickTextFile, toJson } from '../lib/backup';
import { DEFAULT_AUDIO_URL } from '../lib/audioLink';
import { bedtimeTarget } from '../lib/shift';
import { initialState } from '../lib/useStore';
import type { AppState } from '../types';

const WITHIN_OPTIONS = [45, 60, 90, 120, 180];

export default function SettingsView({ state }: { state: AppState }) {
  const [status, setStatus] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const flash = (m: string) => { setStatus(m); setTimeout(() => setStatus(''), 4000); };

  // 設定を変えた時の目標時刻がその場で分かるよう、勤務日の例を出す
  const example = bedtimeTarget({ shift: 'work', shiftEndsAt: null }, state.settings);

  return (
    <div className="stack">
      <div className="card">
        <h2>就寝ルール（ステップ⑤）</h2>
        <p className="small muted" style={{ margin: 0 }}>
          原典の「夜11時就寝」は夜勤と両立しないため、<strong>終業時刻を基準に目標を計算</strong>します。
        </p>
        <label className="field">
          <span className="field-label">勤務日の終業時刻（既定）</span>
          <input type="time" value={state.settings.shiftEndDefault} onChange={(e) => actions.setSettings({ shiftEndDefault: e.target.value })} />
        </label>
        <div>
          <p className="section-title">終業から何分以内に寝るか</p>
          <div className="chips">
            {WITHIN_OPTIONS.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={state.settings.bedWithinMinutes === m} onClick={() => actions.setSettings({ bedWithinMinutes: m })}>
                {m}分
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">休日の就寝目標</span>
          <input type="time" value={state.settings.offDayBedtime} onChange={(e) => actions.setSettings({ offDayBedtime: e.target.value })} />
        </label>
        {example && <p className="note-line warm" style={{ margin: 0 }}>いまの設定だと、勤務日の目標は <strong className="num">{example.label}</strong>（{example.reason}）です。</p>}
      </div>

      <div className="card">
        <h2>表示</h2>
        <button
          type="button"
          className="habit"
          aria-pressed={state.settings.showStreakProminently}
          onClick={() => actions.setSettings({ showStreakProminently: !state.settings.showStreakProminently })}
        >
          <span className="box" aria-hidden="true">{state.settings.showStreakProminently ? '✓' : ''}</span>
          <span className="body">
            連続日数を大きく出す
            <span className="criterion">
              既定はオフです。連続日数を主役にすると、1日抜けただけで台無しに感じやすいため、
              通常は「期間の◯日目」と「通算の実践日数」を主に出します。
            </span>
          </span>
        </button>
      </div>

      <div className="card">
        <h2>音声学習との連携</h2>
        <p className="small muted" style={{ margin: 0 }}>
          ステップ①③④を達成した日に、鍼灸国試アプリの音声学習へのリンクを出します（任意・既定オフ）。
          データのやり取りはしません。リンクを開くだけです。
        </p>
        <button
          type="button"
          className="habit"
          aria-pressed={state.settings.audioLinkEnabled}
          onClick={() => actions.setSettings({ audioLinkEnabled: !state.settings.audioLinkEnabled })}
        >
          <span className="box" aria-hidden="true">{state.settings.audioLinkEnabled ? '✓' : ''}</span>
          <span className="body">達成した日にリンクを出す</span>
        </button>
        {state.settings.audioLinkEnabled && (
          <label className="field">
            <span className="field-label">リンク先</span>
            <input
              type="url"
              value={state.settings.audioLinkUrl}
              placeholder={DEFAULT_AUDIO_URL}
              onChange={(e) => actions.setSettings({ audioLinkUrl: e.target.value })}
            />
          </label>
        )}
      </div>

      <div className="card">
        <h2>データ</h2>
        <p className="small muted" style={{ margin: 0 }}>
          記録はこの端末の中にだけ保存されます（外部へ送りません）。保存量の目安：約 {approximateSize(state).toLocaleString()} バイト。
          機種変更の時は、下のバックアップファイルを新しい端末で読み込んでください。
        </p>
        <div className="row">
          <button
            type="button"
            className="btn slim"
            onClick={() => { downloadText(backupFileName(Date.now()), toJson(state, Date.now())); flash('バックアップを保存しました。'); }}
          >
            💾 バックアップを保存
          </button>
          <button
            type="button"
            className="btn slim secondary"
            onClick={async () => {
              const text = await pickTextFile();
              if (!text) return;
              const parsed = parseJson(text, initialState(Date.now()));
              if (!parsed.ok || !parsed.state) { flash(`復元できませんでした：${parsed.error}`); return; }
              actions.replaceState(parsed.state);
              flash('バックアップから復元しました。');
            }}
          >
            📂 復元する
          </button>
        </div>
        {status && <p className="small" style={{ margin: 0 }}>{status}</p>}

        {!confirmReset ? (
          <button type="button" className="btn slim ghost" onClick={() => setConfirmReset(true)}>すべての記録を削除</button>
        ) : (
          <div className="confirm">
            <p className="small" style={{ margin: 0 }}>すべての記録・習慣・設定を削除します。元に戻せません。</p>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn slim secondary" onClick={() => setConfirmReset(false)}>いいえ</button>
              <button type="button" className="btn slim danger" onClick={() => { void actions.resetAll(); setConfirmReset(false); flash('削除しました。'); }}>はい、削除する</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>このアプリについて</h2>
        <p className="small muted" style={{ margin: 0 }}>
          海外の自己啓発コンテンツ「ゴーストモード」の7ステップを土台にした習慣トラッカーです。
          モンクモードが生活の質を上げるためのものなのに対し、ゴーストモードは結果に寄せた過ごし方とされています。
          推奨は<strong>最低1ヶ月</strong>で、無期限に続ける前提ではありません。
          このアプリも、連続日数を煽らず、区切りごとに立ち止まって決められる作りにしています。
        </p>
      </div>
    </div>
  );
}
