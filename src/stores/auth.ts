import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Profile, UserRole } from '@/types/database';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    const token = api.token.get();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const me = await api.auth.me();
      set({ user: me, initialized: true });
    } catch {
      api.token.clear();
      set({ user: null, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { token, user } = await api.auth.login(email, password);
      api.token.set(token);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password, full_name, role) => {
    set({ loading: true });
    try {
      const { token, user } = await api.auth.register(email, password, full_name, role);
      api.token.set(token);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  signOut: () => {
    api.token.clear();
    set({ user: null });
  },

  refreshProfile: async () => {
    if (!api.token.get()) return;
    try { set({ user: await api.auth.me() }); } catch { /* ignore */ }
  },
}));
