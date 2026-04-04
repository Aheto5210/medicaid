import React from 'react';

export default function Pagination({ page = 1, pageSize = 50, total = 0, totalPages = 0, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {start}–{end} of {total}
      </span>
      <div className="pagination-controls">
        <button
          className="ghost pagination-btn"
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="pagination-pages">
          Page {page} of {totalPages}
        </span>
        <button
          className="ghost pagination-btn"
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
