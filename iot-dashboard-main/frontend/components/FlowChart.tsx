'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export interface HistoryPoint {
  recorded_at: string;
  tank_level_ml: number;
  flow_rate_lpm: number;
}

export default function FlowChart({ history }: { history: HistoryPoint[] }) {
  const labels = history.map((h) =>
    new Date(h.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const data = {
    labels,
    datasets: [
      {
        label: 'Tank Level (mL)',
        data: history.map((h) => h.tank_level_ml),
        borderColor: '#1FD1C1',
        backgroundColor: 'rgba(31,209,193,0.12)',
        fill: true,
        tension: 0.35,
        yAxisID: 'y',
        pointRadius: 0,
      },
      {
        label: 'Flow Rate (L/min)',
        data: history.map((h) => h.flow_rate_lpm),
        borderColor: '#F5A623',
        backgroundColor: 'rgba(245,166,35,0.08)',
        fill: false,
        tension: 0.35,
        yAxisID: 'y1',
        pointRadius: 0,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#94A3B8', font: { family: 'var(--font-body)' } } },
    },
    scales: {
      x: { ticks: { color: '#64748B' }, grid: { color: 'rgba(148,163,184,0.06)' } },
      y: { position: 'left', ticks: { color: '#64748B' }, grid: { color: 'rgba(148,163,184,0.06)' } },
      y1: { position: 'right', ticks: { color: '#64748B' }, grid: { display: false } },
    },
  };

  return (
    <div className="panel-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="gauge-label">Live Trend</span>
        <span className="gauge-label text-signal-cyan">Last {history.length} samples</span>
      </div>
      <div className="h-64">
        {history.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Waiting for sensor history…
          </div>
        )}
      </div>
    </div>
  );
}
