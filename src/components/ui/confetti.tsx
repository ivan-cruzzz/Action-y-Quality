import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const COLORS = ["#EC6FA0", "#FFC53D", "#30A46C", "#E5484D", "#9B8AFB", "#F97316"];

/** Short confetti rain. Re-fires whenever `fire` increments (0 = off). */
export function Confetti({ fire }: { fire: number }) {
  const reduced = useReducedMotion();
  const show = fire > 0 && !reduced;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={fire}
          className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden
        >
          {Array.from({ length: 26 }, (_, i) => {
            const left = (i * 37) % 100;
            const delay = (i % 8) * 0.06;
            const size = 6 + (i % 4) * 2;
            return (
              <motion.span
                key={i}
                className="absolute rounded-[2px]"
                style={{
                  left: `${left}%`,
                  top: -20,
                  width: size,
                  height: size * 1.6,
                  background: COLORS[i % COLORS.length],
                }}
                initial={{ y: -30, rotate: 0, opacity: 1 }}
                animate={{ y: "110vh", rotate: 360 + i * 40, opacity: [1, 1, 0.9, 0] }}
                transition={{ duration: 1.5 + (i % 5) * 0.12, delay, ease: "easeIn" }}
              />
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
