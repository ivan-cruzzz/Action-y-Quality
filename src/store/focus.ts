import { create } from "zustand";

export type FocusPhase = "idle" | "work" | "break";

interface FocusState {
  phase: FocusPhase;
  /** Epoch ms when the current phase ends; null when paused/idle. */
  endsAt: number | null;
  /** Remaining ms when paused. */
  pausedRemaining: number | null;
  habitId: string | null;
  workMin: number;
  breakMin: number;
  start: (habitId: string | null) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  toBreak: () => void;
  setDurations: (workMin: number, breakMin: number) => void;
}

export const useFocus = create<FocusState>((set, get) => ({
  phase: "idle",
  endsAt: null,
  pausedRemaining: null,
  habitId: null,
  workMin: 25,
  breakMin: 5,

  start: (habitId) =>
    set({
      phase: "work",
      habitId,
      endsAt: Date.now() + get().workMin * 60_000,
      pausedRemaining: null,
    }),
  pause: () => {
    const { endsAt } = get();
    if (endsAt === null) return;
    set({ endsAt: null, pausedRemaining: Math.max(0, endsAt - Date.now()) });
  },
  resume: () => {
    const { pausedRemaining } = get();
    if (pausedRemaining === null) return;
    set({ endsAt: Date.now() + pausedRemaining, pausedRemaining: null });
  },
  reset: () => set({ phase: "idle", endsAt: null, pausedRemaining: null, habitId: null }),
  toBreak: () =>
    set({
      phase: "break",
      endsAt: Date.now() + get().breakMin * 60_000,
      pausedRemaining: null,
    }),
  setDurations: (workMin, breakMin) => set({ workMin, breakMin }),
}));
