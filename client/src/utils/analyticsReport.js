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
            --border: #dbe3e0;
            --surface: #ffffff;
            --surface-soft: #f5f8f7;
            --accent: #0b8f81;
            --accent-soft: #e8f6f4;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 28px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
            color: var(--text);
            background: #f3f5f4;
          }

          .report-shell {
            max-width: 1040px;
            margin: 0 auto;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 28px 28px 32px;
          }

          .report-brand {
            display: flex;
            align-items: center;
            gap: 20px;
            min-width: 0;
            justify-content: space-between;
            text-align: left;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
          }

          .report-brand img {
            width: 124px;
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
            font-size: 2.1rem;
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
            margin: 24px 0;
          }

          .metric-card {
            background: var(--surface-soft);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 14px 16px;
          }

          .metric-label {
            color: var(--muted);
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .metric-value {
            margin-top: 10px;
            font-size: 1.6rem;
            font-weight: 800;
            letter-spacing: -0.02em;
          }

          .report-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }

          .report-group + .report-group {
            margin-top: 22px;
          }

          .report-group-title {
            margin: 0 0 12px;
            color: var(--muted);
            font-size: 0.76rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .report-section {
            margin-top: 0;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .section-heading h2 {
            margin: 0;
            font-size: 1.05rem;
          }

          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            border: 1px solid var(--border);
            border-radius: 14px;
            overflow: hidden;
          }

          .report-table th,
          .report-table td {
            padding: 11px 12px;
            border-bottom: 1px solid var(--border);
            text-align: left;
            font-size: 0.92rem;
          }

          .report-table th {
            background: var(--accent-soft);
            color: var(--text);
            font-weight: 700;
          }

          .report-table tbody tr:nth-child(even) {
            background: #fbfcfb;
          }

          .report-table tbody tr:last-child td {
            border-bottom: none;
          }

          .empty-cell {
            color: var(--muted);
            text-align: center;
          }

          @media print {
            @page {
              margin: 12mm;
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
