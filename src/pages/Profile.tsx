import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Award, Crown, Shield, ShieldCheck, Trash2, User as UserIcon } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useAuth } from "@/store/auth";
import {
  useAchievements,
  useDailyChallengeHistory,
  useFocusSessions,
  useGameScores,
  useStreaks,
} from "@/hooks/useData";
import { ACHIEVEMENT_CODES, backend, type AchievementCode } from "@/lib/backend";
import { useAddFriend, useFriends, useRemoveFriend } from "@/hooks/useData";
import { levelTitle } from "@/lib/levelTitle";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Current progress toward each achievement, for the details sheet. */
function useAchievementProgress() {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id;
  const { streaks } = useStreaks(userId);
  const focus = useFocusSessions(userId);
  const games = useGameScores(userId);
  const challengeHistory = useDailyChallengeHistory(userId);

  return useMemo(() => {
    const rows = games.data ?? [];
    const catchBest = Math.max(0, ...rows.filter((r) => r.game === "catch").map((r) => r.score));
    const quizCorrect = rows.filter((r) => r.game === "quiz").reduce((s, r) => s + r.score, 0);
    const breatheCount = rows.filter((r) => r.game === "breathe").length;
    const challengesDone = (challengeHistory.data ?? []).filter((c) => c.done).length;
    const focusCount = focus.data?.length ?? 0;
    const progress: Record<AchievementCode, { value: number; goal: number }> = {
      week_streak: { value: Math.min(streaks.current, 7), goal: 7 },
      month_streak: { value: Math.min(streaks.current, 30), goal: 30 },
      focus10: { value: Math.min(focusCount, 10), goal: 10 },
      checkin7: { value: Math.min(streaks.current, 7), goal: 7 },
      arcade100: { value: Math.min(catchBest, 100), goal: 100 },
      breathe5: { value: Math.min(breatheCount, 5), goal: 5 },
      quiz15: { value: Math.min(quizCorrect, 15), goal: 15 },
      challenge7: { value: Math.min(challengesDone, 7), goal: 7 },
    };
    return progress;
  }, [streaks.current, focus.data, games.data, challengeHistory.data]);
}

