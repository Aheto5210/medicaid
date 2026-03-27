import React from 'react';

export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className={`toast ${toast.type || 'success'}`}
          onClick={() => onDismiss(toast.id)}
          title="Dismiss"
        >
          {toast.text}
        </button>
      ))}
    </div>
  );
}
