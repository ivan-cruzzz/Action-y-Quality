import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  backend,
  XP_PER_CHALLENGE,
  XP_PER_HABIT,
  XP_PER_PLAN,
  type AchievementCode,
  type GameKey,
  type Plan,
  type Quote,
} from "@/lib/backend";
import { dayOfYear, lastNDays, lastNMonths, parseIso, weekdayIndex } from "@/lib/date";
import { computeStreaks, type StreakInfo } from "@/lib/gamification";
import type { Habit, HabitLog, Mood, Profile } from "@/lib/backend/types";
import type { LineChartDatum } from "@/components/ui/line-chart";
import { useAuth } from "@/store/auth";

export function useHabits(userId: string | undefined) {
  return useQuery({
    queryKey: ["habits", userId],
    enabled: !!userId,
    queryFn: () => backend.listHabits(userId!),
  });
}

export function useHabitLogs(userId: string | undefined, fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ["logs", userId, fromIso, toIso],
    enabled: !!userId,
    queryFn: () => backend.getHabitLogs(userId!, fromIso, toIso),
  });
}

export function useMoods(userId: string | undefined, fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ["moods", userId, fromIso, toIso],
    enabled: !!userId,
    queryFn: () => backend.getMoods(userId!, fromIso, toIso),
  });
}

export function useTodayMood(userId: string | undefined) {
  const today = toIso(new Date());
  return useQuery({
    queryKey: ["mood", userId, today],
    enabled: !!userId,
    queryFn: () => backend.getMood(userId!, today),
  });
}

export function useSetMood(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      mood,
      date,
      note,
    }: {
      mood: number;
      date?: string;
      note?: string;
    }) => {
      const d = date ?? toIso(new Date());
      await backend.setMood(userId!, d, mood, note);
      return d;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mood", userId] });
      void qc.invalidateQueries({ queryKey: ["moods", userId] });
    },
  });
}

/** Toggles a habit log and awards/removes XP. Resolves with the fresh profile. */
export function useToggleHabitLog(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habitId,
      date,
      done,
    }: {
      habitId: string;
      date: string;
      done: boolean;
    }) => {
      await backend.setHabitLog(habitId, userId!, date, done);
      return backend.addXp(userId!, done ? XP_PER_HABIT : -XP_PER_HABIT);
    },
    onSuccess: (profile: Profile) => {
      void qc.invalidateQueries({ queryKey: ["logs", userId] });
      useAuth.getState().setProfile(profile);
    },
  });
}

export function useQuotes() {
  return useQuery({ queryKey: ["quotes"], queryFn: () => backend.listQuotes() });
}

/** Deterministic quote of the day: day-of-year % quote count. */
export function quoteOfDay(quotes: Quote[]): Quote | null {
  if (!quotes.length) return null;
  const index = (dayOfYear() - 1) % quotes.length;
  return quotes[index] ?? null;
}

export function useAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ["achievements", userId],
    enabled: !!userId,
    queryFn: () => backend.listAchievements(userId!),
  });
}

export function useUnlockAchievement(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: AchievementCode) => backend.unlockAchievement(userId!, code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["achievements", userId] });
    },
  });
}

export function useFocusSessions(userId: string | undefined) {
  return useQuery({
    queryKey: ["focus", userId],
    enabled: !!userId,
    queryFn: () => backend.listFocusSessions(userId!),
  });
}

export function useGameScores(userId: string | undefined) {
  return useQuery({
    queryKey: ["games", userId],
    enabled: !!userId,
    queryFn: () => backend.listGameScores(userId!),
  });
}

export function useAddGameScore(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, score }: { game: GameKey; score: number }) =>
      backend.addGameScore(userId!, game, score),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["games", userId] });
    },
  });
}

export function useDailyChallenge(userId: string | undefined) {
  const today = toIso(new Date());
  return useQuery({
    queryKey: ["challenge", userId, today],
    enabled: !!userId,
    queryFn: () => backend.getDailyChallenge(userId!, today),
  });
}

export function useDailyChallengeHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["challenges", userId],
    enabled: !!userId,
    queryFn: () => backend.listDailyChallenges(userId!),
  });
}

export function useCompleteChallenge(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const today = toIso(new Date());
      await backend.completeDailyChallenge(userId!, today, code);
      return backend.addXp(userId!, XP_PER_CHALLENGE);
    },
    onSuccess: (profile) => {
      void qc.invalidateQueries({ queryKey: ["challenge", userId] });
      useAuth.getState().setProfile(profile);
    },
  });
}

/** Aggregated arcade stats used by the achievements check. */
export function useGameStats(userId: string | undefined) {
  const scores = useGameScores(userId);
  return useMemo(() => {
    const rows = scores.data ?? [];
    const catchBest = Math.max(
      0,
      ...rows.filter((r) => r.game === "catch").map((r) => r.score),
    );
    const quizCorrect = rows
      .filter((r) => r.game === "quiz")
      .reduce((s, r) => s + r.score, 0);
    const breatheCount = rows.filter((r) => r.game === "breathe").length;
    return { catchBest, quizCorrect, breatheCount };
  }, [scores.data]);
}

export function usePlans(userId: string | undefined) {
  return useQuery({
    queryKey: ["plans", userId],
    enabled: !!userId,
    queryFn: () => backend.listPlans(userId!),
  });
}

