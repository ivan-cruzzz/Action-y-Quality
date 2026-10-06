/**
 * Offline write queue for the Supabase backend.
 *
 * When a write fails because the network is down, the operation descriptor is
 * parked in localStorage and replayed automatically when connectivity returns.
 * Data is never lost: reads come from the persisted React Query cache, writes
 * wait here.
 */
import type { Backend } from "./backend/types";

const KEY = "aq.offline-ops";

export interface PendingOp {
  id: string;
  at: string;
  op:
    | { kind: "setHabitLog"; habitId: string; date: string; done: boolean }
    | { kind: "setMood"; date: string; mood: number; note?: string }
    | { kind: "createPlan"; title: string; due: string; repeat?: string; subtasks?: unknown }
    | { kind: "updatePlan"; id: string; patch: Record<string, unknown> }
    | { kind: "deletePlan"; id: string }
    | { kind: "addGameScore"; game: string; score: number }
    | { kind: "completeDailyChallenge"; date: string; code: string };
}

function load(): PendingOp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PendingOp[];
  } catch {
    return [];
  }
}

function save(ops: PendingOp[]) {
  localStorage.setItem(KEY, JSON.stringify(ops));
}

export function enqueueOp(op: PendingOp["op"]): PendingOp {
  const entry: PendingOp = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    op,
  };
  save([...load(), entry]);
  return entry;
}

export function pendingCount(): number {
  return load().length;
}

export function isNetworkError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return /failed to fetch|networkerror|load failed|network/i.test(msg);
}

type PlanRepeat = "none" | "daily" | "weekly" | "monthly";
type PlanSubtasks = { title: string; done: boolean }[];
type GameKeyLike = "catch" | "quiz" | "breathe" | "memory";

/** The session user id captured at enqueue time (localStorage cache). */
function queueUserId(): string {
  try {
    const cached = JSON.parse(localStorage.getItem("aq.session-cache") ?? "null");
    return cached?.user?.id ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Replays every queued op against the real backend. Returns applied count. */
export async function replayQueue(backend: Backend): Promise<number> {
  const ops = load();
  if (!ops.length) return 0;
  const remaining: PendingOp[] = [];
  let applied = 0;
  for (const entry of ops) {
    try {
      const o = entry.op;
      const uid = queueUserId();
      switch (o.kind) {
        case "setHabitLog":
          await backend.setHabitLog(o.habitId, uid, o.date, o.done);
          break;
        case "setMood":
          await backend.setMood(uid, o.date, o.mood, o.note);
          break;
        case "createPlan":
          await backend.createPlan({
            user_id: uid,
            title: o.title,
            due: o.due,
            repeat: (o.repeat as PlanRepeat) ?? "none",
            subtasks: (o.subtasks as PlanSubtasks) ?? [],
          });
          break;
        case "updatePlan":
          await backend.updatePlan(o.id, o.patch);
          break;
        case "deletePlan":
          await backend.deletePlan(o.id);
          break;
        case "addGameScore":
          await backend.addGameScore(uid, o.game as GameKeyLike, o.score);
          break;
        case "completeDailyChallenge":
          await backend.completeDailyChallenge(uid, o.date, o.code);
          break;
      }
      applied += 1;
    } catch (e) {
      if (isNetworkError(e)) remaining.push(entry);
      // non-network errors (conflict, not found) — drop, data is stale
    }
  }
  save(remaining);
  return applied;
}

let listening = false;
const listeners = new Set<(n: number) => void>();

/** Wires online-event replay + change notifications. Call once from the app. */
export function initOfflineQueue(backend: Backend, onChange?: (n: number) => void): void {
  if (onChange) listeners.add(onChange);
  const notify = () => listeners.forEach((cb) => cb(pendingCount()));
  notify();
  if (listening) return;
  listening = true;
  window.addEventListener("online", () => {
    void replayQueue(backend).then((applied) => {
      if (applied > 0) notify();
    });
  });
  // Also try shortly after startup.
  window.setTimeout(() => {
    void replayQueue(backend).then((applied) => {
      if (applied > 0) notify();
    });
  }, 4000);
}
