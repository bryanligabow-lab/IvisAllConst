'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Modal, Field } from '@/components/ui/Modal';
import { apiGet, apiPatch, apiPost, ApiClientError } from '@/lib/api';
import type { Project } from '@/types';

export interface Employee {
  id: string;
  fullName: string;
  cedula: string | null;
  position: string | null;
  monthlySalary: number;
  email: string | null;
  phone: string | null;
  hireDate: string | null;
  endDate: string | null;
  projectId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  project?: { id: string; name: string; code: string } | null;
  totalPaid?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Employee | null;
  onSaved: () => void;
}

export function CreateEmployeeModal({ open, onClose, initial, onSaved }: Props) {
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [position, setPosition] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: projects } = useSWR<Project[]>('/projects', apiGet);

  useEffect(() => {
    if (!open) return;
    setFullName(initial?.fullName ?? '');
    setCedula(initial?.cedula ?? '');
    setPosition(initial?.position ?? '');
    setMonthlySalary(initial ? String(initial.monthlySalary) : '');
    setEmail(initial?.email ?? '');
    setPhone(initial?.phone ?? '');
    setProjectId(initial?.projectId ?? '');
    setStatus(initial?.status ?? 'ACTIVE');
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        fullName,
        cedula: cedula || undefined,
        position: position || undefined,
        monthlySalary: monthlySalary ? Number(monthlySalary) : 0,
        email: email || undefined,
        phone: phone || undefined,
        projectId: projectId || null,
        status,
      };
      if (initial?.id) {
        await apiPatch(`/employees/${initial.id}`, payload);
      } else {
        await apiPost('/employees', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar empleado' : 'Nuevo empleado'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nombre completo" required>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="input"
            placeholder="Juan Pérez González"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cédula / RUC">
            <input value={cedula} onChange={(e) => setCedula(e.target.value)} className="input" />
          </Field>
          <Field label="Cargo">
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="input"
              placeholder="Maestro de obra"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Salario mensual ($)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Estado">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              className="input"
            >
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Teléfono">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Proyecto asignado (opcional)">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="input"
          >
            <option value="">— Sin asignar —</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear empleado'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
