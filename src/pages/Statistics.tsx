import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Flame, Lock, Zap, Percent, Download } from "lucide-react";
import LineChart from "@/components/ui/line-chart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { backend } from "@/lib/backend";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { useStats, useStreaks, useMoods, type StatsPeriod } from "@/hooks/useData";
import { Heatmap, MoodJournal } from "@/components/Insights";
import { isoDate } from "@/lib/date";
import { exportStatsPng } from "@/lib/exportPng";
import { cn } from "@/lib/utils";

const PERIODS: { key: StatsPeriod; i18n: string }[] = [
  { key: "week", i18n: "stats.week" },
  { key: "month", i18n: "stats.month" },
  { key: "year", i18n: "stats.year" },
];

export default function Statistics() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.user?.id);
  const [period, setPeriod] = useState<StatsPeriod>("week");

  const stats = useStats(userId, period);
  const { streaks } = useStreaks(userId);

  const isPremium = profile?.role === "premium" || profile?.role === "admin";
  const premiumPeriod = period !== "week";

  const weekLogs = useQuery({
    queryKey: ["logs", userId, "heatmap"],
    enabled: !!userId,
    queryFn: async () => {
      const from = isoDate(new Date(new Date().setDate(new Date().getDate() - 105)));
      const to = isoDate(new Date());
      return backend.getHabitLogs(userId!, from, to);
    },
  });
  const journalMoods = useMoods(
    userId,
    isoDate(new Date(new Date().setDate(new Date().getDate() - 30))),
    isoDate(new Date()),
  );

  const series = useMemo(
    () => [
      { key: "habits", label: t("stats.habitsSeries"), color: "var(--accent)" },
      {
        key: "mood",
        label: t("stats.moodSeries"),
        color: "color-mix(in srgb, var(--foreground) 42%, var(--surface))",
        area: false,
      },
    ],
    [t],
  );

  const doExport = () => {
    if (!stats.data.length) return;
    const periodLabel = t(PERIODS.find((p) => p.key === period)?.i18n ?? "stats.week");
    exportStatsPng({
      title: "Action & Quality",
      periodLabel,
      summaries: [
        { label: t("stats.streakCard").replace(" 🔥", ""), value: String(streaks.current) },
        { label: t("stats.xpCard"), value: String(profile?.xp ?? 0) },
        { label: t("stats.completionCard"), value: `${stats.completion}%` },
      ],
      points: stats.data.map((d) => ({
        label: d.label,
        a: d.values.habits ?? 0,
        b: Math.round((d.values.mood ?? 0) * 10) / 10,
      })),
      seriesNames: [t("stats.habitsSeries"), t("stats.moodSeries")],
    });
    push(t("stats.exported"), "success");
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-semibold">{t("stats.title")}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <Flame className="mx-auto text-[#F97316]" size={20} aria-hidden />
          <AnimatedNumber value={streaks.current} className="mt-1 block text-2xl font-semibold" />
          <span className="text-xs text-[var(--aq-secondary)]">{t("stats.streakCard")}</span>
        </Card>
        <Card className="p-4 text-center">
          <Zap className="mx-auto text-accent" size={20} aria-hidden />
          <AnimatedNumber value={profile?.xp ?? 0} className="mt-1 block text-2xl font-semibold" />
          <span className="text-xs text-[var(--aq-secondary)]">{t("stats.xpCard")}</span>
        </Card>
        <Card className="p-4 text-center">
          <Percent className="mx-auto text-[#30A46C]" size={20} aria-hidden />
          <AnimatedNumber
            value={stats.completion}
            suffix="%"
            className="mt-1 block text-2xl font-semibold"
          />
          <span className="text-xs text-[var(--aq-secondary)]">{t("stats.completionCard")}</span>
        </Card>
      </div>

      {/* Period switcher */}
      <div className="glass-pill flex w-fit gap-1 p-1" role="tablist" aria-label={t("stats.title")}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "min-h-[40px] rounded-full px-5 text-sm font-medium transition-colors",
              period === p.key
                ? "bg-accent text-white"
                : "text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10",
            )}
          >
            {t(p.i18n)}
            {!isPremium && p.key !== "week" && <Lock size={12} className="ml-1 inline" />}
          </button>
        ))}
      </div>

      {premiumPeriod && !isPremium ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <Lock size={32} className="text-[var(--aq-secondary)]" aria-hidden />
          <p className="text-[var(--aq-secondary)]">{t("stats.premiumPeriods")}</p>
          <Button onClick={() => navigate("/paywall")}>{t("common.upgrade")}</Button>
        </Card>
      ) : (
        <Card className="p-4">
          <LineChart
            data={stats.data}
            series={series}
            label={t("stats.chartLabel")}
            height={240}
            loading={stats.loading}
            emptyLabel={t("stats.empty")}
            formatValue={(value, s) =>
              s.key === "mood"
                ? (Math.round(value * 10) / 10).toFixed(1)
                : String(Math.round(value))
            }
          />
        </Card>
      )}

      {isPremium && (
        <div className="flex justify-end">
          <Button variant="glass" size="sm" onClick={doExport} className="gap-2">
            <Download size={16} /> {t("stats.export")}
          </Button>
        </div>
      )}

      <Heatmap logs={weekLogs.data ?? []} />
      <MoodJournal moods={journalMoods.data ?? []} />
    </div>
  );
}
