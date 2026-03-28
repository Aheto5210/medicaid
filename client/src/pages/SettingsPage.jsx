import React, { useMemo, useState } from 'react';
import { apiFetch } from '../api.js';
import { getRoleLabel } from '../utils/roles.js';
import { openAnalyticsReportPrintView } from '../utils/analyticsReport.js';

export default function SettingsPage({
  user,
  resolvedTheme = 'light',
  canExportAnalytics = false,
  defaultReportYear,
  yearOptions = []
}) {
  const fallbackYear = new Date().getFullYear();
  const availableYears = useMemo(
    () => (yearOptions.length ? yearOptions : Array.from({ length: 5 }, (_, index) => fallbackYear - index)),
    [fallbackYear, yearOptions]
  );
  const [reportYear, setReportYear] = useState(defaultReportYear || availableYears[0] || fallbackYear);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState('');

  async function handleGenerateReport() {
    setReporting(true);
    setReportError('');

    try {
      const res = await apiFetch(`/api/analytics/summary?year=${reportYear}`);
      if (!res.ok) {
        let nextError = 'Unable to prepare the analytics report right now.';

        try {
          const data = await res.json();
          if (data?.error) {
            nextError = data.error;
          }
        } catch {
          // Ignore invalid error payloads and use the fallback message.
        }

        throw new Error(nextError);
      }

      const summary = await res.json();
      const logoUrl = new URL('/assets/images/MEDICAID-BLACK.png?v=20260325', window.location.origin).toString();

      openAnalyticsReportPrintView({
        summary,
        year: reportYear,
        user: {
          ...user,
          role: getRoleLabel(user.role)
        },
        logoUrl
      });
    } catch (error) {
      setReportError(error.message || 'Unable to prepare the analytics report right now.');
    } finally {
      setReporting(false);
    }
  }

  return (
    <section className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Settings</h2>
          <span className="badge">Account</span>
        </div>

        <div className="settings-grid">
          <div>
            <div className="label">Signed in as</div>
            <div className="value">{user.full_name} ({user.email})</div>
          </div>
          <div>
            <div className="label">Role</div>
            <div className="value">{getRoleLabel(user.role)}</div>
          </div>
          <div>
            <div className="label">Program</div>
            <div className="value">MEDICAID</div>
          </div>
          <div>
            <div className="label">Theme</div>
            <div className="value">System Default</div>
            <div className="label theme-note">
              Follows device theme automatically. Active: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Medicaid Report</h2>
          <span className="badge">PDF</span>
        </div>

        {canExportAnalytics ? (
          <div className="settings-report">
            <div className="settings-report-controls">
              <div className="year-select settings-report-year">
                <select
                  aria-label="Report year"
                  value={reportYear}
                  onChange={(event) => setReportYear(Number(event.target.value))}
                  disabled={reporting}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <button className="primary" type="button" onClick={handleGenerateReport} disabled={reporting}>
                {reporting ? 'Preparing Report...' : 'Generate Medicaid PDF'}
              </button>
            </div>

            <div className="label theme-note settings-report-note">
              Opens a clean MEDICAID report with the logo, selected year, and all major overview
              sections. Use the print dialog to save it as PDF.
            </div>

            {reportError && <div className="error">{reportError}</div>}
          </div>
        ) : (
          <div className="label settings-report-note">
            Analytics export is available for accounts that can access the dashboard overview.
          </div>
        )}
      </div>
    </section>
  );
}