export default function Profile() {
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  const achievements = useAchievements(profile ? profile.id : undefined);
  const progress = useAchievementProgress();
  const friends = useFriends(profile ? profile.id : undefined);
  const addFriend = useAddFriend(profile ? profile.id : undefined);
  const removeFriend = useRemoveFriend(profile ? profile.id : undefined);
  const [friendCode, setFriendCode] = useState("");
  const [friendError, setFriendError] = useState(false);
  const [details, setDetails] = useState<AchievementCode | null>(null);

  if (!profile) return null;

  const unlocked = new Set((achievements.data ?? []).map((a) => a.code));
  const xpInLevel = profile.xp % 100;

  const RoleBadge =
    profile.role === "admin" ? Shield : profile.role === "premium" ? Crown : UserIcon;
  const roleKey = `profile.role_${profile.role}`;
  const detail = details
    ? { code: details, ...progress[details] }
    : null;

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-semibold">{t("profile.title")}</h1>

      <Card className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-white">
          {(profile.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{profile.name}</p>
          <p className="truncate text-sm text-[var(--aq-secondary)]">{profile.email}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">
            <RoleBadge size={12} />
            {t(roleKey)}
          </span>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>
            {t("home.level")} {profile.level} · {levelTitle(profile.level)}
          </CardTitle>
          <span className="text-sm text-[var(--aq-secondary)]">{profile.xp} XP</span>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          role="progressbar"
          aria-valuenow={xpInLevel}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${xpInLevel}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--aq-secondary)]">
          {t("profile.toLevel", { left: 100 - xpInLevel, level: profile.level + 1 })}
        </p>
        <p className="mt-1 text-xs text-[var(--aq-secondary)]">
          {t("profile.joined")}{" "}
          {new Date(profile.created_at).toLocaleDateString(undefined, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </Card>

      <section aria-label={t("achievements.title")}>
        <CardTitle className="mb-2 px-1">{t("achievements.title")}</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENT_CODES.map((code) => {
            const has = unlocked.has(code);
            const pr = progress[code];
            return (
              <button
                key={code}
                onClick={() => setDetails(code)}
                className="text-left"
                aria-label={t(`achievements.${code}`)}
              >
                <Card
                  className={cn(
                    "flex h-full flex-col items-center gap-1.5 p-4 text-center",
                    !has && "opacity-60",
                  )}
                >
                  <Award
                    size={26}
                    className={has ? "text-accent" : "text-[var(--aq-secondary)]"}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold">{t(`achievements.${code}`)}</span>
                  <span className="text-xs text-[var(--aq-secondary)]">
                    {has ? t("achievements.unlockedAt") : t("achievements.locked")}
                  </span>
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      {/* Achievement details: requirement + current progress */}
      <Sheet
        open={details !== null}
        onClose={() => setDetails(null)}
        title={details ? t(`achievements.${details}`) : undefined}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Award size={24} />
              </span>
              <p className="text-[15px] text-[var(--aq-secondary)]">
                {t(`achievements.${detail.code}_d`)}
              </p>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
              role="progressbar"
              aria-valuenow={detail.value}
              aria-valuemin={0}
              aria-valuemax={detail.goal}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.round((detail.value / detail.goal) * 100)}%` }}
              />
            </div>
            <p className="text-center text-sm font-medium tabular-nums">
              {detail.value} / {detail.goal}
            </p>
            <Button className="w-full" onClick={() => setDetails(null)}>
              {t("common.close")}
            </Button>
          </div>
        )}
      </Sheet>

      {/* Friends leaderboard */}
      <section aria-label={t("extra.friends")}>
        <CardTitle className="mb-2 px-1">{t("extra.friends")}</CardTitle>
        <Card className="space-y-3">
          {backend.mode === "demo" && (
            <p className="text-xs text-[var(--aq-secondary)]">{t("extra.friends_demo")}</p>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--aq-secondary)]">{t("extra.friends_code")}</span>
            <code className="rounded-lg bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
              {profile.id.slice(0, 8)}
            </code>
          </div>
          <div className="flex gap-2">
            <input
              value={friendCode}
              onChange={(e) => {
                setFriendCode(e.target.value);
                setFriendError(false);
              }}
              placeholder={t("extra.friends_ph")}
              aria-label={t("extra.friends_add")}
              className="h-[44px] min-w-0 flex-1 rounded-field bg-white/80 px-3 text-sm shadow-field outline-none dark:bg-white/10"
            />
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!friendCode.trim()}
              onClick={() => {
                void addFriend.mutateAsync(friendCode.trim()).then(() => setFriendCode("")).catch(() => setFriendError(true));
              }}
            >
              <UserPlus size={15} /> {t("extra.friends_add")}
            </Button>
          </div>
          {friendError && (
            <p className="text-xs text-[#E5484D]">{t("settings.keyWrong")}</p>
          )}
          <div className="space-y-2">
            {(friends.data ?? []).map(({ friend }) => (
              <div
                key={friend.id}
                className="flex items-center justify-between rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.05]"
              >
                <span className="text-sm font-medium">{friend.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-[var(--aq-secondary)]">
                    {t("extra.friends_xp")}: {friend.xp}
                  </span>
                  <button
                    onClick={() => void removeFriend.mutateAsync(friend.id)}
                    aria-label={t("common.delete")}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#E5484D] hover:bg-[#E5484D]/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
            {(friends.data ?? []).length === 0 && (
              <p className="py-1 text-center text-sm text-[var(--aq-secondary)]">
                {t("extra.friends_empty")}
              </p>
            )}
          </div>
        </Card>
      </section>

      {profile.role === "admin" && (
        <Card className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <ShieldCheck size={18} className="text-accent" /> {t("profile.adminPanel")}
          </span>
          <Link to="/admin">
            <Button size="sm">{t("common.continue")}</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
