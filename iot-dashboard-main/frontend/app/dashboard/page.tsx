'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import TankGauge from '@/components/TankGauge';
import FlowChart, { HistoryPoint } from '@/components/FlowChart';
import WardConsumption from '@/components/WardConsumption';
import StreetLightCard from '@/components/StreetLightCard';
import ValveControl from '@/components/ValveControl';
import AlertBanner from '@/components/AlertBanner';
import ExportButtons from '@/components/ExportButtons';

import { useAuth } from '@/context/AuthContext';
import { useLiveSocket } from '@/lib/useLiveSocket';
import { apiGet } from '@/lib/api';

interface Ward {
  ward_number: number;
  ward_name: string;
}

interface DeviceStatus {
  tankLevelMl?: number;
  tank_level_ml?: number;

  flowRateLpm?: number;
  flow_rate_lpm?: number;

  streetLight?: boolean;
  street_light?: boolean;

  leakDetected?: boolean;
  leak_detected?: boolean;

  dryTank?: boolean;
  dry_tank?: boolean;

  ward1Ml?: number;
  ward1_ml?: number;

  ward2Ml?: number;
  ward2_ml?: number;

  ward3Ml?: number;
  ward3_ml?: number;

  activeWard?: number;
  active_ward?: number;

  deviceOnline?: boolean;
  device_online?: boolean;

  updatedAt?: string;
  updated_at?: string;
}

const TANK_CAPACITY_ML = 5000;

