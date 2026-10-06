import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { initOfflineQueue, pendingCount } from "@/lib/offlineQueue";
import { backend } from "@/lib/backend";

/** Shows an unobtrusive pill while offline; counts queued writes. */
export function OfflineBadge() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    initOfflineQueue(backend, setPending);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="pointer-events-none fixed inset-x-0 top-2 z-[85] flex justify-center md:top-20"
          role="status"
        >
          <span className="glass-pill flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-[var(--aq-foreground)] shadow-glass">
            <WifiOff size={13} className="text-accent" />
            {t("extra.offline_badge")}
            {pending > 0 && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 tabular-nums text-accent">
                {pending}
              </span>
            )}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
