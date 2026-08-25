'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import ExportButtons from '@/components/ExportButtons';

import { apiGet } from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface HistoryRecord {
  tank_level_ml?: number | string;
  tankLevelMl?: number | string;

  flow_rate_lpm?: number | string;
  flowRateLpm?: number | string;

  ward1_ml?: number | string;
  ward1Ml?: number | string;

  ward2_ml?: number | string;
  ward2Ml?: number | string;

  ward3_ml?: number | string;
  ward3Ml?: number | string;

  street_light?: boolean;
  streetLight?: boolean;

  recorded_at?: string;
  timestamp?: string;
}

interface DeviceStatus {
  tank_level_ml?: number | string;
  tankLevelMl?: number | string;

  flow_rate_lpm?: number | string;
  flowRateLpm?: number | string;

  ward1_ml?: number | string;
  ward1Ml?: number | string;

  ward2_ml?: number | string;
  ward2Ml?: number | string;

  ward3_ml?: number | string;
  ward3Ml?: number | string;

  street_light?: boolean;
  streetLight?: boolean;

  deviceOnline?: boolean;
  device_online?: boolean;

  recorded_at?: string;
  timestamp?: string;
}

interface Schedule {
  id: number;
  ward_number: number;
  start_time: string;
  end_time: string;
  days_mask?: string;
  quota_ml: number | string;
  is_active: boolean;
  created_by_name?: string;
}

interface AlertRecord {
  id: number;
  alert_type?: string;
  type?: string;
  severity?: string;
  message?: string;
  is_resolved?: boolean;
  created_at?: string;
}

type ReportPeriod = 'today' | '7days' | '30days';

const TANK_CAPACITY_ML = 5000;

