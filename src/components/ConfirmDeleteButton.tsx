import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  onConfirm: () => Promise<void> | void;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
}

export const ConfirmDeleteButton: React.FC<Props> = ({
  onConfirm,
  label = 'Delete',
  compact = false,
  disabled = false,
  title = 'Delete record',
}) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 5000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  if (confirming) {
    return (
      <span className="no-print inline-flex items-center gap-1 whitespace-nowrap">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setConfirming(false);
            }
          }}
          className="px-2 py-1 text-[11px] font-semibold text-white bg-red-700 hover:bg-red-800 rounded disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? 'Deleting...' : 'Confirm Delete'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className="px-2 py-1 text-[11px] font-medium text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 rounded whitespace-nowrap"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={() => setConfirming(true)}
      className={`no-print inline-flex items-center gap-1 font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded disabled:opacity-40 whitespace-nowrap ${
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Trash2 className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
};
