'use client';

import { create } from 'zustand';
import type { AuthUser } from '@/types';
import { apiGet } from '@/lib/api';

// Roles que NO están restringidos por proyecto (ven todo el sistema).
const UNRESTRICTED_ROLES = ['super_admin', 'admin', 'user', 'viewer'];

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  loadMe: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
  /** ¿El usuario tiene este permiso? super_admin siempre true. */
  can: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  /** Rol operador (residente) sin rol privilegiado por encima. */
  isOperador: () => boolean;
  /** Restringido a sus proyectos asignados (no es admin/super_admin/user). */
  isRestricted: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  setUser: (u) => set({ user: u }),
  loadMe: async () => {
    set({ loading: true });
    try {
      const me = await apiGet<AuthUser>('/auth/me');
      set({ user: me });
    } catch {
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
  can: (permission) => {
    const u = get().user;
    if (!u) return false;
    if (u.roles.includes('super_admin')) return true;
    return u.permissions.includes(permission);
  },
  hasRole: (role) => {
    const u = get().user;
    return !!u && u.roles.includes(role);
  },
  isOperador: () => {
    const u = get().user;
    return !!u && u.roles.includes('operador');
  },
  isRestricted: () => {
    const u = get().user;
    return !!u && !u.roles.some((r) => UNRESTRICTED_ROLES.includes(r));
  },
}));
