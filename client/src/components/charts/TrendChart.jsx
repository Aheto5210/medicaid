import React from 'react';

export default function TrendChart({ data }) {
  if (!data.length) {
    return <div className="empty">No data yet.</div>;
  }

  const values = data.map((item) => item.value);
  const max = Math.max(...values, 1);
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - (item.value / max) * 100;
    return `${x},${y}`;
  });

  return (
    <div className="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={points.join(' ')} fill="none" stroke="url(#grad)" strokeWidth="2" />
        <defs>
          <linearGradient id="grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#00a896" />
            <stop offset="100%" stopColor="#f4a261" />
          </linearGradient>
        </defs>
      </svg>
      <div className="chart-labels">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}
