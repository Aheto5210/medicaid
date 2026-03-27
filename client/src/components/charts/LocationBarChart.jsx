import React, { useState } from 'react';

export default function LocationBarChart({ items }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!items.length) {
    return <div className="empty">No data yet.</div>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const focusedIndex = hoveredIndex ?? activeIndex;

  return (
    <div className="location-bar-chart">
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          className={`location-bar-row ${focusedIndex === index ? 'active' : ''}`}
          style={{ '--bar-delay': `${index * 70}ms` }}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
        >
          <div className="location-bar-label" title={item.label}>{item.label}</div>
          <div className="location-bar-track">
            <span className="location-bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <div className="location-bar-value">
            <span className="location-bar-count">{item.value}</span>
            <span className={`location-bar-percent ${focusedIndex === index ? 'visible' : ''}`}>
              {Math.round((Number(item.value || 0) / total) * 100)}%
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
