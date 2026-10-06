import { SEED_QUOTES } from "@/data/quotes";
import { isoDate, addDays } from "@/lib/date";
import {
  BackendError,
  levelForXp,
  type Achievement,
  type AchievementCode,
  type AdminOverview,
  type Backend,
  type DailyChallenge,
  type FocusSession,
  type Friend,
  type GameKey,
  type GameScore,
  type Habit,
  type Profile,
  type Quote,
  type Role,
} from "./types";

const KEY = "aq.demo.v1";

interface DemoUser {
  profile: Profile;
  /** Demo only — a real deployment stores passwords in Supabase Auth. */
  password: string;
  lastActive: string;
}

interface DemoDB {
  users: Record<string, DemoUser>;
  sessionUserId: string | null;
  habits: Habit[];
  habitLogs: import("./types").HabitLog[];
  moods: import("./types").Mood[];
  quotes: Quote[];
  achievements: Achievement[];
  focus: FocusSession[];
  gameScores: GameScore[];
  challenges: DailyChallenge[];
  plans: import("./types").Plan[];
  broadcasts: import("./types").Broadcast[];
  friends: import("./types").Friend[];
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/** Roles by email are a product requirement, identical in both backends. */
export function roleForEmail(email: string): Role {
  const e = email.trim().toLowerCase();
  if (e === "ivan@dev.ru") return "admin";
  if (e === "miamor@for.you") return "premium";
  return "user";
}

function freshQuotes(): Quote[] {
  return SEED_QUOTES.map(([text_ru, text_en, author, category], i) => ({
    id: `q${i + 1}`,
    text_ru,
    text_en,
    author,
    category,
  }));
}

function emptyDb(): DemoDB {
  return {
    users: {},
    sessionUserId: null,
    habits: [],
    habitLogs: [],
    moods: [],
    quotes: freshQuotes(),
    achievements: [],
    focus: [],
    gameScores: [],
    challenges: [],
    plans: [],
    broadcasts: [],
    friends: [],
  };
}

function load(): DemoDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDB;
      if (!parsed.quotes || parsed.quotes.length === 0) parsed.quotes = freshQuotes();
      // Migrate stores created before the arcade update.
      if (!parsed.gameScores) parsed.gameScores = [];
      if (!parsed.challenges) parsed.challenges = [];
      if (!parsed.plans) parsed.plans = [];
      if (!parsed.broadcasts) parsed.broadcasts = [];
      if (!parsed.friends) parsed.friends = [];
      return parsed;
    }
  } catch {
    /* corrupted storage — start clean */
  }
  return emptyDb();
}

function save(next: DemoDB) {
  db = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — demo keeps working in memory */
  }
}

let db: DemoDB = load();

const delay = () => new Promise<void>((r) => setTimeout(r, 40));

function requireUser(id: string): DemoUser {
  const u = db.users[id];
  if (!u) throw new BackendError("not_found");
  return u;
}

function toProfile(u: DemoUser): Profile {
  return { ...u.profile };
}

