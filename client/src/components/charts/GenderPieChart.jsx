import React, { useState } from 'react';

const PIE_COLORS = ['#00a896', '#f4a261', '#2f80ed', '#8bc34a', '#ff7a59', '#f2c94c'];

function toRadians(angle) {
  return ((angle - 90) * Math.PI) / 180;
}

function pointOnCircle(cx, cy, radius, angle) {
  const rad = toRadians(angle);
  return {
    x: cx + (radius * Math.cos(rad)),
    y: cy + (radius * Math.sin(rad))
  };
}

function buildDonutPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const safeEnd = endAngle - startAngle >= 360 ? (startAngle + 359.999) : endAngle;
  const largeArcFlag = safeEnd - startAngle > 180 ? 1 : 0;

  const outerStart = pointOnCircle(cx, cy, outerRadius, startAngle);
  const outerEnd = pointOnCircle(cx, cy, outerRadius, safeEnd);
  const innerEnd = pointOnCircle(cx, cy, innerRadius, safeEnd);
  const innerStart = pointOnCircle(cx, cy, innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z'
  ].join(' ');
}

function formatLegendLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  if (normalized === 'general screening') return 'General';
  if (normalized === 'eye screening') return 'Eye';
  return label;
}

export default function GenderPieChart({ items, centerLabel = 'People' }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!items.length) {
    return <div className="empty">No data yet.</div>;
  }

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const focusedIndex = activeIndex;

  let angleCursor = 0;
  const slices = items.map((item, index) => {
    const value = Number(item.value || 0);
    const angleSpan = total ? ((value / total) * 360) : 0;
    const startAngle = angleCursor;
    const endAngle = angleCursor + angleSpan;
    angleCursor = endAngle;

    const midAngle = startAngle + (angleSpan / 2);
    const isFocused = focusedIndex === index;
    const popDistance = isFocused ? 8 : 0;
    const dx = Math.cos(toRadians(midAngle)) * popDistance;
    const dy = Math.sin(toRadians(midAngle)) * popDistance;

    return {
      ...item,
      color: PIE_COLORS[index % PIE_COLORS.length],
      value,
      path: buildDonutPath(100, 100, 82, 56, startAngle, endAngle),
      translate: `translate(${dx}px, ${dy}px)`,
      isFocused
    };
  });

  return (
    <div className="pie-chart">
      <div className="pie-ring pie-ring-animated interactive-pie-ring">
        <svg
          className="pie-svg"
          viewBox="0 0 200 200"
          role="img"
          aria-label={`${centerLabel} chart`}
        >
          {slices.map((slice, index) => (
            <path
              key={slice.label}
              d={slice.path}
              fill={slice.color}
              className={`pie-slice ${slice.isFocused ? 'active' : ''} ${focusedIndex !== null && !slice.isFocused ? 'dimmed' : ''}`}
              style={{ transform: slice.translate }}
              onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActiveIndex((prev) => (prev === index ? null : index));
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${slice.label}: ${slice.value}`}
            />
          ))}
        </svg>
      </div>

      <div className="pie-legend">
        {slices.map((slice, index) => (
          <button
            key={slice.label}
            type="button"
            className={`pie-legend-row ${slice.isFocused ? 'active' : ''}`}
            style={{ '--legend-delay': `${index * 70}ms` }}
            onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
          >
            <span className="swatch" style={{ background: slice.color }} />
            <span className="legend-label">{formatLegendLabel(slice.label)}</span>
            <span className="legend-value">{slice.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
