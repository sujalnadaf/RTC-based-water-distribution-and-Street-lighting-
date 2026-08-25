'use client';

import { motion } from 'framer-motion';

interface Ward {
  ward_number: number;
  ward_name: string;
}

interface Props {
  wards: Ward[];
  consumption: { ward1Ml: number; ward2Ml: number; ward3Ml: number };
  activeWard: number;
  capacityMl?: number;
}

export default function WardConsumption({ wards, consumption, activeWard, capacityMl = 5000 }: Props) {
  const values = [consumption.ward1Ml, consumption.ward2Ml, consumption.ward3Ml];

  return (
    <div className="panel-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="gauge-label">Ward Consumption</span>
        <span className="gauge-label text-signal-cyan">Active: {activeWard ? `Ward ${activeWard}` : 'None'}</span>
      </div>
      <div className="space-y-4">
        {wards.map((ward, i) => {
          const ml = values[i] ?? 0;
          const pct = Math.min(100, (ml / capacityMl) * 100);
          const isActive = activeWard === ward.ward_number;
          return (
            <div key={ward.ward_number}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className={`font-medium ${isActive ? 'text-signal-cyan' : 'text-slate-300'}`}>
                  {ward.ward_name} {isActive && '●'}
                </span>
                <span className="font-mono text-xs text-slate-400">{ml.toLocaleString()} mL</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/30">
                <motion.div
                  className={`h-full rounded-full ${isActive ? 'bg-signal-cyan' : 'bg-signal-steel'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
