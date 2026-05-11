'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreatePaymentOrderModal } from '@/components/forms/CreatePaymentOrderModal';
import { apiDelete, apiGet, apiPost, ApiClientError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ProjectSummary } from '@/types';

type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED';
interface PaymentOrder {
  id: string;
  projectId: string;
  rubroId: string;
  description: string;
  amount: number;
  invoiceNumber: string | null;
  scheduledDate: string;
  paidAt: string | null;
  status: OrderStatus;
  gastoId: string | null;
  createdAt: string;
  rubro?: { code: string; name: string };
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: 'badge-warn',
  PAID: 'badge-ok',
  CANCELLED: 'badge-muted',
};

export default function OrdenesPage() {
  const params = useParams<{ id: string }>();
  const { data: summary, mutate: mutateSummary } = useSWR<ProjectSummary>(
    `/projects/${params.id}/summary`,
    apiGet,
  );
  const { data: orders, isLoading, mutate } = useSWR<PaymentOrder[]>(
    `/payment-orders?projectId=${params.id}`,
    apiGet,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markPaid(order: PaymentOrder) {
    if (
      !window.confirm(
        `¿Marcar la orden "${order.description}" como pagada?\n\nMonto: ${formatCurrency(
          Number(order.amount),
          true,
        )}\n\nSe registrará automáticamente como gasto en el rubro ${order.rubro?.code}. ${order.rubro?.name}.`,
      )
    )
      return;
    setBusyId(order.id);
    try {
      await apiPost(`/payment-orders/${order.id}/pay`, {});
      mutate();
      mutateSummary();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'No se pudo marcar como pagada');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(order: PaymentOrder) {
    const msg =
      order.status === 'PAID'
        ? `¿Eliminar la orden "${order.description}"?\n\nComo ya está pagada, también se borrará el gasto generado y el saldo del rubro se restaurará.`
        : `¿Eliminar la orden "${order.description}"?`;
    if (!window.confirm(msg)) return;
    setBusyId(order.id);
    try {
      await apiDelete(`/payment-orders/${order.id}`);
      mutate();
      mutateSummary();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : 'No se pudo eliminar la orden');
    } finally {
      setBusyId(null);
    }
  }

  const pending = orders?.filter((o) => o.status === 'PENDING') ?? [];
  const paid = orders?.filter((o) => o.status === 'PAID') ?? [];

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          Órdenes de pago {summary ? `— ${summary.project.name}` : ''}
        </h1>
        <button onClick={() => setShowCreate(true)} disabled={!summary} className="btn-primary disabled:opacity-50">
          + Nueva orden de pago
        </button>
      </div>

      <p className="mb-3 text-xs text-ink-secondary">
        Crea órdenes con fecha futura. Al marcarlas como pagadas, se registran automáticamente
        como gasto del rubro correspondiente.
      </p>

      {summary && (
        <CreatePaymentOrderModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          projectId={params.id}
          rubros={summary.rubros}
          onCreated={() => mutate()}
        />
      )}

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium">Pendientes ({pending.length})</h2>
        <div className="card">
          {pending.length === 0 ? (
            <div className="text-sm text-ink-secondary">No hay órdenes pendientes.</div>
          ) : (
            <ul className="space-y-2">
              {pending.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  busy={busyId === o.id}
                  onPay={() => markPaid(o)}
                  onDelete={() => handleDelete(o)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Pagadas ({paid.length})</h2>
        <div className="card">
          {paid.length === 0 ? (
            <div className="text-sm text-ink-secondary">Todavía no hay órdenes pagadas.</div>
          ) : (
            <ul className="space-y-2">
              {paid.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  busy={busyId === o.id}
                  onPay={() => undefined}
                  onDelete={() => handleDelete(o)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}

interface RowProps {
  order: PaymentOrder;
  busy: boolean;
  onPay: () => void;
  onDelete: () => void;
}

function OrderRow({ order, busy, onPay, onDelete }: RowProps) {
  const isPending = order.status === 'PENDING';
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-surface-border py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">
          {order.description}
          {order.rubro && (
            <span className="text-ink-secondary">
              {' · '}
              {order.rubro.code}. {order.rubro.name}
            </span>
          )}
        </div>
        <div className="text-xs text-ink-secondary">
          Programada: {formatDate(order.scheduledDate)}
          {order.paidAt && ` · Pagada: ${formatDate(order.paidAt)}`}
          {order.invoiceNumber && ` · Factura ${order.invoiceNumber}`}
        </div>
      </div>
      <div className="shrink-0 text-sm font-medium">{formatCurrency(Number(order.amount), true)}</div>
      <span className={`${STATUS_CLASS[order.status]} shrink-0`}>{STATUS_LABEL[order.status]}</span>
      {isPending && (
        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          className="btn-success disabled:opacity-50"
        >
          {busy ? 'Pagando…' : 'Marcar como pagado'}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        title="Eliminar orden"
      >
        🗑️
      </button>
    </li>
  );
}
