'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

type ServerStatus = 'checking' | 'online' | 'offline';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] =
    useState<ServerStatus>('checking');

  useEffect(() => {
    async function checkServer() {
      try {
        const response = await fetch(`${API_URL}/api/health`, {
          cache: 'no-store',
        });

        setServerStatus(response.ok ? 'online' : 'offline');
      } catch {
        setServerStatus('offline');
      }
    }

    checkServer();

    const interval = window.setInterval(checkServer, 30000);

    return () => window.clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error('Enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);
      toast.success('Access granted.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed.';

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function copyCredential(
    value: string,
    label: string
  ) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error('Unable to copy.');
    }
  }

  function fillDemoAccount(
    accountEmail: string,
    accountPassword: string
  ) {
    setEmail(accountEmail);
    setPassword(accountPassword);
    toast.success('Demo credentials filled.');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b14] text-white">
      {/* SCADA background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'linear-gradient(#1FD1C1 1px, transparent 1px), linear-gradient(90deg, #1FD1C1 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Ambient lights */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-200px] left-1/3 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-300"
        >
          <span aria-hidden="true">←</span>
          Back to Home
        </Link>

        <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
          <span
            className={`h-2 w-2 rounded-full ${
              serverStatus === 'online'
                ? 'bg-emerald-400'
                : serverStatus === 'offline'
                  ? 'bg-red-400'
                  : 'animate-pulse bg-amber-400'
            }`}
          />

          {serverStatus === 'online'
            ? 'Cloud systems online'
            : serverStatus === 'offline'
              ? 'Server waking or unavailable'
              : 'Checking cloud systems'}
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-150px)] max-w-7xl items-center gap-12 px-5 pb-10 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Login panel */}
        <motion.div
          initial={{ opacity: 0, x: -22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="mx-auto w-full max-w-md"
        >
          <div className="rounded-3xl border border-white/10 bg-[#0c1524]/90 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
            <div className="mb-7 flex items-center gap-4">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 3, 0, -3, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <ValveIcon />
              </motion.div>

              <div>
                <h1 className="font-display text-2xl font-semibold text-white">
                  Control Access
                </h1>

                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                  Water &amp; Street Light System
                </p>
              </div>
            </div>

            <StatusBanner status={serverStatus} />

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
                  placeholder="you@ichalkaranji.iot"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      toast('Password recovery will be added soon.', {
                        icon: 'ℹ️',
                      })
                    }
                    className="text-xs text-cyan-300 transition hover:text-cyan-200"
                  >
                
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
                    placeholder="••••••••"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-cyan-300"
                  >
                    {showPassword ? (
                      <EyeOffIcon />
                    ) : (
                      <EyeIcon />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || serverStatus === 'offline'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 font-display font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    <LockIcon />
                    Secure Sign In
                  </>
                )}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                Demo access
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid gap-3">
              <DemoAccount
                title="System Operator"
                role="Full hardware control"
                email="operator@iot.local"
                password="Operator@123"
                icon="👨‍💼"
                onFill={() =>
                  fillDemoAccount(
                    'operator@iot.local',
                    'Operator@123'
                  )
                }
                onCopyEmail={() =>
                  copyCredential(
                    'operator@iot.local',
                    'Operator email'
                  )
                }
                onCopyPassword={() =>
                  copyCredential(
                    'Operator@123',
                    'Operator password'
                  )
                }
              />

              <DemoAccount
                title="System Viewer"
                role="Read-only monitoring"
                email="viewer@iot.local"
                password="Viewer@123"
                icon="👤"
                onFill={() =>
                  fillDemoAccount(
                    'viewer@iot.local',
                    'Viewer@123'
                  )
                }
                onCopyEmail={() =>
                  copyCredential(
                    'viewer@iot.local',
                    'Viewer email'
                  )
                }
                onCopyPassword={() =>
                  copyCredential(
                    'Viewer@123',
                    'Viewer password'
                  )
                }
              />
            </div>
          </div>
        </motion.div>

        {/* Desktop information panel */}
        <motion.div
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.55,
            delay: 0.12,
            ease: 'easeOut',
          }}
          className="hidden lg:block"
        >
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-medium text-cyan-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Secure industrial IoT control platform
            </div>

            <h2 className="text-4xl font-black leading-tight tracking-tight xl:text-5xl">
              Monitor and control your
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                complete automation system
              </span>
            </h2>

            <p className="mt-5 max-w-lg leading-7 text-slate-400">
              Manage ward-based water distribution, automated
              street lighting, schedules, reports, alerts, and
              real-time system information from one secure
              dashboard.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <FeatureItem
                icon="💧"
                title="Water Distribution"
                description="Ward scheduling and quota monitoring"
              />

              <FeatureItem
                icon="💡"
                title="Street Lighting"
                description="Automatic and manual light control"
              />

              <FeatureItem
                icon="📡"
                title="Live Monitoring"
                description="WebSocket-powered system updates"
              />

              <FeatureItem
                icon="📊"
                title="Smart Reports"
                description="Download PDF and Excel reports"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                System architecture
              </p>

              <div className="flex items-center justify-between gap-2 text-center text-xs">
                <ArchitectureNode label="ESP32" />
                <span className="text-cyan-300">→</span>
                <ArchitectureNode label="Cloud API" />
                <span className="text-cyan-300">→</span>
                <ArchitectureNode label="PostgreSQL" />
                <span className="text-cyan-300">→</span>
                <ArchitectureNode label="Dashboard" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-5 text-center text-xs text-slate-600">
        <p>
          RTC-Based Water Distribution &amp; Street Light
          Automation
        </p>
        <p className="mt-1">
          Industrial IoT Dashboard • Version 1.0
        </p>
      </footer>
    </main>
  );
}

