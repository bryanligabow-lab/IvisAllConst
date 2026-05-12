'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { apiGet, apiPost, apiDelete, ApiClientError } from '@/lib/api';
import { CreateUserModal } from '@/components/forms/CreateUserModal';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { Modal } from '@/components/ui/Modal';

interface DirectoryUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ role: { name: string } }>;
}

export default function DirectorioPage() {
  const { data: users, mutate } = useSWR<DirectoryUser[]>('/users', apiGet);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<DirectoryUser | null>(null);
  const [resetting, setResetting] = useState<DirectoryUser | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetType, setResetType] = useState<'code' | 'password'>('code');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');

  async function doReset(u: DirectoryUser, type: 'code' | 'password') {
    setResetting(u);
    setResetType(type);
    setResetResult(null);
    setResetError(null);
    setNewPwd('');
  }

  async function submitReset() {
    if (!resetting) return;
    setResetSubmitting(true);
    setResetError(null);
    try {
      if (resetType === 'code') {
        const res = await apiPost<{ deleteCode: string }>(
          `/users/${resetting.id}/reset-delete-code`,
          {},
        );
        setResetResult(res.deleteCode);
      } else {
        if (newPwd.length < 8) {
          setResetError('La contraseña debe tener al menos 8 caracteres');
          return;
        }
        await apiPost(`/users/${resetting.id}/reset-password`, { password: newPwd });
        setResetResult('OK');
      }
    } catch (err) {
      setResetError(err instanceof ApiClientError ? err.message : 'No se pudo completar');
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Directorio de usuarios</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gestiona los usuarios que pueden acceder al sistema, sus roles y sus códigos de eliminación.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            + Nuevo usuario
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Nombre
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Correo
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Roles
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Estado
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Último ingreso
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!users && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {users && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Sin usuarios todavía.
                  </td>
                </tr>
              )}
              {users?.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-xs text-slate-400">—</span>}
                      {u.roles.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {r.role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        ● Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        ● Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-EC') : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => doReset(u, 'password')}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Cambiar contraseña
                      </button>
                      <button
                        onClick={() => doReset(u, 'code')}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Regenerar código
                      </button>
                      <button
                        onClick={() => setDeleting(u)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <strong>Doble seguridad:</strong> cada usuario tiene dos credenciales. La <em>contraseña</em> sirve para iniciar sesión normal. El <em>código de 6 dígitos</em> se solicita además cada vez que se intenta eliminar un registro importante (proyectos, gastos, planillas, órdenes, proformas, empleados, etc.). Si un usuario pierde su código, regéneralo y entrégale el nuevo.
        </div>
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void mutate()}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        itemLabel={deleting ? `el usuario "${deleting.firstName} ${deleting.lastName}"` : ''}
        onConfirm={async (code) => {
          if (!deleting) return;
          await apiDelete(`/users/${deleting.id}`, { deleteCode: code });
          await mutate();
          setDeleting(null);
        }}
      />

      <Modal
        open={!!resetting}
        onClose={() => {
          setResetting(null);
          setResetResult(null);
        }}
        title={resetType === 'code' ? 'Regenerar código de eliminación' : 'Cambiar contraseña'}
        width="sm"
      >
        {resetting && !resetResult && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Usuario: <strong>{resetting.firstName} {resetting.lastName}</strong> ({resetting.email})
            </p>
            {resetType === 'password' && (
              <div>
                <label className="mb-1 block text-sm font-medium">Nueva contraseña</label>
                <input
                  type="text"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  minLength={8}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
            )}
            {resetError && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {resetError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setResetting(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={submitReset}
                disabled={resetSubmitting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {resetSubmitting ? 'Procesando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
        {resetting && resetResult && resetType === 'code' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-700 dark:bg-emerald-950/40">
              ✓ Nuevo código generado. Cópialo y entrégaselo al usuario.
            </div>
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-3 text-center font-mono text-2xl font-bold tracking-[0.4em] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {resetResult}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setResetting(null);
                  setResetResult(null);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Listo
              </button>
            </div>
          </div>
        )}
        {resetting && resetResult && resetType === 'password' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-700 dark:bg-emerald-950/40">
              ✓ Contraseña actualizada.
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setResetting(null);
                  setResetResult(null);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Listo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
