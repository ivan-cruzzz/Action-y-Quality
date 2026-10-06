import { AnimatePresence, motion } from "motion/react";
import { useToasts } from "@/store/toast";
import { cn } from "@/lib/utils";

const KIND_CLASS: Record<string, string> = {
  info: "bg-gray-900/90 text-white dark:bg-white/90 dark:text-gray-900",
  success: "bg-[#1F9D5B]/95 text-white",
  error: "bg-[#E5484D]/95 text-white",
};

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-32 z-[80] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className={cn(
              "max-w-sm rounded-full px-5 py-2.5 text-center text-sm font-medium shadow-xl backdrop-blur",
              KIND_CLASS[t.kind],
            )}
            role="status"
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
