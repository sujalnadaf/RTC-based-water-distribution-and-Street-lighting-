'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
  connected: boolean;
  hardwareOnline: boolean;
}

const mainLinks = [
  { label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { label: 'Water Distribution', href: '/dashboard/water', icon: WaterIcon },
  { label: 'Street Lighting', href: '/dashboard/lighting', icon: LightIcon },
  { label: 'Schedules', href: '/dashboard/schedule', icon: CalendarIcon },
  { label: 'Reports', href: '/dashboard/reports', icon: ReportIcon },
  { label: 'Alerts', href: '/dashboard/alerts', icon: AlertIcon },
];

const managementLinks = [
  { label: 'Manual Control', href: '/dashboard/control', icon: ControlIcon },
  { label: 'Devices', href: '/dashboard/devices', icon: DeviceIcon },
  { label: 'Users', href: '/dashboard/users', icon: UsersIcon },
];

const systemLinks = [
  { label: 'Activity Logs', href: '/dashboard/activity', icon: LogIcon },
  { label: 'Profile', href: '/dashboard/profile', icon: ProfileIcon },
];

export default function Navbar({
  connected,
  hardwareOnline,
}: NavbarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  function isActive(href: string) {
    const route = href.split('#')[0];

    if (route === '/dashboard') {
      return pathname === '/dashboard';
    }

    return pathname.startsWith(route);
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`body-light-sidebar fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-panel-border bg-[#07111f]/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-panel-border px-5">
          <Link
            href="/"
            className="flex items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-400/10 text-cyan-300 ring-1 ring-cyan-400/20">
              <BrandIcon />
            </div>

            <div>
              <p className="font-display text-sm font-bold leading-5 text-white">
                IoT Water &amp;
              </p>
              <p className="font-display text-sm font-bold leading-5 text-white">
                Street Light Control
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <NavSection
            title="Main"
            links={mainLinks}
            isActive={isActive}
            onNavigate={() => setMobileOpen(false)}
          />

          <NavSection
            title="Management"
            links={managementLinks}
            isActive={isActive}
            onNavigate={() => setMobileOpen(false)}
          />

          <NavSection
            title="System"
            links={systemLinks}
            isActive={isActive}
            onNavigate={() => setMobileOpen(false)}
          />
        </nav>

        <div className="border-t border-panel-border p-3">
          <div className="rounded-2xl border border-panel-border bg-white/[0.035] p-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  hardwareOnline
                    ? 'bg-emerald-400/10 text-emerald-300'
                    : 'bg-red-400/10 text-red-300'
                }`}
              >
                <HardwareIcon />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Hardware Status
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      hardwareOnline
                        ? 'bg-emerald-400'
                        : 'animate-pulse bg-red-400'
                    }`}
                  />

                  <span
                    className={`text-xs ${
                      hardwareOnline
                        ? 'text-emerald-300'
                        : 'text-red-300'
                    }`}
                  >
                    {hardwareOnline ? 'Connected' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {hardwareOnline
                ? 'ESP32 live feed is available.'
                : 'ESP32 hardware is not connected yet.'}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-panel-border bg-white/[0.025] px-3 py-2">
            <span className="text-xs text-slate-400">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 h-20 border-b border-panel-border bg-base/85 backdrop-blur-xl lg:left-56">
             <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-panel-border bg-white/[0.035] p-2.5 text-slate-300 hover:border-signal-cyan/40 hover:text-signal-cyan lg:hidden"
            >
              <MenuIcon />
            </button>

            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-semibold text-white sm:text-xl">
                Dashboard
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Overview of your smart city system
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ConnectionBadge connected={connected} />

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen((value) => !value);
                  setProfileOpen(false);
                }}
                className="relative rounded-xl border border-panel-border bg-white/[0.035] p-2.5 text-slate-400 transition hover:border-signal-cyan/40 hover:text-signal-cyan"
                aria-label="Notifications"
                aria-expanded={notificationOpen}
              >
                <BellIcon />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  3
                </span>
              </button>

              {notificationOpen && (
                <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-panel-border bg-[#0b1524] shadow-2xl">
                  <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Notifications
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        3 unread alerts
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNotificationOpen(false)}
                      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
                      aria-label="Close notifications"
                    >
                      <CloseIcon />
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2">
                    <NotificationItem
                      title="Tank level is low"
                      message="The current water level is below the recommended limit."
                      time="2 minutes ago"
                      type="warning"
                    />

                    <NotificationItem
                      title="ESP32 is offline"
                      message="The dashboard cannot communicate with the ESP32 device."
                      time="5 minutes ago"
                      type="error"
                    />

                    <NotificationItem
                      title="Street lights inactive"
                      message="Street lighting is currently switched off."
                      time="10 minutes ago"
                      type="info"
                    />
                  </div>

                  <Link
                    href="/dashboard/alerts"
                    onClick={() => setNotificationOpen(false)}
                    className="block border-t border-panel-border px-4 py-3 text-center text-sm font-semibold text-cyan-300 transition hover:bg-white/[0.035]"
                  >
                    View all alerts
                  </Link>
                </div>
              )}
            </div>

            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((value) => !value);
                    setNotificationOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-panel-border hover:bg-white/[0.035]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-sm font-bold text-cyan-300 ring-1 ring-cyan-400/20">
                    {getInitials(user.name)}
                  </div>

                  <div className="hidden text-left sm:block">
                    <p className="max-w-32 truncate text-sm font-semibold text-white">
                      {user.name}
                    </p>

                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] capitalize text-slate-500">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <ChevronIcon />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-panel-border bg-[#0b1524] p-2 shadow-2xl">
                    <div className="border-b border-panel-border px-3 py-3">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.name}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {user.role} account
                      </p>
                    </div>

                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileOpen(false)}
                      className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      <ProfileIcon />
                      Profile
                    </Link>

                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-400/10"
                    >
                      <LogoutIcon />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

interface NavigationLink {
  label: string;
  href: string;
  icon: React.ComponentType;
}

function NavSection({
  title,
  links,
  isActive,
  onNavigate,
}: {
  title: string;
  links: NavigationLink[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  return (
    <section className="mb-7">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
        {title}
      </p>

      <div className="space-y-1">
        {links.map((link) => {
          const active = isActive(link.href);
          const Icon = link.icon;

          return (
            <Link
              key={link.label}
              href={link.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-gradient-to-r from-cyan-400/15 to-blue-500/10 font-medium text-cyan-300 ring-1 ring-cyan-400/10'
                  : 'text-slate-400 hover:bg-white/[0.035] hover:text-white'
              }`}
            >
              <span
                className={`transition ${
                  active
                    ? 'text-cyan-300'
                    : 'text-slate-500 group-hover:text-slate-300'
                }`}
              >
                <Icon />
              </span>

              {link.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function NotificationItem({
  title,
  message,
  time,
  type,
}: {
  title: string;
  message: string;
  time: string;
  type: 'warning' | 'error' | 'info';
}) {
  const styles = {
    warning: 'bg-amber-400/10 text-amber-300',
    error: 'bg-red-400/10 text-red-300',
    info: 'bg-cyan-400/10 text-cyan-300',
  };

  return (
    <div className="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.035]">
      <div
        className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles[type]}`}
      >
        <AlertIcon />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {message}
        </p>

        <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-slate-600">
          {time}
        </p>
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div
      className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] xl:flex ${
        connected
          ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
          : 'border-amber-400/20 bg-amber-400/5 text-amber-300'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          connected
            ? 'bg-emerald-400'
            : 'animate-pulse bg-amber-400'
        }`}
      />

      {connected ? 'Live' : 'Reconnecting'}
    </div>
  );
}

