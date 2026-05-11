'use client';

import { Modal } from '@/components/ui/Modal';

export type PaymentType = 'PROVIDER' | 'THIRD_PARTY' | 'PAYROLL';

interface Props {
  open: boolean;
  onClose: () => void;
  onChoose: (type: PaymentType) => void;
}

const OPTIONS = [
  {
    type: 'PROVIDER' as const,
    title: 'Pago a proveedor',
    description: 'Compra de materiales, equipos o servicios contratados a un proveedor registrado.',
    icon: '🏢',
    available: true,
  },
  {
    type: 'THIRD_PARTY' as const,
    title: 'Pago a terceros',
    description: 'Personas o empresas externas sin contrato de proveeduría (asesorías, alquileres, etc.).',
    icon: '🤝',
    available: false,
  },
  {
    type: 'PAYROLL' as const,
    title: 'Pago de nómina',
    description: 'Sueldos, anticipos o liquidaciones a empleados registrados en el módulo de nómina.',
    icon: '👥',
    available: false,
  },
];

export function PaymentTypePicker({ open, onClose, onChoose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="¿Qué tipo de pago vas a crear?" width="lg">
      <p className="mb-4 text-sm text-ink-secondary">
        Selecciona el destino del pago. Cada tipo tiene su propio formulario y registro contable.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            disabled={!opt.available}
            onClick={() => opt.available && onChoose(opt.type)}
            className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all ${
              opt.available
                ? 'border-surface-border bg-surface hover:border-brand hover:shadow-card hover:-translate-y-0.5 cursor-pointer'
                : 'border-surface-border bg-surface-muted opacity-60 cursor-not-allowed'
            }`}
          >
            {!opt.available && (
              <span className="absolute right-2 top-2 rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning">
                Próximamente
              </span>
            )}
            <div className="text-3xl">{opt.icon}</div>
            <div className="text-sm font-semibold text-ink-primary">{opt.title}</div>
            <div className="text-xs text-ink-secondary">{opt.description}</div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