export default function ReportsPage() {
  const { status, connected } = useLiveSocket();

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [fallbackStatus, setFallbackStatus] =
    useState<DeviceStatus | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [loading, setLoading] = useState(true);

  const requestedHours =
    period === 'today' ? 24 : period === '7days' ? 168 : 720;

  useEffect(() => {
    let mounted = true;

    async function loadReports() {
      setLoading(true);

      const results = await Promise.allSettled([
        apiGet(`/api/device/history?hours=${requestedHours}`),
        apiGet('/api/device/status'),
        apiGet('/api/schedule'),
        apiGet('/api/device/alerts'),
      ]);

      if (!mounted) return;

      const [
        historyResult,
        statusResult,
        schedulesResult,
        alertsResult,
      ] = results;

      if (historyResult.status === 'fulfilled') {
        setHistory(
          Array.isArray(historyResult.value)
            ? historyResult.value
            : []
        );
      }

      if (statusResult.status === 'fulfilled') {
        setFallbackStatus(statusResult.value);
      }

      if (schedulesResult.status === 'fulfilled') {
        setSchedules(
          Array.isArray(schedulesResult.value)
            ? schedulesResult.value
            : []
        );
      }

      if (alertsResult.status === 'fulfilled') {
        setAlerts(
          Array.isArray(alertsResult.value)
            ? alertsResult.value
            : []
        );
      }

      const failedCount = results.filter(
        (result) => result.status === 'rejected'
      ).length;

      if (failedCount === results.length) {
        toast.error('Unable to load report information.', {
          id: 'reports-load-error',
        });
      }

      setLoading(false);
    }

    loadReports();

    return () => {
      mounted = false;
    };
  }, [requestedHours]);

  const live = (status || fallbackStatus) as DeviceStatus | null;

  const report = useMemo(() => {
    const latest =
      history.length > 0
        ? history[history.length - 1]
        : live;

    const tankLevelMl = toNumber(
      latest?.tankLevelMl ?? latest?.tank_level_ml
    );

    const flowRateLpm = toNumber(
      latest?.flowRateLpm ?? latest?.flow_rate_lpm
    );

    const ward1Ml = toNumber(
      latest?.ward1Ml ?? latest?.ward1_ml
    );

    const ward2Ml = toNumber(
      latest?.ward2Ml ?? latest?.ward2_ml
    );

    const ward3Ml = toNumber(
      latest?.ward3Ml ?? latest?.ward3_ml
    );

    const totalConsumptionMl = ward1Ml + ward2Ml + ward3Ml;

    const tankPercentage = Math.min(
      100,
      Math.max(0, (tankLevelMl / TANK_CAPACITY_ML) * 100)
    );

    const activeSchedules = schedules.filter(
      (schedule) => schedule.is_active
    ).length;

    const unresolvedAlerts = alerts.filter(
      (alert) => alert.is_resolved !== true
    ).length;

    const hardwareOnline =
      live?.deviceOnline === true ||
      live?.device_online === true;

    const streetLight =
      latest?.streetLight ??
      latest?.street_light ??
      false;

    return {
      tankLevelMl,
      tankPercentage,
      flowRateLpm,
      ward1Ml,
      ward2Ml,
      ward3Ml,
      totalConsumptionMl,
      activeSchedules,
      unresolvedAlerts,
      hardwareOnline,
      streetLight,
    };
  }, [history, live, schedules, alerts]);

  const chartPoints = useMemo(() => {
    return history.map((item, index) => {
      const recordedAt =
        item.recorded_at ?? item.timestamp;

      return {
        label: recordedAt
          ? formatChartTime(recordedAt, period)
          : `${index + 1}`,
        flowRate: toNumber(
          item.flowRateLpm ?? item.flow_rate_lpm
        ),
        tankLevel: toNumber(
          item.tankLevelMl ?? item.tank_level_ml
        ),
        consumption:
          toNumber(item.ward1Ml ?? item.ward1_ml) +
          toNumber(item.ward2Ml ?? item.ward2_ml) +
          toNumber(item.ward3Ml ?? item.ward3_ml),
      };
    });
  }, [history, period]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
          connected={connected}
          hardwareOnline={report.hardwareOnline}
        />

        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <ReportsHeader
              connected={connected}
              hardwareOnline={report.hardwareOnline}
              period={period}
              onPeriodChange={setPeriod}
            />

            {loading ? (
              <ReportsLoadingState />
            ) : (
              <>
                <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                  <MetricCard
                    title="Water Distributed"
                    value={`${(
                      report.totalConsumptionMl / 1000
                    ).toFixed(2)} L`}
                    subtitle="Ward total"
                    icon="💧"
                    tone="cyan"
                  />

                  <MetricCard
                    title="Tank Level"
                    value={`${report.tankPercentage.toFixed(1)}%`}
                    subtitle={`${(
                      report.tankLevelMl / 1000
                    ).toFixed(2)} / 5.00 L`}
                    icon="🛢️"
                    tone={
                      report.tankPercentage < 20
                        ? 'red'
                        : 'blue'
                    }
                  />

                  <MetricCard
                    title="Current Flow"
                    value={`${report.flowRateLpm.toFixed(2)}`}
                    unit="L/min"
                    subtitle="YF-S201 sensor"
                    icon="🌊"
                    tone="cyan"
                  />

                  <MetricCard
                    title="Active Schedules"
                    value={`${report.activeSchedules}`}
                    subtitle={`${schedules.length} total`}
                    icon="📅"
                    tone="violet"
                  />

                  <MetricCard
                    title="Street Lights"
                    value={report.streetLight ? 'ON' : 'OFF'}
                    subtitle="Current relay state"
                    icon="💡"
                    tone="amber"
                  />

                  <MetricCard
                    title="Open Alerts"
                    value={`${report.unresolvedAlerts}`}
                    subtitle={`${alerts.length} recorded`}
                    icon="🚨"
                    tone={
                      report.unresolvedAlerts > 0
                        ? 'red'
                        : 'green'
                    }
                  />
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <ReportPanel
                      title="Water Consumption"
                      subtitle="Total ward consumption over the selected period"
                    >
                      <div className="h-[340px]">
                        {chartPoints.length > 0 ? (
                          <Line
                            data={{
                              labels: chartPoints.map(
                                (point) => point.label
                              ),
                              datasets: [
                                {
                                  label: 'Consumption (L)',
                                  data: chartPoints.map(
                                    (point) =>
                                      point.consumption / 1000
                                  ),
                                  borderColor:
                                    'rgba(31, 209, 193, 1)',
                                  backgroundColor:
                                    'rgba(31, 209, 193, 0.12)',
                                  fill: true,
                                  tension: 0.35,
                                  pointRadius: 2,
                                  pointHoverRadius: 5,
                                },
                              ],
                            }}
                            options={lineChartOptions(
                              'Water consumption (L)'
                            )}
                          />
                        ) : (
                          <EmptyChart message="No consumption history is available yet." />
                        )}
                      </div>
                    </ReportPanel>
                  </div>

                  <div className="xl:col-span-4">
                    <ReportPanel
                      title="Ward Distribution"
                      subtitle="Current distribution by ward"
                    >
                      <div className="mx-auto h-[260px] max-w-[310px]">
                        {report.totalConsumptionMl > 0 ? (
                          <Doughnut
                            data={{
                              labels: [
                                'Ward 1',
                                'Ward 2',
                                'Ward 3',
                              ],
                              datasets: [
                                {
                                  data: [
                                    report.ward1Ml,
                                    report.ward2Ml,
                                    report.ward3Ml,
                                  ],
                                  backgroundColor: [
                                    'rgba(59, 130, 246, 0.85)',
                                    'rgba(34, 197, 94, 0.85)',
                                    'rgba(245, 166, 35, 0.85)',
                                  ],
                                  borderColor: [
                                    'rgba(59, 130, 246, 1)',
                                    'rgba(34, 197, 94, 1)',
                                    'rgba(245, 166, 35, 1)',
                                  ],
                                  borderWidth: 1,
                                  spacing: 3,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              cutout: '68%',
                              plugins: {
                                legend: {
                                  position: 'bottom',
                                  labels: {
                                    color: '#94a3b8',
                                    boxWidth: 10,
                                    usePointStyle: true,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <EmptyChart message="No ward consumption recorded yet." />
                        )}
                      </div>

                      <div className="mt-6 space-y-3">
                        <WardProgress
                          label="Ward 1"
                          value={report.ward1Ml}
                          total={report.totalConsumptionMl}
                        />
                        <WardProgress
                          label="Ward 2"
                          value={report.ward2Ml}
                          total={report.totalConsumptionMl}
                        />
                        <WardProgress
                          label="Ward 3"
                          value={report.ward3Ml}
                          total={report.totalConsumptionMl}
                        />
                      </div>
                    </ReportPanel>
                  </div>

                  <div className="xl:col-span-6">
                    <ReportPanel
                      title="Tank-Level History"
                      subtitle="Calculated tank storage over time"
                    >
                      <div className="h-[300px]">
                        {chartPoints.length > 0 ? (
                          <Line
                            data={{
                              labels: chartPoints.map(
                                (point) => point.label
                              ),
                              datasets: [
                                {
                                  label: 'Tank Level (%)',
                                  data: chartPoints.map(
                                    (point) =>
                                      Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          (point.tankLevel /
                                            TANK_CAPACITY_ML) *
                                            100
                                        )
                                      )
                                  ),
                                  borderColor:
                                    'rgba(76, 126, 255, 1)',
                                  backgroundColor:
                                    'rgba(76, 126, 255, 0.12)',
                                  fill: true,
                                  tension: 0.35,
                                  pointRadius: 1.5,
                                },
                              ],
                            }}
                            options={lineChartOptions(
                              'Tank level (%)',
                              100
                            )}
                          />
                        ) : (
                          <EmptyChart message="No tank-level history is available yet." />
                        )}
                      </div>
                    </ReportPanel>
                  </div>

                  <div className="xl:col-span-6">
                    <ReportPanel
                      title="Flow-Rate History"
                      subtitle="YF-S201 flow sensor readings"
                    >
                      <div className="h-[300px]">
                        {chartPoints.length > 0 ? (
                          <Line
                            data={{
                              labels: chartPoints.map(
                                (point) => point.label
                              ),
                              datasets: [
                                {
                                  label: 'Flow Rate (L/min)',
                                  data: chartPoints.map(
                                    (point) => point.flowRate
                                  ),
                                  borderColor:
                                    'rgba(34, 197, 94, 1)',
                                  backgroundColor:
                                    'rgba(34, 197, 94, 0.1)',
                                  fill: true,
                                  tension: 0.35,
                                  pointRadius: 1.5,
                                },
                              ],
                            }}
                            options={lineChartOptions(
                              'Flow rate (L/min)'
                            )}
                          />
                        ) : (
                          <EmptyChart message="No flow-rate history is available yet." />
                        )}
                      </div>
                    </ReportPanel>
                  </div>

                  <div className="xl:col-span-8">
                    <ScheduleReport schedules={schedules} />
                  </div>

                  <div className="xl:col-span-4">
                    <AlertsSummary alerts={alerts} />
                  </div>

                  <div className="xl:col-span-12">
                    <ReportExportPanel />
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

function ReportsHeader({
  connected,
  hardwareOnline,
  period,
  onPeriodChange,
}: {
  connected: boolean;
  hardwareOnline: boolean;
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
}) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
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
              text="Analytics"
              type="neutral"
            />
          </div>

          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Reports &amp; Analytics
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Review water consumption, tank levels, flow rates,
            schedules, alerts and downloadable system reports.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex rounded-xl border border-panel-border bg-black/10 p-1">
            <PeriodButton
              active={period === 'today'}
              onClick={() => onPeriodChange('today')}
            >
              Today
            </PeriodButton>

            <PeriodButton
              active={period === '7days'}
              onClick={() => onPeriodChange('7days')}
            >
              7 Days
            </PeriodButton>

            <PeriodButton
              active={period === '30days'}
              onClick={() => onPeriodChange('30days')}
            >
              30 Days
            </PeriodButton>
          </div>

          <ExportButtons />
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: string;
  unit?: string;
  subtitle: string;
  icon: string;
  tone:
    | 'cyan'
    | 'blue'
    | 'green'
    | 'violet'
    | 'amber'
    | 'red';
}) {
  const tones = {
    cyan: 'bg-cyan-400/10 text-cyan-300',
    blue: 'bg-blue-400/10 text-blue-300',
    green: 'bg-emerald-400/10 text-emerald-300',
    violet: 'bg-violet-400/10 text-violet-300',
    amber: 'bg-amber-400/10 text-amber-300',
    red: 'bg-red-400/10 text-red-300',
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

      <p className="mt-2 font-mono text-2xl font-bold text-white">
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-slate-500">
            {unit}
          </span>
        )}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
      </p>
    </article>
  );
}

function ReportPanel({
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

function ScheduleReport({
  schedules,
}: {
  schedules: Schedule[];
}) {
  return (
    <ReportPanel
      title="Schedule Report"
      subtitle="Current water-distribution schedules"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-panel-border text-xs text-slate-500">
              <th className="px-3 py-3 font-medium">Ward</th>
              <th className="px-3 py-3 font-medium">Start</th>
              <th className="px-3 py-3 font-medium">End</th>
              <th className="px-3 py-3 font-medium">Days</th>
              <th className="px-3 py-3 font-medium">Quota</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">
                Created By
              </th>
            </tr>
          </thead>

          <tbody>
            {schedules.map((schedule) => (
              <tr
                key={schedule.id}
                className="border-b border-panel-border/50 text-slate-300"
              >
                <td className="px-3 py-4 font-medium text-white">
                  Ward {schedule.ward_number}
                </td>

                <td className="px-3 py-4 font-mono">
                  {formatTime(schedule.start_time)}
                </td>

                <td className="px-3 py-4 font-mono">
                  {formatTime(schedule.end_time)}
                </td>

                <td className="max-w-[180px] truncate px-3 py-4 text-xs">
                  {schedule.days_mask || 'Every day'}
                </td>

                <td className="px-3 py-4 font-mono">
                  {toNumber(
                    schedule.quota_ml
                  ).toLocaleString()}{' '}
                  mL
                </td>

                <td className="px-3 py-4">
                  <StatusBadge
                    text={
                      schedule.is_active
                        ? 'Active'
                        : 'Paused'
                    }
                    type={
                      schedule.is_active
                        ? 'success'
                        : 'neutral'
                    }
                  />
                </td>

                <td className="px-3 py-4 text-xs">
                  {schedule.created_by_name || 'System'}
                </td>
              </tr>
            ))}

            {schedules.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-12 text-center text-sm text-slate-500"
                >
                  No schedules are configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportPanel>
  );
}

function AlertsSummary({
  alerts,
}: {
  alerts: AlertRecord[];
}) {
  const visibleAlerts = alerts.slice(0, 5);

  return (
    <ReportPanel
      title="Recent Alerts"
      subtitle="Latest recorded system events"
    >
      <div className="space-y-3">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-xl border border-white/5 bg-black/10 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  {formatAlertTitle(alert)}
                </p>

                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {alert.message ||
                    'System alert recorded.'}
                </p>
              </div>

              <StatusBadge
                text={alert.severity || 'Info'}
                type={severityType(alert.severity)}
              />
            </div>

            <p className="mt-2 text-[10px] text-slate-600">
              {alert.created_at
                ? new Date(
                    alert.created_at
                  ).toLocaleString()
                : 'Time unavailable'}
            </p>
          </div>
        ))}

        {visibleAlerts.length === 0 && (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-5 text-center">
            <p className="text-sm font-semibold text-emerald-300">
              No alerts recorded
            </p>
            <p className="mt-1 text-xs text-emerald-100/50">
              The report contains no alert history.
            </p>
          </div>
        )}
      </div>
    </ReportPanel>
  );
}

function ReportExportPanel() {
  function printReport() {
    window.print();
  }

  return (
    <ReportPanel
      title="Generate Report"
      subtitle="Download or print the current analytics report"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            Water &amp; Street Light Automation Report
          </p>

          <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">
            Reports include water consumption, tank status,
            flow-rate history, ward information, schedules and
            system alerts.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <ExportButtons />

          <button
            type="button"
            onClick={printReport}
            className="rounded-xl border border-panel-border bg-black/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-300"
          >
            Print Report
          </button>
        </div>
      </div>
    </ReportPanel>
  );
}

function WardProgress({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage =
    total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          {label}
        </span>

        <span className="font-mono text-xs text-slate-300">
          {(value / 1000).toFixed(2)} L
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-panel-border bg-black/10 px-6 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function PeriodButton({
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
      className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
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

function ReportsLoadingState() {
  return (
    <div className="mt-6 animate-pulse space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-40 rounded-2xl border border-panel-border bg-panel/40"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="h-[420px] rounded-2xl border border-panel-border bg-panel/40 xl:col-span-8" />
        <div className="h-[420px] rounded-2xl border border-panel-border bg-panel/40 xl:col-span-4" />
      </div>
    </div>
  );
}

function lineChartOptions(
  title: string,
  suggestedMax?: number
) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          boxWidth: 10,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: '#0b1524',
        borderColor: '#232b3d',
        borderWidth: 1,
        titleColor: '#ffffff',
        bodyColor: '#cbd5e1',
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#64748b',
          maxTicksLimit: 10,
        },
        grid: {
          color: 'rgba(35, 43, 61, 0.45)',
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax,
        title: {
          display: true,
          text: title,
          color: '#64748b',
        },
        ticks: {
          color: '#64748b',
        },
        grid: {
          color: 'rgba(35, 43, 61, 0.45)',
        },
      },
    },
  };
}

function formatChartTime(
  value: string,
  period: ReportPeriod
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (period === 'today') {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  });
}

function formatTime(value: string) {
  return value?.slice(0, 5) || '--:--';
}

function formatAlertTitle(alert: AlertRecord) {
  const value = alert.alert_type ?? alert.type ?? 'System alert';

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function severityType(
  severity?: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = severity?.toLowerCase();

  if (
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'error'
  ) {
    return 'danger';
  }

  if (
    normalized === 'warning' ||
    normalized === 'medium'
  ) {
    return 'warning';
  }

  if (
    normalized === 'success' ||
    normalized === 'resolved'
  ) {
    return 'success';
  }

  return 'neutral';
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}