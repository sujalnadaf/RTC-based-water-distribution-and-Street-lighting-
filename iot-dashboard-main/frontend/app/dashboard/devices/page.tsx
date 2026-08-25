'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

import { apiGet } from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';

interface DeviceRecord {
  id?: number;
  name?: string;
  device_name?: string;
  device_type?: string;
  location?: string;
  ip_address?: string;
  firmware_version?: string;
  is_online?: boolean;
  last_seen_at?: string;
  created_at?: string;
}

interface DeviceStatus {
  deviceOnline?: boolean;
  device_online?: boolean;

  tankLevelMl?: number;
  tank_level_ml?: number;

  flowRateLpm?: number;
  flow_rate_lpm?: number;

  activeWard?: number;
  active_ward?: number;

  streetLight?: boolean;
  street_light?: boolean;

  timestamp?: string;
  recorded_at?: string;
}

export default function DevicesPage() {
  const { status, connected } = useLiveSocket();

  const [deviceRecord, setDeviceRecord] =
    useState<DeviceRecord | null>(null);

  const [fallbackStatus, setFallbackStatus] =
    useState<DeviceStatus | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDeviceInformation() {
      const results = await Promise.allSettled([
        apiGet('/api/device/status'),
        apiGet('/api/device/details'),
      ]);

      if (!mounted) return;

      const [statusResult, detailsResult] = results;

      if (statusResult.status === 'fulfilled') {
        setFallbackStatus(statusResult.value);
      }

      if (detailsResult.status === 'fulfilled') {
        setDeviceRecord(detailsResult.value);
      }

      setLoading(false);
    }

    loadDeviceInformation();

    return () => {
      mounted = false;
    };
  }, []);

  const live = (status || fallbackStatus) as DeviceStatus | null;

  const device = useMemo(() => {
    const hardwareOnline =
      live?.deviceOnline === true ||
      live?.device_online === true;

    return {
      hardwareOnline,
      tankLevelMl: toNumber(
        live?.tankLevelMl ?? live?.tank_level_ml
      ),
      flowRateLpm: toNumber(
        live?.flowRateLpm ?? live?.flow_rate_lpm
      ),
      activeWard: toNumber(
        live?.activeWard ?? live?.active_ward
      ),
      streetLight:
        live?.streetLight ??
        live?.street_light ??
        false,
      updatedAt:
        live?.timestamp ??
        live?.recorded_at ??
        deviceRecord?.last_seen_at ??
        null,
    };
  }, [live, deviceRecord]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
          connected={connected}
          hardwareOnline={device.hardwareOnline}
        />

        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <DevicesHeader
              connected={connected}
              hardwareOnline={device.hardwareOnline}
            />

            {loading ? (
              <LoadingState />
            ) : (
              <>
                <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Controller"
                    value="ESP32 DevKit V1"
                    subtitle="Main system controller"
                    icon="🧠"
                  />

                  <MetricCard
                    title="Hardware Status"
                    value={
                      device.hardwareOnline
                        ? 'Online'
                        : 'Offline'
                    }
                    subtitle={
                      device.hardwareOnline
                        ? 'Receiving live telemetry'
                        : 'No hardware response'
                    }
                    icon="📡"
                  />

                  <MetricCard
                    title="Flow Sensor"
                    value={`${device.flowRateLpm.toFixed(2)} L/min`}
                    subtitle="YF-S201 outlet sensor"
                    icon="🌊"
                  />

                  <MetricCard
                    title="Active Ward"
                    value={
                      device.activeWard > 0
                        ? `Ward ${device.activeWard}`
                        : 'None'
                    }
                    subtitle="Current valve selection"
                    icon="🚰"
                  />
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-7">
                    <Panel
                      title="Device Overview"
                      subtitle="Controller identity and deployment information"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <InformationCard
                          label="Device Name"
                          value={
                            deviceRecord?.device_name ??
                            deviceRecord?.name ??
                            'Water-IoT ESP32'
                          }
                        />

                        <InformationCard
                          label="Device Type"
                          value={
                            deviceRecord?.device_type ??
                            'ESP32 DevKit V1'
                          }
                        />

                        <InformationCard
                          label="Location"
                          value={
                            deviceRecord?.location ??
                            'Prototype System'
                          }
                        />

                        <InformationCard
                          label="IP Address"
                          value={
                            deviceRecord?.ip_address ??
                            '192.168.1.50'
                          }
                        />

                        <InformationCard
                          label="Firmware Version"
                          value={
                            deviceRecord?.firmware_version ??
                            'Not reported'
                          }
                        />

                        <InformationCard
                          label="Last Seen"
                          value={
                            device.updatedAt
                              ? formatDate(device.updatedAt)
                              : 'No hardware update received'
                          }
                        />
                      </div>
                    </Panel>
                  </div>

                  <div className="xl:col-span-5">
                    <Panel
                      title="Connectivity"
                      subtitle="Cloud, backend and hardware communication"
                    >
                      <div className="space-y-3">
                        <HealthRow
                          label="Frontend application"
                          healthy
                          detail="Running"
                        />

                        <HealthRow
                          label="Backend API"
                          healthy={connected}
                          detail={
                            connected
                              ? 'Connected'
                              : 'Reconnecting'
                          }
                        />

                        <HealthRow
                          label="WebSocket channel"
                          healthy={connected}
                          detail={
                            connected
                              ? 'Live'
                              : 'Unavailable'
                          }
                        />

                        <HealthRow
                          label="ESP32 controller"
                          healthy={device.hardwareOnline}
                          detail={
                            device.hardwareOnline
                              ? 'Online'
                              : 'Offline'
                          }
                        />

                        <HealthRow
                          label="Command channel"
                          healthy={
                            connected &&
                            device.hardwareOnline
                          }
                          detail={
                            connected &&
                            device.hardwareOnline
                              ? 'Available'
                              : 'Unavailable'
                          }
                        />
                      </div>
                    </Panel>
                  </div>

                  <div className="xl:col-span-12">
                    <HardwareModules
                      hardwareOnline={device.hardwareOnline}
                      streetLight={device.streetLight}
                      tankLevelMl={device.tankLevelMl}
                    />
                  </div>

                  <div className="xl:col-span-12">
                    <SystemArchitecture />
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

function DevicesHeader({
  connected,
  hardwareOnline,
}: {
  connected: boolean;
  hardwareOnline: boolean;
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
                hardwareOnline
                  ? 'success'
                  : 'danger'
              }
            />

            <StatusBadge
              text="Device management"
              type="neutral"
            />
          </div>

          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Devices
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Monitor the ESP32 controller, sensors, RTC, relay
            module and connected automation hardware.
          </p>
        </div>

        <div
          className={`rounded-2xl border px-5 py-4 ${
            hardwareOnline
              ? 'border-emerald-400/20 bg-emerald-400/5'
              : 'border-red-400/20 bg-red-400/5'
          }`}
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Main controller
          </p>

          <p
            className={`mt-1 text-lg font-semibold ${
              hardwareOnline
                ? 'text-emerald-300'
                : 'text-red-300'
            }`}
          >
            {hardwareOnline
              ? 'ESP32 Online'
              : 'ESP32 Offline'}
          </p>
        </div>
      </div>
    </section>
  );
}

function HardwareModules({
  hardwareOnline,
  streetLight,
  tankLevelMl,
}: {
  hardwareOnline: boolean;
  streetLight: boolean;
  tankLevelMl: number;
}) {
  const modules = [
    {
      name: 'ESP32 DevKit V1',
      type: 'Controller',
      status: hardwareOnline
        ? 'Online'
        : 'Offline',
      healthy: hardwareOnline,
      icon: '🧠',
      description:
        'Controls sensors, relays, automation logic and cloud communication.',
    },
    {
      name: 'DS3231 RTC',
      type: 'Real-Time Clock',
      status: hardwareOnline
        ? 'Available'
        : 'Not reported',
      healthy: hardwareOnline,
      icon: '🕒',
      description:
        'Provides accurate time for water schedules and power-saving windows.',
    },
    {
      name: 'YF-S201',
      type: 'Flow Sensor',
      status: hardwareOnline
        ? 'Available'
        : 'Not reported',
      healthy: hardwareOnline,
      icon: '🌊',
      description:
        'Measures water flow and calculates distributed volume.',
    },
    {
      name: '4-Channel Relay',
      type: 'Actuator Module',
      status: hardwareOnline
        ? 'Available'
        : 'Not reported',
      healthy: hardwareOnline,
      icon: '🔌',
      description:
        'Controls three water valves.',
    },
    {
      name: 'LDR Module',
      type: 'Light Sensor',
      status: hardwareOnline
        ? 'Available'
        : 'Not reported',
      healthy: hardwareOnline,
      icon: '☀️',
      description:
        'Detects darkness for automatic street-light operation.',
    },
    {
      name: 'Main Tank',
      type: 'Water Storage',
      status: `${(
        tankLevelMl / 1000
      ).toFixed(2)} L`,
      healthy: tankLevelMl > 0,
      icon: '🛢️',
      description:
        'Tank volume is estimated from the configured capacity and measured outflow.',
    },
    {
      name: 'Street Lights',
      type: 'Lighting Output',
      status: streetLight ? 'ON' : 'OFF',
      healthy: hardwareOnline,
      icon: '💡',
      description:
        'Controlled using LDR automation, manual override and time windows.',
    },
  ];

  return (
    <Panel
      title="Connected Hardware"
      subtitle="Modules used in the IoT automation prototype"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <article
            key={module.name}
            className="rounded-2xl border border-panel-border bg-black/10 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-xl">
                {module.icon}
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase ${
                  module.healthy
                    ? 'bg-emerald-400/10 text-emerald-300'
                    : 'bg-red-400/10 text-red-300'
                }`}
              >
                {module.status}
              </span>
            </div>

            <p className="mt-5 text-sm font-semibold text-white">
              {module.name}
            </p>

            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-600">
              {module.type}
            </p>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {module.description}
            </p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function SystemArchitecture() {
  return (
    <Panel
      title="System Architecture"
      subtitle="Communication path between hardware and cloud services"
    >
      <div className="grid gap-4 md:grid-cols-5">
        <ArchitectureStep
          number="01"
          title="Sensors"
          description="Flow sensor, RTC and LDR collect system inputs."
          icon="📟"
        />

        <ArchitectureStep
          number="02"
          title="ESP32"
          description="Processes inputs and controls relay outputs."
          icon="🧠"
        />

        <ArchitectureStep
          number="03"
          title="Backend"
          description="Receives telemetry and sends control commands."
          icon="🖥️"
        />

        <ArchitectureStep
          number="04"
          title="PostgreSQL"
          description="Stores history, schedules, alerts and users."
          icon="🗄️"
        />

        <ArchitectureStep
          number="05"
          title="Dashboard"
          description="Displays data and provides operator controls."
          icon="📊"
        />
      </div>
    </Panel>
  );
}

function ArchitectureStep({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <article className="rounded-2xl border border-panel-border bg-black/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xl">{icon}</span>

        <span className="font-mono text-xs font-bold text-cyan-300">
          {number}
        </span>
      </div>

      <p className="mt-5 text-sm font-semibold text-white">
        {title}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </article>
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
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-xl">
        {icon}
      </div>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>

      <p className="mt-2 font-mono text-xl font-bold text-white">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
      </p>
    </article>
  );
}

function InformationCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-panel-border bg-black/10 p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}

function HealthRow({
  label,
  healthy,
  detail,
}: {
  label: string;
  healthy: boolean;
  detail: string;
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
        {detail}
      </span>
    </div>
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
        <div className="h-72 rounded-2xl border border-panel-border bg-panel/40 xl:col-span-7" />
        <div className="h-72 rounded-2xl border border-panel-border bg-panel/40 xl:col-span-5" />
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