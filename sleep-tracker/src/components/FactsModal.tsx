import { useState } from 'react';
import { ANIMAL_SLEEP_FACTS } from '../data/animalSleepFacts';
import { SLEEP_FACTS } from '../data/sleepFacts';

type Tab = 'animals' | 'facts';

export default function FactsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('animals');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>睡眠のあれこれ</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="tabs">
          <button className={tab === 'animals' ? 'active' : ''} onClick={() => setTab('animals')}>
            動物の睡眠
          </button>
          <button className={tab === 'facts' ? 'active' : ''} onClick={() => setTab('facts')}>
            睡眠の豆知識
          </button>
        </div>

        {tab === 'animals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ANIMAL_SLEEP_FACTS.map((a) => (
              <div className="card" key={a.animal} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>{a.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {a.animal} — 1日 約{a.hours}時間
                  </div>
                  <div className="subtle" style={{ marginTop: 4 }}>
                    {a.fact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'facts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SLEEP_FACTS.map((f) => (
              <div className="card" key={f.title}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{f.title}</div>
                <div className="subtle">{f.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