export function useCreatePlan(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      title,
      due,
      repeat: repeat,
      subtasks,
    }: {
      title: string;
      due: string;
      repeat?: Plan["repeat"];
      subtasks?: Plan["subtasks"];
    }) => backend.createPlan({ user_id: userId!, title, due, repeat, subtasks }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", userId] });
    },
  });
}

/** Toggles a plan and awards/removes XP. Resolves with the fresh profile. */
export function useTogglePlan(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ plan, done }: { plan: Plan; done: boolean }) => {
      await backend.updatePlan(plan.id, { done });
      return backend.addXp(userId!, done ? XP_PER_PLAN : -XP_PER_PLAN);
    },
    onSuccess: (profile: Profile) => {
      void qc.invalidateQueries({ queryKey: ["plans", userId] });
      useAuth.getState().setProfile(profile);
    },
  });
}

export function useDeletePlan(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.deletePlan(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", userId] });
    },
  });
}

export type StatsPeriod = "week" | "month" | "year";

export interface StatsBundle {
  data: LineChartDatum[];
  completion: number;
  loading: boolean;
}

function countDone(logs: HabitLog[], date: string): number {
  let n = 0;
  for (const l of logs) if (l.date === date && l.done) n += 1;
  return n;
}

function avgMood(moods: Mood[], date: string): number | undefined {
  const rows = moods.filter((m) => m.date === date);
  if (!rows.length) return undefined;
  return rows.reduce((s, m) => s + m.mood, 0) / rows.length;
}

export function useStats(userId: string | undefined, period: StatsPeriod): StatsBundle {
  const range = useMemo(() => {
    const today = new Date();
    if (period === "year") {
      const months = lastNMonths(12);
      const first = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      return { from: toIso(first), to: toIso(today), months };
    }
    const n = period === "week" ? 7 : 30;
    const days = lastNDays(n);
    return { from: days[0], to: days[days.length - 1], days };
  }, [period]);

  const logs = useHabitLogs(userId, range.from, range.to);
  const moods = useMoods(userId, range.from, range.to);

  const data = useMemo<LineChartDatum[]>(() => {
    if (!logs.data || !moods.data) return [];
    if (period === "year") {
      const months = range.months as { key: string; label: string }[];
      return months.map((m) => {
        const daysInMonth = monthDates(m.key);
        const done = daysInMonth.reduce((s, d) => s + countDone(logs.data!, d), 0);
        const moodRows = moods.data!.filter((x) => x.date.slice(0, 7) === m.key);
        const moodAvg = moodRows.length
          ? moodRows.reduce((s, x) => s + x.mood, 0) / moodRows.length
          : 0;
        return {
          key: m.key,
          label: m.label,
          axisLabel: m.label,
          values: { habits: done, mood: moodAvg },
        };
      });
    }
    const days = range.days as string[];
    const todayIso = toIso(new Date());
    return days.map((d) => {
      const dt = parseIso(d);
      const full = dt.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        weekday: "long",
      });
      let axis: string | undefined;
      if (period === "week") axis = dt.toLocaleDateString(undefined, { weekday: "short" });
      else if (dt.getDate() % 5 === 0 || d === todayIso)
        axis = dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return {
        key: d,
        label: full,
        axisLabel: axis,
        values: { habits: countDone(logs.data!, d), mood: avgMood(moods.data!, d) ?? 0 },
      };
    });
  }, [logs.data, moods.data, period, range]);

  const completion = useMemo(() => {
    if (!logs.data) return 0;
    const done = logs.data.filter((l) => l.done).length;
    const slots = logs.data.length;
    return slots === 0 ? 0 : Math.round((done / slots) * 100);
  }, [logs.data]);

  return {
    data,
    completion,
    loading: logs.isLoading || moods.isLoading,
  };
}

export function useStreaks(userId: string | undefined): {
  streaks: StreakInfo;
  habits: Habit[];
  logs: HabitLog[];
  loading: boolean;
} {
  const from = useMemo(() => toIso(new Date(new Date().getFullYear() - 1, 0, 1)), []);
  const to = toIso(new Date());
  const habits = useHabits(userId);
  const logs = useHabitLogs(userId, from, to);
  const streaks = useMemo<StreakInfo>(
    () => computeStreaks(habits.data ?? [], logs.data ?? []),
    [habits.data, logs.data],
  );
  return {
    streaks,
    habits: habits.data ?? [],
    logs: logs.data ?? [],
    loading: habits.isLoading || logs.isLoading,
  };
}

function monthDates(monthKey: string): string[] {
  const [y, m] = monthKey.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= total; d++) out.push(`${monthKey}-${String(d).padStart(2, "0")}`);
  return out;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayOf(iso: string): number {
  return weekdayIndex(parseIso(iso));
}


export function useFriends(userId: string | undefined) {
  return useQuery({
    queryKey: ["friends", userId],
    enabled: !!userId,
    queryFn: () => backend.listFriends(userId!),
  });
}

export function useAddFriend(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => backend.addFriend(userId!, code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["friends", userId] });
    },
  });
}

export function useRemoveFriend(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) => backend.removeFriend(userId!, friendId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["friends", userId] });
    },
  });
}

export function useUpdatePlan(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Plan> }) =>
      backend.updatePlan(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", userId] });
    },
  });
}
