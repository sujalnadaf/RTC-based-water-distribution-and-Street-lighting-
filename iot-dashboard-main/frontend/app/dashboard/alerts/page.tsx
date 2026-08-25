'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

import { apiGet } from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';

type SeverityFilter =
  | 'all'
  | 'critical'
  | 'warning'
  | 'info'
  | 'resolved';

interface AlertRecord {
  id: number;

  alert_type?: string;
  type?: string;

  severity?: string;
  message?: string;

  is_resolved?: boolean;
  resolved?: boolean;

  created_at?: string;
  resolved_at?: string;

  ward_number?: number;
  ward?: number;

  source?: string;
}

interface DeviceStatus {
  deviceOnline?: boolean;
  device_online?: boolean;

  leakDetected?: boolean;
  leak_detected?: boolean;

  dryTank?: boolean;
  dry_tank?: boolean;
}

export default function AlertsPage() {
  const { status, connected } = useLiveSocket();

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadAlerts() {
      setLoading(true);

      try {
        const data = await apiGet('/api/device/alerts');

        if (!mounted) return;

        setAlerts(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!mounted) return;

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load alerts.';

        toast.error(message, {
          id: 'alerts-load-error',
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAlerts();

    const interval = window.setInterval(loadAlerts, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const live = status as DeviceStatus | null;

  const hardwareOnline =
    live?.deviceOnline === true ||
    live?.device_online === true;

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return alerts.filter((alert) => {
      const resolved =
        alert.is_resolved === true ||
        alert.resolved === true;

      const severity = normalizeSeverity(
        alert.severity,
        resolved
      );

      const matchesSeverity =
        severityFilter === 'all' ||
        severity === severityFilter;

      const searchableText = [
        alert.alert_type,
        alert.type,
        alert.message,
        alert.source,
        alert.ward_number,
        alert.ward,
      ]
        .filter((value) => value !== undefined)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText.includes(normalizedSearch);

      return matchesSeverity && matchesSearch;
    });
  }, [alerts, search, severityFilter]);

  const summary = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let info = 0;
    let resolved = 0;

    alerts.forEach((alert) => {
      const isResolved =
        alert.is_resolved === true ||
        alert.resolved === true;

      const severity = normalizeSeverity(
        alert.severity,
        isResolved
      );

      if (severity === 'critical') critical += 1;
      if (severity === 'warning') warning += 1;
      if (severity === 'info') info += 1;
      if (severity === 'resolved') resolved += 1;
    });

    return {
      total: alerts.length,
      critical,
      warning,
      info,
      resolved,
      unresolved: alerts.length - resolved,
    };
  }, [alerts]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
          connected={connected}
          hardwareOnline={hardwareOnline}
        />

        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <AlertsHeader
              connected={connected}
              hardwareOnline={hardwareOnline}
              unresolved={summary.unresolved}
            />

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <AlertMetric
                title="Total Alerts"
                value={summary.total}
                subtitle="All recorded events"
                tone="blue"
                icon="🔔"
              />

              <AlertMetric
                title="Critical"
                value={summary.critical}
                subtitle="Needs attention"
                tone="red"
                icon="🚨"
              />

              <AlertMetric
                title="Warnings"
                value={summary.warning}
                subtitle="Potential problems"
                tone="amber"
                icon="⚠️"
              />

              <AlertMetric
                title="Information"
                value={summary.info}
                subtitle="System notifications"
                tone="cyan"
                icon="ℹ️"
              />

              <AlertMetric
                title="Resolved"
                value={summary.resolved}
                subtitle="Closed events"
                tone="green"
                icon="✅"
              />
            </section>

            <LiveSafetyStatus
              leakDetected={
                live?.leakDetected === true ||
                live?.leak_detected === true
              }
              dryTank={
                live?.dryTank === true ||
                live?.dry_tank === true
              }
              hardwareOnline={hardwareOnline}
            />

            <section className="mt-6 rounded-2xl border border-panel-border bg-panel/65 p-5 backdrop-blur-xl">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Alert History
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Search and filter recorded system events
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search alerts..."
                    className="min-w-[220px] rounded-xl border border-panel-border bg-black/15 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40"
                  />

                  <div className="flex flex-wrap rounded-xl border border-panel-border bg-black/10 p-1">
                    <FilterButton
                      active={severityFilter === 'all'}
                      onClick={() =>
                        setSeverityFilter('all')
                      }
                    >
                      All
                    </FilterButton>

                    <FilterButton
                      active={
                        severityFilter === 'critical'
                      }
                      onClick={() =>
                        setSeverityFilter('critical')
                      }
                    >
                      Critical
                    </FilterButton>

                    <FilterButton
                      active={
                        severityFilter === 'warning'
                      }
                      onClick={() =>
                        setSeverityFilter('warning')
                      }
                    >
                      Warning
                    </FilterButton>

                    <FilterButton
                      active={severityFilter === 'info'}
                      onClick={() =>
                        setSeverityFilter('info')
                      }
                    >
                      Info
                    </FilterButton>

                    <FilterButton
                      active={
                        severityFilter === 'resolved'
                      }
                      onClick={() =>
                        setSeverityFilter('resolved')
                      }
                    >
                      Resolved
                    </FilterButton>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                {loading ? (
                  <AlertsLoadingState />
                ) : filteredAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {filteredAlerts.map((alert) => (
                      <AlertItem
                        key={alert.id}
                        alert={alert}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyAlerts
                    filtered={
                      search.length > 0 ||
                      severityFilter !== 'all'
                    }
                  />
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function AlertsHeader({
  connected,
  hardwareOnline,
  unresolved,
}: {
  connected: boolean;
  hardwareOnline: boolean;
  unresolved: number;
}) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
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
              text={`${unresolved} unresolved`}
              type={
                unresolved > 0 ? 'warning' : 'success'
              }
            />
          </div>

          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Alerts Centre
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Monitor leakage, dry-tank, hardware, scheduling and
            street-light events from one place.
          </p>
        </div>

        <div className="rounded-2xl border border-panel-border bg-black/10 px-5 py-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Current status
          </p>

          <p
            className={`mt-1 text-lg font-semibold ${
              unresolved > 0
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {unresolved > 0
              ? `${unresolved} alerts need review`
              : 'No unresolved alerts'}
          </p>
        </div>
      </div>
    </section>
  );
}

function LiveSafetyStatus({
  leakDetected,
  dryTank,
  hardwareOnline,
}: {
  leakDetected: boolean;
  dryTank: boolean;
  hardwareOnline: boolean;
}) {
  const safetyItems = [
    {
      title: 'Leak Detection',
      healthy: !leakDetected,
      healthyText: 'No leak detected',
      unhealthyText: 'Leak detected',
      icon: '💧',
    },
    {
      title: 'Dry-Tank Protection',
      healthy: !dryTank,
      healthyText: 'Tank condition normal',
      unhealthyText: 'Dry tank detected',
      icon: '🛢️',
    },
    {
      title: 'ESP32 Hardware',
      healthy: hardwareOnline,
      healthyText: 'Hardware online',
      unhealthyText: 'Hardware offline',
      icon: '📡',
    },
  ];

  return (
    <section className="mt-6 grid gap-4 md:grid-cols-3">
      {safetyItems.map((item) => (
        <article
          key={item.title}
          className={`rounded-2xl border p-5 ${
            item.healthy
              ? 'border-emerald-400/15 bg-emerald-400/5'
              : 'border-red-400/20 bg-red-400/5'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <span className="text-2xl">{item.icon}</span>

            <span
              className={`h-2.5 w-2.5 rounded-full ${
                item.healthy
                  ? 'bg-emerald-400'
                  : 'animate-pulse bg-red-400'
              }`}
            />
          </div>

          <p className="mt-4 text-sm font-semibold text-white">
            {item.title}
          </p>

          <p
            className={`mt-2 text-xs ${
              item.healthy
                ? 'text-emerald-300'
                : 'text-red-300'
            }`}
          >
            {item.healthy
              ? item.healthyText
              : item.unhealthyText}
          </p>
        </article>
      ))}
    </section>
  );
}

function AlertMetric({
  title,
  value,
  subtitle,
  tone,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  tone: 'blue' | 'red' | 'amber' | 'cyan' | 'green';
  icon: string;
}) {
  const tones = {
    blue: 'bg-blue-400/10 text-blue-300',
    red: 'bg-red-400/10 text-red-300',
    amber: 'bg-amber-400/10 text-amber-300',
    cyan: 'bg-cyan-400/10 text-cyan-300',
    green: 'bg-emerald-400/10 text-emerald-300',
  };

  return (
    <article className="rounded-2xl border border-panel-border bg-panel/65 p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/20">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${tones[tone]}`}
      >
        {icon}
      </div>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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

function AlertItem({ alert }: { alert: AlertRecord }) {
  const resolved =
    alert.is_resolved === true ||
    alert.resolved === true;

  const severity = normalizeSeverity(
    alert.severity,
    resolved
  );

  const tone = alertTone(severity);

  return (
    <article
      className={`rounded-2xl border p-4 sm:p-5 ${tone.container}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${tone.icon}`}
          >
            {alertIcon(alert)}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                {formatAlertTitle(alert)}
              </h3>

              <StatusBadge
                text={severity}
                type={badgeType(severity)}
              />
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {alert.message ||
                'System event recorded.'}
            </p>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-slate-600">
              <span>
                Time:{' '}
                {alert.created_at
                  ? new Date(
                      alert.created_at
                    ).toLocaleString()
                  : 'Unavailable'}
              </span>

              {(alert.ward_number || alert.ward) && (
                <span>
                  Ward:{' '}
                  {alert.ward_number ?? alert.ward}
                </span>
              )}

              {alert.source && (
                <span>Source: {alert.source}</span>
              )}
            </div>
          </div>
        </div>

        <span
          className={`whitespace-nowrap text-xs font-semibold ${
            resolved
              ? 'text-emerald-300'
              : 'text-amber-300'
          }`}
        >
          {resolved ? 'Resolved' : 'Open'}
        </span>
      </div>
    </article>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active
          ? 'bg-cyan-400 text-slate-950'
          : 'text-slate-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  text,
  type,
}: {
  text: string;
  type: 'success' | 'warning' | 'danger' | 'neutral';
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
      className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] ${styles[type]}`}
    >
      {text}
    </span>
  );
}

function EmptyAlerts({
  filtered,
}: {
  filtered: boolean;
}) {
  return (
    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-2xl">
        ✅
      </div>

      <p className="mt-5 text-base font-semibold text-emerald-300">
        {filtered
          ? 'No matching alerts'
          : 'No alerts recorded'}
      </p>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-emerald-100/45">
        {filtered
          ? 'Try changing the search text or severity filter.'
          : 'System alerts will appear here when events are recorded.'}
      </p>
    </div>
  );
}

function AlertsLoadingState() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-28 rounded-2xl border border-panel-border bg-black/10"
        />
      ))}
    </div>
  );
}

