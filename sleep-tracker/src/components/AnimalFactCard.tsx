import { pickAnimalOfTheDay } from '../data/animalSleepFacts';

export default function AnimalFactCard({ userAverageHours }: { userAverageHours: number }) {
  const animal = pickAnimalOfTheDay();
  const diff = userAverageHours > 0 ? Math.round((userAverageHours - animal.hours) * 10) / 10 : null;

  return (
    <div className="card">
      <div className="card-label">今日の睡眠豆知識</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{animal.emoji}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {animal.animal} — 1日 約{animal.hours}時間
          </div>
          <div className="subtle" style={{ marginTop: 4 }}>
            {animal.fact}
          </div>
          {diff !== null && (
            <div className="subtle" style={{ marginTop: 6 }}>
              あなたの今週平均は{diff >= 0 ? `${diff}時間 長い` : `${Math.abs(diff)}時間 短い`}です。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
