'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadFile } from '@/lib/api';

export default function ExportButtons() {
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);

  async function handleExport(kind: 'pdf' | 'excel') {
    setBusy(kind);
    try {
      const ext = kind === 'pdf' ? 'pdf' : 'xlsx';
      await downloadFile(`/api/export/${kind}?hours=24`, `water_report.${ext}`);
      toast.success(`${kind.toUpperCase()} report downloaded.`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport('pdf')}
        disabled={busy !== null}
        className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-signal-cyan hover:text-signal-cyan disabled:opacity-50"
      >
        {busy === 'pdf' ? 'Generating…' : 'Export PDF'}
      </button>
      <button
        onClick={() => handleExport('excel')}
        disabled={busy !== null}
        className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-signal-cyan hover:text-signal-cyan disabled:opacity-50"
      >
        {busy === 'excel' ? 'Generating…' : 'Export Excel'}
      </button>
    </div>
  );
}
