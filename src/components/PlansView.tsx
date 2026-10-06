import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import {
  useCreatePlan,
  useDeletePlan,
  usePlans,
  useTogglePlan,
  useUpdatePlan,
} from "@/hooks/useData";
import { scheduleHabitReminder } from "@/lib/notifications";
import { XP_PER_PLAN, type Plan } from "@/lib/backend";
import { addDays, isoDate, parseIso } from "@/lib/date";
import { hapticTap, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type RangeKey = "today" | "week" | "month" | "all";

/** Monday..Sunday week containing `d`. */
function weekRange(d: Date): { from: string; to: string } {
  const wd = (d.getDay() + 6) % 7;
  const monday = addDays(d, -wd);
  const sunday = addDays(monday, 6);
  return { from: isoDate(monday), to: isoDate(sunday) };
}

export function PlansView() {
  const { t } = useTranslation();
  const push = useToasts((s) => s.push);
  const userId = useAuth((s) => s.user?.id);
  const plans = usePlans(userId);
  const createPlan = useCreatePlan(userId);
  const togglePlan = useTogglePlan(userId);
  const deletePlan = useDeletePlan(userId);

  const [range, setRange] = useState<RangeKey>("today");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(isoDate());
  const [repeat, setRepeat] = useState<Plan["repeat"]>("none");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);
  const updatePlan = useUpdatePlan(userId);
  const icsRef = useRef<HTMLInputElement>(null);

  const rangeBounds = useMemo(() => {
    const today = isoDate();
    if (range === "today") return { from: today, to: today };
    if (range === "week") return weekRange(new Date());
    if (range === "month") {
      const now = new Date();
      const from = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from, to };
    }
    return null;
  }, [range]);

  const visible = useMemo(() => {
    const rows = [...(plans.data ?? [])].sort((a, b) =>
      a.done === b.done ? a.due.localeCompare(b.due) : a.done ? 1 : -1,
    );
    if (!rangeBounds) return rows;
    return rows.filter((p) => p.due >= rangeBounds.from && p.due <= rangeBounds.to);
  }, [plans.data, rangeBounds]);

  const add = async () => {
    if (!title.trim() || !userId) return;
    const created = await createPlan.mutateAsync({ title: title.trim(), due, repeat });
    setTitle("");
    // Light reminder at 9:00 on the due day (if within a week).
    const daysAhead = Math.round((parseIso(due).getTime() - Date.now()) / 86_400_000);
    if (daysAhead >= 0 && daysAhead <= 7) {
      void scheduleHabitReminder(created.id, t("plans.new") + ": " + created.title, "09:00", []);
      push(t("extra.plan_reminder_set"), "info");
    }
    push(t("plans.new"), "success");
  };

  /** Toggling a recurring plan done spawns its next instance. */
  const toggleWithRepeat = async (plan: Plan) => {
    const wasDone = plan.done;
    await toggle(plan);
    if (!wasDone && plan.repeat !== "none") {
      const d = parseIso(plan.due);
      const next = new Date(d);
      if (plan.repeat === "daily") next.setDate(next.getDate() + 1);
      if (plan.repeat === "weekly") next.setDate(next.getDate() + 7);
      if (plan.repeat === "monthly") next.setMonth(next.getMonth() + 1);
      await createPlan.mutateAsync({
        title: plan.title,
        due: isoDate(next),
        repeat: plan.repeat,
        subtasks: plan.subtasks.map((st) => ({ ...st, done: false })),
      });
    }
  };

  /** Minimal .ics parser: creates a plan per VEVENT with a date start. */
  const importIcs = async (file: File) => {
    const text = await file.text();
    const events = text.split("BEGIN:VEVENT").slice(1);
    let n = 0;
    for (const ev of events) {
      const summary = /SUMMARY[^:]*:(.*)/.exec(ev)?.[1]?.trim();
      const dt = /DTSTART[^:]*:([0-9]{8})/.exec(ev)?.[1];
      if (!summary || !dt) continue;
      const iso = dt.slice(0, 4) + "-" + dt.slice(4, 6) + "-" + dt.slice(6, 8);
      await createPlan.mutateAsync({ title: summary, due: iso });
      n += 1;
    }
    push(t("ics_imported", { n }), n > 0 ? "success" : "info");
  };

  const toggleSubtask = async (plan: Plan, index: number) => {
    const subtasks = plan.subtasks.map((st, i) =>
      i === index ? { ...st, done: !st.done } : st,
    );
    await updatePlan.mutateAsync({ id: plan.id, patch: { subtasks } });
  };

  const toggle = async (plan: Plan) => {
    void hapticTap();
    if (!plan.done) {
      setBurst({ id: plan.id, n: (burst?.n ?? 0) + 1 });
      void hapticSuccess();
      push(t("plans.xp"), "success");
    }
    await togglePlan.mutateAsync({ plan, done: !plan.done });
  };

  const remove = async (plan: Plan) => {
    if (!window.confirm(t("plans.deleteConfirm"))) return;
    await deletePlan.mutateAsync(plan.id);
  };

  const todayIso = isoDate();
  const RANGES: RangeKey[] = ["today", "week", "month", "all"];

  const dueLabel = (p: Plan) => {
    const d = parseIso(p.due);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="glass-pill flex w-fit gap-1 p-1" role="tablist" aria-label={t("plans.new")}>
        {RANGES.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            onClick={() => setRange(r)}
            className={cn(
              "min-h-[40px] rounded-full px-4 text-sm font-medium transition-colors",
              range === r
                ? "bg-accent text-white"
                : "text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10",
            )}
          >
            {t(`plans.${r}`)}
          </button>
        ))}
      </div>

      {/* Add form */}
      <Card className="flex flex-wrap items-center gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder={t("plans.ph")}
          aria-label={t("plans.ph")}
          className="h-[52px] min-w-0 flex-1 rounded-field bg-white/80 px-4 text-[16px] shadow-field outline-none placeholder:text-[var(--aq-secondary)] focus-visible:ring-[3px] focus-visible:ring-[var(--aq-ring)] dark:bg-white/10"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label={t("plans.new")}
          className="h-[52px] rounded-field bg-white/80 px-3 text-[15px] shadow-field outline-none dark:bg-white/10 dark:[color-scheme:dark]"
        />
        <select
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as Plan["repeat"])}
          aria-label={t("extra.plans_repeat")}
          className="h-[52px] rounded-field bg-white/80 px-3 text-[15px] shadow-field outline-none dark:bg-white/10 dark:[color-scheme:dark]"
        >
          <option value="none">{t("extra.repeat_none")}</option>
          <option value="daily">{t("extra.repeat_daily")}</option>
          <option value="weekly">{t("extra.repeat_weekly")}</option>
          <option value="monthly">{t("extra.repeat_monthly")}</option>
        </select>
        <Button onClick={() => void add()} disabled={!title.trim()} className="gap-1.5">
          <Plus size={16} /> {t("common.add")}
        </Button>
        <input
          ref={icsRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importIcs(f);
            e.target.value = "";
          }}
        />
        <Button variant="glass" onClick={() => icsRef.current?.click()} className="gap-1.5">
          <Upload size={16} /> {t("extra.plans_ics")}
        </Button>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {plans.isLoading && (
          <Card className="text-center text-sm text-[var(--aq-secondary)]">
            {t("common.loading")}
          </Card>
        )}
        {!plans.isLoading && visible.length === 0 && (
          <Card className="text-center text-sm text-[var(--aq-secondary)]">
            {t("plans.empty")}
          </Card>
        )}
        <AnimatePresence initial={false}>
          {visible.map((p) => {
            const overdue = !p.done && p.due < todayIso;
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                <Card className={cn("flex items-center gap-4 p-4", p.done && "opacity-70")}>
                  <button
                    onClick={() => void toggleWithRepeat(p)}
                    aria-pressed={p.done}
                    aria-label={p.title}
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    {burst?.id === p.id && <Particles burstKey={burst.n} />}
                    <motion.span
                      animate={p.done ? { scale: [0.8, 1.18, 1] } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                        p.done
                          ? "border-transparent bg-accent text-white"
                          : "border-black/20 dark:border-white/30",
                      )}
                    >
                      {p.done && <Check size={17} strokeWidth={3} />}
                    </motion.span>
                  </button>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block font-semibold text-[var(--aq-foreground)]",
                        p.done && "line-through decoration-[var(--aq-secondary)]",
                      )}
                    >
                      {p.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs">
                      <CalendarDays size={13} className="text-[var(--aq-secondary)]" />
                      <span className="text-[var(--aq-secondary)]">{dueLabel(p)}</span>
                      {overdue && (
                        <span className="rounded-full bg-[#E5484D]/15 px-2 py-0.5 font-medium text-[#E5484D]">
                          {t("plans.overdue")}
                        </span>
                      )}
                      {p.repeat !== "none" && (
                        <span className="rounded-full bg-accent/12 px-2 py-0.5 font-medium text-accent">
                          ↻ {t("repeat_" + p.repeat)}
                        </span>
                      )}
                      {p.subtasks.length > 0 && (
                        <button
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                          aria-label={t("extra.plans_subtasks")}
                          className="flex items-center gap-1 text-[var(--aq-secondary)]"
                        >
                          <ChevronDown
                            size={13}
                            className={cn("transition-transform", expanded === p.id && "rotate-180")}
                          />
                          {p.subtasks.filter((st) => st.done).length}/{p.subtasks.length}
                        </button>
                      )}
                    </span>
                  </span>
                  <button
                    onClick={() => void remove(p)}
                    aria-label={t("common.delete")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#E5484D] hover:bg-[#E5484D]/10"
                  >
                    <Trash2 size={17} />
                  </button>
                </Card>
                {expanded === p.id && p.subtasks.length > 0 && (
                  <div className="glass mt-2 space-y-2 p-3">
                    {p.subtasks.map((st, i) => (
                      <button
                        key={i}
                        onClick={() => void toggleSubtask(p, i)}
                        className="flex w-full items-center gap-2 text-left text-sm"
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
                            st.done
                              ? "border-transparent bg-accent text-white"
                              : "border-black/20 dark:border-white/30",
                          )}
                        >
                          {st.done && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className={cn(st.done && "line-through text-[var(--aq-secondary)]")}>
                          {st.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
