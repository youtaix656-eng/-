// 線画（outline）のアイコン。画像ファイルを持たず、色は currentColor だけ。

import type { SVGProps } from 'react';

export type IconName =
  | 'play' | 'pause' | 'skip' | 'music' | 'musicOff' | 'timer' | 'chart' | 'calendar' | 'list' | 'settings'
  | 'check' | 'plus' | 'back' | 'close' | 'flag' | 'eye' | 'drop' | 'walk' | 'stretch' | 'note' | 'breath'
  | 'window' | 'shoulder' | 'headphones' | 'trash' | 'chevron' | 'tag' | 'reset';

const PATHS: Record<IconName, JSX.Element> = {
  play: <path d="M8 5v14l11-7z" />,
  pause: <><path d="M8 5v14" /><path d="M16 5v14" /></>,
  skip: <><path d="M5 5l10 7-10 7z" /><path d="M19 5v14" /></>,
  music: <><path d="M9 18V6l11-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  musicOff: <><path d="M9 18V9" /><path d="M9 6l11-2v9" /><circle cx="6" cy="18" r="3" /><path d="M3 3l18 18" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /><path d="M10 2h4" /></>,
  chart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>,
  list: <><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  check: <path d="M5 12l5 5L20 7" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  back: <><path d="M15 18l-6-6 6-6" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  drop: <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />,
  walk: <><circle cx="13" cy="4" r="1.5" /><path d="M10 21l2-7 3 2v5" /><path d="M9 12l2-4 3 1 3 3" /><path d="M8 15l1-3" /></>,
  stretch: <><circle cx="12" cy="4" r="1.5" /><path d="M12 7v6" /><path d="M6 9l6 2 6-2" /><path d="M9 21l3-8 3 8" /></>,
  note: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 9h6" /><path d="M9 13h6" /><path d="M9 17h3" /></>,
  breath: <><path d="M3 12c3-4 6-4 9 0s6 4 9 0" /><path d="M3 17c3-4 6-4 9 0s6 4 9 0" /><path d="M3 7c3-4 6-4 9 0s6 4 9 0" /></>,
  window: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M12 3v18" /><path d="M4 12h16" /></>,
  shoulder: <><circle cx="12" cy="5" r="2" /><path d="M6 12c2-3 4-4 6-4s4 1 6 4" /><path d="M5 13a3 3 0 1 0 0-1" /><path d="M19 13a3 3 0 1 1 0-1" /></>,
  headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
};

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
