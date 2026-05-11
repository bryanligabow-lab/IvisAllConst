'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Modal, Field } from '@/components/ui/Modal';
import { apiGet, apiPost, ApiClientError } from '@/lib/api';
import { PAYMENT_METHODS } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import type { PaymentMethodValue, Project, ProjectSummary } from '@/types';
import type { Employee } from './CreateEmployeeModal';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId?: string; // si viene preseleccionado
  onCreated: () => void;
}

export function PayrollPaymentModal({ open, onClose, projectId: initialProject, onCreated }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [projectId, setProjectId] = useState(initialProject ?? '');
  const [rubroId, setRubroId] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue | ''>('');
  const [description, setDescription] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: employees } = useSWR<Employee[]>('/employees', apiGet);
  const { data: projects } = useSWR<Project[]>('/projects', apiGet);
  const { data: summary } = useSWR<ProjectSummary>(
    projectId ? `/projects/${projectId}/summary` : null,
    apiGet,
  );

  const employee = employees?.find((e) => e.id === employeeId);

  useEffect(() => {
    if (!open) return;
    setEmployeeId('');
    setProjectId(initialProject ?? '');
    setRubroId('');
    setAmount('');
    setPaymentMethod('');
    setDescription('');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setError(null);
  }, [open, initialProject]);

  // Autocompletar monto con salario mensual del empleado
  useEffect(() => {
    if (employee && !amount) {
      setAmount(String(employee.monthlySalary));
    }
  }, [employee, amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !projectId || !rubroId || !paymentMethod) {
      setError('Completa todos los campos obligatorios');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/employees/payroll-payment', {
        employeeId,
        projectId,
        rubroId,
        amount: Number(amount),
        period,
        paymentMethod,
        description: description || undefined,
        paidAt,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al registrar el pago');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago de nómina">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Empleado" required>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            className="input"
          >
            <option value="">— Selecciona un empleado —</option>
            {employees
              ?.filter((e) => e.status === 'ACTIVE')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                  {e.position ? ` · ${e.position}` : ''} ({formatCurrency(e.monthlySalary)}/mes)
                </option>
              ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Proyecto (rubro)" required>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setRubroId('');
              }}
              required
              className="input"
            >
              <option value="">— Selecciona un proyecto —</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rubro de nómina" required>
            <select
              value={rubroId}
              onChange={(e) => setRubroId(e.target.value)}
              required
              disabled={!summary}
              className="input"
            >
              <option value="">{summary ? '— Selecciona —' : 'Elige proyecto primero'}</option>
              {summary?.rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}. {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Período" required>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Monto a pagar" required>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Método de pago" required>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodValue | '')}
              required
              className="input"
            >
              <option value="">— Selecciona —</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.icon} {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de pago">
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="Descripción (opcional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="Sueldo mayo, anticipo, liquidación…"
          />
        </Field>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Guardando…' : 'Registrar pago'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
