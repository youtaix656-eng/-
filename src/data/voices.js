// 音声学習の「話し方」プリセット（聞き取りやすい 女性3・男性3）。
//
// Web Speech は端末ごとに使える音声が異なるため、各プリセットは
//  1) その性別に合う実在の音声（あれば）を自動で割り当て、
//  2) さらにピッチ・速度で声質に差をつける。
// これにより、端末に日本語音声が1つしかなくても6種を聞き分けられる。

export const VOICE_PRESETS = [
  { id: 'f1', gender: 'female', label: '女性① おだやか', desc: '落ち着いた聞きやすい声', rate: 0.95, pitch: 1.0 },
  { id: 'f2', gender: 'female', label: '女性② はきはき', desc: '明瞭でテンポよく', rate: 1.05, pitch: 1.12 },
  { id: 'f3', gender: 'female', label: '女性③ やさしい', desc: 'やわらかくゆっくり', rate: 0.9, pitch: 1.06 },
  { id: 'm1', gender: 'male', label: '男性① おだやか', desc: '低めで落ち着いた声', rate: 0.95, pitch: 0.95 },
  { id: 'm2', gender: 'male', label: '男性② はきはき', desc: '明瞭でテンポよく', rate: 1.05, pitch: 1.0 },
  { id: 'm3', gender: 'male', label: '男性③ しっかり', desc: '先生のような明瞭低音', rate: 0.92, pitch: 0.86 },
];

// 既知の日本語音声名（小文字・部分一致）で性別を推定
const FEMALE_NAMES = [
  'kyoko', 'nanami', 'ayumi', 'haruka', 'sayaka', 'ichika', 'mayu', 'aoi', 'shiori',
  'mizuki', 'hina', 'google 日本語', 'google japanese', 'female', '女性', 'siri 声2', 'reina',
];
const MALE_NAMES = [
  'otoya', 'hattori', 'keita', 'ichiro', 'daichi', 'naoki', 'ren', 'takeru',
  'male', '男性', 'siri 声1',
];

export function guessGender(name) {
  const n = String(name || '').toLowerCase();
  if (FEMALE_NAMES.some((k) => n.includes(k))) return 'female';
  if (MALE_NAMES.some((k) => n.includes(k))) return 'male';
  return null;
}

// プリセットに最適な voiceURI を、利用可能な日本語音声から選ぶ（無ければ ''＝既定）
export function resolveVoiceURI(preset, jaVoices) {
  if (!jaVoices || jaVoices.length === 0) return '';
  const wanted = preset.gender;
  // 1) 性別一致の音声を優先
  const match = jaVoices.find((v) => guessGender(v.name) === wanted);
  if (match) return match.voiceURI;
  // 2) 反対の性別と判定された音声は避けつつ、性別不明の音声を使う（ピッチで差をつける）
  const neutral = jaVoices.find((v) => guessGender(v.name) == null);
  if (neutral) return neutral.voiceURI;
  // 3) 何でも先頭
  return jaVoices[0].voiceURI;
}

export function presetById(id) {
  return VOICE_PRESETS.find((p) => p.id === id) || null;
}
