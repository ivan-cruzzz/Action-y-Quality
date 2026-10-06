import { create } from "zustand";
import { backend, type AuthUser, type Profile } from "@/lib/backend";

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  ready: boolean;
  /** True when the server is unreachable/misconfigured and we fell back locally. */
  offlineFallback: boolean;
  init: () => Promise<void>;
  /** Bot-driven key auth (the key doubles as email + password). */
  signInWithKey: (key: string) => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (p: Profile) => void;
  refreshProfile: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  ready: false,
  offlineFallback: false,

  init: async () => {
    try {
      let user = await backend.getSession();
      let profile: Profile | null = null;
      if (user) {
        profile = await backend.getProfile(user.id);
      } else {
        // No login screens: the app opens as a guest; keys are entered in Settings.
        profile = await backend.ensureGuest();
        user = { id: profile.id, email: profile.email };
      }
      set({ user, profile, ready: true, offlineFallback: false });
    } catch {
      // Server unreachable or misconfigured: run in local emergency mode
      // instead of a blank screen. Fixing the server restores full sync.
      const fallback: Profile = {
        id: "offline",
        email: "offline@local",
        name: "Офлайн",
        role: "user",
        theme: "system",
        locale: "ru",
        xp: 0,
        level: 1,
        goals: [],
        onboarded: true,
        accent: null,
        blob_hue: null,
        blocked: false,
        last_active: null,
        created_at: new Date().toISOString(),
      };
      set({
        user: { id: fallback.id, email: fallback.email },
        profile: fallback,
        ready: true,
        offlineFallback: true,
      });
    }
  },

  signInWithKey: async (key) => {
    const profile = await backend.signInWithKey(key);
    set({ user: { id: profile.id, email: profile.email }, profile });
  },

  signOut: async () => {
    await backend.signOut();
    // Sign-out returns to a fresh guest session, not to a login screen.
    const profile = await backend.ensureGuest();
    set({ user: { id: profile.id, email: profile.email }, profile });
  },

  setProfile: (p) => set({ profile: p }),

  refreshProfile: async () => {
    const u = get().user;
    if (!u) return;
    set({ profile: await backend.getProfile(u.id) });
  },
}));
