// イヤホン接続の状態（自動検知＋本人確認）を1か所で持つ。
// 自動で「見つかった」あとに消えたら、本人確認の印も外して音を止める
// （抜いた瞬間にスピーカーから鳴らさないため）。

import { useEffect, useState } from 'react';
import { audioAllowed, canEnumerate, detectHeadphones, watchDevices, type HeadphoneStatus } from '../lib/headphones.js';
import { actions } from '../lib/useStore.js';

export function useHeadphones(confirmed: boolean) {
  const [status, setStatus] = useState<HeadphoneStatus>('unknown');
  const [detectable] = useState(() => canEnumerate());

  useEffect(() => {
    let alive = true;
    let last: HeadphoneStatus = 'unknown';
    const check = async () => {
      const next = await detectHeadphones();
      if (!alive) return;
      if (last === 'connected' && next === 'unknown') actions.setSettings({ headphoneConfirmed: false });
      last = next;
      setStatus(next);
    };
    void check();
    const stop = watchDevices(() => void check());
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { status, detectable, allowed: audioAllowed(status, confirmed) };
}
