'use client';

import { create } from 'zustand';
import type { AuthUser } from '@/types';
import { apiGet } from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  loadMe: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
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
}));
