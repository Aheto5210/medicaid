import React, { useId, useState } from 'react';

function buildLinePath(points) {
  if (!points.length) return '';
  return points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`
  )).join(' ');
}

function getNiceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const scale = 10 ** exponent;
  const fraction = value / scale;
  let niceFraction = 1;

  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }

  return niceFraction * scale;
}

function calculateY(value, chartTop, chartBottom, axisMax) {
  if (!axisMax) return chartBottom;
  const ratio = value / axisMax;
  return chartBottom - (ratio * (chartBottom - chartTop));
}

export default function MainReasonLineChart({ items }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const series = items.map((item) => ({
    ...item,
    value: Number(item.value || 0)
  }));

  if (!series.length) {
    return <div className="empty">No data yet.</div>;
  }

  const gradientId = useId().replace(/:/g, '');
  const axisMax = getNiceMax(Math.max(...series.map((item) => item.value), 0));
  const denominator = Math.max(series.length - 1, 1);
  const chartLeft = 20;
  const chartRight = 400;
  const chartTop = 10;
  const chartBottom = 86;
  const tickCount = 4;
  const focusedIndex = hoveredIndex ?? activeIndex;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => (
    axisMax - ((axisMax / tickCount) * index)
  ));

  const points = series.map((item, index) => {
    const x = chartLeft + (index / denominator) * (chartRight - chartLeft);
    const y = calculateY(item.value, chartTop, chartBottom, axisMax);
    return { x, y, label: item.label, value: item.value, index };
  });
  const linePath = buildLinePath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x},${chartBottom} L ${points[0].x},${chartBottom} Z`;
  const focusedPoint = focusedIndex !== null ? points[focusedIndex] : null;
  const focusText = focusedPoint ? `${focusedPoint.label}: ${focusedPoint.value}` : null;
  const focusChipPaddingX = 5;
  const focusChipWidth = focusText
    ? Math.max(36, (focusText.length * 3.05) + (focusChipPaddingX * 2))
    : 0;
  const focusChipHeight = 11;
  const focusChipX = focusedPoint
    ? Math.min(
      Math.max(focusedPoint.x - (focusChipWidth / 2), chartLeft),
      chartRight - focusChipWidth
    )
    : 0;
  const focusChipY = focusedPoint
    ? ((focusedPoint.y - 14) < (chartTop + 1) ? focusedPoint.y + 6.8 : focusedPoint.y - 14)
    : 0;

  return (
    <div className="multi-line-chart trend-chart">
      <svg viewBox="0 0 420 100" preserveAspectRatio="xMidYMid meet">
        {ticks.map((tick) => {
          const y = calculateY(tick, chartTop, chartBottom, axisMax);
          return (
            <g key={`tick-${tick}`}>
              <line
                x1={chartLeft}
                y1={y}
                x2={chartRight}
                y2={y}
                className="grid-line trend-grid-line"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

        {points.map((point) => (
          <line
            key={`guide-${point.label}`}
            x1={point.x}
            y1={chartBottom}
            x2={point.x}
            y2={point.y}
            className={`trend-guide-line ${focusedIndex === point.index ? 'active' : ''}`}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#62b9ea" stopOpacity="0.17" />
            <stop offset="100%" stopColor="#62b9ea" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <path className="trend-area" d={areaPath} fill={`url(#${gradientId})`} />
        <path
          className="trend-line"
          d={linePath}
          fill="none"
          stroke="#62b9ea"
          strokeWidth="1.28"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {focusText && (
          <g className="trend-focus-chip">
            <rect
              x={focusChipX}
              y={focusChipY}
              width={focusChipWidth}
              height={focusChipHeight}
              rx="3.6"
              className="trend-focus-chip-bg"
            />
            <text
              x={focusChipX + (focusChipWidth / 2)}
              y={focusChipY + 7}
              textAnchor="middle"
              className="trend-focus-chip-text"
            >
              {focusText}
            </text>
          </g>
        )}

        {points.map((point) => (
          <g
            key={point.label}
            tabIndex={0}
            role="button"
            aria-label={`${point.label}: ${point.value}`}
            onMouseEnter={() => setHoveredIndex(point.index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onFocus={() => setHoveredIndex(point.index)}
            onBlur={() => setHoveredIndex(null)}
            onClick={() => setActiveIndex((prev) => (prev === point.index ? null : point.index))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActiveIndex((prev) => (prev === point.index ? null : point.index));
              }
            }}
          >
            <circle
              className="trend-point-hit"
              cx={point.x}
              cy={point.y}
              r="3.4"
              fill="transparent"
            />
            <circle
              className={`trend-point ${focusedIndex === point.index ? 'active' : ''}`}
              cx={point.x}
              cy={point.y}
              r={focusedIndex === point.index ? '1.7' : '1.3'}
              fill="#62b9ea"
              stroke="none"
              style={{ '--point-delay': `${point.index * 80}ms` }}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>

      <div className="multi-line-labels trend-bottom-labels">
        {series.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={`trend-label-chip ${focusedIndex === index ? 'active' : ''}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
