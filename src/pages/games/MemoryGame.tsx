import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Confetti } from "@/components/ui/confetti";
import { habitIcon } from "@/components/HabitCard";
import { HABIT_ICONS } from "@/components/HabitForm";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { backend, type GameKey } from "@/lib/backend";
import { useAddGameScore } from "@/hooks/useData";
import { checkAndUnlockAchievements } from "@/lib/gamification";
import { hapticTap, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const PAIRS = 6;

interface Card2 {
  key: number;
  icon: string;
  flipped: boolean;
  matched: boolean;
}

function deal(): Card2[] {
  const icons = HABIT_ICONS.slice(0, PAIRS);
  const deck = [...icons, ...icons].map((icon, i) => ({
    key: i,
    icon,
    flipped: false,
    matched: false,
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function MemoryGame() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const userId = useAuth((s) => s.user?.id);
  const addScore = useAddGameScore(userId);
  const [cards, setCards] = useState<Card2[]>(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const busy = useRef(false);

  const matched = cards.filter((c) => c.matched).length / 2;

  useEffect(() => {
    if (matched === PAIRS && !won) {
      setWon(true);
      void hapticSuccess();
      setConfetti((c) => c + 1);
      void (async () => {
        if (!userId) return;
        const score = Math.max(5, 25 - moves * 2);
        try {
          await addScore.mutateAsync({ game: "memory" as GameKey, score });
          const p = await backend.addXp(userId, score);
          useAuth.getState().setProfile(p);
          await checkAndUnlockAchievements(userId, [], [], [], 0).catch(() => []);
        } catch {
          push(t("common.networkError"), "error");
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  const flip = (key: number) => {
    if (busy.current || won) return;
    const card = cards.find((c) => c.key === key);
    if (!card || card.flipped || card.matched) return;
    void hapticTap();
    const nextOpen = [...open, key];
    setCards((cur) => cur.map((c) => (c.key === key ? { ...c, flipped: true } : c)));
    setOpen(nextOpen);
    if (nextOpen.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextOpen.map((k) => cards.find((c) => c.key === k)!);
      const isPair = a.icon === b.icon;
      busy.current = true;
      window.setTimeout(
        () => {
          setCards((cur) =>
            cur.map((c) =>
              c.key === a.key || c.key === b.key
                ? { ...c, flipped: false, matched: isPair ? true : c.matched }
                : c,
            ),
          );
          setOpen([]);
          busy.current = false;
          if (isPair) void hapticSuccess();
        },
        isPair ? 350 : 750,
      );
    }
  };

  const restart = () => {
    setCards(deal());
    setOpen([]);
    setMoves(0);
    setWon(false);
  };

  return (
    <div className="space-y-4">
      <Confetti fire={confetti} />
      <div className="flex items-center justify-between">
        <Button variant="glass" size="sm" onClick={() => navigate("/games")}>
          ← {t("games.title")}
        </Button>
        <h1 className="text-xl font-semibold">{t("extra.memory")}</h1>
        <span className="w-[72px] text-right text-sm font-medium tabular-nums text-[var(--aq-secondary)]">
          {t("extra.memory_moves")}: {moves}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {cards.map((c) => (
          <motion.button
            key={c.key}
            whileTap={{ scale: 0.94 }}
            onClick={() => flip(c.key)}
            aria-label={c.flipped || c.matched ? c.icon : "card"}
            className={cn(
              "flex aspect-square items-center justify-center rounded-2xl transition-colors",
              c.flipped || c.matched
                ? "glass text-accent"
                : "bg-black/5 text-transparent dark:bg-white/10",
              c.matched && "opacity-60",
            )}
          >
            {(c.flipped || c.matched) && habitIcon(c.icon, 26)}
          </motion.button>
        ))}
      </div>

      {won && (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-4xl">🎉</p>
          <p className="text-lg font-semibold">
            {t("games.score")}: {Math.max(5, 25 - moves * 2)}
          </p>
          <p className="text-sm text-[var(--aq-secondary)]">
            {t("extra.memory_moves")}: {moves}
          </p>
          <div className="mt-1 flex gap-3">
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
