import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { useAuth } from "@/store/auth";
import { useFocus } from "@/store/focus";
import { useToasts } from "@/store/toast";
import { backend, XP_PER_FOCUS, type AchievementCode } from "@/lib/backend";
import { useFocusSessions, useHabits } from "@/hooks/useData";
import { checkAndUnlockAchievements } from "@/lib/gamification";
import { hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export default function Focus() {
  const { t } = useTranslation();
  const push = useToasts((s) => s.push);
  const userId = useAuth((s) => s.user?.id);
  const profile = useAuth((s) => s.profile);
  const focus = useFocus();
  const habits = useHabits(userId);
  const focusSessions = useFocusSessions(userId);

  const [now, setNow] = useState(Date.now());
  const [confetti, setConfetti] = useState(0);
  const [workMin, setWorkMin] = useState(focus.workMin);
  const [breakMin, setBreakMin] = useState(focus.breakMin);
  const completingRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const totalMs = (focus.phase === "break" ? focus.breakMin : focus.workMin) * 60_000;
  const remainingMs = focus.endsAt !== null ? Math.max(0, focus.endsAt - now) : null;
  const progress =
    remainingMs === null
      ? focus.phase === "idle"
        ? 0
        : 1 - (focus.pausedRemaining ?? 0) / totalMs
      : 1 - remainingMs / totalMs;

  const shownMs = remainingMs ?? focus.pausedRemaining ?? totalMs;
  const minutes = Math.floor(shownMs / 60_000);
  const seconds = Math.floor((shownMs % 60_000) / 1000);

  useEffect(() => {
    if (focus.phase === "idle" || focus.endsAt === null) return;
    if (focus.endsAt > now || completingRef.current) return;
    completingRef.current = true;
    void (async () => {
      try {
        if (focus.phase === "work") {
          if (userId) {
            await backend.addFocusSession(userId, focus.habitId, focus.workMin);
            const p = await backend.addXp(userId, XP_PER_FOCUS);
            useAuth.getState().setProfile(p);
            const fresh = await checkAndUnlockAchievements(
              userId,
              habits.data ?? [],
              [],
              [],
              (focusSessions.data?.length ?? 0) + 1,
            ).catch(() => [] as AchievementCode[]);
            if (fresh.length) push(t(`achievements.${fresh[0]}`), "success");
          }
          setConfetti((c) => c + 1);
          void hapticSuccess();
          push(t("focus.sessionDone"), "success");
          focus.toBreak();
        } else {
          push(t("focus.brk"), "info");
          focus.reset();
        }
      } finally {
        completingRef.current = false;
      }
    })();
  }, [now, focus, userId, habits.data, focusSessions.data, push, t]);

  const R = 104;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="space-y-6">
      <Confetti fire={confetti} />
      <h1 className="text-[28px] font-semibold">{t("focus.title")}</h1>

      <Card className="flex flex-col items-center gap-6 p-8">
        <div className="relative h-[240px] w-[240px]">
          <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
            <circle
              cx={120}
              cy={120}
              r={R}
              fill="none"
              strokeWidth={12}
              className="stroke-black/10 dark:stroke-white/10"
            />
            <circle
              cx={120}
              cy={120}
              r={R}
              fill="none"
              strokeWidth={12}
              strokeLinecap="round"
              className={focus.phase === "break" ? "stroke-[#30A46C]" : "stroke-accent"}
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - Math.min(1, Math.max(0, progress)))}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--aq-secondary)]">
              {focus.phase === "break" ? t("focus.brk") : t("focus.work")}
            </span>
            <span className="mt-1 text-5xl font-semibold tabular-nums">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          {focus.phase === "idle" ? (
            <Button size="lg" onClick={() => focus.start(focus.habitId)} className="gap-2 px-10">
              <Play size={18} /> {t("focus.start")}
            </Button>
          ) : (
            <>
              {focus.endsAt === null ? (
                <Button size="lg" onClick={focus.resume} className="gap-2">
                  <Play size={18} /> {t("focus.resume")}
                </Button>
              ) : (
                <Button size="lg" onClick={focus.pause} className="gap-2">
                  <Pause size={18} /> {t("focus.pause")}
                </Button>
              )}
              <Button variant="glass" size="lg" onClick={focus.reset} aria-label={t("focus.reset")}>
                <RotateCcw size={18} />
              </Button>
            </>
          )}
        </div>
      </Card>

      {focus.phase === "idle" && (
        <Card className="space-y-4">
          <p className="text-sm font-medium text-[var(--aq-secondary)]">{t("focus.chooseHabit")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => focus.start(null)}
              className={cn(
                "min-h-[44px] rounded-full px-4 py-2 text-sm font-medium",
                focus.habitId === null ? "bg-accent text-white" : "bg-black/5 dark:bg-white/10",
              )}
            >
              {t("focus.noHabit")}
            </button>
            {(habits.data ?? []).map((h) => (
              <button
                key={h.id}
                onClick={() => focus.start(h.id)}
                className={cn(
                  "min-h-[44px] rounded-full px-4 py-2 text-sm font-medium",
                  focus.habitId === h.id ? "bg-accent text-white" : "bg-black/5 dark:bg-white/10",
                )}
              >
                {h.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <label className="space-y-1.5">
              <span className="text-sm text-[var(--aq-secondary)]">{t("focus.minutes")}</span>
              <input
                type="number"
                min={5}
                max={90}
                value={workMin}
                onChange={(e) => {
                  const v = Math.min(90, Math.max(5, Number(e.target.value) || 25));
                  setWorkMin(v);
                  focus.setDurations(v, breakMin);
                }}
                className="h-11 w-full rounded-field bg-white/80 px-3 dark:bg-white/10"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm text-[var(--aq-secondary)]">{t("focus.breakMinutes")}</span>
              <input
                type="number"
                min={1}
                max={30}
                value={breakMin}
                onChange={(e) => {
                  const v = Math.min(30, Math.max(1, Number(e.target.value) || 5));
                  setBreakMin(v);
                  focus.setDurations(workMin, v);
                }}
                className="h-11 w-full rounded-field bg-white/80 px-3 dark:bg-white/10"
              />
            </label>
          </div>
        </Card>
      )}

      <p className="text-center text-sm text-[var(--aq-secondary)]">
        {t("profile.toLevel", {
          left: Math.max(0, (profile?.level ?? 1) * 100 - (profile?.xp ?? 0)),
          level: (profile?.level ?? 1) + 1,
        })}
      </p>
    </div>
  );
}
