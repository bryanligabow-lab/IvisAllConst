'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiPost, ApiClientError } from '@/lib/api';

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
}

interface CreatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  deleteCode: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateUserModal({ open, onClose, onCreated }: Props) {
  const { data: roles } = useSWR<Role[]>(open ? '/users/roles/list' : null, apiGet);
  const { data: projects } = useSWR<ProjectLite[]>(open ? '/projects?perPage=200' : null, apiGet);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState<'pwd' | 'code' | null>(null);

  const operadorRoleId = roles?.find((r) => r.name === 'operador')?.id;
  const showProjects = !!operadorRoleId && selectedRoles.includes(operadorRoleId);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setSelectedRoles([]);
    setSelectedProjects([]);
    setError(null);
    setCreated(null);
    setCopied(null);
  }, [open]);

  function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = '';
    const arr = new Uint8Array(10);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 10; i++) pwd += chars[arr[i] % chars.length];
    return pwd + '!';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<CreatedUser>('/users', {
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        roleIds: selectedRoles,
        ...(showProjects ? { projectIds: selectedProjects } : {}),
      });
      setCreated(res);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear el usuario');
    } finally {
      setSubmitting(false);
    }
  }

  function copy(text: string, which: 'pwd' | 'code') {
    void navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Modal open={open} onClose={onClose} title={created ? 'Usuario creado' : 'Nuevo usuario'} width="md">
      {created ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-700 dark:bg-emerald-950/40">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              ✓ Usuario creado correctamente
            </p>
            <p className="mt-1 text-emerald-800 dark:text-emerald-300">
              Estas credenciales <strong>solo se muestran una vez</strong>. Cópialas y entrégalas al usuario.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Correo
              </label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800">
                {created.email}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Contraseña de acceso
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800">
                  {password}
                </div>
                <button
                  type="button"
                  onClick={() => copy(password, 'pwd')}
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700"
                >
                  {copied === 'pwd' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                Código de eliminación (6 dígitos)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-center font-mono text-2xl font-bold tracking-[0.4em] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                  {created.deleteCode}
                </div>
                <button
                  type="button"
                  onClick={() => copy(created.deleteCode, 'code')}
                  className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  {copied === 'code' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Este código se le pedirá al usuario cada vez que intente eliminar registros importantes (proyectos, gastos, planillas, etc.).
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Listo
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
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
            <label className="mb-1 block text-sm font-medium">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="usuario@creacom.com.ec"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Contraseña de acceso</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="whitespace-nowrap rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                Generar
              </button>
            </div>
          </div>

          {roles && roles.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">Roles</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.id)}
                      onChange={(e) => {
                        setSelectedRoles((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id),
                        );
                      }}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {showProjects && (
            <div>
              <label className="mb-1 block text-sm font-medium">Proyectos asignados</label>
              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {!projects && (
                  <div className="col-span-full text-xs text-slate-400">Cargando proyectos…</div>
                )}
                {projects?.length === 0 && (
                  <div className="col-span-full text-xs text-slate-400">No hay proyectos.</div>
                )}
                {projects?.map((p) => (
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

          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Al crear el usuario, el sistema generará automáticamente un <strong>código de 6 dígitos</strong> que se mostrará una sola vez. Cópialo y guárdalo — el usuario lo necesitará para eliminar registros importantes.
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
