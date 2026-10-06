import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { backend, XP_PER_QUIZ_ANSWER, type GameKey } from "@/lib/backend";
import { useAddGameScore, useGameScores, useQuotes } from "@/hooks/useData";
import { checkAndUnlockAchievements } from "@/lib/gamification";
import { dayOfYear } from "@/lib/date";
import { hapticTap, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/backend/types";

const TOTAL = 5;

interface Round {
  quote: Quote;
  options: string[];
}

/** Deterministic-but-varied pick: seeded by day-of-year and round index. */
function buildRounds(quotes: Quote[]): Round[] {
  if (quotes.length < 4) return [];
  const pool = [...quotes];
  const seed = dayOfYear();
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, TOTAL);
  return picked.map((quote, index) => {
    const uniqueOthers = [
      ...new Set(quotes.filter((q) => q.author !== quote.author).map((q) => q.author)),
    ];
    const wrong: string[] = [];
    let k = seed + index * 7;
    while (wrong.length < Math.min(3, uniqueOthers.length)) {
      k = (k * 9301 + 49297) % 233280;
      const cand = uniqueOthers[Math.floor((k / 233280) * uniqueOthers.length)];
      if (!wrong.includes(cand) && cand !== quote.author) wrong.push(cand);
    }
    const options = [quote.author, ...wrong];
    let o = seed + index * 13;
    for (let i = options.length - 1; i > 0; i--) {
      o = (o * 9301 + 49297) % 233280;
      const j = Math.floor((o / 233280) * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { quote, options };
  });
}

export default function QuizGame() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const userId = useAuth((s) => s.user?.id);
  const quotes = useQuotes();
  const scores = useGameScores(userId);
  const addScore = useAddGameScore(userId);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const rounds = useMemo(() => buildRounds(quotes.data ?? []), [quotes.data]);
  const current = rounds[round];
  const totalRounds = Math.min(TOTAL, rounds.length);
  const totalCorrectAllTime = (scores.data ?? [])
    .filter((r) => r.game === "quiz")
    .reduce((s, r) => s + r.score, 0);

  const answer = async (option: string) => {
    if (picked || !current) return;
    setPicked(option);
    const isRight = option === current.quote.author;
    if (isRight) {
      void hapticSuccess();
      setCorrect((c) => c + 1);
    } else {
      void hapticTap();
    }
    const newCorrect = correct + (isRight ? 1 : 0);
    if (round + 1 >= totalRounds) {
      try {
        if (userId) {
          await addScore.mutateAsync({ game: "quiz" as GameKey, score: newCorrect });
          const p = await backend.addXp(userId, newCorrect * XP_PER_QUIZ_ANSWER);
          useAuth.getState().setProfile(p);
          const fresh = await checkAndUnlockAchievements(userId, [], [], [], 0, {
            quizCorrect: totalCorrectAllTime + newCorrect,
          }).catch(() => []);
          for (const f of fresh) push(t(`achievements.${f}`), "success");
        }
        setConfetti((c) => c + 1);
      } catch {
        push(t("common.networkError"), "error");
      }
      window.setTimeout(() => setFinished(true), 900);
    } else {
      window.setTimeout(() => {
        setPicked(null);
        setRound((r) => r + 1);
      }, 900);
    }
  };

  const restart = () => {
    setRound(0);
    setPicked(null);
    setCorrect(0);
    setFinished(false);
  };

  const textOf = (q: Quote) => (i18n.language === "en" ? q.text_en : q.text_ru);

  return (
    <div className="space-y-4">
      <Confetti fire={confetti} />
      <div className="flex items-center justify-between">
        <Button variant="glass" size="sm" onClick={() => navigate("/games")}>
          ← {t("games.title")}
        </Button>
        <h1 className="text-xl font-semibold">{t("games.quiz")}</h1>
        <span className="w-[72px] text-right text-sm font-medium tabular-nums text-[var(--aq-secondary)]">
          {correct}/{totalRounds}
        </span>
      </div>

      {!finished && current && (
        <Card className="space-y-5">
          <p className="text-sm font-medium text-[var(--aq-secondary)]">
            {t("games.quiz_round", { n: round + 1, total: totalRounds })}
          </p>
          <p className="text-xl font-medium leading-relaxed">«{textOf(current.quote)}»</p>
          <p className="text-sm text-[var(--aq-secondary)]">{t("games.quiz_who")}</p>
          <div className="grid gap-2.5">
            {current.options.map((option) => {
              const isRight = option === current.quote.author;
              const state = !picked
                ? "idle"
                : isRight
                  ? "right"
                  : option === picked
                    ? "wrong"
                    : "dim";
              return (
                <motion.button
                  key={option}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => void answer(option)}
                  disabled={!!picked}
                  aria-pressed={picked === option}
                  className={cn(
                    "min-h-[52px] rounded-field px-4 py-3 text-left text-[15px] font-medium transition-colors",
                    "disabled:cursor-default",
                    state === "idle" &&
                      "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15",
                    state === "right" && "bg-[#30A46C] text-white",
                    state === "wrong" && "bg-[#E5484D] text-white",
                    state === "dim" && "bg-black/5 opacity-50 dark:bg-white/10",
                  )}
                >
                  {option}
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {picked && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "text-center text-sm font-semibold",
                  picked === current.quote.author ? "text-[#30A46C]" : "text-[#E5484D]",
                )}
              >
                {picked === current.quote.author
                  ? t("games.quiz_correct")
                  : t("games.quiz_wrong")}
              </motion.p>
            )}
          </AnimatePresence>
        </Card>
      )}

      {finished && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-5xl font-bold tabular-nums">{correct}</p>
          <p className="text-[var(--aq-secondary)]">
            {t("games.quiz_final", { n: correct, total: totalRounds })}
          </p>
          <p className="text-sm font-medium text-accent">
            {t("games.xpEarned", { xp: correct * XP_PER_QUIZ_ANSWER })}
          </p>
          <div className="mt-2 flex gap-3">
            <Button variant="glass" onClick={() => navigate("/games")}>
              {t("games.exit")}
            </Button>
            <Button onClick={restart}>{t("games.again")}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
