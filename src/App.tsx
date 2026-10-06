import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { applyAccent, applyTheme } from "@/lib/theme";
import { applySeason, storedSeason } from "@/lib/seasons";
import { useAuth } from "@/store/auth";
import { useTodayMood } from "@/hooks/useData";

import Onboarding from "@/pages/Onboarding";
import MoodCheckIn from "@/pages/MoodCheckIn";
import Home from "@/pages/Home";
import Habits from "@/pages/Habits";
import Statistics from "@/pages/Statistics";
import QuotePage from "@/pages/QuotePage";
import GamesHub from "@/pages/games/GamesHub";
import CatchGame from "@/pages/games/CatchGame";
import BreatheGame from "@/pages/games/BreatheGame";
import QuizGame from "@/pages/games/QuizGame";
import MemoryGame from "@/pages/games/MemoryGame";
import Focus from "@/pages/Focus";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Paywall from "@/pages/Paywall";
import Admin from "@/pages/Admin";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-10 w-10 animate-pulse rounded-full bg-accent" aria-label="loading" />
    </div>
  );
}

/** Requires auth; routes fresh users to onboarding. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (profile && !profile.onboarded && pathname !== "/onboarding")
    return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** The daily mood check-in: shell routes redirect here until today's mood exists. */
function MoodGate({ children }: { children: React.ReactNode }) {
  const userId = useAuth((s) => s.user?.id);
  const { pathname } = useLocation();
  const today = useTodayMood(userId);
  if (today.isLoading) return <Splash />;
  if (!today.data && pathname !== "/mood") return <Navigate to="/mood" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <MoodGate>
        <AppShell>{children}</AppShell>
      </MoodGate>
    </RequireAuth>
  );
}

function AuthedApp() {
  const profile = useAuth((s) => s.profile);

  // Theme + accent follow the profile; season is a local premium preference
  useEffect(() => {
    applyTheme(profile?.theme ?? "system");
    applyAccent(profile?.accent ?? null);
    applySeason(storedSeason());
  }, [profile?.theme, profile?.accent]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(profile?.theme ?? "system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [profile?.theme]);

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/mood"
        element={
          <RequireAuth>
            <MoodCheckIn />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Shell><Home /></Shell>} />
      <Route path="/habits" element={<Shell><Habits /></Shell>} />
      <Route path="/stats" element={<Shell><Statistics /></Shell>} />
      <Route path="/quote" element={<Shell><QuotePage /></Shell>} />
      <Route path="/games" element={<Shell><GamesHub /></Shell>} />
      <Route path="/games/catch" element={<Shell><CatchGame /></Shell>} />
      <Route path="/games/breathe" element={<Shell><BreatheGame /></Shell>} />
      <Route path="/games/quiz" element={<Shell><QuizGame /></Shell>} />
      <Route path="/games/memory" element={<Shell><MemoryGame /></Shell>} />
      <Route path="/focus" element={<Shell><Focus /></Shell>} />
      <Route path="/profile" element={<Shell><Profile /></Shell>} />
      <Route path="/settings" element={<Shell><Settings /></Shell>} />
      <Route path="/paywall" element={<Shell><Paywall /></Shell>} />
      <Route path="/admin" element={<Shell><Admin /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Root() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);
  const init = useAuth((s) => s.init);
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  useEffect(() => {
    void init();
  }, [init]);

  // Sync language once the profile lands
  useEffect(() => {
    if (profile?.locale && profile.locale !== i18n.language) {
      void i18n.changeLanguage(profile.locale);
      localStorage.setItem("aq.locale", profile.locale);
    }
  }, [profile?.locale, i18n]);

  // Fresh auth state invalidates every cached query
  useEffect(() => {
    void queryClient.invalidateQueries();
  }, [user?.id, queryClient]);

  if (!ready) return <Splash />;

  // No login screens: a guest session is provisioned automatically and keys
  // are entered in Settings (bot-driven auth for Telegram / MAX).
  return <AuthedApp />;
}

export default function App({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app-gradient" aria-hidden />
        <Root />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
