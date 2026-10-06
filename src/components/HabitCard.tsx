import { useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import * as Lu from "lucide-react";
import type { Habit } from "@/lib/backend/types";
import { Particles } from "@/components/ui/particles";
import { hapticTap, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export function habitIcon(name: string, size = 20) {
  const Cmp = (Lu as unknown as Record<string, React.ComponentType<{ size?: number }>>)[name];
  return Cmp ? <Cmp size={size} /> : <Lu.Circle size={size} />;
}

interface HabitCardProps {
  habit: Habit;
  done: boolean;
  onToggle: () => Promise<unknown>;
}

export function HabitCard({ habit, done, onToggle }: HabitCardProps) {
  const [burst, setBurst] = useState(0);

  const handle = async () => {
    void hapticTap();
    if (!done) {
      setBurst((b) => b + 1);
      void hapticSuccess();
    }
    await onToggle();
  };

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn("glass relative flex items-center gap-4 p-4", done && "opacity-80")}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
        style={{ background: habit.color }}
        aria-hidden
      >
        {habitIcon(habit.icon)}
      </span>
      <span className="flex-1 text-left">
        <span className="block font-semibold text-[var(--aq-foreground)]">{habit.title}</span>
        {habit.reminder_at && (
          <span className="text-xs text-[var(--aq-secondary)]">{habit.reminder_at}</span>
        )}
      </span>
      <button
        onClick={() => void handle()}
        aria-pressed={done}
        aria-label={habit.title}
        className="relative flex h-11 w-11 items-center justify-center"
      >
        <Particles burstKey={burst} />
        <motion.span
          animate={done ? { scale: [0.8, 1.18, 1] } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-transparent bg-accent text-white"
              : "border-black/20 dark:border-white/30",
          )}
        >
          {done && <Check size={17} strokeWidth={3} />}
        </motion.span>
      </button>
    </motion.div>
  );
}
