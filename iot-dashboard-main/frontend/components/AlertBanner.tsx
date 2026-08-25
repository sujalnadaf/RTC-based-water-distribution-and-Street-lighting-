'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  leakDetected: boolean;
  dryTank: boolean;
}

export default function AlertBanner({ leakDetected, dryTank }: Props) {
  const alerts: { key: string; message: string }[] = [];
  if (leakDetected) alerts.push({ key: 'leak', message: 'Leak detected — flow registered with all valves closed.' });
  if (dryTank) alerts.push({ key: 'dry', message: 'Dry-tank condition — tank level critically low. All valves disabled.' });

  return (
    <AnimatePresence>
      {alerts.map((a) => (
        <motion.div
          key={a.key}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="mb-4 flex items-center gap-3 rounded-xl border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red animate-pulseBorder"
        >
          <span className="text-lg">🚨</span>
          <span>{a.message}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
