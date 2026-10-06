import { useEffect, useState } from "react";
import { useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";

/** Numbers animate as a counter, never jump. Jumps under prefers-reduced-motion. */
export function AnimatedNumber({
  value,
  className,
  suffix,
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const reduced = useReducedMotion();
  const spring = useSpring(value, { stiffness: 140, damping: 22 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) {
      spring.jump(value);
      setDisplay(value);
    } else {
      spring.set(value);
    }
  }, [value, reduced, spring]);

  useMotionValueEvent(spring, "change", (v) => setDisplay(Math.round(v)));

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}
