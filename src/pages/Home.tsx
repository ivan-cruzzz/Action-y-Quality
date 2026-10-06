import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Cloud, Flame, Plus, Timer, Zap, Lock, Megaphone, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Confetti } from "@/components/ui/confetti";
import { HabitCard } from "@/components/HabitCard";
import { HabitForm } from "@/components/HabitForm";
import { QuoteCard } from "@/components/QuoteCard";
import { useAuth } from "@/store/auth";
import { useFocus } from "@/store/focus";
import { useToasts } from "@/store/toast";
import { backend, FREE_HABIT_LIMIT, type AchievementCode, type HabitLog } from "@/lib/backend";
import { addDays, isoDate, weekdayIndex, parseIso } from "@/lib/date";
import { levelTitle } from "@/lib/levelTitle";
import {
  useCompleteChallenge,
  useDailyChallengeHistory,
  useFocusSessions,
  useHabitLogs,
  useHabits,
  useMoods,
  useQuotes,
  useSetMood,
  useStreaks,
  useTodayMood,
  useToggleHabitLog,
  quoteOfDay,
} from "@/hooks/useData";
import { checkAndUnlockAchievements } from "@/lib/gamification";
import { hapticSuccess } from "@/lib/haptics";

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 6) return "home.night";
  if (h < 12) return "home.morning";
  if (h < 18) return "home.day";
  return "home.evening";
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.user?.id);
  const focus = useFocus();

  const today = isoDate();
  const wd = weekdayIndex();

  const { streaks, habits: allHabits, logs: allLogs } = useStreaks(userId);
  const habits = useHabits(userId);
  const quotes = useQuotes();
  const moodsWeek = useMoods(userId, isoDate(addDays(new Date(), -6)), today);
  const focusSessions = useFocusSessions(userId);
  const toggleLog = useToggleHabitLog(userId);
  const setMood = useSetMood(userId);
  const challengeHistory = useDailyChallengeHistory(userId);

  // Weekly marathon: 10 habit completions Mon–Sun, reward once (stored as a challenge row on Monday).
  const marathonMonday = useMemo(() => {
    const now = new Date();
    return isoDate(addDays(now, -((now.getDay() + 6) % 7)));
  }, []);
  const weekBound = useMemo(() => {
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    return { from: isoDate(monday), to: isoDate(addDays(monday, 6)) };
  }, []);
  const weekLogs = useHabitLogs(userId, weekBound.from, weekBound.to);
  const marathonDoneRow = (challengeHistory.data ?? []).find(
    (c) => c.date === marathonMonday && c.code === "marathon",
  );
  const weekDoneCount = (weekLogs.data ?? []).filter((l: HabitLog) => l.done).length;
  const marathonProgress = Math.min(10, weekDoneCount);
  const marathonComplete = marathonProgress >= 10;
  const marathonClaimed = !!marathonDoneRow?.done;
  const [marathonConfetti, setMarathonConfetti] = useState(0);
  const completeChallenge = useCompleteChallenge(userId);

  // Streak ×1.5 multiplier (streak ≥ 7): bonus XP on top of the base award.
  const multiplierActive = streaks.current >= 7;
  const toggle = async (habitId: string, done: boolean) => {
    if (!userId) return;
    await toggleLog.mutateAsync({ habitId, date: today, done });
    if (done && multiplierActive) {
      const p = await backend.addXp(userId, 5);
      useAuth.getState().setProfile(p);
      push(t("multiplier_on", { bonus: 5 }), "success");
    }
  };

  // Evening reflection: after 18:00, with today's mood but no note yet.
  const isEvening = new Date().getHours() >= 18;
  const [reflection, setReflection] = useState("");
  const eveningMood = useTodayMood(userId);
  const showReflection =
    isEvening && !!eveningMood.data && !(eveningMood.data.note ?? "").trim();

  const [formOpen, setFormOpen] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const allDoneFiredRef = useRef(false);
  const levelRef = useRef(profile?.level ?? 1);
  const lastFocusCountRef = useRef<number | null>(null);
  const achievementsBusyRef = useRef(false);

  const todaysHabits = useMemo(
    () => allHabits.filter((h) => h.schedule.includes(wd)),
    [allHabits, wd],
  );
  const doneSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of allLogs) if (l.date === today && l.done) s.add(l.habit_id);
    return s;
  }, [allLogs, today]);
  const doneCount = todaysHabits.filter((h) => doneSet.has(h.id)).length;

  const quote = useMemo(() => quoteOfDay(quotes.data ?? []), [quotes.data]);

  const isPremium = profile?.role === "premium" || profile?.role === "admin";
  const atLimit = !isPremium && (habits.data?.length ?? 0) >= FREE_HABIT_LIMIT;

  // Admin broadcast on the Home screen (dismissed locally)
  const broadcasts = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => backend.listBroadcasts(),
    refetchInterval: 60_000, // team messages arrive live
  });
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("aq.dismissedBroadcasts") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const broadcast = (broadcasts.data ?? []).find((b) => !dismissedIds.includes(b.id));
  const dismissBroadcast = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try {
      localStorage.setItem("aq.dismissedBroadcasts", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // Level-up celebration
  useEffect(() => {
    if (!profile) return;
    if (profile.level > levelRef.current) {
      levelRef.current = profile.level;
      setConfetti((c) => c + 1);
      push(t("confetti.levelUp", { level: profile.level }), "success");
    } else {
      levelRef.current = profile.level;
    }
  }, [profile, push, t]);

  // Achievement checks whenever fresh data lands
  useEffect(() => {
    if (!userId || achievementsBusyRef.current) return;
    achievementsBusyRef.current = true;
    checkAndUnlockAchievements(
      userId,
      allHabits,
      allLogs,
      moodsWeek.data ?? [],
      focusSessions.data?.length ?? 0,
    )
      .then((fresh) => {
        if (fresh.length) {
          setConfetti((c) => c + 1);
          for (const code of fresh as AchievementCode[]) push(t(`achievements.${code}`), "success");
        }
      })
      .catch(() => undefined)
      .finally(() => {
        achievementsBusyRef.current = false;
      });
  }, [userId, allHabits, allLogs, moodsWeek.data, focusSessions.data, push, t]);

  // All-of-today-done confetti
  useEffect(() => {
    if (todaysHabits.length > 0 && doneCount === todaysHabits.length) {
      if (!allDoneFiredRef.current) {
        allDoneFiredRef.current = true;
        setConfetti((c) => c + 1);
        void hapticSuccess();
        push(t("home.goalDone"), "success");
      }
    } else {
      allDoneFiredRef.current = false;
    }
  }, [doneCount, todaysHabits.length, push, t]);

  // Focus session completion toast (the store keeps running across routes)
  useEffect(() => {
    const count = focusSessions.data?.length ?? 0;
    if (lastFocusCountRef.current !== null && count > lastFocusCountRef.current) {
      push(t("focus.sessionDone"), "success");
    }
    lastFocusCountRef.current = count;
  }, [focusSessions.data, push, t]);

  const openCreate = () => {
    if (atLimit) {
      push(t("habits.limitReached"), "info");
      navigate("/paywall");
      return;
    }
    setFormOpen(true);
  };

  const focusRunning = focus.phase !== "idle" && focus.endsAt !== null;

  return (
    <div className="space-y-5">
      <Confetti fire={confetti + marathonConfetti} />

      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent md:hidden">
            {t("home.brand")}
          </p>
          <h1 className="text-[28px] font-semibold leading-tight">
            {t(greetingKey())}
            {profile?.name ? `, ${profile.name}` : ""}
          </h1>
          <p className="mt-1 text-[var(--aq-secondary)]">
            {t("home.level")} {profile?.level ?? 1} · {levelTitle(profile?.level ?? 1)} ·{" "}
            {t("home.xp")} {profile?.xp ?? 0}
          </p>
        </div>
        <Link
          to="/mood"
          aria-label={t("home.checkIn")}
          className="glass flex h-12 w-12 items-center justify-center text-accent"
        >
          <Cloud size={22} />
        </Link>
      </header>

      {/* Admin broadcast */}
      {broadcast && (
        <Card className="relative flex items-start gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Megaphone size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--aq-secondary)]">
              {t("home.broadcastTitle")}
            </p>
            <p className="mt-0.5 font-semibold">{broadcast.title}</p>
            <p className="text-sm text-[var(--aq-secondary)]">{broadcast.body}</p>
          </div>
          <button
            onClick={() => dismissBroadcast(broadcast.id)}
            aria-label={t("common.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <Flame className="mx-auto text-[#F97316]" size={20} aria-hidden />
          <AnimatedNumber value={streaks.current} className="mt-1 block text-2xl font-semibold" />
          <span className="text-xs text-[var(--aq-secondary)]">{t("home.streak")}</span>
        </Card>
        <Card className="p-4 text-center">
          <Zap className="mx-auto text-accent" size={20} aria-hidden />
          <AnimatedNumber value={profile?.xp ?? 0} className="mt-1 block text-2xl font-semibold" />
          <span className="text-xs text-[var(--aq-secondary)]">{t("home.xp")}</span>
        </Card>
        <Card className="p-4 text-center">
          <Timer className="mx-auto text-[#30A46C]" size={20} aria-hidden />
          <span className="mt-1 block text-2xl font-semibold">
            {doneCount}/{todaysHabits.length}
          </span>
          <span className="text-xs text-[var(--aq-secondary)]">{t("home.todayHabits")}</span>
        </Card>
      </div>

      {/* Weekly marathon */}
      <Card className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">🏁 {t("extra.marathon")}</p>
          <p className="text-sm text-[var(--aq-secondary)]">{t("extra.marathon_goal")}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${(marathonProgress / 10) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs tabular-nums text-[var(--aq-secondary)]">
            {marathonProgress}/10
          </p>
        </div>
        {marathonComplete && !marathonClaimed && (
          <Button
            size="sm"
            onClick={() => {
              void completeChallenge.mutateAsync("marathon").then(() => {
                setMarathonConfetti((c) => c + 1);
                push(t("extra.marathon_done"), "success");
              });
            }}
          >
            {t("extra.marathon_claim")}
          </Button>
        )}
        {marathonClaimed && <span className="text-xl">🏆</span>}
      </Card>

      {/* Evening reflection */}
      {showReflection && (
        <Card className="space-y-3">
          <p className="font-semibold">🌙 {t("extra.evening")}</p>
          <p className="text-sm text-[var(--aq-secondary)]">{t("extra.evening_q")}</p>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={2}
            aria-label={t("extra.evening_q")}
            className="w-full resize-none rounded-field bg-white/80 p-3 text-[15px] shadow-field outline-none dark:bg-white/10"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!reflection.trim()}
              onClick={() => {
                setMood.mutate({ mood: eveningMood.data?.mood ?? 3, note: reflection.trim() });
                push(t("extra.evening_saved"), "success");
              }}
            >
              {t("common.save")}
            </Button>
          </div>
        </Card>
      )}

      {/* Quote of the day */}
      {quote && (
        <section aria-label={t("home.quoteOfDay")}>
          <h2 className="mb-2 px-1 text-sm font-medium text-[var(--aq-secondary)]">
            {t("home.quoteOfDay")}
          </h2>
          <QuoteCard quote={quote} compact />
        </section>
      )}

      {/* Today's habits */}
      <section aria-label={t("home.todayHabits")}>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-[var(--aq-secondary)]">
            {t("home.todayHabits")} ·{" "}
            {t("home.progress", { done: doneCount, total: todaysHabits.length })}
          </h2>
          <Button size="sm" variant="glass" onClick={openCreate} className="gap-1.5">
            {atLimit ? <Lock size={15} /> : <Plus size={16} />}
            {t("common.add")}
          </Button>
        </div>
        <div className="space-y-3">
          {!allHabits.length && (
            <Card className="text-center text-sm text-[var(--aq-secondary)]">
              {t("home.noHabits")}
            </Card>
          )}
          {todaysHabits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              done={doneSet.has(h.id)}
              onToggle={() => toggle(h.id, !doneSet.has(h.id))}
            />
          ))}
          {todaysHabits.length > 0 && doneCount === todaysHabits.length && (
            <p className="text-center text-sm font-medium text-[#30A46C]">{t("home.allDone")}</p>
          )}
        </div>
      </section>

      {/* Focus + Arcade */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{t("home.focus")}</p>
            <p className="text-sm text-[var(--aq-secondary)]">
              {focusRunning ? t("focus.running") : `Pomodoro ${focus.workMin}/${focus.breakMin}`}
            </p>
          </div>
          <Button onClick={() => navigate("/focus")}>{t("common.continue")}</Button>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{t("games.title")}</p>
            <p className="text-sm text-[var(--aq-secondary)]">{t("games.subtitle")}</p>
          </div>
          <Button variant="glass" onClick={() => navigate("/games")}>
            {t("games.play")}
          </Button>
        </Card>
      </div>

      <HabitForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        userId={userId ?? ""}
        habit={null}
      />
    </div>
  );
}
