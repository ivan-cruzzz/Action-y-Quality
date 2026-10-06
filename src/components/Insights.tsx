import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardTitle } from "@/components/ui/card";
import { isoDate, parseIso } from "@/lib/date";
import type { Mood } from "@/lib/backend/types";
import { cn } from "@/lib/utils";

/** 15-week GitHub-style activity map of habit completions. */
export function Heatmap({ logs }: { logs: { date: string; done: boolean }[] }) {
  const { t } = useTranslation();

  const { weeks, maxInDay } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logs) {
      if (!l.done) continue;
      counts.set(l.date, (counts.get(l.date) ?? 0) + 1);
    }
    const maxInDay = Math.max(1, ...counts.values());
    const end = parseIso(isoDate(new Date()));
    const cells: string[] = [];
    for (let i = 104; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      cells.push(isoDate(d));
    }
    const weeks: string[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { weeks, maxInDay };
  }, [logs]);

  const level = (date: string): number => {
    const count = logs.reduce((s, l) => s + (l.date === date && l.done ? 1 : 0), 0);
    if (count === 0) return 0;
    return Math.min(4, 1 + Math.floor((count / maxInDay) * 3.999));
  };

  const todayIso = isoDate();

  return (
    <Card>
      <CardTitle>{t("extra.heatmap")}</CardTitle>
      <div className="mt-3 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((date) => {
              const lv = level(date);
              return (
                <span
                  key={date}
                  title={`${date}: ${lv ? "●".repeat(lv) : "—"}`}
                  className={cn(
                    "h-3.5 w-3.5 rounded-[4px]",
                    lv === 0 && "bg-black/[0.07] dark:bg-white/[0.08]",
                    lv === 1 && "bg-accent/25",
                    lv === 2 && "bg-accent/50",
                    lv === 3 && "bg-accent/75",
                    lv === 4 && "bg-accent",
                    date === todayIso && "ring-2 ring-[var(--aq-ring)]",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--aq-secondary)]">{t("extra.heatmap_empty")}</p>
    </Card>
  );
}

/** Mood journal: last 7 entries with notes. */
export function MoodJournal({ moods }: { moods: Mood[] }) {
  const { t } = useTranslation();
  const last = useMemo(
    () => [...moods].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7),
    [moods],
  );

  return (
    <Card>
      <CardTitle>{t("extra.journal")}</CardTitle>
      <div className="mt-3 space-y-2">
        {last.length === 0 && (
          <p className="py-2 text-center text-sm text-[var(--aq-secondary)]">
            {t("extra.journal_empty")}
          </p>
        )}
        {last.map((m) => (
          <div key={m.id} className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.05]">
            <p className="text-sm font-medium">
              {t(`mood.m_${m.mood}`)} ·{" "}
              <span className="text-[var(--aq-secondary)]">
                {parseIso(m.date).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </p>
            {m.note && <p className="mt-0.5 text-sm text-[var(--aq-secondary)]">{m.note}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
