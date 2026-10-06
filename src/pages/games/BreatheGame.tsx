import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { backend, XP_PER_BREATHE, type GameKey } from "@/lib/backend";
import { useAddGameScore, useGameScores } from "@/hooks/useData";
import { checkAndUnlockAchievements } from "@/lib/gamification";
import { hapticTap, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Phase = "in" | "hold" | "out" | "hold2";
type Pattern = { key: "box" | "calm"; phases: { phase: Phase; seconds: number }[] };

const PATTERNS: Pattern[] = [
  {
    key: "box",
    phases: [
      { phase: "in", seconds: 4 },
      { phase: "hold", seconds: 4 },
      { phase: "out", seconds: 4 },
      { phase: "hold2", seconds: 4 },
    ],
  },
  {
    key: "calm",
    phases: [
      { phase: "in", seconds: 4 },
      { phase: "hold", seconds: 7 },
      { phase: "out", seconds: 8 },
    ],
  },
];

const phaseKey = (p: Phase) => `games.breathe_${p === "hold2" ? "hold" : p}`;

export default function BreatheGame() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const reduced = useReducedMotion();
  const userId = useAuth((s) => s.user?.id);
  const scores = useGameScores(userId);
  const addScore = useAddGameScore(userId);
  const [pattern, setPattern] = useState<Pattern>(PATTERNS[0]);
  const [cycles, setCycles] = useState(4);
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [remaining, setRemaining] = useState(1);
  const [done, setDone] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const completingRef = useRef(false);

  const totalSteps = pattern.phases.length;
  const step = pattern.phases[stepIdx];
  const doneSessions = (scores.data ?? []).filter((r) => r.game === "breathe").length;
  const patternSeconds = pattern.phases.reduce((s, p) => s + p.seconds, 0);

  // Phase countdown → next step / next cycle / session complete
  useEffect(() => {
    if (!running) return;
    setRemaining(step.seconds);
    const id = window.setInterval(() => {
      setRemaining((v) => {
        if (v > 1) return v - 1;
        window.clearInterval(id);
        void hapticTap();
        setStepIdx((s) => {
          const next = (s + 1) % totalSteps;
          if (next === 0) {
            setCycle((c) => {
              if (c >= cycles) {
                window.clearInterval(id);
                setRunning(false);
                if (!completingRef.current) {
                  completingRef.current = true;
                  void (async () => {
                    try {
                      if (userId) {
                        const minutes = Math.max(
                          1,
                          Math.round((patternSeconds * cycles) / 60),
                        );
                        await addScore.mutateAsync({ game: "breathe" as GameKey, score: minutes });
                        const p = await backend.addXp(userId, XP_PER_BREATHE);
                        useAuth.getState().setProfile(p);
                        const fresh = await checkAndUnlockAchievements(userId, [], [], [], 0, {
                          breatheCount: doneSessions + 1,
                        }).catch(() => []);
                        for (const f of fresh) push(t(`achievements.${f}`), "success");
                      }
                      void hapticSuccess();
                      setDone(true);
                      setConfetti((c) => c + 1);
                    } finally {
                      completingRef.current = false;
                    }
                  })();
                }
              }
              return c + 1;
            });
          }
          return next;
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, stepIdx, step.seconds, totalSteps, cycles, patternSeconds, userId]);

  const scale = useMemo(() => {
    if (!running) return 1;
    const progress = 1 - remaining / Math.max(1, step.seconds);
    switch (step.phase) {
      case "in":
        return 0.7 + 0.5 * progress;
      case "hold":
        return 1.2;
      case "out":
        return 1.2 - 0.5 * progress;
      default:
        return 0.7;
    }
  }, [running, remaining, step]);

  const start = () => {
    setStepIdx(0);
    setCycle(1);
    setDone(false);
    setRunning(true);
  };

  const phaseLabel = t(phaseKey(step.phase));
  const totalSessionSeconds = patternSeconds * cycles;
  const elapsedStepsBefore = pattern.phases
    .slice(0, stepIdx)
    .reduce((s, p) => s + p.seconds, 0);
  const elapsed =
    (cycle - 1) * patternSeconds + elapsedStepsBefore + (step.seconds - remaining);
  const progress = done ? 1 : running ? Math.min(1, elapsed / totalSessionSeconds) : 0;
  const R = 104;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="space-y-4">
      <Confetti fire={confetti} />
      <div className="flex items-center justify-between">
        <Button variant="glass" size="sm" onClick={() => navigate("/games")}>
          ← {t("games.title")}
        </Button>
        <h1 className="text-xl font-semibold">{t("games.breathe")}</h1>
        <span className="w-[72px]" />
      </div>

      <Card className="relative flex flex-col items-center gap-5 py-8">
        <div className="relative h-[240px] w-[240px]">
          <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90">
            <circle
              cx="120"
              cy="120"
              r={R}
              fill="none"
              strokeWidth="10"
              className="stroke-black/10 dark:stroke-white/10"
            />
            <circle
              cx="120"
              cy="120"
              r={R}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className="stroke-accent"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.9s linear" }}
            />
          </svg>
          {/* the breathing blob */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="flex h-32 w-32 items-center justify-center rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), rgba(248,215,232,0.95) 45%, rgba(236,111,160,0.95))",
                boxShadow: "0 18px 44px rgba(236,111,160,0.4)",
              }}
              animate={{ scale: reduced ? 1 : scale }}
              transition={{ duration: 1, ease: "easeInOut" }}
              aria-hidden
            >
              <span className="flex gap-4">
                <span className="h-2 w-2 rounded-full bg-[rgba(11,37,64,0.55)]" />
                <span className="h-2 w-2 rounded-full bg-[rgba(11,37,64,0.55)]" />
              </span>
            </motion.div>
          </div>
        </div>

        <p className="text-lg font-semibold" aria-live="polite">
          {done ? t("games.breathe_done") : running ? phaseLabel : t("games.breathe")}
        </p>
        {running && (
          <p className="text-sm tabular-nums text-[var(--aq-secondary)]">
            {t("games.breathe_cycles")} {Math.min(cycle, cycles)}/{cycles} · {remaining}s
          </p>
        )}
        {done && (
          <p className="text-sm font-medium text-accent">
            {t("games.xpEarned", { xp: XP_PER_BREATHE })}
          </p>
        )}

        {running ? (
          <Button variant="glass" onClick={() => setRunning(false)}>
            {t("common.close")}
          </Button>
        ) : (
          <>
            <div className="glass-pill flex gap-1 p-1">
              {PATTERNS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPattern(p)}
                  aria-pressed={pattern.key === p.key}
                  className={cn(
                    "min-h-[40px] rounded-full px-4 text-sm font-medium transition-colors",
                    pattern.key === p.key ? "bg-accent text-white" : "text-[var(--aq-secondary)]",
                  )}
                >
                  {t(`games.breathe_${p.key}`)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 text-sm text-[var(--aq-secondary)]">
              {t("games.breathe_cycles")}
              <input
                type="range"
                min={2}
                max={8}
                value={cycles}
                onChange={(e) => setCycles(Number(e.target.value))}
                className="w-40 accent-[var(--aq-accent)]"
                aria-label={t("games.breathe_cycles")}
              />
              <span className="w-5 tabular-nums">{cycles}</span>
            </label>
            <Button size="lg" onClick={start}>
              {done ? t("games.again") : t("games.start")}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
