'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AppShell } from '@/components/layouts/AppShell';
import { CreateProductModal } from '@/components/forms/CreateProductModal';
import { DeleteConfirmDialog } from '@/components/forms/DeleteConfirmDialog';
import { apiDelete, apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Product } from '@/types';

export default function ProductosPage() {
  const { data, isLoading, mutate } = useSWR<Product[]>('/products', apiGet);
  const { can } = useAuthStore();
  const canWrite = can('proformas.write');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-xs text-ink-secondary">
            Catálogo de productos que se repiten. Al crear una proforma elige el producto y solo
            ajusta cantidad y precio.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Nuevo producto
          </button>
        )}
      </div>

      <CreateProductModal open={showCreate} onClose={() => setShowCreate(false)} onSaved={() => mutate()} />
      <CreateProductModal
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSaved={() => mutate()}
      />

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        itemLabel={pendingDelete ? `el producto "${pendingDelete.name}"` : ''}
        warning="Las proformas ya creadas no se modifican."
        onConfirm={async (code) => {
          if (!pendingDelete) return;
          await apiDelete(`/products/${pendingDelete.id}`, { deleteCode: code });
          await mutate();
          setPendingDelete(null);
        }}
      />

      {isLoading && <div className="text-sm text-ink-secondary">Cargando…</div>}

      {data && data.length === 0 && (
        <div className="card text-sm text-ink-secondary">
          Aún no hay productos guardados. Créalos aquí, o desde una proforma con{' '}
          <strong>💾 Guardar como producto</strong> en cada ítem.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table-default table-cards">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Unidad</th>
                <th>Descripción</th>
                <th className="text-right">Precio unitario</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td data-label="Producto" className="font-medium">{p.name}</td>
                  <td data-label="Unidad" className="text-xs">{p.unit}</td>
                  <td data-label="Descripción" className="max-w-md text-xs text-ink-secondary">
                    {p.description}
                  </td>
                  <td data-label="Precio unitario" className="text-right">
                    {formatCurrency(p.unitPrice)}
                  </td>
                  <td data-label="" className="cell-actions">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(p)}
                          className="rounded-md px-2 py-1 text-xs hover:bg-surface-muted"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setPendingDelete(p)}
                          className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-danger-soft hover:text-danger"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
