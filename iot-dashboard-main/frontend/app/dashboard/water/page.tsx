'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import ValveControl from '@/components/ValveControl';
import WardConsumption from '@/components/WardConsumption';
import TankGauge from '@/components/TankGauge';

import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';

interface Ward {
  ward_number: number;
  ward_name: string;
}

interface DeviceStatus {
  tankLevelMl?: number;
  tank_level_ml?: number;

  flowRateLpm?: number;
  flow_rate_lpm?: number;

  ward1Ml?: number;
  ward1_ml?: number;

  ward2Ml?: number;
  ward2_ml?: number;

  ward3Ml?: number;
  ward3_ml?: number;

  activeWard?: number;
  active_ward?: number;

  dryTank?: boolean;
  dry_tank?: boolean;

  deviceOnline?: boolean;
  device_online?: boolean;
}

const TANK_CAPACITY_ML = 5000;

export default function WaterDistributionPage() {
  const { isOperator } = useAuth();
  const { status, connected } = useLiveSocket();

  const [wards, setWards] = useState<Ward[]>([]);
  const [fallbackStatus, setFallbackStatus] =
    useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      try {
        const [wardData, statusData] = await Promise.all([
          apiGet('/api/device/wards'),
          apiGet('/api/device/status'),
        ]);

        if (!mounted) return;

        setWards(wardData);
        setFallbackStatus(statusData);
      } catch (error) {
        if (!mounted) return;

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load water distribution data.';

        toast.error(message, {
          id: 'water-page-load-error',
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, []);

  const live = (status || fallbackStatus) as DeviceStatus | null;

  const data = useMemo(() => {
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

    const dryTank =
      live?.dryTank ?? live?.dry_tank ?? false;

    const hardwareOnline =
      live?.deviceOnline === true ||
      live?.device_online === true;

    const tankPercentage = Math.min(
      100,
      Math.max(
        0,
        (tankLevelMl / TANK_CAPACITY_ML) * 100
      )
    );

    return {
      tankLevelMl,
      tankPercentage,
      flowRateLpm,
      ward1Ml,
      ward2Ml,
      ward3Ml,
      activeWard,
      dryTank,
      hardwareOnline,
      totalConsumptionMl:
        ward1Ml + ward2Ml + ward3Ml,
    };
  }, [live]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
          connected={connected}
          hardwareOnline={data.hardwareOnline}
        />

        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <section className="rounded-2xl border border-panel-border bg-panel/60 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      text={
                        connected
                          ? 'Cloud Connected'
                          : 'Reconnecting'
                      }
                      type={
                        connected ? 'success' : 'warning'
                      }
                    />

                    <StatusBadge
                      text={
                        data.hardwareOnline
                          ? 'ESP32 Online'
                          : 'ESP32 Offline'
                      }
                      type={
                        data.hardwareOnline
                          ? 'success'
                          : 'danger'
                      }
                    />

                    <StatusBadge
                      text={
                        isOperator
                          ? 'Operator Access'
                          : 'Viewer Access'
                      }
                      type="neutral"
                    />
                  </div>

                  <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                    Water Distribution
                  </h1>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    Monitor tank storage, flow rate, ward-wise
                    consumption and manually control distribution
                    valves.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <HeaderMetric
                    label="Tank"
                    value={`${data.tankPercentage.toFixed(1)}%`}
                  />

                  <HeaderMetric
                    label="Flow"
                    value={`${data.flowRateLpm.toFixed(2)} L/min`}
                  />

                  <HeaderMetric
                    label="Active Ward"
                    value={
                      data.activeWard > 0
                        ? `Ward ${data.activeWard}`
                        : 'None'
                    }
                  />

                  <HeaderMetric
                    label="Distributed"
                    value={`${(
                      data.totalConsumptionMl / 1000
                    ).toFixed(2)} L`}
                  />
                </div>
              </div>
            </section>

            {loading ? (
              <LoadingState />
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <Panel
                    title="Main Tank"
                    subtitle="Current calculated water level"
                  >
                    <TankGauge
                      levelMl={data.tankLevelMl}
                      dryTank={data.dryTank}
                    />
                  </Panel>
                </div>

                <div className="lg:col-span-8">
                  <Panel
                    title="Ward Consumption"
                    subtitle="Today’s distribution by ward"
                  >
                    <WardConsumption
                      wards={wards}
                      consumption={{
                        ward1Ml: data.ward1Ml,
                        ward2Ml: data.ward2Ml,
                        ward3Ml: data.ward3Ml,
                      }}
                      activeWard={data.activeWard}
                    />
                  </Panel>
                </div>

                <div className="lg:col-span-12">
                  <Panel
                    title="Manual Valve Control"
                    subtitle={
                      isOperator
                        ? 'Open or close ward valves manually'
                        : 'Viewer accounts have read-only access'
                    }
                  >
                    <ValveControl
                      wards={wards}
                      activeWard={data.activeWard}
                    />
                  </Panel>
                </div>

                <div className="lg:col-span-12">
                  <WardOverview
                    wards={wards}
                    activeWard={data.activeWard}
                    values={[
                      data.ward1Ml,
                      data.ward2Ml,
                      data.ward3Ml,
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-2xl border border-panel-border bg-panel/65 p-5 backdrop-blur-xl">
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-white">
          {title}
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          {subtitle}
        </p>
      </div>

      {children}
    </section>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-28 rounded-xl border border-panel-border bg-black/10 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  text,
  type,
}: {
  text: string;
  type: 'success' | 'warning' | 'danger' | 'neutral';
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
      className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${classes[type]}`}
    >
      {text}
    </span>
  );
}

function WardOverview({
  wards,
  activeWard,
  values,
}: {
  wards: Ward[];
  activeWard: number;
  values: number[];
}) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel/65 p-5 backdrop-blur-xl">
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-white">
          Ward Overview
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          Distribution status and current consumption
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((wardNumber) => {
          const ward = wards.find(
            (item) =>
              item.ward_number === wardNumber
          );

          const value = values[wardNumber - 1] ?? 0;
          const active = activeWard === wardNumber;

          return (
            <article
              key={wardNumber}
              className={`rounded-2xl border p-5 ${
                active
                  ? 'border-emerald-400/25 bg-emerald-400/5'
                  : 'border-panel-border bg-black/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {ward?.ward_name ||
                      `Ward ${wardNumber}`}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Ward {wardNumber}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase ${
                    active
                      ? 'bg-emerald-400/10 text-emerald-300'
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {active ? 'Active' : 'Idle'}
                </span>
              </div>

              <p className="mt-6 font-mono text-2xl font-bold text-white">
                {(value / 1000).toFixed(2)}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  L
                </span>
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Water distributed today
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 grid animate-pulse gap-6 lg:grid-cols-12">
      <div className="h-80 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-4" />
      <div className="h-80 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-8" />
      <div className="h-72 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-12" />
    </div>
  );
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}