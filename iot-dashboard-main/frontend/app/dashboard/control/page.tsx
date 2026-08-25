'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
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

  streetLight?: boolean;
  street_light?: boolean;

  deviceOnline?: boolean;
  device_online?: boolean;

  timestamp?: string;
  recorded_at?: string;
}

type LightMode = 'on' | 'off' | 'auto';

export default function ManualControlPage() {
  const { isOperator } = useAuth();
  const { status, connected } = useLiveSocket();

  const [wards, setWards] = useState<Ward[]>([]);
  const [fallbackStatus, setFallbackStatus] =
    useState<DeviceStatus | null>(null);

  const [busyWard, setBusyWard] = useState<number | null>(null);
  const [busyLightMode, setBusyLightMode] =
    useState<LightMode | null>(null);
  const [refilling, setRefilling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      const results = await Promise.allSettled([
        apiGet('/api/device/wards'),
        apiGet('/api/device/status'),
      ]);

      if (!mounted) return;

      const [wardsResult, statusResult] = results;

      if (wardsResult.status === 'fulfilled') {
        setWards(
          Array.isArray(wardsResult.value)
            ? wardsResult.value
            : []
        );
      }

      if (statusResult.status === 'fulfilled') {
        setFallbackStatus(statusResult.value);
      }

      setLoading(false);
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, []);

  const live = (status || fallbackStatus) as DeviceStatus | null;

  const control = useMemo(() => {
    const tankLevelMl = toNumber(
      live?.tankLevelMl ?? live?.tank_level_ml
    );

    const flowRateLpm = toNumber(
      live?.flowRateLpm ?? live?.flow_rate_lpm
    );

    const activeWard = toNumber(
      live?.activeWard ?? live?.active_ward
    );

    const streetLight =
      live?.streetLight ??
      live?.street_light ??
      false;

    const hardwareOnline =
      live?.deviceOnline === true ||
      live?.device_online === true;

    const updatedAt =
      live?.timestamp ??
      live?.recorded_at ??
      null;

    return {
      tankLevelMl,
      flowRateLpm,
      activeWard,
      streetLight,
      hardwareOnline,
      updatedAt,
    };
  }, [live]);

  async function setValve(
    wardNumber: number,
    state: boolean
  ) {
    if (!isOperator) {
      toast.error('Only operators can control valves.');
      return;
    }

    if (!control.hardwareOnline) {
      toast.error(
        'ESP32 is offline. Valve commands are unavailable.',
        {
          id: 'manual-control-hardware-offline',
        }
      );
      return;
    }

    setBusyWard(wardNumber);

    try {
      await apiPost('/api/device/valve', {
        ward: wardNumber,
        state,
      });

      toast.success(
        `Ward ${wardNumber} valve ${
          state ? 'opened' : 'closed'
        }.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Valve command failed.';

      toast.error(message);
    } finally {
      setBusyWard(null);
    }
  }

  async function setLightMode(mode: LightMode) {
    if (!isOperator) {
      toast.error('Only operators can control street lights.');
      return;
    }

    if (!control.hardwareOnline) {
      toast.error(
        'ESP32 is offline. Street-light commands are unavailable.',
        {
          id: 'manual-light-hardware-offline',
        }
      );
      return;
    }

    setBusyLightMode(mode);

    try {
      await apiPost('/api/device/light', { mode });

      toast.success(
        mode === 'auto'
          ? 'Automatic lighting mode enabled.'
          : mode === 'on'
            ? 'Street lights switched ON.'
            : 'Street lights switched OFF.'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Street-light command failed.';

      toast.error(message);
    } finally {
      setBusyLightMode(null);
    }
  }

  async function refillTank() {
    if (!isOperator) {
      toast.error('Only operators can refill the tank.');
      return;
    }

    if (!control.hardwareOnline) {
      toast.error(
        'ESP32 is offline. Tank refill is unavailable.',
        {
          id: 'manual-refill-hardware-offline',
        }
      );
      return;
    }

    const confirmed = window.confirm(
      'Refill the tank value to full capacity?'
    );

    if (!confirmed) return;

    setRefilling(true);

    try {
      await apiPost('/api/device/refill', {});

      toast.success('Tank refilled to full capacity.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Tank refill failed.';

      toast.error(message);
    } finally {
      setRefilling(false);
    }
  }

  const controlsDisabled =
    !isOperator || !control.hardwareOnline;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
          connected={connected}
          hardwareOnline={control.hardwareOnline}
        />

        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <ControlHeader
              connected={connected}
              hardwareOnline={control.hardwareOnline}
              isOperator={isOperator}
            />

            {loading ? (
              <LoadingState />
            ) : (
              <>
                <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Tank Level"
                    value={`${(
                      control.tankLevelMl / 1000
                    ).toFixed(2)} L`}
                    subtitle="Maximum capacity 5.00 L"
                    icon="💧"
                  />

                  <MetricCard
                    title="Flow Rate"
                    value={`${control.flowRateLpm.toFixed(2)} L/min`}
                    subtitle="Current outlet flow"
                    icon="🌊"
                  />

                  <MetricCard
                    title="Active Ward"
                    value={
                      control.activeWard > 0
                        ? `Ward ${control.activeWard}`
                        : 'None'
                    }
                    subtitle="Current valve state"
                    icon="🚰"
                  />

                  <MetricCard
                    title="Street Lights"
                    value={control.streetLight ? 'ON' : 'OFF'}
                    subtitle="Current relay state"
                    icon="💡"
                  />
                </section>

                {!control.hardwareOnline && (
                  <section className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                    <p className="text-sm font-semibold text-amber-300">
                      Hardware controls are disabled
                    </p>

                    <p className="mt-2 text-xs leading-6 text-amber-100/50">
                      The web application and backend are online, but
                      the ESP32 is not connected. Valve, lighting and
                      tank-refill commands will be enabled
                      automatically after the hardware reconnects.
                    </p>
                  </section>
                )}

                <section className="mt-6 grid gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <Panel
                      title="Ward Valve Control"
                      subtitle="Open or close water-distribution valves"
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        {[1, 2, 3].map((wardNumber) => {
                          const ward = wards.find(
                            (item) =>
                              item.ward_number === wardNumber
                          );

                          const isOpen =
                            control.activeWard === wardNumber;

                          const busy =
                            busyWard === wardNumber;

                          return (
                            <article
                              key={wardNumber}
                              className={`rounded-2xl border p-5 ${
                                isOpen
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
                                    Valve {wardNumber}
                                  </p>
                                </div>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase ${
                                    isOpen
                                      ? 'bg-emerald-400/10 text-emerald-300'
                                      : 'bg-white/5 text-slate-500'
                                  }`}
                                >
                                  {isOpen ? 'Open' : 'Closed'}
                                </span>
                              </div>

                              <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  disabled={
                                    controlsDisabled ||
                                    busyWard !== null
                                  }
                                  onClick={() =>
                                    setValve(wardNumber, true)
                                  }
                                  className={`rounded-xl border px-4 py-3 text-xs font-semibold transition ${
                                    isOpen
                                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                                      : 'border-panel-border text-slate-300 hover:border-emerald-400/30 hover:text-emerald-300'
                                  } disabled:cursor-not-allowed disabled:opacity-45`}
                                >
                                  {busy ? 'Sending…' : 'Open'}
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    controlsDisabled ||
                                    busyWard !== null
                                  }
                                  onClick={() =>
                                    setValve(wardNumber, false)
                                  }
                                  className="rounded-xl border border-panel-border px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-red-400/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {busy ? 'Sending…' : 'Close'}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </Panel>
                  </div>

                  <div className="xl:col-span-4">
                    <Panel
                      title="Tank Refill"
                      subtitle="Reset tank quantity to full capacity"
                    >
                      <div className="rounded-2xl border border-panel-border bg-black/10 p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Main Tank
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Current calculated volume
                            </p>
                          </div>

                          <span className="font-mono text-xl font-bold text-cyan-300">
                            {(control.tankLevelMl / 1000).toFixed(2)} L
                          </span>
                        </div>

                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  (control.tankLevelMl / 5000) * 100
                                )
                              )}%`,
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={
                            controlsDisabled || refilling
                          }
                          onClick={refillTank}
                          className="mt-6 w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {refilling
                            ? 'Refilling…'
                            : 'Refill Tank'}
                        </button>
                      </div>
                    </Panel>
                  </div>

                  <div className="xl:col-span-8">
                    <Panel
                      title="Street-Light Control"
                      subtitle="Select automatic or manual relay mode"
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <LightModeButton
                          title="Automatic"
                          description="Use LDR and power-saving schedule."
                          icon="⚙️"
                          active={false}
                          busy={busyLightMode === 'auto'}
                          disabled={
                            controlsDisabled ||
                            busyLightMode !== null
                          }
                          onClick={() =>
                            setLightMode('auto')
                          }
                        />

                        <LightModeButton
                          title="Force ON"
                          description="Switch street-light relay ON."
                          icon="💡"
                          active={control.streetLight}
                          busy={busyLightMode === 'on'}
                          disabled={
                            controlsDisabled ||
                            busyLightMode !== null
                          }
                          onClick={() =>
                            setLightMode('on')
                          }
                        />

                        <LightModeButton
                          title="Force OFF"
                          description="Switch street-light relay OFF."
                          icon="🌑"
                          active={!control.streetLight}
                          busy={busyLightMode === 'off'}
                          disabled={
                            controlsDisabled ||
                            busyLightMode !== null
                          }
                          onClick={() =>
                            setLightMode('off')
                          }
                        />
                      </div>
                    </Panel>
                  </div>

                  <div className="xl:col-span-4">
                    <Panel
                      title="Control-System Health"
                      subtitle="Live connectivity and permissions"
                    >
                      <div className="space-y-3">
                        <HealthRow
                          label="Backend WebSocket"
                          healthy={connected}
                        />

                        <HealthRow
                          label="ESP32 controller"
                          healthy={control.hardwareOnline}
                        />

                        <HealthRow
                          label="Operator permission"
                          healthy={isOperator}
                        />

                        <HealthRow
                          label="Command channel"
                          healthy={
                            connected &&
                            control.hardwareOnline &&
                            isOperator
                          }
                        />
                      </div>

                      <div className="mt-5 rounded-xl border border-white/5 bg-black/10 p-3">
                        <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                          Last hardware update
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {control.updatedAt
                            ? formatDate(control.updatedAt)
                            : 'No hardware data received yet'}
                        </p>
                      </div>
                    </Panel>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function ControlHeader({
  connected,
  hardwareOnline,
  isOperator,
}: {
  connected: boolean;
  hardwareOnline: boolean;
  isOperator: boolean;
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
              type={hardwareOnline ? 'success' : 'danger'}
            />

            <StatusBadge
              text={
                isOperator
                  ? 'Operator access'
                  : 'Viewer access'
              }
              type={isOperator ? 'success' : 'neutral'}
            />
          </div>

          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Manual Control
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Operate ward valves, street lights and tank-refill
            controls from one protected operator panel.
          </p>
        </div>

        <div
          className={`rounded-2xl border px-5 py-4 ${
            hardwareOnline && isOperator
              ? 'border-emerald-400/20 bg-emerald-400/5'
              : 'border-amber-400/20 bg-amber-400/5'
          }`}
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Control availability
          </p>

          <p
            className={`mt-1 text-lg font-semibold ${
              hardwareOnline && isOperator
                ? 'text-emerald-300'
                : 'text-amber-300'
            }`}
          >
            {hardwareOnline && isOperator
              ? 'Controls enabled'
              : 'Controls disabled'}
          </p>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <article className="rounded-2xl border border-panel-border bg-panel/65 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-xl text-cyan-300">
        {icon}
      </div>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>

      <p className="mt-2 font-mono text-2xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
      </p>
    </article>
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

function LightModeButton({
  title,
  description,
  icon,
  active,
  busy,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/10'
          : 'border-panel-border bg-black/10 hover:border-cyan-400/20'
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-2xl">{icon}</span>

        <span
          className={`h-2.5 w-2.5 rounded-full ${
            active ? 'bg-cyan-300' : 'bg-slate-700'
          }`}
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-white">
        {busy ? 'Sending…' : title}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </button>
  );
}

function HealthRow({
  label,
  healthy,
}: {
  label: string;
  healthy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/10 px-3 py-3">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2 w-2 rounded-full ${
            healthy
              ? 'bg-emerald-400'
              : 'animate-pulse bg-red-400'
          }`}
        />

        <span className="text-xs text-slate-400">
          {label}
        </span>
      </div>

      <span
        className={`text-[10px] font-semibold uppercase ${
          healthy
            ? 'text-emerald-300'
            : 'text-red-300'
        }`}
      >
        {healthy ? 'Available' : 'Unavailable'}
      </span>
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
      className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${styles[type]}`}
    >
      {text}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 animate-pulse space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-40 rounded-2xl border border-panel-border bg-panel/40"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="h-80 rounded-2xl border border-panel-border bg-panel/40 xl:col-span-8" />
        <div className="h-80 rounded-2xl border border-panel-border bg-panel/40 xl:col-span-4" />
      </div>
    </div>
  );
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}