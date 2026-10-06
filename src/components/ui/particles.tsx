import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const COLORS = ["#EC6FA0", "#FFC53D", "#30A46C", "#E5484D", "#9B8AFB"];

/** 6-particle burst shown for a moment whenever `burstKey` changes. */
export function Particles({ burstKey }: { burstKey: number }) {
  const reduced = useReducedMotion();
  return (
    <span className="pointer-events-none absolute inset-0 z-10 overflow-visible" aria-hidden>
      <AnimatePresence>
        {burstKey > 0 && !reduced && (
          <span key={burstKey}>
            {Array.from({ length: 6 }, (_, i) => {
              const angle = (i / 6) * Math.PI * 2 + 0.4;
              const dist = 26 + (i % 3) * 8;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: 0,
                    scale: 0.4,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
              );
            })}
          </span>
        )}
      </AnimatePresence>
    </span>
  );
}