export default function DashboardPage() {
  const { isOperator, user } = useAuth();
  const { status, connected } = useLiveSocket();

  const [wards, setWards] = useState<Ward[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [fallbackStatus, setFallbackStatus] =
    useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [wardData, historyData, statusData] =
          await Promise.allSettled([
            apiGet('/api/device/wards'),
            apiGet('/api/device/history?hours=6'),
            apiGet('/api/device/status'),
          ]);

        if (!mounted) return;

        if (wardData.status === 'fulfilled') {
          setWards(wardData.value);
        }

        if (historyData.status === 'fulfilled') {
          setHistory(historyData.value);
        }

        if (statusData.status === 'fulfilled') {
          setFallbackStatus(statusData.value);
        }

        setLastRefresh(new Date());
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    const interval = window.setInterval(async () => {
      try {
        const historyData = await apiGet(
          '/api/device/history?hours=6'
        );

        if (mounted) {
          setHistory(historyData);
          setLastRefresh(new Date());
        }
      } catch {
        // Keep showing the last available history.
      }
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const live = (status || fallbackStatus) as DeviceStatus | null;

  const dashboardData = useMemo(() => {
    const tankLevelMl = toNumber(
      live?.tankLevelMl ?? live?.tank_level_ml
    );

    const flowRateLpm = toNumber(
      live?.flowRateLpm ?? live?.flow_rate_lpm
    );

    const ward1Ml = toNumber(
      live?.ward1Ml ?? live?.ward1_ml
    );

    const ward2Ml = toNumber(
      live?.ward2Ml ?? live?.ward2_ml
    );

    const ward3Ml = toNumber(
      live?.ward3Ml ?? live?.ward3_ml
    );

    const activeWard = toNumber(
      live?.activeWard ?? live?.active_ward
    );

    const tankPercentage = Math.min(
      100,
      Math.max(0, (tankLevelMl / TANK_CAPACITY_ML) * 100)
    );

    const totalConsumptionMl =
      ward1Ml + ward2Ml + ward3Ml;

    const streetLight =
      live?.streetLight ?? live?.street_light ?? false;

    const leakDetected =
      live?.leakDetected ?? live?.leak_detected ?? false;

    const dryTank =
      live?.dryTank ?? live?.dry_tank ?? false;

    const deviceOnline =
      live?.deviceOnline === true ||
      live?.device_online === true;
    return {
      tankLevelMl,
      tankPercentage,
      flowRateLpm,
      ward1Ml,
      ward2Ml,
      ward3Ml,
      totalConsumptionMl,
      activeWard,
      streetLight,
      leakDetected,
      dryTank,
      deviceOnline,
    };
  }, [live, connected]);

  const updatedTime =
    live?.updatedAt ??
    live?.updated_at ??
    lastRefresh?.toISOString();

  return (
    <ProtectedRoute>
 <div className="min-h-screen bg-base">
  <Navbar
  connected={connected}
  hardwareOnline={dashboardData.deviceOnline}
/>

  <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
    <div className="mx-auto max-w-[1600px]">
        
          <DashboardHeader
            isOperator={isOperator}
            userName={user?.name}
            connected={connected}
            updatedTime={updatedTime}
          />

          {!connected && (
            <DeviceOfflineNotice
              deviceOnline={dashboardData.deviceOnline}
            />
          )}

          {(dashboardData.leakDetected ||
            dashboardData.dryTank) && (
            <div className="mt-5">
              <AlertBanner
                leakDetected={dashboardData.leakDetected}
                dryTank={dashboardData.dryTank}
              />
            </div>
          )}

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <SummaryCard
              title="Tank Level"
              value={`${dashboardData.tankPercentage.toFixed(1)}%`}
              description={`${(
                dashboardData.tankLevelMl / 1000
              ).toFixed(2)} / 5.00 L`}
              icon={<WaterIcon />}
              status={
                dashboardData.dryTank
                  ? 'Critical'
                  : dashboardData.tankPercentage < 25
                    ? 'Low'
                    : 'Normal'
              }
              statusType={
                dashboardData.dryTank
                  ? 'danger'
                  : dashboardData.tankPercentage < 25
                    ? 'warning'
                    : 'success'
              }
            />

            <SummaryCard
              title="Current Flow"
              value={`${dashboardData.flowRateLpm.toFixed(2)}`}
              unit="L/min"
              description="YF-S201 outlet sensor"
              icon={<FlowIcon />}
              status={
                dashboardData.flowRateLpm > 0
                  ? 'Flowing'
                  : 'No flow'
              }
              statusType={
                dashboardData.flowRateLpm > 0
                  ? 'success'
                  : 'neutral'
              }
            />

            <SummaryCard
              title="Active Ward"
              value={
                dashboardData.activeWard > 0
                  ? `Ward ${dashboardData.activeWard}`
                  : 'None'
              }
              description={`${(
                dashboardData.totalConsumptionMl / 1000
              ).toFixed(2)} L distributed`}
              icon={<WardIcon />}
              status={
                dashboardData.activeWard > 0
                  ? 'Valve open'
                  : 'Idle'
              }
              statusType={
                dashboardData.activeWard > 0
                  ? 'success'
                  : 'neutral'
              }
            />

            <SummaryCard
              title="Street Lights"
              value={
                dashboardData.streetLight ? 'ON' : 'OFF'
              }
              description="Automatic LDR control"
              icon={<LightIcon />}
              status={
                dashboardData.streetLight
                  ? 'Active'
                  : 'Inactive'
              }
              statusType={
                dashboardData.streetLight
                  ? 'success'
                  : 'neutral'
              }
            />
          </motion.section>

          {loading ? (
            <DashboardSkeleton />
          ) : (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              <div className="lg:col-span-4">
                <SectionShell
                  title="Tank Monitoring"
                  subtitle="Current storage level"
                  badge={
                    dashboardData.dryTank
                      ? 'Dry tank'
                      : 'Live'
                  }
                  badgeType={
                    dashboardData.dryTank
                      ? 'danger'
                      : 'success'
                  }
                >
                  <TankGauge
                    levelMl={dashboardData.tankLevelMl}
                    dryTank={dashboardData.dryTank}
                  />
                </SectionShell>
              </div>

              <div className="lg:col-span-8">
                <SectionShell
                  title="Water Flow History"
                  subtitle="Last six hours of sensor data"
                  action={
                    <span className="text-xs text-slate-500">
                      Refreshes every 30 seconds
                    </span>
                  }
                >
                  <FlowChart history={history} />
                </SectionShell>
              </div>

              <div className="lg:col-span-5">
                <SectionShell
                  title="Ward Consumption"
                  subtitle="Distribution by area"
                  badge={
                    dashboardData.activeWard > 0
                      ? `Ward ${dashboardData.activeWard} active`
                      : 'No active ward'
                  }
                  badgeType={
                    dashboardData.activeWard > 0
                      ? 'success'
                      : 'neutral'
                  }
                >
                  <WardConsumption
                    wards={wards}
                    consumption={{
                      ward1Ml: dashboardData.ward1Ml,
                      ward2Ml: dashboardData.ward2Ml,
                      ward3Ml: dashboardData.ward3Ml,
                    }}
                    activeWard={dashboardData.activeWard}
                  />
                </SectionShell>
              </div>

              <div className="lg:col-span-3">
                <SectionShell
                  title="Street Lighting"
                  subtitle="LDR automation status"
                >
                  <StreetLightCard
                    isOn={dashboardData.streetLight}
                  />
                </SectionShell>
              </div>

              <div className="lg:col-span-4">
                <SystemStatusPanel
                  connected={connected}
                  deviceOnline={dashboardData.deviceOnline}
                  schedulesAvailable={true}
                  databaseAvailable={Boolean(live)}
                  updatedTime={updatedTime}
                />
              </div>

              <div className="lg:col-span-12">
                <SectionShell
                  title="Valve Control Centre"
                  subtitle={
                    isOperator
                      ? 'Manual ward control is enabled'
                      : 'Read-only system monitoring'
                  }
                  badge={
                    isOperator
                      ? 'Operator access'
                      : 'Viewer access'
                  }
                  badgeType={
                    isOperator ? 'success' : 'neutral'
                  }
                >
                  <ValveControl
                    wards={wards}
                    activeWard={dashboardData.activeWard}
                  />
                </SectionShell>
              </div>
            </motion.section>
          )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function DashboardHeader({
  isOperator,
  userName,
  connected,
  updatedTime,
}: {
  isOperator: boolean;
  userName?: string;
  connected: boolean;
  updatedTime?: string;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-panel-border bg-panel/60 p-5 backdrop-blur-xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              connected
                ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
                : 'border-amber-400/20 bg-amber-400/5 text-amber-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected
                  ? 'bg-emerald-400'
                  : 'animate-pulse bg-amber-400'
              }`}
            />
            {connected
              ? 'Live connection'
              : 'Reconnecting'}
          </span>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {isOperator ? 'Operator mode' : 'User mode'}
          </span>
        </div>

        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
          Welcome{userName ? `, ${userName}` : ''}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Monitor water distribution, tank level, ward
          consumption, street lighting, alerts, and automation
          schedules from one control centre.
        </p>

        {updatedTime && (
          <p className="mt-3 text-xs text-slate-600">
            Last data update: {formatDateTime(updatedTime)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ExportButtons />

        <Link
          href="/dashboard/schedule"
          className="inline-flex items-center gap-2 rounded-xl border border-panel-border bg-black/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-signal-cyan/60 hover:text-signal-cyan"
        >
          <CalendarIcon />
          Manage Schedules
        </Link>
      </div>
    </section>
  );
}

function DeviceOfflineNotice({
  deviceOnline,
}: {
  deviceOnline: boolean;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-400" />

        <div>
          <p className="text-sm font-semibold text-amber-300">
            {deviceOnline
              ? 'Live feed reconnecting'
              : 'ESP32 device currently offline'}
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-100/50">
            The web application remains available and is showing
            the last known database values. Hardware integration
            can be completed later.
          </p>
        </div>
      </div>

      <span className="whitespace-nowrap rounded-lg bg-amber-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
        Software online
      </span>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  unit,
  description,
  icon,
  status,
  statusType,
}: {
  title: string;
  value: string;
  unit?: string;
  description: string;
  icon: React.ReactNode;
  status: string;
  statusType: BadgeType;
}) {
  return (
    <article className="group rounded-2xl border border-panel-border bg-panel/70 p-5 transition hover:-translate-y-0.5 hover:border-signal-cyan/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal-cyan/10 text-signal-cyan">
          {icon}
        </div>

        <StatusBadge type={statusType}>
          {status}
        </StatusBadge>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>

      <p className="mt-2 font-mono text-3xl font-bold text-white">
        {value}
        {unit && (
          <span className="ml-2 text-sm font-normal text-slate-500">
            {unit}
          </span>
        )}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </article>
  );
}

type BadgeType =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

function StatusBadge({
  type,
  children,
}: {
  type: BadgeType;
  children: React.ReactNode;
}) {
  const classes = {
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
      className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] ${classes[type]}`}
    >
      {children}
    </span>
  );
}

function SectionShell({
  title,
  subtitle,
  badge,
  badgeType = 'neutral',
  action,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  badgeType?: BadgeType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-2xl border border-panel-border bg-panel/65 p-4 backdrop-blur-xl sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-white">
            {title}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>

        {badge ? (
          <StatusBadge type={badgeType}>
            {badge}
          </StatusBadge>
        ) : (
          action
        )}
      </div>

      {children}
    </section>
  );
}

function SystemStatusPanel({
  connected,
  deviceOnline,
  schedulesAvailable,
  databaseAvailable,
  updatedTime,
}: {
  connected: boolean;
  deviceOnline: boolean;
  schedulesAvailable: boolean;
  databaseAvailable: boolean;
  updatedTime?: string;
}) {
  return (
    <section className="h-full rounded-2xl border border-panel-border bg-panel/65 p-5 backdrop-blur-xl">
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-white">
          System Health
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Cloud and hardware connectivity
        </p>
      </div>

      <div className="space-y-3">
        <HealthRow
          label="Backend API"
          healthy={databaseAvailable}
          healthyText="Online"
          unhealthyText="Unavailable"
        />

        <HealthRow
          label="WebSocket"
          healthy={connected}
          healthyText="Connected"
          unhealthyText="Reconnecting"
        />

        <HealthRow
          label="Cloud database"
          healthy={databaseAvailable}
          healthyText="Connected"
          unhealthyText="Checking"
        />

        <HealthRow
          label="Scheduler"
          healthy={schedulesAvailable}
          healthyText="Running"
          unhealthyText="Unavailable"
        />

        <HealthRow
          label="ESP32 hardware"
          healthy={deviceOnline}
          healthyText="Online"
          unhealthyText="Offline"
        />
      </div>

      {updatedTime && (
        <div className="mt-5 rounded-xl border border-white/5 bg-black/10 p-3">
          <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
            Last update
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {formatDateTime(updatedTime)}
          </p>
        </div>
      )}
    </section>
  );
}

function HealthRow({
  label,
  healthy,
  healthyText,
  unhealthyText,
}: {
  label: string;
  healthy: boolean;
  healthyText: string;
  unhealthyText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/10 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2 w-2 rounded-full ${
            healthy
              ? 'bg-emerald-400'
              : 'animate-pulse bg-amber-400'
          }`}
        />

        <span className="text-xs text-slate-400">
          {label}
        </span>
      </div>

      <span
        className={`text-[10px] font-semibold uppercase ${
          healthy ? 'text-emerald-300' : 'text-amber-300'
        }`}
      >
        {healthy ? healthyText : unhealthyText}
      </span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-6 grid animate-pulse grid-cols-1 gap-6 lg:grid-cols-12">
      <SkeletonCard className="h-80 lg:col-span-4" />
      <SkeletonCard className="h-80 lg:col-span-8" />
      <SkeletonCard className="h-72 lg:col-span-5" />
      <SkeletonCard className="h-72 lg:col-span-3" />
      <SkeletonCard className="h-72 lg:col-span-4" />
    </div>
  );
}

function SkeletonCard({
  className,
}: {
  className: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-panel-border bg-panel/40 ${className}`}
    />
  );
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function WaterIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3s6 6.4 6 11a6 6 0 1 1-12 0c0-4.6 6-11 6-11Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 12h14m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 7h5M3 17h7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WardIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 20V8l8-4 8 4v12M8 20v-7h8v7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LightIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 18h6M10 22h4M8.2 14.5A6 6 0 1 1 15.8 14.5C14.7 15.4 14 16.2 14 18h-4c0-1.8-.7-2.6-1.8-3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 3v4M16 3v4M4 10h16"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}