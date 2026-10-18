// 休憩の線画。画像ファイルを持たず、その場に線を引く。色は currentColor だけ。
// 参考画像（ユーザー提供）に合わせ、線は最小限：頭の円・体の線・机／床の線・Zzz。

export function DeskNap() {
  // 机に突っ伏して寝ている（頭・折りたたんだ腕・机の線・Zzz）
  return (
    <svg className="illust" viewBox="0 0 200 100" width="200" height="100" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="机に突っ伏して休んでいる人の線画">
      <circle cx="58" cy="60" r="16" />
      <rect x="76" y="58" width="52" height="16" rx="8" />
      <path d="M20 80h160" />
      <path d="M150 80v12" />
      <path d="M40 80v12" />
      <text x="96" y="40" className="zzz" stroke="none" fill="currentColor">Z</text>
      <text x="110" y="28" className="zzz sm" stroke="none" fill="currentColor">z</text>
      <text x="120" y="18" className="zzz xs" stroke="none" fill="currentColor">z</text>
    </svg>
  );
}

export function LyingDown() {
  // 仰向けに寝ている（頭・胴体・脚のシンプルな線・Zzz）
  return (
    <svg className="illust" viewBox="0 0 200 100" width="200" height="100" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="仰向けに寝ている人の線画">
      <circle cx="46" cy="66" r="14" />
      <path d="M62 68c14-4 40-5 66-4 12 1 28 3 44 6" />
      <path d="M62 78h118" />
      <path d="M16 84h168" />
      <text x="70" y="42" className="zzz" stroke="none" fill="currentColor">Z</text>
      <text x="84" y="30" className="zzz sm" stroke="none" fill="currentColor">z</text>
      <text x="94" y="20" className="zzz xs" stroke="none" fill="currentColor">z</text>
    </svg>
  );
}
