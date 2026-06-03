'use client';

import { useEffect, useState } from 'react';
import { Modal, Field } from '@/components/ui/Modal';
import { apiGet, apiPatch, apiPost, ApiClientError } from '@/lib/api';
import { ECUADOR_CITIES, findCity } from '@/lib/ecuador-cities';
import type { Client, ExecutionType, Project, Provider } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Project | null; // si viene → modo edición
  onSaved: () => void;
}

export function CreateProjectModal({ open, onClose, initial, onSaved }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [executionType, setExecutionType] = useState<ExecutionType>('OWN');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [city, setCity] = useState('');
  // Catálogos para los desplegables.
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  // Alta rápida en línea.
  const [newClientName, setNewClientName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [contractAmount, setContractAmount] = useState('');
  const [advancePercent, setAdvancePercent] = useState('40');
  const [guaranteePercent, setGuaranteePercent] = useState('5');
  // IVA
  const [vatPercent, setVatPercent] = useState('15');
  const [vatIncluded, setVatIncluded] = useState(false);
  // Retenciones
  const [isWithholdingAgent, setIsWithholdingAgent] = useState(false);
  const [vatRetentionPercent, setVatRetentionPercent] = useState('70');
  const [incomeRetentionPercent, setIncomeRetentionPercent] = useState('2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<Project['status']>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial;

  // Cargar catálogos de clientes y proveedores al abrir.
  useEffect(() => {
    if (!open) return;
    apiGet<Client[]>('/clients')
      .then(setClients)
      .catch(() => setClients([]));
    apiGet<Provider[]>('/providers')
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCode(initial.code);
      setName(initial.name);
      setClientId(initial.clientId ?? '');
      setExecutionType(initial.executionType ?? 'OWN');
      setSubcontractorId(initial.subcontractorId ?? '');
      setCity(initial.city ?? '');
      setContractAmount(String(initial.contractAmount));
      setAdvancePercent(String(initial.advancePercent));
      setGuaranteePercent(String(initial.guaranteePercent));
      setVatPercent(String(initial.vatPercent ?? 15));
      setVatIncluded(Boolean(initial.vatIncluded));
      setIsWithholdingAgent(Boolean(initial.isWithholdingAgent));
      setVatRetentionPercent(String(initial.vatRetentionPercent ?? 70));
      setIncomeRetentionPercent(String(initial.incomeRetentionPercent ?? 2));
      setStartDate(initial.startDate ? initial.startDate.slice(0, 10) : '');
      setEndDate(initial.endDate ? initial.endDate.slice(0, 10) : '');
      setStatus(initial.status);
    } else {
      setCode('');
      setName('');
      setClientId('');
      setExecutionType('OWN');
      setSubcontractorId('');
      setCity('');
      setContractAmount('');
      setAdvancePercent('40');
      setGuaranteePercent('5');
      setVatPercent('15');
      setVatIncluded(false);
      setIsWithholdingAgent(false);
      setVatRetentionPercent('70');
      setIncomeRetentionPercent('2');
      setStartDate('');
      setEndDate('');
      setStatus('ACTIVE');
    }
    setNewClientName('');
    setNewSubName('');
    setAddingClient(false);
    setAddingSub(false);
    setError(null);
  }, [open, initial]);

  async function handleAddClient() {
    const nm = newClientName.trim();
    if (!nm) return;
    setAddingClient(true);
    try {
      const created = await apiPost<Client>('/clients', { name: nm });
      setClients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(created.id);
      setNewClientName('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear el cliente');
    } finally {
      setAddingClient(false);
    }
  }

  async function handleAddSubcontractor() {
    const nm = newSubName.trim();
    if (!nm) return;
    setAddingSub(true);
    try {
      const created = await apiPost<Provider>('/providers', { name: nm });
      setProviders((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSubcontractorId(created.id);
      setNewSubName('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear el subcontratista');
    } finally {
      setAddingSub(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const cityData = city ? findCity(city) : undefined;
      const payload = {
        code,
        name,
        clientId: clientId || null,
        executionType,
        subcontractorId: executionType === 'SUBCONTRACTED' ? subcontractorId || null : null,
        city: city || undefined,
        latitude: cityData?.lat,
        longitude: cityData?.lng,
        contractAmount: Number(contractAmount),
        advancePercent: Number(advancePercent),
        guaranteePercent: Number(guaranteePercent),
        vatPercent: Number(vatPercent),
        vatIncluded,
        isWithholdingAgent,
        vatRetentionPercent: isWithholdingAgent ? Number(vatRetentionPercent) : 0,
        incomeRetentionPercent: isWithholdingAgent ? Number(incomeRetentionPercent) : 0,
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
          <Field label="Cliente" hint="Quién solicita el contrato">
            <div className="flex gap-1">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="input"
              >
                <option value="">— Selecciona un cliente —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setAddingClient((v) => !v)}
                className="btn-secondary shrink-0 px-2 text-xs"
                title="Agregar cliente"
              >
                + Nuevo
              </button>
            </div>
          </Field>
        </div>

        {addingClient && (
          <div className="flex gap-2 rounded-md border border-surface-border bg-surface-muted p-2">
            <input
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="input"
              placeholder="Nombre del nuevo cliente"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddClient();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void handleAddClient()}
              className="btn-primary shrink-0 px-3 text-xs"
            >
              Agregar
            </button>
          </div>
        )}

        {/* Ejecución de la obra */}
        <fieldset className="rounded-md border border-border bg-surface-muted px-3 py-2">
          <legend className="px-1 text-xs font-medium text-ink-secondary">Ejecución de la obra</legend>
          <div className="flex flex-wrap gap-4 py-1 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="executionType"
                checked={executionType === 'OWN'}
                onChange={() => setExecutionType('OWN')}
              />
              Propia (<strong>CREACOM</strong>)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="executionType"
                checked={executionType === 'SUBCONTRACTED'}
                onChange={() => setExecutionType('SUBCONTRACTED')}
              />
              Subcontratada
            </label>
          </div>

          {executionType === 'SUBCONTRACTED' && (
            <div className="mt-1">
              <Field label="Subcontratista">
                <div className="flex gap-1">
                  <select
                    value={subcontractorId}
                    onChange={(e) => setSubcontractorId(e.target.value)}
                    className="input"
                  >
                    <option value="">— Selecciona un subcontratista —</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingSub((v) => !v)}
                    className="btn-secondary shrink-0 px-2 text-xs"
                    title="Agregar subcontratista"
                  >
                    + Nuevo
                  </button>
                </div>
              </Field>
              {addingSub && (
                <div className="mt-2 flex gap-2 rounded-md border border-surface-border bg-surface p-2">
                  <input
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="input"
                    placeholder="Nombre del subcontratista"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAddSubcontractor();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddSubcontractor()}
                    className="btn-primary shrink-0 px-3 text-xs"
                  >
                    Agregar
                  </button>
                </div>
              )}
            </div>
          )}
        </fieldset>

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

        {/* IVA */}
        <fieldset className="rounded-md border border-border bg-surface-muted px-3 py-2">
          <legend className="px-1 text-xs font-medium text-ink-secondary">IVA</legend>
          <div className="grid grid-cols-3 gap-3">
            <Field label="IVA %" hint="15% por defecto en Ecuador">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={vatPercent}
                onChange={(e) => setVatPercent(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="¿Los valores que ingresas son…?">
              <select
                value={vatIncluded ? 'gross' : 'net'}
                onChange={(e) => setVatIncluded(e.target.value === 'gross')}
                className="input"
              >
                <option value="net">Sin IVA (valor base)</option>
                <option value="gross">Con IVA incluido</option>
              </select>
            </Field>
            <Field label=" " hint={vatIncluded ? 'Se descompone IVA del valor.' : 'Se suma IVA al final.'}>
              <div className="input bg-bg text-xs leading-[1.8] text-ink-secondary">
                {contractAmount
                  ? vatIncluded
                    ? `Base: ${(Number(contractAmount) / (1 + Number(vatPercent) / 100)).toFixed(2)}`
                    : `Con IVA: ${(Number(contractAmount) * (1 + Number(vatPercent) / 100)).toFixed(2)}`
                  : '—'}
              </div>
            </Field>
          </div>
        </fieldset>

        {/* Retenciones */}
        <fieldset className="rounded-md border border-border bg-surface-muted px-3 py-2">
          <legend className="px-1 text-xs font-medium text-ink-secondary">Retenciones del cliente</legend>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isWithholdingAgent}
              onChange={(e) => setIsWithholdingAgent(e.target.checked)}
            />
            El cliente es <strong>agente de retención</strong> (retiene IVA y/o Renta)
          </label>
          {isWithholdingAgent && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="% retención IVA" hint="Típico: 30 / 70 / 100">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={vatRetentionPercent}
                  onChange={(e) => setVatRetentionPercent(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="% retención Renta" hint="Típico: 1 / 1,75 / 2 / 8 / 10">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={incomeRetentionPercent}
                  onChange={(e) => setIncomeRetentionPercent(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
          )}
        </fieldset>

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
