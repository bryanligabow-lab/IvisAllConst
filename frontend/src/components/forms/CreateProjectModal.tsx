'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiPatch, apiPost, ApiClientError } from '@/lib/api';
import { ECUADOR_CITIES, findCity } from '@/lib/ecuador-cities';
import type { Project } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Project | null; // si viene → modo edición
  onSaved: () => void;
}

export function CreateProjectModal({ open, onClose, initial, onSaved }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contractor, setContractor] = useState('');
  const [city, setCity] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [advancePercent, setAdvancePercent] = useState('40');
  const [guaranteePercent, setGuaranteePercent] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<Project['status']>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCode(initial.code);
      setName(initial.name);
      setContractor(initial.contractor ?? '');
      setCity(initial.city ?? '');
      setContractAmount(String(initial.contractAmount));
      setAdvancePercent(String(initial.advancePercent));
      setGuaranteePercent(String(initial.guaranteePercent));
      setStartDate(initial.startDate ? initial.startDate.slice(0, 10) : '');
      setEndDate(initial.endDate ? initial.endDate.slice(0, 10) : '');
      setStatus(initial.status);
    } else {
      setCode('');
      setName('');
      setContractor('');
      setCity('');
      setContractAmount('');
      setAdvancePercent('40');
      setGuaranteePercent('5');
      setStartDate('');
      setEndDate('');
      setStatus('ACTIVE');
    }
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const cityData = city ? findCity(city) : undefined;
      const payload = {
        code,
        name,
        contractor: contractor || undefined,
        city: city || undefined,
        latitude: cityData?.lat,
        longitude: cityData?.lng,
        contractAmount: Number(contractAmount),
        advancePercent: Number(advancePercent),
        guaranteePercent: Number(guaranteePercent),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status,
      };
      if (initial?.id) {
        await apiPatch<Project>(`/projects/${initial.id}`, payload);
      } else {
        await apiPost<Project>('/projects', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al guardar el proyecto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}>
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

        <Field label="Ciudad" hint="Define el punto del mapa en el Dashboard">
          <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
            <option value="">— Sin ubicación —</option>
            {ECUADOR_CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} · {c.province}
              </option>
            ))}
          </select>
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

        <div className="grid grid-cols-3 gap-3">
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
          <Field label="Estado">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Project['status'])}
              className="input"
            >
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activo</option>
              <option value="PAUSED">Pausado</option>
              <option value="COMPLETED">Completado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
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
            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
