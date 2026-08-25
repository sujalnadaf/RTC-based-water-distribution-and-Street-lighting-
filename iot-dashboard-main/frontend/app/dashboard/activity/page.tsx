'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

import { apiGet } from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';

type CategoryFilter =
  | 'all'
  | 'authentication'
  | 'water'
  | 'lighting'
  | 'schedule'
  | 'user'
  | 'device'
  | 'report'
  | 'system';

type SeverityFilter =
  | 'all'
  | 'info'
  | 'success'
  | 'warning'
  | 'critical';

type DateFilter = 'today' | '7days' | '30days';

interface ActivityLog {
  id: number;
  device_id?: number | null;
  user_id?: number | null;
  actor_name?: string | null;
  actor_role?: string | null;
  action_type: string;
  category: string;
  description: string;
  severity: string;
  result: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
  ip_address?: string | null;
  created_at: string;
}

export default function ActivityPage() {
  const { status, connected } = useLiveSocket();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [category, setCategory] =
    useState<CategoryFilter>('all');
  const [severity, setSeverity] =
    useState<SeverityFilter>('all');
  const [dateFilter, setDateFilter] =
    useState<DateFilter>('30days');

  const hardwareOnline =
    status?.deviceOnline === true ||
    status?.device_online === true;

  const requestedDays =
    dateFilter === 'today'
      ? 1
      : dateFilter === '7days'
        ? 7
        : 30;

  async function loadLogs(showError = true) {
    try {
      const params = new URLSearchParams();

      params.set('days', String(requestedDays));
      params.set('limit', '500');

      if (category !== 'all') {
        params.set('category', category);
      }

      if (severity !== 'all') {
        params.set('severity', severity);
      }

      const data = await apiGet(
        `/api/activity?${params.toString()}`
      );

      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      if (showError) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to load activity logs.',
          {
            id: 'activity-load-error',
          }
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadLogs();

    const interval = window.setInterval(
      () => loadLogs(false),
      30000
    );

    return () => window.clearInterval(interval);
  }, [category, severity, requestedDays]);

  const filteredLogs = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return logs;

    return logs.filter((log) => {
      const searchable = [
        log.actor_name,
        log.actor_role,
        log.action_type,
        log.category,
        log.description,
        log.result,
        log.target_type,
        log.target_id,
        log.ip_address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(value);
    });
  }, [logs, search]);

  const summary = useMemo(() => {
    return {
      total: logs.length,
      successful: logs.filter(
        (log) => log.result === 'success'
      ).length,
      failed: logs.filter(
        (log) => log.result === 'failed'
      ).length,
      warnings: logs.filter(
        (log) => log.severity === 'warning'
      ).length,
      critical: logs.filter(
        (log) => log.severity === 'critical'
      ).length,
    };
  }, [logs]);

  function exportCsv() {
    if (filteredLogs.length === 0) {
      toast.error('There are no activity logs to export.');
      return;
    }

    const headers = [
      'Time',
      'Actor',
      'Role',
      'Category',
      'Action',
      'Description',
      'Severity',
      'Result',
      'Target',
      'IP Address',
    ];

    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toLocaleString(),
      log.actor_name || 'System',
      log.actor_role || 'system',
      log.category,
      log.action_type,
      log.description,
      log.severity,
      log.result,
      [log.target_type, log.target_id]
        .filter(Boolean)
        .join(': '),
      log.ip_address || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => csvValue(String(cell ?? '')))
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `iot-activity-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    toast.success('Activity log exported.');
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
            <ActivityHeader
              connected={connected}
              hardwareOnline={hardwareOnline}
              onExport={exportCsv}
            />

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Total Events"
                value={summary.total}
                subtitle="Selected period"
                icon="📋"
                tone="blue"
              />

              <MetricCard
                title="Successful"
                value={summary.successful}
                subtitle="Completed actions"
                icon="✅"
                tone="green"
              />

              <MetricCard
                title="Failed"
                value={summary.failed}
                subtitle="Failed operations"
                icon="❌"
                tone="red"
              />

              <MetricCard
                title="Warnings"
                value={summary.warnings}
                subtitle="Attention required"
                icon="⚠️"
                tone="amber"
              />

              <MetricCard
                title="Critical"
                value={summary.critical}
                subtitle="Urgent events"
                icon="🚨"
                tone="red"
              />
            </section>

            <section className="mt-6 rounded-2xl border border-panel-border bg-panel/65 p-5 backdrop-blur-xl">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    System Audit Trail
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Authentication, water, lighting, scheduling
                    and administrative activity
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search activities..."
                    className="rounded-xl border border-panel-border bg-black/15 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
                  />

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value as CategoryFilter
                      )
                    }
                    className="rounded-xl border border-panel-border bg-[#0b1524] px-4 py-2.5 text-sm text-white"
                  >
                    <option value="all">
                      All categories
                    </option>
                    <option value="authentication">
                      Authentication
                    </option>
                    <option value="water">Water</option>
                    <option value="lighting">
                      Lighting
                    </option>
                    <option value="schedule">
                      Schedules
                    </option>
                    <option value="user">
                      User management
                    </option>
                    <option value="device">
                      Devices
                    </option>
                    <option value="report">
                      Reports
                    </option>
                    <option value="system">
                      System
                    </option>
                  </select>

                  <select
                    value={severity}
                    onChange={(event) =>
                      setSeverity(
                        event.target.value as SeverityFilter
                      )
                    }
                    className="rounded-xl border border-panel-border bg-[#0b1524] px-4 py-2.5 text-sm text-white"
                  >
                    <option value="all">
                      All severities
                    </option>
                    <option value="success">
                      Success
                    </option>
                    <option value="info">
                      Information
                    </option>
                    <option value="warning">
                      Warning
                    </option>
                    <option value="critical">
                      Critical
                    </option>
                  </select>

                  <select
                    value={dateFilter}
                    onChange={(event) =>
                      setDateFilter(
                        event.target.value as DateFilter
                      )
                    }
                    className="rounded-xl border border-panel-border bg-[#0b1524] px-4 py-2.5 text-sm text-white"
                  >
                    <option value="today">Today</option>
                    <option value="7days">
                      Last 7 days
                    </option>
                    <option value="30days">
                      Last 30 days
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                {loading ? (
                  <LoadingState />
                ) : filteredLogs.length > 0 ? (
                  <ActivityTable logs={filteredLogs} />
                ) : (
                  <EmptyState />
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function ActivityHeader({
  connected,
  hardwareOnline,
  onExport,
}: {
  connected: boolean;
  hardwareOnline: boolean;
  onExport: () => void;
}) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusBadge
              text={
                connected
                  ? 'Cloud connected'
                  : 'Cloud reconnecting'
              }
              type={connected ? 'success' : 'warning'}
            />

            <StatusBadge
              text={
                hardwareOnline
                  ? 'ESP32 online'
                  : 'ESP32 offline'
              }
              type={
                hardwareOnline ? 'success' : 'danger'
              }
            />

            <StatusBadge
              text="Audit trail"
              type="neutral"
            />
          </div>

          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Activity Logs
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Review user actions, device events, failed commands
            and important system changes.
          </p>
        </div>

        <button
          type="button"
          onClick={onExport}
          className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Export CSV
        </button>
      </div>
    </section>
  );
}

function ActivityTable({
  logs,
}: {
  logs: ActivityLog[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead>
          <tr className="border-b border-panel-border text-xs text-slate-500">
            <th className="px-3 py-3 font-medium">
              Time
            </th>
            <th className="px-3 py-3 font-medium">
              Actor
            </th>
            <th className="px-3 py-3 font-medium">
              Category
            </th>
            <th className="px-3 py-3 font-medium">
              Activity
            </th>
            <th className="px-3 py-3 font-medium">
              Description
            </th>
            <th className="px-3 py-3 font-medium">
              Severity
            </th>
            <th className="px-3 py-3 font-medium">
              Result
            </th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-panel-border/50 align-top text-slate-300"
            >
              <td className="whitespace-nowrap px-3 py-4 text-xs">
                {formatDate(log.created_at)}
              </td>

              <td className="px-3 py-4">
                <p className="font-medium text-white">
                  {log.actor_name || 'System'}
                </p>
                <p className="mt-1 text-[10px] capitalize text-slate-600">
                  {log.actor_role || 'system'}
                </p>
              </td>

              <td className="px-3 py-4">
                <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] capitalize text-slate-400">
                  {log.category}
                </span>
              </td>

              <td className="px-3 py-4">
                <p className="text-xs font-semibold text-slate-200">
                  {formatAction(log.action_type)}
                </p>

                {(log.target_type ||
                  log.target_id) && (
                  <p className="mt-1 text-[10px] text-slate-600">
                    {[log.target_type, log.target_id]
                      .filter(Boolean)
                      .join(': ')}
                  </p>
                )}
              </td>

              <td className="max-w-[360px] px-3 py-4 text-xs leading-5 text-slate-400">
                {log.description}
              </td>

              <td className="px-3 py-4">
                <StatusBadge
                  text={log.severity}
                  type={severityBadge(log.severity)}
                />
              </td>

              <td className="px-3 py-4">
                <StatusBadge
                  text={log.result}
                  type={
                    log.result === 'success'
                      ? 'success'
                      : 'danger'
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  tone: 'blue' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    blue: 'bg-blue-400/10 text-blue-300',
    green: 'bg-emerald-400/10 text-emerald-300',
    amber: 'bg-amber-400/10 text-amber-300',
    red: 'bg-red-400/10 text-red-300',
  };

  return (
    <article className="rounded-2xl border border-panel-border bg-panel/65 p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${tones[tone]}`}
      >
        {icon}
      </div>

      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>

      <p className="mt-2 font-mono text-3xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
      </p>
    </article>
  );
}

function StatusBadge({
  text,
  type,
}: {
  text: string;
  type:
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral';
}) {
  const styles = {
    success:
      'border-emerald-400/20 bg-emerald-400/5 text-emerald-300',
    warning:
      'border-amber-400/20 bg-amber-400/5 text-amber-300',
    danger:
      'border-red-400/20 bg-red-400/5 text-red-300',
    neutral:
      'border-white/10 bg-white/5 text-slate-400',
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${styles[type]}`}
    >
      {text}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-20 rounded-xl border border-panel-border bg-black/10"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-panel-border bg-black/10 px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-300">
        No activity logs found
      </p>

      <p className="mt-2 text-sm text-slate-500">
        New login, valve, lighting and administrative actions
        will appear here.
      </p>
    </div>
  );
}

function formatAction(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function severityBadge(
  severity: string
):
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral' {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  if (severity === 'success') return 'success';

  return 'neutral';
}

function csvValue(value: string) {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}