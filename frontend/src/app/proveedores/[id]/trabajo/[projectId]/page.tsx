'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { apiGet, apiPost, apiPatch, apiDelete, ApiClientError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';

interface Item {
  id: string;
  description: string;
  amount: number;
  orderIndex: number;
}
interface SubcontractDetail {
  id: string;
  provider: { id: string; name: string };
  project: { id: string; name: string; code: string };
  items: Item[];
  total: number;
  paid: number;
  balance: number;
}

export default function SubcontractDetailPage() {
  const params = useParams<{ id: string; projectId: string }>();
  const base = `/providers/${params.id}/subcontracts/${params.projectId}`;
  const { data, isLoading, error, mutate } = useSWR<SubcontractDetail>(base, apiGet);
  const canWrite = useAuthStore().can('providers.write');

  if (isLoading) {
    return (
      <AppShell>
        <div className="text-sm text-ink-secondary">Cargando trabajo…</div>
      </AppShell>
    );
  }
  if (error || !data) {
    return (
      <AppShell>
        <Link href={`/proveedores/${params.id}`} className="text-xs text-brand hover:underline">
          ← Volver al proveedor
        </Link>
        <div className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          No se pudo cargar el trabajo subcontratado.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/proveedores/${params.id}`} className="text-xs text-brand hover:underline">
        ← Volver a {data.provider.name}
      </Link>

      <header className="mt-3 mb-5">
        <div className="text-xs uppercase tracking-wider text-ink-tertiary">
          Trabajo subcontratado a {data.provider.name}
        </div>
        <h1 className="text-xl font-medium">{data.project.name}</h1>
        <div className="text-xs text-ink-secondary">{data.project.code}</div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Valor subcontratado" value={formatCurrency(data.total)} tone="brand" />
        <Metric label="Dado (pagado)" value={formatCurrency(data.paid)} tone="success" />
        <Metric
          label="Saldo por pagar"
          value={formatCurrency(data.balance)}
          tone={data.balance > 0 ? 'danger' : data.balance < 0 ? 'warning' : 'default'}
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium">Rubros del trabajo</h2>
        <div className="card overflow-x-auto">
          <table className="table-default">
            <thead>
              <tr>
                <th>Rubro / descripción</th>
                <th className="text-right">Valor</th>
                {canWrite && <th className="w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 3 : 2} className="text-sm text-ink-secondary">
                    Aún no hay rubros. Agrega el primero abajo.
                  </td>
                </tr>
              )}
              {data.items.map((it) => (
                <ItemRow
                  key={it.id}
                  base={base}
                  item={it}
                  canWrite={canWrite}
                  onChanged={() => mutate()}
                />
              ))}
              <tr className="border-t-2 border-surface-border">
                <td className="font-semibold">TOTAL SUBCONTRATADO</td>
                <td className="text-right font-semibold text-brand">{formatCurrency(data.total)}</td>
                {canWrite && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>

        {canWrite && <AddItem base={base} onAdded={() => mutate()} />}
      </section>
    </AppShell>
  );
}

function ItemRow({
  base,
  item,
  canWrite,
  onChanged,
}: {
  base: string;
  item: Item;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description);
  const [amount, setAmount] = useState(String(item.amount));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await apiPatch(`${base}/items/${item.id}`, {
        description: desc.trim(),
        amount: Number(amount) || 0,
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await apiDelete(`${base}/items/${item.id}`);
      onChanged();
    } catch {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input h-8 w-full text-sm"
            autoFocus
          />
          {err && <div className="text-[10px] text-danger">{err}</div>}
        </td>
        <td className="text-right">
          <input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input h-8 w-28 text-right text-sm"
          />
        </td>
        <td>
          <div className="flex gap-1">
            <button onClick={save} disabled={busy} className="btn-primary h-8 px-2 text-[11px] disabled:opacity-50">
              {busy ? '…' : 'Guardar'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDesc(item.description);
                setAmount(String(item.amount));
                setErr(null);
              }}
              className="text-[11px] text-ink-tertiary hover:underline"
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{item.description}</td>
      <td className="text-right">{formatCurrency(item.amount)}</td>
      {canWrite && (
        <td>
          <div className="flex gap-1.5">
            <button
              onClick={() => setEditing(true)}
              className="rounded px-1 text-ink-tertiary hover:text-ink-primary"
              title="Editar rubro"
            >
              ✏️
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="rounded px-1 text-ink-tertiary hover:text-danger disabled:opacity-50"
              title="Eliminar rubro"
            >
              🗑️
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddItem({ base, onAdded }: { base: string; onAdded: () => void }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!desc.trim()) {
      setErr('Escribe la descripción del rubro');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiPost(`${base}/items`, { description: desc.trim(), amount: Number(amount) || 0 });
      setDesc('');
      setAmount('');
      onAdded();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'No se pudo agregar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-surface-border p-3">
      <div className="mb-1 text-xs font-medium text-ink-secondary">+ Agregar rubro</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs text-ink-secondary">Descripción</span>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Ej. Mano de obra estructura, pintura…"
            className="input text-sm"
          />
        </label>
        <label className="w-40">
          <span className="mb-1 block text-xs text-ink-secondary">Valor</span>
          <input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="0.00"
            className="input text-sm"
          />
        </label>
        <button onClick={add} disabled={busy} className="btn-primary text-xs disabled:opacity-50">
          {busy ? 'Agregando…' : 'Agregar'}
        </button>
      </div>
      {err && <div className="mt-1 text-xs text-danger">{err}</div>}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'brand' | 'warning';
}) {
  const colour =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'brand'
          ? 'text-brand'
          : tone === 'warning'
            ? 'text-warning'
            : 'text-ink-primary';
  return (
    <div className="metric-card">
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className={`mt-1 text-xl font-medium ${colour}`}>{value}</div>
    </div>
  );
}
