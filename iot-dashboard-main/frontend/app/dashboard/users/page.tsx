'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

import { useAuth } from '@/context/AuthContext';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from '@/lib/api';
import { useLiveSocket } from '@/lib/useLiveSocket';

type UserRole = 'user' | 'operator';
type RoleFilter = 'all' | UserRole;

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'user',
};

export default function UsersPage() {
  const { user: currentUser, isOperator } = useAuth();
  const { status, connected } = useLiveSocket();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>('all');

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [form, setForm] =
    useState<UserForm>(emptyForm);

  const hardwareOnline =
    status?.deviceOnline === true ||
    status?.device_online === true;

  async function loadUsers() {
    if (!isOperator) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiGet('/api/users');

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to load users.',
        {
          id: 'users-load-error',
        }
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [isOperator]);

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase();

    return users.filter((account) => {
      const matchesSearch =
        !value ||
        account.name.toLowerCase().includes(value) ||
        account.email.toLowerCase().includes(value);

      const matchesRole =
        roleFilter === 'all' ||
        account.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const summary = useMemo(() => {
    return {
      total: users.length,
      operators: users.filter(
        (account) => account.role === 'operator'
      ).length,
      viewers: users.filter(
        (account) => account.role === 'user'
      ).length,
      active: users.filter(
        (account) => account.is_active
      ).length,
    };
  }, [users]);

  async function createUser(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (form.password.length < 8) {
      toast.error(
        'Password must contain at least 8 characters.'
      );
      return;
    }

    setSaving(true);

    try {
      await apiPost('/api/users', form);

      toast.success('User account created.');

      setForm(emptyForm);
      setShowCreateForm(false);

      await loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to create user.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(
    account: ManagedUser,
    role: UserRole
  ) {
    try {
      await apiPatch(`/api/users/${account.id}`, {
        role,
      });

      toast.success('User role updated.');
      await loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Role update failed.'
      );
    }
  }

  async function toggleActive(account: ManagedUser) {
    try {
      await apiPatch(`/api/users/${account.id}`, {
        isActive: !account.is_active,
      });

      toast.success(
        account.is_active
          ? 'User account deactivated.'
          : 'User account activated.'
      );

      await loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Account update failed.'
      );
    }
  }

  async function resetPassword(account: ManagedUser) {
    const password = window.prompt(
      `Enter a new password for ${account.name}. It must contain at least 8 characters.`
    );

    if (!password) return;

    if (password.length < 8) {
      toast.error(
        'Password must contain at least 8 characters.'
      );
      return;
    }

    try {
      await apiPatch(
        `/api/users/${account.id}/password`,
        {
          password,
        }
      );

      toast.success('Password updated successfully.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Password update failed.'
      );
    }
  }

  async function deleteUser(account: ManagedUser) {
    const confirmed = window.confirm(
      `Permanently delete ${account.name}?`
    );

    if (!confirmed) return;

    try {
      await apiDelete(`/api/users/${account.id}`);

      toast.success('User account deleted.');
      await loadUsers();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Delete failed.'
      );
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-base">
        <Navbar
          connected={connected}
          hardwareOnline={hardwareOnline}
        />

        <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 lg:ml-56 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <UsersHeader
              isOperator={isOperator}
              onAdd={() => setShowCreateForm(true)}
            />

            {!isOperator ? (
              <AccessDenied />
            ) : (
              <>
                <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Total Accounts"
                    value={summary.total}
                    subtitle="All registered users"
                    icon="👥"
                  />

                  <MetricCard
                    title="Operators"
                    value={summary.operators}
                    subtitle="Full control access"
                    icon="👨‍💼"
                  />

                  <MetricCard
                    title="Viewers"
                    value={summary.viewers}
                    subtitle="Read-only access"
                    icon="👤"
                  />

                  <MetricCard
                    title="Active Accounts"
                    value={summary.active}
                    subtitle="Allowed to sign in"
                    icon="✅"
                  />
                </section>

                {showCreateForm && (
                  <CreateUserForm
                    form={form}
                    saving={saving}
                    onChange={setForm}
                    onSubmit={createUser}
                    onCancel={() => {
                      setForm(emptyForm);
                      setShowCreateForm(false);
                    }}
                  />
                )}

                <section className="mt-6 rounded-2xl border border-panel-border bg-panel/65 p-5 backdrop-blur-xl">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-white">
                        User Accounts
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        Manage operators, viewers and account
                        permissions
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="search"
                        value={search}
                        onChange={(event) =>
                          setSearch(event.target.value)
                        }
                        placeholder="Search name or email..."
                        className="min-w-[240px] rounded-xl border border-panel-border bg-black/15 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
                      />

                      <select
                        value={roleFilter}
                        onChange={(event) =>
                          setRoleFilter(
                            event.target.value as RoleFilter
                          )
                        }
                        className="rounded-xl border border-panel-border bg-[#0b1524] px-4 py-2.5 text-sm text-white outline-none"
                      >
                        <option value="all">
                          All roles
                        </option>
                        <option value="operator">
                          Operators
                        </option>
                        <option value="user">
                          Viewers
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    {loading ? (
                      <LoadingState />
                    ) : filteredUsers.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-panel-border text-xs text-slate-500">
                              <th className="px-3 py-3 font-medium">
                                User
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Role
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Status
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Last Login
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Created
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Actions
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {filteredUsers.map(
                              (account) => (
                                <UserRow
                                  key={account.id}
                                  account={account}
                                  isCurrentUser={
                                    account.id ===
                                    currentUser?.id
                                  }
                                  onRoleChange={
                                    changeRole
                                  }
                                  onToggleActive={
                                    toggleActive
                                  }
                                  onResetPassword={
                                    resetPassword
                                  }
                                  onDelete={deleteUser}
                                />
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyUsers />
                    )}
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

function UsersHeader({
  isOperator,
  onAdd,
}: {
  isOperator: boolean;
  onAdd: () => void;
}) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel/60 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <StatusBadge
            text={
              isOperator
                ? 'Operator access'
                : 'Access restricted'
            }
            type={isOperator ? 'success' : 'danger'}
          />

          <h1 className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">
            Users Management
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Create accounts and manage operator or viewer
            permissions.
          </p>
        </div>

        {isOperator && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            + Add User
          </button>
        )}
      </div>
    </section>
  );
}

function CreateUserForm({
  form,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: UserForm;
  saving: boolean;
  onChange: (form: UserForm) => void;
  onSubmit: (
    event: React.FormEvent<HTMLFormElement>
  ) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-2xl border border-cyan-400/20 bg-panel/65 p-5"
    >
      <div className="mb-5">
        <h2 className="font-display text-lg font-semibold text-white">
          Create User Account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Add a new operator or read-only viewer
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FormInput
          label="Full Name"
          type="text"
          value={form.name}
          onChange={(value) =>
            onChange({ ...form, name: value })
          }
        />

        <FormInput
          label="Email Address"
          type="email"
          value={form.email}
          onChange={(value) =>
            onChange({ ...form, email: value })
          }
        />

        <FormInput
          label="Temporary Password"
          type="password"
          value={form.password}
          onChange={(value) =>
            onChange({ ...form, password: value })
          }
        />

        <div>
          <label className="gauge-label mb-2 block">
            Role
          </label>

          <select
            value={form.role}
            onChange={(event) =>
              onChange({
                ...form,
                role: event.target.value as UserRole,
              })
            }
            className="w-full rounded-xl border border-panel-border bg-[#0b1524] px-4 py-3 text-sm text-white"
          >
            <option value="user">
              Viewer — read only
            </option>
            <option value="operator">
              Operator — full control
            </option>
          </select>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-panel-border px-5 py-2.5 text-sm text-slate-300"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </form>
  );
}

function UserRow({
  account,
  isCurrentUser,
  onRoleChange,
  onToggleActive,
  onResetPassword,
  onDelete,
}: {
  account: ManagedUser;
  isCurrentUser: boolean;
  onRoleChange: (
    account: ManagedUser,
    role: UserRole
  ) => void;
  onToggleActive: (account: ManagedUser) => void;
  onResetPassword: (account: ManagedUser) => void;
  onDelete: (account: ManagedUser) => void;
}) {
  return (
    <tr className="border-b border-panel-border/50 text-slate-300">
      <td className="px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-bold text-cyan-300">
            {getInitials(account.name)}
          </div>

          <div>
            <p className="font-medium text-white">
              {account.name}
              {isCurrentUser && (
                <span className="ml-2 text-[10px] text-cyan-300">
                  You
                </span>
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {account.email}
            </p>
          </div>
        </div>
      </td>

      <td className="px-3 py-4">
        <select
          value={account.role}
          disabled={isCurrentUser}
          onChange={(event) =>
            onRoleChange(
              account,
              event.target.value as UserRole
            )
          }
          className="rounded-lg border border-panel-border bg-[#0b1524] px-3 py-2 text-xs capitalize text-white disabled:opacity-50"
        >
          <option value="operator">Operator</option>
          <option value="user">Viewer</option>
        </select>
      </td>

      <td className="px-3 py-4">
        <StatusBadge
          text={account.is_active ? 'Active' : 'Disabled'}
          type={account.is_active ? 'success' : 'danger'}
        />
      </td>

      <td className="px-3 py-4 text-xs">
        {account.last_login_at
          ? new Date(
              account.last_login_at
            ).toLocaleString()
          : 'Never'}
      </td>

      <td className="px-3 py-4 text-xs">
        {account.created_at
          ? new Date(
              account.created_at
            ).toLocaleDateString()
          : 'Unavailable'}
      </td>

      <td className="px-3 py-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onResetPassword(account)}
            className="rounded-lg border border-panel-border px-3 py-2 text-xs text-slate-300 hover:border-cyan-400/30 hover:text-cyan-300"
          >
            Reset Password
          </button>

          <button
            type="button"
            disabled={isCurrentUser}
            onClick={() => onToggleActive(account)}
            className="rounded-lg border border-panel-border px-3 py-2 text-xs text-amber-300 disabled:opacity-40"
          >
            {account.is_active
              ? 'Deactivate'
              : 'Activate'}
          </button>

          <button
            type="button"
            disabled={isCurrentUser}
            onClick={() => onDelete(account)}
            className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function FormInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="gauge-label mb-2 block">
        {label}
      </label>

      <input
        required
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-panel-border bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
}) {
  return (
    <article className="rounded-2xl border border-panel-border bg-panel/65 p-5">
      <div className="text-2xl">{icon}</div>
      <p className="mt-4 text-xs uppercase text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold text-white">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {subtitle}
      </p>
    </article>
  );
}

function AccessDenied() {
  return (
    <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-12 text-center">
      <p className="text-lg font-semibold text-red-300">
        Operator access required
      </p>
      <p className="mt-2 text-sm text-red-100/50">
        Viewer accounts cannot manage system users.
      </p>
    </div>
  );
}

function EmptyUsers() {
  return (
    <div className="py-14 text-center text-sm text-slate-500">
      No matching users were found.
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-20 rounded-xl bg-black/10"
        />
      ))}
    </div>
  );
}

function StatusBadge({
  text,
  type,
}: {
  text: string;
  type: 'success' | 'danger';
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase ${
        type === 'success'
          ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
          : 'border-red-400/20 bg-red-400/5 text-red-300'
      }`}
    >
      {text}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}