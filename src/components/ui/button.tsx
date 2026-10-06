import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "glass" | "ghost" | "danger";

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  /** Pill shape (default, Apple style) or rounded-2xl. */
  shape?: "pill" | "rounded";
  size?: "md" | "lg" | "sm";
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_8px_24px_rgba(236,111,160,0.4)] hover:brightness-105 disabled:opacity-50",
  glass: "glass text-[var(--aq-foreground)] hover:brightness-105",
  ghost: "bg-transparent text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10",
  danger: "bg-[#E5484D] text-white hover:brightness-105",
};

/** Every tappable surface: scale .96 on touch, spring release (stiffness 400 / damping 25). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", shape = "pill", size = "md", className, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-semibold",
        "min-h-[44px] disabled:cursor-not-allowed",
        size === "sm" && "px-4 py-2 text-sm",
        size === "md" && "px-6 py-3 text-[16px]",
        size === "lg" && "px-8 py-4 text-[17px]",
        shape === "pill" ? "rounded-full" : "rounded-2xl",
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
});
