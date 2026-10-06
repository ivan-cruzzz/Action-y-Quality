// Floating dock navigation for Action & Quality.
// Adapted from the reference component in меню.txt (macOS-dock style:
// icons scale by distance on hover/press, tooltips, active dot, glass pill),
// with 6 app destinations, i18n labels and react-router navigation.

import { cn } from "@/lib/utils";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, BarChart3, Sparkles, User, Settings, ListChecks, Gamepad2 } from "lucide-react";
import { hapticTap } from "@/lib/haptics";

interface NavItem {
  icon: React.ReactNode;
  labelKey: string;
  to: string;
}

const navItems: NavItem[] = [
  { icon: <Home size={20} />, labelKey: "nav.home", to: "/" },
  { icon: <ListChecks size={20} />, labelKey: "nav.tasks", to: "/habits" },
  { icon: <BarChart3 size={20} />, labelKey: "nav.stats", to: "/stats" },
  { icon: <Sparkles size={20} />, labelKey: "nav.quote", to: "/quote" },
  { icon: <Gamepad2 size={20} />, labelKey: "nav.games", to: "/games" },
  { icon: <User size={20} />, labelKey: "nav.profile", to: "/profile" },
  { icon: <Settings size={20} />, labelKey: "nav.settings", to: "/settings" },
];

export const FloatingDockNav = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeIndex = navItems.findIndex((i) => i.to === pathname);

  const getScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(hoveredIndex - index);
    if (distance === 0) return 1.4;
    if (distance === 1) return 1.2;
    if (distance === 2) return 1.1;
    return 1;
  };

  return (
    <nav
      className="fixed left-1/2 z-50 -translate-x-1/2"
      style={{ bottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label={t("nav.nav")}
    >
      <div className="glass-pill flex items-end gap-1 p-2 shadow-2xl">
        {navItems.map((item, index) => {
          const active = activeIndex === index;
          return (
            <button
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onPointerDown={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
              onClick={() => {
                void hapticTap();
                navigate(item.to);
              }}
              aria-label={t(item.labelKey)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl",
                "transition-colors duration-300 ease-out",
                active && "bg-[rgba(236,111,160,0.14)]",
              )}
              style={{
                width: "46px",
                height: "46px",
                transform: `scale(${getScale(index)})`,
                transformOrigin: "bottom",
              }}
            >
              <div
                className={cn(
                  "transition-colors duration-200",
                  active ? "text-accent" : "text-gray-700 dark:text-gray-200",
                )}
              >
                {item.icon}
              </div>

              {/* Tooltip — clamped inside the pill on the first/last items */}
              {hoveredIndex === index && (
                <div
                  className={cn(
                    "pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg dark:bg-gray-800",
                    index === 0 && "left-0",
                    index === navItems.length - 1 && "right-0",
                    index !== 0 &&
                      index !== navItems.length - 1 &&
                      "left-1/2 -translate-x-1/2",
                  )}
                >
                  {t(item.labelKey)}
                  {index !== 0 && index !== navItems.length - 1 && (
                    <div className="absolute left-1/2 top-full -mt-px -translate-x-1/2">
                      <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
                    </div>
                  )}
                </div>
              )}

              {/* Active indicator */}
              {active && (
                <div className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default FloatingDockNav;
