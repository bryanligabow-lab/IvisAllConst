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
  /** Modo subcontratista: lista solo subcontratistas y el alta los marca como tal. */
  subcontractor?: boolean;
}

export function ProviderSelector({
  value,
  onChange,
  label,
  required = false,
  subcontractor = false,
}: Props) {
  const key = subcontractor ? '/providers?subcontractor=true' : '/providers';
  const { data: providers, mutate } = useSWR<Provider[]>(key, apiGet);
  const [showCreate, setShowCreate] = useState(false);

  const noun = subcontractor ? 'subcontratista' : 'proveedor';
  const fieldLabel = label ?? (subcontractor ? 'Subcontratista' : 'Proveedor');

  return (
    <Field label={fieldLabel} required={required}>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchableSelect
            value={value}
            onChange={onChange}
            placeholder={required ? `— Selecciona o escribe un ${noun} —` : `— Sin ${noun} —`}
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
          title={`Crear nuevo ${noun}`}
        >
          + Nuevo
        </button>
      </div>

      <CreateProviderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        asSubcontractor={subcontractor}
        onSaved={async (created) => {
          await mutate();
          onChange(created.id);
        }}
      />
    </Field>
  );
}
