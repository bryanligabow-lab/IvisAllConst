'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

// Combobox con barra de búsqueda: permite escribir para filtrar además de
// seleccionar. Útil cuando la lista es larga (proveedores, rubros).
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '— Selecciona —',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        className={`input ${className ?? ''}`}
        value={open ? query : selected?.label ?? ''}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-surface-border bg-surface shadow-card">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-ink-secondary">Sin resultados</div>
          )}
          {filtered.map((o) => (
            <button
              type="button"
              key={o.value}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.value);
                setOpen(false);
                setQuery('');
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                o.value === value ? 'bg-brand-light font-medium text-brand' : ''
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
