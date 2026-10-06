import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Cloud, Gamepad2, Grid3x3, Wind, Quote as QuoteIcon } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import {
  useCompleteChallenge,
  useDailyChallenge,
  useDailyChallengeHistory,
  useGameScores,
} from "@/hooks/useData";
import { challengeOfDay, challengeTitleKey } from "@/lib/dailyChallenge";
import { XP_PER_CHALLENGE, type GameKey } from "@/lib/backend";
import { checkAndUnlockAchievements } from "@/lib/gamification";
import { hapticSuccess } from "@/lib/haptics";

export default function GamesHub() {
  const { t } = useTranslation();
  const push = useToasts((s) => s.push);
  const userId = useAuth((s) => s.user?.id);
  const profile = useAuth((s) => s.profile);
  const challenge = useDailyChallenge(userId);
  const history = useDailyChallengeHistory(userId);
  const completeChallenge = useCompleteChallenge(userId);
  const scores = useGameScores(userId);
  const [confetti, setConfetti] = useState(0);
  const doneRef = useRef(!!challenge.data?.done);

  const code = challengeOfDay();
  const done = challenge.data?.done ?? false;

  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      setConfetti((c) => c + 1);
    }
    if (!done) doneRef.current = false;
  }, [done]);

  // New-achievement check whenever arcade data lands
  useEffect(() => {
    if (!userId || !scores.data || !history.data) return;
    const rows = scores.data;
    const catchBest = Math.max(0, ...rows.filter((r) => r.game === "catch").map((r) => r.score));
    const quizCorrect = rows.filter((r) => r.game === "quiz").reduce((s, r) => s + r.score, 0);
    const breatheCount = rows.filter((r) => r.game === "breathe").length;
    const challengesDone = history.data.filter((c) => c.done).length;
    checkAndUnlockAchievements(userId, [], [], [], 0, {
      catchBest,
      quizCorrect,
      breatheCount,
      challengesDone,
    })
      .then((fresh) => {
        for (const f of fresh) push(t(`achievements.${f}`), "success");
      })
      .catch(() => undefined);
  }, [userId, scores.data, history.data, push, t]);

  const markDone = async () => {
    if (!userId || done) return;
    void hapticSuccess();
    await completeChallenge.mutateAsync(code);
    setConfetti((c) => c + 1);
    push(t("games.xpEarned", { xp: XP_PER_CHALLENGE }), "success");
  };

  const bestOf = (game: GameKey) => {
    const rows = (scores.data ?? []).filter((r) => r.game === game).map((r) => r.score);
    return rows.length ? Math.max(...rows) : null;
  };

  const GAMES = [
    {
      to: "/games/catch",
      icon: <Gamepad2 size={22} />,
      title: t("games.catch"),
      desc: t("games.catch_d"),
      best: bestOf("catch"),
      suffix: "",
    },
    {
      to: "/games/breathe",
      icon: <Wind size={22} />,
      title: t("games.breathe"),
      desc: t("games.breathe_d"),
      best: bestOf("breathe"),
      suffix: "",
    },
    {
      to: "/games/quiz",
      icon: <QuoteIcon size={22} />,
      title: t("games.quiz"),
      desc: t("games.quiz_d"),
      best: bestOf("quiz"),
      suffix: "/5",
    },
    {
      to: "/games/memory",
      icon: <Grid3x3 size={22} />,
      title: t("extra.memory"),
      desc: t("extra.memory_d"),
      best: bestOf("memory"),
      suffix: "",
    },
  ];

  return (
    <div className="space-y-5">
      <Confetti fire={confetti} />
      <header>
        <h1 className="text-[28px] font-semibold">{t("games.title")}</h1>
        <p className="mt-1 text-sm text-[var(--aq-secondary)]">{t("games.subtitle")}</p>
      </header>

      {/* Daily challenge */}
      <Card className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Cloud size={18} className="text-accent" /> {t("games.challenge")}
            </CardTitle>
            <p className="mt-2 text-[17px] font-medium">{t(challengeTitleKey(code))}</p>
            {done && (
              <p className="mt-1 text-sm font-medium text-[#30A46C]">
                ✓ {t("games.challenge_done_today")}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={done ? "glass" : "primary"}
            onClick={() => void markDone()}
            disabled={done || completeChallenge.isPending}
            aria-pressed={done}
            className="shrink-0"
          >
            {done ? <Check size={16} /> : null}
            {done ? t("common.done") : t("games.markDone")}
          </Button>
        </div>
      </Card>

      {/* Games */}
      <div className="space-y-3">
        {GAMES.map((g) => (
          <motion.div
            key={g.to}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <Link to={g.to} className="glass flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                {g.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--aq-foreground)]">
                  {g.title}
                </span>
                <span className="block text-sm text-[var(--aq-secondary)]">{g.desc}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {g.best !== null && (
                  <span className="rounded-full bg-accent/12 px-3 py-1 text-xs font-medium text-accent">
                    {t("games.best")}: {g.best}
                    {g.suffix}
                  </span>
                )}
                <ChevronRight size={18} className="text-[var(--aq-secondary)]" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* XP summary */}
      <Card className="flex items-center justify-between">
        <span className="text-sm text-[var(--aq-secondary)]">{t("home.xp")}</span>
        <AnimatedNumber value={profile?.xp ?? 0} className="text-2xl font-semibold text-accent" />
      </Card>
    </div>
  );
}
