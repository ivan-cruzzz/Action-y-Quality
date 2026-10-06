import { AnimatePresence, motion } from "motion/react";
import { Cloud } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FloatingDockNav } from "@/components/ui/floating-dock-navigation";
import { Toasts } from "@/components/Toasts";
import { OfflineBadge } from "@/components/OfflineBadge";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "nav.home" },
  { to: "/habits", key: "nav.tasks" },
  { to: "/stats", key: "nav.stats" },
  { to: "/quote", key: "nav.quote" },
  { to: "/games", key: "nav.games" },
  { to: "/profile", key: "nav.profile" },
  { to: "/settings", key: "nav.settings" },
];

/** Screen transition: fade + 12px slide, 240ms, ease [0.22, 1, 0.36, 1]. */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const offlineFallback = useAuth((s) => s.offlineFallback);

  return (
    <div className="min-h-dvh">
      {/* Desktop top navigation (the dock stays available on every platform) */}
      <header className="sticky top-0 z-40 hidden items-center justify-center gap-4 pb-2 pt-4 md:flex">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--aq-foreground)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Cloud size={17} />
          </span>
          {t("home.brand")}
        </span>
        <nav
          className="glass-pill flex items-center gap-1 px-2 py-1.5 shadow-glass"
          aria-label={t("nav.nav")}
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-white"
                    : "text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10",
                )
              }
            >
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-5 md:pb-28 md:pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <Page key={pathname}>{children}</Page>
        </AnimatePresence>
      </main>

      {offlineFallback && (
        <div className="fixed inset-x-0 top-0 z-[86] bg-[#E5484D] px-4 py-2 text-center text-xs font-medium text-white">
          Нет связи с сервером — приложение работает локально. Проверьте настройки Supabase (Email-провайдер включён?).
        </div>
      )}
      <FloatingDockNav />
      <Toasts />
      <OfflineBadge />
    </div>
  );
}
