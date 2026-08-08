import { useEffect, useState } from 'react';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function format(d: Date) {
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds()
  ).padStart(2, '0')}`;
  const date = `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
  return { time, date };
}

export default function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { time, date } = format(now);

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span className="big-num" style={{ fontSize: 26 }}>
        {time}
      </span>
      <span className="subtle">{date}</span>
    </div>
  );
}
