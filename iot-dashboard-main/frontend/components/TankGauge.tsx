'use client';

import { motion } from 'framer-motion';

interface Props {
  levelMl: number;
  capacityMl?: number;
  dryTank: boolean;
}

export default function TankGauge({ levelMl, capacityMl = 5000, dryTank }: Props) {
  const pct = Math.max(0, Math.min(100, (levelMl / capacityMl) * 100));
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color = dryTank ? '#EF4444' : pct < 20 ? '#F5A623' : '#1FD1C1';

  return (
    <div className="panel-card flex flex-col items-center p-6">
      <div className="mb-4 flex w-full items-center justify-between">
        <span className="gauge-label">Tank Level</span>
        {dryTank && <span className="gauge-label animate-pulseBorder rounded bg-signal-red/20 px-2 py-0.5 text-signal-red">Dry Tank</span>}
      </div>

      <div className="relative h-48 w-48">
        <svg width="192" height="192" viewBox="0 0 192 192" className="-rotate-90">
          <circle cx="96" cy="96" r={radius} fill="none" stroke="currentColor" className="text-panel-border" strokeWidth="14" />
          <motion.circle
            cx="96"
            cy="96"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold text-white">{pct.toFixed(0)}%</span>
          <span className="font-mono text-xs text-slate-400">{levelMl.toLocaleString()} / {capacityMl.toLocaleString()} mL</span>
        </div>
      </div>
    </div>
  );
}
