'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Ward {
  ward_number: number;
  ward_name: string;
}

export default function ValveControl({ wards, activeWard }: { wards: Ward[]; activeWard: number }) {
  const { isOperator } = useAuth();
  const [busyWard, setBusyWard] = useState<number | null>(null);

  async function toggleValve(wardNumber: number, state: boolean) {
    setBusyWard(wardNumber);
    try {
      await apiPost('/api/device/valve', { ward: wardNumber, state });
      toast.success(`Ward ${wardNumber} valve ${state ? 'opened' : 'closed'}.`);
    } catch (err: any) {
      toast.error(err.message || 'Valve command failed.');
    } finally {
      setBusyWard(null);
    }
  }

  async function refill() {
    setBusyWard(-1);
    try {
      await apiPost('/api/device/refill', {});
      toast.success('Tank refilled to full capacity.');
    } catch (err: any) {
      toast.error(err.message || 'Refill command failed.');
    } finally {
      setBusyWard(null);
    }
  }

  if (!isOperator) {
    return (
      <div className="panel-card p-6">
        <span className="gauge-label">Valve Control</span>
        <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-500">
          Read-only view. Sign in as an operator to control valves and refill the tank.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="gauge-label">Valve Control</span>
        <span className="gauge-label rounded bg-signal-blue/20 px-2 py-0.5 text-signal-blue">Operator</span>
      </div>

      <div className="space-y-3">
        {wards.map((ward) => {
          const isOpen = activeWard === ward.ward_number;
          return (
            <div key={ward.ward_number} className="flex items-center justify-between rounded-lg border border-panel-border px-4 py-3">
              <span className="text-sm text-slate-200">{ward.ward_name}</span>
              <div className="flex gap-2">
                <button
                  disabled={busyWard === ward.ward_number}
                  onClick={() => toggleValve(ward.ward_number, true)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    isOpen ? 'bg-signal-cyan text-black' : 'border border-panel-border text-slate-300 hover:border-signal-cyan'
                  } disabled:opacity-50`}
                >
                  Open
                </button>
                <button
                  disabled={busyWard === ward.ward_number}
                  onClick={() => toggleValve(ward.ward_number, false)}
                  className="rounded-md border border-panel-border px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-signal-red hover:text-signal-red disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        disabled={busyWard === -1}
        onClick={refill}
        className="mt-4 w-full rounded-lg bg-signal-blue py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {busyWard === -1 ? 'Refilling…' : 'Refill Tank'}
      </button>
    </div>
  );
}
