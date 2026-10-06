import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { enqueueOp, isNetworkError } from "@/lib/offlineQueue";
import {
  BackendError,
  levelForXp,
  type Achievement,
  type AdminOverview,
  type Backend,
  type DailyChallenge,
  type FocusSession,
  type Friend,
  type GameKey,
  type GameScore,
  type Habit,
  type HabitLog,
  type Mood,
  type Profile,
  type Quote,
} from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
if (url && anonKey) {
  client = createClient(url, anonKey, {
    auth: {
      // Sessions survive browser restarts and refresh themselves.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

function need(): SupabaseClient {
  if (!client) throw new BackendError("network", "Supabase is not configured");
  return client;
}

type ProfileRow = Omit<Profile, "goals"> & { goals: string[] | null };

function mapProfile(row: ProfileRow): Profile {
  return { ...row, goals: row.goals ?? [] };
}


async function _setHabitLogOnline(habitId: string, userId: string, date: string, done: boolean) {
    const db = need();
    if (done) {
      const { error } = await db
        .from("habit_logs")
        .upsert(
          { habit_id: habitId, user_id: userId, date, done: true },
          { onConflict: "habit_id,date" },
        );
      if (error) throw new BackendError("network", error.message);
    } else {
      const { error } = await db
        .from("habit_logs")
        .delete()
        .eq("habit_id", habitId)
        .eq("date", date);
      if (error) throw new BackendError("network", error.message);
    }
}


async function _setMoodOnline(userId: string, date: string, mood: number, note?: string) {
    const payload: Record<string, unknown> = { user_id: userId, date, mood };
    if (note !== undefined) payload.note = note;
    const { error } = await need()
      .from("moods")
      .upsert(payload, { onConflict: "user_id,date" });
    if (error) throw new BackendError("network", error.message);
}


async function _createPlanOnline(p: Parameters<Backend["createPlan"]>[0]) {
    const { data, error } = await need()
      .from("plans")
      .insert({ ...p, repeat: p.repeat ?? "none", subtasks: p.subtasks ?? [] })
      .select()
      .single();
    if (error) throw new BackendError("network", error.message);
    return data as import("./types").Plan;
}


async function _updatePlanOnline(id: string, patch: Record<string, unknown>) {
    const { data, error } = await need()
      .from("plans")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new BackendError("network", error.message);
    return data as import("./types").Plan;
}

export const supabaseBackend: Backend = {
  mode: "supabase",

  async getSession() {
    const db = need();
    const { data, error } = await db.auth.getSession();
    if (error) {
      // Offline: fall back to the last cached session.
      const cached = localStorage.getItem("aq.session-cache");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return { id: parsed.user.id, email: parsed.user.email };
        } catch {
          /* fall through */
        }
      }
      throw new BackendError("network", error.message);
    }
    const user = data.session?.user;
    if (!user) {
      // No live session, but a cached one still allows offline work.
      const cached = localStorage.getItem("aq.session-cache");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return { id: parsed.user.id, email: parsed.user.email };
        } catch {
          /* no cache */
        }
      }
      return null;
    }
    localStorage.setItem(
      "aq.session-cache",
      JSON.stringify({ user: { id: user.id, email: user.email ?? "" }, at: new Date().toISOString() }),
    );
    await db
      .from("profiles")
      .update({ last_active: new Date().toISOString().slice(0, 10) })
      .eq("id", user.id);
    return { id: user.id, email: user.email ?? "" };
  },

  /** The key doubles as the email and the password (issued by the TG/MAX bots). */
  async signInWithKey(key) {
    const k = key.trim();
    if (!k) throw new BackendError("wrong_creds");
    const { data, error } = await need().auth.signInWithPassword({
      email: k.toLowerCase(),
      password: k,
    });
    if (error) {
      // Unknown key — provision the account on first use (bot-issued keys).
      const signup = await need().auth.signUp({
        email: k.toLowerCase(),
        password: k,
        options: { data: { name: k.toLowerCase().endsWith("@aq.bot") ? "Друг из MAX" : k } },
      });
      if (signup.error) throw new BackendError("wrong_creds", signup.error.message);
      if (!signup.data.user) throw new BackendError("network", "No user returned");
      const role = k.toLowerCase() === "ivan@dev.ru" ? "admin" : k.toLowerCase() === "miamor@for.you" ? "premium" : "user";
      // The SQL trigger already created the profile; align the role if needed.
      await need().from("profiles").update({ role }).eq("id", signup.data.user.id);
      return supabaseBackend.getProfile(signup.data.user.id);
    }
    const profile = await supabaseBackend.getProfile(data.user.id);
    if (profile.blocked) {
      await need().auth.signOut();
      throw new BackendError("blocked");
    }
    return profile;
  },

  /** Silent guest account so the app opens without any login screen. */
  async ensureGuest() {
    const db = need();
    const { data } = await db.auth.getSession();
    if (data.session?.user) return supabaseBackend.getProfile(data.session.user.id);
    const email = `guest-${crypto.randomUUID()}@guest.local`;
    const password = crypto.randomUUID();
    const { data: signup, error } = await db.auth.signUp({ email, password });
    if (error || !signup.user) throw new BackendError("network", error?.message ?? "No user");
    await db.from("profiles").update({ name: "Гость" }).eq("id", signup.user.id);
    return supabaseBackend.getProfile(signup.user.id);
  },

  async signUp({ email, password, name }) {
    const db = need();
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      if (error.message.toLowerCase().includes("already")) throw new BackendError("email_taken");
      throw new BackendError("network", error.message);
    }
    if (!data.user) throw new BackendError("network", "No user returned");
    return {
      id: data.user.id,
      email,
      name,
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
      last_active: null,
      created_at: new Date().toISOString(),
    };
  },

  async signIn({ email, password }) {
    const db = need();
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      throw new BackendError("wrong_creds", error.message);
    }
    const profile = await supabaseBackend.getProfile(data.user.id);
    if (profile.blocked) {
      await db.auth.signOut();
      throw new BackendError("blocked");
    }
    await db
      .from("profiles")
      .update({ last_active: new Date().toISOString().slice(0, 10) })
      .eq("id", profile.id);
    return profile;
  },

  async signOut() {
    await need().auth.signOut();
  },

  async requestPasswordReset(email) {
    const { error } = await need().auth.resetPasswordForEmail(email);
    if (error) throw new BackendError("network", error.message);
  },

  async resetPassword(_email, _newPassword) {
    throw new BackendError("network", "Use the email link flow");
  },

  async getProfile(id) {
    const { data, error } = await need()
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new BackendError("network", error.message);
    return mapProfile(data as ProfileRow);
  },

  async updateProfile(id, patch) {
    const { data, error } = await need()
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new BackendError("network", error.message);
    return mapProfile(data as ProfileRow);
  },

  async addXp(id, amount) {
    // Atomic server-side update (migration 0006): safe when the same account
    // acts from two devices at once.
    const { data, error } = await need().rpc("increment_xp", { p_amount: amount });
    if (!error && Array.isArray(data) && data[0]) {
      return mapProfile(data[0] as ProfileRow);
    }
    // Fallback for projects where 0006 hasn't been applied yet.
    const profile = await supabaseBackend.getProfile(id);
    const xp = Math.max(0, profile.xp + amount);
    return supabaseBackend.updateProfile(id, { xp, level: levelForXp(xp) });
  },

  async grantPremium(id) {
    return supabaseBackend.updateProfile(id, { role: "premium" });
  },

  async listHabits(userId) {
    const { data, error } = await need()
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");
    if (error) throw new BackendError("network", error.message);
    return (data ?? []).map((h) => ({
      ...(h as Omit<Habit, "schedule">),
      schedule: (h.schedule as number[]) ?? [],
    })) as Habit[];
  },

  async createHabit(h) {
    const { data, error } = await need().from("habits").insert(h).select().single();
    if (error) throw new BackendError("network", error.message);
    return data as Habit;
  },

  async updateHabit(id, patch) {
    const { data, error } = await need()
      .from("habits")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new BackendError("network", error.message);
    return data as Habit;
  },

  async deleteHabit(id) {
    const { error } = await need().from("habits").delete().eq("id", id);
    if (error) throw new BackendError("network", error.message);
  },

  async getHabitLogs(userId, fromIso, toIso) {
    const { data, error } = await need()
      .from("habit_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", fromIso)
      .lte("date", toIso);
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as HabitLog[];
  },

  async setHabitLog(habitId, userId, date, done) {
    try {
      return await _setHabitLogOnline(habitId, userId, date, done);
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueOp({ kind: "setHabitLog", habitId, date, done });
        return;
      }
      throw e;
    }
  },



  async getMood(userId, date) {
    const { data, error } = await need()
      .from("moods")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw new BackendError("network", error.message);
    return (data as Mood | null) ?? null;
  },

  async setMood(userId, date, mood, note) {
    try {
      return await _setMoodOnline(userId, date, mood, note);
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueOp({ kind: "setMood", date, mood, note });
        return;
      }
      throw e;
    }
  },



  async getMoods(userId, fromIso, toIso) {
    const { data, error } = await need()
      .from("moods")
      .select("*")
      .eq("user_id", userId)
      .gte("date", fromIso)
      .lte("date", toIso);
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as Mood[];
  },

  async listQuotes() {
    const { data, error } = await need().from("quotes").select("*").order("id");
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as Quote[];
  },

  async createQuote(q) {
    const { data, error } = await need().from("quotes").insert(q).select().single();
    if (error) throw new BackendError("network", error.message);
    return data as Quote;
  },

  async updateQuote(id, patch) {
    const { data, error } = await need()
      .from("quotes")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new BackendError("network", error.message);
    return data as Quote;
  },

  async deleteQuote(id) {
    const { error } = await need().from("quotes").delete().eq("id", id);
    if (error) throw new BackendError("network", error.message);
  },

  async listAchievements(userId) {
    const { data, error } = await need()
      .from("achievements")
      .select("*")
      .eq("user_id", userId);
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as Achievement[];
  },

  async unlockAchievement(userId, code) {
    const { data, error } = await need()
      .from("achievements")
      .upsert({ user_id: userId, code }, { onConflict: "user_id,code" })
      .select()
      .single();
    if (error) return null;
    return (data as Achievement) ?? null;
  },

  async addFocusSession(userId, habitId, minutes) {
    const { data, error } = await need()
      .from("focus_sessions")
      .insert({ user_id: userId, habit_id: habitId, minutes, completed_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new BackendError("network", error.message);
    return data as FocusSession;
  },

  async listFocusSessions(userId) {
    const { data, error } = await need()
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("completed_at");
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as FocusSession[];
  },

  async listGameScores(userId) {
    const { data, error } = await need()
      .from("game_scores")
      .select("*")
      .eq("user_id", userId)
      .order("played_at");
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as GameScore[];
  },

  async addGameScore(userId, game: GameKey, score) {
    try {
      const { data, error } = await need()
        .from("game_scores")
        .insert({ user_id: userId, game, score })
        .select()
        .single();
      if (error) throw new BackendError("network", error.message);
      return data as GameScore;
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueOp({ kind: "addGameScore", game, score });
        return {
          id: "pending-" + Date.now(),
          user_id: userId,
          game,
          score,
          played_at: new Date().toISOString(),
        } as GameScore;
      }
      throw e;
    }
  },

  async getDailyChallenge(userId, date) {
    const { data, error } = await need()
      .from("daily_challenges")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw new BackendError("network", error.message);
    return (data as DailyChallenge | null) ?? null;
  },

  async listDailyChallenges(userId) {
    const { data, error } = await need()
      .from("daily_challenges")
      .select("*")
      .eq("user_id", userId)
      .order("date");
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as DailyChallenge[];
  },

  async completeDailyChallenge(userId, date, code) {
    try {
      const { data, error } = await need()
        .from("daily_challenges")
        .upsert({ user_id: userId, date, code, done: true }, { onConflict: "user_id,date" })
        .select()
        .single();
      if (error) throw new BackendError("network", error.message);
      return data as DailyChallenge;
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueOp({ kind: "completeDailyChallenge", date, code });
        return {
          id: "pending-" + Date.now(),
          user_id: userId,
          date,
          code,
          done: true,
        } as DailyChallenge;
      }
      throw e;
    }
  },

  async listPlans(userId) {
    const { data, error } = await need()
      .from("plans")
      .select("*")
      .eq("user_id", userId)
      .order("due");
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as import("./types").Plan[];
  },

  async createPlan(p) {
    try {
      return await _createPlanOnline(p);
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueOp({
          kind: "createPlan",
          title: p.title,
          due: p.due,
          repeat: p.repeat,
          subtasks: p.subtasks,
        });
        return {
          id: "pending-" + Date.now(),
          user_id: p.user_id,
          title: p.title,
          due: p.due,
          done: false,
          repeat: p.repeat ?? "none",
          subtasks: p.subtasks ?? [],
          created_at: new Date().toISOString(),
        } as import("./types").Plan;
      }
      throw e;
    }
  },



  async updatePlan(id, patch) {
    try {
      return await _updatePlanOnline(id, patch);
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueOp({ kind: "updatePlan", id, patch: patch as Record<string, unknown> });
        const all = await this.listPlans("").catch(() => []);
        const existing = all.find((x) => x.id === id);
        return (
          existing ??
          ({
            id,
            user_id: "",
            title: "",
            due: "",
            done: false,
            repeat: "none",
            subtasks: [],
            created_at: "",
          } as import("./types").Plan)
        );
      }
      throw e;
    }
  },



  async deletePlan(id) {
    try {
      const { error } = await need().from("plans").delete().eq("id", id);
      if (error) throw new BackendError("network", error.message);
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueOp({ kind: "deletePlan", id });
        return;
      }
      throw e;
    }
  },

  async listFriends(userId) {
    const { data, error } = await need()
      .from("friends")
      .select("created_at, friend:profiles!friends_friend_id_fkey(*)")
      .eq("user_id", userId)
      .order("created_at");
    if (error) throw new BackendError("network", error.message);
    return ((data ?? []) as unknown as { created_at: string; friend: Profile }[]).map((row) => ({
      since: row.created_at,
      friend: mapProfile(row.friend as ProfileRow),
    }));
  },

  async addFriend(userId, friendCode) {
    const { data: found, error: findErr } = await need()
      .from("profiles")
      .select("id")
      .or(`id.eq.${friendCode},email.eq.${friendCode.toLowerCase()}`)
      .maybeSingle();
    if (findErr || !found) throw new BackendError("not_found");
    const { data, error } = await need()
      .from("friends")
      .upsert({ user_id: userId, friend_id: found.id }, { onConflict: "user_id,friend_id" })
      .select()
      .single();
    if (error) throw new BackendError("network", error.message);
    return data as Friend;
  },

  async removeFriend(userId, friendId) {
    const { error } = await need()
      .from("friends")
      .delete()
      .eq("user_id", userId)
      .eq("friend_id", friendId);
    if (error) throw new BackendError("network", error.message);
  },

  async listBroadcasts() {
    const { data, error } = await need()
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new BackendError("network", error.message);
    return (data ?? []) as import("./types").Broadcast[];
  },

  async createBroadcast(adminId, p) {
    const { data, error } = await need()
      .from("broadcasts")
      .insert({ admin_id: adminId, ...p })
      .select()
      .single();
    if (error) throw new BackendError("forbidden", error.message);
    return data as import("./types").Broadcast;
  },

  async deleteBroadcast(id) {
    const { error } = await need().from("broadcasts").delete().eq("id", id);
    if (error) throw new BackendError("forbidden", error.message);
  },

  async adminListUsers() {
    const { data, error } = await need().from("profiles").select("*").order("created_at");
    if (error) throw new BackendError("forbidden", error.message);
    return (data ?? []).map((p) => mapProfile(p as ProfileRow));
  },

  async adminUpdateUser(userId, patch) {
    const { data, error } = await need()
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw new BackendError("forbidden", error.message);
    return mapProfile(data as ProfileRow);
  },

  async adminOverview() {
    const db = need();
    const users = await supabaseBackend.adminListUsers();
    const { count, error } = await db
      .from("habits")
      .select("id", { count: "exact", head: true });
    if (error) throw new BackendError("forbidden", error.message);
    const today = new Date().toISOString().slice(0, 10);
    const signupsByDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      signupsByDay.push({
        date: iso,
        count: users.filter((u) => (u.created_at ?? "").slice(0, 10) === iso).length,
      });
    }
    const overview: AdminOverview = {
      signupsByDay,
      dauToday: users.filter((u) => u.last_active === today).length,
      totalHabits: count ?? 0,
    };
    return overview;
  },
};

export function hasSupabaseConfig(): boolean {
  return Boolean(url && anonKey);
}
