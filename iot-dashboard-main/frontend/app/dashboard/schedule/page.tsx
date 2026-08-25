'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';
import Link from 'next/link';

interface Schedule {
  id: number;
  ward_number: number;
  start_time: string;
  end_time: string;
  days_mask: string;
  quota_ml: number;
  is_active: boolean;
  created_by_name: string;
}

export default function SchedulePage() {
  const { isOperator } = useAuth();
  const { status, connected } = useLiveSocket();

   const hardwareOnline =
    status?.deviceOnline === true ||
    status?.device_online === true;
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState({ wardNumber: 1, startTime: '06:00', endTime: '07:00', quotaMl: 1500 });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await apiGet('/api/schedule');
      setSchedules(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load schedules.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost('/api/schedule', form);
      toast.success('Schedule created.');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create schedule.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Schedule) {
    try {
      await apiPatch(`/api/schedule/${s.id}`, { isActive: !s.is_active });
      load();
    } catch (err: any) {
      toast.error(err.message || 'Update failed.');
    }
  }

  async function remove(id: number) {
    try {
      await apiDelete(`/api/schedule/${id}`);
      toast.success('Schedule removed.');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed.');
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
              connected={connected}
              hardwareOnline={hardwareOnline}
/>
        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
         <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-white">Distribution Schedule</h2>
              <p className="gauge-label mt-1">Time-based ward valve automation</p>
            </div>
            <Link href="/dashboard" className="text-sm text-signal-cyan hover:underline">
              ← Back to dashboard
            </Link>
          </div>

          {isOperator && (
            <form onSubmit={createSchedule} className="panel-card mb-8 grid grid-cols-2 gap-4 p-6 md:grid-cols-5">
              <div>
                <label className="gauge-label mb-1 block">Ward</label>
                <select
                  value={form.wardNumber}
                  onChange={(e) => setForm({ ...form, wardNumber: Number(e.target.value) })}
                  className="w-full rounded-lg border border-panel-border bg-black/30 px-3 py-2 text-sm text-white"
                >
                  <option value={1}>Ward 1</option>
                  <option value={2}>Ward 2</option>
                  <option value={3}>Ward 3</option>
                </select>
              </div>
              <div>
                <label className="gauge-label mb-1 block">Start</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-lg border border-panel-border bg-black/30 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="gauge-label mb-1 block">End</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full rounded-lg border border-panel-border bg-black/30 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="gauge-label mb-1 block">Quota (mL)</label>
                <input type="number" value={form.quotaMl} onChange={(e) => setForm({ ...form, quotaMl: Number(e.target.value) })} className="w-full rounded-lg border border-panel-border bg-black/30 px-3 py-2 text-sm text-white" />
              </div>
              <div className="flex items-end">
                <button disabled={saving} className="w-full rounded-lg bg-signal-cyan py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add Schedule'}
                </button>
              </div>
            </form>
          )}

          <div className="panel-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-panel-border text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Ward</th>
                  <th className="px-4 py-3 font-medium">Window</th>
                  <th className="px-4 py-3 font-medium">Quota</th>
                  <th className="px-4 py-3 font-medium">Created By</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {isOperator && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-panel-border/50 text-slate-200">
                    <td className="px-4 py-3">Ward {s.ward_number}</td>
                    <td className="px-4 py-3 font-mono">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 font-mono">{s.quota_ml.toLocaleString()} mL</td>
                    <td className="px-4 py-3">{s.created_by_name}</td>
                    <td className="px-4 py-3">
                      <span className={`gauge-label rounded px-2 py-0.5 ${s.is_active ? 'bg-signal-cyan/20 text-signal-cyan' : 'bg-signal-steel/20 text-signal-steel'}`}>
                        {s.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    {isOperator && (
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(s)} className="mr-3 text-xs text-signal-blue hover:underline">
                          {s.is_active ? 'Pause' : 'Resume'}
                        </button>
                        <button onClick={() => remove(s.id)} className="text-xs text-signal-red hover:underline">
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {schedules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No schedules configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
