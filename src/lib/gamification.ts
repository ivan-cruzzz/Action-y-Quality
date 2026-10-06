import { backend, ACHIEVEMENT_CODES, levelForXp, type AchievementCode } from "@/lib/backend";
import { isoDate, weekdayIndex, parseIso, lastNDays } from "@/lib/date";
import type { Habit, HabitLog } from "@/lib/backend/types";

export interface StreakInfo {
  current: number;
  record: number;
}

/**
 * A day counts when every habit scheduled that day is done. Days with nothing
 * scheduled are neutral. Today never breaks the streak before it is over.
 */
export function computeStreaks(habits: Habit[], logs: HabitLog[]): StreakInfo {
  const byDate = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!l.done) continue;
    if (!byDate.has(l.date)) byDate.set(l.date, new Set());
    byDate.get(l.date)!.add(l.habit_id);
  }
  const qualifies = (date: string): boolean | "neutral" => {
    const d = parseIso(date);
    const scheduled = habits.filter((h) => h.schedule.includes(weekdayIndex(d)));
    if (scheduled.length === 0) return "neutral";
    const doneSet = byDate.get(date);
    return scheduled.every((h) => doneSet?.has(h.id));
  };

  const days = lastNDays(366);
  const today = isoDate();
  let record = 0;
  let run = 0;
  for (const date of days) {
    const q = qualifies(date);
    if (q === "neutral") continue;
    if (q) {
      run += 1;
      record = Math.max(record, run);
    } else if (date !== today) {
      run = 0;
    }
  }

  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const q = qualifies(days[i]);
    if (q === "neutral") continue;
    if (q) current += 1;
    else if (days[i] !== today) break;
  }

  return { current, record: Math.max(record, current) };
}

/** 7 consecutive days (ending today) with a mood check-in. */
export function hasCheckinWeek(moods: { date: string }[]): boolean {
  const set = new Set(moods.map((m) => m.date));
  const days = lastNDays(7);
  return days.every((d) => set.has(d));
}

export interface GameStats {
  catchBest: number;
  quizCorrect: number;
  breatheCount: number;
  challengesDone: number;
}

/** Computes and unlocks any pending achievements. Returns newly unlocked codes. */
export async function checkAndUnlockAchievements(
  userId: string,
  habits: Habit[],
  logs: HabitLog[],
  moods: { date: string }[],
  focusCount: number,
  gameStats?: Partial<GameStats>,
): Promise<AchievementCode[]> {
  const owned = new Set(
    (await backend.listAchievements(userId)).map((a) => a.code as AchievementCode),
  );
  const { current } = computeStreaks(habits, logs);
  const qualifies: Record<string, boolean> = {
    week_streak: current >= 7,
    month_streak: current >= 30,
    focus10: focusCount >= 10,
    checkin7: hasCheckinWeek(moods),
    arcade100: (gameStats?.catchBest ?? 0) >= 100,
    breathe5: (gameStats?.breatheCount ?? 0) >= 5,
    quiz15: (gameStats?.quizCorrect ?? 0) >= 15,
    challenge7: (gameStats?.challengesDone ?? 0) >= 7,
  };
  const fresh: AchievementCode[] = [];
  for (const code of ACHIEVEMENT_CODES) {
    if (qualifies[code] && !owned.has(code)) {
      const row = await backend.unlockAchievement(userId, code);
      if (row) fresh.push(code);
    }
  }
  return fresh;
}

/** XP missing to the next level boundary. */
export function xpToNextLevel(xp: number): number {
  return levelForXp(xp) * 100 - xp;
}
