// 画面を動かす時の速さ。設定の「アニメーションを減らす」（.app.reduce-motion）と端末の
// 「視差効果を減らす」を見る。CSSの scroll-behavior は JS からの behavior:'smooth' には
// 効かないので、JSで動かす所はここを通す（以前は設定を入れてもなめらかに動いていた）。
export function scrollBehavior() {
  try {
    if (typeof document !== 'undefined' && document.querySelector('.app.reduce-motion')) return 'auto';
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'auto';
  } catch (e) { /* noop */ }
  return 'smooth';
}
