'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Modal, Field } from '@/components/ui/Modal';
import { apiGet, apiPost, ApiClientError } from '@/lib/api';
import { PAYMENT_METHODS } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { calcularNomina, HORAS_MES } from '@/lib/payroll';
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
  // Rol de pagos: horas extras, fondos de reserva y aporte al IESS.
  const [baseSalary, setBaseSalary] = useState('');
  const [supplementaryHours, setSupplementaryHours] = useState('');
  const [extraordinaryHours, setExtraordinaryHours] = useState('');
  const [reserveFunds, setReserveFunds] = useState(false);
  const [iessAffiliated, setIessAffiliated] = useState(false);
  const [otherDeductions, setOtherDeductions] = useState('');
  // Si escribe el total a mano, deja de recalcularse (anticipos, liquidaciones).
  const [manualAmount, setManualAmount] = useState(false);
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
    setBaseSalary('');
    setSupplementaryHours('');
    setExtraordinaryHours('');
    setReserveFunds(false);
    setIessAffiliated(false);
    setOtherDeductions('');
    setManualAmount(false);
    setPaymentMethod('');
    setDescription('');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setError(null);
  }, [open, initialProject]);

  // Al elegir empleado se precarga su sueldo y si tiene IESS / fondos.
  useEffect(() => {
    if (!employee) return;
    setBaseSalary(String(employee.monthlySalary));
    setIessAffiliated(Boolean(employee.iessAffiliated));
    setReserveFunds(Boolean(employee.reserveFunds));
    setManualAmount(false);
  }, [employee]);

  const desglose = calcularNomina({
    baseSalary: Number(baseSalary) || 0,
    supplementaryHours: Number(supplementaryHours) || 0,
    extraordinaryHours: Number(extraordinaryHours) || 0,
    reserveFunds,
    iessAffiliated,
    otherDeductions: Number(otherDeductions) || 0,
  });

  // Mientras no se toque el total a mano, sigue al cálculo.
  useEffect(() => {
    if (!manualAmount) setAmount(desglose.total ? String(desglose.total) : '');
  }, [desglose.total, manualAmount]);

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
        baseSalary: Number(baseSalary) || 0,
        supplementaryHours: Number(supplementaryHours) || 0,
        extraordinaryHours: Number(extraordinaryHours) || 0,
        reserveFunds,
        iessAffiliated,
        otherDeductions: Number(otherDeductions) || 0,
        manualAmount,
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
          <Field label="Sueldo del período ($)" required>
            <input
              type="number"
              step="0.01"
              min="0"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

        {/* Rol de pagos: el sistema aplica las fórmulas, solo se ponen las horas */}
        <div className="space-y-3 rounded-lg border border-surface-border bg-surface-muted/30 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-ink-secondary">Horas extras</span>
            <span className="text-[11px] text-ink-tertiary">
              hora = sueldo ÷ {HORAS_MES} = {formatCurrency(desglose.hourValue)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Suplementarias (+50 %)" hint="Entre semana, hasta 4 al día.">
              <input
                type="number"
                step="0.5"
                min="0"
                value={supplementaryHours}
                onChange={(e) => setSupplementaryHours(e.target.value)}
                className="input"
                placeholder="0"
              />
            </Field>
            <Field label="Extraordinarias (+100 %)" hint="Sábados, domingos, feriados y de 24:00 a 06:00.">
              <input
                type="number"
                step="0.5"
                min="0"
                value={extraordinaryHours}
                onChange={(e) => setExtraordinaryHours(e.target.value)}
                className="input"
                placeholder="0"
              />
            </Field>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={reserveFunds}
              onChange={(e) => setReserveFunds(e.target.checked)}
              className="mt-1"
            />
            <span>
              Fondos de reserva <span className="text-ink-tertiary">(+8,33 %)</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={iessAffiliated}
              onChange={(e) => setIessAffiliated(e.target.checked)}
              className="mt-1"
            />
            <span>
              Asegurado/a al IESS <span className="text-ink-tertiary">(−9,45 %)</span>
            </span>
          </label>

          <Field label="Otros descuentos ($)" hint="Anticipos, préstamos, multas…">
            <input
              type="number"
              step="0.01"
              min="0"
              value={otherDeductions}
              onChange={(e) => setOtherDeductions(e.target.value)}
              className="input"
              placeholder="0.00"
            />
          </Field>

          {/* Desglose */}
          <div className="border-t border-surface-border pt-2 text-xs">
            <Linea label="Sueldo" valor={desglose.baseSalary} />
            {desglose.supplementaryAmount > 0 && (
              <Linea
                label={`${desglose.supplementaryHours} h suplementarias`}
                valor={desglose.supplementaryAmount}
              />
            )}
            {desglose.extraordinaryAmount > 0 && (
              <Linea
                label={`${desglose.extraordinaryHours} h extraordinarias`}
                valor={desglose.extraordinaryAmount}
              />
            )}
            {desglose.reserveFundsAmount > 0 && (
              <Linea label="Fondos de reserva (8,33 %)" valor={desglose.reserveFundsAmount} />
            )}
            {desglose.iessAmount > 0 && (
              <Linea label="Aporte IESS (9,45 %)" valor={-desglose.iessAmount} resta />
            )}
            {desglose.otherDeductions > 0 && (
              <Linea label="Otros descuentos" valor={-desglose.otherDeductions} resta />
            )}
            <div className="mt-1 flex items-baseline justify-between border-t border-surface-border pt-2">
              <span className="font-semibold">Total a pagar</span>
              <span className="text-lg font-bold text-brand">
                {formatCurrency(Number(amount) || 0)}
              </span>
            </div>
          </div>
        </div>

        <Field
          label="Monto a pagar ($)"
          required
          hint={
            manualAmount
              ? 'Escrito a mano: ya no sigue al cálculo de arriba.'
              : 'Sale del cálculo. Si lo escribes, se queda con lo que pongas.'
          }
        >
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setManualAmount(true);
              }}
              required
              className="input"
            />
            {manualAmount && (
              <button
                type="button"
                onClick={() => setManualAmount(false)}
                className="btn-secondary shrink-0 text-xs"
              >
                ↻ Recalcular
              </button>
            )}
          </div>
        </Field>

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

/** Una línea del desglose del rol de pagos. */
function Linea({ label, valor, resta }: { label: string; valor: number; resta?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-ink-secondary">{label}</span>
      <span className={resta ? 'text-danger' : 'text-ink-primary'}>
        {resta ? '−' : ''}
        {formatCurrency(Math.abs(valor))}
      </span>
    </div>
  );
}
