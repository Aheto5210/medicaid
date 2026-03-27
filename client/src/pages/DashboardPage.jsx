import React from 'react';
import StatCard from '../components/common/StatCard.jsx';
import RecentList from '../components/dashboard/RecentList.jsx';
import LocationBarChart from '../components/charts/LocationBarChart.jsx';
import GenderPieChart from '../components/charts/GenderPieChart.jsx';
import MainReasonLineChart from '../components/charts/MainReasonLineChart.jsx';

export default function DashboardPage({ summary, recentPeople }) {
  const revealStyle = (delayMs) => ({ '--dash-delay': `${delayMs}ms` });
  const totals = summary?.totals || {};
  const genderItems = summary?.gender || [];
  const femaleCount =
    genderItems.find((item) => item.label?.toLowerCase() === 'female')?.value || 0;
  const maleCount =
    genderItems.find((item) => item.label?.toLowerCase() === 'male')?.value || 0;
  const reasonBuckets = (summary?.reasons || []).reduce((acc, item) => {
    const normalized = String(item.label || '').trim().toLowerCase();
    const count = Number(item.value || 0);

    if (normalized === 'unknown') {
      acc.unknown += count;
    } else if (normalized === 'general screening') {
      acc.generalScreening += count;
    } else if (normalized === 'eye screening') {
      acc.eyeScreening += count;
    } else if (normalized === 'nhis') {
      acc.nhis += count;
    } else {
      acc.other += count;
    }
    return acc;
  }, { generalScreening: 0, eyeScreening: 0, nhis: 0, other: 0, unknown: 0 });
  const focusedReasonItems = [
    { label: 'General Screening', value: reasonBuckets.generalScreening },
    { label: 'Eye Screening', value: reasonBuckets.eyeScreening },
    { label: 'NHIS', value: reasonBuckets.nhis }
  ];
  const ageRangeItems = [...(summary?.ageRanges || [])].sort(
    (a, b) => Number(b.value || 0) - Number(a.value || 0)
  );
  const reasonPieItems = [
    ...focusedReasonItems,
    { label: 'Other', value: reasonBuckets.other }
  ].filter((item) => item.value > 0);

  return (
    <section className="page dashboard-animate">
      <div className="overview-groups">
        <div className="panel dashboard-reveal" style={revealStyle(20)}>
          <div className="panel-header">
            <h2>Registration</h2>
            <span className="badge">Total / Female / Male</span>
          </div>
          <div className="cards group-cards">
            <StatCard label="Total" value={totals.people || 0} />
            <StatCard label="Female" value={femaleCount} />
            <StatCard label="Male" value={maleCount} />
          </div>
        </div>

        <div className="panel dashboard-reveal" style={revealStyle(90)}>
          <div className="panel-header">
            <h2>Units</h2>
            <span className="badge">General / NHIS / Eye</span>
          </div>
          <div className="cards group-cards">
            <StatCard label="General Screening" value={reasonBuckets.generalScreening} />
            <StatCard label="NHIS" value={reasonBuckets.nhis} />
            <StatCard label="Eye Screening" value={reasonBuckets.eyeScreening} />
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="panel dashboard-reveal" style={revealStyle(160)}>
          <div className="panel-header">
            <h2>Units Trend</h2>
            <span className="badge">General / Eye / NHIS</span>
          </div>
          <MainReasonLineChart items={focusedReasonItems} />
        </div>

        <div className="panel dashboard-reveal" style={revealStyle(230)}>
          <div className="panel-header">
            <h2>Main Units</h2>
            <span className="badge">General / Eye / NHIS</span>
          </div>
          <GenderPieChart items={reasonPieItems} centerLabel="Units" />
        </div>
      </div>

      <div className="grid">
        <div className="panel dashboard-reveal" style={revealStyle(300)}>
          <div className="panel-header">
            <h2>Age Range</h2>
            <span className="badge">Standard Ranges</span>
          </div>
          <LocationBarChart items={ageRangeItems} />
        </div>

        <div className="panel dashboard-reveal" style={revealStyle(370)}>
          <div className="panel-header">
            <h2>Gender</h2>
            <span className="badge">Breakdown</span>
          </div>
          <GenderPieChart items={summary?.gender || []} />
        </div>
      </div>

      <div className="panel dashboard-reveal" style={revealStyle(440)}>
        <div className="panel-header">
          <h2>Recently Registered</h2>
          <span className="badge">Last 5</span>
        </div>
        <RecentList items={recentPeople} />
      </div>
    </section>
  );
}