function StatusBanner({
  status,
}: {
  status: ServerStatus;
}) {
  const config = {
    checking: {
      title: 'Checking cloud connection',
      description: 'Connecting to the backend service…',
      className:
        'border-amber-400/20 bg-amber-400/5 text-amber-300',
      dot: 'animate-pulse bg-amber-400',
    },
    online: {
      title: 'Cloud systems operational',
      description: 'Backend and database connection available.',
      className:
        'border-emerald-400/20 bg-emerald-400/5 text-emerald-300',
      dot: 'bg-emerald-400',
    },
    offline: {
      title: 'Cloud service unavailable',
      description:
        'The Render backend may be waking up. Try again shortly.',
      className:
        'border-red-400/20 bg-red-400/5 text-red-300',
      dot: 'bg-red-400',
    },
  } as const;

  const current = config[status];

  return (
    <div
      className={`rounded-xl border p-3 ${current.className}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${current.dot}`}
        />

        <div>
          <p className="text-sm font-semibold">
            {current.title}
          </p>

          <p className="mt-1 text-xs opacity-70">
            {current.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoAccount({
  title,
  role,
  email,
  password,
  icon,
  onFill,
  onCopyEmail,
  onCopyPassword,
}: {
  title: string;
  role: string;
  email: string;
  password: string;
  icon: string;
  onFill: () => void;
  onCopyEmail: () => void;
  onCopyPassword: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-4 transition hover:border-cyan-400/20">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>

          <div>
            <p className="text-sm font-semibold text-slate-200">
              {title}
            </p>
            <p className="text-[11px] text-slate-500">
              {role}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onFill}
          className="rounded-lg bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
        >
          Use
        </button>
      </div>

      <CredentialRow
        label="Email"
        value={email}
        onCopy={onCopyEmail}
      />

      <CredentialRow
        label="Password"
        value={password}
        onCopy={onCopyPassword}
      />
    </div>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
          {label}
        </p>

        <p className="truncate font-mono text-[11px] text-slate-400">
          {value}
        </p>
      </div>

      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className="shrink-0 text-slate-500 transition hover:text-cyan-300"
      >
        <CopyIcon />
      </button>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1422]/80 p-4">
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function ArchitectureNode({ label }: { label: string }) {
  return (
    <div className="flex h-14 flex-1 items-center justify-center rounded-xl border border-white/10 bg-black/15 px-2 text-slate-300">
      {label}
    </div>
  );
}

function ValveIcon() {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="20"
        cy="20"
        r="18"
        stroke="#1FD1C1"
        strokeWidth="1.5"
        opacity="0.5"
      />
      <circle
        cx="20"
        cy="20"
        r="12"
        stroke="#1FD1C1"
        strokeWidth="1.5"
      />
      <path
        d="M20 8V4M20 36V32M8 20H4M36 20H32"
        stroke="#1FD1C1"
        strokeWidth="1.5"
      />
      <circle cx="20" cy="20" r="4" fill="#1FD1C1" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-2.2 3.1M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.1-.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}