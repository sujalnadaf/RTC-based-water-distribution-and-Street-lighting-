'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function StreetLightCard({ isOn }: { isOn: boolean }) {
  const { isOperator } = useAuth();
  const [busy, setBusy] = useState(false);

  async function setMode(mode: 'on' | 'off' | 'auto') {
    setBusy(true);
    try {
      await apiPost('/api/device/light', { mode });
      toast.success(`Street light set to ${mode.toUpperCase()}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update street light.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="gauge-label">Street Light</span>
        <span className={`h-2.5 w-2.5 rounded-full ${isOn ? 'bg-signal-amber shadow-[0_0_10px_2px_rgba(245,166,35,0.7)]' : 'bg-signal-steel'}`} />
      </div>

      <div className="mb-5 flex items-center gap-3">
        <LightBulbIcon lit={isOn} />
        <div>
          <p className="font-mono text-lg font-semibold text-white">{isOn ? 'ON' : 'OFF'}</p>
          <p className="text-xs text-slate-500">Auto mode: LDR + 00:00–05:00 power-save window</p>
        </div>
      </div>

      {isOperator ? (
        <div className="grid grid-cols-3 gap-2">
          <button disabled={busy} onClick={() => setMode('on')} className="rounded-lg border border-panel-border py-2 text-xs font-medium text-slate-200 transition hover:border-signal-amber hover:text-signal-amber disabled:opacity-50">
            Force ON
          </button>
          <button disabled={busy} onClick={() => setMode('off')} className="rounded-lg border border-panel-border py-2 text-xs font-medium text-slate-200 transition hover:border-signal-steel disabled:opacity-50">
            Force OFF
          </button>
          <button disabled={busy} onClick={() => setMode('auto')} className="rounded-lg border border-panel-border py-2 text-xs font-medium text-slate-200 transition hover:border-signal-cyan hover:text-signal-cyan disabled:opacity-50">
            Auto
          </button>
        </div>
      ) : (
        <p className="rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-500">Read-only view. Operator role required to control lighting.</p>
      )}
    </div>
  );
}

function LightBulbIcon({ lit }: { lit: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={lit ? '#F5A623' : '#3B4A66'} strokeWidth="1.7">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.5.4.6 1 .6 1.6V16h6v-.6c0-.6.1-1.2.6-1.6A6 6 0 0012 3z" />
    </svg>
  );
}
