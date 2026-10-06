import { forwardRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface FloatInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  error?: string | null;
  type?: string;
  autoComplete?: string;
}

/**
 * Apple-style field: 52px tall, soft shadow, a floating label that lifts on
 * focus/when filled, an animated focus ring, and a 240 ms two-oscillation
 * shake when `error` is set.
 */
export const FloatInput = forwardRef<HTMLInputElement, FloatInputProps>(function FloatInput(
  { label, value, onValueChange, error, className, type = "text", ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const lifted = focused || value.length > 0;

  return (
    <div className={cn("w-full", className)}>
      <motion.div
        animate={error && !reduced ? { x: [0, -9, 9, -5, 0] } : { x: 0 }}
        transition={{ duration: 0.24 }}
        className="relative"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-field"
          animate={{
            boxShadow: focused
              ? "0 0 0 3px rgba(236,111,160,0.35), 0 0 18px rgba(236,111,160,0.25)"
              : "0 2px 12px rgba(61,27,46,0.08)",
          }}
          transition={{ duration: 0.2 }}
        />
        <motion.label
          className="pointer-events-none absolute left-4 origin-left text-[var(--aq-secondary)]"
          animate={{
            y: lifted ? -9 : 0,
            scale: lifted ? 0.72 : 1,
            color: error ? "#E5484D" : focused ? "#EC6FA0" : "var(--aq-secondary)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          style={{ top: 15 }}
        >
          {label}
        </motion.label>
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={!!error}
          className={cn(
            "h-[52px] w-full rounded-field bg-white/80 px-4 pb-1 pt-4 text-[16px]",
            "text-[var(--aq-foreground)] outline-none dark:bg-white/10",
            error && "text-[#E5484D]",
          )}
          {...rest}
        />
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 pl-1 text-sm text-[#E5484D]"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});
