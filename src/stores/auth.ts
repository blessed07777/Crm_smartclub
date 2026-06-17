import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('profile load error', error.message);
    return null;
  }
  return data as Profile | null;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    let profile: Profile | null = null;
    if (session?.user) profile = await loadProfile(session.user.id);
    set({ session, profile, initialized: true });

    supabase.auth.onAuthStateChange(async (_evt, newSession) => {
      const prof = newSession?.user ? await loadProfile(newSession.user.id) : null;
      set({ session: newSession, profile: prof });
    });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password, fullName, role) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } },
      });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  refreshProfile: async () => {
    const uid = get().session?.user.id;
    if (!uid) return;
    const p = await loadProfile(uid);
    set({ profile: p });
  },
}));
