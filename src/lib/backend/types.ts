/** Domain types shared by both backend implementations. */

export type Role = "user" | "premium" | "admin";
export type ThemeSetting = "system" | "light" | "dark";
export type QuoteCategory = "motivation" | "discipline" | "love" | "confidence";
export type Locale = "ru" | "en";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  theme: ThemeSetting;
  locale: Locale;
  xp: number;
  level: number;
  goals: string[];
  onboarded: boolean;
  /** Premium: custom accent color ("#RRGGBB") or null. */
  accent: string | null;
  /** Premium: custom blob hue (0-360) or null. */
  blob_hue: number | null;
  blocked: boolean;
  last_active: string | null;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  color: string;
  /** Weekday indices, 0 = Monday … 6 = Sunday. */
  schedule: number[];
  /** "HH:MM" local reminder time or null. */
  reminder_at: string | null;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  done: boolean;
}

export interface Mood {
  id: string;
  user_id: string;
  date: string;
  mood: number;
  /** Optional journal note (mood diary). */
  note?: string | null;
}

export interface Quote {
  id: string;
  text_ru: string;
  text_en: string;
  author: string;
  category: QuoteCategory;
}

export interface Achievement {
  id: string;
  user_id: string;
  code: AchievementCode;
  unlocked_at: string;
}

export interface FocusSession {
  id: string;
  user_id: string;
  habit_id: string | null;
  minutes: number;
  completed_at: string;
}

/** Arcade result. `game`: catch — points; quiz — correct answers; breathe — session minutes. */
export interface GameScore {
  id: string;
  user_id: string;
  game: GameKey;
  score: number;
  played_at: string;
}

export type GameKey = "catch" | "quiz" | "breathe" | "memory";

/** One deterministic micro-challenge per day, completed by the user. */
export interface DailyChallenge {
  id: string;
  user_id: string;
  date: string;
  code: string;
  done: boolean;
}

/** A personal plan (task) with a due date: day / week / month horizon. */
export interface Plan {
  id: string;
  user_id: string;
  title: string;
  /** ISO date "YYYY-MM-DD". */
  due: string;
  done: boolean;
  /** Recurrence: the next instance is created when this one is completed. */
  repeat: "none" | "daily" | "weekly" | "monthly";
  /** Simple checklist inside the plan. */
  subtasks: { title: string; done: boolean }[];
  created_at: string;
}

/** Friend link for the weekly XP leaderboard. */
export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}

/** Admin message shown on every user's Home screen. */
export interface Broadcast {
  id: string;
  admin_id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AdminOverview {
  signupsByDay: { date: string; count: number }[];
  dauToday: number;
  totalHabits: number;
}

export const XP_PER_HABIT = 10;
export const XP_PER_FOCUS = 25;
export const XP_PER_BREATHE = 10;
export const XP_PER_QUIZ_ANSWER = 5;
export const XP_PER_CHALLENGE = 15;
export const XP_PER_PLAN = 5;
export const FREE_HABIT_LIMIT = 3;
export const XP_PER_LEVEL = 100;
export const ACHIEVEMENT_CODES = [
  "week_streak",
  "month_streak",
  "focus10",
  "checkin7",
  "arcade100",
  "breathe5",
  "quiz15",
  "challenge7",
] as const;
export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number];

export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export class BackendError extends Error {
  code:
    | "email_taken"
    | "wrong_creds"
    | "blocked"
    | "not_found"
    | "limit_reached"
    | "forbidden"
    | "network";
  constructor(code: BackendError["code"], message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export interface Backend {
  mode: "demo" | "supabase";

  getSession(): Promise<AuthUser | null>;
  /**
   * Bot-driven auth: the key is both the email and the password of the
   * account. Roles by email apply (ivan@dev.ru → admin, miAMor@for.you →
   * premium); the account is provisioned if missing (demo mode).
   */
  signInWithKey(key: string): Promise<Profile>;
  /** Provisions a silent guest account so the app opens without any login. */
  ensureGuest(): Promise<Profile>;
  signUp(p: { email: string; password: string; name: string }): Promise<Profile>;
  signIn(p: { email: string; password: string }): Promise<Profile>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(email: string, newPassword: string): Promise<void>;

  getProfile(id: string): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile>;
  addXp(id: string, amount: number): Promise<Profile>;
  /** Mock checkout — flips the role to premium without payment. */
  grantPremium(id: string): Promise<Profile>;

  listHabits(userId: string): Promise<Habit[]>;
  createHabit(h: Omit<Habit, "id" | "created_at">): Promise<Habit>;
  updateHabit(id: string, patch: Partial<Habit>): Promise<Habit>;
  deleteHabit(id: string): Promise<void>;

  getHabitLogs(userId: string, fromIso: string, toIso: string): Promise<HabitLog[]>;
  setHabitLog(habitId: string, userId: string, date: string, done: boolean): Promise<void>;

  getMood(userId: string, date: string): Promise<Mood | null>;
  setMood(userId: string, date: string, mood: number, note?: string): Promise<void>;
  getMoods(userId: string, fromIso: string, toIso: string): Promise<Mood[]>;

  listQuotes(): Promise<Quote[]>;
  createQuote(q: Omit<Quote, "id">): Promise<Quote>;
  updateQuote(id: string, patch: Partial<Quote>): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;

  listAchievements(userId: string): Promise<Achievement[]>;
  unlockAchievement(userId: string, code: AchievementCode): Promise<Achievement | null>;

  addFocusSession(userId: string, habitId: string | null, minutes: number): Promise<FocusSession>;
  listFocusSessions(userId: string): Promise<FocusSession[]>;

  listGameScores(userId: string): Promise<GameScore[]>;
  addGameScore(userId: string, game: GameKey, score: number): Promise<GameScore>;
  getDailyChallenge(userId: string, date: string): Promise<DailyChallenge | null>;
  listDailyChallenges(userId: string): Promise<DailyChallenge[]>;
  completeDailyChallenge(userId: string, date: string, code: string): Promise<DailyChallenge>;

  listPlans(userId: string): Promise<Plan[]>;
  createPlan(
    p: Pick<Plan, "user_id" | "title" | "due"> & Partial<Pick<Plan, "repeat" | "subtasks">>,
  ): Promise<Plan>;
  updatePlan(id: string, patch: Partial<Pick<Plan, "title" | "due" | "done" | "subtasks">>): Promise<Plan>;
  deletePlan(id: string): Promise<void>;

  listFriends(userId: string): Promise<{ friend: Profile; since: string }[]>;
  addFriend(userId: string, friendCode: string): Promise<Friend>;
  removeFriend(userId: string, friendId: string): Promise<void>;

  listBroadcasts(): Promise<Broadcast[]>;
  createBroadcast(adminId: string, p: { title: string; body: string }): Promise<Broadcast>;
  deleteBroadcast(id: string): Promise<void>;

  adminListUsers(): Promise<Profile[]>;
  adminUpdateUser(userId: string, patch: { blocked?: boolean; role?: Role }): Promise<Profile>;
  adminOverview(): Promise<AdminOverview>;
}
