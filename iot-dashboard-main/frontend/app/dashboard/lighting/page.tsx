'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import StreetLightCard from '@/components/StreetLightCard';

import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';

type LightMode = 'on' | 'off' | 'auto';

interface LightingStatus {
  streetLight?: boolean;
  street_light?: boolean;

  lightMode?: LightMode;
  light_mode?: LightMode;

  ldrValue?: number;
  ldr_value?: number;

  ambientLux?: number;
  ambient_lux?: number;

  powerSaving?: boolean;
  power_saving?: boolean;

  deviceOnline?: boolean;
  device_online?: boolean;

  timestamp?: string;
  recorded_at?: string;
}

export default function StreetLightingPage() {
  const { isOperator } = useAuth();
  const { status, connected } = useLiveSocket();

  const [fallbackStatus, setFallbackStatus] =
    useState<LightingStatus | null>(null);

  const [selectedMode, setSelectedMode] =
    useState<LightMode>('auto');

  const [changingMode, setChangingMode] =
    useState<LightMode | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const data = await apiGet('/api/device/status');

        if (!mounted) return;

        setFallbackStatus(data);

        const returnedMode =
          data?.lightMode ?? data?.light_mode;

        if (
          returnedMode === 'on' ||
          returnedMode === 'off' ||
          returnedMode === 'auto'
        ) {
          setSelectedMode(returnedMode);
        }
      } catch {
        /*
         * The page can still display WebSocket data if available.
         * ESP32 offline state is already handled by the dashboard.
         */
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const live = (status || fallbackStatus) as LightingStatus | null;

  const lighting = useMemo(() => {
    const isOn =
      live?.streetLight ??
      live?.street_light ??
      false;

    const hardwareOnline =
      live?.deviceOnline === true ||
      live?.device_online === true;

    const mode =
      live?.lightMode ??
      live?.light_mode ??
      selectedMode;

    const ldrValue = toOptionalNumber(
      live?.ldrValue ?? live?.ldr_value
    );

    const ambientLux = toOptionalNumber(
      live?.ambientLux ?? live?.ambient_lux
    );

    const powerSaving =
      live?.powerSaving ??
      live?.power_saving ??
      false;

    const updatedAt =
      live?.timestamp ??
      live?.recorded_at ??
      null;

    return {
      isOn,
      hardwareOnline,
      mode,
      ldrValue,
      ambientLux,
      powerSaving,
      updatedAt,
    };
  }, [live, selectedMode]);

  async function changeLightMode(mode: LightMode) {
    if (!isOperator) {
      toast.error('Only an operator can control street lights.');
      return;
    }

    if (!lighting.hardwareOnline) {
      toast.error(
        'ESP32 is offline. Connect the hardware before sending a lighting command.',
        {
          id: 'lighting-hardware-offline',
        }
      );
      return;
    }

    setChangingMode(mode);

    try {
      await apiPost('/api/device/light', { mode });

      setSelectedMode(mode);

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
      setChangingMode(null);
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
          connected={connected}
          hardwareOnline={lighting.hardwareOnline}
        />

        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <PageHeader
              connected={connected}
              hardwareOnline={lighting.hardwareOnline}
              isOperator={isOperator}
              isOn={lighting.isOn}
            />

            {loading ? (
              <LoadingState />
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <Panel
                    title="Street-Light Status"
                    subtitle="Current relay and lighting state"
                  >
                    <StreetLightCard isOn={lighting.isOn} />
                  </Panel>
                </div>

                <div className="lg:col-span-8">
                  <Panel
                    title="Lighting Control"
                    subtitle={
                      isOperator
                        ? 'Select automatic or manual operating mode'
                        : 'Viewer accounts have read-only access'
                    }
                  >
                    <ModeControl
                      currentMode={lighting.mode}
                      changingMode={changingMode}
                      disabled={
                        !isOperator ||
                        !lighting.hardwareOnline
                      }
                      onChange={changeLightMode}
                    />

                    {!lighting.hardwareOnline && (
                      <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                        <p className="text-sm font-semibold text-amber-300">
                          Hardware controls are unavailable
                        </p>

                        <p className="mt-1 text-xs leading-5 text-amber-100/50">
                          The website and cloud backend are online,
                          but the ESP32 has not been connected yet.
                          Control buttons will become available after
                          the hardware starts reporting online.
                        </p>
                      </div>
                    )}
                  </Panel>
                </div>

                <div className="lg:col-span-4">
                  <SensorPanel
                    ldrValue={lighting.ldrValue}
                    ambientLux={lighting.ambientLux}
                    hardwareOnline={lighting.hardwareOnline}
                  />
                </div>

                <div className="lg:col-span-4">
                  <PowerSavingPanel
                    enabled={lighting.powerSaving}
                    mode={lighting.mode}
                  />
                </div>

                <div className="lg:col-span-4">
                  <SystemPanel
                    connected={connected}
                    hardwareOnline={lighting.hardwareOnline}
                    updatedAt={lighting.updatedAt}
                  />
                </div>

                <div className="lg:col-span-12">
                  <OperatingGuide />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function PageHeader({
  connected,
  hardwareOnline,
  isOperator,
  isOn,
}: {
  connected: boolean;
  hardwareOnline: boolean;
  isOperator: boolean;
  isOn: boolean;
}) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusBadge
              label={
                connected
                  ? 'Cloud connected'
                  : 'Cloud reconnecting'
              }
              type={connected ? 'success' : 'warning'}
            />

            <StatusBadge
              label={
                hardwareOnline
                  ? 'ESP32 online'
                  : 'ESP32 offline'
              }
              type={hardwareOnline ? 'success' : 'danger'}
            />

            <StatusBadge
              label={
                isOperator
                  ? 'Operator access'
                  : 'Viewer access'
              }
              type="neutral"
            />
          </div>

          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Street Lighting
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Monitor street-light status and control manual or
            automatic lighting operation through the ESP32 relay
            system.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <HeaderMetric
            label="Lights"
            value={isOn ? 'ON' : 'OFF'}
            type={isOn ? 'success' : 'neutral'}
          />

          <HeaderMetric
            label="Hardware"
            value={hardwareOnline ? 'Online' : 'Offline'}
            type={hardwareOnline ? 'success' : 'danger'}
          />

          <HeaderMetric
            label="Control"
            value={isOperator ? 'Enabled' : 'Read only'}
            type={isOperator ? 'success' : 'neutral'}
          />
        </div>
      </div>
    </section>
  );
}

function ModeControl({
  currentMode,
  changingMode,
  disabled,
  onChange,
}: {
  currentMode: LightMode;
  changingMode: LightMode | null;
  disabled: boolean;
  onChange: (mode: LightMode) => void;
}) {
  const modes: Array<{
    mode: LightMode;
    title: string;
    description: string;
    icon: string;
  }> = [
    {
      mode: 'auto',
      title: 'Automatic',
      description: 'ESP32 controls lighting using the LDR and schedule.',
      icon: '⚙️',
    },
    {
      mode: 'on',
      title: 'Force ON',
      description: 'Manually switch the street-light relay ON.',
      icon: '💡',
    },
    {
      mode: 'off',
      title: 'Force OFF',
      description: 'Manually switch the street-light relay OFF.',
      icon: '🌑',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {modes.map((item) => {
        const active = currentMode === item.mode;
        const loading = changingMode === item.mode;

        return (
          <button
            key={item.mode}
            type="button"
            disabled={disabled || changingMode !== null}
            onClick={() => onChange(item.mode)}
            className={`rounded-2xl border p-5 text-left transition ${
              active
                ? 'border-cyan-400/35 bg-cyan-400/10 ring-1 ring-cyan-400/10'
                : 'border-panel-border bg-black/10 hover:border-cyan-400/20'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-2xl">{item.icon}</span>

              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  active
                    ? 'bg-cyan-300'
                    : 'bg-slate-700'
                }`}
              />
            </div>

            <p className="mt-4 text-sm font-semibold text-white">
              {loading ? 'Sending…' : item.title}
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              {item.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function SensorPanel({
  ldrValue,
  ambientLux,
  hardwareOnline,
}: {
  ldrValue: number | null;
  ambientLux: number | null;
  hardwareOnline: boolean;
}) {
  const darknessDetected =
    ldrValue !== null ? ldrValue < 500 : null;

  return (
    <Panel
      title="Ambient-Light Sensor"
      subtitle="LDR sensor information"
    >
      <div className="space-y-3">
        <InformationRow
          label="LDR reading"
          value={
            ldrValue !== null
              ? ldrValue.toFixed(0)
              : 'Not available'
          }
        />

        <InformationRow
          label="Ambient light"
          value={
            ambientLux !== null
              ? `${ambientLux.toFixed(1)} lux`
              : 'Not available'
          }
        />

        <InformationRow
          label="Darkness detected"
          value={
            darknessDetected === null
              ? 'Unknown'
              : darknessDetected
                ? 'Yes'
                : 'No'
          }
        />

        <InformationRow
          label="Sensor status"
          value={hardwareOnline ? 'Connected' : 'Offline'}
          type={hardwareOnline ? 'success' : 'danger'}
        />
      </div>
    </Panel>
  );
}

function PowerSavingPanel({
  enabled,
  mode,
}: {
  enabled: boolean;
  mode: LightMode;
}) {
  return (
    <Panel
      title="Power-Saving Mode"
      subtitle="Scheduled energy-saving operation"
    >
      <div className="rounded-2xl border border-panel-border bg-black/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Midnight power saving
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Selected lights can remain OFF during low-traffic
              hours and return to automatic control in the morning.
            </p>
          </div>

          <StatusBadge
            label={enabled ? 'Enabled' : 'Inactive'}
            type={enabled ? 'success' : 'neutral'}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniMetric label="Planned OFF" value="12:00 AM" />
          <MiniMetric label="Planned AUTO" value="05:00 AM" />
        </div>

        <p className="mt-4 text-xs text-slate-600">
          Current operating mode:{' '}
          <span className="font-semibold uppercase text-slate-400">
            {mode}
          </span>
        </p>
      </div>
    </Panel>
  );
}

function SystemPanel({
  connected,
  hardwareOnline,
  updatedAt,
}: {
  connected: boolean;
  hardwareOnline: boolean;
  updatedAt: string | null;
}) {
  return (
    <Panel
      title="Lighting-System Health"
      subtitle="Cloud and device connectivity"
    >
      <div className="space-y-3">
        <HealthRow
          label="Backend WebSocket"
          healthy={connected}
        />

        <HealthRow
          label="ESP32 controller"
          healthy={hardwareOnline}
        />

        <HealthRow
          label="LDR sensor"
          healthy={hardwareOnline}
        />

        <HealthRow
          label="Relay controller"
          healthy={hardwareOnline}
        />
      </div>

      <div className="mt-5 rounded-xl border border-white/5 bg-black/10 p-3">
        <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
          Last hardware update
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {updatedAt
            ? formatDate(updatedAt)
            : 'No hardware data received yet'}
        </p>
      </div>
    </Panel>
  );
}

function OperatingGuide() {
  return (
    <Panel
      title="Operating Logic"
      subtitle="How the street-light automation works"
    >
      <div className="grid gap-4 md:grid-cols-4">
        <GuideStep
          number="01"
          title="Measure light"
          description="The LDR measures surrounding brightness."
        />

        <GuideStep
          number="02"
          title="Check mode"
          description="ESP32 checks automatic, ON or OFF mode."
        />

        <GuideStep
          number="03"
          title="Control relay"
          description="The relay switches the street lights."
        />

        <GuideStep
          number="04"
          title="Update cloud"
          description="Status is sent to the online dashboard."
        />
      </div>
    </Panel>
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
  type,
}: {
  label: string;
  value: string;
  type: 'success' | 'danger' | 'neutral';
}) {
  const styles = {
    success: 'text-emerald-300',
    danger: 'text-red-300',
    neutral: 'text-white',
  };

  return (
    <div className="min-w-28 rounded-xl border border-panel-border bg-black/10 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
        {label}
      </p>

      <p className={`mt-1 text-sm font-semibold ${styles[type]}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  label,
  type,
}: {
  label: string;
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
      {label}
    </span>
  );
}

function InformationRow({
  label,
  value,
  type = 'neutral',
}: {
  label: string;
  value: string;
  type?: 'success' | 'danger' | 'neutral';
}) {
  const styles = {
    success: 'text-emerald-300',
    danger: 'text-red-300',
    neutral: 'text-slate-300',
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/10 px-3 py-3">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className={`text-xs font-semibold ${styles[type]}`}>
        {value}
      </span>
    </div>
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
        {healthy ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
      <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-300">
        {value}
      </p>
    </div>
  );
}

function GuideStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-panel-border bg-black/10 p-5">
      <span className="font-mono text-sm font-bold text-cyan-300">
        {number}
      </span>

      <p className="mt-4 text-sm font-semibold text-white">
        {title}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 grid animate-pulse gap-6 lg:grid-cols-12">
      <div className="h-72 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-4" />
      <div className="h-72 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-8" />
      <div className="h-64 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-4" />
      <div className="h-64 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-4" />
      <div className="h-64 rounded-2xl border border-panel-border bg-panel/40 lg:col-span-4" />
    </div>
  );
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}