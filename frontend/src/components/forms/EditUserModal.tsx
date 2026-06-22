'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiPatch, ApiClientError } from '@/lib/api';

interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
}

interface ProjectLite {
  id: string;
  code: string;
  name: string;
  status?: string;
}

// Proyectos cerrados que NO deben ofrecerse para asignar.
const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED'];

interface UserDetail {
  projectIds?: string[];
}

export interface EditableUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Array<{ role: { id?: string; name: string } }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  user: EditableUser | null;
  onSaved: () => void;
}

export function EditUserModal({ open, onClose, user, onSaved }: Props) {
  const { data: roles } = useSWR<Role[]>(open ? '/users/roles/list' : null, apiGet);
  const { data: projects } = useSWR<ProjectLite[]>(open ? '/projects?perPage=200' : null, apiGet);
  const { data: detail } = useSWR<UserDetail>(
    open && user ? `/users/${user.id}` : null,
    apiGet,
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const operadorRoleId = roles?.find((r) => r.name === 'operador')?.id;
  const showProjects = !!operadorRoleId && selectedRoles.includes(operadorRoleId);
  // Proyectos vigentes (no cerrados) + los que el usuario ya tenga asignados
  // aunque estén cerrados (para no desasignarlos sin querer).
  const activeProjects = projects?.filter(
    (p) => !CLOSED_STATUSES.includes(p.status ?? 'ACTIVE') || selectedProjects.includes(p.id),
  );

  // When opening, hydrate state with the user's current values.
  useEffect(() => {
    if (!open || !user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setIsActive(user.isActive);
    setError(null);
    setSubmitting(false);
    // Map role names back to ids via the loaded roles list.
    // If roles haven't loaded yet, we resolve later in another effect.
    setSelectedRoles([]);
  }, [open, user]);

  // Once roles are loaded, map current user's role names back to their ids.
  useEffect(() => {
    if (!open || !user || !roles) return;
    const userRoleNames = new Set(user.roles.map((r) => r.role.name));
    const ids = roles.filter((r) => userRoleNames.has(r.name)).map((r) => r.id);
    setSelectedRoles(ids);
  }, [open, user, roles]);

  // Hidrata los proyectos asignados desde el detalle del usuario.
  useEffect(() => {
    if (!open || !detail) return;
    setSelectedProjects(detail.projectIds ?? []);
  }, [open, detail]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPatch(`/users/${user.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isActive,
        roleIds: selectedRoles,
        // Si es operador, guarda los proyectos asignados; si no, lo limpia.
        projectIds: showProjects ? selectedProjects : [],
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Editar usuario`} width="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">{user.email}</span>
          <span className="ml-2">· el correo no se puede cambiar</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Apellido</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="font-medium">Usuario activo</span>
            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
              {isActive
                ? '— Puede iniciar sesión'
                : '— Está deshabilitado. No podrá iniciar sesión hasta que lo reactives.'}
            </span>
          </label>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Roles y permisos</label>
          <div className="grid grid-cols-2 gap-2">
            {!roles && (
              <div className="col-span-2 text-xs text-slate-400">Cargando roles…</div>
            )}
            {roles?.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedRoles.includes(r.id)}
                  onChange={(e) => {
                    setSelectedRoles((prev) =>
                      e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id),
                    );
                  }}
                />
                <div>
                  <div className="font-medium">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {r.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Cada rol incluye un set de permisos. <strong>super_admin</strong> tiene todos los
            permisos. <strong>admin</strong> puede gestionar proyectos, gastos, planillas,
            proveedores, clientes, nómina y proformas. <strong>operador</strong> (residente) solo
            accede a sus proyectos asignados, ve avances en %, carga órdenes de pago y registra
            asistencia/bitácora. <strong>viewer</strong> (solo lectura) ve toda la información pero
            no puede crear, editar ni eliminar nada. <strong>user</strong> tiene acceso de lectura.
          </p>
        </div>

        {showProjects && (
          <div>
            <label className="mb-1 block text-sm font-medium">Proyectos asignados</label>
            <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {!projects && (
                <div className="col-span-full text-xs text-slate-400">Cargando proyectos…</div>
              )}
              {activeProjects?.length === 0 && (
                <div className="col-span-full text-xs text-slate-400">No hay proyectos activos.</div>
              )}
              {activeProjects?.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedProjects.includes(p.id)}
                    onChange={(e) =>
                      setSelectedProjects((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                      )
                    }
                  />
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{p.code}</div>
                  </div>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              El operador solo verá y trabajará en estos proyectos.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
