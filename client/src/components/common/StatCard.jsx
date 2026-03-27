import React from 'react';

export default function StatCard({ label, value, hint, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span>{label}</span>
        {trend ? <span className="trend">{trend}</span> : null}
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}
