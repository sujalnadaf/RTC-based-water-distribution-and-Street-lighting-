'use client';

import { useEffect, useState } from 'react';

type Settings = {
  theme: 'dark' | 'light';
  accent: 'cyan' | 'blue' | 'green' | 'purple';
  compactMode: boolean;
  animations: boolean;
  sidebarCollapsed: boolean;
  showWaterCard: boolean;
  showLightingCard: boolean;
  showCharts: boolean;
  showRecentActivity: boolean;
  refreshRate: '5' | '10' | '30' | '0';
  chartType: 'line' | 'bar' | 'doughnut';
  popupNotifications: boolean;
  notificationSound: boolean;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  timeFormat: '12-hour' | '24-hour';
};

const STORAGE_KEY = 'water-iot-frontend-settings';

const defaults: Settings = {
  theme: 'dark',
  accent: 'cyan',
  compactMode: false,
  animations: true,
  sidebarCollapsed: false,
  showWaterCard: true,
  showLightingCard: true,
  showCharts: true,
  showRecentActivity: true,
  refreshRate: '10',
  chartType: 'line',
  popupNotifications: true,
  notificationSound: false,
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12-hour',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      setSettings({ ...defaults, ...JSON.parse(stored) });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    document.documentElement.dataset.accent = settings.accent;
    window.dispatchEvent(
      new CustomEvent('frontend-settings-changed', { detail: settings }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function reset() {
    setSettings(defaults);
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.classList.remove('light');
    document.documentElement.dataset.accent = 'cyan';
    window.dispatchEvent(
      new CustomEvent('frontend-settings-changed', { detail: defaults }),
    );
    setSaved(false);
  }

  return (
    <main className="min-h-screen bg-base px-4 pb-12 pt-24 text-white sm:px-6 lg:ml-56 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            System
          </p>
          <h1 className="mt-2 text-3xl font-bold">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            These settings only change the website interface. They do not change
            the ESP32, RTC, LDR, flow sensor, relays or valves.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Appearance">
            <Select label="Theme" value={settings.theme}
              onChange={(v) => update('theme', v as Settings['theme'])}
              options={[['dark','Dark'],['light','Light']]} />
            <Select label="Accent colour" value={settings.accent}
              onChange={(v) => update('accent', v as Settings['accent'])}
              options={[['cyan','Cyan'],['blue','Blue'],['green','Green'],['purple','Purple']]} />
            <Toggle label="Compact mode" checked={settings.compactMode}
              onChange={(v) => update('compactMode', v)} />
            <Toggle label="Animations" checked={settings.animations}
              onChange={(v) => update('animations', v)} />
            <Toggle label="Collapse sidebar" checked={settings.sidebarCollapsed}
              onChange={(v) => update('sidebarCollapsed', v)} />
          </Card>

          <Card title="Dashboard">
            <Toggle label="Show water card" checked={settings.showWaterCard}
              onChange={(v) => update('showWaterCard', v)} />
            <Toggle label="Show street-light card" checked={settings.showLightingCard}
              onChange={(v) => update('showLightingCard', v)} />
            <Toggle label="Show charts" checked={settings.showCharts}
              onChange={(v) => update('showCharts', v)} />
            <Toggle label="Show recent activity" checked={settings.showRecentActivity}
              onChange={(v) => update('showRecentActivity', v)} />
            <Select label="Auto refresh" value={settings.refreshRate}
              onChange={(v) => update('refreshRate', v as Settings['refreshRate'])}
              options={[['5','Every 5 seconds'],['10','Every 10 seconds'],['30','Every 30 seconds'],['0','Manual only']]} />
            <Select label="Default chart type" value={settings.chartType}
              onChange={(v) => update('chartType', v as Settings['chartType'])}
              options={[['line','Line chart'],['bar','Bar chart'],['doughnut','Doughnut chart']]} />
          </Card>

          <Card title="Notifications">
            <Toggle label="Popup notifications" checked={settings.popupNotifications}
              onChange={(v) => update('popupNotifications', v)} />
            <Toggle label="Notification sound" checked={settings.notificationSound}
              onChange={(v) => update('notificationSound', v)} />
          </Card>

          <Card title="Preferences">
            <Select label="Date format" value={settings.dateFormat}
              onChange={(v) => update('dateFormat', v as Settings['dateFormat'])}
              options={[['DD/MM/YYYY','DD/MM/YYYY'],['MM/DD/YYYY','MM/DD/YYYY']]} />
            <Select label="Time format" value={settings.timeFormat}
              onChange={(v) => update('timeFormat', v as Settings['timeFormat'])}
              options={[['12-hour','12-hour'],['24-hour','24-hour']]} />
            <div className="rounded-xl border border-panel-border bg-white/[0.025] p-4 text-sm text-slate-400">
              Saved in browser localStorage. No backend or database change is required.
            </div>
          </Card>
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-panel-border bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">Hardware operation remains unchanged.</p>
          <div className="flex gap-3">
            <button onClick={reset}
              className="rounded-xl border border-panel-border px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">
              Reset
            </button>
            <button onClick={save}
              className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300">
              {saved ? 'Saved ✓' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-border bg-white/[0.035] p-5">
      <h2 className="mb-5 border-b border-panel-border pb-4 text-lg font-bold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Toggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-panel-border bg-black/10 p-4">
      <span className="text-sm font-semibold">{label}</span>
      <button type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-cyan-400' : 'bg-slate-700'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-panel-border bg-[#0b1524] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60">
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}
