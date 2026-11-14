// YouTube IFrame Player APIの薄いラッパー（2026-11-15追加）。
// ポモドーロのプレイリストにYouTubeの曲を追加できるようにするためのもの。
// 外部ランタイム依存（npmパッケージ）は増やさない——実際にYouTubeの曲を選んで
// 再生する時だけ、https://www.youtube.com/iframe_api を動的に読み込むscriptタグを
// 1つ足すだけ（Googleドライブ連携・ボイスクローンと同じ「ユーザーが自分でその機能を
// 使った時だけ発生するネットワーク通信」という位置づけ。`src/lib`の多くがネットワークに
// 触れない方針の、ユーザーが明示的にYouTubeを選んだ時だけの例外）。

const API_SRC = 'https://www.youtube.com/iframe_api';
let apiPromise = null;

// YouTubeのURL（通常・短縮・embed・shorts）または動画IDそのものから動画IDを取り出す。
// 読み取れなければnull（当てずっぽうで何かを返さない）。
export function extractYoutubeId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[\w-]{11}$/.test(s)) return s; // IDだけ貼られた場合
  let u;
  try {
    u = new URL(s);
  } catch (e) {
    return null;
  }
  if (!/youtube\.com$|youtu\.be$/.test(u.hostname.replace(/^www\.|^m\./, ''))) return null;
  const v = u.searchParams.get('v');
  if (v && /^[\w-]{11}$/.test(v)) return v;
  const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
  if (m) return m[2];
  if (u.hostname.replace(/^www\.|^m\./, '') === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    if (/^[\w-]{11}$/.test(id)) return id;
  }
  return null;
}

// 動画タイトルを取得（YouTube oEmbed、APIキー不要の公開エンドポイント）。
// オフライン・取得失敗時は例外を投げずnullを返す（呼び出し側はURL/IDを名前の代わりにする）。
export async function fetchYoutubeTitle(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.title || null;
  } catch (e) {
    return null;
  }
}

function loadIframeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ブラウザ環境ではありません'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { prevCb?.(); } catch (e) { /* noop */ }
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = API_SRC;
    tag.onerror = () => { apiPromise = null; reject(new Error('YouTube IFrame APIの読み込みに失敗しました')); };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

// containerEl（DOM要素）の位置にプレイヤーを作る。
// 1本の動画をループ再生するには playerVars.loop=1 と playlist=videoId を
// 両方指定する必要がある（YouTube IFrame APIの既知の仕様——loopだけでは効かない）。
export async function createYoutubePlayer(containerEl, videoId, { volume = 100, onReady, onError } = {}) {
  const YT = await loadIframeApi();
  return new YT.Player(containerEl, {
    videoId,
    playerVars: {
      loop: 1,
      playlist: videoId,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      playsinline: 1,
    },
    events: {
      onReady: (e) => {
        try { e.target.setVolume(Math.round(volume * 100)); } catch (err) { /* noop */ }
        onReady?.(e.target);
      },
      onError: (e) => onError?.(e.data),
    },
  });
}