export const localBackend: Backend = {
  mode: "demo",

  async getSession() {
    await delay();
    if (!db.sessionUserId) return null;
    const u = db.users[db.sessionUserId];
    if (!u) return null;
    u.lastActive = isoDate();
    u.profile.last_active = u.lastActive;
    save(db);
    return { id: u.profile.id, email: u.profile.email };
  },

  /** Creates the account if missing; the key doubles as email and password. */
  async signInWithKey(key) {
    await delay();
    const k = key.trim();
    if (!k) throw new BackendError("wrong_creds");
    const email = k.toLowerCase();
    const existing = Object.values(db.users).find(
      (u) => u.profile.email.toLowerCase() === email,
    );
    if (existing) {
      if (existing.profile.blocked) throw new BackendError("blocked");
      const next = { ...db };
      next.users = {
        ...db.users,
        [existing.profile.id]: {
          ...existing,
          lastActive: isoDate(),
          profile: { ...existing.profile, last_active: isoDate() },
        },
      };
      next.sessionUserId = existing.profile.id;
      save(next);
      return toProfile(next.users[existing.profile.id]);
    }
    const profile: Profile = {
      id: uid(),
      email,
      name:
        email === "ivan@dev.ru"
          ? "Иван"
          : email === "miamor@for.you"
            ? "Amelia"
            : email.endsWith("@aq.bot")
              ? "Друг из MAX"
              : k,
      role: roleForEmail(email),
      theme: "system",
      locale: "ru",
      xp: 0,
      level: 1,
      goals: [],
      onboarded: false,
      accent: null,
      blob_hue: null,
      blocked: false,
      last_active: isoDate(),
      created_at: new Date().toISOString(),
    };
    const next = { ...db };
    next.users = { ...db.users, [profile.id]: { profile, password: k, lastActive: isoDate() } };
    next.sessionUserId = profile.id;
    save(next);
    return profile;
  },

  /** Silent guest account so the app opens without any login screen. */
  async ensureGuest() {
    await delay();
    const guest = Object.values(db.users).find(
      (u) => u.profile.email === "guest@local",
    );
    if (guest) {
      if (db.sessionUserId === null) {
        save({ ...db, sessionUserId: guest.profile.id });
      }
      return toProfile(guest);
    }
    const profile: Profile = {
      id: uid(),
      email: "guest@local",
      name: "Гость",
      role: "user",
      theme: "system",
      locale: "ru",
      xp: 0,
      level: 1,
      goals: [],
      onboarded: false,
      accent: null,
      blob_hue: null,
      blocked: false,
      last_active: isoDate(),
      created_at: new Date().toISOString(),
    };
    const next = { ...db };
    next.users = { ...db.users, [profile.id]: { profile, password: uid(), lastActive: isoDate() } };
    next.sessionUserId = profile.id;
    save(next);
    return profile;
  },

  async signUp({ email, password, name }) {
    await delay();
    const exists = Object.values(db.users).some(
      (u) => u.profile.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (exists) throw new BackendError("email_taken");
    const id = uid();
    const profile: Profile = {
      id,
      email: email.trim(),
      name: name.trim(),
      role: roleForEmail(email),
      theme: "system",
      locale: "ru",
      xp: 0,
      level: 1,
      goals: [],
      onboarded: false,
      accent: null,
      blob_hue: null,
      blocked: false,
      last_active: isoDate(),
      created_at: new Date().toISOString(),
    };
    const next = { ...db };
    next.users = { ...db.users, [id]: { profile, password, lastActive: isoDate() } };
    next.sessionUserId = id;
    save(next);
    return profile;
  },

  async signIn({ email, password }) {
    await delay();
    const u = Object.values(db.users).find(
      (x) => x.profile.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!u || u.password !== password) throw new BackendError("wrong_creds");
    if (u.profile.blocked) throw new BackendError("blocked");
    const id = u.profile.id;
    const next = { ...db };
    next.users = {
      ...db.users,
      [id]: { ...u, lastActive: isoDate(), profile: { ...u.profile, last_active: isoDate() } },
    };
    next.sessionUserId = id;
    save(next);
    return toProfile(next.users[id]);
  },

  async signOut() {
    save({ ...db, sessionUserId: null });
  },

  async requestPasswordReset() {
    await delay();
    // Demo mode has no email transport; the UI explains this.
  },

  async resetPassword(email, newPassword) {
    const u = Object.values(db.users).find(
      (x) => x.profile.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!u) throw new BackendError("not_found");
    const next = { ...db };
    next.users = { ...db.users, [u.profile.id]: { ...u, password: newPassword } };
    save(next);
  },

  async getProfile(id) {
    await delay();
    return toProfile(requireUser(id));
  },

  async updateProfile(id, patch) {
    const u = requireUser(id);
    const updated: Profile = { ...u.profile, ...patch, id: u.profile.id, email: u.profile.email };
    const next = { ...db };
    next.users = { ...db.users, [id]: { ...u, profile: updated } };
    save(next);
    return updated;
  },

  async addXp(id, amount) {
    const u = requireUser(id);
    const xp = Math.max(0, u.profile.xp + amount);
    const updated: Profile = { ...u.profile, xp, level: levelForXp(xp) };
    const next = { ...db };
    next.users = { ...db.users, [id]: { ...u, profile: updated } };
    save(next);
    return updated;
  },

  async grantPremium(id) {
    const u = requireUser(id);
    const updated: Profile = { ...u.profile, role: "premium" };
    const next = { ...db };
    next.users = { ...db.users, [id]: { ...u, profile: updated } };
    save(next);
    return updated;
  },

  async listHabits(userId) {
    await delay();
    return db.habits.filter((h) => h.user_id === userId).map((h) => ({ ...h }));
  },

  async createHabit(h) {
    const user = requireUser(h.user_id);
    if (user.profile.role === "user") {
      const owned = db.habits.filter((x) => x.user_id === h.user_id).length;
      if (owned >= 3) throw new BackendError("limit_reached");
    }
    const habit: Habit = { ...h, id: uid(), created_at: new Date().toISOString() };
    const next = { ...db, habits: [...db.habits, habit] };
    save(next);
    return { ...habit };
  },

  async updateHabit(id, patch) {
    const habit = db.habits.find((h) => h.id === id);
    if (!habit) throw new BackendError("not_found");
    const updated = { ...habit, ...patch, id: habit.id };
    const next = { ...db, habits: db.habits.map((h) => (h.id === id ? updated : h)) };
    save(next);
    return updated;
  },

  async deleteHabit(id) {
    const next = {
      ...db,
      habits: db.habits.filter((h) => h.id !== id),
      habitLogs: db.habitLogs.filter((l) => l.habit_id !== id),
    };
    save(next);
  },

  async getHabitLogs(userId, fromIso, toIso) {
    await delay();
    return db.habitLogs.filter(
      (l) => l.user_id === userId && l.date >= fromIso && l.date <= toIso,
    );
  },

  async setHabitLog(habitId, userId, date, done) {
    const existing = db.habitLogs.find((l) => l.habit_id === habitId && l.date === date);
    let logs = db.habitLogs;
    if (done) {
      if (existing) logs = logs.map((l) => (l === existing ? { ...l, done: true } : l));
      else logs = [...logs, { id: uid(), habit_id: habitId, user_id: userId, date, done: true }];
    } else if (existing) {
      logs = logs.filter((l) => l !== existing);
    }
    save({ ...db, habitLogs: logs });
  },

  async getMood(userId, date) {
    await delay();
    return db.moods.find((m) => m.user_id === userId && m.date === date) ?? null;
  },

  async setMood(userId, date, mood, note) {
    const existing = db.moods.find((m) => m.user_id === userId && m.date === date);
    let moods = db.moods;
    if (existing) moods = moods.map((m) => (m === existing ? { ...m, mood, note: note ?? m.note } : m));
    else moods = [...moods, { id: uid(), user_id: userId, date, mood, note: note ?? null }];
    save({ ...db, moods });
  },

  async getMoods(userId, fromIso, toIso) {
    await delay();
    return db.moods.filter(
      (m) => m.user_id === userId && m.date >= fromIso && m.date <= toIso,
    );
  },

  async listQuotes() {
    await delay();
    return db.quotes.map((q) => ({ ...q }));
  },

  async createQuote(q) {
    const quote: Quote = { ...q, id: uid() };
    save({ ...db, quotes: [...db.quotes, quote] });
    return { ...quote };
  },

  async updateQuote(id, patch) {
    const quote = db.quotes.find((q) => q.id === id);
    if (!quote) throw new BackendError("not_found");
    const updated = { ...quote, ...patch, id: quote.id };
    save({ ...db, quotes: db.quotes.map((q) => (q.id === id ? updated : q)) });
    return updated;
  },

  async deleteQuote(id) {
    save({ ...db, quotes: db.quotes.filter((q) => q.id !== id) });
  },

  async listAchievements(userId) {
    await delay();
    return db.achievements.filter((a) => a.user_id === userId).map((a) => ({ ...a }));
  },

  async unlockAchievement(userId, code: AchievementCode) {
    const existing = db.achievements.find((a) => a.user_id === userId && a.code === code);
    if (existing) return null;
    const row: Achievement = { id: uid(), user_id: userId, code, unlocked_at: new Date().toISOString() };
    save({ ...db, achievements: [...db.achievements, row] });
    return row;
  },

  async addFocusSession(userId, habitId, minutes) {
    const row: FocusSession = {
      id: uid(),
      user_id: userId,
      habit_id: habitId,
      minutes,
      completed_at: new Date().toISOString(),
    };
    save({ ...db, focus: [...db.focus, row] });
    return { ...row };
  },

  async listFocusSessions(userId) {
    await delay();
    return db.focus.filter((f) => f.user_id === userId).map((f) => ({ ...f }));
  },

  async listGameScores(userId) {
    await delay();
    return db.gameScores
      .filter((s) => s.user_id === userId)
      .map((s) => ({ ...s }));
  },

  async addGameScore(userId, game: GameKey, score) {
    const row: GameScore = {
      id: uid(),
      user_id: userId,
      game,
      score,
      played_at: new Date().toISOString(),
    };
    save({ ...db, gameScores: [...db.gameScores, row] });
    return { ...row };
  },

  async getDailyChallenge(userId, date) {
    await delay();
    return (
      db.challenges.find((c) => c.user_id === userId && c.date === date) ?? null
    );
  },

  async listDailyChallenges(userId) {
    await delay();
    return db.challenges.filter((c) => c.user_id === userId).map((c) => ({ ...c }));
  },

  async completeDailyChallenge(userId, date, code) {
    const existing = db.challenges.find((c) => c.user_id === userId && c.date === date);
    if (existing) {
      const updated = { ...existing, done: true };
      save({
        ...db,
        challenges: db.challenges.map((c) => (c === existing ? updated : c)),
      });
      return updated;
    }
    const row: DailyChallenge = {
      id: uid(),
      user_id: userId,
      date,
      code,
      done: true,
    };
    save({ ...db, challenges: [...db.challenges, row] });
    return { ...row };
  },

  async listPlans(userId) {
    await delay();
    return db.plans
      .filter((p) => p.user_id === userId)
      .map((p) => ({ ...p }));
  },

  async createPlan(p) {
    const row: import("./types").Plan = {
      user_id: p.user_id,
      title: p.title,
      due: p.due,
      repeat: p.repeat ?? "none",
      subtasks: p.subtasks ?? [],
      id: uid(),
      done: false,
      created_at: new Date().toISOString(),
    };
    save({ ...db, plans: [...db.plans, row] });
    return { ...row };
  },

  async updatePlan(id, patch) {
    const plan = db.plans.find((p) => p.id === id);
    if (!plan) throw new BackendError("not_found");
    const updated = { ...plan, ...patch, id: plan.id };
    save({ ...db, plans: db.plans.map((p) => (p.id === id ? updated : p)) });
    return updated;
  },

  async deletePlan(id) {
    save({ ...db, plans: db.plans.filter((p) => p.id !== id) });
  },

  async listFriends(userId) {
    await delay();
    return db.friends
      .filter((f) => f.user_id === userId)
      .map((f) => ({ since: f.created_at, friend: toProfile(requireUser(f.friend_id)) }));
  },

  async addFriend(userId, friendCode) {
    const target = Object.values(db.users).find(
      (u) => u.profile.id === friendCode || u.profile.email === friendCode.toLowerCase(),
    );
    if (!target) throw new BackendError("not_found");
    if (target.profile.id === userId) throw new BackendError("not_found");
    const row: Friend = {
      id: uid(),
      user_id: userId,
      friend_id: target.profile.id,
      created_at: new Date().toISOString(),
    };
    save({ ...db, friends: [...db.friends, row] });
    return { ...row };
  },

  async removeFriend(userId, friendId) {
    save({
      ...db,
      friends: db.friends.filter((f) => !(f.user_id === userId && f.friend_id === friendId)),
    });
  },

  async listBroadcasts() {
    await delay();
    return [...db.broadcasts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async createBroadcast(adminId, p) {
    const row: import("./types").Broadcast = {
      id: uid(),
      admin_id: adminId,
      ...p,
      created_at: new Date().toISOString(),
    };
    save({ ...db, broadcasts: [row, ...db.broadcasts] });
    return { ...row };
  },

  async deleteBroadcast(id) {
    save({ ...db, broadcasts: db.broadcasts.filter((b) => b.id !== id) });
  },

  async adminListUsers() {
    await delay();
    return Object.values(db.users).map((u) => toProfile(u));
  },

  async adminUpdateUser(userId, patch) {
    const u = requireUser(userId);
    const updated: Profile = { ...u.profile };
    if (patch.blocked !== undefined) updated.blocked = patch.blocked;
    if (patch.role !== undefined) updated.role = patch.role;
    const next = { ...db };
    next.users = { ...db.users, [userId]: { ...u, profile: updated } };
    save(next);
    return updated;
  },

  async adminOverview(): Promise<AdminOverview> {
    await delay();
    const signupsByDay: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const iso = isoDate(addDays(today, -i));
      signupsByDay.push({
        date: iso,
        count: Object.values(db.users).filter((u) => u.profile.created_at.slice(0, 10) === iso)
          .length,
      });
    }
    const todayIso = isoDate();
    return {
      signupsByDay,
      dauToday: Object.values(db.users).filter((u) => u.lastActive === todayIso).length,
      totalHabits: db.habits.length,
    };
  },
};
