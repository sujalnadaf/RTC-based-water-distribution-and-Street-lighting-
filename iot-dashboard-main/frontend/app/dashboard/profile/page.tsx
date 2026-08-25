'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type EditableProfile = {
  name: string;
  email: string;
  phone: string;
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const initialProfile = useMemo<EditableProfile>(
    () => ({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: '',
    }),
    [user],
  );

  const [profile, setProfile] = useState<EditableProfile>(initialProfile);
  const [savedMessage, setSavedMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const initials = getInitials(profile.name || user?.name);
  const role = user?.role ?? 'user';

  function updateField(field: keyof EditableProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    localStorage.setItem(
      'water-iot-profile',
      JSON.stringify(profile),
    );

    setSavedMessage('Profile details saved on this device.');
    window.setTimeout(() => setSavedMessage(''), 3000);
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage('New password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage('New password and confirmation do not match.');
      return;
    }

    setPasswordMessage(
      'Password form is valid. Connect this form to your backend password API.',
    );
    event.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-base px-4 pb-12 pt-24 sm:px-6 lg:ml-56 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Account
            </p>

            <h1 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
              Profile
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              View your account, project information and security options.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-panel-border bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>
        </div>

        <section className="overflow-hidden rounded-3xl border border-panel-border bg-white/[0.035] shadow-2xl">
          <div className="h-28 bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-emerald-500/10" />

          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-[#07111f] bg-gradient-to-br from-cyan-400/25 to-blue-500/25 text-3xl font-bold text-cyan-300 shadow-xl">
                  {initials}
                </div>

                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-2xl font-bold text-white">
                      {profile.name || 'Dashboard User'}
                    </h2>

                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold capitalize text-emerald-300">
                      {role}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-400">
                    {profile.email || 'Email not available'}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Online
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-400/15"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Account status" value="Active" detail="Access enabled" />
          <StatCard label="Current role" value={capitalize(role)} detail="Dashboard permissions" />
          <StatCard label="Session" value="Online" detail="Current browser session" />
          <StatCard label="Project version" value="v1.0" detail="IoT control dashboard" />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <Card title="Personal information" subtitle="Update the details displayed in your profile.">
              <form onSubmit={handleProfileSubmit} className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={profile.name}
                  onChange={(value) => updateField('name', value)}
                  placeholder="Enter your full name"
                />

                <Field
                  label="Email address"
                  type="email"
                  value={profile.email}
                  onChange={(value) => updateField('email', value)}
                  placeholder="Enter your email"
                />

                <div className="sm:col-span-2">
                  <Field
                    label="Phone number"
                    type="tel"
                    value={profile.phone}
                    onChange={(value) => updateField('phone', value)}
                    placeholder="+91 00000 00000"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Save profile
                  </button>

                  {savedMessage && (
                    <p className="text-sm text-emerald-300">{savedMessage}</p>
                  )}
                </div>
              </form>
            </Card>

            <Card title="Security" subtitle="Validate a password change before connecting it to your backend.">
              <form onSubmit={handlePasswordSubmit} className="grid gap-5">
                <PasswordField
                  name="currentPassword"
                  label="Current password"
                  placeholder="Enter current password"
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <PasswordField
                    name="newPassword"
                    label="New password"
                    placeholder="Minimum 6 characters"
                  />

                  <PasswordField
                    name="confirmPassword"
                    label="Confirm new password"
                    placeholder="Repeat new password"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15"
                  >
                    Change password
                  </button>

                  {passwordMessage && (
                    <p className="max-w-xl text-sm text-slate-400">
                      {passwordMessage}
                    </p>
                  )}
                </div>
              </form>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Project information" subtitle="Current dashboard technology and hardware.">
              <InfoList
                items={[
                  ['Project', 'RTC Based Water Distribution & Street Light Automation'],
                  ['Controller', 'ESP32 DevKit V1'],
                  ['RTC', 'DS3231'],
                  ['Database', 'PostgreSQL'],
                  ['Backend', 'Node.js + Express'],
                  ['Frontend', 'Next.js'],
                ]}
              />
            </Card>

            <Card title="Login activity" subtitle="Information about your current session.">
              <InfoList
                items={[
                  ['Status', 'Online'],
                  ['Browser', getBrowserName()],
                  ['Operating system', getOperatingSystem()],
                  ['Session type', 'Web dashboard'],
                  ['Last login', 'Current session'],
                ]}
              />
            </Card>

           <Card
                 title="Account actions"
                  subtitle="Manage your current dashboard session."
>
                 <button
                     type="button"
                     onClick={logout} className="w-full rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/15" >
                    Logout from dashboard
               </button>
             </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-panel-border bg-white/[0.035] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 font-display text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-panel-border bg-white/[0.035] p-5 sm:p-6">
      <div className="mb-6">
        <h2 className="font-display text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-panel-border bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
      />
    </label>
  );
}

function PasswordField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>
      <input
        name={name}
        type="password"
        placeholder={placeholder}
        autoComplete="new-password"
        className="w-full rounded-xl border border-panel-border bg-black/15 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
      />
    </label>
  );
}

function InfoList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-panel-border">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[120px_1fr]"
        >
          <dt className="text-xs font-medium uppercase tracking-[0.1em] text-slate-600">
            {label}
          </dt>
          <dd className="text-sm text-slate-300">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function getInitials(name?: string) {
  if (!name) return 'U';

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getBrowserName() {
  if (typeof navigator === 'undefined') return 'Browser';

  const userAgent = navigator.userAgent;

  if (userAgent.includes('Edg')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome')) return 'Google Chrome';
  if (userAgent.includes('Firefox')) return 'Mozilla Firefox';
  if (userAgent.includes('Safari')) return 'Safari';

  return 'Web browser';
}

function getOperatingSystem() {
  if (typeof navigator === 'undefined') return 'Operating system';

  const platform = navigator.userAgent;

  if (platform.includes('Windows')) return 'Windows';
  if (platform.includes('Android')) return 'Android';
  if (platform.includes('iPhone') || platform.includes('iPad')) return 'iOS';
  if (platform.includes('Mac OS')) return 'macOS';
  if (platform.includes('Linux')) return 'Linux';

  return 'Unknown';
}