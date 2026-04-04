import React from 'react';

const TREEMAP_COLORS = ['#00a896', '#2f80ed', '#f4a261', '#8bc34a', '#ff7a59', '#f2c94c'];

function sortItems(items = []) {
  return [...items]
    .filter((item) => Number(item?.value || 0) > 0)
    .sort((a, b) => {
      const valueDiff = Number(b.value || 0) - Number(a.value || 0);
      if (valueDiff !== 0) return valueDiff;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });
}

function groupVisibleItems(items = [], maxItems = 6) {
  const sortedItems = sortItems(items);
  if (sortedItems.length <= maxItems) return sortedItems;

  const visibleItems = sortedItems.slice(0, maxItems - 1);
  const hiddenItems = sortedItems.slice(maxItems - 1);
  const otherTotal = hiddenItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return [...visibleItems, { label: 'Other', value: otherTotal }];
}

function getTextColor(hex) {
  const normalized = String(hex || '').replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;

  const red = parseInt(safeHex.slice(0, 2), 16) || 0;
  const green = parseInt(safeHex.slice(2, 4), 16) || 0;
  const blue = parseInt(safeHex.slice(4, 6), 16) || 0;
  const luminance = (0.299 * red) + (0.587 * green) + (0.114 * blue);

  return luminance > 168 ? '#162126' : '#ffffff';
}

function splitBalanced(items = []) {
  if (items.length <= 1) return [items, []];

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let running = 0;
  let splitIndex = 1;

  for (let index = 0; index < items.length; index += 1) {
    running += Number(items[index].value || 0);
    splitIndex = index + 1;
    if (running >= total / 2) break;
  }

  return [items.slice(0, splitIndex), items.slice(splitIndex)];
}

function layoutTreemap(items, x, y, width, height) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], x, y, width, height }];

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  // Guard against infinite recursion when all items have value 0 or dimensions become 0
  if (total === 0 || width < 1 || height < 1) return [];

  const [firstGroup, secondGroup] = splitBalanced(items);
  const firstTotal = firstGroup.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const ratio = firstTotal / total;

  // Prevent zero-size recursive calls that cause infinite loops
  if (ratio <= 0 || ratio >= 1) {
    return items.map((item) => ({ ...item, x, y, width, height }));
  }

  if (width >= height) {
    const firstWidth = width * ratio;
    if (firstWidth < 1) {
      return items.map((item) => ({ ...item, x, y, width, height }));
    }
    return [
      ...layoutTreemap(firstGroup, x, y, firstWidth, height),
      ...layoutTreemap(secondGroup, x + firstWidth, y, width - firstWidth, height)
    ];
  }

  const firstHeight = height * ratio;
  if (firstHeight < 1) {
    return items.map((item) => ({ ...item, x, y, width, height }));
  }
  return [
    ...layoutTreemap(firstGroup, x, y, width, firstHeight),
    ...layoutTreemap(secondGroup, x, y + firstHeight, width, height - firstHeight)
  ];
}

export default function TreemapBreakdown({ items = [], emptyMessage = 'No data yet.' }) {
  const visibleItems = groupVisibleItems(items).map((item, index) => ({
    ...item,
    color: TREEMAP_COLORS[index % TREEMAP_COLORS.length]
  }));

  if (!visibleItems.length) {
    return <div className="empty">{emptyMessage}</div>;
  }

  const tiles = layoutTreemap(visibleItems, 0, 0, 100, 68);

  return (
    <div className="treemap-breakdown">
      <svg
        className="treemap-svg"
        viewBox="0 0 100 68"
        role="img"
        aria-label="Occupation treemap"
      >
        {tiles.map((tile) => {
          const labelFits = tile.width >= 18 && tile.height >= 12;
          const valueFits = tile.width >= 12 && tile.height >= 10;
          const fontSize = tile.width >= 28 && tile.height >= 18 ? 5.2 : 4.2;
          const valueFontSize = tile.width >= 28 && tile.height >= 18 ? 6.2 : 4.8;
          const textColor = getTextColor(tile.color);

          return (
            <g key={tile.label}>
              <title>{`${tile.label}: ${tile.value}`}</title>
              <rect
                x={tile.x + 0.8}
                y={tile.y + 0.8}
                width={Math.max(tile.width - 1.6, 0)}
                height={Math.max(tile.height - 1.6, 0)}
                rx="4"
                fill={tile.color}
              />
              {labelFits ? (
                <>
                  <text
                    x={tile.x + 3.4}
                    y={tile.y + 6.3}
                    className="treemap-label"
                    fill={textColor}
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {tile.label}
                  </text>
                  {valueFits ? (
                    <text
                      x={tile.x + 3.4}
                      y={tile.y + (tile.height >= 18 ? 14.8 : 12.2)}
                      className="treemap-value"
                      fill={textColor}
                      style={{ fontSize: `${valueFontSize}px` }}
                    >
                      {tile.value}
                    </text>
                  ) : null}
                </>
              ) : valueFits ? (
                <text
                  x={tile.x + 3.4}
                  y={tile.y + 6.8}
                  className="treemap-value"
                  fill={textColor}
                  style={{ fontSize: `${valueFontSize}px` }}
                >
                  {tile.value}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
