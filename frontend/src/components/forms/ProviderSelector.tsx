'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Field } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
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
        <div className="min-w-0 flex-1">
          <SearchableSelect
            value={value}
            onChange={onChange}
            placeholder={
              required ? '— Selecciona o escribe un proveedor —' : '— Sin proveedor —'
            }
            options={(providers ?? []).map((p) => ({
              value: p.id,
              label: `${p.name}${p.service ? ` · ${p.service}` : ''}`,
            }))}
          />
        </div>
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
