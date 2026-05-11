'use client';

import { useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPost, ApiClientError } from '@/lib/api';
import type { Project } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contractor, setContractor] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [advancePercent, setAdvancePercent] = useState('40');
  const [guaranteePercent, setGuaranteePercent] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode('');
    setName('');
    setContractor('');
    setContractAmount('');
    setAdvancePercent('40');
    setGuaranteePercent('5');
    setStartDate('');
    setEndDate('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost<Project>('/projects', {
        code,
        name,
        contractor: contractor || undefined,
        contractAmount: Number(contractAmount),
        advancePercent: Number(advancePercent),
        guaranteePercent: Number(guaranteePercent),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: 'ACTIVE',
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al crear el proyecto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo proyecto">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código" required>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="input"
              placeholder="TEC-URB-001-2026"
            />
          </Field>
          <Field label="Contratante">
            <input
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              className="input"
              placeholder="Empresa S.A."
            />
          </Field>
        </div>

        <Field label="Nombre del proyecto" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
            placeholder="Urbanización Los Pinos — Fase 2"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Monto contrato" required>
            <input
              type="number"
              step="0.01"
              min="0"
              value={contractAmount}
              onChange={(e) => setContractAmount(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Anticipo %">
            <input
              type="number"
              min="0"
              max="100"
              value={advancePercent}
              onChange={(e) => setAdvancePercent(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Garantía %">
            <input
              type="number"
              min="0"
              max="100"
              value={guaranteePercent}
              onChange={(e) => setGuaranteePercent(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Fin estimado">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        {error && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