function normalizeSeverity(
  severity?: string,
  resolved = false
): SeverityFilter {
  if (resolved) return 'resolved';

  const normalized = severity?.toLowerCase();

  if (
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'error'
  ) {
    return 'critical';
  }

  if (
    normalized === 'warning' ||
    normalized === 'medium'
  ) {
    return 'warning';
  }

  return 'info';
}

function alertTone(severity: SeverityFilter) {
  const tones = {
    all: {
      container:
        'border-panel-border bg-black/10',
      icon: 'bg-white/5 text-slate-300',
    },
    critical: {
      container:
        'border-red-400/20 bg-red-400/[0.035]',
      icon: 'bg-red-400/10 text-red-300',
    },
    warning: {
      container:
        'border-amber-400/20 bg-amber-400/[0.035]',
      icon: 'bg-amber-400/10 text-amber-300',
    },
    info: {
      container:
        'border-blue-400/15 bg-blue-400/[0.025]',
      icon: 'bg-blue-400/10 text-blue-300',
    },
    resolved: {
      container:
        'border-emerald-400/15 bg-emerald-400/[0.025]',
      icon: 'bg-emerald-400/10 text-emerald-300',
    },
  };

  return tones[severity];
}

function badgeType(
  severity: SeverityFilter
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  if (severity === 'resolved') return 'success';

  return 'neutral';
}

function formatAlertTitle(alert: AlertRecord) {
  const raw =
    alert.alert_type ??
    alert.type ??
    'System alert';

  return raw
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function alertIcon(alert: AlertRecord) {
  const text = [
    alert.alert_type,
    alert.type,
    alert.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('leak')) return '💧';
  if (text.includes('dry')) return '🛢️';
  if (text.includes('tank')) return '📉';
  if (text.includes('light')) return '💡';
  if (text.includes('schedule')) return '📅';
  if (text.includes('device')) return '📡';
  if (text.includes('esp32')) return '📡';
  if (text.includes('valve')) return '🚰';

  return '🔔';
}