'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layouts/AppShell';
import { ProjectTabs } from '@/components/layouts/ProjectTabs';
import { CreatePaymentOrderModal } from '@/components/forms/CreatePaymentOrderModal';
import { PaymentDialog } from '@/components/forms/PaymentDialog';
import { PaymentTypePicker, type PaymentType } from '@/components/forms/PaymentTypePicker';
import { PayrollPaymentModal } from '@/components/forms/PayrollPaymentModal';
import { apiDelete, apiGet } from '@/lib/api';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { formatCurrency, formatDate, formatCalendarDate } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/constants';
import type { PaymentOrder, ProjectSummary } from '@/types';

const STATUS_LABEL = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
} as const;

const STATUS_CLASS = {
  PENDING: 'badge-warn',
  PAID: 'badge-ok',
  CANCELLED: 'badge-muted',
} as const;

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
  const [showPayroll, setShowPayroll] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [payingOrder, setPayingOrder] = useState<PaymentOrder | null>(null);

  function handleTypeChosen(type: PaymentType) {
    setShowTypePicker(false);
    if (type === 'PROVIDER') {
      setShowCreate(true);
    } else if (type === 'PAYROLL') {
      setShowPayroll(true);
    }
    // THIRD_PARTY queda pendiente
  }

  const [pendingDelete, setPendingDelete] = useState<PaymentOrder | null>(null);

  const pending = orders?.filter((o) => o.status === 'PENDING') ?? [];
  const paid = orders?.filter((o) => o.status === 'PAID') ?? [];

  return (
    <AppShell>
      <ProjectTabs projectId={params.id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          Órdenes de pago {summary ? `— ${summary.project.name}` : ''}
        </h1>
        <button
          onClick={() => setShowTypePicker(true)}
          disabled={!summary}
          className="btn-primary disabled:opacity-50"
        >
          + Nueva orden de pago
        </button>
      </div>

      <p className="mb-3 text-xs text-ink-secondary">
        Crea órdenes con fecha futura. Al pagar, puedes hacer pago total o registrar anticipos
        parciales. Cuando se complete el monto, la orden se cierra automáticamente.
      </p>

      <PaymentTypePicker
        open={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        onChoose={handleTypeChosen}
      />

      <PayrollPaymentModal
        open={showPayroll}
        onClose={() => setShowPayroll(false)}
        projectId={params.id}
        onCreated={() => {
          mutate();
          mutateSummary();
        }}
      />

      {summary && (
        <CreatePaymentOrderModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          projectId={params.id}
          rubros={summary.rubros}
          onCreated={() => mutate()}
        />
      )}

      <PaymentDialog
        open={!!payingOrder}
        onClose={() => setPayingOrder(null)}
        order={payingOrder}
        onPaid={() => {
          mutate();
          mutateSummary();
        }}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `la orden "${pendingDelete.description}"` : ''}
        warning={
          pendingDelete && (pendingDelete.gastos?.length ?? 0) > 0
            ? `Se borrarán también ${pendingDelete.gastos!.length} gasto(s) asociado(s) y el saldo del rubro se restaurará.`
            : undefined
        }
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/payment-orders/${pendingDelete.id}`, { deleteCode: code });
          await Promise.all([mutate(), mutateSummary()]);
          setPendingDelete(null);
        }}
      />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium">Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="card text-sm text-ink-secondary">No hay órdenes pendientes.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                statusLabel={STATUS_LABEL[o.status]}
                statusClass={STATUS_CLASS[o.status]}
                onPay={() => setPayingOrder(o)}
                onDelete={() => setPendingDelete(o)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Pagadas ({paid.length})</h2>
        {paid.length === 0 ? (
          <div className="card text-sm text-ink-secondary">Todavía no hay órdenes pagadas.</div>
        ) : (
          <div className="space-y-3">
            {paid.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                statusLabel={STATUS_LABEL[o.status]}
                statusClass={STATUS_CLASS[o.status]}
                onPay={() => setPayingOrder(o)}
                onDelete={() => setPendingDelete(o)}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

interface CardProps {
  order: PaymentOrder;
  statusLabel: string;
  statusClass: string;
  onPay: () => void;
  onDelete: () => void;
}

function OrderCard({ order, statusLabel, statusClass, onPay, onDelete }: CardProps) {
  const total = Number(order.amount);
  const paid = Number(order.paidAmount ?? 0);
  const pending = Number(order.pendingAmount ?? Math.max(0, total - paid));
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const isPending = order.status === 'PENDING';
  const hasPartial = paid > 0 && pending > 0;

  return (
    <article className="card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{order.description}</div>
          <div className="text-xs text-ink-secondary">
            {order.rubro && (
              <>
                Rubro {order.rubro.code}. {order.rubro.name}
                {' · '}
              </>
            )}
            Programada: {formatCalendarDate(order.scheduledDate)}
            {order.paidAt && ` · Pagada: ${formatDate(order.paidAt)}`}
            {order.invoiceNumber && ` · Factura ${order.invoiceNumber}`}
          </div>
          {order.provider && (
            <div className="mt-1 text-xs text-ink-secondary">
              🏢 Proveedor: <span className="font-medium text-ink-primary">{order.provider.name}</span>
              {order.provider.service ? ` · ${order.provider.service}` : ''}
            </div>
          )}
          {order.paymentMethod && (
            <div className="mt-0.5 text-xs text-ink-secondary">
              💳 Método: <span className="font-medium text-ink-primary">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-base font-medium">{formatCurrency(total, true)}</div>
          <span className={statusClass}>{statusLabel}</span>
        </div>
      </header>

      {(hasPartial || !isPending) && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full transition-all ${
                pct >= 100 ? 'bg-success' : 'bg-brand'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-secondary">
            <span>
              Pagado: <span className="font-medium text-ink-primary">{formatCurrency(paid, true)}</span>
            </span>
            <span>
              {isPending ? (
                <>
                  Pendiente:{' '}
                  <span className="font-medium text-danger">{formatCurrency(pending, true)}</span>
                </>
              ) : (
                <span className="font-medium text-success">{pct}%</span>
              )}
            </span>
          </div>
        </div>
      )}

      {order.gastos && order.gastos.length > 1 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-ink-secondary hover:text-ink-primary">
            Ver {order.gastos.length} pagos registrados
          </summary>
          <ul className="mt-2 space-y-1 border-l-2 border-surface-border pl-3">
            {order.gastos.map((g) => (
              <li key={g.id} className="flex justify-between">
                <span>
                  {formatCalendarDate(g.gastoDate)} — {g.description}
                </span>
                <span className="font-medium">{formatCurrency(Number(g.amount), true)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <footer className="mt-4 flex flex-wrap justify-end gap-2">
        {isPending && (
          <button onClick={onPay} className="btn-success">
            {hasPartial ? '💰 Pagar saldo' : '💰 Marcar como pagado'}
          </button>
        )}
        <button
          onClick={onDelete}
          className="btn-secondary text-danger hover:bg-danger-soft"
          title="Eliminar orden"
        >
          🗑️ Eliminar
        </button>
      </footer>
    </article>
  );
}
