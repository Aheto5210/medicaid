import React from 'react';

const DONUT_COLORS = ['#00a896', '#f4a261', '#2f80ed', '#8bc34a', '#ff7a59', '#f2c94c'];

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

function sortItems(items = []) {
  return [...items]
    .filter((item) => Number(item?.value || 0) > 0)
    .sort((a, b) => {
      const valueDiff = Number(b.value || 0) - Number(a.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });
}

function groupVisibleItems(items = [], maxItems = 5) {
  const sortedItems = sortItems(items);
  if (sortedItems.length <= maxItems) return sortedItems;

  const visibleItems = sortedItems.slice(0, maxItems - 1);
  const hiddenItems = sortedItems.slice(maxItems - 1);
  const otherTotal = hiddenItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return [...visibleItems, { label: 'Other', value: otherTotal }];
}

export default function CompactDonutBreakdown({
  items = [],
  centerLabel = 'Total',
  emptyMessage = 'No data yet.'
}) {
  const chartItems = groupVisibleItems(items);

  if (!chartItems.length) {
    return <div className="empty">{emptyMessage}</div>;
  }

  const total = chartItems.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;

  let angleCursor = 0;
  const slices = chartItems.map((item, index) => {
    const value = Number(item.value || 0);
    const angleSpan = (value / total) * 360;
    const startAngle = angleCursor;
    const endAngle = angleCursor + angleSpan;
    angleCursor = endAngle;

    return {
      ...item,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      path: buildDonutPath(100, 100, 84, 58, startAngle, endAngle)
    };
  });

  return (
    <div className="compact-donut-breakdown">
      <div className="compact-donut-ring">
        <svg viewBox="0 0 200 200" role="img" aria-label={`${centerLabel} breakdown`}>
          {slices.map((slice) => (
            <path key={slice.label} d={slice.path} fill={slice.color} />
          ))}
        </svg>
        <div className="compact-donut-center">
          <strong>{total}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>

      <div className="compact-donut-legend" aria-hidden="true">
        {slices.map((slice) => (
          <span className="compact-donut-chip" key={slice.label}>
            <span className="compact-donut-dot" style={{ background: slice.color }} />
            <span>{slice.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
