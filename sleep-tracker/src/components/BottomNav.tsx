export type TabId = 'home' | 'history' | 'dashboard' | 'schedule' | 'work';

const TABS: { id: TabId; label: string; ico: string }[] = [
  { id: 'home', label: 'ホーム', ico: '🏠' },
  { id: 'work', label: '勤務', ico: '💆' },
  { id: 'history', label: '履歴', ico: '📋' },
  { id: 'dashboard', label: '分析', ico: '📊' },
  { id: 'schedule', label: '提案', ico: '🗓' },
];

export default function BottomNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={active === t.id ? 'active' : ''}
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? 'page' : undefined}
        >
          <span className="ico" aria-hidden="true">
            {t.ico}
          </span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
