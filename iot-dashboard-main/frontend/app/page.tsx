'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const features = [
  {
    title: 'Smart Water Distribution',
    description:
      'Schedule and monitor ward-wise water distribution with quota tracking, valve control, and consumption history.',
    icon: '💧',
  },
  {
    title: 'Street Light Automation',
    description:
      'Control street lights using LDR-based automation, timed power-saving windows, and manual override.',
    icon: '💡',
  },
  {
    title: 'Live IoT Monitoring',
    description:
      'Track tank level, flow rate, device status, alerts, and ward consumption through a real-time dashboard.',
    icon: '📡',
  },
  {
    title: 'Reports and Analytics',
    description:
      'Export PDF and Excel reports, review usage trends, and analyse system performance.',
    icon: '📊',
  },
];

const techStack = [
  'Next.js',
  'Node.js',
  'Express',
  'PostgreSQL',
  'Supabase',
  'WebSocket',
  'ESP32',
  'Vercel',
  'Render',
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050b14]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050b14] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-120px] top-[-80px] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-100px] top-[180px] h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-[-150px] left-[30%] h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#050b14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl ring-1 ring-cyan-400/30">
              💧
            </div>

            <div>
              <p className="text-lg font-bold tracking-wide">WATER-IOT</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Smart Automation
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-cyan-300">
              Features
            </a>
            <a href="#architecture" className="transition hover:text-cyan-300">
              Architecture
            </a>
            <a href="#technology" className="transition hover:text-cyan-300">
              Technology
            </a>
          </nav>

          <Link
            href="/login"
            className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Sign In
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-20 md:px-8 lg:grid-cols-2 lg:pb-28 lg:pt-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-medium text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Cloud-deployed IoT automation platform
          </div>

          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Smarter water distribution and street lighting
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              through IoT automation
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            A real-time monitoring and control platform for automated water
            distribution, ward scheduling, tank monitoring, street-light
            operation, alerts, analytics, and reporting.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-xl bg-cyan-400 px-6 py-3.5 text-center font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Open Control Panel
            </Link>

            <a
              href="#features"
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-center font-semibold text-white transition hover:border-cyan-400/30 hover:bg-white/10"
            >
              Explore Features
            </a>
          </div>

          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            <Metric value="3" label="Water Wards" />
            <Metric value="24/7" label="Cloud Access" />
            <Metric value="2" label="User Roles" />
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 scale-90 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative rounded-3xl border border-white/10 bg-[#0c1524]/90 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-semibold">Live System Preview</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Operator dashboard
                </p>
              </div>

              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Online
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <PreviewCard
                label="Tank Level"
                value="68.5%"
                subtext="3.42 / 5.00 L"
                accent="cyan"
              />
              <PreviewCard
                label="Flow Rate"
                value="12.4 L"
                subtext="Today's consumption"
                accent="green"
              />
              <PreviewCard
                label="Active Schedules"
                value="3"
                subtext="Ward automation"
                accent="violet"
              />
              <PreviewCard
                label="Street Lights"
                value="24 ON"
                subtext="Automatic mode"
                accent="amber"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold">Ward Distribution</p>
                <p className="text-xs text-slate-500">Live status</p>
              </div>

              <WardRow ward="Ward 1" usage="70%" status="Active" />
              <WardRow ward="Ward 2" usage="68%" status="Active" />
              <WardRow ward="Ward 3" usage="42%" status="Idle" />
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative z-10 border-y border-white/10 bg-white/[0.02]"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Core Features
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              One platform for monitoring, control, and automation
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Designed for operators and users with role-based access,
              real-time updates, scheduling, alerts, and downloadable reports.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-[#0b1422] p-6 transition hover:-translate-y-1 hover:border-cyan-400/30"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="architecture"
        className="relative z-10 mx-auto max-w-7xl px-5 py-20 md:px-8"
      >
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              System Architecture
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Built as a complete full-stack IoT platform
            </h2>
            <p className="mt-5 leading-8 text-slate-400">
              The dashboard connects the frontend, backend, cloud database,
              WebSocket service, and ESP32 hardware into one integrated system.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-5 sm:items-center">
            <ArchitectureBox title="ESP32" subtitle="Sensors & relays" />
            <Arrow />
            <ArchitectureBox title="Backend" subtitle="API & WebSocket" />
            <Arrow />
            <ArchitectureBox title="Dashboard" subtitle="Web interface" />
          </div>
        </div>
      </section>

      <section
        id="technology"
        className="relative z-10 border-y border-white/10 bg-white/[0.02]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Technology Stack
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Modern tools for a scalable project
            </h2>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {techStack.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-[#0b1422] px-5 py-2.5 text-sm text-slate-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-5 py-20 text-center md:px-8">
        <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-violet-500/10 px-6 py-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Ready to monitor the system?
          </p>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Access the operator and user control panel
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-400">
            Sign in to view live information, manage schedules, control
            devices, and export project reports.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex rounded-xl bg-cyan-400 px-7 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Continue to Login
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-8">
          <p>
            Water Distribution & Street Light Automation System
          </p>
          <p>Developed by WaterBabies</p>
        </div>
      </footer>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xl font-bold text-cyan-300">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PreviewCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: string;
  subtext: string;
  accent: 'cyan' | 'green' | 'violet' | 'amber';
}) {
  const accentClasses = {
    cyan: 'text-cyan-300 bg-cyan-400/10',
    green: 'text-emerald-300 bg-emerald-400/10',
    violet: 'text-violet-300 bg-violet-400/10',
    amber: 'text-amber-300 bg-amber-400/10',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className={`mt-3 inline-flex rounded-lg px-2 py-1 text-xl font-bold ${accentClasses[accent]}`}>
        {value}
      </p>
      <p className="mt-3 text-xs text-slate-500">{subtext}</p>
    </div>
  );
}

function WardRow({
  ward,
  usage,
  status,
}: {
  ward: string;
  usage: string;
  status: string;
}) {
  const isActive = status === 'Active';

  return (
    <div className="mb-3 grid grid-cols-[1fr_1fr_auto] items-center gap-3 last:mb-0">
      <p className="text-sm text-slate-300">{ward}</p>

      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
          style={{ width: usage }}
        />
      </div>

      <span
        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
          isActive
            ? 'bg-emerald-400/10 text-emerald-300'
            : 'bg-slate-400/10 text-slate-400'
        }`}
      >
        {status}
      </span>
    </div>
  );
}

function ArchitectureBox({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1422] p-5 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden text-center text-xl text-cyan-300 sm:block">→</div>
  );
}