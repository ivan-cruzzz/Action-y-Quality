import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Lu from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FloatInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { backend, type Habit } from "@/lib/backend";
import { useToasts } from "@/store/toast";
import { scheduleHabitReminder, cancelHabitReminder } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/haptics";

export const HABIT_ICONS = [
  "Dumbbell",
  "BookOpen",
  "Droplets",
  "Moon",
  "Sun",
  "Apple",
  "Footprints",
  "Brain",
  "HeartPulse",
  "PenLine",
  "Music",
  "GlassWater",
] as const;

export const HABIT_COLORS = [
  "#EC6FA0",
  "#30A46C",
  "#F97316",
  "#9B8AFB",
  "#E5484D",
  "#FFC53D",
  "#14B8A6",
  "#EC4899",
];

interface HabitFormProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  habit?: Habit | null;
}

interface FormState {
  title: string;
  icon: string;
  color: string;
  schedule: number[];
  reminderOn: boolean;
  reminderAt: string;
}

const empty: FormState = {
  title: "",
  icon: "Dumbbell",
  color: HABIT_COLORS[0],
  schedule: [0, 1, 2, 3, 4],
  reminderOn: false,
  reminderAt: "09:00",
};

export function HabitForm({ open, onClose, userId, habit }: HabitFormProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const push = useToasts((s) => s.push);
  const [form, setForm] = useState<FormState>(
    habit
      ? {
          title: habit.title,
          icon: habit.icon,
          color: habit.color,
          schedule: habit.schedule,
          reminderOn: !!habit.reminder_at,
          reminderAt: habit.reminder_at ?? "09:00",
        }
      : empty,
  );
  const [titleError, setTitleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: number) => {
    void hapticTap();
    setForm((f) => ({
      ...f,
      schedule: f.schedule.includes(d)
        ? f.schedule.filter((x) => x !== d)
        : [...f.schedule, d].sort(),
    }));
  };

  const save = async () => {
    if (!form.title.trim()) {
      setTitleError(t("auth.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        user_id: userId,
        title: form.title.trim(),
        icon: form.icon,
        color: form.color,
        schedule: form.schedule.length ? form.schedule : [0, 1, 2, 3, 4, 5, 6],
        reminder_at: form.reminderOn ? form.reminderAt : null,
      };
      if (habit) {
        await backend.updateHabit(habit.id, payload);
        if (form.reminderOn && form.reminderAt)
          await scheduleHabitReminder(habit.id, form.title, form.reminderAt, payload.schedule);
        else await cancelHabitReminder(habit.id);
      } else {
        const created = await backend.createHabit(payload);
        if (form.reminderOn && form.reminderAt)
          await scheduleHabitReminder(created.id, form.title, form.reminderAt, payload.schedule);
      }
      void qc.invalidateQueries({ queryKey: ["habits", userId] });
      push(t("habits.saved"), "success");
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const IconCmp =
    (Lu as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[
      form.icon
    ] ?? Lu.Circle;

  return (
    <Sheet open={open} onClose={onClose} title={habit ? t("habits.edit") : t("habits.new")}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
            style={{ background: form.color }}
          >
            <IconCmp size={22} />
          </span>
          <div className="flex-1">
            <FloatInput
              label={t("habits.name")}
              value={form.title}
              onValueChange={(v) => {
                setForm((f) => ({ ...f, title: v }));
                setTitleError(null);
              }}
              error={titleError}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--aq-secondary)]">{t("habits.icon")}</p>
          <div className="grid grid-cols-6 gap-2">
            {HABIT_ICONS.map((name) => {
              const C = Lu[name] as React.ComponentType<{ size?: number }>;
              return (
                <button
                  key={name}
                  onClick={() => setForm((f) => ({ ...f, icon: name }))}
                  aria-pressed={form.icon === name}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-xl transition-colors",
                    form.icon === name
                      ? "bg-accent text-white"
                      : "bg-black/5 text-[var(--aq-secondary)] dark:bg-white/10",
                  )}
                >
                  <C size={20} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--aq-secondary)]">{t("habits.color")}</p>
          <div className="flex gap-2.5">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                aria-pressed={form.color === c}
                aria-label={c}
                className={cn(
                  "h-9 w-9 rounded-full transition-transform",
                  form.color === c &&
                    "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-[#0E2A44]",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--aq-secondary)]">
            {t("habits.schedule")}
          </p>
          <div className="flex gap-1.5">
            {(t("habits.daysShort", { returnObjects: true }) as string[]).map((d, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                aria-pressed={form.schedule.includes(i)}
                className={cn(
                  "h-11 flex-1 rounded-xl text-sm font-medium transition-colors",
                  form.schedule.includes(i)
                    ? "bg-accent text-white"
                    : "bg-black/5 text-[var(--aq-secondary)] dark:bg-white/10",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-black/[0.04] p-4 dark:bg-white/[0.06]">
          <span className="font-medium">{t("habits.reminder")}</span>
          <div className="flex items-center gap-3">
            {form.reminderOn && (
              <input
                type="time"
                value={form.reminderAt}
                onChange={(e) => setForm((f) => ({ ...f, reminderAt: e.target.value }))}
                className="rounded-lg bg-white/80 px-2 py-1.5 text-sm dark:bg-white/10"
                aria-label={t("habits.reminder")}
              />
            )}
            <Switch
              checked={form.reminderOn}
              onCheckedChange={(v) => setForm((f) => ({ ...f, reminderOn: v }))}
              label={t("habits.reminder")}
            />
          </div>
        </div>
        <p className="-mt-3 text-xs text-[var(--aq-secondary)]">{t("settings.notifDemo")}</p>

        <div className="flex gap-3 pt-1">
          <Button variant="glass" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={() => void save()} disabled={busy}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
