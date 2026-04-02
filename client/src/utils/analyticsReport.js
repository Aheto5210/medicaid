function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInteger(value) {
  return new Intl.NumberFormat('en-GH', {
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

const VISUAL_COLORS = ['#0b8f81', '#4f827c', '#7aa39e', '#a7c1bc', '#c7d7d3', '#dfe8e5'];

function normalizeChartItems(items = [], { sortByValue = true } = {}) {
  const totals = new Map();

  (items || []).forEach((item) => {
    const label = String(item?.label || '').trim() || 'Unknown';
    const value = Number(item?.value || 0);

    if (value <= 0) return;
    totals.set(label, (totals.get(label) || 0) + value);
  });

  const normalizedItems = [...totals.entries()].map(([label, value]) => ({ label, value }));

  if (!sortByValue) {
    return normalizedItems;
  }

  return normalizedItems.sort((a, b) => {
    const valueDiff = Number(b.value || 0) - Number(a.value || 0);
    if (valueDiff !== 0) return valueDiff;
    return String(a.label || '').localeCompare(String(b.label || ''));
  });
}

function groupVisibleItems(
  items = [],
  {
    maxItems = 6,
    sortByValue = true,
    groupOverflow = true
  } = {}
) {
  const normalizedItems = normalizeChartItems(items, { sortByValue });

  if (!groupOverflow || normalizedItems.length <= maxItems) {
    return normalizedItems;
  }

  const visibleItems = normalizedItems.slice(0, maxItems - 1);
  const hiddenItems = normalizedItems.slice(maxItems - 1);
  const hiddenTotal = hiddenItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const existingOtherIndex = visibleItems.findIndex((item) => String(item.label || '').trim().toLowerCase() === 'other');

  if (existingOtherIndex >= 0) {
    visibleItems[existingOtherIndex] = {
      ...visibleItems[existingOtherIndex],
      value: Number(visibleItems[existingOtherIndex].value || 0) + hiddenTotal
    };
    return visibleItems;
  }

  return [...visibleItems, { label: 'Other', value: hiddenTotal }];
}

function shortenLabel(value, maxLength = 18) {
  const label = String(value || '').trim();
  if (!label) return 'Unknown';
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}

function toRadians(angle) {
  return ((angle - 90) * Math.PI) / 180;
}

function pointOnCircle(cx, cy, radius, angle) {
  const radians = toRadians(angle);
  return {
    x: cx + (radius * Math.cos(radians)),
    y: cy + (radius * Math.sin(radians))
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

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const [firstGroup, secondGroup] = splitBalanced(items);
  const firstTotal = firstGroup.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const ratio = firstTotal / total;

  if (width >= height) {
    const firstWidth = width * ratio;
    return [
      ...layoutTreemap(firstGroup, x, y, firstWidth, height),
      ...layoutTreemap(secondGroup, x + firstWidth, y, width - firstWidth, height)
    ];
  }

  const firstHeight = height * ratio;
  return [
    ...layoutTreemap(firstGroup, x, y, width, firstHeight),
    ...layoutTreemap(secondGroup, x, y + firstHeight, width, height - firstHeight)
  ];
}

function buildVisualFrame(content, className = '') {
  const classes = ['report-visual', className].filter(Boolean).join(' ');
  return `<div class="${classes}">${content}</div>`;
}

function buildEmptyVisual() {
  return buildVisualFrame('<div class="report-visual-empty">No data available.</div>');
}

function buildVisualPanel(title, content, className = '') {
  const classes = ['report-section', 'report-visual-panel', className].filter(Boolean).join(' ');

  return `
    <section class="${classes}">
      <div class="section-heading">
        <h2>${escapeHtml(title)}</h2>
      </div>
      ${content}
    </section>
  `;
}

function buildDonutVisual(items = [], { centerLabel = 'Total', maxItems = 5 } = {}) {
  const chartItems = groupVisibleItems(items, { maxItems, sortByValue: true, groupOverflow: true });

  if (!chartItems.length) {
    return buildEmptyVisual();
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
      color: VISUAL_COLORS[index % VISUAL_COLORS.length],
      path: buildDonutPath(100, 100, 84, 58, startAngle, endAngle)
    };
  });

  return buildVisualFrame(`
    <div class="report-donut-wrap">
      <svg class="report-donut-svg" viewBox="0 0 200 200" aria-hidden="true">
        ${slices.map((slice) => `<path d="${slice.path}" fill="${slice.color}"></path>`).join('')}
      </svg>
      <div class="report-donut-center">
        <strong>${escapeHtml(formatInteger(total))}</strong>
        <span>${escapeHtml(centerLabel)}</span>
      </div>
    </div>
  `, 'report-donut');
}

function buildBarsVisual(
  items = [],
  {
    maxItems = 7,
    sortByValue = false,
    groupOverflow = false
  } = {}
) {
  const chartItems = groupVisibleItems(items, { maxItems, sortByValue, groupOverflow });

  if (!chartItems.length) {
    return buildEmptyVisual();
  }

  const maxValue = Math.max(...chartItems.map((item) => Number(item.value || 0)), 1);

  return buildVisualFrame(`
    <div class="report-bars">
      ${chartItems.map((item, index) => `
        <div class="report-bar-row">
          <div class="report-bar-meta">
            <span>${escapeHtml(shortenLabel(item.label, 24))}</span>
            <strong>${escapeHtml(formatInteger(item.value))}</strong>
          </div>
          <div class="report-bar-track">
            <div
              class="report-bar-fill"
              style="width:${Math.max((Number(item.value || 0) / maxValue) * 100, 6)}%; background:${VISUAL_COLORS[index % VISUAL_COLORS.length]}"
            ></div>
          </div>
        </div>
      `).join('')}
    </div>
  `, 'report-bars-shell');
}

function buildTreemapVisual(items = [], { maxItems = 6 } = {}) {
  const visibleItems = groupVisibleItems(items, { maxItems, sortByValue: true, groupOverflow: true }).map((item, index) => ({
    ...item,
    color: VISUAL_COLORS[index % VISUAL_COLORS.length]
  }));

  if (!visibleItems.length) {
    return buildEmptyVisual();
  }

  const tiles = layoutTreemap(visibleItems, 0, 0, 100, 68);

  return buildVisualFrame(`
    <div class="report-treemap-wrap">
      <svg class="report-treemap-svg" viewBox="0 0 100 68" aria-hidden="true">
        ${tiles.map((tile) => {
          const labelFits = tile.width >= 18 && tile.height >= 12;
          const valueFits = tile.width >= 12 && tile.height >= 10;
          const fontSize = tile.width >= 28 && tile.height >= 18 ? 5.2 : 4.2;
          const valueFontSize = tile.width >= 28 && tile.height >= 18 ? 6.2 : 4.8;
          const textColor = getTextColor(tile.color);

          return `
            <g>
              <rect
                x="${tile.x + 0.8}"
                y="${tile.y + 0.8}"
                width="${Math.max(tile.width - 1.6, 0)}"
                height="${Math.max(tile.height - 1.6, 0)}"
                rx="4"
                fill="${tile.color}"
              ></rect>
              ${labelFits ? `
                <text
                  x="${tile.x + 3.4}"
                  y="${tile.y + 6.3}"
                  fill="${textColor}"
                  style="font-size:${fontSize}px"
                >${escapeHtml(shortenLabel(tile.label, tile.width >= 28 ? 18 : 12))}</text>
              ` : ''}
              ${valueFits ? `
                <text
                  x="${tile.x + 3.4}"
                  y="${tile.y + (tile.height >= 18 ? 14.8 : 12.2)}"
                  fill="${textColor}"
                  style="font-size:${valueFontSize}px; font-weight:700"
                >${escapeHtml(formatInteger(tile.value))}</text>
              ` : ''}
            </g>
          `;
        }).join('')}
      </svg>
    </div>
  `, 'report-treemap');
}

function buildSummaryCards(summary = {}) {
  const nhisRegistrations =
    Number(summary?.mainReasonHighlights?.nhis) ||
    Number(
      (summary?.reasons || []).find((item) => String(item.label || '').trim().toLowerCase() === 'nhis')?.value || 0
    );

  const cards = [
    { label: 'Total Registrations', value: formatInteger(summary?.totals?.people) },
    { label: 'NHIS Registrations', value: formatInteger(nhisRegistrations) },
    { label: 'Female', value: formatInteger(
      (summary.gender || []).find((item) => String(item.label).toLowerCase() === 'female')?.value || 0
    ) },
    { label: 'Male', value: formatInteger(
      (summary.gender || []).find((item) => String(item.label).toLowerCase() === 'male')?.value || 0
    ) }
  ];

  return cards.map((item) => `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(item.label)}</div>
      <div class="metric-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');
}

function buildTableRows(items = [], columns = []) {
  if (!items.length) {
    return `<tr><td colspan="${columns.length}" class="empty-cell">No data available.</td></tr>`;
  }

  return items.map((item) => `
    <tr>
      ${columns.map((column) => `<td>${escapeHtml(column.render(item))}</td>`).join('')}
    </tr>
  `).join('');
}

function buildTable(title, items, columns) {
  return `
    <section class="report-section">
      <div class="section-heading">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${buildTableRows(items, columns)}
        </tbody>
      </table>
    </section>
  `;
}

function buildSectionGroup(title, content) {
  const heading = title
    ? `<div class="report-group-title">${escapeHtml(title)}</div>`
    : '';

  return `
    <section class="report-group">
      ${heading}
      ${content}
    </section>
  `;
}

function buildReasonSummary(summary = {}) {
  const reasons = (summary.reasons || []).map((item) => ({
    ...item,
    value: Number(item.value || 0)
  }));
  const total = reasons.reduce((sum, item) => sum + item.value, 0) || 1;

  return buildTable(
    'Main Units',
    reasons,
    [
      { label: 'Unit', render: (item) => item.label || 'Unknown' },
      { label: 'Count', render: (item) => formatInteger(item.value) },
      { label: 'Share', render: (item) => formatPercent((item.value / total) * 100) }
    ]
  );
}

function buildCountShareTable(title, items = [], firstColumnLabel) {
  const normalizedItems = (items || []).map((item) => ({
    ...item,
    value: Number(item.value || 0)
  }));
  const total = normalizedItems.reduce((sum, item) => sum + item.value, 0) || 1;

  return buildTable(
    title,
    normalizedItems,
    [
      { label: firstColumnLabel, render: (item) => item.label || 'Unknown' },
      { label: 'Count', render: (item) => formatInteger(item.value) },
      { label: 'Share', render: (item) => formatPercent((item.value / total) * 100) }
    ]
  );
}

function buildVisualSummary(summary = {}) {
  return buildSectionGroup(
    'Visual Summary',
    `
      <div class="report-grid report-visual-grid">
        ${buildVisualPanel(
          'Gender Breakdown',
          buildDonutVisual(summary.gender || [], { centerLabel: 'People', maxItems: 4 })
        )}

        ${buildVisualPanel(
          'Awareness Sources',
          buildDonutVisual(summary.registrationSources || [], { centerLabel: 'Sources' })
        )}

        ${buildVisualPanel(
          'Age Ranges',
          buildBarsVisual(summary.ageRanges || [], { maxItems: 8, sortByValue: false, groupOverflow: false })
        )}

        ${buildVisualPanel(
          'Main Units',
          buildDonutVisual(summary.reasons || [], { centerLabel: 'Units' })
        )}

        ${buildVisualPanel(
          'Occupations',
          buildTreemapVisual(summary.occupations || [], { maxItems: 6 }),
          'report-section-span'
        )}
      </div>
    `
  );
}

export function openAnalyticsReportPrintView({ summary, year, user, logoUrl }) {
  const title = '\u200B';
  const reportHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            color-scheme: light;
            --text: #142126;
            --muted: #5c6b72;
            --border: #e5ece9;
            --surface: #ffffff;
            --surface-soft: #f7f9f8;
            --accent: #0b8f81;
            --accent-soft: #f1f6f4;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 18px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
            color: var(--text);
            background: #f2f5f3;
            line-height: 1.45;
            font-feature-settings: 'tnum' 1, 'lnum' 1;
          }

          .report-shell {
            max-width: 980px;
            margin: 0 auto;
            background: var(--surface);
            border-radius: 22px;
            padding: 24px 28px 28px;
            box-shadow: 0 12px 30px rgba(20, 33, 38, 0.05);
          }

          .report-brand {
            display: flex;
            align-items: center;
            gap: 16px;
            min-width: 0;
            justify-content: space-between;
            text-align: left;
            padding-bottom: 18px;
            border-bottom: 1px solid #edf2ef;
          }

          .report-brand img {
            width: 112px;
            height: auto;
            flex-shrink: 0;
          }

          .report-brand-copy {
            display: grid;
            gap: 6px;
            align-content: center;
            justify-items: end;
            text-align: right;
            margin-left: auto;
          }

          .report-brand h1 {
            margin: 0;
            font-size: 1.8rem;
            line-height: 1;
            letter-spacing: -0.03em;
          }

          .report-brand p {
            margin: 0;
            color: var(--muted);
            font-size: 0.96rem;
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            margin: 20px 0 24px;
          }

          .metric-card {
            background: var(--surface-soft);
            border-radius: 14px;
            padding: 13px 15px;
          }

          .metric-label {
            color: var(--muted);
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .metric-value {
            margin-top: 6px;
            font-size: 1.42rem;
            font-weight: 800;
            letter-spacing: -0.02em;
          }

          .report-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }

          .report-group + .report-group {
            margin-top: 22px;
          }

          .report-group-title {
            margin: 0 0 12px;
            color: var(--muted);
            font-size: 0.74rem;
            font-weight: 650;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .report-section {
            margin-top: 0;
            break-inside: avoid;
            page-break-inside: avoid;
            background: transparent;
            padding: 0;
          }

          .section-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .section-heading h2 {
            margin: 0;
            font-size: 0.96rem;
            font-weight: 650;
            letter-spacing: -0.02em;
          }

          .report-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 10px;
            background: transparent;
          }

          .report-table th,
          .report-table td {
            padding: 9px 10px;
            border-bottom: 1px solid #edf2ef;
            text-align: left;
            font-size: 0.86rem;
            vertical-align: top;
          }

          .report-table th {
            background: transparent;
            color: var(--muted);
            font-weight: 650;
            border-bottom: 1.5px solid #dbe5e1;
          }

          .report-table th:not(:first-child),
          .report-table td:not(:first-child) {
            text-align: right;
            white-space: nowrap;
          }

          .report-table tbody tr:last-child td {
            border-bottom: none;
          }

          .report-visual {
            margin-top: 0;
            padding: 10px 0 0;
            background: transparent;
          }

          .report-visual-empty {
            color: var(--muted);
            text-align: center;
            font-size: 0.84rem;
            padding: 24px 0;
          }

          .report-visual-grid {
            gap: 18px 20px;
          }

          .report-visual-panel {
            background: #f7f9f8;
            border-radius: 18px;
            padding: 16px 18px 18px;
          }

          .report-section-span {
            grid-column: 1 / -1;
          }

          .report-donut {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 176px;
          }

          .report-donut-wrap {
            position: relative;
            width: 166px;
            height: 166px;
          }

          .report-donut-svg {
            width: 166px;
            height: 166px;
            display: block;
          }

          .report-donut-center {
            position: absolute;
            inset: 0;
            display: grid;
            place-content: center;
            gap: 3px;
            text-align: center;
          }

          .report-donut-center strong {
            font-size: 1.16rem;
            line-height: 1;
            letter-spacing: -0.03em;
          }

          .report-donut-center span {
            color: var(--muted);
            font-size: 0.78rem;
          }

          .report-bars-shell {
            padding: 4px 0 0;
          }

          .report-bars {
            display: grid;
            gap: 10px;
          }

          .report-bar-row {
            display: grid;
            gap: 5px;
          }

          .report-bar-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 0.82rem;
          }

          .report-bar-meta span {
            color: var(--text);
            min-width: 0;
          }

          .report-bar-meta strong {
            white-space: nowrap;
            font-size: 0.82rem;
          }

          .report-bar-track {
            width: 100%;
            height: 8px;
            background: #e8efec;
            border-radius: 999px;
            overflow: hidden;
          }

          .report-bar-fill {
            height: 100%;
            border-radius: inherit;
          }

          .report-treemap-wrap {
            min-height: 204px;
          }

          .report-treemap-svg {
            width: 100%;
            height: auto;
            display: block;
          }

          .report-treemap-svg text {
            font-family: inherit;
            letter-spacing: -0.01em;
          }

          .empty-cell {
            color: var(--muted);
            text-align: center;
            padding: 14px 10px;
          }

          @media print {
            @page {
              margin: 10mm;
            }

            body {
              background: #ffffff;
              padding: 0;
            }

            .report-shell {
              max-width: none;
              border: none;
              border-radius: 0;
              padding: 0;
              box-shadow: none;
            }
          }

          @media (max-width: 860px) {
            .report-grid {
              grid-template-columns: 1fr;
            }

            .report-brand {
              align-items: flex-start;
            }

            .report-brand-copy {
              justify-items: start;
              text-align: left;
              margin-left: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-shell">
          <header class="report-brand">
            <img src="${escapeHtml(logoUrl)}" alt="MEDICAID logo" />
            <div class="report-brand-copy">
              <h1>Report</h1>
            </div>
          </header>

          <section class="metrics-grid">
            ${buildSummaryCards(summary)}
          </section>

          ${buildSectionGroup(
            '',
            `
              <div class="report-grid">
                ${buildTable(
                  'Gender Breakdown',
                  summary.gender || [],
                  [
                    { label: 'Gender', render: (item) => item.label || 'Unknown' },
                    { label: 'Count', render: (item) => formatInteger(item.value) }
                  ]
                )}

                ${buildTable(
                  'Age Ranges',
                  summary.ageRanges || [],
                  [
                    { label: 'Age Range', render: (item) => item.label || 'Unknown' },
                    { label: 'Count', render: (item) => formatInteger(item.value) }
                  ]
                )}
              </div>
            `
          )}

          ${buildSectionGroup(
            'Community Insights',
            `
              <div class="report-grid">
                ${buildCountShareTable(
                  'Awareness Sources',
                  summary.registrationSources || [],
                  'Source'
                )}

                ${buildCountShareTable(
                  'Occupations',
                  summary.occupations || [],
                  'Occupation'
                )}
              </div>
            `
          )}

          ${buildSectionGroup(
            'Service Breakdown',
            buildReasonSummary(summary)
          )}

          ${buildVisualSummary(summary)}
        </div>
      </body>
    </html>
  `;

  const frame = document.createElement('iframe');
  frame.setAttribute('title', ' ');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  if (!frameWindow) {
    document.body.removeChild(frame);
    throw new Error('Unable to prepare the report view.');
  }

  const cleanup = () => {
    window.setTimeout(() => {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    }, 1000);
  };

  frameWindow.document.open();
  frameWindow.document.write(reportHtml);
  frameWindow.document.close();
  frameWindow.document.title = title;

  frame.onload = () => {
    frameWindow.focus();
    frameWindow.print();
    cleanup();
  };
}
