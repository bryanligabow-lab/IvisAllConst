'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Field } from '@/components/ui/Modal';
import { CreateProviderModal } from '@/components/forms/CreateProviderModal';
import { apiGet } from '@/lib/api';
import type { Provider } from '@/types';

interface Props {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  required?: boolean;
}

export function ProviderSelector({ value, onChange, label = 'Proveedor', required = false }: Props) {
  const { data: providers, mutate } = useSWR<Provider[]>('/providers', apiGet);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Field label={label} required={required}>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="input flex-1"
        >
          <option value="">
            {required ? '— Selecciona un proveedor —' : '— Sin proveedor —'}
          </option>
          {providers?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.service ? ` · ${p.service}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="btn-secondary whitespace-nowrap"
          title="Crear nuevo proveedor"
        >
          + Nuevo
        </button>
      </div>

      <CreateProviderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={async (created) => {
          await mutate();
          onChange(created.id);
        }}
      />
    </Field>
  );
}
