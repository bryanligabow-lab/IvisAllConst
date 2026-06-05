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
import { useAuthStore } from '@/stores/authStore';
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
  const { can, isRestricted } = useAuthStore();
  // El operador puede crear órdenes pero NO aprobar/pagar/ver las listas.
  const canApprove = can('payment_orders.approve');
  const restricted = isRestricted();
  // Solo cargamos el listado cuando el usuario puede aprobar/ver montos.
  const { data: orders, isLoading, mutate } = useSWR<PaymentOrder[]>(
    canApprove ? `/payment-orders?projectId=${params.id}` : null,
    apiGet,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showPayroll, setShowPayroll] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [payingOrder, setPayingOrder] = useState<PaymentOrder | null>(null);
  // Pestañas para el flujo: cargar órdenes vs aprobarlas (solo quien aprueba).
  const [tab, setTab] = useState<'CARGAR' | 'APROBAR'>('CARGAR');

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
          onClick={() => (restricted ? setShowCreate(true) : setShowTypePicker(true))}
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

      {/* Operador: solo carga, sin listas ni aprobación */}
      {!canApprove && (
        <div className="card text-sm text-ink-secondary">
          Carga aquí las órdenes de pago (facturas) del proyecto. Quedan en estado{' '}
          <strong>pendiente</strong> para que administración las revise y apruebe.
        </div>
      )}

      {canApprove && (
        <>
          {/* Pestañas Cargar / Aprobar */}
          <div className="mb-5 flex gap-0 border-b border-surface-border">
            <button
              onClick={() => setTab('CARGAR')}
              className={`tab ${tab === 'CARGAR' ? 'tab-active' : ''}`}
            >
              Cargar
            </button>
            <button
              onClick={() => setTab('APROBAR')}
              className={`tab ${tab === 'APROBAR' ? 'tab-active' : ''}`}
            >
              Aprobar ({pending.length})
            </button>
          </div>

          {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

          {tab === 'CARGAR' && (
            <section>
              <div className="card mb-4 text-sm text-ink-secondary">
                Carga las facturas como órdenes de pago con <strong>+ Nueva orden de pago</strong>.
                Quedan <strong>pendientes</strong> y luego se aprueban en la pestaña{' '}
                <strong>Aprobar</strong> — ahí se registra el gasto automáticamente.
              </div>
              <h2 className="mb-2 text-sm font-medium">
                Órdenes cargadas — pendientes ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <div className="card text-sm text-ink-secondary">
                  No hay órdenes cargadas todavía.
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      statusLabel={STATUS_LABEL[o.status]}
                      statusClass={STATUS_CLASS[o.status]}
                      canPay={false}
                      onPay={() => setPayingOrder(o)}
                      onDelete={() => setPendingDelete(o)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'APROBAR' && (
            <>
              <section className="mb-6">
                <h2 className="mb-2 text-sm font-medium">
                  Pendientes de aprobar ({pending.length})
                </h2>
                {pending.length === 0 ? (
                  <div className="card text-sm text-ink-secondary">
                    No hay órdenes pendientes de aprobar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pending.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        statusLabel={STATUS_LABEL[o.status]}
                        statusClass={STATUS_CLASS[o.status]}
                        canPay
                        onPay={() => setPayingOrder(o)}
                        onDelete={() => setPendingDelete(o)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium">Aprobadas / pagadas ({paid.length})</h2>
                {paid.length === 0 ? (
                  <div className="card text-sm text-ink-secondary">
                    Todavía no hay órdenes aprobadas.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paid.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        statusLabel={STATUS_LABEL[o.status]}
                        statusClass={STATUS_CLASS[o.status]}
                        canPay={false}
                        onPay={() => setPayingOrder(o)}
                        onDelete={() => setPendingDelete(o)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

interface CardProps {
  order: PaymentOrder;
  statusLabel: string;
  statusClass: string;
  onPay: () => void;
  onDelete: () => void;
  canPay?: boolean;
}

function OrderCard({ order, statusLabel, statusClass, onPay, onDelete, canPay = true }: CardProps) {
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
          {order.items && order.items.length > 1 && (
            <div className="mt-1 text-xs text-ink-secondary">
              📑 Desglose:{' '}
              {order.items.map((it, i) => (
                <span key={it.id}>
                  {i > 0 && ' · '}
                  {it.rubro.code} ({formatCurrency(Number(it.amount), true)})
                </span>
              ))}
            </div>
          )}
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
        {isPending && canPay && (
          <button onClick={onPay} className="btn-success">
            {hasPartial ? '💰 Pagar saldo' : '✓ Aprobar y pagar'}
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
