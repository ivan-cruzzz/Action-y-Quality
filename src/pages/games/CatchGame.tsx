import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { backend, type GameKey } from "@/lib/backend";
import { useAddGameScore, useGameScores } from "@/hooks/useData";
import { checkAndUnlockAchievements } from "@/lib/gamification";
import { hapticTap, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Positive blobs use mood 3–5 colors, gray blockers use mood 1. */
const POSITIVE = ["#7CC7F2", "#86DFB2", "#FFC24B"];
const GRAY = "#5A6B85";
const GAME_SECONDS = 30;
const SPAWN_MS = 420;

interface Blob {
  id: number;
  x: number; // 4..88 (% of width)
  kind: "positive" | "gray";
  color: string;
  size: number; // 44..68 px
  duration: number; // seconds to cross the screen
  wobble: number;
}

function MiniBlob({ color, size }: { color: string; size: number }) {
  const gid = `g-${color.replace("#", "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor={color} />
        </radialGradient>
      </defs>
      <path
        d="M32 6c12 0 21 8 21 18 0 4-2 8-4 10 3 3 5 6 5 10 0 8-9 14-22 14s-22-6-22-14c0-4 2-7 5-10-2-2-4-6-4-10C11 14 20 6 32 6z"
        fill={`url(#${gid})`}
      />
      <circle cx="25" cy="28" r="2.6" fill="rgba(11,37,64,0.6)" />
      <circle cx="39" cy="28" r="2.6" fill="rgba(11,37,64,0.6)" />
      <path
        d="M26 36q6 5 12 0"
        stroke="rgba(11,37,64,0.6)"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function CatchGame() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const reduced = useReducedMotion();
  const userId = useAuth((s) => s.user?.id);
  const scores = useGameScores(userId);
  const addScore = useAddGameScore(userId);
  const [confetti, setConfetti] = useState(0);
  const [phase, setPhase] = useState<"idle" | "run" | "over">("idle");
  const [score, setScore] = useState(0);
  const [blobs, setBlobs] = useState<Blob[]>([]);
  const [left, setLeft] = useState(GAME_SECONDS);
  const [xpEarned, setXpEarned] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const seq = useRef(1);
  const scoreRef = useRef(0);

  const best = Math.max(
    0,
    ...(scores.data ?? []).filter((r) => r.game === "catch").map((r) => r.score),
  );

  const finish = useCallback(async () => {
    setPhase("over");
    setBlobs([]);
    const finalScore = scoreRef.current;
    const xp = Math.floor(finalScore / 2);
    setXpEarned(xp);
    if (!userId) return;
    const previousBest = Math.max(
      0,
      ...(scores.data ?? []).filter((r) => r.game === "catch").map((r) => r.score),
    );
    if (finalScore > previousBest && finalScore > 0) {
      setNewRecord(true);
      setConfetti((c) => c + 1);
    }
    try {
      await addScore.mutateAsync({ game: "catch" as GameKey, score: finalScore });
      const p = await backend.addXp(userId, xp);
      useAuth.getState().setProfile(p);
      await checkAndUnlockAchievements(userId, [], [], [], 0, {
        catchBest: Math.max(previousBest, finalScore),
      }).catch(() => []);
    } catch {
      push(t("common.networkError"), "error");
    }
  }, [userId, scores.data, addScore, push, t]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Timer — runs off a ref so a changing `finish` identity can't reset it.
  useEffect(() => {
    if (phase !== "run") return;
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          window.clearInterval(id);
          void finishRef.current();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Spawner
  useEffect(() => {
    if (phase !== "run") return;
    const id = window.setInterval(() => {
      setBlobs((cur) => {
        const gray = Math.random() < 0.22;
        const blob: Blob = {
          id: seq.current++,
          x: 4 + Math.random() * 84,
          kind: gray ? "gray" : "positive",
          color: gray ? GRAY : POSITIVE[Math.floor(Math.random() * POSITIVE.length)],
          size: 44 + Math.random() * 24,
          duration: 4.5 + Math.random() * 3.5,
          wobble: Math.random() * 30 - 15,
        };
        return [...cur.slice(-14), blob];
      });
    }, SPAWN_MS);
    return () => window.clearInterval(id);
  }, [phase]);

  const pop = (blob: Blob) => {
    void hapticTap();
    setBlobs((cur) => cur.filter((b) => b.id !== blob.id));
    setScore((s) => {
      const next = Math.max(0, s + (blob.kind === "positive" ? 1 : -2));
      scoreRef.current = next;
      return next;
    });
  };

  const start = () => {
    scoreRef.current = 0;
    setScore(0);
    setLeft(GAME_SECONDS);
    setNewRecord(false);
    setXpEarned(0);
    setBlobs([]);
    setPhase("run");
  };

  const secondsLeftPct = left / GAME_SECONDS;
  const R = 20;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="space-y-4">
      <Confetti fire={confetti} />
      <div className="flex items-center justify-between">
        <Button variant="glass" size="sm" onClick={() => navigate("/games")}>
          ← {t("games.title")}
        </Button>
        <h1 className="text-xl font-semibold">{t("games.catch")}</h1>
        <span className="w-[72px] text-right text-sm font-medium tabular-nums text-[var(--aq-secondary)]">
          {t("games.score")}: {score}
        </span>
      </div>

      {phase === "idle" && (
        <Card className="space-y-5 py-8 text-center">
          <div className="flex justify-center gap-2">
            {POSITIVE.map((c) => (
              <MiniBlob key={c} color={c} size={44} />
            ))}
            <MiniBlob color={GRAY} size={44} />
          </div>
          <p className="mx-auto max-w-xs text-sm text-[var(--aq-secondary)]">
            {t("games.catch_hint")}
          </p>
          <Button size="lg" onClick={start}>
            {t("games.start")}
          </Button>
        </Card>
      )}

      {phase !== "idle" && (
        <div className="glass relative h-[60dvh] min-h-[420px] overflow-hidden rounded-card">
          {/* top bar: timer ring + best */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
            <span className="glass-pill px-4 py-1.5 text-sm font-medium">
              {t("games.best")}: {best}
            </span>
            <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden>
              <circle
                cx="24"
                cy="24"
                r={R}
                fill="none"
                strokeWidth="4"
                className="stroke-black/10 dark:stroke-white/15"
              />
              <circle
                cx="24"
                cy="24"
                r={R}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                className="stroke-accent"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - secondsLeftPct)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
          </div>

          {/* floating blobs */}
          <AnimatePresence>
            {blobs.map((b) => (
              <motion.button
                key={b.id}
                className="absolute cursor-pointer"
                style={{ left: `${b.x}%`, bottom: -80, touchAction: "manipulation" }}
                initial={{ y: 0 }}
                animate={reduced ? { y: "-78dvh" } : { y: "-78dvh", x: [0, b.wobble, 0, -b.wobble, 0] }}
                transition={{
                  y: { duration: b.duration, ease: "linear" },
                  x: { duration: b.duration, ease: "easeInOut" },
                }}
                onAnimationComplete={() => setBlobs((cur) => cur.filter((x) => x.id !== b.id))}
                whileTap={{ scale: 0.8 }}
                onClick={() => pop(b)}
                aria-label={b.kind === "gray" ? "-2" : "+1"}
              >
                <span className={cn("block", b.kind === "gray" && "opacity-90")}>
                  <MiniBlob color={b.color} size={b.size} />
                </span>
              </motion.button>
            ))}
          </AnimatePresence>

          {/* game over overlay */}
          <AnimatePresence>
            {phase === "over" && (
              <motion.div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/35 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-sm font-medium text-white/85">{t("games.gameOver")}</p>
                <p className="text-6xl font-bold text-white tabular-nums">{score}</p>
                {newRecord && (
                  <p className="text-sm font-semibold text-[#FFC53D]">
                    🏆 {t("games.newRecord")}
                  </p>
                )}
                <p className="text-sm font-medium text-accent">
                  {t("games.xpEarned", { xp: xpEarned })}
                </p>
                <div className="mt-2 flex gap-3">
                  <Button variant="glass" onClick={() => navigate("/games")}>
                    {t("games.exit")}
                  </Button>
                  <Button onClick={start}>{t("games.again")}</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
