import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HabitCard, habitIcon } from "@/components/HabitCard";
import { HabitForm } from "@/components/HabitForm";
import { PlansView } from "@/components/PlansView";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { backend, FREE_HABIT_LIMIT, type Habit } from "@/lib/backend";
import { isoDate, weekdayIndex } from "@/lib/date";
import { useHabitLogs, useHabits, useToggleHabitLog } from "@/hooks/useData";
import { cn } from "@/lib/utils";

export default function Habits() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.user?.id);
  const [tab, setTab] = useState<"habits" | "plans">("habits");
  const habits = useHabits(userId);
  const today = isoDate();
  const wd = weekdayIndex();
  const logs = useHabitLogs(userId, today, today);
  const toggleLog = useToggleHabitLog(userId);

  const [editing, setEditing] = useState<Habit | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const doneSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs.data ?? []) if (l.done) s.add(l.habit_id);
    return s;
  }, [logs.data]);

  const isPremium = profile?.role === "premium" || profile?.role === "admin";
  const atLimit = !isPremium && (habits.data?.length ?? 0) >= FREE_HABIT_LIMIT;

  const openCreate = () => {
    if (atLimit) {
      push(t("habits.limitReached"), "info");
      navigate("/paywall");
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  const remove = async (habit: Habit) => {
    if (!window.confirm(t("habits.deleteConfirm"))) return;
    await backend.deleteHabit(habit.id);
    push(t("common.done"), "success");
    habits.refetch();
  };

  const daysShort = t("habits.daysShort", { returnObjects: true }) as string[];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold">{t("nav.tasks")}</h1>
        {tab === "habits" && (
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            {atLimit ? <Lock size={15} /> : <Plus size={16} />}
            {t("habits.new")}
          </Button>
        )}
      </header>

      {/* Habits | Plans tabs */}
      <div className="glass-pill flex w-fit gap-1 p-1" role="tablist" aria-label={t("nav.tasks")}>
        {(
          [
            { key: "habits", label: t("habits.tab_habits") },
            { key: "plans", label: t("habits.tab_plans") },
          ] as const
        ).map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              "min-h-[40px] rounded-full px-5 text-sm font-medium transition-colors",
              tab === tb.key ? "bg-accent text-white" : "text-[var(--aq-secondary)]",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "plans" && <PlansView />}

      {tab === "habits" && (
        <>
          {habits.isLoading && (
            <Card className="text-center text-sm text-[var(--aq-secondary)]">
              {t("common.loading")}
            </Card>
          )}

          {!habits.isLoading && (habits.data?.length ?? 0) === 0 && (
            <Card className="text-center text-sm text-[var(--aq-secondary)]">
              {t("habits.nothing")}
            </Card>
          )}

          <div className="space-y-3">
            {(habits.data ?? []).map((h) => {
              const scheduledToday = h.schedule.includes(wd);
              return (
                <div key={h.id} className="space-y-2">
                  {scheduledToday ? (
                    <HabitCard
                      habit={h}
                      done={doneSet.has(h.id)}
                      onToggle={async () => {
                        await toggleLog.mutateAsync({
                          habitId: h.id,
                          date: today,
                          done: !doneSet.has(h.id),
                        });
                      }}
                    />
                  ) : (
                    <Card className="flex items-center gap-4 opacity-70">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                        style={{ background: h.color }}
                        aria-hidden
                      >
                        {habitIcon(h.icon)}
                      </span>
                      <span className="flex-1 font-semibold">{h.title}</span>
                      <span className="text-xs text-[var(--aq-secondary)]">
                        {h.schedule.map((d) => daysShort[d]).join(" ")}
                      </span>
                    </Card>
                  )}
                  <div className="flex justify-end gap-2 px-1">
                    <button
                      onClick={() => {
                        setEditing(h);
                        setFormOpen(true);
                      }}
                      aria-label={t("habits.edit")}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => void remove(h)}
                      aria-label={t("common.delete")}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[#E5484D] hover:bg-[#E5484D]/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {atLimit && (
            <Card className="flex items-center justify-between text-sm">
              <span className="text-[var(--aq-secondary)]">{t("home.freeLimit")}</span>
              <Button size="sm" onClick={() => navigate("/paywall")}>
                {t("common.upgrade")}
              </Button>
            </Card>
          )}
        </>
      )}

      <HabitForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        userId={userId ?? ""}
        habit={editing}
      />
    </div>
  );
}