function getInitials(name?: string) {
  if (!name) return 'U';

  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function BrandIcon() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none">
      <path
        d="M9.5 3.5S4 9.3 4 14a5.5 5.5 0 0 0 11 0c0-4.7-5.5-10.5-5.5-10.5Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M14 5c1.8-2.1 4.7-2.5 6-2.4-.1 3.2-1.6 6.3-5.7 6.7"
        stroke="#4ADE80"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}


function DashboardIcon() {
  return (
    <SimpleIcon path="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
  );
}

function WaterIcon() {
  return (
    <SimpleIcon path="M12 3s6 6.3 6 11a6 6 0 1 1-12 0c0-4.7 6-11 6-11Z" />
  );
}

function LightIcon() {
  return (
    <SimpleIcon path="M9 18h6M10 22h4M8 14.5a6 6 0 1 1 8 0c-1.3 1-2 2-2 3.5h-4c0-1.5-.7-2.5-2-3.5Z" />
  );
}

function CalendarIcon() {
  return (
    <SimpleIcon path="M5 5h14v15H5V5Zm3-2v4m8-4v4M5 10h14" />
  );
}

function ReportIcon() {
  return (
    <SimpleIcon path="M6 3h9l3 3v15H6V3Zm9 0v4h4M9 13h6M9 17h6M9 9h2" />
  );
}

function AlertIcon() {
  return (
    <SimpleIcon path="M12 3a5 5 0 0 1 5 5v4l2 3H5l2-3V8a5 5 0 0 1 5-5Zm-2 15h4" />
  );
}

function ControlIcon() {
  return (
    <SimpleIcon path="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6" />
  );
}

function DeviceIcon() {
  return (
    <SimpleIcon path="M7 3h10v18H7V3Zm3 3h4m-4 11h4" />
  );
}

function UsersIcon() {
  return (
    <SimpleIcon path="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6M2 21a6 6 0 0 1 12 0m1-6a5 5 0 0 1 7 5" />
  );
}

function LogIcon() {
  return (
    <SimpleIcon path="M5 4h14v16H5V4Zm4 4h6M9 12h6M9 16h4" />
  );
}


function ProfileIcon() {
  return (
    <SimpleIcon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />
  );
}

function HardwareIcon() {
  return (
    <SimpleIcon path="M8 8h8v8H8V8Zm-4 3h4m8 0h4M11 4v4m0 8v4M4 15h4m8 0h4M15 4v4m0 8v4" />
  );
}

function BellIcon() {
  return (
    <SimpleIcon path="M12 3a5 5 0 0 1 5 5v4l2 3H5l2-3V8a5 5 0 0 1 5-5Zm-2 15h4" />
  );
}

function LogoutIcon() {
  return (
    <SimpleIcon path="M10 4H5v16h5m4-4 4-4-4-4m4 4H9" />
  );
}

function ChevronIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="m8 10 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SimpleIcon({ path }: { path: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}